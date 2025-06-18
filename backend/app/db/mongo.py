from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import ConnectionFailure
from app.core.config import settings
import asyncio
from datetime import datetime
from typing import Optional, Dict, List
import logging

logger = logging.getLogger(__name__)

class MongoDB:
    client: Optional[AsyncIOMotorClient] = None
    database = None

# Istanza globale
mongodb = MongoDB()

async def connect_to_mongo():
    """Connetti a MongoDB"""
    try:
        mongodb.client = AsyncIOMotorClient(settings.mongodb_url)
        mongodb.database = mongodb.client[settings.database_name]
        
        # Test connessione
        await mongodb.client.admin.command('ping')
        logger.info("✅ Connesso a MongoDB")
        
    except ConnectionFailure as e:
        logger.error(f"❌ Errore connessione MongoDB: {e}")
        raise

async def close_mongo_connection():
    """Chiudi connessione MongoDB"""
    if mongodb.client:
        mongodb.client.close()
        logger.info("🔌 Connessione MongoDB chiusa")

async def init_database():
    """Inizializza database e collezioni"""
    await connect_to_mongo()
    
    # Crea indici per le collezioni
    try:
        # Collezione documenti
        await mongodb.database.documents.create_index("filename", unique=True)
        await mongodb.database.documents.create_index("upload_date")
        
        # Collezione chat history
        await mongodb.database.chat_history.create_index([("document_id", 1), ("timestamp", -1)])
        
        logger.info("✅ Database e indici inizializzati")
        
    except Exception as e:
        logger.warning(f"⚠️ Errore creazione indici: {e}")

class DocumentManager:
    """Gestisce operazioni sui documenti"""
    
    @staticmethod
    async def create_document(filename: str, file_path: str, content_preview: str) -> str:
        """Crea un nuovo documento nel database"""
        document = {
            "filename": filename,
            "file_path": file_path,
            "content_preview": content_preview,
            "upload_date": datetime.utcnow(),
            "status": "processed",
            "chunk_count": 0,
            "chat_count": 0
        }
        
        result = await mongodb.database.documents.insert_one(document)
        return str(result.inserted_id)
    
    @staticmethod
    async def get_document(document_id: str) -> Optional[Dict]:
        """Recupera un documento per ID"""
        from bson import ObjectId
        try:
            return await mongodb.database.documents.find_one({"_id": ObjectId(document_id)})
        except:
            return None
    
    @staticmethod
    async def get_all_documents() -> List[Dict]:
        """Recupera tutti i documenti"""
        cursor = mongodb.database.documents.find().sort("upload_date", -1)
        documents = await cursor.to_list(length=100)
        
        # Converti ObjectId in string
        for doc in documents:
            doc["_id"] = str(doc["_id"])
        
        return documents
    
    @staticmethod
    async def update_document_stats(document_id: str, chunk_count: int = None, chat_count: int = None):
        """Aggiorna statistiche documento"""
        from bson import ObjectId
        update_data = {}

        if chunk_count is not None:
            update_data.setdefault("$set", {})["chunk_count"] = chunk_count
        if chat_count is not None:
            update_data.setdefault("$inc", {})["chat_count"] = 1

        if update_data:
            await mongodb.database.documents.update_one(
                {"_id": ObjectId(document_id)},
                update_data
            )

    
    @staticmethod
    async def delete_document(document_id: str) -> bool:
        """Elimina un documento"""
        from bson import ObjectId
        try:
            result = await mongodb.database.documents.delete_one({"_id": ObjectId(document_id)})
            
            # Elimina anche la chat history
            await mongodb.database.chat_history.delete_many({"document_id": document_id})
            
            return result.deleted_count > 0
        except:
            return False

class ChatManager:
    """Gestisce la cronologia delle chat"""
    
    @staticmethod
    async def save_chat_message(document_id: str, question: str, answer: str, sources: List[str] = None):
        """Salva un messaggio di chat"""
        message = {
            "document_id": document_id,
            "question": question,
            "answer": answer,
            "sources": sources or [],
            "timestamp": datetime.utcnow()
        }
        
        await mongodb.database.chat_history.insert_one(message)
        
        # Aggiorna contatore chat del documento
        await DocumentManager.update_document_stats(document_id, chat_count=1)
    
    @staticmethod
    async def get_chat_history(document_id: str, limit: int = 50) -> List[Dict]:
        """Recupera cronologia chat per un documento"""
        cursor = mongodb.database.chat_history.find(
            {"document_id": document_id}
        ).sort("timestamp", -1).limit(limit)
        
        messages = await cursor.to_list(length=limit)
        
        # Converti ObjectId in string e ordina cronologicamente
        for msg in messages:
            msg["_id"] = str(msg["_id"])
        
        return list(reversed(messages))  # Ordine cronologico (più vecchi prima)

# Helper functions per accesso rapido
async def get_database():
    """Ottieni istanza database"""
    return mongodb.database

def get_document_manager():
    """Ottieni DocumentManager"""
    return DocumentManager()

def get_chat_manager():
    """Ottieni ChatManager"""
    return ChatManager()