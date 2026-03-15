import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { createClient } from "@/utils/supabase/server";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DeepVerify – Trend-Aware Deepfake Detector",
  description:
    "Detect AI-manipulated images and videos. Analyzes media for deepfake signals and cross-references trending global events.",
  keywords: ["deepfake", "media verification", "misinformation", "AI detection"],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Guard: skip Supabase auth if credentials aren't configured yet
  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== "your_supabase_project_url";

  let user = null;
  if (supabaseConfigured) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  }

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#080c14] text-white`}>
        <Navbar user={user ? { email: user.email } : null} />
        {children}
      </body>
    </html>
  );
}
