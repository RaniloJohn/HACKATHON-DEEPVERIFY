import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DeepVerifyService } from "../../../services/DeepVerifyService";

const s3 = new S3Client({
    region: process.env.APP_AWS_REGION || "ap-southeast-2",
    credentials: {
        accessKeyId: process.env.APP_AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.APP_AWS_SECRET_ACCESS_KEY!,
    },
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { mediaType, fileName, fileType, mediaUrl, mediaContext, scanType = "deepfake" } = body;

        const supabase = createAdminClient();

        // 1. Create scan record
        const { data: scan, error: insertError } = await supabase
            .from("scans")
            .insert({
                media_type: mediaType,
                file_type: fileType,
                media_url: mediaUrl || "",
                media_context: mediaContext,
                scan_type: scanType,
                status: "pending",
            })
            .select()
            .single();

        if (insertError) throw insertError;

        // 2. If it's a file upload, generate presigned URL
        if (!mediaUrl) {
            const fileExtension = fileName?.split(".").pop() || "bin";
            const s3Key = `uploads/${scan.id}.${fileExtension}`;

            const command = new PutObjectCommand({
                Bucket: process.env.APP_AWS_S3_BUCKET_NAME,
                Key: s3Key,
                ContentType: fileType,
            });

            const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

            return NextResponse.json({
                scanId: scan.id,
                uploadRequired: true,
                presignedUrl,
                s3Key,
            });
        }

        // 3. If it's a URL, proceed to trigger (handled via PUT notification from frontend usually)
        return NextResponse.json({
            scanId: scan.id,
            uploadRequired: false,
        });

    } catch (err: any) {
        console.error("Scan POST Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        const scanId = req.nextUrl.searchParams.get("id") || req.nextUrl.searchParams.get("scanId");
        if (!scanId) {
            return NextResponse.json({ error: "Missing scanId" }, { status: 400 });
        }

        const supabase = createAdminClient();
        const { data: scan, error } = await supabase
            .from("scans")
            .select("*")
            .eq("id", scanId)
            .single();

        if (error || !scan) {
            return NextResponse.json({ error: "Scan not found" }, { status: 404 });
        }

        return NextResponse.json(scan);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const { scanId, s3Key, scanType, mediaContext } = await req.json();
        const supabase = createAdminClient();

        // Mark as processing
        await supabase.from("scans").update({ status: "processing" }).eq("id", scanId);

        // Trigger processing...
        if (process.env.USE_LOCAL_SCAN === "true") {
            // Trigger local high-speed scan (Async)
            (async () => {
                try {
                    console.log(`[LOCAL SCAN] Starting for ${scanId}`);
                    const verifyService = new DeepVerifyService();
                    
                    // 1. Get media reference from DB
                    const { data: scan } = await supabase.from("scans").select("*").eq("id", scanId).single();
                    if (!scan) return;

                    let mediaData: { data: string; mimeType: string } | undefined;

                    // 2. Fetch from S3 if it's an upload
                    if (s3Key) {
                        const command = new GetObjectCommand({
                            Bucket: process.env.APP_AWS_S3_BUCKET_NAME,
                            Key: s3Key,
                        });
                        const response = await s3.send(command);
                        const arrayBuffer = await response.Body?.transformToByteArray();
                        if (arrayBuffer) {
                            mediaData = {
                                data: Buffer.from(arrayBuffer).toString("base64"),
                                mimeType: scan.file_type || (s3Key.endsWith(".mp4") ? "video/mp4" : "image/jpeg")
                            };
                        }
                    }

                    // 3. Run Triple-Parallel Extreme Pipeline
                    const result = await verifyService.verifyMedia(
                        scan.media_url || s3Key || "",
                        mediaContext || scan.media_context || "",
                        mediaData
                    );

                    // 4. Update scan results
                    await supabase.from("scans").update({
                        status: "done",
                        fake_probability: result.fakeProbability,
                        confidence_score: result.confidenceScore,
                        confidence_label: result.confidenceLabel,
                        analysis: result.analysis,
                        truth_summary: result.truthSummary,
                        truth_score: result.truthScore,
                        is_verified: result.isVerified,
                        manipulation_indicators: result.technicalDetails.map((d: string) => ({ signal: d, score: 0.8 })),
                        rekognition_labels: [] // Local scan doesn't use Rekognition by default
                    }).eq("id", scanId);

                    console.log(`[LOCAL SCAN] Success for ${scanId}`);
                } catch (e) {
                    console.error(`[LOCAL SCAN] Failed for ${scanId}:`, e);
                    await supabase.from("scans").update({ status: "error" }).eq("id", scanId);
                }
            })();
        } else {
            // Trigger AWS Lambda via API Gateway URL
            if (process.env.APP_AWS_API_GATEWAY_ENDPOINT) {
                fetch(process.env.APP_AWS_API_GATEWAY_ENDPOINT, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ scanId, s3Key, scanType, mediaContext }),
                }).catch(e => console.error("Lambda trigger fail:", e));
            }
        }

        return NextResponse.json({ success: true, scanId });
    } catch (err: any) {
        console.error("Scan PUT Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
