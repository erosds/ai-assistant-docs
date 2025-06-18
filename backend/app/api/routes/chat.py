from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
import logging
from datetime import datetime

from app.core.llm import get_document_qa
from app.services.indexing import get_query_processor
from app.db.mongo import get_document_manager, get_chat_manager

logger = logging.getLogger(__name__)

router = APIRouter()

class ChatRequest(BaseModel):
    """Schema per richiesta chat"""
    document_id: str = Field(..., description="ID del documento")
    question: str = Field(..., min_length=1, max_length=2000, description="Domanda dell'utente")
    include_sources: bool = Field(default=True, description="Includi informazioni sui chunk utilizzati")
    max_chunks: int = Field(default=5, ge=1, le=10, description="Numero massimo di chunk da utilizzare")
    similarity_threshold: float = Field(default=0.1, ge=0.0, le=1.0, description="Soglia minima di similarità")

class ChatResponse(BaseModel):
    """Schema per risposta chat"""
    success: bool
    answer: str
    question: str
    document_id: str
    timestamp: datetime
    sources: Optional[List[Dict[str, Any]]] = None
    metadata: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class ChatHistoryResponse(BaseModel):
    """Schema per cronologia chat"""
    document_id: str
    messages: List[Dict[str, Any]]
    total_messages: int

@router.post("/chat", response_model=ChatResponse)
async def chat_with_document(request: ChatRequest):
    """
    Chatta con un documento usando AI
    
    Processa una domanda dell'utente e restituisce una risposta
    basata esclusivamente sul contenuto del documento specificato.
    """
    try:
        # Verifica che il documento esista
        document_manager = get_document_manager()
        document = await document_manager.get_document(request.document_id)
        
        if not document:
            raise HTTPException(status_code=404, detail="Documento non trovato")
        
        # Processa la query per ottenere contesto rilevante
        query_processor = get_query_processor()
        context_result = await query_processor.process_query(
            document_id=request.document_id,
            query=request.question,
            max_chunks=request.max_chunks,
            min_score=request.similarity_threshold
        )
        
        if not context_result['success']:
            return ChatResponse(
                success=False,
                answer="Non sono riuscito a trovare informazioni rilevanti nel documento per rispondere alla tua domanda. Prova a riformulare la domanda o a essere più specifico.",
                question=request.question,
                document_id=request.document_id,
                timestamp=datetime.utcnow(),
                error=context_result['message']
            )
        
        # Ottieni cronologia chat per contesto
        chat_manager = get_chat_manager()
        chat_history = await chat_manager.get_chat_history(request.document_id, limit=5)
        
        # Genera risposta usando LLM
        document_qa = get_document_qa()
        qa_result = await document_qa.answer_question(
            question=request.question,
            contexts=context_result['contexts'],
            document_name=document['filename'],
            chat_history=chat_history
        )
        
        # Prepara metadati
        metadata = {
            "model": qa_result.get("model"),
            "chunks_used": qa_result.get("context_count"),
            "processing_status": qa_result.get("status"),
            "average_similarity": context_result.get("average_similarity"),
            "total_chunks_found": context_result.get("total_chunks_found")
        }
        
        # Prepara sources se richiesto
        sources = None
        if request.include_sources:
            sources = context_result.get("sources", [])
        
        # Salva nella cronologia chat
        await chat_manager.save_chat_message(
            document_id=request.document_id,
            question=request.question,
            answer=qa_result["answer"],
            sources=[f"Chunk {s['chunk_id']}" for s in sources] if sources else []
        )
        
        response = ChatResponse(
            success=True,
            answer=qa_result["answer"],
            question=request.question,
            document_id=request.document_id,
            timestamp=datetime.utcnow(),
            sources=sources,
            metadata=metadata
        )
        
        logger.info(f"✅ Chat completata per documento {request.document_id}")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Errore chat: {e}")
        return ChatResponse(
            success=False,
            answer="Si è verificato un errore durante l'elaborazione della tua domanda. Riprova più tardi.",
            question=request.question,
            document_id=request.document_id,
            timestamp=datetime.utcnow(),
            error=str(e)
        )

@router.get("/chat/history/{document_id}", response_model=ChatHistoryResponse)
async def get_chat_history(document_id: str, limit: int = 50):
    """
    Ottieni cronologia chat per un documento
    
    Args:
        document_id: ID del documento
        limit: Numero massimo di messaggi da restituire (default: 50)
    """
    try:
        # Verifica che il documento esista
        document_manager = get_document_manager()
        document = await document_manager.get_document(document_id)
        
        if not document:
            raise HTTPException(status_code=404, detail="Documento non trovato")
        
        # Ottieni cronologia
        chat_manager = get_chat_manager()
        messages = await chat_manager.get_chat_history(document_id, limit=limit)
        
        return ChatHistoryResponse(
            document_id=document_id,
            messages=messages,
            total_messages=len(messages)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Errore recupero cronologia: {e}")
        raise HTTPException(status_code=500, detail=f"Errore interno: {str(e)}")

@router.delete("/chat/history/{document_id}")
async def clear_chat_history(document_id: str):
    """Cancella cronologia chat per un documento"""
    try:
        # Verifica che il documento esista
        document_manager = get_document_manager()
        document = await document_manager.get_document(document_id)
        
        if not document:
            raise HTTPException(status_code=404, detail="Documento non trovato")
        
        # Elimina cronologia dal database
        from app.db.mongo import get_database
        database = await get_database()
        result = await database.chat_history.delete_many({"document_id": document_id})
        
        return {
            "success": True,
            "message": f"Cronologia cancellata: {result.deleted_count} messaggi eliminati"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Errore cancellazione cronologia: {e}")
        raise HTTPException(status_code=500, detail=f"Errore interno: {str(e)}")

@router.post("/chat/test-similarity")
async def test_similarity_search(
    document_id: str,
    query: str,
    max_chunks: int = 5,
    similarity_threshold: float = 0.1
):
    """
    Endpoint di test per verificare la ricerca di similarità
    
    Restituisce i chunk più simili senza generare una risposta AI.
    Utile per debugging e ottimizzazione delle query.
    """
    try:
        # Verifica documento
        document_manager = get_document_manager()
        document = await document_manager.get_document(document_id)
        
        if not document:
            raise HTTPException(status_code=404, detail="Documento non trovato")
        
        # Testa ricerca similarità
        query_processor = get_query_processor()
        context_result = await query_processor.process_query(
            document_id=document_id,
            query=query,
            max_chunks=max_chunks,
            min_score=similarity_threshold
        )
        
        return {
            "query": query,
            "document_id": document_id,
            "document_name": document['filename'],
            "success": context_result['success'],
            "chunks_found": context_result.get('total_chunks_found', 0),
            "average_similarity": context_result.get('average_similarity'),
            "sources": context_result.get('sources', []),
            "contexts_preview": [
                ctx[:200] + "..." if len(ctx) > 200 else ctx 
                for ctx in context_result.get('contexts', [])
            ]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Errore test similarità: {e}")
        raise HTTPException(status_code=500, detail=f"Errore interno: {str(e)}")

@router.get("/chat/stats/{document_id}")
async def get_chat_stats(document_id: str):
    """Ottieni statistiche chat per un documento"""
    try:
        # Verifica documento
        document_manager = get_document_manager()
        document = await document_manager.get_document(document_id)
        
        if not document:
            raise HTTPException(status_code=404, detail="Documento non trovato")
        
        # Conta messaggi nella cronologia
        from app.db.mongo import get_database
        database = await get_database()
        total_messages = await database.chat_history.count_documents(
            {"document_id": document_id}
        )
        
        # Ottieni statistiche indice
        from app.services.indexing import get_document_indexer
        document_indexer = get_document_indexer()
        index_stats = await document_indexer.get_index_stats(document_id)
        
        return {
            "document_id": document_id,
            "document_name": document['filename'],
            "total_chat_messages": total_messages,
            "chunk_count": document.get("chunk_count", 0),
            "index_status": index_stats.get("status"),
            "embedding_dimension": index_stats.get("embedding_dimension"),
            "upload_date": document.get("upload_date")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Errore statistiche chat: {e}")
        raise HTTPException(status_code=500, detail=f"Errore interno: {str(e)}")