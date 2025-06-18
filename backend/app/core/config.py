from pydantic_settings import BaseSettings
from typing import Optional
import os

class Settings(BaseSettings):
    # Database
    mongodb_url: str = "mongodb://localhost:27017"
    database_name: str = "ai_docs_assistant"
    
    # Ollama
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3:latest"
    
    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    
    # Storage
    upload_dir: str = "../data/uploads"
    faiss_index_dir: str = "../data/faiss_indexes"
    
    # App Settings
    max_file_size: int = 50  # MB
    chunk_size: int = 1000
    chunk_overlap: int = 200
    
    # Embedding model
    embedding_model: str = "all-MiniLM-L6-v2"
    
    class Config:
        env_file = ".env"
        case_sensitive = False

# Crea istanza globale delle impostazioni
settings = Settings()

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