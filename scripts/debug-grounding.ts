
import { DeepVerifyService } from "../src/services/DeepVerifyService";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function debug() {
    const service = new DeepVerifyService();
    const testContext = "GMA News reports that a major deepfake scam is targeting Philippine banks in March 2026.";
    
    console.log("🚀 STARTING REALITY CHECK DEBUG...");
    console.log("Context:", testContext);
    
    try {
        // We bypass the full verifyMedia to focus on the grounding part
        const result = await (service as any).verifyGroundTruth(testContext);
        console.log("\n--- FINAL RESULT ---");
        console.log(JSON.stringify(result, null, 2));
    } catch (err) {
        console.error("\n❌ CRITICAL FAILURE IN DEBUG SCRIPT:");
        console.error(err);
    }
}

debug();
