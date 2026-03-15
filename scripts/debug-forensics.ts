import { DeepVerifyService } from "../src/services/DeepVerifyService";
import * as dotenv from "dotenv";
import * as path from "path";

// Load env
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

async function main() {
    const service = new DeepVerifyService();
    const url = process.argv[2];
    const context = process.argv[3];

    if (!url) {
        console.error("Usage: npx ts-node debug-forensics.ts <url> <context>");
        process.exit(1);
    }

    console.log(`[DEBUG] Testing forensics for: ${url}`);
    console.log(`[DEBUG] Context: ${context || "None"}`);

    try {
        const result = await service.verifyMedia(url, context);
        console.log("\n=== FINAL VERDICT ===");
        console.log(`Fake Probability: ${Math.round(result.fakeProbability * 100)}%`);
        console.log(`Confidence: ${result.confidenceLabel}`);
        console.log(`Verified Status: ${result.isVerified ? "✅ VERIFIED NEWS" : "❌ UNVERIFIED / HOAX"}`);
        console.log(`Truth Score: ${result.truthScore}`);
        console.log(`\nAnalysis Summary:\n${result.analysis}`);
        console.log(`\nTruth Summary:\n${result.truthSummary}`);
        console.log(`\nTechnical Details:`);
        result.technicalDetails.forEach(d => console.log(`- ${d}`));
    } catch (e) {
        console.error("Verification failed:", e);
    }
}

main();
