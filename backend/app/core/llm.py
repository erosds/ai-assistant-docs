import ollama
import asyncio
from typing import List, Dict, Optional
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

class OllamaClient:
    """Client per comunicare con Ollama"""
    
    def __init__(self):
        self.client = ollama.Client(host=settings.ollama_base_url)
        self.model = settings.ollama_model
        
    async def check_model_availability(self) -> bool:
        """Verifica se il modello è disponibile"""
        try:
            models = await asyncio.to_thread(self.client.list)
            logger.info(f"Modelli disponibili da Ollama: {models}")  # DEBUG

            # Se models è un dict con chiave 'models'
            if isinstance(models, dict) and 'models' in models:
                model_list = models['models']
            # Se models ha attributo .models
            elif hasattr(models, 'models'):
                model_list = models.models
            else:
                model_list = models

            # Ora estrai i nomi dei modelli
            available_models = []
            for m in model_list:
                if isinstance(m, dict) and 'model' in m:
                    available_models.append(m['model'])
                elif hasattr(m, 'model'):
                    available_models.append(m.model)
                elif isinstance(m, str):
                    available_models.append(m)
                # aggiungi altri casi se necessario

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
        """Genera risposta usando Ollama"""
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
            
            # Chiamata asincrona a Ollama
            response = await asyncio.to_thread(
                self.client.chat,
                model=self.model,
                messages=messages,
                options={
                    "temperature": 0.7,
                    "top_p": 0.9,
                    "max_tokens": 2000
                }
            )
            
            return response['message']['content']
            
        except Exception as e:
            logger.error(f"❌ Errore generazione risposta Ollama: {e}")
            raise Exception(f"Errore LLM: {str(e)}")

class RAGPromptBuilder:
    """Costruisce prompt per RAG (Retrieval-Augmented Generation)"""
    
    @staticmethod
    def build_system_prompt() -> str:
        """Prompt di sistema per l'AI assistant"""
        return """Sei un assistente AI specializzato nell'analisi di documenti. 

ISTRUZIONI:
- Rispondi SOLO basandoti sui contenuti forniti nei documenti
- Se la risposta non è presente nei documenti, di' chiaramente che non hai informazioni sufficienti
- Cita sempre le parti specifiche del documento da cui prendi le informazioni
- Mantieni un tono professionale e preciso
- Se possibile, fornisci citazioni dirette tra virgolette
- Non inventare informazioni che non sono presenti nei documenti

FORMATO RISPOSTA:
- Inizia con una risposta diretta alla domanda
- Fornisci dettagli specifici dal documento
- Concludi con riferimenti alle sezioni/pagine quando disponibili"""

    @staticmethod
    def build_user_prompt(question: str, contexts: List[str], document_name: str) -> str:
        """Costruisce prompt utente con contesto"""
        context_text = "\n\n".join([f"SEZIONE {i+1}:\n{ctx}" for i, ctx in enumerate(contexts)])
        
        prompt = f"""DOCUMENTO: {document_name}

CONTENUTO RILEVANTE:
{context_text}

DOMANDA: {question}

Rispondi alla domanda basandoti esclusivamente sui contenuti forniti sopra dal documento "{document_name}"."""
        
        return prompt

class DocumentQA:
    """Gestisce Question-Answering sui documenti"""
    
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
        
        Args:
            question: Domanda dell'utente
            contexts: Lista di contesti rilevanti dal documento
            document_name: Nome del documento
            chat_history: Cronologia chat precedente (opzionale)
            
        Returns:
            Dict con risposta e metadati
        """
        try:
            # Costruisci prompt
            system_prompt = self.prompt_builder.build_system_prompt()
            
            # Aggiungi contesto della chat history se disponibile
            if chat_history and len(chat_history) > 0:
                recent_context = "\n".join([
                    f"DOMANDA PRECEDENTE: {msg['question']}\nRISPOSTA: {msg['answer']}"
                    for msg in chat_history[-3:]  # Ultimi 3 messaggi
                ])
                system_prompt += f"\n\nCONTESTO CONVERSAZIONE PRECEDENTE:\n{recent_context}"
            
            user_prompt = self.prompt_builder.build_user_prompt(
                question, contexts, document_name
            )
            
            # Genera risposta
            response = await self.ollama_client.generate_response(
                user_prompt, system_prompt
            )
            
            return {
                "answer": response,
                "model": self.ollama_client.model,
                "context_count": len(contexts),
                "status": "success"
            }
            
        except Exception as e:
            logger.error(f"❌ Errore QA: {e}")
            return {
                "answer": f"Spiacente, si è verificato un errore durante l'elaborazione della domanda: {str(e)}",
                "model": self.ollama_client.model,
                "context_count": len(contexts),
                "status": "error"
            }

# Istanza globale
document_qa = DocumentQA()

async def initialize_llm():
    """Inizializza il sistema LLM"""
    logger.info("🤖 Inizializzazione sistema LLM...")
    success = await document_qa.initialize()
    if success:
        logger.info("✅ Sistema LLM inizializzato con successo")
    else:
        logger.error("❌ Fallita inizializzazione sistema LLM")
    return success

def get_document_qa() -> DocumentQA:
    """Ottieni istanza DocumentQA"""
    return document_qa