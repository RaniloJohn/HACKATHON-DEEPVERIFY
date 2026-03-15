/**
 * AWS Lambda – Deepfake Detection Worker
 *
 * Triggered by:
 *   1. AWS API Gateway (POST) – from Next.js after media upload
 *   2. AWS S3 Event (optional) – on object creation in the uploads/ prefix
 *
 * Flow:
 *   1. Receive scanId + (mediaUrl | s3Key)
 *   2. Build the public URL for the media
 *   3. Call Hugging Face deepfake detection model
 *   4. Call AWS Rekognition for face/label analysis
 *   5. Write results back to Supabase
 */

const { RekognitionClient, DetectFacesCommand, DetectLabelsCommand } = require("@aws-sdk/client-rekognition");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { createClient } = require("@supabase/supabase-js");

const s3 = new S3Client({ region: process.env.AWS_REGION ?? "ap-southeast-1" });

const rekognition = new RekognitionClient({ region: process.env.AWS_REGION ?? "ap-southeast-1" });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
    console.log("Lambda triggered:", JSON.stringify(event));

    let body;
    try {
        body = typeof event.body === "string" ? JSON.parse(event.body) : event;
    } catch {
        return { statusCode: 400, body: JSON.stringify({ error: "Invalid request body." }) };
    }

    const { scanId, mediaUrl, s3Key, scanType = "deepfake" } = body;

    if (!scanId || (!mediaUrl && !s3Key)) {
        return { statusCode: 400, body: JSON.stringify({ error: "Missing scanId or media reference." }) };
    }

    // Mark scan as processing
    await supabase.from("scans").update({ status: "processing" }).eq("id", scanId);

    try {
        // ──────────────────────────────────────────────────────────────
        // Step 1: Hugging Face Deepfake Detection
        // ──────────────────────────────────────────────────────────────
        let hfResult;
        if (s3Key) {
            // If it's an S3 upload, fetch the binary block and pass raw bytes
            const imageBuffer = await fetchS3ObjectBuffer(s3Key);
            hfResult = await callHuggingFaceBlob(imageBuffer, scanType);
        } else {
            // Otherwise it's a direct public URL
            hfResult = await callHuggingFace(mediaUrl, scanType);
        }
        const fakeProbability = hfResult.fake_probability ?? 0.5;
        const manipulationIndicators = hfResult.indicators ?? [];

        // ──────────────────────────────────────────────────────────────
        // Step 2: AWS Rekognition (face & label analysis)
        // ──────────────────────────────────────────────────────────────
        let rekognitionLabels = [];
        if (s3Key) {
            const rekResult = await runRekognition(s3Key);
            rekognitionLabels = rekResult;
        }

        // ──────────────────────────────────────────────────────────────
        // Step 3: Determine confidence label
        // ──────────────────────────────────────────────────────────────
        const confidenceLabel =
            fakeProbability >= 0.8
                ? "Very Likely Manipulated"
                : fakeProbability >= 0.55
                    ? "Likely Manipulated"
                    : fakeProbability >= 0.45
                        ? "Uncertain – Manual Review Recommended"
                        : "Likely Authentic";

        // ──────────────────────────────────────────────────────────────
        // Step 4: Write results to Supabase
        // ──────────────────────────────────────────────────────────────
        const { error } = await supabase
            .from("scans")
            .update({
                status: "done",
                fake_probability: fakeProbability,
                confidence_label: confidenceLabel,
                manipulation_indicators: manipulationIndicators,
                rekognition_labels: rekognitionLabels,
            })
            .eq("id", scanId);

        if (error) throw new Error(`Supabase update failed: ${error.message}`);

        return { statusCode: 200, body: JSON.stringify({ success: true, scanId }) };
    } catch (err) {
        console.error("Lambda error:", err);
        await supabase.from("scans").update({ status: "error" }).eq("id", scanId);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

async function callHuggingFace(mediaUrl, scanType = "deepfake") {
    const isSynthetic = scanType === "synthetic";
    const modelUrl = isSynthetic ? process.env.HUGGINGFACE_SYNTHETIC_MODEL_URL : process.env.HUGGINGFACE_MODEL_URL;

    const response = await fetch(modelUrl, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.HUGGINGFACE_API_TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: mediaUrl }),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Hugging Face API error: ${err}`);
    }

    const data = await response.json();
    // Normalize HF response to a standard shape
    // Deepfake model: "Deepfake", "Realism"
    // Synthetic model: "synthetic", "human" (Organika/sdxl-detector)
    const fakeKeywords = ["fake", "synthetic", "ai", "artificial"];
    const fakeEntry = Array.isArray(data)
        ? data.flat().find((d) => fakeKeywords.some(k => d.label?.toLowerCase().includes(k)))
        : null;

    return {
        fake_probability: fakeEntry?.score ?? 0.05,
        indicators: fakeEntry ? [{ signal: fakeEntry.label, score: fakeEntry.score }] : [],
    };
}

async function callHuggingFaceBlob(imageBuffer, scanType = "deepfake") {
    const isSynthetic = scanType === "synthetic";
    const modelUrl = isSynthetic ? process.env.HUGGINGFACE_SYNTHETIC_MODEL_URL : process.env.HUGGINGFACE_MODEL_URL;

    const response = await fetch(modelUrl, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.HUGGINGFACE_API_TOKEN}`,
            "Content-Type": "application/octet-stream",
        },
        body: imageBuffer,
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Hugging Face API error (Blob): ${err}`);
    }

    const data = await response.json();
    const fakeKeywords = ["fake", "synthetic", "ai", "artificial"];
    const fakeEntry = Array.isArray(data)
        ? data.flat().find((d) => fakeKeywords.some(k => d.label?.toLowerCase().includes(k)))
        : null;

    return {
        fake_probability: fakeEntry?.score ?? 0.05,
        indicators: fakeEntry ? [{ signal: fakeEntry.label, score: fakeEntry.score }] : [],
    };
}

async function runRekognition(s3Key) {
    const params = {
        Image: {
            S3Object: {
                Bucket: process.env.S3_BUCKET_NAME,
                Name: s3Key,
            },
        },
        MaxLabels: 15,
        MinConfidence: 70,
    };

    try {
        const command = new DetectLabelsCommand(params);
        const result = await rekognition.send(command);
        return result.Labels ?? [];
    } catch (err) {
        console.warn("Rekognition failed (non-fatal):", err.message);
        return [];
    }
}

async function fetchS3ObjectBuffer(s3Key) {
    const command = new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: s3Key,
    });
    const s3Item = await s3.send(command);
    return Buffer.from(await s3Item.Body.transformToByteArray());
}
