
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    const { url } = await req.json();
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7'
            }
        });
        const html = await response.text();
        return NextResponse.json({ 
            status: response.status,
            length: html.length,
            preview: html.substring(0, 1000),
            hasDescription: html.includes('name="description"')
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message });
    }
}
