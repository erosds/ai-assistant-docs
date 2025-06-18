import React, { useState, useEffect } from 'react';
import { DocumentTextIcon, ChatBubbleLeftRightIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { healthAPI } from '../../api/client';

const Header = ({ currentView, onViewChange, documentsCount = 0 }) => {
  const [healthStatus, setHealthStatus] = useState(null);
  const [showHealthDetails, setShowHealthDetails] = useState(false);

  // Controlla health del backend
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const health = await healthAPI.checkHealth();
        const info = await healthAPI.getInfo();
        setHealthStatus({ ...health, ...info, status: 'healthy' });
      } catch (error) {
        setHealthStatus({ status: 'error', message: error.message });
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Controlla ogni 30 secondi
    return () => clearInterval(interval);
  }, []);

  const navigation = [
    {
      name: 'Documenti',
      id: 'documents',
      icon: DocumentTextIcon,
      badge: documentsCount,
    },
    {
      name: 'Chat AI',
      id: 'chat',
      icon: ChatBubbleLeftRightIcon,
    },
  ];

  const getStatusColor = () => {
    if (!healthStatus) return 'bg-gray-400';
    return healthStatus.status === 'healthy' ? 'bg-green-500' : 'bg-red-500';
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo e titolo */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
                <DocumentTextIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  AI Assistant Documenti
                </h1>
                <p className="text-sm text-gray-500">
                  Interroga i tuoi PDF con intelligenza artificiale
                </p>
              </div>
            </div>
          </div>

          {/* Navigazione centrale */}
          <nav className="hidden md:flex space-x-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => onViewChange(item.id)}
                  className={`
                    relative px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200
                    ${isActive 
                      ? 'bg-primary-100 text-primary-700 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }
                  `}
                >
                  <div className="flex items-center space-x-2">
                    <Icon className="w-5 h-5" />
                    <span>{item.name}</span>
                    {item.badge > 0 && (
                      <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-primary-600 bg-primary-100 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Status e impostazioni */}
          <div className="flex items-center space-x-4">
            {/* Indicatore status */}
            <div className="relative">
              <button
                onClick={() => setShowHealthDetails(!showHealthDetails)}
                className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900"
              >
                <div className={`w-3 h-3 rounded-full ${getStatusColor()}`}>
                  {healthStatus?.status === 'healthy' && (
                    <div className="w-3 h-3 rounded-full bg-green-500 animate-ping absolute"></div>
                  )}
                </div>
                <span className="hidden sm:inline">
                  {healthStatus?.status === 'healthy' ? 'Online' : 'Offline'}
                </span>
              </button>

              {/* Dettagli health (dropdown) */}
              {showHealthDetails && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-900">Status Sistema</h3>
                      <button
                        onClick={() => setShowHealthDetails(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        ✕
                      </button>
                    </div>
                    
                    {healthStatus ? (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Status:</span>
                          <span className={`font-medium ${
                            healthStatus.status === 'healthy' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {healthStatus.status === 'healthy' ? 'Operativo' : 'Errore'}
                          </span>
                        </div>
                        {healthStatus.version && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Versione:</span>
                            <span className="text-gray-900">{healthStatus.version}</span>
                          </div>
                        )}
                        {healthStatus.message && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Messaggio:</span>
                            <span className="text-gray-900">{healthStatus.message}</span>
                          </div>
                        )}
                        <div className="pt-2 border-t border-gray-200">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Backend:</span>
                            <span className="text-gray-900">FastAPI + Ollama</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-600">
                        Controllo status in corso...
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Impostazioni */}
            <button 
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              title="Impostazioni"
            >
              <Cog6ToothIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigazione mobile */}
        <div className="md:hidden border-t border-gray-200 py-3">
          <nav className="flex space-x-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => onViewChange(item.id)}
                  className={`
                    flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200
                    ${isActive 
                      ? 'bg-primary-100 text-primary-700' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.name}</span>
                  {item.badge > 0 && (
                    <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-primary-600 bg-primary-100 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;