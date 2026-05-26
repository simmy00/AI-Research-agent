import re
import math
import logging
from typing import List, Dict, Tuple
import httpx

logger = logging.getLogger(__name__)

class RAGIndex:
    def __init__(self):
        # List of dicts: {"document": str, "chunk_id": int, "text": str, "embedding": List[float]}
        self.chunks: List[Dict] = []
        # Keep track of uploaded documents
        self.documents: List[str] = []

    def clear(self):
        self.chunks.clear()
        self.documents.clear()

    def add_document(self, filename: str, content: str):
        """
        Split a document into chunks and add them to the index.
        """
        if filename in self.documents:
            return
        
        self.documents.append(filename)
        # Clean up whitespace
        content = re.sub(r'\s+', ' ', content).strip()
        
        # Simple chunking: ~600 characters with 150 characters overlap
        chunk_size = 600
        overlap = 150
        
        start = 0
        chunk_id = 0
        while start < len(content):
            end = min(start + chunk_size, len(content))
            chunk_text = content[start:end]
            self.chunks.append({
                "document": filename,
                "chunk_id": chunk_id,
                "text": chunk_text,
                "embedding": None
            })
            chunk_id += 1
            if end == len(content):
                break
            start += (chunk_size - overlap)
        logger.info(f"Indexed document {filename}: split into {chunk_id} chunks.")

    async def get_gemini_embedding(self, text: str, api_key: str) -> List[float]:
        """
        Fetch embedding from Gemini free embedding API.
        """
        url = f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={api_key}"
        headers = {"Content-Type": "application/json"}
        payload = {
            "model": "models/text-embedding-004",
            "content": {"parts": [{"text": text}]}
        }
        try:
            async with httpx.AsyncClient() as client:
                res = await client.post(url, json=payload, headers=headers, timeout=5)
                if res.status_code == 200:
                    return res.json()["embedding"]["values"]
        except Exception as e:
            logger.warning(f"Error fetching Gemini embedding: {e}")
        return []

    async def get_ollama_embedding(self, text: str, ollama_url: str) -> List[float]:
        """
        Fetch embedding from local Ollama embedding API.
        """
        url = f"{ollama_url}/api/embeddings"
        payload = {
            "model": "all-minilm" if "all-minilm" in text else "llama3", # simple fallback model check
            "prompt": text
        }
        try:
            # We can try using the active model for embeddings
            async with httpx.AsyncClient() as client:
                res = await client.post(url, json=payload, timeout=5)
                if res.status_code == 200:
                    return res.json()["embedding"]
        except Exception as e:
            logger.warning(f"Error fetching Ollama embedding: {e}")
        return []

    def _tfidf_similarity(self, query: str, document_text: str) -> float:
        """
        Fallback TF-IDF similarity matcher (cosine similarity of term frequencies).
        """
        query_words = re.findall(r'\w+', query.lower())
        doc_words = re.findall(r'\w+', document_text.lower())
        
        if not query_words or not doc_words:
            return 0.0
        
        # Calculate term frequencies
        q_tf = {}
        for w in query_words:
            q_tf[w] = q_tf.get(w, 0) + 1
            
        d_tf = {}
        for w in doc_words:
            d_tf[w] = d_tf.get(w, 0) + 1
            
        # Cosine similarity
        intersection = set(q_tf.keys()) & set(d_tf.keys())
        numerator = sum([q_tf[w] * d_tf[w] for w in intersection])
        
        sum_q = sum([val ** 2 for val in q_tf.values()])
        sum_d = sum([val ** 2 for val in d_tf.values()])
        
        denominator = math.sqrt(sum_q) * math.sqrt(sum_d)
        
        if not denominator:
            return 0.0
        return numerator / denominator

    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        if not vec1 or not vec2 or len(vec1) != len(vec2):
            return 0.0
        dot_product = sum(p*q for p, q in zip(vec1, vec2))
        magnitude1 = math.sqrt(sum(p**2 for p in vec1))
        magnitude2 = math.sqrt(sum(q**2 for q in vec2))
        if not magnitude1 or not magnitude2:
            return 0.0
        return dot_product / (magnitude1 * magnitude2)

    async def search(self, query: str, top_k: int = 3, gemini_key: str = None, ollama_url: str = None) -> List[Dict]:
        """
        Search document chunks using either Gemini/Ollama embeddings or TF-IDF fallback.
        """
        if not self.chunks:
            return []
            
        results: List[Tuple[float, Dict]] = []
        
        # Scenario A: Gemini API key is active
        if gemini_key:
            logger.info("Performing semantic search via Gemini Embeddings...")
            query_vector = await self.get_gemini_embedding(query, gemini_key)
            if query_vector:
                for chunk in self.chunks:
                    if chunk["embedding"] is None:
                        # Lazy embedding generation for chunks
                        chunk["embedding"] = await self.get_gemini_embedding(chunk["text"], gemini_key)
                    
                    if chunk["embedding"]:
                        sim = self._cosine_similarity(query_vector, chunk["embedding"])
                        results.append((sim, chunk))
                if results:
                    results.sort(key=lambda x: x[0], reverse=True)
                    return [r[1] for r in results[:top_k]]

        # Scenario B: Ollama URL is active
        elif ollama_url:
            logger.info("Performing semantic search via Ollama Embeddings...")
            query_vector = await self.get_ollama_embedding(query, ollama_url)
            if query_vector:
                for chunk in self.chunks:
                    if chunk["embedding"] is None:
                        chunk["embedding"] = await self.get_ollama_embedding(chunk["text"], ollama_url)
                    
                    if chunk["embedding"]:
                        sim = self._cosine_similarity(query_vector, chunk["embedding"])
                        results.append((sim, chunk))
                if results:
                    results.sort(key=lambda x: x[0], reverse=True)
                    return [r[1] for r in results[:top_k]]

        # Scenario C: Fallback to keyword TF-IDF similarity
        logger.info("Performing local TF-IDF similarity search...")
        for chunk in self.chunks:
            sim = self._tfidf_similarity(query, chunk["text"])
            results.append((sim, chunk))
            
        results.sort(key=lambda x: x[0], reverse=True)
        return [r[1] for r in results[:top_k] if r[0] > 0.05] # Keep only relevant matches
