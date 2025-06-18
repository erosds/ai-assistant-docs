from sentence_transformers import SentenceTransformer
import numpy as np
from typing import List, Dict, Tuple
import logging
import asyncio
from concurrent.futures import ThreadPoolExecutor
import time

from app.core.config import settings
from app.db.vectorstore import get_vector_store_manager
from app.services.parsing import get_text_chunker

logger = logging.getLogger(__name__)

class EmbeddingService:
    """Servizio per generare embeddings usando sentence-transformers"""
    
    def __init__(self, model_name: str = None):
        self.model_name = model_name or settings.embedding_model
        self.model = None
        self.embedding_dim = None
        self._executor = ThreadPoolExecutor(max_workers=2)
    
    async def initialize(self) -> bool:
        """Inizializza il modello di embedding"""
        try:
            logger.info(f"🤖 Caricamento modello embedding: {self.model_name}")
            
            # Carica modello in thread separato per non bloccare
            self.model = await asyncio.to_thread(
                SentenceTransformer, self.model_name
            )
            
            # Ottieni dimensione embedding
            test_embedding = await asyncio.to_thread(
                self.model.encode, ["test"]
            )
            self.embedding_dim = test_embedding.shape[1]
            
            logger.info(f"✅ Modello caricato: dimensione embedding = {self.embedding_dim}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Errore caricamento modello embedding: {e}")
            return False
    
    async def encode_texts(self, texts: List[str], batch_size: int = 32) -> np.ndarray:
        """
        Genera embeddings per una lista di testi
        
        Args:
            texts: Lista di testi da encodare
            batch_size: Dimensione batch per l'encoding
            
        Returns:
            Array numpy con gli embeddings
        """
        if not self.model:
            raise Exception("Modello non inizializzato")
        
        try:
            start_time = time.time()
            
            # Encoda in thread separato
            embeddings = await asyncio.to_thread(
                self.model.encode,
                texts,
                batch_size=batch_size,
                show_progress_bar=True,
                convert_to_numpy=True,
                normalize_embeddings=True
            )
            
            elapsed = time.time() - start_time
            logger.info(f"✅ Embeddings generati: {len(texts)} testi in {elapsed:.2f}s")
            
            return embeddings
            
        except Exception as e:
            logger.error(f"❌ Errore generazione embeddings: {e}")
            raise
    
    async def encode_single_text(self, text: str) -> np.ndarray:
        """Genera embedding per un singolo testo"""
        embeddings = await self.encode_texts([text])
        return embeddings[0]
    
    def get_embedding_dimension(self) -> int:
        """Ottieni dimensione degli embeddings"""
        return self.embedding_dim

class DocumentIndexer:
    """Servizio per indicizzare documenti completi"""
    
    def __init__(self):
        self.embedding_service = EmbeddingService()
        self.vector_store_manager = get_vector_store_manager()
        self.text_chunker = get_text_chunker()
    
    async def initialize(self) -> bool:
        """Inizializza il servizio di indicizzazione"""
        return await self.embedding_service.initialize()
    
    async def index_document(self, document_id: str, text: str, document_name: str) -> Dict[str, any]:
        """
        Indicizza un documento completo
        
        Args:
            document_id: ID unico del documento
            text: Testo completo del documento
            document_name: Nome del documento
            
        Returns:
            Dict con risultati dell'indicizzazione
        """
        try:
            start_time = time.time()
            logger.info(f"🔄 Inizio indicizzazione documento: {document_name}")
            
            # 1. Chunking del testo
            logger.info("📄 Chunking del testo...")
            chunks = self.text_chunker.chunk_text(text, document_name)
            
            if not chunks:
                return {
                    'success': False,
                    'error': 'Nessun chunk generato dal documento',
                    'chunks_count': 0
                }
            
            # 2. Genera embeddings
            logger.info(f"🧠 Generazione embeddings per {len(chunks)} chunk...")
            chunk_texts = [chunk['content'] for chunk in chunks]
            embeddings = await self.embedding_service.encode_texts(chunk_texts)
            
            # 3. Crea vector store
            logger.info("💾 Creazione vector store...")
            success = self.vector_store_manager.create_store(
                document_id=document_id,
                embeddings=embeddings,
                chunks_metadata=chunks,
                embedding_dim=self.embedding_service.get_embedding_dimension()
            )
            
            if not success:
                return {
                    'success': False,
                    'error': 'Errore creazione vector store',
                    'chunks_count': len(chunks)
                }
            
            elapsed = time.time() - start_time
            
            result = {
                'success': True,
                'document_id': document_id,
                'chunks_count': len(chunks),
                'embedding_dimension': self.embedding_service.get_embedding_dimension(),
                'processing_time': elapsed,
                'statistics': {
                    'total_characters': sum(chunk['char_count'] for chunk in chunks),
                    'total_words': sum(chunk['word_count'] for chunk in chunks),
                    'average_chunk_size': np.mean([chunk['char_count'] for chunk in chunks]),
                    'chunks': len(chunks)
                }
            }
            
            logger.info(f"✅ Documento indicizzato in {elapsed:.2f}s: {len(chunks)} chunk")
            return result
            
        except Exception as e:
            logger.error(f"❌ Errore indicizzazione documento: {e}")
            return {
                'success': False,
                'error': str(e),
                'chunks_count': 0
            }
    
    async def search_similar_chunks(self, document_id: str, query: str, k: int = 5, 
                                  score_threshold: float = 0.1) -> List[Dict]:
        """
        Cerca chunk simili a una query
        
        Args:
            document_id: ID del documento
            query: Testo della query
            k: Numero di risultati
            score_threshold: Soglia di similarità
            
        Returns:
            Lista di chunk simili con score
        """
        try:
            # 1. Genera embedding della query
            query_embedding = await self.embedding_service.encode_single_text(query)
            
            # 2. Ottieni vector store
            vector_store = self.vector_store_manager.get_store(
                document_id, 
                self.embedding_service.get_embedding_dimension()
            )
            
            # 3. Cerca chunk simili
            results = vector_store.search(
                query_embedding=query_embedding,
                k=k,
                score_threshold=score_threshold
            )
            
            logger.info(f"🔍 Ricerca completata: {len(results)} risultati per '{query[:50]}...'")
            return results
            
        except Exception as e:
            logger.error(f"❌ Errore ricerca similarità: {e}")
            return []
    
    async def delete_document_index(self, document_id: str) -> bool:
        """Elimina indice di un documento"""
        try:
            success = self.vector_store_manager.delete_store(document_id)
            if success:
                logger.info(f"✅ Indice eliminato per documento {document_id}")
            return success
        except Exception as e:
            logger.error(f"❌ Errore eliminazione indice: {e}")
            return False
    
    async def get_index_stats(self, document_id: str) -> Dict:
        """Ottieni statistiche dell'indice per un documento"""
        return self.vector_store_manager.get_store_stats(document_id)
    
    async def list_indexed_documents(self) -> List[str]:
        """Lista documenti indicizzati"""
        return self.vector_store_manager.list_available_stores()

class QueryProcessor:
    """Processa query e prepara contesto per LLM"""
    
    def __init__(self):
        self.document_indexer = DocumentIndexer()
    
    async def process_query(self, document_id: str, query: str, 
                           max_chunks: int = 5, min_score: float = 0.1) -> Dict[str, any]:
        """
        Processa una query e prepara il contesto
        
        Args:
            document_id: ID del documento
            query: Query dell'utente
            max_chunks: Numero massimo di chunk da recuperare
            min_score: Score minimo di similarità
            
        Returns:
            Dict con contesto e metadati
        """
        try:
            # Cerca chunk rilevanti
            similar_chunks = await self.document_indexer.search_similar_chunks(
                document_id=document_id,
                query=query,
                k=max_chunks,
                score_threshold=min_score
            )
            
            if not similar_chunks:
                return {
                    'success': False,
                    'message': 'Nessun contenuto rilevante trovato nel documento',
                    'contexts': [],
                    'sources': []
                }
            
            # Prepara contesti per LLM
            contexts = []
            sources = []
            
            for chunk in similar_chunks:
                contexts.append(chunk['content'])
                sources.append({
                    'chunk_id': chunk['chunk_id'],
                    'similarity_score': chunk['similarity_score'],
                    'word_count': chunk['chunk_metadata']['word_count']
                })
            
            return {
                'success': True,
                'contexts': contexts,
                'sources': sources,
                'total_chunks_found': len(similar_chunks),
                'average_similarity': np.mean([c['similarity_score'] for c in similar_chunks]),
                'query': query
            }
            
        except Exception as e:
            logger.error(f"❌ Errore processing query: {e}")
            return {
                'success': False,
                'message': f'Errore durante la ricerca: {str(e)}',
                'contexts': [],
                'sources': []
            }

# Istanze globali
document_indexer = DocumentIndexer()
query_processor = QueryProcessor()

async def initialize_indexing_service():
    """Inizializza il servizio di indicizzazione"""
    logger.info("🔧 Inizializzazione servizio indicizzazione...")
    success = await document_indexer.initialize()
    if success:
        logger.info("✅ Servizio indicizzazione inizializzato")
    else:
        logger.error("❌ Fallita inizializzazione servizio indicizzazione")
    return success

def get_document_indexer() -> DocumentIndexer:
    """Ottieni istanza DocumentIndexer"""
    return document_indexer

def get_query_processor() -> QueryProcessor:
    """Ottieni istanza QueryProcessor"""
    return query_processor