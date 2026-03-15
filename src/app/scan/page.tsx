"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { UploadCloud, Link2, Loader2, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { DemoPicker } from "@/components/DemoPicker";

type MediaMode = "upload" | "url";

export default function ScanPage() {
    const router = useRouter();
    const fileRef = useRef<HTMLInputElement>(null);
    const [mode, setMode] = useState<MediaMode>("upload");
    const [mediaContext, setMediaContext] = useState("");
    const [mediaUrl, setMediaUrl] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [scanType, setScanType] = useState<"deepfake" | "synthetic">("deepfake");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            let body: object;

            if (mode === "url") {
                if (!mediaUrl) { setError("Please enter a media URL."); setLoading(false); return; }
                const isVideo = /\.(mp4|webm|mov)$/i.test(mediaUrl) || mediaUrl.includes("tiktok.com") || mediaUrl.includes("instagram.com/reels");
                body = {
                    mediaType: isVideo ? "video" : "image",
                    mediaUrl,
                    mediaContext,
                    scanType,
                };
            } else {
                if (!file) { setError("Please select a file."); setLoading(false); return; }
                body = {
                    mediaType: file.type.startsWith("video") ? "video" : "image",
                    fileName: file.name,
                    fileType: file.type,
                    mediaContext,
                    scanType,
                };
            }

            // 1. Create scan record and get presigned URL (if uploading)
            const res = await fetch("/api/scan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Failed to create scan.");

            // 2. Trigger analysis engine
            if (mode === "upload" && data.uploadRequired && file) {
                const uploadRes = await fetch(data.presignedUrl, {
                    method: "PUT",
                    body: file,
                    headers: { "Content-Type": file.type },
                });
                if (!uploadRes.ok) throw new Error("Failed to upload media to storage.");

                await fetch("/api/scan", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ scanId: data.scanId, s3Key: data.s3Key, scanType, mediaContext }),
                });
            } else if (mode === "url") {
                await fetch("/api/scan", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ scanId: data.scanId, scanType, mediaContext, mediaUrl }),
                });
            }

            // 3. Redirect to results page to poll for completion
            router.push(`/results/${data.scanId}`);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Something went wrong.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
            <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card w-full max-w-xl p-8"
            >
                <div className="flex items-center gap-3 mb-7">
                    <ShieldAlert size={28} className="text-indigo-400" />
                    <div>
                        <h1 className="text-2xl font-bold">Analyze Media</h1>
                        <p className="text-gray-400 text-sm">Upload a file or paste a social media link</p>
                    </div>
                </div>

                {/* Scan Type selector */}
                <div className="flex gap-4 mb-8">
                    <button
                        type="button"
                        onClick={() => setScanType("deepfake")}
                        className={`flex-1 p-4 rounded-xl border transition-all flex flex-col items-center gap-2 ${scanType === "deepfake"
                            ? "border-indigo-500 bg-indigo-500/10"
                            : "border-white/5 bg-white/5 hover:bg-white/10 text-gray-500"
                            }`}
                    >
                        <ShieldAlert size={20} className={scanType === "deepfake" ? "text-indigo-400" : "text-gray-500"} />
                        <span className="text-sm font-semibold">Deepfake</span>
                        <span className="text-[10px] opacity-60">Faces & People</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setScanType("synthetic")}
                        className={`flex-1 p-4 rounded-xl border transition-all flex flex-col items-center gap-2 ${scanType === "synthetic"
                            ? "border-emerald-500 bg-emerald-500/10"
                            : "border-white/5 bg-white/5 hover:bg-white/10 text-gray-500"
                            }`}
                    >
                        <Loader2 size={20} className={scanType === "synthetic" ? "text-emerald-400" : "text-gray-500"} />
                        <span className="text-sm font-semibold">Synthetic</span>
                        <span className="text-[10px] opacity-60">AI News & Scenes</span>
                    </button>
                </div>

                {/* Mode toggle */}
                <div className="flex gap-2 mb-6">
                    {(["upload", "url"] as MediaMode[]).map((m) => (
                        <button
                            key={m}
                            onClick={() => setMode(m)}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === m
                                ? "bg-indigo-600 text-white"
                                : "bg-white/5 text-gray-400 hover:bg-white/10"
                                }`}
                        >
                            {m === "upload" ? "Upload File" : "Paste URL"}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                    {mode === "upload" ? (
                        <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            className="border-2 border-dashed border-white/10 rounded-xl p-10 text-center hover:border-indigo-500/60 transition-colors flex flex-col items-center gap-3"
                        >
                            <UploadCloud size={36} className="text-indigo-400" />
                            <span className="text-gray-400 text-sm">
                                {file ? file.name : "Click to choose image or video"}
                            </span>
                            <input
                                ref={fileRef}
                                type="file"
                                accept="image/*,video/*"
                                className="hidden"
                                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                            />
                        </button>
                    ) : (
                        <div className="relative">
                            <Link2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                type="url"
                                placeholder="https://twitter.com/..."
                                value={mediaUrl}
                                onChange={(e) => setMediaUrl(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500"
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-xs text-gray-400 mb-1">
                            Media Context <span className="text-gray-600">(optional but improves Trend detection)</span>
                        </label>
                        <textarea
                            rows={3}
                            placeholder="e.g. 'Viral video claiming to show military strike from yesterday...'"
                            value={mediaContext}
                            onChange={(e) => setMediaContext(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500 resize-none"
                        />
                    </div>

                    {error && (
                        <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2">
                            {error}
                        </p>
                    )}

                    {/* ── Submit Button ── */}
                    <button
                        type="submit"
                        disabled={((mode === "upload" && !file) || (mode === "url" && !mediaUrl)) || loading}
                        className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
                    >
                        {loading ? (
                            <>
                                <Loader2 size={18} className="animate-spin mr-2" />
                                Initiating Scan Engine...
                            </>
                        ) : (
                            "Analyze Media"
                        )}
                    </button>
                </form>

                <DemoPicker
                    onSelect={(selectedFile, contextParams) => {
                        setFile(selectedFile);
                        setMediaContext(contextParams);
                        setMode("upload"); // Set mode to upload when a demo file is selected
                        setMediaUrl(""); // Clear URL if a demo file is selected
                    }}
                />
            </motion.div>
        </main>
    );
}
