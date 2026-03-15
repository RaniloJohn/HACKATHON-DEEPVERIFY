import { NextRequest, NextResponse } from "next/server";
import { ExtremeModelService } from "@/services/ExtremeModelService";
import { GoogleGenAI, Type, Schema } from "@google/genai";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        
        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
        const arrayBuffer = await file.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString("base64");

        const extremeService = new ExtremeModelService(GEMINI_KEY);
        
        const systemInstruction = "You are an elite deepfake forensic analyst.";
        const prompt = "Analyze this image/video for technical deepfake artifacts (GAN patterns, blur inconsistencies, frequency domain anomalies, AI-typical textures). Provide a technical verdict.";

        const responseSchema = {
            type: "object",
            properties: {
                fakeProbability: { type: "number" },
                confidenceScore: { type: "number" },
                analysis: { type: "string" },
                technicalDetails: { 
                    type: "array", 
                    items: { type: "string" }
                },
                matchedTopic: { type: "string", nullable: true }
            },
            required: ["fakeProbability", "confidenceScore", "analysis", "technicalDetails"]
        };

        const analysis = await extremeService.generateStructured<any>({
            systemInstruction,
            prompt,
            responseSchema,
            media: { data: base64Data, mimeType: file.type }
        });

        if (!analysis) throw new Error("AI Analysis failed");

        return NextResponse.json({
            ...analysis,
            confidenceLabel: analysis.confidenceScore > 0.8 ? "High" : analysis.confidenceScore > 0.5 ? "Moderate" : "Low"
        });

    } catch (err: any) {
        console.error("Local Scan Error:", err);
        return NextResponse.json({ 
            fakeProbability: 0.5, 
            confidenceScore: 0.3,
            confidenceLabel: "Error",
            analysis: "Technical analysis interrupted." 
        }, { status: 500 });
    }
}
