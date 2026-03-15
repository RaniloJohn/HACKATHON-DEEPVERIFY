import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type, Schema } from "@google/genai";

export const maxDuration = 60; 

// Initialize Gemini client (it will automatically pick up GEMINI_API_KEY from environment)
const ai = new GoogleGenAI({});

// Help functionality for fetching trending news topics
async function fetchTrendingTopics() {
    const apiKey = process.env.NEWS_API_KEY;

    // MOCK MODE
    if (!apiKey || apiKey === "your_news_api_key" || apiKey === "mock") {
        return [
            { title: "US Presidential Election 2024: Major Debate Scheduled", url: "#", source: "Mock News" },
            { title: "Viral Audio of Joe Biden Sparks Deepfake Concerns", url: "#", source: "Mock News" },
            { title: "Global Oil Prices Surge Amid Middle East Tensions", url: "#", source: "Mock News" },
            { title: "Major Transport Strike Affects Manila Commuters", url: "#", source: "Mock News" },
        ];
    }

    // Fetch Philippines top headlines
    const newsRes = await fetch(
        `https://newsapi.org/v2/top-headlines?country=ph&pageSize=100&apiKey=${apiKey}`
    );
    const newsData = await newsRes.json();
    const articles = newsData.articles ?? [];

    let topics = articles.map((a: { title: string; url: string; source: { name: string } }) => ({
        title: a.title,
        url: a.url,
        source: a.source?.name,
    }));

    // FALLBACK: If PH returns empty, fetch global world news
    if (topics.length === 0) {
        const worldRes = await fetch(
            `https://newsapi.org/v2/top-headlines?category=general&pageSize=100&apiKey=${apiKey}`
        );
        const worldData = await worldRes.json();
        const worldArticles = worldData.articles ?? [];
        topics = worldArticles.map((a: { title: string; url: string; source: { name: string } }) => ({
            title: a.title,
            url: a.url,
            source: a.source?.name,
        }));
    }

    // STILL EMPTY? Hardcoded fallbacks focused on PH/Global
    if (topics.length === 0) {
        topics = [
            { title: "Philippines Economic Outlook Improves Amid Global Shifts", url: "#", source: "Local Monitor" },
            { title: "Transport Modernization Program Updates in Metro Manila", url: "#", source: "PH News Hub" },
            { title: "Digital Security Measures Enhanced for PH Online Services", url: "#", source: "Tech Watch" },
            { title: "Global Energy Prices Stabilize After Recent Fluctuations", url: "#", source: "Economy Global" },
            { title: "New Innovations in AI Safety and Regulation Globally", url: "#", source: "Innovate Daily" },
        ];
    }
    return topics;
}

// GET /api/trends – Fetch top headlines and return for context use
export async function GET() {
    try {
        const topics = await fetchTrendingTopics();
        return NextResponse.json({ topics });
    } catch (err) {
        console.error("[GET /api/trends] Error:", err);
        return NextResponse.json({ error: "Failed to fetch trends." }, { status: 500 });
    }
}

// POST /api/trends – Given media context, check if it relates to a trending topic
export async function POST(req: NextRequest) {
    try {
        let { mediaContext, topics } = await req.json();

        if (!mediaContext) {
            return NextResponse.json({ trendAlert: false, matchedTopic: null });
        }

        // If topics not provided, fetch them fresh
        if (!topics || topics.length === 0) {
            console.log("[POST /api/trends] Topics not provided, fetching fresh...");
            topics = await fetchTrendingTopics();
        }

        const GEMINI_KEY = process.env.GEMINI_API_KEY;

        // MOCK MODE
        if (!GEMINI_KEY || GEMINI_KEY === "your_gemini_api_key" || GEMINI_KEY === "mock") {
            const lowContext = mediaContext.toLowerCase();
            const isMatch = lowContext.includes("oil") || lowContext.includes("strike") || lowContext.includes("biden") || lowContext.includes("president") || lowContext.includes("election");
            let matchedTopic = null;
            if (isMatch) {
                if (lowContext.includes("biden") || lowContext.includes("president") || lowContext.includes("election")) {
                    matchedTopic = "Viral Audio of Joe Biden Sparks Deepfake Concerns";
                } else {
                    matchedTopic = "Global Oil Prices Surge Amid Middle East Tensions";
                }
            }
            return NextResponse.json({
                trendAlert: isMatch,
                matchedTopic: matchedTopic,
                explanation: isMatch ? "Automatically matched due to trending keywords (Mock Mode)." : null
            });
        }

        const aiClient = new GoogleGenAI({ apiKey: GEMINI_KEY });
        const topicsText = topics.map((t: { title: string }, i: number) => `${i + 1}. ${t.title}`).join("\n");

        const responseSchema: Schema = {
            type: Type.OBJECT,
            properties: {
                match: { type: Type.BOOLEAN, description: "Whether the user media context relates to any of the trending global topics." },
                topic: { type: Type.STRING, nullable: true, description: "The exact title of the trending global topic that was matched, if any." },
                explanation: { type: Type.STRING, nullable: true, description: "A brief 1-sentence explanation of why it matched, if any." }
            },
            required: ["match"],
        };

        const modelName = "gemini-2.0-flash";
        let result = { match: false, topic: null, explanation: null };
        let geminiWorked = false;

        try {
            console.log(`[POST /api/trends] Attempting with model: ${modelName}`);
            const response = await aiClient.models.generateContent({
                model: modelName,
                contents: `User media context:\n"${mediaContext}"\n\nTrending global topics:\n${topicsText}`,
                config: {
                    systemInstruction: "You are a misinformation analyst. Determine if the provided user media description relates to any of the provided trending global topics.",
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                    temperature: 0.1,
                }
            });
            result = JSON.parse(response.text ?? "{}");
            geminiWorked = true;
        } catch (err: any) {
            console.warn(`[POST /api/trends] Model ${modelName} failed:`, err.message);
        }

        if (!geminiWorked) {
            console.warn("[POST /api/trends] Gemini failed completely, falling back to keyword match.");
            const lowContext = mediaContext.toLowerCase();
            const isMatch = lowContext.includes("oil") || lowContext.includes("strike") || lowContext.includes("biden") || lowContext.includes("president") || lowContext.includes("election");
            let matchedTopic = null;
            if (isMatch) {
                if (lowContext.includes("biden") || lowContext.includes("president") || lowContext.includes("election")) {
                    matchedTopic = "Viral Audio of Joe Biden Sparks Deepfake Concerns";
                } else {
                    matchedTopic = "Global Oil Prices Surge Amid Middle East Tensions";
                }
            }
            return NextResponse.json({
                trendAlert: isMatch,
                matchedTopic: matchedTopic,
                explanation: isMatch ? "Matched via keyword fallback (Gemini unavailable)." : null
            });
        }

        return NextResponse.json({
            trendAlert: result.match ?? false,
            matchedTopic: result.topic ?? null,
            explanation: result.explanation ?? null,
        });
    } catch (err: any) {
        console.error("[POST /api/trends] Global error:", err?.message || err);
        return NextResponse.json({ error: `Failed to analyze trend context: ${err?.message || "Unknown error"}` }, { status: 500 });
    }
}
