
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
    const id = "7e8343f1-d65f-4575-9965-7709da733ad5";
    console.log(`Checking scan ${id}...`);
    
    const { data: scan, error: scanError } = await supabase
        .from("scans")
        .select("*")
        .eq("id", id)
        .single();
        
    if (scanError) {
        console.error("Error fetching scan:", scanError);
    } else {
        console.log("Scan Data:", JSON.stringify(scan, null, 2));
    }
}

check();
