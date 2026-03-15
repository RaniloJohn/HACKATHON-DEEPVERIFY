"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ShieldCheck, TrendingUp, Zap } from "lucide-react";
import { CommunityFeed } from "@/components/CommunityFeed";

const features = [
  {
    icon: ShieldCheck,
    title: "AI-Powered Detection",
    desc: "Hugging Face deepfake models + AWS Rekognition analyze every pixel.",
  },
  {
    icon: TrendingUp,
    title: "Trend-Aware Engine",
    desc: "Cross-references your media against today's top global news topics.",
  },
  {
    icon: Zap,
    title: "Instant Confidence Score",
    desc: "Get a clear probability score and human-readable explanation in seconds.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* ── Hero ── */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24 gap-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl flex flex-col items-center"
        >
          <img 
            src="/logos/COLOREDLOGO.png" 
            alt="DeepVerify Brand Logo" 
            className="h-20 w-auto mb-8 object-contain"
          />
          <span className="badge-trend mb-6 inline-flex">
            <TrendingUp size={13} /> Trend-Aware Misinformation Defense
          </span>
          <h1 className="text-5xl md:text-6xl font-extrabold leading-tight mb-6">
            Is that video{" "}
            <span className="text-indigo-400">real</span> or{" "}
            <span className="text-red-400">fake</span>?
          </h1>
          <p className="text-gray-400 text-lg mb-10 max-w-xl mx-auto">
            Upload or paste a link to any image or video. DeepVerify analyzes it for deepfake
            manipulation and flags if it relates to a high-risk global news event.
          </p>
          <Link href="/scan">
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="btn-primary text-base px-8 py-4 glow-indigo"
            >
              Analyze Media Now →
            </motion.button>
          </Link>
        </motion.div>

        {/* ── Feature Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-12 max-w-4xl w-full">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="glass-card p-6 text-left"
            >
              <f.icon size={24} className="text-indigo-400 mb-3" />
              <h3 className="font-semibold text-white mb-1">{f.title}</h3>
              <p className="text-gray-400 text-sm">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Live Global Feed ── */}
      <section className="w-full pb-24">
        <CommunityFeed />
      </section>
    </main>
  );
}
