"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, ShieldX, AlertTriangle, TrendingUp, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { use } from "react";

interface ScanResult {
    id: string;
    status: "pending" | "processing" | "done" | "error";
    media_type: string;
    fake_probability: number | null;
    confidence_label: string | null;
    manipulation_indicators: { signal: string; score: number }[] | null;
    rekognition_labels: { Name: string; Confidence: number }[] | null;
    trend_alert: boolean;
    trend_matched_topic: string | null;
    trend_explanation: string | null;
    media_context: string | null;
    truth_summary: string | null;
    truth_score?: number;
    is_verified?: boolean;
}

function ProbabilityBar({ value, isSynthetic }: { value: number; isSynthetic?: boolean }) {
    const pct = Math.round(value * 100);
    const defaultColor = pct >= 80 ? "#ef4444" : pct >= 55 ? "#f59e0b" : "#22c55e";
    const syntheticColor = pct >= 55 ? "#10b981" : "#22c55e"; // Emerald for AI slop
    const color = isSynthetic ? syntheticColor : defaultColor;
    
    return (
        <div>
            <div className="flex justify-between mb-1 text-sm">
                <span className="text-gray-400">{isSynthetic ? "AI Generation Score" : "Fake Probability"}</span>
                <span style={{ color }} className="font-bold">{pct}%</span>
            </div>
            <div className="prob-bar-track">
                <motion.div
                    className="prob-bar-fill"
                    style={{ backgroundColor: color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                />
            </div>
        </div>
    );
}

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [scan, setScan] = useState<ScanResult | null>(null);
    const [trendChecked, setTrendChecked] = useState(false);

    // Poll for scan completion
    useEffect(() => {
        let isMounted = true;
        let timeoutId: NodeJS.Timeout;

        const poll = async () => {
            if (!isMounted) return;
            try {
                const res = await fetch(`/api/scan?id=${id}`);
                if (!res.ok) return;
                const data: ScanResult = await res.json();
                
                if (isMounted) {
                    setScan(data);
                    if (data.status === "pending" || data.status === "processing") {
                        timeoutId = setTimeout(poll, 4000); // 4 second interval
                    }
                }
            } catch (err) {
                console.error("Polling error:", err);
                if (isMounted) timeoutId = setTimeout(poll, 5000);
            }
        };

        poll();

        return () => {
            isMounted = false;
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [id]);

    // Run trend check ONLY if not already done by backend
    useEffect(() => {
        if (!scan || scan.status !== "done" || trendChecked || scan.trend_explanation) return;
        setTrendChecked(true);
        // ... fallback manual check if needed
    }, [scan, trendChecked]);

    const isLoading = !scan || scan.status === "pending" || scan.status === "processing";

    return (
        <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
            <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card w-full max-w-2xl p-8"
            >
                {isLoading ? (
                    <div className="flex flex-col gap-6 animate-pulse p-4">
                        <div className="flex gap-4">
                            <div className="w-12 h-12 bg-white/10 rounded-full flex-shrink-0" />
                            <div className="flex flex-col gap-2 w-full">
                                <div className="h-6 bg-white/10 rounded w-1/2" />
                                <div className="h-4 bg-white/5 rounded w-1/4" />
                            </div>
                        </div>

                        <div className="h-4 bg-white/10 rounded mt-4 w-1/3" />
                        <div className="h-8 bg-white/10 rounded w-full" />

                        <div className="h-24 bg-white/5 rounded-xl border border-white/5 mt-4" />

                        <div className="flex justify-center pt-6 text-gray-500 gap-2">
                            <Loader2 size={18} className="animate-spin" />
                            <span className="text-sm">Analyzing deepfake models...</span>
                        </div>
                    </div>
                ) : scan?.status === "error" ? (
                    <div className="flex flex-col items-center gap-4 py-12 text-red-400">
                        <AlertTriangle size={40} />
                        <p className="text-lg font-medium">Analysis Failed</p>
                        <p className="text-sm text-gray-500">An error occurred during processing. Please try again.</p>
                        <Link href="/scan"><button className="btn-primary mt-4">Try Again</button></Link>
                    </div>
                ) : (
                    <div className="flex flex-col gap-6">
                        <div className="flex items-start gap-4">
                            {scan!.confidence_label === "Verified News Graphic" || scan!.fake_probability! < 0.55 ? (
                                <ShieldCheck size={40} className={scan!.confidence_label === "Verified News Graphic" ? "text-blue-400 mt-1 flex-shrink-0" : "text-green-400 mt-1 flex-shrink-0"} />
                            ) : (
                                <ShieldX size={40} className={scan!.media_context?.includes("[synthetic]") ? "text-emerald-400 mt-1 flex-shrink-0" : "text-red-400 mt-1 flex-shrink-0"} />
                            )}
                            <div>
                                <h1 className="text-2xl font-bold">
                                    {scan!.fake_probability === 0.5 ? "Inconclusive Analysis" : 
                                     scan!.confidence_label === "Verified News Graphic" ? "Verified News Graphic" :
                                     scan!.media_context?.includes("[synthetic]") 
                                        ? scan!.confidence_label?.replace("Manipulated", "AI-Generated") 
                                        : scan!.confidence_label}
                                </h1>
                                <p className="text-gray-400 text-sm mt-1">
                                    Analysis Mode: <span className="capitalize text-white">
                                        {scan!.confidence_label === "Verified News Graphic" ? "Authentic Context (Graphic)" :
                                         scan!.fake_probability === 0.5 ? "Context Analysis Only" :
                                         scan!.media_context?.includes("[synthetic]") ? "AI News Slop Detector" : "Deepfake Core"}
                                    </span>
                                </p>
                            </div>
                        </div>

                        {/* Probability bar */}
                        <ProbabilityBar value={scan!.fake_probability ?? 0} isSynthetic={scan!.media_context?.includes("[synthetic]")} />

                        {/* Reality Check */}
                        {(scan!.truth_summary || scan!.trend_explanation) && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className={`border ${scan!.is_verified ? "border-green-500/30 bg-green-500/10" : "border-blue-500/30 bg-blue-500/10"} rounded-xl p-6 flex gap-4 shadow-[0_0_20px_rgba(59,130,246,0.15)] relative overflow-hidden`}
                            >
                                <div className="absolute top-0 right-0 p-2">
                                    <Sparkles size={14} className={scan!.is_verified ? "text-green-400/30" : "text-blue-400/30"} />
                                </div>
                                {scan!.is_verified ? (
                                    <ShieldCheck size={28} className="text-green-400 mt-1 flex-shrink-0" />
                                ) : (
                                    <Sparkles size={28} className="text-blue-400 mt-1 flex-shrink-0" />
                                )}
                                <div className="flex-1">
                                    <div className="flex justify-between items-start mb-3">
                                        <p className={`${scan!.is_verified ? "text-green-300" : "text-blue-300"} font-black text-xs flex items-center gap-2 tracking-tighter uppercase`}>
                                            Reality Check Analysis
                                            <span className={`${scan!.is_verified ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-blue-500/20 text-blue-400 border-blue-500/30"} text-[9px] px-2 py-0.5 rounded-full border font-bold uppercase`}>
                                                {scan!.is_verified ? "Verified Fact" : "Context Search"}
                                            </span>
                                        </p>
                                        {scan!.truth_score !== undefined && (
                                            <div className="text-right">
                                                <p className="text-[10px] text-gray-400 uppercase font-bold">Trust Score</p>
                                                <p className={`text-lg font-black ${scan!.truth_score > 0.7 ? "text-green-400" : scan!.truth_score > 0.4 ? "text-yellow-400" : "text-red-400"}`}>
                                                    {Math.round(scan!.truth_score * 100)}%
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-gray-100 text-base leading-relaxed font-medium">
                                        {scan!.truth_summary || scan!.trend_explanation}
                                    </p>
                                    {scan!.is_verified && (
                                        <div className="mt-4 pt-4 border-t border-green-500/20 flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                            <p className="text-green-400/80 text-[10px] uppercase font-bold tracking-widest">
                                                Confirmed by trusted news sources (GMA, Reuters, AP)
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {/* Trend Alert */}
                        {scan!.trend_alert && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="border border-yellow-500/30 bg-yellow-500/10 rounded-xl p-4 flex gap-3"
                            >
                                <TrendingUp size={20} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-yellow-300 font-semibold text-sm">⚠ Trending Topic Alert</p>
                                    <p className="text-yellow-200/70 text-sm mt-1">
                                        This media appears to relate to a currently trending global event:{" "}
                                        <strong className="text-yellow-300">{scan!.trend_matched_topic}</strong>
                                    </p>
                                    {scan!.trend_explanation && (
                                        <p className="text-gray-400 text-xs mt-2">{scan!.trend_explanation}</p>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {/* Manipulation Indicators */}
                        {scan!.manipulation_indicators && scan!.manipulation_indicators.length > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold text-gray-300 mb-3">Detected Signals</h3>
                                <div className="flex flex-col gap-2">
                                    {scan!.manipulation_indicators.map((ind, i) => (
                                        <div key={i} className="flex items-center justify-between text-sm bg-white/5 rounded-lg px-4 py-2">
                                            <span className="text-gray-300">{ind.signal}</span>
                                            <span className="text-red-400 font-medium">{Math.round(ind.score * 100)}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Rekognition Labels */}
                        {scan!.rekognition_labels && scan!.rekognition_labels.length > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold text-gray-300 mb-3">AWS Rekognition Labels</h3>
                                <div className="flex flex-wrap gap-2">
                                    {scan!.rekognition_labels.slice(0, 8).map((lbl, i) => (
                                        <span key={i} className="bg-white/5 border border-white/10 px-3 py-1 rounded-full text-xs text-gray-300">
                                            {lbl.Name} · {Math.round(lbl.Confidence)}%
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <Link href="/scan" className="flex-1">
                                <button className="w-full btn-primary">Scan Another</button>
                            </Link>
                        </div>
                    </div>
                )}
            </motion.div>
        </main>
    );
}
