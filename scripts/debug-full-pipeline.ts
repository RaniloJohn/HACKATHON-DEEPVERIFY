import { DeepVerifyService } from "../src/services/DeepVerifyService";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config({ path: ".env.local" });

async function main() {
  const mediaPath = path.join(process.cwd(), "public", "gas-station.png");
  const service = new DeepVerifyService();

  console.log("====================================================");
  console.log("   DEEPVERIFY MULTI-CLOUD INTEGRATION TEST");
  console.log("====================================================");
  console.log(`[TEST] Target: ${mediaPath}`);

  try {
    // Read local file
    if (!fs.existsSync(mediaPath)) throw new Error(`File not found: ${mediaPath}`);
    const buffer = fs.readFileSync(mediaPath);
    const mediaData = {
      data: buffer.toString("base64"),
      mimeType: "image/png"
    };

    console.log("[TEST] Pipeline Starting...");
    const result = await service.verifyMedia(
      "local:public/gas-station.png",
      "Gas station photo for OCR testing",
      mediaData
    );

    console.log("\n================ RESULTS ================");
    console.log(`VERDICT: ${result.confidenceLabel}`);
    console.log(`PROBABILITY: ${result.fakeProbability}`);
    console.log(`VERIFIED: ${result.isVerified}`);
    console.log(`TRUTH SUMMARY: ${result.truthSummary.substring(0, 100)}...`);
    console.log(`TECHNICAL DETAILS: \n - ${result.technicalDetails.join("\n - ")}`);
    console.log("==========================================\n");

    if (result.technicalDetails.some(d => d.includes("OCR detected text"))) {
        console.log("[TEST] SUCCESS: AWS Rekognition OCR fallback was active.");
    } else {
        console.log("[TEST] NOTE: Gemini might have handled the request or OCR was empty.");
    }

  } catch (err: any) {
    console.error("[TEST] FAILED CRITICAL:", err.message);
  }
}

main();
