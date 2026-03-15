import { ExtremeModelService } from "../src/services/ExtremeModelService";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config({ path: ".env.local" });

async function main() {
  const mediaPath = path.join(process.cwd(), "public", "gas-station.png");
  const service = new ExtremeModelService();

  console.log(`[DIAGNOSTIC] Testing Vision OCR with local file: ${mediaPath}`);

  try {
    // 1. Read local file
    if (!fs.existsSync(mediaPath)) throw new Error(`File not found: ${mediaPath}`);
    const buffer = fs.readFileSync(mediaPath);
    const base64Media = buffer.toString("base64");
    const mimeType = "image/png";

    console.log(`[DIAGNOSTIC] File read. Mime: ${mimeType}. Length: ${base64Media.length}`);

    // 2. Vision Only Pass
    const systemInstruction = "You are a professional image analyst. Describe this image in 1 sentence and extract any visible text or branding.";
    const prompt = "What is in this image? Extract all visible text.";

    console.log("[DIAGNOSTIC] Sending request to Gemini Vision...");
    const result = await service.generateFastText({
      systemInstruction,
      prompt,
      media: {
        data: base64Media,
        mimeType
      }
    });

    console.log("=== RAW GEMINI VISION OUTPUT ===");
    console.log(result || "NO OUTPUT RECEIVED");
    console.log("================================");

    if (result && result.length > 5) {
      console.log("[DIAGNOSTIC] SUCCESS: Gemini Vision is reading the image.");
    } else {
      console.log("[DIAGNOSTIC] WARNING: Gemini Vision output seems shallow or empty.");
    }

  } catch (err: any) {
    console.error("[DIAGNOSTIC] FAILED:", err.message);
  }
}

main();
