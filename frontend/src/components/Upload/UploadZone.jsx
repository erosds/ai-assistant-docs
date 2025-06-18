import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  CloudArrowUpIcon, 
  DocumentTextIcon, 
  CheckCircleIcon, 
  ExclamationTriangleIcon,
  XMarkIcon 
} from '@heroicons/react/24/outline';
import { uploadAPI, formatFileSize } from '../../api/client';

const UploadZone = ({ onUploadComplete, onUploadStart }) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState(null);

  const onDrop = useCallback(async (acceptedFiles, rejectedFiles) => {
    // Reset stati precedenti
    setError(null);
    setUploadResult(null);

    // Gestisci file rifiutati
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection.errors[0]?.code === 'file-too-large') {
        setError('File troppo grande. Dimensione massima: 50MB');
      } else if (rejection.errors[0]?.code === 'file-invalid-type') {
        setError('Tipo di file non supportato. Carica solo file PDF.');
      } else {
        setError('Errore nel file caricato.');
      }
      return;
    }

    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    
    try {
      setUploading(true);
      setProgress(0);
      
      if (onUploadStart) {
        onUploadStart(file);
      }

      // Upload del file con progress tracking
      const result = await uploadAPI.uploadDocument(file, (progressPercent) => {
        setProgress(progressPercent);
      });

      setUploadResult(result);
      
      if (onUploadComplete) {
        onUploadComplete(result);
      }

    } catch (err) {
      setError(err.message || 'Errore durante l\'upload');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }, [onUploadComplete, onUploadStart]);

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragReject,
  } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxSize: 50 * 1024 * 1024, // 50MB
    multiple: false,
  });

  const resetUpload = () => {
    setUploadResult(null);
    setError(null);
  };

  // Stato di successo
  if (uploadResult && !error) {
    return (
      <div className="card text-center space-y-4">
        <div className="flex justify-center">
          <CheckCircleIcon className="w-16 h-16 text-green-500" />
        </div>
        
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Upload Completato!
          </h3>
          <p className="text-gray-600 mb-4">
            Il documento <strong>{uploadResult.document.filename}</strong> è stato caricato con successo.
          </p>
          
          <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Dimensione:</span>
              <span className="font-medium">{formatFileSize(uploadResult.document.size_bytes)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Pagine:</span>
              <span className="font-medium">{uploadResult.document.statistics.total_pages}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Parole:</span>
              <span className="font-medium">{uploadResult.document.statistics.total_words.toLocaleString()}</span>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              📝 Il documento è in elaborazione. Potrai iniziare a chattarci tra pochi istanti!
            </p>
          </div>
        </div>

        <button
          onClick={resetUpload}
          className="btn-primary"
        >
          Carica Altro Documento
        </button>
      </div>
    );
  }

  // Stato di errore
  if (error) {
    return (
      <div className="card text-center space-y-4">
        <div className="flex justify-center">
          <ExclamationTriangleIcon className="w-16 h-16 text-red-500" />
        </div>
        
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Errore Upload
          </h3>
          <p className="text-red-600 mb-4">
            {error}
          </p>
        </div>

        <button
          onClick={resetUpload}
          className="btn-primary"
        >
          Riprova
        </button>
      </div>
    );
  }

  // Stato di upload in corso
  if (uploading) {
    return (
      <div className="card text-center space-y-4">
        <div className="flex justify-center">
          <CloudArrowUpIcon className="w-16 h-16 text-primary-500 animate-bounce-subtle" />
        </div>
        
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Caricamento in corso...
          </h3>
          
          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
            <div 
              className="bg-primary-600 h-3 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          
          <p className="text-gray-600">
            {progress}% completato
          </p>
          
          <div className="mt-4 space-y-2 text-sm text-gray-500">
            <div className="flex items-center justify-center space-x-2">
              <div className="loading-dots">
                <span style={{'--i': 0}}></span>
                <span style={{'--i': 1}}></span>
                <span style={{'--i': 2}}></span>
              </div>
              <span>Elaborazione PDF...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Zona di drop principale
  return (
    <div
      {...getRootProps()}
      className={`
        border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300
        ${isDragActive && !isDragReject 
          ? 'border-primary-400 bg-primary-50 scale-105' 
          : isDragReject 
          ? 'border-red-400 bg-red-50' 
          : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
        }
      `}
    >
      <input {...getInputProps()} />
      
      <div className="space-y-4">
        {/* Icona */}
        <div className="flex justify-center">
          {isDragReject ? (
            <XMarkIcon className="w-16 h-16 text-red-400" />
          ) : (
            <CloudArrowUpIcon 
              className={`w-16 h-16 transition-colors duration-300 ${
                isDragActive ? 'text-primary-500' : 'text-gray-400'
              }`} 
            />
          )}
        </div>

        {/* Testo principale */}
        <div>
          {isDragReject ? (
            <div>
              <h3 className="text-lg font-semibold text-red-700 mb-2">
                File non valido
              </h3>
              <p className="text-red-600">
                Carica solo file PDF fino a 50MB
              </p>
            </div>
          ) : isDragActive ? (
            <div>
              <h3 className="text-lg font-semibold text-primary-700 mb-2">
                Rilascia il PDF qui!
              </h3>
              <p className="text-primary-600">
                Il documento verrà elaborato automaticamente
              </p>
            </div>
          ) : (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Carica il tuo documento PDF
              </h3>
              <p className="text-gray-600 mb-4">
                Trascina e rilascia qui il file, oppure clicca per selezionarlo
              </p>
              
              <div className="flex items-center justify-center space-x-4 text-sm text-gray-500">
                <div className="flex items-center space-x-1">
                  <DocumentTextIcon className="w-4 h-4" />
                  <span>Solo PDF</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span>📏</span>
                  <span>Max 50MB</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pulsante alternativo */}
        {!isDragActive && !isDragReject && (
          <button className="btn-primary">
            Seleziona File
          </button>
        )}
      </div>
    </div>
  );
};

export default UploadZone;