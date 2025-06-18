import faiss
import numpy as np
import pickle
import os
from typing import List, Dict, Tuple, Optional
import logging
from pathlib import Path
from app.core.config import settings

logger = logging.getLogger(__name__)

class FAISSVectorStore:
    """Gestisce il vector store FAISS per similarity search"""
    
    def __init__(self, document_id: str, embedding_dim: int = 384):
        self.document_id = document_id
        self.embedding_dim = embedding_dim
        self.index = None
        self.chunks_metadata = []
        
        # Percorsi file
        self.index_path = os.path.join(settings.faiss_index_dir, f"{document_id}.index")
        self.metadata_path = os.path.join(settings.faiss_index_dir, f"{document_id}_metadata.pkl")
        
    def create_index(self, embeddings: np.ndarray, chunks_metadata: List[Dict]) -> bool:
        """
        Crea un nuovo indice FAISS
        
        Args:
            embeddings: Array numpy con gli embeddings
            chunks_metadata: Lista con metadati dei chunk
            
        Returns:
            bool: Successo operazione
        """
        try:
            # Verifica dimensioni
            if embeddings.shape[1] != self.embedding_dim:
                logger.error(f"Dimensione embedding errata: {embeddings.shape[1]} vs {self.embedding_dim}")
                return False
            
            # Crea indice FAISS (IndexFlatIP per cosine similarity)
            self.index = faiss.IndexFlatIP(self.embedding_dim)
            
            # Normalizza embeddings per cosine similarity
            faiss.normalize_L2(embeddings)
            
            # Aggiungi embeddings all'indice
            self.index.add(embeddings.astype(np.float32))
            
            # Salva metadati
            self.chunks_metadata = chunks_metadata
            
            # Salva su disco
            self._save_to_disk()
            
            logger.info(f"✅ Indice FAISS creato: {len(chunks_metadata)} chunk, dim={self.embedding_dim}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Errore creazione indice FAISS: {e}")
            return False
    
    def load_index(self) -> bool:
        """Carica indice esistente da disco"""
        try:
            if not os.path.exists(self.index_path) or not os.path.exists(self.metadata_path):
                logger.warning(f"Indice non trovato per documento {self.document_id}")
                return False
            
            # Carica indice FAISS
            self.index = faiss.read_index(self.index_path)
            
            # Carica metadati
            with open(self.metadata_path, 'rb') as f:
                self.chunks_metadata = pickle.load(f)
            
            logger.info(f"✅ Indice FAISS caricato: {len(self.chunks_metadata)} chunk")
            return True
            
        except Exception as e:
            logger.error(f"❌ Errore caricamento indice FAISS: {e}")
            return False
    
    def search(self, query_embedding: np.ndarray, k: int = 5, score_threshold: float = 0.1) -> List[Dict]:
        """
        Cerca chunk simili alla query
        
        Args:
            query_embedding: Embedding della query
            k: Numero di risultati da restituire
            score_threshold: Soglia minima di similarità
            
        Returns:
            Lista di risultati con chunk e score
        """
        try:
            if self.index is None:
                logger.error("Indice non caricato")
                return []
            
            # Normalizza query embedding
            query_embedding = query_embedding.reshape(1, -1).astype(np.float32)
            faiss.normalize_L2(query_embedding)
            
            # Cerca
            scores, indices = self.index.search(query_embedding, min(k, self.index.ntotal))
            
            # Filtra risultati per soglia
            results = []
            for score, idx in zip(scores[0], indices[0]):
                if score >= score_threshold and idx < len(self.chunks_metadata):
                    result = {
                        'chunk_metadata': self.chunks_metadata[idx],
                        'content': self.chunks_metadata[idx]['content'],
                        'similarity_score': float(score),
                        'chunk_id': self.chunks_metadata[idx]['chunk_id']
                    }
                    results.append(result)
            
            # Ordina per score decrescente
            results.sort(key=lambda x: x['similarity_score'], reverse=True)
            
            logger.info(f"✅ Ricerca completata: {len(results)} risultati trovati")
            return results
            
        except Exception as e:
            logger.error(f"❌ Errore ricerca FAISS: {e}")
            return []
    
    def add_chunks(self, new_embeddings: np.ndarray, new_metadata: List[Dict]) -> bool:
        """Aggiungi nuovi chunk all'indice esistente"""
        try:
            if self.index is None:
                return self.create_index(new_embeddings, new_metadata)
            
            # Normalizza nuovi embeddings
            faiss.normalize_L2(new_embeddings)
            
            # Aggiungi all'indice
            self.index.add(new_embeddings.astype(np.float32))
            
            # Aggiorna metadati
            self.chunks_metadata.extend(new_metadata)
            
            # Salva
            self._save_to_disk()
            
            logger.info(f"✅ Aggiunti {len(new_metadata)} chunk all'indice")
            return True
            
        except Exception as e:
            logger.error(f"❌ Errore aggiunta chunk: {e}")
            return False
    
    def delete_index(self) -> bool:
        """Elimina indice e metadati"""
        try:
            files_to_delete = [self.index_path, self.metadata_path]
            
            for file_path in files_to_delete:
                if os.path.exists(file_path):
                    os.remove(file_path)
            
            self.index = None
            self.chunks_metadata = []
            
            logger.info(f"✅ Indice eliminato per documento {self.document_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Errore eliminazione indice: {e}")
            return False
    
    def get_stats(self) -> Dict:
        """Ottieni statistiche dell'indice"""
        if self.index is None:
            return {"status": "not_loaded"}
        
        return {
            "status": "loaded",
            "total_chunks": self.index.ntotal,
            "embedding_dimension": self.embedding_dim,
            "index_type": type(self.index).__name__,
            "metadata_count": len(self.chunks_metadata)
        }
    
    def _save_to_disk(self):
        """Salva indice e metadati su disco"""
        # Assicurati che la cartella esista
        os.makedirs(settings.faiss_index_dir, exist_ok=True)
        
        # Salva indice FAISS
        faiss.write_index(self.index, self.index_path)
        
        # Salva metadati
        with open(self.metadata_path, 'wb') as f:
            pickle.dump(self.chunks_metadata, f)

class VectorStoreManager:
    """Gestisce multiple vector store per diversi documenti"""
    
    def __init__(self):
        self._stores = {}  # Cache degli store caricati
    
    def get_store(self, document_id: str, embedding_dim: int = 384) -> FAISSVectorStore:
        """Ottieni store per un documento (con cache)"""
        if document_id not in self._stores:
            store = FAISSVectorStore(document_id, embedding_dim)
            store.load_index()  # Prova a caricare se esiste
            self._stores[document_id] = store
        
        return self._stores[document_id]
    
    def create_store(self, document_id: str, embeddings: np.ndarray, 
                    chunks_metadata: List[Dict], embedding_dim: int = 384) -> bool:
        """Crea nuovo store per un documento"""
        store = FAISSVectorStore(document_id, embedding_dim)
        success = store.create_index(embeddings, chunks_metadata)
        
        if success:
            self._stores[document_id] = store
        
        return success
    
    def delete_store(self, document_id: str) -> bool:
        """Elimina store per un documento"""
        # Rimuovi dalla cache
        if document_id in self._stores:
            success = self._stores[document_id].delete_index()
            del self._stores[document_id]
            return success
        else:
            # Prova a eliminare direttamente
            store = FAISSVectorStore(document_id)
            return store.delete_index()
    
    def list_available_stores(self) -> List[str]:
        """Lista documenti con indice disponibile"""
        if not os.path.exists(settings.faiss_index_dir):
            return []
        
        index_files = [f for f in os.listdir(settings.faiss_index_dir) if f.endswith('.index')]
        document_ids = [f.replace('.index', '') for f in index_files]
        
        return document_ids
    
    def get_store_stats(self, document_id: str) -> Dict:
        """Ottieni statistiche per uno store"""
        store = self.get_store(document_id)
        return store.get_stats()
    
    def cleanup_cache(self):
        """Pulisci cache degli store"""
        self._stores.clear()
        logger.info("✅ Cache vector store pulita")

# Istanza globale
vector_store_manager = VectorStoreManager()

def get_vector_store_manager() -> VectorStoreManager:
    """Ottieni istanza VectorStoreManager"""
    return vector_store_manager