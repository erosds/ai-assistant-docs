import axios from 'axios';

// Configurazione base API
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Crea istanza axios
const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 30000, // 30 secondi
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor per gestire errori globalmente
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    
    if (error.response) {
      // Il server ha risposto con un errore
      const message = error.response.data?.detail || error.response.data?.message || 'Errore del server';
      throw new Error(message);
    } else if (error.request) {
      // La richiesta è stata fatta ma non c'è risposta
      throw new Error('Impossibile contattare il server. Verifica che il backend sia in esecuzione.');
    } else {
      // Errore nella configurazione della richiesta
      throw new Error('Errore nella richiesta: ' + error.message);
    }
  }
);

// API Functions

// Upload API
export const uploadAPI = {
  // Upload di un documento
  uploadDocument: async (file, onProgress = null) => {
    const formData = new FormData();
    formData.append('file', file);

    const config = {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    };

    if (onProgress) {
      config.onUploadProgress = (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percentCompleted);
      };
    }

    const response = await apiClient.post('/upload', formData, config);
    return response.data;
  },

  // Controlla status upload
  getUploadStatus: async (documentId) => {
    const response = await apiClient.get(`/upload/status/${documentId}`);
    return response.data;
  },

  // Elimina documento
  deleteDocument: async (documentId) => {
    const response = await apiClient.delete(`/upload/${documentId}`);
    return response.data;
  },

  // Valida impostazioni upload
  validateSettings: async () => {
    const response = await apiClient.get('/upload/validate');
    return response.data;
  },
};

// Documents API
export const documentsAPI = {
  // Lista documenti
  getDocuments: async (page = 1, pageSize = 20, search = '') => {
    const params = { page, page_size: pageSize };
    if (search) params.search = search;
    
    const response = await apiClient.get('/documents', { params });
    return response.data;
  },

  // Dettagli documento
  getDocumentDetails: async (documentId) => {
    const response = await apiClient.get(`/documents/${documentId}`);
    return response.data;
  },

  // Contenuto documento
  getDocumentContent: async (documentId, chunkId = null) => {
    const params = chunkId !== null ? { chunk_id: chunkId } : {};
    const response = await apiClient.get(`/documents/${documentId}/content`, { params });
    return response.data;
  },

  // Statistiche overview
  getOverview: async () => {
    const response = await apiClient.get('/documents/stats/overview');
    return response.data;
  },

  // Riprocessa documento
  reprocessDocument: async (documentId) => {
    const response = await apiClient.post(`/documents/${documentId}/reprocess`);
    return response.data;
  },

  // Ricerca cross-document
  searchContent: async (query, maxResults = 10, similarityThreshold = 0.1) => {
    const params = {
      query,
      max_results: maxResults,
      similarity_threshold: similarityThreshold,
    };
    const response = await apiClient.get('/documents/search/content', { params });
    return response.data;
  },
};

// Chat API
export const chatAPI = {
  // Invia messaggio chat
  sendMessage: async (documentId, question, options = {}) => {
    const payload = {
      document_id: documentId,
      question,
      include_sources: options.includeSources ?? true,
      max_chunks: options.maxChunks ?? 5,
      similarity_threshold: options.similarityThreshold ?? 0.1,
    };

    const response = await apiClient.post('/chat', payload);
    return response.data;
  },

  // Ottieni cronologia chat
  getChatHistory: async (documentId, limit = 50) => {
    const response = await apiClient.get(`/chat/history/${documentId}`, {
      params: { limit },
    });
    return response.data;
  },

  // Cancella cronologia chat
  clearChatHistory: async (documentId) => {
    const response = await apiClient.delete(`/chat/history/${documentId}`);
    return response.data;
  },

  // Test ricerca similarità
  testSimilarity: async (documentId, query, maxChunks = 5, similarityThreshold = 0.1) => {
    const response = await apiClient.post('/chat/test-similarity', null, {
      params: {
        document_id: documentId,
        query,
        max_chunks: maxChunks,
        similarity_threshold: similarityThreshold,
      },
    });
    return response.data;
  },

  // Statistiche chat
  getChatStats: async (documentId) => {
    const response = await apiClient.get(`/chat/stats/${documentId}`);
    return response.data;
  },
};

// Health check
export const healthAPI = {
  checkHealth: async () => {
    const response = await axios.get(`${API_BASE_URL}/health`);
    return response.data;
  },

  getInfo: async () => {
    const response = await axios.get(`${API_BASE_URL}/`);
    return response.data;
  },
};

// Utility functions
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatDate = (dateString) => {
  return new Date(dateString).toLocaleString('it-IT', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Export default per compatibilità
export default apiClient;