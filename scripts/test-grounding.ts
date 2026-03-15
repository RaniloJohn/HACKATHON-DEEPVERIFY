import dotenv from 'dotenv';
import { DeepVerifyService } from '../src/services/DeepVerifyService';

dotenv.config({ path: '.env.local' });

async function runTest() {
    console.log("Starting DeepVerifyService Functional Test...");
    const service = new DeepVerifyService();

    // Test Case 1: Likely Authentic (Real News Context)
    console.log("\n--- TEST CASE 1: LIKELY AUTHENTIC ---");
    const authenticContext = "GMA Integrated News headline: DTI issues price freeze in areas under state of calamity due to typhoon.";
    
    // Mock media data (not used in verifyGroundTruth but required by analyzeMedia)
    const mockMedia = { data: "base64data", mimeType: "image/png" };
    
    try {
        const result1 = await (service as any).verifyGroundTruth(authenticContext);
        console.log("Ground Truth Result:", JSON.stringify(result1, null, 2));
    } catch (e) {
        console.error("Test Case 1 Failed:", e);
    }

    // Test Case 2: Likely Fake (Suspicious Context)
    console.log("\n--- TEST CASE 2: LIKELY FAKE ---");
    const fakeContext = "BREAKING: Taylor Swift announces partnership with ScamCoin on GMA News Live.";
    
    try {
        const result2 = await (service as any).verifyGroundTruth(fakeContext);
        console.log("Ground Truth Result:", JSON.stringify(result2, null, 2));
    } catch (e) {
        console.error("Test Case 2 Failed:", e);
    }

    console.log("\nTest Completed.");
}

runTest();
