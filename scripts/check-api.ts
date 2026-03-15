import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function checkApi() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ GEMINI_API_KEY not found in .env.local");
    return;
  }

  console.log("🔍 Checking Gemini API status...");
  const genAI = new GoogleGenAI({ apiKey });
  
  try {
    // Try a tiny generation
    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ parts: [{ text: "hi" }] }]
    });
    console.log("✅ Generation SUCCESSFUL.");
  } catch (err) {
    if (err.status === 429) {
      console.log("⚠️ Status: KEY IS VALID, but QUOTA EXCEEDED (429).");
      console.log("Message:", err.message);
    } else if (err.status === 401 || err.status === 403) {
      console.log("❌ Status: EXPIRED or INVALID (401/403).");
      console.log("Message:", err.message);
    } else {
      console.log("❓ Status: UNKNOWN ERROR.");
      console.error(err);
    }
  }
}

checkApi();
