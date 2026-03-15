import { NextRequest, NextResponse } from "next/server";
import { tavilySearch } from "@/utils/tavily";
import { firecrawlScrape } from "@/utils/firecrawl";
import { ExtremeModelService } from "@/services/ExtremeModelService";

export async function POST(req: NextRequest) {
    try {
        const { mediaContext, matchedTopic, fakeProbability, confidenceLabel } = await req.json();

        const GEMINI_KEY = process.env.GEMINI_API_KEY;
        const NEWS_KEY = process.env.NEWS_API_KEY;

        if (!GEMINI_KEY || GEMINI_KEY === "your_gemini_api_key") {
            return NextResponse.json({ 
                truthSummary: "DeepVerify is currently in offline mode. Analysis: High suspicion of synthetic recreation." 
            });
        }

        // 1. Fetch Ground Truth News
        let groundTruthContext = "No real-time news records found for this specific query.";
        let articles: any[] = [];
        let scrapedContent = "";
        
        let query = (matchedTopic && matchedTopic !== "Unknown") ? matchedTopic : null;
        
        if (!query) {
            const visualMatch = mediaContext?.match(/\[VISUAL DATA\]: (.*)/i);
            if (visualMatch) {
                query = visualMatch[1];
            }
        }
        
        if (!query || query.length < 5 || /check|true|is this|legit|accurate/i.test(query)) {
            query = mediaContext;
        }
        
        // Final cleanup: remove internal tags and vague phrases
        query = query?.replace(/\[VISUAL DATA\]:/gi, "")
                     ?.replace(/is this real|is this true|check this|legit|accurate|can you check|is it/gi, "")
                     ?.replace(/\s+/g, " ")
                     ?.split("\n")[0] // Take only first line
                     ?.trim();

        // GEOGRAPHIC ANCHORING: If the query is related to local officials 
        if (query && /DTI|Secretary|Senator|President|Department|Bureau|Philippines/i.test(query) && !/Philippines/i.test(query)) {
            query = `${query} Philippines`;
        }

        if (!query || query.length < 5 || /scan|check|verify/i.test(query)) {
            query = mediaContext?.substring(0, 100).split('.')[0].trim();
        }

        console.log(`[DEEPVERIFY] Target Search Query: "${query}"`);

        // LAYER 1 & 2: NewsAPI + Tavily (Parallel Search)
        const [newsResults, tavilyResults] = await Promise.allSettled([
            (async () => {
                if (NEWS_KEY && query && query.length > 3) {
                    const primaryUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&pageSize=5&sortBy=publishedAt&apiKey=${NEWS_KEY}`;
                    let searchRes = await fetch(primaryUrl);
                    let newsData = searchRes.ok ? await searchRes.json() : { articles: [] };
                    return newsData.articles || [];
                }
                return [];
            })(),
            (async () => {
                if (query && query.length > 3) {
                    return await tavilySearch(query);
                }
                return [];
            })()
        ]);

        articles = newsResults.status === 'fulfilled' ? newsResults.value : [];
        let deepResults = tavilyResults.status === 'fulfilled' ? tavilyResults.value : [];
        
        console.log(`[DEEPVERIFY/PERFORM] Parallel search complete. News: ${articles.length}, Tavily: ${deepResults.length}`);

        // LAYER 3: Firecrawl (Parallel Content Scraping for high-trust results)
        // OPTIMIZATION: If Tavily already provided high-confidence content from trusted sources, skip Firecrawl.
        const highConfidenceMatch = deepResults.some(r => 
            r.score > 0.7 && 
            r.content.length > 400 && 
            (r.url.includes("gmanetwork.com") || r.url.includes("abs-cbn.com") || r.url.includes("rappler.com") || r.url.includes("pna.gov.ph") || r.url.includes("philstar.com"))
        );

        const candidateUrls = highConfidenceMatch ? [] : [...deepResults, ...articles]
            .filter(a => a.url && (a.url.includes("gmanetwork.com") || a.url.includes("abs-cbn.com") || a.url.includes("rappler.com") || a.url.includes("pna.gov.ph")))
            .slice(0, 1) // Only scrape top 1 to save time
            .map(a => a.url);

        if (candidateUrls.length > 0) {
            console.log(`[DEEPVERIFY/PERFORM] High-confidence snippet missing. Scraping ${candidateUrls[0]}...`);
            const scrapingResults = await Promise.allSettled(candidateUrls.map(url => firecrawlScrape(url)));
            
            scrapedContent = scrapingResults
                .map((res, i) => res.status === 'fulfilled' && res.value 
                    ? `[SCRAPED FULL ARTICLE CONTENT FROM ${candidateUrls[i]}]:\n${res.value.substring(0, 1500)}` 
                    : null)
                .filter(Boolean)
                .join("\n\n---\n\n");
        } else if (highConfidenceMatch) {
            console.log(`[DEEPVERIFY/PERFORM] Scraping skipped: High-confidence snippets found.`);
        }

        // CONTEXT CONSOLIDATION
        const combinedContext = [
            ...articles.map(a => `- ${a.title}: ${a.description} (${a.url})`),
            ...deepResults.map(a => `- [DEEP]: ${a.title}: ${a.content.substring(0, 400)} (${a.url})`)
        ].join("\n");

        if (combinedContext) {
            groundTruthContext = `${combinedContext}\n\n${scrapedContent}`;
        }
        

        const extremeService = new ExtremeModelService(GEMINI_KEY);
        let truthSummary: any = null;
        
        const systemInstruction = "You are DeepVerify 2.0. You use scraped article content and multi-source context to debunk or verify claims with extreme precision. Prevent hallucinations by ignoring news on topics unrelated to the claim entities.";
        
        const prompt = `
        TODAY'S DATE: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        
        GROUND TRUTH NEWS & ARTICLE SCRAPES (CRITICAL SOURCE):
        ${groundTruthContext}

        INPUT MEDIA DATA:
        - CONTEXT/OCR: "${mediaContext}"
        - DETECTION SCORE: ${fakeProbability * 100}% (${confidenceLabel})

        TRUTH CHECK MISSION:
        1. IDENTIFY THE CLAIM: Summarize what the media is claiming.
        2. RELEVANCE GUARD: If entities (names, departments) in news don't match input, discard that news.
        3. DATA WEIGHING: If [SCRAPED FULL ARTICLE] exists, prioritize its details over snippets.
        4. VERIFY: Compare dates and specific actions. 
        5. TRUTH SCORING: 
            - 1.0: Fully verified by current news matching person, date, and event.
            - 0.5: No direct news found, but people/orgs exist and claim is plausible.
            - 0.0: Explicitly debunked (e.g., source article says "No price hike announced").
        6. FINAL VERDICT: Must be one of [Real, Synthetic Recreation, Unverified Context, Deepfake, Misleading].
        `;

        const schema = {
          type: "object",
          properties: {
            truthSummary: { type: "string" },
            truthScore: { type: "number" },
            source: { type: "string" },
            isVerified: { type: "boolean" }
          },
          required: ["truthSummary", "truthScore", "source", "isVerified"]
        };

        try {
            console.log(`[DEEPVERIFY/AI] Attempting final verdict with ExtremeModelService`);
            truthSummary = await extremeService.generateStructured({
              systemInstruction,
              prompt,
              responseSchema: schema
            });
        } catch (err: any) {
            console.warn(`[DEEPVERIFY/AI] ExtremeModelService failed:`, err.message);
        }

        if (!truthSummary) {
            return NextResponse.json({ 
                truthSummary: "Analysis incomplete due to AI timeout.",
                truthScore: 0.5,
                isVerified: false
            });
        }

        return NextResponse.json(truthSummary);
    } catch (err: any) {
        console.error("[DEEPVERIFY/AI] Final failure:", err);
        return NextResponse.json({ 
            truthSummary: "DeepVerify is currently recalibrating sensors. Analysis: suspicious but context is evolving." 
        });
    }
}
