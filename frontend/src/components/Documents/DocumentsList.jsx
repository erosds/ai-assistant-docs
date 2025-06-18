import React, { useState, useEffect } from 'react';
import { 
  DocumentTextIcon, 
  ChatBubbleLeftRightIcon, 
  TrashIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  EyeIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { documentsAPI, formatFileSize, formatDate } from '../../api/client';

const DocumentsList = ({ onSelectDocument, onDeleteDocument, refreshTrigger }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(null);

  // Carica documenti
  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await documentsAPI.getDocuments(1, 50, searchTerm);
      setDocuments(response.documents);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Effetti
  useEffect(() => {
    loadDocuments();
  }, [searchTerm, refreshTrigger]);

  // Gestisci eliminazione documento
  const handleDelete = async (documentId) => {
    try {
      setDeleting(documentId);
      await documentsAPI.deleteDocument(documentId);
      
      // Rimuovi dalla lista locale
      setDocuments(docs => docs.filter(doc => doc.id !== documentId));
      setShowDeleteConfirm(null);
      
      if (onDeleteDocument) {
        onDeleteDocument(documentId);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(null);
    }
  };

  // Gestisci selezione documento per chat
  const handleSelectForChat = (document) => {
    if (!document.processing_complete) {
      alert('Il documento è ancora in elaborazione. Riprova tra poco.');
      return;
    }
    
    if (onSelectDocument) {
      onSelectDocument(document);
    }
  };

  // Filtra documenti per ricerca
  const filteredDocuments = documents.filter(doc =>
    doc.filename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Stati di caricamento e errore
  if (loading && documents.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">I tuoi documenti</h2>
          <button 
            onClick={loadDocuments}
            className="btn-outline flex items-center space-x-2"
          >
            <ArrowPathIcon className="w-4 h-4" />
            <span>Aggiorna</span>
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="space-y-2">
                <div className="h-3 bg-gray-200 rounded"></div>
                <div className="h-3 bg-gray-200 rounded w-5/6"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <ExclamationTriangleIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Errore nel caricamento</h3>
        <p className="text-red-600 mb-4">{error}</p>
        <button 
          onClick={loadDocuments}
          className="btn-primary"
        >
          Riprova
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con ricerca */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">I tuoi documenti</h2>
          <p className="text-gray-600">
            {documents.length} documento{documents.length !== 1 ? 'i' : ''} caricato{documents.length !== 1 ? 'i' : ''}
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Barra di ricerca */}
          <div className="relative">
            <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cerca documenti..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 w-64"
            />
          </div>
          
          {/* Pulsante aggiorna */}
          <button 
            onClick={loadDocuments}
            disabled={loading}
            className="btn-outline flex items-center space-x-2"
          >
            <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Aggiorna</span>
          </button>
        </div>
      </div>

      {/* Lista documenti */}
      {filteredDocuments.length === 0 ? (
        <div className="text-center py-12">
          <DocumentTextIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm ? 'Nessun documento trovato' : 'Nessun documento caricato'}
          </h3>
          <p className="text-gray-600">
            {searchTerm 
              ? 'Prova a modificare i termini di ricerca' 
              : 'Carica il tuo primo documento PDF per iniziare'
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocuments.map((document) => (
            <div key={document.id} className="card-hover group">
              {/* Header documento */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="flex-shrink-0">
                    <DocumentTextIcon className="w-8 h-8 text-primary-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-900 truncate" title={document.filename}>
                      {document.filename}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {formatDate(document.upload_date)}
                    </p>
                  </div>
                </div>
                
                {/* Status indicator */}
                <div className="flex-shrink-0">
                  {document.processing_complete ? (
                    <CheckCircleIcon className="w-5 h-5 text-green-500" title="Pronto per chat" />
                  ) : (
                    <ClockIcon className="w-5 h-5 text-yellow-500 animate-pulse" title="In elaborazione" />
                  )}
                </div>
              </div>

              {/* Anteprima contenuto */}
              <div className="mb-4">
                <p className="text-sm text-gray-600 line-clamp-3">
                  {document.content_preview}
                </p>
              </div>

              {/* Statistiche */}
              <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                <div className="text-center p-2 bg-gray-50 rounded">
                  <div className="font-semibold text-gray-900">{document.chunk_count}</div>
                  <div className="text-gray-600">Sezioni</div>
                </div>
                <div className="text-center p-2 bg-gray-50 rounded">
                  <div className="font-semibold text-gray-900">{document.chat_count}</div>
                  <div className="text-gray-600">Chat</div>
                </div>
              </div>

              {/* Azioni */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <div className="flex items-center space-x-2">
                  {/* Pulsante Chat */}
                  <button
                    onClick={() => handleSelectForChat(document)}
                    disabled={!document.processing_complete}
                    className={`
                      flex items-center space-x-1 px-3 py-1.5 rounded text-sm font-medium transition-colors
                      ${document.processing_complete 
                        ? 'bg-primary-100 text-primary-700 hover:bg-primary-200' 
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }
                    `}
                  >
                    <ChatBubbleLeftRightIcon className="w-4 h-4" />
                    <span>Chat</span>
                  </button>

                  {/* Pulsante Dettagli */}
                  <button
                    onClick={() => setSelectedDoc(selectedDoc === document.id ? null : document.id)}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    <EyeIcon className="w-4 h-4" />
                    <span>Dettagli</span>
                  </button>
                </div>

                {/* Pulsante Elimina */}
                <button
                  onClick={() => setShowDeleteConfirm(document.id)}
                  disabled={deleting === document.id}
                  className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors"
                >
                  {deleting === document.id ? (
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  ) : (
                    <TrashIcon className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Dettagli espandibili */}
              {selectedDoc === document.id && (
                <div className="mt-4 pt-4 border-t border-gray-200 space-y-2 text-sm animate-slide-up">
                  <div className="flex justify-between">
                    <span className="text-gray-600">ID:</span>
                    <span className="text-gray-900 font-mono text-xs">{document.id}</span>
                  </div>
                  {document.file_size && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Dimensione:</span>
                      <span className="text-gray-900">{formatFileSize(document.file_size)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <span className={`font-medium ${
                      document.processing_complete ? 'text-green-600' : 'text-yellow-600'
                    }`}>
                      {document.processing_complete ? 'Pronto' : 'In elaborazione'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal conferma eliminazione */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Conferma eliminazione
            </h3>
            <p className="text-gray-600 mb-6">
              Sei sicuro di voler eliminare questo documento? 
              Questa azione non può essere annullata e cancellerà anche la cronologia chat associata.
            </p>
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="btn-outline"
              >
                Annulla
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                disabled={deleting}
                className="btn-danger flex items-center space-x-2"
              >
                {deleting === showDeleteConfirm && (
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                )}
                <span>Elimina</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentsList;