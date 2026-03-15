// test.local.js
// Utility script to run the Lambda handler locally without deploying to AWS.
// Run with: node test.local.js

// Ensure you have these environment variables set, or fill them in below for testing:
process.env.AWS_REGION = process.env.AWS_REGION || "ap-southeast-1";
process.env.S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || "deepfake-detector-media";
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://your-project.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "your_service_role_key";
process.env.HUGGINGFACE_API_TOKEN = process.env.HUGGINGFACE_API_TOKEN || "your_hf_token";
process.env.HUGGINGFACE_MODEL_URL = process.env.HUGGINGFACE_MODEL_URL || "https://router.huggingface.co/hf-inference/models/dima806/deepfake_vs_real_image_detection";

const { handler } = require("./index.js");

const mockEvent = {
    body: JSON.stringify({
        scanId: "00000000-0000-0000-0000-000000000000", // A valid dummy UUID if your DB allows, or comment out DB updates to test pure AI
        mediaUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/React-icon.svg/1200px-React-icon.svg.png",
        s3Key: null
    })
};

(async () => {
    try {
        console.log("Testing Lambda Handler Locally...");
        const result = await handler(mockEvent);
        console.log("Result:", result);
    } catch (err) {
        console.error("Test Failed:", err);
    }
})();
