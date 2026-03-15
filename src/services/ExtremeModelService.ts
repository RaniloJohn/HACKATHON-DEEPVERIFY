import { GoogleGenAI } from "@google/genai";

/**
 * ExtremeModelService: Unified access to Gemini 2.0 Flash for ultra-low latency tasks.
 * Optimized for Gemini SDK v2 (@google/genai)
 */
export class ExtremeModelService {
  private client: any;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is required");
    
    // SDK v2 initialization
    this.client = new GoogleGenAI({ apiKey: key });
  }

  private async withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
    try {
      return await fn();
    } catch (err: any) {
      if (retries > 0 && err.status === 429) {
        console.warn(`[ExtremeModelService] Rate limited (429). Retrying in ${delay}ms... (Retries left: ${retries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.withRetry(fn, retries - 1, delay * 2);
      }
      throw err;
    }
  }

  /**
   * generateFastText: Simple prompt for OCR or quick analysis.
   * Target: < 1.5s
   */
  async generateFastText(options: {
    systemInstruction?: string;
    prompt: string;
    media?: { data: string; mimeType: string };
  }): Promise<string> {
    try {
      return await this.withRetry(async () => {
        const contents: any[] = [];
        if (options.media) {
          contents.push({
            inlineData: {
              data: options.media.data,
              mimeType: options.media.mimeType
            }
          });
        }
        contents.push({ text: options.prompt });

        const result = await this.client.models.generateContent({
          model: "gemini-2.0-flash",
          systemInstruction: options.systemInstruction,
          contents: [{ parts: contents }]
        });

        return result.candidates?.[0]?.content?.parts?.[0]?.text || "";
      });
    } catch (err) {
      console.error("[ExtremeModelService] generateFastText error:", err);
      return "";
    }
  }

  /**
   * generateStructured: JSON output mode for specific schemas.
   */
  async generateStructured<T>(options: {
    systemInstruction: string;
    prompt: string;
    responseSchema: any;
    media?: { data: string; mimeType: string };
  }): Promise<T | null> {
    try {
      return await this.withRetry(async () => {
        const parts: any[] = [];
        if (options.media) {
          parts.push({
            inlineData: {
              data: options.media.data,
              mimeType: options.media.mimeType
            }
          });
        }
        parts.push({ text: options.prompt });

        const result = await this.client.models.generateContent({
          model: "gemini-2.0-flash",
          contents: [{ parts }],
          systemInstruction: options.systemInstruction,
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: options.responseSchema
          }
        });

        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return null;
        
        return JSON.parse(text) as T;
      });
    } catch (err) {
      console.error("[ExtremeModelService] generateStructured error:", err);
      return null;
    }
  }
}
