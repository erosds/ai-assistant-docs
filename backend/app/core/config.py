# backend/app/core/config.py
from pydantic_settings import BaseSettings
from typing import Optional
import os

class Settings(BaseSettings):
    # Database
    mongodb_url: str = "mongodb://localhost:27017"
    database_name: str = "ai_docs_assistant"
    
    # Ollama - Ottimizzato per M1 Pro 16GB
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5:14b"  # Scelta ottimale per M1 Pro
    
    # Opzioni Ollama ottimizzate per M1 - CORRETTE
    ollama_options: dict = {
        "temperature": 0.7,
        "top_p": 0.9,
        "num_predict": 2048,     # CORRETTO: usare num_predict invece di max_tokens
        "num_ctx": 4096,         # Contesto ottimale per M1
        "repeat_penalty": 1.1,
        "num_thread": 8,         # Ottimizzato per M1 Pro (8 core)
    }
    
    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    
    # Storage
    upload_dir: str = "../data/uploads"
    faiss_index_dir: str = "../data/faiss_indexes"
    
    # App Settings - Ottimizzati per M1
    max_file_size: int = 30  # Ridotto a 30MB per velocità
    chunk_size: int = 800    # Ridotto per migliori prestazioni
    chunk_overlap: int = 150
    
    # Embedding model - Leggero per M1
    embedding_model: str = "all-MiniLM-L6-v2"  # Veloce su M1
    
    class Config:
        env_file = ".env"
        case_sensitive = False

# Crea istanza globale delle impostazioni
settings = Settings()

# Funzione per ottimizzare Ollama su M1 - CORRETTA
def get_m1_optimized_options():
    """Opzioni Ollama ottimizzate per Apple M1"""
    return {
        "temperature": 0.7,
        "top_p": 0.9,
        "num_predict": 2048,     # CORRETTO: usare num_predict
        "num_ctx": 4096,
        "repeat_penalty": 1.1,
        "num_thread": 8,         # M1 Pro ha 8 core performance
        "num_gpu": 0,            # Disabilita GPU esplicita, M1 gestisce automaticamente
        "main_gpu": 0,
        "low_vram": True,        # Ottimizzazione memoria
    }

# Crea le cartelle necessarie se non esistono
def create_directories():
    """Crea le cartelle necessarie per l'applicazione"""
    dirs = [
        settings.upload_dir,
        settings.faiss_index_dir
    ]
    
    for dir_path in dirs:
        os.makedirs(dir_path, exist_ok=True)
        print(f"✓ Cartella creata/verificata: {dir_path}")

if __name__ == "__main__":
    create_directories()