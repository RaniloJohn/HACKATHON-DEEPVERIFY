import { RekognitionClient, DetectTextCommand, DetectLabelsCommand } from "@aws-sdk/client-rekognition";

export class AwsRekognitionService {
  private client: RekognitionClient;

  constructor() {
    this.client = new RekognitionClient({
      region: process.env.AWS_REGION || "ap-southeast-2",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });
  }

  async analyzeImage(base64Data: string) {
    try {
      const buffer = Buffer.from(base64Data, "base64");

      const [textResult, labelsResult] = await Promise.all([
        this.client.send(new DetectTextCommand({ Image: { Bytes: buffer } })),
        this.client.send(new DetectLabelsCommand({ Image: { Bytes: buffer }, MaxLabels: 10 }))
      ]);

      // Filter for type LINE and sort by bounding box area (Headlines are largest)
      const detections = textResult.TextDetections || [];
      const lines = detections
        .filter(t => t.Type === "LINE" && t.Geometry?.BoundingBox)
        .sort((a, b) => {
          const areaA = (a.Geometry!.BoundingBox!.Width || 0) * (a.Geometry!.BoundingBox!.Height || 0);
          const areaB = (b.Geometry!.BoundingBox!.Width || 0) * (b.Geometry!.BoundingBox!.Height || 0);
          return areaB - areaA; // Descending
        });

      // Grab the top 5 largest text blocks as "Primary" and the rest as "Noise"
      const extractedText = lines.map(t => t.DetectedText).join(" ") || "";
      const primaryHeadline = lines.slice(0, 3).map(t => t.DetectedText).join(" ");
      const labels = (labelsResult.Labels?.map(l => l.Name) || []).filter((l): l is string => !!l);

      return {
        extractedText,
        primaryHeadline,
        labels,
        hasNewsBranding: labels.some(l => ["News", "Graphic", "Broadcasting", "Television"].includes(l)) || 
                         extractedText.includes("GMA") || 
                         extractedText.includes("CNN") || 
                         extractedText.includes("BBC") ||
                         extractedText.toUpperCase().includes("JUST IN")
      };
    } catch (error) {
      console.error("[AWS Rekognition] Failed:", error);
      return { extractedText: "", primaryHeadline: "", labels: [], hasNewsBranding: false };
    }
  }
}
