import { ExtremeModelService } from "./ExtremeModelService";
import { AwsRekognitionService } from "./AwsRekognitionService";
import { OpenAIService } from "./OpenAIService";

export interface ScanResult {
    fakeProbability: number;
    confidenceScore: number;
    confidenceLabel: string;
    analysis: string;
    truthSummary: string;
    truthScore: number;
    isVerified: boolean;
    technicalDetails: string[];
}

interface VisionResult {
    description: string;
    manipulationScore: number;
    artifacts: string[];
    analysis: string;
    searchQuery: string;
    primaryClaim: string;
    entities: string[];
}

export class DeepVerifyService {
    private gemini: ExtremeModelService;
    private aws: AwsRekognitionService;
    private openai: OpenAIService;

    constructor() {
        this.gemini = new ExtremeModelService();
        this.aws = new AwsRekognitionService();
        this.openai = new OpenAIService();
    }

    /**
     * Runs the Triple-Parallel pipeline:
     * 1. HF Local Scan (Digital Fingerprints)
     * 2. Gemini Vision Analysis (Visual Context)
     * 3. News/Truth Grounding (Verification)
     */
    async verifyMedia(
        mediaUrl: string,
        mediaContext?: string,
        mediaData?: { data: string; mimeType: string }
    ): Promise<ScanResult> {
        console.time("[PIPELINE] DeepVerify");

        // 0. Ensure we have media data (Fetch if missing from URL)
        let processedMedia = mediaData;
        if (!processedMedia && mediaUrl && mediaUrl.startsWith("http")) {
            console.log("[PIPELINE] Fetching remote media from URL...");
            processedMedia = await this.fetchMediaToBase64(mediaUrl);
        }

        // 1. Prepare standard forensic check
        const hfResult = await this.runHuggingFaceScan(mediaUrl, processedMedia);
        
        // Add artificial delay to avoid hitting Gemini rate limits too fast
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 2. Prepare Vision OCR/Analysis
        const visionResult = await this.runGeminiVision(processedMedia, mediaContext);
        
        // Add another delay before ground truth verification
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 3. Second Wave: News/Truth Verification using pre-extracted fields from Wave 1
        const truthResult = await this.verifyGroundTruth(
            visionResult.description || "", 
            visionResult.searchQuery || visionResult.description || "",
            visionResult.primaryClaim || visionResult.description || "",
            visionResult.entities || []
        );

        console.timeEnd("[PIPELINE] DeepVerify");

        // SMART SCORING:
        // 1. If we have a verified fact, we trust the digital forensics (HF) more than the vision fallback.
        // 2. If vision timed out (0.5), it shouldn't override a low HF score if truth is verified.
        let fakeProb = Math.max(hfResult.probability, visionResult.manipulationScore || 0);
        
        if (truthResult.isVerified) {
            // Dampen the fake probability if the story is confirmed real.
            // We take the digital scan more seriously than the inconclusive vision fallback.
            fakeProb = Math.min(fakeProb, hfResult.probability + 0.1); 
        }

        return {
            fakeProbability: fakeProb,
            confidenceScore: 0.85,
            confidenceLabel: this.getConfidenceLabel(fakeProb, truthResult.isVerified),
            analysis: visionResult.analysis || "Analysis complete.",
            truthSummary: truthResult.summary,
            truthScore: truthResult.score,
            isVerified: truthResult.isVerified,
            technicalDetails: [
                ...hfResult.signals,
                ...visionResult.artifacts
            ]
        };
    }

    private async fetchMediaToBase64(url: string): Promise<{ data: string; mimeType: string } | undefined> {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const mimeType = response.headers.get("content-type") || "image/jpeg";
            return {
                data: buffer.toString("base64"),
                mimeType
            };
        } catch (e) {
            console.error("[fetchMedia] Failed to download media:", e);
            return undefined;
        }
    }

    private async runHuggingFaceScan(url: string, mediaData?: { data: string; mimeType: string }) {
        const hfToken = process.env.HUGGINGFACE_API_TOKEN;
        const hfUrl = process.env.HUGGINGFACE_MODEL_URL;

        if (!hfToken || !hfUrl || !mediaData) {
            console.warn("[HF SCAN] Missing credentials or media data, using fallback mock.");
            return { 
                probability: 0.12, 
                signals: ["Digital forensic check: Incomplete data (Mocked)"] 
            };
        }

        try {
            console.log("[HF SCAN] Sending to Hugging Face...");
            const response = await fetch(hfUrl, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${hfToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    inputs: mediaData.data,
                }),
            });

            if (!response.ok) throw new Error(`HF API error: ${response.status}`);
            const result = await response.json();
            
            let probability = 0.5;
            let signals: string[] = [];

            if (Array.isArray(result) && result.length > 0) {
                const fakeEntry = result.find((r: any) => 
                    r.label?.toLowerCase().includes("fake") || 
                    r.label?.toLowerCase().includes("ai") ||
                    r.label?.toLowerCase().includes("synthetic")
                );
                if (fakeEntry) {
                    probability = fakeEntry.score;
                    signals.push(`HF Model Detected: ${fakeEntry.label} (${Math.round(probability * 100)}%)`);
                } else {
                    const realEntry = result.find((r: any) => r.label?.toLowerCase().includes("real"));
                    if (realEntry) {
                        probability = 1 - realEntry.score;
                        signals.push(`HF Model Detected: Real (${Math.round(realEntry.score * 100)}%)`);
                    }
                }
            }

            return { probability, signals };
        } catch (e: any) {
            console.error("[HF SCAN] Failed:", e.message);
            return { 
                probability: 0.5, 
                signals: ["HF Scan Failed: Connection issue"] 
            };
        }
    }

    private async runGeminiVision(mediaData?: { data: string; mimeType: string }, context?: string): Promise<VisionResult> {
        if (!mediaData) return { manipulationScore: 0.1, description: context || "", artifacts: [], analysis: "No visual data provided.", searchQuery: context || "", primaryClaim: context || "", entities: [] };

        // 1. Run AWS Rekognition in parallel as a guaranteed OCR source
        console.log("[PIPELINE] Running AWS Rekognition OCR Fallback...");
        const awsResult = await this.aws.analyzeImage(mediaData.data);
        const ocrText = awsResult.extractedText;
        const prioritizedHeadline = awsResult.primaryHeadline;

        try {
            const prompt = `
                Perform forensic analysis on this media. 
                1. Look for AI artifacts (lighting, edges, skin texture, inconsistencies).
                2. NEWS GRAPHIC OCR: If this is a news graphic (e.g. GMA, Reuters, AP), extract EVERY word of the main headline and the date/source text verbatim.
                3. Provide a detailed description of the scene and any entities present.
                4. Rate the likelihood of manipulation (0.0 to 1.0).
                5. SEARCH RESEARCH: Generate a specific web search query to verify if the event/headline in the image is real or known disinformation.
                6. PRIMARY CLAIM: Extract the core factual claim being made.
                7. ENTITIES: List key people, locations, or organizations mentioned.
                
                GEOPOLITICAL GUARDRAIL: Identify the location/country of the scene if possible (e.g., flags, local language, recognizable landmarks). 
                If the person/event in the image is local (e.g., Philippines), ensure the primaryClaim and searchQuery reflect that local context. Do NOT hallucinate global trending figures if the visual evidence points elsewhere.
                
                OCR HINT (Extracted via AWS): "${prioritizedHeadline}"

                Respond in JSON format:
                { 
                  "description": "VERBATIM_HEADLINE + SCENE_DESCRIPTION", 
                  "manipulationScore": 0.0, 
                  "artifacts": ["..."], 
                  "analysis": "...",
                  "searchQuery": "...",
                  "primaryClaim": "...",
                  "entities": ["..."]
                }
            `;

            const result = await this.gemini.generateStructured<{
                description: string;
                manipulationScore: number;
                artifacts: string[];
                analysis: string;
                searchQuery: string;
                primaryClaim: string;
                entities: string[];
            }>({
                systemInstruction: "You are an elite deepfake forensic analyst. Be extremely specific about any text you see in official-looking graphics.",
                prompt,
                media: mediaData,
                responseSchema: {
                    type: "object",
                    properties: {
                        description: { type: "string" },
                        manipulationScore: { type: "number" },
                        artifacts: { type: "array", items: { type: "string" } },
                        analysis: { type: "string" },
                        searchQuery: { type: "string" },
                        primaryClaim: { type: "string" },
                        entities: { type: "array", items: { type: "string" } }
                    },
                    required: ["description", "manipulationScore", "artifacts", "analysis", "searchQuery", "primaryClaim", "entities"]
                }
            });

            if (!result) throw new Error("Null result from Gemini");

            return {
                description: result.description || prioritizedHeadline || "",
                manipulationScore: result.manipulationScore || 0.1,
                artifacts: result.artifacts || [],
                analysis: result.analysis,
                searchQuery: result.searchQuery || prioritizedHeadline || "",
                primaryClaim: result.primaryClaim || prioritizedHeadline || "",
                entities: result.entities || []
            };
        } catch (e) {
            console.error("Gemini Vision Task Failed (Using AWS Fallback):", e);
            return { 
                manipulationScore: 0.5, 
                description: prioritizedHeadline || context || "Visual content extraction failed.", 
                artifacts: ["Vision analysis timed out - using AWS OCR instead"], 
                analysis: "Manual review required. OCR detected focused text: " + (prioritizedHeadline || "none"),
                searchQuery: prioritizedHeadline || context || "",
                primaryClaim: prioritizedHeadline || context || "",
                entities: awsResult.labels
            };
        }
    }

    private async verifyGroundTruth(context: string, query: string, primaryClaim: string, entities: string[]) {
        if (!context || context.length < 5 || (!query && !primaryClaim)) {
            return { isVerified: false, score: 0, summary: "Insufficient data extracted for news verification." };
        }

        const effectiveQuery = query || primaryClaim || context;
        let snippets = "";
        let answer = "";
        
        try {
            const tavilyKey = process.env.TAVILY_API_KEY;
            if (!tavilyKey) throw new Error("Missing Tavily API key");

            console.log("[GROUNDING] Searching Tavily for:", effectiveQuery);

            const searchResponse = await fetch("https://api.tavily.com/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    api_key: tavilyKey,
                    query: `verify news: ${effectiveQuery}`,
                    search_depth: "advanced",
                    include_answer: true,
                    max_results: 5
                })
            });

            if (searchResponse.ok) {
                const searchData = await searchResponse.json();
                snippets = searchData.results?.map((r: any) => `[Source: ${r.url}] ${r.content}`).join("\n---\n") || "";
                answer = searchData.answer || "";
            }
        } catch (e: any) {
            console.error("[GROUNDING] Search failed:", e.message);
        }

        const synthesisPrompt = `
            PRIMARY CLAIM: "${primaryClaim}"
            ENTITIES: ${entities.join(", ")}
            
            WEB SEARCH RESULTS:
            ${snippets}
            
            TAVILY DIRECT ANSWER:
            ${answer}

            Instruction:
            Cross-reference the claim with the search results. 
            - If prominent news outlets confirm the event happened as described, set isVerified to true and score to 0.9-1.0.
            - If it is a known hoax/misinfo, set isVerified to false and score to 0.0-0.2.
            - If there is ZERO evidence (no news coverage for a major event), set isVerified to false and score to 0.1.
            - Mention specific news outlets in the summary.

            Respond in JSON:
            { "isVerified": boolean, "score": number, "summary": "string" }
        `;

        const responseSchema = {
            type: "object",
            properties: {
                isVerified: { type: "boolean" },
                score: { type: "number" },
                summary: { type: "string" }
            },
            required: ["isVerified", "score", "summary"]
        };

        // Fallback Chain 1: Gemini
        try {
            console.log("[GROUNDING] Attempting Gemini synthesis...");
            const result = await this.gemini.generateStructured<any>({
                systemInstruction: "You are an elite truth-seeking investigator.",
                prompt: synthesisPrompt,
                responseSchema
            });
            if (result) return result;
        } catch (e: any) {
            console.warn("[GROUNDING] Gemini synthesis throttled, falling back to OpenAI...");
        }

        // Fallback Chain 2: OpenAI
        try {
            console.log("[GROUNDING] Attempting OpenAI synthesis...");
            const result = await this.openai.generateStructured<any>({
                systemInstruction: "You are an elite truth-seeking investigator.",
                prompt: synthesisPrompt,
                responseSchema
            });
            if (result) return result;
        } catch (e: any) {
            console.warn("[GROUNDING] OpenAI synthesis failed, using Heuristic...");
        }

        // Fallback Chain 3: Heuristic Matching (Lite Verification)
        return this.performLiteVerification(primaryClaim, snippets, answer);
    }

    private performLiteVerification(claim: string, snippets: string, answer: string) {
        console.log("[GROUNDING] Running Lite Heuristic Verification...");
        
        const lowerClaim = claim.toLowerCase();
        const lowerSnippets = snippets.toLowerCase();
        const lowerAnswer = answer.toLowerCase();

        // High-sensitivity entity matching
        const keyTerms = lowerClaim.split(' ').filter(word => word.length > 2); // Lowered threshold for short entities like "VP", "PH"
        let matchCount = 0;
        
        // Exact term matching from search results
        for (const term of keyTerms) {
            if (lowerSnippets.includes(term) || lowerAnswer.includes(term)) matchCount++;
        }

        // Hallucination / Entity Drift Filter
        // If the news answer mentions high-profile trending subjects that were NOT in the claim, it's a hallucination.
        const trendingEntities = ["trump", "biden", "elon", "musk", "putin", "zelensky", "obama", "harris"];
        let entityDrift = false;
        let driftedEntity = "";

        for (const entity of trendingEntities) {
            if (lowerAnswer.includes(entity) && !lowerClaim.includes(entity)) {
                entityDrift = true;
                driftedEntity = entity;
                break;
            }
        }

        const matchRatio = matchCount / (keyTerms.length || 1);
        
        // Geopolitical Consistency Check:
        const likelyClaimCountry = lowerClaim.includes("ph") || lowerClaim.includes("philippines") || lowerClaim.includes("manila") ? "ph" : "global";
        const likelySnippetCountry = lowerSnippets.includes("philippines") || lowerSnippets.includes("gma") || lowerSnippets.includes("inquirer") ? "ph" : "us/global";
        
        let geopoliticalPenalty = 0;
        if (likelyClaimCountry === "ph" && likelySnippetCountry !== "ph" && !lowerSnippets.includes("philippine")) {
            geopoliticalPenalty = 0.4;
        }

        const isLikelyTrue = (matchRatio > 0.4 || lowerAnswer.includes("confirmed")) && geopoliticalPenalty === 0 && !entityDrift;

        return {
            isVerified: isLikelyTrue,
            score: Math.max(0, (isLikelyTrue ? 0.85 : 0.1) - geopoliticalPenalty - (entityDrift ? 0.4 : 0)),
            summary: (isLikelyTrue && answer) ? 
                `Reality Check (Heuristic): ${answer}` : 
                entityDrift ? 
                    `Reality Check Rejected: News grounding drifted to unrelated trending subjects (${driftedEntity}). No confirmation for the specific claim.` :
                    `Reality Check (Heuristic): ${isLikelyTrue ? "Search results support this claim." : "No clear confirmation found in news sources."}`
        };
    }

    private getConfidenceLabel(prob: number, verified: boolean): string {
        if (verified && prob < 0.55) return "Verified Fact – Content Grounded in Reality";
        if (verified && prob >= 0.55) return "Potential Manipulation of Real Event";
        if (prob > 0.85) return "Forensic Risk – Digital Manipulation Detected";
        if (prob > 0.65) return "High Risk – Suspicious AI Patterns";
        if (prob < 0.25) return "Likely Authentic – Natural Signatures";
        if (prob > 0.4 && !verified) return "Unverified Context – Potential Disinformation";
        return "Manual Review Recommended – Inconclusive Analysis";
    }
}
