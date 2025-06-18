from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any, Union
import logging
import ollama
from app.core.config import settings
from app.core.llm import get_document_qa
import asyncio
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter()

class ModelInfo(BaseModel):
    """Schema per informazioni modello"""
    name: str
    size: Optional[Union[str, int]] = None
    modified_at: Optional[Union[str, datetime]] = None
    digest: Optional[str] = None
    details: Optional[Union[Dict, Any]] = None

    class Config:
        # Permette conversioni automatiche
        str_strip_whitespace = True

class ModelsResponse(BaseModel):
    """Schema per risposta lista modelli"""
    available_models: List[ModelInfo]
    current_model: str
    default_model: str

class ChangeModelRequest(BaseModel):
    """Schema per richiesta cambio modello"""
    model_name: str

@router.get("/models", response_model=ModelsResponse)
async def get_available_models():
    """
    Ottieni lista dei modelli disponibili in Ollama
    """
    try:
        # Ottieni lista modelli da Ollama
        client = ollama.Client(host=settings.ollama_base_url)
        models_response = await asyncio.to_thread(client.list)
        
        # Estrai lista modelli
        if isinstance(models_response, dict) and 'models' in models_response:
            model_list = models_response['models']
        elif hasattr(models_response, 'models'):
            model_list = models_response.models
        else:
            model_list = models_response

        available_models = []
        for model in model_list:
            try:
                # Estrai i dati dal modello in modo sicuro
                model_data = {}
                
                if isinstance(model, dict):
                    model_data = {
                        'name': model.get('model', model.get('name', 'Unknown')),
                        'size': model.get('size'),
                        'modified_at': model.get('modified_at'),
                        'digest': model.get('digest'),
                        'details': model.get('details')
                    }
                elif hasattr(model, 'model'):
                    model_data = {
                        'name': model.model,
                        'size': getattr(model, 'size', None),
                        'modified_at': getattr(model, 'modified_at', None),
                        'digest': getattr(model, 'digest', None),
                        'details': getattr(model, 'details', None)
                    }
                else:
                    # Fallback se è solo una stringa
                    model_data = {'name': str(model)}

                # Pre-processa i dati prima di creare il modello Pydantic
                if model_data.get('size') and isinstance(model_data['size'], int):
                    size_bytes = model_data['size']
                    if size_bytes > 1024 * 1024 * 1024:
                        model_data['size'] = f"{size_bytes / (1024 * 1024 * 1024):.1f}GB"
                    elif size_bytes > 1024 * 1024:
                        model_data['size'] = f"{size_bytes / (1024 * 1024):.1f}MB"
                    else:
                        model_data['size'] = f"{size_bytes} bytes"

                if model_data.get('modified_at') and hasattr(model_data['modified_at'], 'isoformat'):
                    model_data['modified_at'] = model_data['modified_at'].isoformat()

                if model_data.get('details') and not isinstance(model_data['details'], dict):
                    try:
                        if hasattr(model_data['details'], '__dict__'):
                            model_data['details'] = model_data['details'].__dict__
                        else:
                            model_data['details'] = {"info": str(model_data['details'])}
                    except:
                        model_data['details'] = None

                model_info = ModelInfo(**model_data)
                available_models.append(model_info)
                
            except Exception as e:
                logger.warning(f"Errore processing modello {model}: {e}")
                # Aggiungi almeno il nome se possibile
                try:
                    name = model.get('model', model.get('name')) if isinstance(model, dict) else getattr(model, 'model', str(model))
                    available_models.append(ModelInfo(name=name))
                except:
                    continue

        # Ottieni modello corrente
        document_qa = get_document_qa()
        current_model = document_qa.ollama_client.model

        return ModelsResponse(
            available_models=available_models,
            current_model=current_model,
            default_model=settings.ollama_model
        )

    except Exception as e:
        logger.error(f"❌ Errore recupero modelli: {e}")
        raise HTTPException(status_code=500, detail=f"Errore recupero modelli: {str(e)}")

@router.post("/models/change")
async def change_current_model(request: ChangeModelRequest):
    """
    Cambia il modello corrente per le chat
    """
    try:
        # Verifica che il modello sia disponibile
        client = ollama.Client(host=settings.ollama_base_url)
        models_response = await asyncio.to_thread(client.list)
        
        # Estrai lista modelli
        if isinstance(models_response, dict) and 'models' in models_response:
            model_list = models_response['models']
        elif hasattr(models_response, 'models'):
            model_list = models_response.models
        else:
            model_list = models_response

        available_model_names = []
        for model in model_list:
            if isinstance(model, dict):
                available_model_names.append(model.get('model', model.get('name', '')))
            elif hasattr(model, 'model'):
                available_model_names.append(model.model)
            else:
                available_model_names.append(str(model))

        if request.model_name not in available_model_names:
            raise HTTPException(
                status_code=400, 
                detail=f"Modello '{request.model_name}' non disponibile. Modelli disponibili: {available_model_names}"
            )

        # Cambia modello nel DocumentQA
        document_qa = get_document_qa()
        old_model = document_qa.ollama_client.model
        document_qa.ollama_client.model = request.model_name

        # Verifica che il nuovo modello funzioni
        try:
            test_response = await document_qa.ollama_client.generate_response(
                "test", "Rispondi solo con 'OK'"
            )
            logger.info(f"✅ Modello cambiato da {old_model} a {request.model_name}")
        except Exception as e:
            # Ripristina modello precedente se il test fallisce
            document_qa.ollama_client.model = old_model
            raise HTTPException(
                status_code=500,
                detail=f"Errore nel testare il nuovo modello: {str(e)}"
            )

        return {
            "success": True,
            "message": f"Modello cambiato da '{old_model}' a '{request.model_name}'",
            "previous_model": old_model,
            "current_model": request.model_name
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Errore cambio modello: {e}")
        raise HTTPException(status_code=500, detail=f"Errore interno: {str(e)}")

@router.get("/models/current")
async def get_current_model():
    """Ottieni il modello attualmente in uso"""
    try:
        document_qa = get_document_qa()
        return {
            "current_model": document_qa.ollama_client.model,
            "default_model": settings.ollama_model
        }
    except Exception as e:
        logger.error(f"❌ Errore recupero modello corrente: {e}")
        raise HTTPException(status_code=500, detail=f"Errore interno: {str(e)}")

@router.post("/models/test")
async def test_model(request: ChangeModelRequest):
    """
    Testa un modello senza cambiare quello corrente
    """
    try:
        # Crea un client temporaneo con il modello da testare
        client = ollama.Client(host=settings.ollama_base_url)
        
        test_response = await asyncio.to_thread(
            client.chat,
            model=request.model_name,
            messages=[{"role": "user", "content": "Rispondi solo con 'OK' per confermare che funzioni."}],
            options={"temperature": 0.1, "num_predict": 10}  # Cambiato da max_tokens a num_predict
        )

        return {
            "success": True,
            "model": request.model_name,
            "test_response": test_response['message']['content'],
            "message": f"Modello '{request.model_name}' testato con successo"
        }

    except Exception as e:
        logger.error(f"❌ Errore test modello {request.model_name}: {e}")
        return {
            "success": False,
            "model": request.model_name,
            "error": str(e),
            "message": f"Errore nel testare il modello '{request.model_name}'"
        }