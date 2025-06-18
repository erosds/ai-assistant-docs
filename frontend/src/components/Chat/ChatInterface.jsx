import React, { useState, useEffect, useRef } from 'react';
import { 
  PaperAirplaneIcon, 
  DocumentTextIcon,
  ArrowLeftIcon,
  TrashIcon,
  ArrowPathIcon,
  InformationCircleIcon,
  ClipboardDocumentIcon
} from '@heroicons/react/24/outline';
import { chatAPI, formatDate } from '../../api/client';

const ChatInterface = ({ document, onBack }) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSources, setShowSources] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Carica cronologia chat
  useEffect(() => {
    if (document) {
      loadChatHistory();
    }
  }, [document]);

  // Auto-scroll ai nuovi messaggi
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadChatHistory = async () => {
    try {
      setError(null);
      const history = await chatAPI.getChatHistory(document.id);
      setMessages(history.messages || []);
    } catch (err) {
      setError('Errore nel caricamento della cronologia');
      console.error(err);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!inputValue.trim() || loading) return;

    const question = inputValue.trim();
    setInputValue('');
    setError(null);

    // Aggiungi messaggio utente alla UI
    const userMessage = {
      question,
      answer: null,
      timestamp: new Date().toISOString(),
      isUser: true
    };
    
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);

    try {
      // Invia richiesta al backend
      const response = await chatAPI.sendMessage(document.id, question, {
        includeSources: showSources,
        maxChunks: 5,
        similarityThreshold: 0.1
      });

      if (response.success) {
        // Aggiungi risposta AI
        const aiMessage = {
          question: response.question,
          answer: response.answer,
          timestamp: response.timestamp,
          sources: response.sources,
          metadata: response.metadata,
          isUser: false
        };
        
        setMessages(prev => [...prev.slice(0, -1), userMessage, aiMessage]);
      } else {
        setError(response.error || 'Errore nella risposta');
        setMessages(prev => prev.slice(0, -1)); // Rimuovi messaggio utente se fallita
      }

    } catch (err) {
      setError(err.message);
      setMessages(prev => prev.slice(0, -1)); // Rimuovi messaggio utente se fallita
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    if (!confirm('Sei sicuro di voler cancellare tutta la cronologia chat?')) return;

    try {
      await chatAPI.clearChatHistory(document.id);
      setMessages([]);
    } catch (err) {
      setError('Errore nella cancellazione della cronologia');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      // Feedback visivo opzionale
    });
  };

  if (!document) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <DocumentTextIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Seleziona un documento
          </h3>
          <p className="text-gray-600">
            Scegli un documento dalla lista per iniziare a chattare
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          
          <div className="flex items-center space-x-3">
            <DocumentTextIcon className="w-6 h-6 text-primary-600" />
            <div>
              <h2 className="font-semibold text-gray-900 truncate max-w-xs sm:max-w-md">
                {document.filename}
              </h2>
              <p className="text-sm text-gray-500">
                {document.chunk_count} sezioni • {document.chat_count} chat
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Toggle sources */}
          <button
            onClick={() => setShowSources(!showSources)}
            className={`px-3 py-1 text-sm rounded-lg transition-colors ${
              showSources 
                ? 'bg-primary-100 text-primary-700' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <InformationCircleIcon className="w-4 h-4 inline mr-1" />
            Fonti
          </button>

          {/* Clear history */}
          {messages.length > 0 && (
            <button
              onClick={clearHistory}
              className="p-2 text-gray-500 hover:text-red-600 rounded-lg hover:bg-gray-100 transition-colors"
              title="Cancella cronologia"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Area messaggi */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin">
        {messages.length === 0 && !loading && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <DocumentTextIcon className="w-8 h-8 text-primary-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Inizia una conversazione
            </h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Fai una domanda sul documento "{document.filename}" e ricevi risposte basate sul suo contenuto.
            </p>
            <div className="mt-6 space-y-2 text-sm text-gray-500">
              <p>💡 Esempi di domande:</p>
              <div className="space-y-1">
                <p>"Qual è il tema principale del documento?"</p>
                <p>"Riassumi i punti chiave"</p>
                <p>"Cerca informazioni su..."</p>
              </div>
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div key={index} className="space-y-4">
            {/* Messaggio utente */}
            <div className="flex justify-end">
              <div className="chat-bubble-user">
                <p className="text-white">{message.question}</p>
                <p className="text-xs text-blue-100 mt-1">
                  {formatDate(message.timestamp)}
                </p>
              </div>
            </div>

            {/* Risposta AI */}
            {message.answer && (
              <div className="flex justify-start">
                <div className="chat-bubble-ai max-w-3xl">
                  <div className="prose prose-sm max-w-none">
                    <p className="whitespace-pre-wrap text-gray-900">
                      {message.answer}
                    </p>
                  </div>

                  {/* Sources */}
                  {showSources && message.sources && message.sources.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                          Fonti utilizzate
                        </h4>
                        <button
                          onClick={() => copyToClipboard(message.answer)}
                          className="p-1 text-gray-400 hover:text-gray-600 rounded"
                          title="Copia risposta"
                        >
                          <ClipboardDocumentIcon className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="space-y-2">
                        {message.sources.map((source, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs bg-gray-50 rounded p-2">
                            <span className="text-gray-600">
                              Sezione {source.chunk_id}
                            </span>
                            <span className="text-gray-500">
                              Similarità: {(source.similarity_score * 100).toFixed(1)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Metadata */}
                  {message.metadata && (
                    <div className="mt-2 text-xs text-gray-500">
                      Risposta generata con {message.metadata.chunks_used} sezioni
                      {message.metadata.model && ` • ${message.metadata.model}`}
                    </div>
                  )}

                  <p className="text-xs text-gray-500 mt-2">
                    {formatDate(message.timestamp)}
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Indicatore di caricamento */}
        {loading && (
          <div className="flex justify-start">
            <div className="chat-bubble-ai">
              <div className="flex items-center space-x-2">
                <div className="loading-dots">
                  <span style={{'--i': 0}}></span>
                  <span style={{'--i': 1}}></span>
                  <span style={{'--i': 2}}></span>
                </div>
                <span className="text-gray-600">L'AI sta pensando...</span>
              </div>
            </div>
          </div>
        )}

        {/* Errore */}
        {error && (
          <div className="flex justify-center">
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              <p className="text-sm">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-xs text-red-600 hover:text-red-800 mt-1"
              >
                Chiudi
              </button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Form input */}
      <div className="border-t border-gray-200 p-4 bg-white">
        <form onSubmit={handleSubmit} className="flex items-end space-x-3">
          <div className="flex-1">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Fai una domanda sul documento..."
              rows={1}
              className="w-full resize-none border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              style={{
                minHeight: '44px',
                maxHeight: '120px',
              }}
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Premi Invio per inviare, Shift+Invio per andare a capo
            </p>
          </div>
          
          <button
            type="submit"
            disabled={!inputValue.trim() || loading}
            className={`
              p-3 rounded-lg transition-all duration-200 flex-shrink-0
              ${inputValue.trim() && !loading
                ? 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm hover:shadow-md' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            {loading ? (
              <ArrowPathIcon className="w-5 h-5 animate-spin" />
            ) : (
              <PaperAirplaneIcon className="w-5 h-5" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;