
require('dotenv').config({ path: '../.env.local' });
const { DeepVerifyService } = require('../src/services/DeepVerifyService');
const { ExtremeModelService } = require('../src/services/ExtremeModelService');

async function testRoqueHoardingCase() {
    console.log("=== [TEST] Starting Roque Hoarding Forensic Check ===");
    
    const extremeService = new ExtremeModelService(process.env.GEMINI_API_KEY);
    const verifyService = new DeepVerifyService(extremeService);

    // This is the context that caused "Inconclusive" before
    const mediaContext = "DTI Secretary Roque warning Filipinos to hoard GMA News graphic. Is it true that there's possible of hoarding of essential goods in the philippines";
    
    // Simulating the result of the scan with the hardened pipeline
    console.log("[TEST] Running verifyMedia...");
    
    // We don't have the image buffer here, so we test the verifyGroundTruth logic specifically
    // as that was the part that was 'skipped' or inconclusive.
    const result = await verifyService['verifyGroundTruth'](mediaContext);
    
    console.log("\n=== [RESULT] Ground Truth Synthesis ===");
    console.log("Is Verified:", result.isVerified);
    console.log("Score:", result.score);
    console.log("Summary:", result.summary);
    console.log("==========================================");
}

testRoqueHoardingCase().catch(console.error);
