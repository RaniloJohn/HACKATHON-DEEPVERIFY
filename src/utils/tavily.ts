export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export async function tavilySearch(query: string): Promise<TavilySearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  
  if (!apiKey) {
    console.warn("TAVILY_API_KEY missing - skipping deep search");
    return [];
  }

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        search_depth: "advanced",
        include_domains: ["gmanetwork.com", "abs-cbn.com", "rappler.com", "pna.gov.ph", "philstar.com", "inquirer.net", "bbc.com", "reuters.com"],
        max_results: 5,
      }),
    });

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("Tavily search failed:", error);
    return [];
  }
}
