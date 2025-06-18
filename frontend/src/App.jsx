import React, { useState, useEffect } from 'react';
import Header from './components/Layout/Header';
import UploadZone from './components/Upload/UploadZone';
import DocumentsList from './components/Documents/DocumentsList';
import ChatInterface from './components/Chat/ChatInterface';
import { documentsAPI } from './api/client';

function App() {
  const [currentView, setCurrentView] = useState('documents');
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [documentsCount, setDocumentsCount] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const loadDocumentsCount = async () => {
      try {
        const overview = await documentsAPI.getOverview();
        setDocumentsCount(overview.total_documents || 0);
      } catch (error) {
        console.error('Errore caricamento overview:', error);
      }
    };

    loadDocumentsCount();
  }, [refreshTrigger]);

  const handleViewChange = (view) => {
    // Se si passa alla chat e non c'è documento selezionato, torna ai documenti
    if (view === 'chat' && !selectedDocument) {
      setCurrentView('documents');
      return;
    }
    setCurrentView(view);
  };

  const handleSelectDocument = (document) => {
    setSelectedDocument(document);
    setCurrentView('chat');
  };

  const handleUploadComplete = (result) => {
    setRefreshTrigger(prev => prev + 1);
    console.log('Upload completato:', result);
  };

  const handleDeleteDocument = (documentId) => {
    if (selectedDocument && selectedDocument.id === documentId) {
      setSelectedDocument(null);
      setCurrentView('documents');
    }
    setRefreshTrigger(prev => prev + 1);
  };

  const handleBackFromChat = () => {
    setCurrentView('documents');
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="flex items-center justify-center h-16 border-b border-gray-200 font-bold text-xl text-indigo-700">
          AI Docs
        </div>

        <nav className="flex flex-col flex-grow p-4 space-y-2">
          <button
            onClick={() => handleViewChange('documents')}
            className={`text-left px-4 py-2 rounded-md hover:bg-indigo-100 transition ${
              currentView === 'documents' ? 'bg-indigo-200 font-semibold' : ''
            }`}
          >
            Documenti ({documentsCount})
          </button>

          <button
            onClick={() => handleViewChange('chat')}
            disabled={!selectedDocument}
            className={`text-left px-4 py-2 rounded-md hover:bg-indigo-100 transition ${
              currentView === 'chat' ? 'bg-indigo-200 font-semibold' : ''
            } ${!selectedDocument ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Chat
          </button>
        </nav>

        <footer className="p-4 text-xs text-gray-500 border-t border-gray-200">
          <div>Powered by FastAPI + Ollama</div>
        </footer>
      </aside>

      {/* Main Content */}
      <main className="flex-grow flex flex-col max-w-7xl mx-auto p-6">
        <Header
          currentView={currentView}
          onViewChange={handleViewChange}
          documentsCount={documentsCount}
        />

        {currentView === 'documents' && (
          <div className="flex flex-col space-y-8 mt-6">
            {/* Upload Section */}
            <section className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                Carica nuovo documento
              </h2>
              <p className="text-gray-600 mb-4">
                Carica un file PDF per iniziare a chattare con il tuo documento
              </p>
              <UploadZone
                onUploadComplete={handleUploadComplete}
                onUploadStart={(file) => console.log('Inizio upload:', file.name)}
              />
            </section>

            {/* Documents List Section */}
            <section className="bg-white rounded-lg shadow p-6 flex-grow overflow-auto">
              <DocumentsList
                onSelectDocument={handleSelectDocument}
                onDeleteDocument={handleDeleteDocument}
                refreshTrigger={refreshTrigger}
              />
            </section>
          </div>
        )}

        {currentView === 'chat' && selectedDocument && (
          <div className="flex flex-col flex-grow bg-white rounded-lg shadow p-6 mt-6 h-[calc(100vh-8rem)]">
            <ChatInterface
              document={selectedDocument}
              onBack={handleBackFromChat}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
