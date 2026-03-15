# DeepVerify

> **Trend-Aware Deepfake Detection Platform**
> 
> *A Hackathon MVP built to detect manipulated media and correlate it to global misinformation campaigns.*

## 🚀 The Problem & Solution
During major crises (wars, political unrest), malicious actors deploy AI-generated images and videos (deepfakes) to manipulate public opinion and spread panic. The average internet user lacks the technical tools to verify if the viral video they just saw is real.

**DeepVerify** solves this by providing an instant, accessible scanner. You upload an image or video, and our engine calculates a deepfake probability score. 

**Our Killer Feature:** If you provide context (e.g. "Protest at a gas station"), our **Trend-Aware Engine** uses Gemini and NewsAPI to cross-reference your upload against the current global news cycle, alerting you if the media is likely part of a targeted misinformation campaign exploiting a trending crisis.

---

## 🛠 Tech Stack
- **Frontend**: Next.js 16 (App Router), TailwindCSS, Framer Motion, TypeScript
- **Auth & Database**: Supabase (PostgreSQL, RLS policies)
- **Object Storage**: AWS S3 (with presigned URLs for secure browser uploads)
- **Serverless Compute**: AWS API Gateway + AWS Lambda Worker
- **AI / Computer Vision**:
  - **Hugging Face Inference API** (Deepfake likelihood classification)
  - **AWS Rekognition** (Semantic object / scene labeling)
  - **Gemini & NewsAPI** (Trend-Awareness semantic matching & Lite Heuristics)
- **Deployment**: Vercel (Frontend)

---

## 💻 Local Setup & Development

### 1. Clone & Install
```bash
git clone https://github.com/yourusername/deepfake-detector.git
cd deepfake-detector
npm install
```

### 2. Environment Variables
Copy the template and fill it out:
```bash
cp .env.example .env.local
```

*Note: For hackathon judging/testing, the app includes a **Mock Mode**! If you leave the `.env.local` Supabase or AWS variables empty (or as their default placeholder text), the app will simulate scans and API responses so you can click through the UI without deploying any backend infrastructure.*

### 3. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3001](http://localhost:3001) in your browser.

---

## 🌐 Going to Production (Backend Integration)
To hook up the real algorithms and database, please read the included `PRODUCTION_KEYS_GUIDE.md` which contains step-by-step instructions on setting up the Supabase SQL schema, AWS S3 buckets, the IAM roles, and uploading the `lambda/detect` worker.

## 📁 Repository Highlights
- `/src/app/api/scan`: Next.js REST API handling S3 presigned URLs.
- `/src/app/api/trends`: Generative AI endpoint correlating user input with live global news.
- `/lambda/detect/index.js`: The microservice worker running Hugging Face and Rekognition simultaneously.
- `/src/components/CommunityFeed.tsx`: A real-time WebSocket feed showing live platform activity.
- `/src/components/DemoPicker.tsx`: Fast-tracks UI presentations by auto-injecting known "fake" and "real" samples.

## 🔮 Future Roadmap
If we had 3 more months to build, our priority features would be:
1. **Browser Extension:** Right-click any image on social media to trigger a DeepVerify scan overlaid on the page.
2. **Community Fact-Checking Ledger:** A public dashboard mapping the highest-trending verified deepfakes to their geographical spread.
3. **Advanced Video Frame-Sampling:** Specialized GPU compute instances to do microscopic frame-by-frame deepfake detection for video rendering flaws.
