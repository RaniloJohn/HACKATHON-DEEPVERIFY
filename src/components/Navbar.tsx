"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ShieldHalf, Scan, History, LogOut, LogIn, Menu, X } from "lucide-react";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

const navLinks = [
    { href: "/scan", label: "Scan Media", icon: Scan },
    { href: "/history", label: "Scan History", icon: History },
];

export function Navbar({ user }: { user: { email?: string } | null }) {
    const pathname = usePathname();
    const router = useRouter();
    const [menuOpen, setMenuOpen] = useState(false);
    const supabase = createClient();

    const handleSignOut = async () => {
        if (supabase) {
            await supabase.auth.signOut();
        }
        router.push("/");
        router.refresh();
    };

    return (
        <header className="sticky top-0 z-50 border-b border-white/5 backdrop-blur-md bg-[#080c14]/80">
            <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2">
                    <img 
                        src="/logos/WHITELOGO.png" 
                        alt="DeepVerify Logo" 
                        className="h-12 w-auto object-contain"
                    />
                </Link>

                {/* Desktop nav */}
                <nav className="hidden md:flex items-center gap-1">
                    {navLinks.map(({ href, label, icon: Icon }) => (
                        <Link
                            key={href}
                            href={href}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${pathname === href
                                ? "bg-indigo-600/20 text-indigo-300"
                                : "text-gray-400 hover:text-white hover:bg-white/5"
                                }`}
                        >
                            <Icon size={15} />
                            {label}
                        </Link>
                    ))}
                </nav>

                {/* Desktop auth */}
                <div className="hidden md:flex items-center gap-3">
                    {user ? (
                        <>
                            <span className="text-xs text-gray-500 max-w-[160px] truncate">{user.email}</span>
                            <button
                                onClick={handleSignOut}
                                className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
                            >
                                <LogOut size={14} /> Sign out
                            </button>
                        </>
                    ) : (
                        <Link href="/login">
                            <button className="flex items-center gap-2 btn-primary text-sm py-2">
                                <LogIn size={14} /> Sign in
                            </button>
                        </Link>
                    )}
                </div>

                {/* Mobile menu toggle */}
                <button
                    className="md:hidden text-gray-400 hover:text-white"
                    onClick={() => setMenuOpen((o) => !o)}
                >
                    {menuOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
            </div>

            {/* Mobile dropdown */}
            <AnimatePresence>
                {menuOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="md:hidden border-t border-white/5 bg-[#080c14] px-6 py-4 flex flex-col gap-2"
                    >
                        {navLinks.map(({ href, label, icon: Icon }) => (
                            <Link
                                key={href}
                                href={href}
                                onClick={() => setMenuOpen(false)}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/5"
                            >
                                <Icon size={15} />
                                {label}
                            </Link>
                        ))}
                        {user ? (
                            <button
                                onClick={handleSignOut}
                                className="flex items-center gap-2 text-sm text-gray-400 px-3 py-2 rounded-lg hover:bg-white/5 mt-2"
                            >
                                <LogOut size={14} /> Sign out
                            </button>
                        ) : (
                            <Link href="/login" onClick={() => setMenuOpen(false)}>
                                <button className="btn-primary w-full mt-2 text-sm py-2">Sign in</button>
                            </Link>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
    );
}
