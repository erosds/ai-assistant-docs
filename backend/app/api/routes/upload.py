from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
import os
import shutil
from pathlib import Path
from typing import Dict, Any
import logging
import traceback

from bson import ObjectId

from app.core.config import settings
from app.services.parsing import get_pdf_parser
from app.services.indexing import get_document_indexer
from app.db.mongo import get_document_manager

logger = logging.getLogger(__name__)

router = APIRouter()

# Tipi di file supportati
ALLOWED_EXTENSIONS = {'.pdf'}
MAX_FILE_SIZE = settings.max_file_size * 1024 * 1024  # Converti in bytes

async def process_document_background(file_path: str, document_id: str, filename: str):
    """Processa documento in background dopo l'upload"""
    try:
        logger.info(f"🔄 [BACKGROUND] Inizio processing per {filename} con ID {document_id}")
        logger.info(f"🔄 [BACKGROUND] File path: {file_path}")
        
        # Verifica che il file esista
        if not os.path.exists(file_path):
            logger.error(f"❌ [BACKGROUND] File non trovato: {file_path}")
            return
        
        logger.info(f"📁 [BACKGROUND] File size: {os.path.getsize(file_path)} bytes")

        # 1. Parsing PDF
        logger.info(f"📄 [BACKGROUND] Inizio parsing PDF...")
        pdf_parser = get_pdf_parser()
        parsing_result = await pdf_parser.extract_text_from_pdf(file_path)

        if not parsing_result['success']:
            logger.error(f"❌ [BACKGROUND] Errore parsing PDF: {parsing_result.get('error')}")
            return
        
        logger.info(f"✅ [BACKGROUND] Parsing completato. Caratteri estratti: {len(parsing_result['full_text'])}")

        # 2. Indicizzazione
        logger.info(f"🧠 [BACKGROUND] Inizio indicizzazione...")
        document_indexer = get_document_indexer()
        
        # Verifica che il servizio di indicizzazione sia inizializzato
        if not hasattr(document_indexer, 'embedding_service') or document_indexer.embedding_service.model is None:
            logger.error(f"❌ [BACKGROUND] Servizio di indicizzazione non inizializzato!")
            return
        
        indexing_result = await document_indexer.index_document(
            document_id=document_id,
            text=parsing_result['full_text'],
            document_name=filename
        )

        if not indexing_result['success']:
            logger.error(f"❌ [BACKGROUND] Errore indicizzazione: {indexing_result.get('error')}")
            return
        
        logger.info(f"✅ [BACKGROUND] Indicizzazione completata. Chunk generati: {indexing_result['chunks_count']}")

        # 3. Aggiorna database con statistiche
        logger.info(f"💾 [BACKGROUND] Aggiornamento statistiche database...")
        document_manager = get_document_manager()
        await document_manager.update_document_stats(
            document_id=document_id,
            chunk_count=indexing_result['chunks_count']
        )

        logger.info(f"✅ [BACKGROUND] Processing completato per {filename}")

    except Exception as e:
        logger.error(f"❌ [BACKGROUND] Errore processing background: {e}")
        logger.error(f"❌ [BACKGROUND] Traceback: {traceback.format_exc()}")

@router.post("/upload", response_model=Dict[str, Any])
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    """
    Upload e processa un documento PDF

    Returns:
        Dict con informazioni del documento uploadato
    """
    try:
        logger.info(f"📤 [UPLOAD] Inizio upload per file: {file.filename}")
        
        # Validazioni
        if not file.filename:
            raise HTTPException(status_code=400, detail="Nome file mancante")

        # Controlla estensione
        file_extension = Path(file.filename).suffix.lower()
        if file_extension not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Tipo file non supportato. Supportati: {', '.join(ALLOWED_EXTENSIONS)}"
            )

        # Controlla dimensione file (file.size può essere None in UploadFile)
        if file.size and file.size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File troppo grande. Massimo: {settings.max_file_size}MB"
            )

        # Genera ObjectId univoco e percorso
        document_oid = ObjectId()
        document_id = str(document_oid)
        safe_filename = f"{document_id}_{file.filename}"
        file_path = os.path.join(settings.upload_dir, safe_filename)

        logger.info(f"📤 [UPLOAD] Document ID generato: {document_id}")
        logger.info(f"📤 [UPLOAD] File path: {file_path}")

        # Assicurati che la cartella upload esista
        os.makedirs(settings.upload_dir, exist_ok=True)

        # Salva file
        logger.info(f"💾 [UPLOAD] Salvando file su disco...")
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        logger.info(f"💾 [UPLOAD] File salvato. Size: {os.path.getsize(file_path)} bytes")

        # Parsing veloce per anteprima
        logger.info(f"📄 [UPLOAD] Parsing veloce per anteprima...")
        pdf_parser = get_pdf_parser()
        parsing_result = await pdf_parser.extract_text_from_pdf(file_path)

        if not parsing_result['success']:
            # Rimuovi file se parsing fallisce
            os.remove(file_path)
            raise HTTPException(
                status_code=400,
                detail=f"Errore parsing PDF: {parsing_result.get('error', 'Errore sconosciuto')}"
            )

        # Genera anteprima
        content_preview = pdf_parser.get_content_preview(parsing_result['full_text'])
        logger.info(f"📄 [UPLOAD] Anteprima generata: {len(content_preview)} caratteri")

        # Salva nel database
        logger.info(f"💾 [UPLOAD] Salvando nel database...")
        document_manager = get_document_manager()
        created_id = await document_manager.create_document(
            filename=file.filename,
            file_path=file_path,
            content_preview=content_preview
        )
        
        logger.info(f"💾 [UPLOAD] Documento salvato nel database con ID: {created_id}")

        # IMPORTANTE: verifica che il servizio di indicizzazione sia pronto
        document_indexer = get_document_indexer()
        if not hasattr(document_indexer, 'embedding_service'):
            logger.error(f"❌ [UPLOAD] Servizio di indicizzazione non disponibile!")
            raise HTTPException(status_code=500, detail="Servizio di indicizzazione non disponibile")

        # Avvia processing in background
        logger.info(f"🚀 [UPLOAD] Avviando processing in background...")
        background_tasks.add_task(
            process_document_background,
            file_path=file_path,
            document_id=created_id,
            filename=file.filename
        )

        # Risposta immediata
        response = {
            "success": True,
            "message": "Upload completato. Processing in corso...",
            "document": {
                "id": created_id,
                "filename": file.filename,
                "size_bytes": file.size,
                "content_preview": content_preview,
                "statistics": parsing_result['statistics'],
                "metadata": parsing_result['metadata']
            }
        }

        logger.info(f"✅ [UPLOAD] Upload completato: {file.filename} ({created_id})")
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [UPLOAD] Errore upload: {e}")
        logger.error(f"❌ [UPLOAD] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Errore interno: {str(e)}")

# Gli altri endpoint rimangono uguali...
@router.get("/upload/status/{document_id}")
async def get_upload_status(document_id: str):
    """Controlla lo status del processing di un documento"""
    try:
        logger.info(f"🔍 [STATUS] Controllo status per documento: {document_id}")
        
        document_manager = get_document_manager()
        document = await document_manager.get_document(document_id)

        if not document:
            logger.warning(f"⚠️ [STATUS] Documento non trovato: {document_id}")
            raise HTTPException(status_code=404, detail="Documento non trovato")

        document_indexer = get_document_indexer()
        index_stats = await document_indexer.get_index_stats(document_id)

        processing_complete = index_stats.get("status") == "loaded"
        
        logger.info(f"🔍 [STATUS] Status documento {document_id}: {'completo' if processing_complete else 'in elaborazione'}")
        logger.info(f"🔍 [STATUS] Index stats: {index_stats}")

        return {
            "document_id": document_id,
            "filename": document["filename"],
            "upload_date": document.get("upload_date"),
            "processing_complete": processing_complete,
            "chunk_count": document.get("chunk_count", 0),
            "chat_count": document.get("chat_count", 0),
            "index_stats": index_stats
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [STATUS] Errore controllo status: {e}")
        raise HTTPException(status_code=500, detail=f"Errore interno: {str(e)}")

@router.delete("/upload/{document_id}")
async def delete_document(document_id: str):
    """Elimina un documento e tutti i suoi dati associati"""
    try:
        document_manager = get_document_manager()
        document = await document_manager.get_document(document_id)

        if not document:
            raise HTTPException(status_code=404, detail="Documento non trovato")

        # Elimina file fisico
        file_path = document.get("file_path")
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
            logger.info(f"🗑️ File eliminato: {file_path}")

        # Elimina indice vettoriale
        document_indexer = get_document_indexer()
        await document_indexer.delete_document_index(document_id)

        # Elimina dal database
        success = await document_manager.delete_document(document_id)

        if success:
            return {
                "success": True,
                "message": f"Documento '{document['filename']}' eliminato con successo"
            }
        else:
            raise HTTPException(status_code=500, detail="Errore eliminazione dal database")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Errore eliminazione documento: {e}")
        raise HTTPException(status_code=500, detail=f"Errore interno: {str(e)}")

@router.get("/upload/validate")
async def validate_upload_settings():
    """Endpoint per validare le impostazioni di upload"""
    return {
        "max_file_size_mb": settings.max_file_size,
        "allowed_extensions": list(ALLOWED_EXTENSIONS),
        "upload_directory": settings.upload_dir,
        "chunk_size": settings.chunk_size,
        "chunk_overlap": settings.chunk_overlap
    }