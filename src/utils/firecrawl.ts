export async function firecrawlScrape(url: string): Promise<string | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;

  if (!apiKey) {
    console.warn("FIRECRAWL_API_KEY missing - skipping detailed scrape");
    return null;
  }

  try {
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url: url,
        formats: ["markdown"],
      }),
    });

    const data = await response.json();
    if (data.success && data.data) {
      return data.data.markdown;
    }
    return null;
  } catch (error) {
    console.error("Firecrawl scrape failed:", error);
    return null;
  }
}
