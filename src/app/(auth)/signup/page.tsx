"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ShieldHalf, Mail, Lock, Loader2 } from "lucide-react";
import Link from "next/link";
import { signup } from "@/app/(auth)/actions";

export default function SignupPage() {
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        const result = await signup(new FormData(e.currentTarget));
        if (result?.error) {
            setError(result.error);
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center px-4">
            <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card w-full max-w-sm p-8"
            >
                <div className="flex flex-col items-center gap-2 mb-8">
                    <ShieldHalf size={32} className="text-indigo-400" />
                    <h1 className="text-2xl font-bold">Create your account</h1>
                    <p className="text-gray-400 text-sm">Join DeepVerify to track your scans</p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="relative">
                        <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            name="email"
                            type="email"
                            placeholder="you@example.com"
                            required
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500"
                        />
                    </div>
                    <div className="relative">
                        <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            name="password"
                            type="password"
                            placeholder="Min. 8 characters"
                            minLength={8}
                            required
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500"
                        />
                    </div>

                    {error && (
                        <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2">
                            {error}
                        </p>
                    )}

                    <button type="submit" disabled={loading} className="btn-primary flex items-center justify-center gap-2 mt-2">
                        {loading ? <><Loader2 size={15} className="animate-spin" /> Creating account…</> : "Create account →"}
                    </button>
                </form>

                <p className="text-center text-sm text-gray-500 mt-6">
                    Already have an account?{" "}
                    <Link href="/login" className="text-indigo-400 hover:underline">
                        Sign in
                    </Link>
                </p>
            </motion.div>
        </main>
    );
}
