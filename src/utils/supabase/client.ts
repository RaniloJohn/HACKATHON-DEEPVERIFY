import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || url === "your_supabase_project_url" || !key || key === "your_supabase_anon_key") {
        // Return a dummy client or null if not configured to prevent crashes during local UI dev
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return null as any; // Cast as any because we just want to bypass the crash
    }

    return createBrowserClient(url, key);
}
