# AI Assistant per Documenti

Un'applicazione full-stack che permette di caricare documenti PDF e interrogarli tramite chat usando intelligenza artificiale locale.

## 🚀 Caratteristiche

- **Upload PDF**: Drag & drop per caricare documenti PDF
- **Chat AI**: Interfaccia conversazionale per interrogare i documenti
- **AI Locale**: Usa Ollama per LLM completamente locale
- **Ricerca Semantica**: Embedding e similarity search con FAISS
- **Gestione Documenti**: Lista, visualizza e gestisci i tuoi documenti
- **Responsive**: Interfaccia ottimizzata per desktop e mobile

## 🛠️ Stack Tecnologico

### Backend
- **FastAPI**: Framework web Python moderno
- **Ollama**: LLM locale (llama3, mistral, ecc.)
- **LangChain**: Orchestrazione AI
- **sentence-transformers**: Embedding semantici
- **FAISS**: Ricerca vettoriale
- **PyMuPDF**: Parsing PDF
- **MongoDB**: Database per metadati e chat

### Frontend
- **React 18**: Framework frontend
- **Vite**: Build tool veloce
- **Tailwind CSS**: Styling moderno
- **Axios**: Client HTTP
- **React Dropzone**: Upload drag & drop

## 📋 Prerequisiti

- Python 3.10+
- Node.js 18+
- MongoDB
- Ollama

## 🚀 Installazione Rapida

### 1. Clona il repository
```bash
git clone <repository-url>
cd ai-assistant-docs
```

### 2. Setup Backend
```bash
# Crea ambiente virtuale
python -m venv venv
source venv/bin/activate  # Linux/macOS
# venv\Scripts\activate   # Windows

# Installa dipendenze
cd backend
pip install -r requirements.txt
```

### 3. Setup Frontend
```bash
cd frontend
npm install
```

### 4. Installa e configura Ollama
```bash
# Installa Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Avvia Ollama
ollama serve

# Scarica modello (in un altro terminale)
ollama pull llama3
```

### 5. Avvia MongoDB
```bash
# Ubuntu/Debian
sudo systemctl start mongod

# macOS con Homebrew
brew services start mongodb-community

# Oppure con Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### 6. Configura variabili ambiente
```bash
# Backend (.env in cartella backend)
cp backend/.env.example backend/.env

# Frontend (.env in cartella frontend)  
cp frontend/.env.example frontend/.env
```

### 7. Avvia l'applicazione
```bash
# Terminale 1: Backend
cd backend
python -m uvicorn app.main:app --reload

# Terminale 2: Frontend
cd frontend
npm run dev
```

### 8. Accedi all'applicazione
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- Documentazione API: http://localhost:8000/docs

## 🐳 Docker (Alternativo)

```bash
# Assicurati che Ollama sia in esecuzione localmente
ollama serve

# Avvia con Docker Compose
docker-compose up -d

# Accedi all'app
open http://localhost:3000
```

## 📖 Utilizzo

### 1. Carica un documento
- Trascina un file PDF nella zona di upload
- Attendi che l'elaborazione sia completata

### 2. Chatta con il documento
- Seleziona "Chat AI" o clicca su "Chat" su un documento
- Fai domande sul contenuto del documento
- Ricevi risposte basate esclusivamente sul contenuto

### 3. Gestisci documenti
- Visualizza lista documenti caricati
- Controlla statistiche e stato elaborazione
- Elimina documenti non più necessari

## 🔧 Configurazione

### Backend (.env)
```bash
# Database
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=ai_docs_assistant

# Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3

# Storage
UPLOAD_DIR=../data/uploads
FAISS_INDEX_DIR=../data/faiss_indexes
MAX_FILE_SIZE=50  # MB
```

### Frontend (.env)
```bash
VITE_API_BASE_URL=http://localhost:8000
```

## 📁 Struttura Progetto

```
ai-assistant-docs/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── api/routes/     # Endpoint API
│   │   ├── core/           # Configurazione
│   │   ├── db/             # Database e vector store
│   │   └── services/       # Logica business
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # Componenti React
│   │   ├── api/           # Client API
│   │   └── App.jsx
│   ├── package.json
│   └── Dockerfile
├── data/                  # Storage locale
│   ├── uploads/          # PDF caricati
│   └── faiss_indexes/    # Indici vettoriali
├── docker-compose.yml
└── README.md
```

## 🔍 API Endpoints

### Upload
- `POST /api/v1/upload` - Carica documento
- `GET /api/v1/upload/status/{id}` - Status elaborazione
- `DELETE /api/v1/upload/{id}` - Elimina documento

### Chat
- `POST /api/v1/chat` - Invia messaggio
- `GET /api/v1/chat/history/{id}` - Cronologia chat
- `DELETE /api/v1/chat/history/{id}` - Cancella cronologia

### Documenti
- `GET /api/v1/documents` - Lista documenti
- `GET /api/v1/documents/{id}` - Dettagli documento
- `GET /api/v1/documents/stats/overview` - Statistiche generali

## 🧪 Test

```bash
# Test backend
cd backend
python -m pytest

# Test frontend
cd frontend
npm test
```

## 🚨 Troubleshooting

### Ollama non risponde
```bash
# Verifica che Ollama sia in esecuzione
ollama list

# Riavvia se necessario
pkill ollama
ollama serve
```

### Errore MongoDB
```bash
# Verifica status MongoDB
sudo systemctl status mongod

# Avvia se necessario
sudo systemctl start mongod
```

### Dipendenze Python
```bash
# Aggiorna pip
pip install --upgrade pip

# Reinstalla dipendenze
pip install -r requirements.txt --force-reinstall
```

## 🤝 Contribuire

1. Fork del progetto
2. Crea feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit modifiche (`git commit -m 'Add AmazingFeature'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Apri una Pull Request

## 📄 Licenza

Questo progetto è distribuito sotto licenza MIT. Vedi `LICENSE` per dettagli.

## 🎯 Roadmap

- [ ] Supporto per più formati (DOCX, TXT)
- [ ] Autenticazione utenti
- [ ] Chat multi-documento
- [ ] Export conversazioni
- [ ] API key per modelli cloud
- [ ] Themes dark/light
- [ ] Ricerca full-text
- [ ] Backup/restore documenti

## 📊 Performance

### Modelli LLM consigliati
- **llama3:8b** - Buon compromesso qualità/velocità
- **mistral:7b** - Veloce, ottimo per testi brevi
- **codellama:7b** - Specializzato per codice

### Ottimizzazione
- Chunk size: 1000 caratteri (ottimale per most cases)
- Similarity threshold: 0.1 (bilanciato)
- Max chunks per query: 5 (performance vs accuracy)

## 🔐 Sicurezza

- ✅ Validazione file upload
- ✅ Sanitizzazione input utente
- ✅ Rate limiting
- ✅ CORS configurato
- ✅ Processing sandboxed
- ⚠️ HTTPS da configurare in produzione

## 📞 Supporto

Per problemi o domande:
1. Controlla la [documentazione](docs/)
2. Cerca negli [issues esistenti](issues)
3. Apri un [nuovo issue](issues/new)

---

**Nota**: Questa applicazione elabora documenti completamente in locale. Nessun dato viene inviato a servizi esterni.