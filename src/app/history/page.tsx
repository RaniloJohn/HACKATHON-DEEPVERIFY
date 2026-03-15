"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { motion } from "framer-motion";
import { History as HistoryIcon, ArrowRight, ShieldCheck, ShieldX, Loader2 } from "lucide-react";
import Link from "next/link";

interface Scan {
    id: string;
    created_at: string;
    media_type: string;
    status: string;
    confidence_label: string | null;
    fake_probability: number | null;
    trend_alert: boolean;
    trend_matched_topic: string | null;
}

export default function HistoryPage() {
    const [scans, setScans] = useState<Scan[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        async function fetchHistory() {
            if (!supabase) return; // local dev without env vars
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from("scans")
                .select("id, created_at, media_type, status, confidence_label, fake_probability, trend_alert, trend_matched_topic")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false });

            if (data) setScans(data);
            setLoading(false);
        }
        fetchHistory();
    }, [supabase]);

    return (
        <main className="min-h-screen px-4 py-16 flex flex-col items-center">
            <div className="w-full max-w-4xl">
                <div className="flex items-center gap-3 mb-8">
                    <HistoryIcon size={28} className="text-indigo-400" />
                    <h1 className="text-2xl font-bold">Your Scan History</h1>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 size={32} className="animate-spin text-indigo-400" />
                    </div>
                ) : scans.length === 0 ? (
                    <div className="glass-card p-12 text-center flex flex-col items-center gap-4">
                        <span className="text-gray-400 text-lg">No scans found.</span>
                        <Link href="/scan">
                            <button className="btn-primary">Start a New Scan</button>
                        </Link>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {scans.map((scan, i) => {
                            const isProcessing = scan.status === "pending" || scan.status === "processing";
                            const isFake = (scan.fake_probability ?? 0) >= 0.55;

                            return (
                                <motion.div
                                    key={scan.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    className="glass-card p-4 flex items-center justify-between hover:bg-white/[0.04] transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        {isProcessing ? (
                                            <Loader2 size={24} className="animate-spin text-gray-500" />
                                        ) : isFake ? (
                                            <ShieldX size={24} className="text-red-400" />
                                        ) : (
                                            <ShieldCheck size={24} className="text-green-400" />
                                        )}

                                        <div>
                                            <p className="font-semibold capitalize flex items-center gap-2">
                                                {scan.media_type} Scan
                                                {scan.trend_alert && (
                                                    <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]">
                                                        {scan.trend_matched_topic}
                                                    </span>
                                                )}
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                {new Date(scan.created_at).toLocaleDateString(undefined, {
                                                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                                })}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        <div className="text-right hidden sm:block">
                                            <p className="text-sm font-medium">
                                                {isProcessing ? "Processing..." : scan.confidence_label}
                                            </p>
                                            {scan.fake_probability !== null && (
                                                <p className="text-xs text-gray-500">
                                                    {Math.round(scan.fake_probability * 100)}% Fake Probability
                                                </p>
                                            )}
                                        </div>
                                        <Link href={`/results/${scan.id}`}>
                                            <button className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                                                <ArrowRight size={18} />
                                            </button>
                                        </Link>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>
        </main>
    );
}
