import ollama
import asyncio
from typing import List, Dict, Optional
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

class OllamaClient:
    """Client per comunicare con Ollama - Ottimizzato per M1"""
    
    def __init__(self):
        self.client = ollama.Client(host=settings.ollama_base_url)
        self.model = settings.ollama_model
        
    async def check_model_availability(self) -> bool:
        """Verifica se il modello è disponibile"""
        try:
            models = await asyncio.to_thread(self.client.list)
            logger.info(f"Modelli disponibili da Ollama: {models}")

            # Estrai i nomi dei modelli
            if isinstance(models, dict) and 'models' in models:
                model_list = models['models']
            elif hasattr(models, 'models'):
                model_list = models.models
            else:
                model_list = models

            available_models = []
            for m in model_list:
                if isinstance(m, dict) and 'model' in m:
                    available_models.append(m['model'])
                elif hasattr(m, 'model'):
                    available_models.append(m.model)
                elif isinstance(m, str):
                    available_models.append(m)

            if self.model in available_models:
                logger.info(f"✅ Modello {self.model} disponibile")
                return True
            else:
                logger.error(f"❌ Modello {self.model} non trovato. Modelli disponibili: {available_models}")
                return False
                            
        except Exception as e:
            logger.error(f"❌ Errore controllo modelli Ollama: {e}")
            return False
    
    async def generate_response(self, prompt: str, system_prompt: str = None) -> str:
        """Genera risposta usando Ollama - Ottimizzato per M1"""
        try:
            messages = []
            
            if system_prompt:
                messages.append({
                    "role": "system",
                    "content": system_prompt
                })
            
            messages.append({
                "role": "user", 
                "content": prompt
            })
            
            # Opzioni ottimizzate per M1 Pro - CORRETTE per Ollama
            m1_options = {
                "temperature": 0.7,
                "top_p": 0.9,
                "num_predict": 2048,     # CORRETTO: usare num_predict invece di max_tokens
                "num_ctx": 4096,         # Contesto bilanciato
                "repeat_penalty": 1.1,
                "num_thread": 8,         # M1 Pro core count
                "seed": 42,              # Per riproducibilità
            }
            
            # Chiamata asincrona a Ollama
            response = await asyncio.to_thread(
                self.client.chat,
                model=self.model,
                messages=messages,
                options=m1_options
            )
            
            return response['message']['content']
            
        except Exception as e:
            logger.error(f"❌ Errore generazione risposta Ollama: {e}")
            raise Exception(f"Errore LLM: {str(e)}")

class RAGPromptBuilder:
    """Costruisce prompt per RAG - Ottimizzato per modelli M1"""
    
    @staticmethod
    def build_system_prompt() -> str:
        """Prompt di sistema ottimizzato per M1"""
        return """Sei un assistente AI specializzato nell'analisi di documenti. 

ISTRUZIONI:
- Rispondi basandoti SOLO sui contenuti forniti
- Se non hai informazioni sufficienti, dillo chiaramente
- Mantieni risposte concise ma complete
- Cita le parti specifiche del documento
- Usa un tono professionale, ma al contempo gentile e allegro

FORMATO RISPOSTA:
- Inizia con risposta diretta
- Aggiungi dettagli dal documento
- Concludi con riferimenti quando disponibili"""

    @staticmethod
    def build_user_prompt(question: str, contexts: List[str], document_name: str) -> str:
        """Costruisce prompt utente con contesto - Ottimizzato"""
        # Limita il contesto per M1 (max 3000 caratteri totali)
        max_context_length = 2500
        context_text = ""
        
        for i, ctx in enumerate(contexts):
            section = f"SEZIONE {i+1}:\n{ctx}\n\n"
            if len(context_text + section) > max_context_length:
                break
            context_text += section
        
        prompt = f"""DOCUMENTO: {document_name}

CONTENUTO RILEVANTE:
{context_text.strip()}

DOMANDA: {question}

Rispondi alla domanda basandoti sui contenuti forniti dal documento "{document_name}"."""
        
        return prompt

class DocumentQA:
    """Gestisce Question-Answering sui documenti - Ottimizzato per M1"""
    
    def __init__(self):
        self.ollama_client = OllamaClient()
        self.prompt_builder = RAGPromptBuilder()
    
    async def initialize(self) -> bool:
        """Inizializza il sistema QA"""
        return await self.ollama_client.check_model_availability()
    
    async def answer_question(
        self, 
        question: str, 
        contexts: List[str], 
        document_name: str,
        chat_history: List[Dict] = None
    ) -> Dict[str, str]:
        """
        Risponde a una domanda usando il contesto fornito
        """
        try:
            # Sistema prompt ottimizzato
            system_prompt = self.prompt_builder.build_system_prompt()
            
            # Aggiungi contesto chat limitato per M1
            if chat_history and len(chat_history) > 0:
                recent_context = "\n".join([
                    f"Q: {msg['question']}\nR: {msg['answer'][:200]}..."  # Limita lunghezza
                    for msg in chat_history[-2:]  # Solo ultimi 2 messaggi
                ])
                system_prompt += f"\n\nCONTESTO PRECEDENTE:\n{recent_context}"
            
            # Limita contesti per prestazioni M1
            limited_contexts = contexts[:3]  # Max 3 contesti
            
            user_prompt = self.prompt_builder.build_user_prompt(
                question, limited_contexts, document_name
            )
            
            # Genera risposta
            response = await self.ollama_client.generate_response(
                user_prompt, system_prompt
            )
            
            return {
                "answer": response,
                "model": self.ollama_client.model,
                "context_count": len(limited_contexts),
                "status": "success"
            }
            
        except Exception as e:
            logger.error(f"❌ Errore QA: {e}")
            return {
                "answer": f"Errore durante l'elaborazione: {str(e)}",
                "model": self.ollama_client.model,
                "context_count": len(contexts),
                "status": "error"
            }

# Istanza globale
document_qa = DocumentQA()

async def initialize_llm():
    """Inizializza il sistema LLM"""
    logger.info("🤖 Inizializzazione sistema LLM per M1...")
    success = await document_qa.initialize()
    if success:
        logger.info("✅ Sistema LLM inizializzato con successo su M1")
    else:
        logger.error("❌ Fallita inizializzazione sistema LLM")
    return success

def get_document_qa() -> DocumentQA:
    """Ottieni istanza DocumentQA"""
    return document_qa