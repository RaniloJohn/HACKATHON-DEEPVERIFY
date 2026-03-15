"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { motion } from "framer-motion";
import { ShieldCheck, ShieldX, Activity, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";

interface Scan {
    id: string;
    created_at: string;
    media_type: string;
    confidence_label: string | null;
    fake_probability: number | null;
    trend_alert: boolean;
    trend_matched_topic: string | null;
}

export function CommunityFeed() {
    const [scans, setScans] = useState<Scan[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        async function fetchPublicScans() {
            // MOCK MODE fallback if no supabase env variables
            if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL === "your_supabase_project_url") {
                setScans([
                    {
                        id: "mock-scan-1",
                        created_at: new Date().toISOString(),
                        media_type: "video",
                        confidence_label: "Very Likely Manipulated",
                        fake_probability: 0.95,
                        trend_alert: true,
                        trend_matched_topic: "Global Oil Prices Surge Amid Middle East Tensions"
                    },
                    {
                        id: "mock-scan-2",
                        created_at: new Date(Date.now() - 10 * 60000).toISOString(),
                        media_type: "image",
                        confidence_label: "Likely Authentic",
                        fake_probability: 0.12,
                        trend_alert: false,
                        trend_matched_topic: null
                    },
                    {
                        id: "mock-scan-3",
                        created_at: new Date(Date.now() - 35 * 60000).toISOString(),
                        media_type: "video",
                        confidence_label: "Likely Manipulated",
                        fake_probability: 0.68,
                        trend_alert: true,
                        trend_matched_topic: "Major Transport Strike Affects Manila Commuters"
                    }
                ]);
                setLoading(false);
                return;
            }

            if (!supabase) return; // Prevent crash when env vars missing

            // Fetch the 5 most recent completed scans globally
            const { data } = await supabase
                .from("scans")
                .select("id, created_at, media_type, confidence_label, fake_probability, trend_alert, trend_matched_topic")
                .eq("status", "done")
                .order("created_at", { ascending: false })
                .limit(5);

            if (data) setScans(data);
            setLoading(false);
        }

        fetchPublicScans();

        // Set up realtime subscription to listen for new completed scans
        if (supabase) {
            const channel = supabase
                .channel("public-scans")
                .on(
                    "postgres_changes",
                    { event: "UPDATE", schema: "public", table: "scans", filter: "status=eq.done" },
                    () => {
                        // Re-fetch to ensure we get the latest sorted 5
                        fetchPublicScans();
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [supabase]);

    if (loading) {
        return (
            <div className="glass-card w-full max-w-4xl p-8 flex justify-center mt-12">
                <Loader2 size={24} className="animate-spin text-indigo-400" />
            </div>
        );
    }

    if (scans.length === 0) return null; // Only show feed if there are recent scans

    return (
        <div className="w-full max-w-4xl mx-auto mt-20 px-4">
            <div className="flex items-center gap-2 mb-6">
                <Activity size={20} className="text-indigo-400" />
                <h2 className="text-xl font-bold">Live Community Scans</h2>
                <span className="bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full text-xs ml-2 animate-pulse">
                    Real-time
                </span>
            </div>

            <div className="grid grid-cols-1 gap-3">
                {scans.map((scan, i) => {
                    const isFake = (scan.fake_probability ?? 0) >= 0.55;

                    return (
                        <motion.div
                            layout
                            key={scan.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between hover:bg-white/10 transition-colors"
                        >
                            <div className="flex items-center gap-4">
                                {isFake ? (
                                    <ShieldX size={20} className="text-red-400" />
                                ) : (
                                    <ShieldCheck size={20} className="text-green-400" />
                                )}
                                <div>
                                    <p className="text-sm font-semibold capitalize flex items-center gap-2">
                                        Analyzed {scan.media_type}
                                        {scan.trend_alert && (
                                            <span className="text-[10px] bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full hidden sm:inline-block">
                                                ⚠ Trending: {scan.trend_matched_topic}
                                            </span>
                                        )}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1">
                                        {new Date(scan.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {scan.confidence_label}
                                    </p>
                                </div>
                            </div>

                            <Link href={`/results/${scan.id}`}>
                                <button className="p-2 bg-indigo-600/10 text-indigo-300 rounded-lg hover:bg-indigo-600/20 transition-colors">
                                    <ArrowRight size={16} />
                                </button>
                            </Link>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}
