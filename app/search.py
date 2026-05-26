import logging
from typing import List, Dict
import httpx
from bs4 import BeautifulSoup
from duckduckgo_search import DDGS

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def search_ddg(query: str, max_results: int = 5) -> List[Dict[str, str]]:
    """
    Search DuckDuckGo using duckduckgo_search library.
    No API Key required.
    """
    logger.info(f"Searching DuckDuckGo for: '{query}'")
    try:
        with DDGS() as ddgs:
            results = ddgs.text(query, max_results=max_results)
            formatted_results = []
            if results:
                for r in results:
                    formatted_results.append({
                        "title": r.get("title", ""),
                        "url": r.get("href", ""),
                        "snippet": r.get("body", "")
                    })
            return formatted_results
    except Exception as e:
        logger.error(f"Error during DuckDuckGo search: {e}")
        # Fallback to empty list or mock results if DDG rate limits
        return []

async def scrape_url(url: str, timeout: int = 8) -> str:
    """
    Fetch a URL and scrape its primary text content.
    """
    logger.info(f"Scraping URL: {url}")
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    try:
        async with httpx.AsyncClient(headers=headers, follow_redirects=True) as client:
            response = await client.get(url, timeout=timeout)
            if response.status_code != 200:
                logger.warning(f"Failed to fetch {url}, status code: {response.status_code}")
                return ""
            
            soup = BeautifulSoup(response.text, "html.parser")
            
            # Remove script and style elements
            for script in soup(["script", "style", "header", "footer", "nav", "aside"]):
                script.extract()
            
            # Get text and clean it up
            text = soup.get_text()
            lines = (line.strip() for line in text.splitlines())
            chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
            text = "\n".join(chunk for chunk in chunks if chunk)
            
            # Return first 3000 characters to keep context sizes reasonable
            return text[:3000]
    except Exception as e:
        logger.error(f"Error scraping {url}: {e}")
        return ""
