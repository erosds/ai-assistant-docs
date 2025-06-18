from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime

from app.db.mongo import get_document_manager
from app.services.indexing import get_document_indexer

logger = logging.getLogger(__name__)

router = APIRouter()

class DocumentInfo(BaseModel):
    """Schema per informazioni documento"""
    id: str
    filename: str
    upload_date: datetime
    content_preview: str
    chunk_count: int
    chat_count: int
    status: str
    file_size: Optional[int] = None
    processing_complete: bool

class DocumentListResponse(BaseModel):
    """Schema per lista documenti"""
    documents: List[DocumentInfo]
    total_count: int
    page: int
    page_size: int

class DocumentDetailResponse(BaseModel):
    """Schema per dettagli documento"""
    document: DocumentInfo
    statistics: Dict[str, Any]
    index_stats: Dict[str, Any]
    recent_chats: List[Dict[str, Any]]

@router.get("/documents", response_model=DocumentListResponse)
async def list_documents(
    page: int = Query(1, ge=1, description="Numero pagina"),
    page_size: int = Query(20, ge=1, le=100, description="Documenti per pagina"),
    search: Optional[str] = Query(None, description="Cerca per nome file")
):
    """
    Lista tutti i documenti con paginazione e ricerca
    
    Args:
        page: Numero della pagina (inizia da 1)
        page_size: Numero di documenti per pagina
        search: Termine di ricerca per filtrare per nome file
    """
    try:
        document_manager = get_document_manager()
        
        # Ottieni tutti i documenti
        all_documents = await document_manager.get_all_documents()
        
        # Filtra per ricerca se specificata
        if search:
            search_lower = search.lower()
            all_documents = [
                doc for doc in all_documents 
                if search_lower in doc['filename'].lower()
            ]
        
        # Calcola paginazione
        total_count = len(all_documents)
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paginated_docs = all_documents[start_idx:end_idx]
        
        # Controlla stato processing per ogni documento
        document_indexer = get_document_indexer()
        documents_info = []
        
        for doc in paginated_docs:
            doc_id = doc['_id']
            
            # Controlla se l'indicizzazione è completata
            index_stats = await document_indexer.get_index_stats(doc_id)
            processing_complete = index_stats.get("status") == "loaded"
            
            document_info = DocumentInfo(
                id=doc_id,
                filename=doc['filename'],
                upload_date=doc['upload_date'],
                content_preview=doc['content_preview'],
                chunk_count=doc.get('chunk_count', 0),
                chat_count=doc.get('chat_count', 0),
                status=doc.get('status', 'unknown'),
                processing_complete=processing_complete
            )
            documents_info.append(document_info)
        
        return DocumentListResponse(
            documents=documents_info,
            total_count=total_count,
            page=page,
            page_size=page_size
        )
        
    except Exception as e:
        logger.error(f"❌ Errore lista documenti: {e}")
        raise HTTPException(status_code=500, detail=f"Errore interno: {str(e)}")

@router.get("/documents/{document_id}", response_model=DocumentDetailResponse)
async def get_document_details(document_id: str):
    """
    Ottieni dettagli completi di un documento
    
    Include statistiche, stato dell'indice e cronologia chat recente.
    """
    try:
        document_manager = get_document_manager()
        document = await document_manager.get_document(document_id)
        
        if not document:
            raise HTTPException(status_code=404, detail="Documento non trovato")
        
        # Ottieni statistiche indice
        document_indexer = get_document_indexer()
        index_stats = await document_indexer.get_index_stats(document_id)
        processing_complete = index_stats.get("status") == "loaded"
        
        # Ottieni cronologia chat recente
        from app.db.mongo import get_chat_manager
        chat_manager = get_chat_manager()
        recent_chats = await chat_manager.get_chat_history(document_id, limit=5)
        
        # Statistiche del documento
        import os
        file_size = None
        if 'file_path' in document and os.path.exists(document['file_path']):
            file_size = os.path.getsize(document['file_path'])
        
        statistics = {
            "file_size_bytes": file_size,
            "upload_date": document['upload_date'],
            "chunk_count": document.get('chunk_count', 0),
            "chat_count": document.get('chat_count', 0),
            "processing_complete": processing_complete
        }
        
        document_info = DocumentInfo(
            id=document['_id'],
            filename=document['filename'],
            upload_date=document['upload_date'],
            content_preview=document['content_preview'],
            chunk_count=document.get('chunk_count', 0),
            chat_count=document.get('chat_count', 0),
            status=document.get('status', 'unknown'),
            file_size=file_size,
            processing_complete=processing_complete
        )
        
        return DocumentDetailResponse(
            document=document_info,
            statistics=statistics,
            index_stats=index_stats,
            recent_chats=recent_chats
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Errore dettagli documento: {e}")
        raise HTTPException(status_code=500, detail=f"Errore interno: {str(e)}")

@router.get("/documents/{document_id}/content")
async def get_document_content(
    document_id: str,
    chunk_id: Optional[int] = Query(None, description="ID specifico del chunk")
):
    """
    Ottieni contenuto del documento o di un chunk specifico
    
    Args:
        document_id: ID del documento
        chunk_id: ID del chunk specifico (opzionale)
    """
    try:
        document_manager = get_document_manager()
        document = await document_manager.get_document(document_id)
        
        if not document:
            raise HTTPException(status_code=404, detail="Documento non trovato")
        
        # Ottieni vector store per accedere ai chunk
        from app.db.vectorstore import get_vector_store_manager
        vector_store_manager = get_vector_store_manager()
        vector_store = vector_store_manager.get_store(document_id)
        
        if chunk_id is not None:
            # Restituisci chunk specifico
            if chunk_id >= len(vector_store.chunks_metadata):
                raise HTTPException(status_code=404, detail="Chunk non trovato")
            
            chunk = vector_store.chunks_metadata[chunk_id]
            return {
                "document_id": document_id,
                "chunk_id": chunk_id,
                "content": chunk['content'],
                "metadata": chunk
            }
        else:
            # Restituisci tutti i chunk
            return {
                "document_id": document_id,
                "filename": document['filename'],
                "total_chunks": len(vector_store.chunks_metadata),
                "chunks": vector_store.chunks_metadata
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Errore contenuto documento: {e}")
        raise HTTPException(status_code=500, detail=f"Errore interno: {str(e)}")

@router.get("/documents/stats/overview")
async def get_documents_overview():
    """Ottieni statistiche generali di tutti i documenti"""
    try:
        document_manager = get_document_manager()
        all_documents = await document_manager.get_all_documents()
        
        if not all_documents:
            return {
                "total_documents": 0,
                "total_chunks": 0,
                "total_chats": 0,
                "processing_complete": 0,
                "processing_pending": 0
            }
        
        # Controlla stato processing
        document_indexer = get_document_indexer()
        processing_complete = 0
        total_chunks = 0
        total_chats = 0
        
        for doc in all_documents:
            index_stats = await document_indexer.get_index_stats(doc['_id'])
            if index_stats.get("status") == "loaded":
                processing_complete += 1
            
            total_chunks += doc.get('chunk_count', 0)
            total_chats += doc.get('chat_count', 0)
        
        return {
            "total_documents": len(all_documents),
            "total_chunks": total_chunks,
            "total_chats": total_chats,
            "processing_complete": processing_complete,
            "processing_pending": len(all_documents) - processing_complete,
            "average_chunks_per_document": total_chunks / len(all_documents) if all_documents else 0,
            "average_chats_per_document": total_chats / len(all_documents) if all_documents else 0
        }
        
    except Exception as e:
        logger.error(f"❌ Errore overview documenti: {e}")
        raise HTTPException(status_code=500, detail=f"Errore interno: {str(e)}")

@router.post("/documents/{document_id}/reprocess")
async def reprocess_document(document_id: str):
    """
    Riprocessa un documento (re-indicizzazione)
    
    Utile se ci sono stati errori durante il processing iniziale
    o se si vogliono aggiornare i parametri di chunking.
    """
    try:
        document_manager = get_document_manager()
        document = await document_manager.get_document(document_id)
        
        if not document:
            raise HTTPException(status_code=404, detail="Documento non trovato")
        
        file_path = document.get('file_path')
        if not file_path or not os.path.exists(file_path):
            raise HTTPException(status_code=400, detail="File documento non trovato su disco")
        
        # Elimina indice esistente
        document_indexer = get_document_indexer()
        await document_indexer.delete_document_index(document_id)
        
        # Riprocessa documento
        from app.api.routes.upload import process_document_background
        import asyncio
        
        # Esegui reprocessing
        await process_document_background(
            file_path=file_path,
            document_id=document_id,
            filename=document['filename']
        )
        
        return {
            "success": True,
            "message": f"Documento '{document['filename']}' ri-processato con successo",
            "document_id": document_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Errore reprocessing documento: {e}")
        raise HTTPException(status_code=500, detail=f"Errore interno: {str(e)}")

@router.get("/documents/search/content")
async def search_content_across_documents(
    query: str = Query(..., min_length=1, description="Query di ricerca"),
    max_results: int = Query(10, ge=1, le=50, description="Numero massimo risultati"),
    similarity_threshold: float = Query(0.1, ge=0.0, le=1.0, description="Soglia similarità")
):
    """
    Cerca contenuti attraverso tutti i documenti indicizzati
    
    Restituisce chunk rilevanti da tutti i documenti che corrispondono alla query.
    """
    try:
        document_manager = get_document_manager()
        all_documents = await document_manager.get_all_documents()
        
        if not all_documents:
            return {
                "query": query,
                "results": [],
                "total_results": 0,
                "documents_searched": 0
            }
        
        # Cerca in ogni documento
        document_indexer = get_document_indexer()
        all_results = []
        documents_searched = 0
        
        for doc in all_documents:
            doc_id = doc['_id']
            
            # Controlla se il documento è indicizzato
            index_stats = await document_indexer.get_index_stats(doc_id)
            if index_stats.get("status") != "loaded":
                continue
            
            documents_searched += 1
            
            # Cerca nel documento
            results = await document_indexer.search_similar_chunks(
                document_id=doc_id,
                query=query,
                k=5,  # Massimo 5 risultati per documento
                score_threshold=similarity_threshold
            )
            
            # Aggiungi informazioni documento ai risultati
            for result in results:
                result['document_info'] = {
                    'id': doc_id,
                    'filename': doc['filename'],
                    'upload_date': doc['upload_date']
                }
                all_results.append(result)
        
        # Ordina tutti i risultati per similarità
        all_results.sort(key=lambda x: x['similarity_score'], reverse=True)
        
        # Limita risultati
        limited_results = all_results[:max_results]
        
        return {
            "query": query,
            "results": limited_results,
            "total_results": len(limited_results),
            "documents_searched": documents_searched,
            "similarity_threshold": similarity_threshold
        }
        
    except Exception as e:
        logger.error(f"❌ Errore ricerca contenuti: {e}")
        raise HTTPException(status_code=500, detail=f"Errore interno: {str(e)}")