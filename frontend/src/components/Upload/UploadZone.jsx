import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Box,
  Typography,
  Button,
  Paper,
  LinearProgress,
  Alert,
  Card,
  CardContent,
  Divider,
  Chip,
  useTheme
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Description as DocumentIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { uploadAPI, formatFileSize } from '../../api/client';

const UploadZone = ({ onUploadComplete, onUploadStart }) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState(null);
  const theme = useTheme();

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
      <Card sx={{ textAlign: 'center' }}>
        <CardContent sx={{ p: 4 }}>
          <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
          
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            Upload Completato!
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Il documento <strong>{uploadResult.document.filename}</strong> è stato caricato con successo.
          </Typography>
          
          {/* Statistiche documento */}
          <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'grey.50' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
              <Box>
                <Typography variant="h6" color="primary">
                  {uploadResult.document.statistics.total_words.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Parole
                </Typography>
              </Box>
            </Box>
          </Paper>
          
          <Alert severity="info" sx={{ mb: 3, textAlign: 'left' }}>
            📝 Il documento è in elaborazione. Potrai iniziare a chattarci tra pochi istanti!
          </Alert>

          <Button
            onClick={resetUpload}
            variant="contained"
            size="large"
          >
            Carica Altro Documento
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Stato di errore
  if (error) {
    return (
      <Card sx={{ textAlign: 'center' }}>
        <CardContent sx={{ p: 4 }}>
          <ErrorIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
          
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            Errore Upload
          </Typography>
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>

          <Button
            onClick={resetUpload}
            variant="contained"
            size="large"
          >
            Riprova
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Stato di upload in corso
  if (uploading) {
    return (
      <Card sx={{ textAlign: 'center' }}>
        <CardContent sx={{ p: 4 }}>
          <CloudUploadIcon 
            sx={{ 
              fontSize: 64, 
              color: 'primary.main', 
              mb: 2,
              animation: 'bounce 2s infinite',
              '@keyframes bounce': {
                '0%, 20%, 53%, 80%, 100%': {
                  transform: 'translate3d(0,0,0)',
                },
                '40%, 43%': {
                  transform: 'translate3d(0, -8px, 0)',
                },
                '70%': {
                  transform: 'translate3d(0, -4px, 0)',
                },
                '90%': {
                  transform: 'translate3d(0, -2px, 0)',
                },
              }
            }} 
          />
          
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            Caricamento in corso...
          </Typography>
          
          {/* Progress bar */}
          <Box sx={{ width: '100%', mb: 2 }}>
            <LinearProgress 
              variant="determinate" 
              value={progress} 
              sx={{ 
                height: 8, 
                borderRadius: 4,
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4,
                }
              }} 
            />
          </Box>
          
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            {progress}% completato
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            <Box className="loading-dots">
              <span style={{'--i': 0}}></span>
              <span style={{'--i': 1}}></span>
              <span style={{'--i': 2}}></span>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Elaborazione PDF...
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  // Zona di drop principale
  return (
    <Paper
      {...getRootProps()}
      sx={{
        p: 4,
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        border: '2px dashed',
        borderColor: isDragActive && !isDragReject 
          ? 'primary.main' 
          : isDragReject 
          ? 'error.main' 
          : 'grey.300',
        bgcolor: isDragActive && !isDragReject 
          ? 'primary.50' 
          : isDragReject 
          ? 'error.50' 
          : 'background.paper',
        '&:hover': {
          borderColor: isDragReject ? 'error.main' : 'primary.main',
          bgcolor: isDragReject ? 'error.50' : 'primary.50',
          transform: 'scale(1.02)',
        },
      }}
    >
      <input {...getInputProps()} />
      
      {/* Icona */}
      <Box sx={{ mb: 3 }}>
        {isDragReject ? (
          <CloseIcon sx={{ fontSize: 64, color: 'error.main' }} />
        ) : (
          <CloudUploadIcon 
            sx={{ 
              fontSize: 64, 
              color: isDragActive ? 'primary.main' : 'text.disabled',
              transition: 'color 0.3s ease'
            }} 
          />
        )}
      </Box>

      {/* Testo principale */}
      {isDragReject ? (
        <Box>
          <Typography variant="h6" color="error" gutterBottom sx={{ fontWeight: 600 }}>
            File non valido
          </Typography>
          <Typography variant="body1" color="error">
            Carica solo file PDF fino a 50MB
          </Typography>
        </Box>
      ) : isDragActive ? (
        <Box>
          <Typography variant="h6" color="primary" gutterBottom sx={{ fontWeight: 600 }}>
            Rilascia il PDF qui!
          </Typography>
          <Typography variant="body1" color="primary">
            Il documento verrà elaborato automaticamente
          </Typography>
        </Box>
      ) : (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            Carica il tuo documento PDF
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Trascina e rilascia qui il file, oppure clicca per selezionarlo
          </Typography>
          
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: 3, 
            mb: 3,
            flexWrap: 'wrap'
          }}>
            <Chip
              icon={<DocumentIcon />}
              label="Solo PDF"
              variant="outlined"
              size="small"
            />
            <Chip
              label="Max 50MB"
              variant="outlined"
              size="small"
            />
          </Box>

          <Button 
            variant="contained" 
            size="large"
            startIcon={<CloudUploadIcon />}
            sx={{ borderRadius: 2 }}
          >
            Seleziona File
          </Button>
        </Box>
      )}
    </Paper>
  );
};

export default UploadZone