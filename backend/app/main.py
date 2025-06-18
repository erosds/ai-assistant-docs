from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
import asyncio
from contextlib import asynccontextmanager

from app.core.config import settings, create_directories
from app.db.mongo import init_database
from app.core.llm import initialize_llm
from app.services.indexing import initialize_indexing_service
from app.api.routes import upload, chat, docs

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gestisce startup e shutdown dell'applicazione"""
    # Startup
    print("🚀 Avvio AI Assistant per Documenti...")
    
    # Crea cartelle necessarie
    create_directories()
    
    # Inizializza database
    await init_database()
    
    # Inizializza sistema LLM
    await initialize_llm()
    
    # Inizializza servizio indicizzazione
    await initialize_indexing_service()
    
    print("✅ Applicazione avviata con successo!")
    
    yield
    
    # Shutdown
    print("🛑 Spegnimento applicazione...")

# Crea l'app FastAPI
app = FastAPI(
    title="AI Assistant per Documenti",
    description="Un'applicazione per interrogare documenti PDF usando AI locale",
    version="1.0.0",
    lifespan=lifespan
)

# Configura CORS per il frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # React dev servers
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include le route API
app.include_router(upload.router, prefix="/api/v1", tags=["upload"])
app.include_router(chat.router, prefix="/api/v1", tags=["chat"])
app.include_router(docs.router, prefix="/api/v1", tags=["documents"])

@app.get("/")
async def root():
    """Endpoint di benvenuto"""
    return {
        "message": "AI Assistant per Documenti API",
        "version": "1.0.0",
        "status": "active",
        "docs": "/docs"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "message": "API is running"}

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True,
        log_level="info"
    )