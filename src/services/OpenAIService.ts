import OpenAI from "openai";

export class OpenAIService {
    private client: OpenAI | null = null;

    constructor() {
        const apiKey = process.env.OPENAI_API_KEY;
        if (apiKey) {
            this.client = new OpenAI({ apiKey });
        }
    }

    async generateStructured<T>(config: {
        systemInstruction: string;
        prompt: string;
        responseSchema: any;
    }): Promise<T | null> {
        if (!this.client) return null;

        try {
            const response = await this.client.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: config.systemInstruction },
                    { role: "user", content: config.prompt }
                ],
                response_format: { type: "json_object" }
            });

            const content = response.choices[0].message.content;
            if (!content) return null;

            return JSON.parse(content) as T;
        } catch (error) {
            console.error("[OpenAI] Generation failed:", error);
            return null;
        }
    }
}
