import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  Divider,
  Card,
  CardContent,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  useTheme
} from '@mui/material';
import {
  Send as SendIcon,
  Description as DocumentIcon,
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon,
  ContentCopy as CopyIcon,
  SmartToy as BotIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { chatAPI, formatDate } from '../../api/client';

const ChatInterface = ({ document, onBack }) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSources, setShowSources] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const theme = useTheme();

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
        setMessages(prev => prev.slice(0, -1));
      }

    } catch (err) {
      setError(err.message);
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    try {
      await chatAPI.clearChatHistory(document.id);
      setMessages([]);
      setShowDeleteDialog(false);
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
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100%',
        textAlign: 'center'
      }}>
        <Box>
          <DocumentIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Seleziona un documento
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Scegli un documento dalla lista per iniziare a chattare
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        p: 2, 
        borderBottom: 1, 
        borderColor: 'divider' 
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
          <IconButton 
            onClick={onBack}
            sx={{ color: 'text.secondary' }}
          >
            <ArrowBackIcon />
          </IconButton>
          
          <DocumentIcon sx={{ color: 'primary.main', fontSize: 32 }} />
          
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" noWrap sx={{ fontWeight: 600 }}>
              {document.filename}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {document.chunk_count} sezioni • {document.chat_count} chat
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Toggle sources */}
          <Chip
            icon={<InfoIcon />}
            label="Fonti"
            onClick={() => setShowSources(!showSources)}
            color={showSources ? 'primary' : 'default'}
            variant={showSources ? 'filled' : 'outlined'}
            size="small"
          />

          {/* Clear history */}
          {messages.length > 0 && (
            <Tooltip title="Cancella cronologia">
              <IconButton
                onClick={() => setShowDeleteDialog(true)}
                size="small"
                sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
              >
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Area messaggi */}
      <Box sx={{ 
        flexGrow: 1, 
        overflow: 'auto', 
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 2
      }}>
        {messages.length === 0 && !loading && (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Box sx={{
              width: 80,
              height: 80,
              bgcolor: 'primary.50',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 3
            }}>
              <DocumentIcon sx={{ fontSize: 40, color: 'primary.main' }} />
            </Box>
            <Typography variant="h6" gutterBottom>
              Inizia una conversazione
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 500, mx: 'auto', mb: 3 }}>
              Fai una domanda sul documento "{document.filename}" e ricevi risposte basate sul suo contenuto.
            </Typography>
            <Box sx={{ mt: 3, textAlign: 'left', maxWidth: 400, mx: 'auto' }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                💡 Esempi di domande:
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Typography variant="body2" color="text.secondary">
                  "Qual è il tema principale del documento?"
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  "Riassumi i punti chiave"
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  "Cerca informazioni su..."
                </Typography>
              </Box>
            </Box>
          </Box>
        )}

        {messages.map((message, index) => (
          <Box key={index} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Messaggio utente */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Card sx={{ 
                maxWidth: '70%', 
                bgcolor: 'primary.main',
                color: 'primary.contrastText'
              }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                    <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.dark' }}>
                      <PersonIcon sx={{ fontSize: 18 }} />
                    </Avatar>
                    <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                      <Typography variant="body1" sx={{ color: 'inherit', wordBreak: 'break-word' }}>
                        {message.question}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'primary.100', mt: 1, display: 'block' }}>
                        {formatDate(message.timestamp)}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Box>

            {/* Risposta AI */}
            {message.answer && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                <Card sx={{ maxWidth: '80%', bgcolor: 'background.paper' }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
                        <BotIcon sx={{ fontSize: 18 }} />
                      </Avatar>
                      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                        <Typography 
                          variant="body1" 
                          sx={{ 
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            lineHeight: 1.6
                          }}
                        >
                          {message.answer}
                        </Typography>

                        {/* Sources */}
                        {showSources && message.sources && message.sources.length > 0 && (
                          <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="caption" sx={{ 
                                fontWeight: 'medium', 
                                color: 'text.secondary',
                                textTransform: 'uppercase',
                                letterSpacing: 0.5
                              }}>
                                Fonti utilizzate
                              </Typography>
                              <Tooltip title="Copia risposta">
                                <IconButton
                                  size="small"
                                  onClick={() => copyToClipboard(message.answer)}
                                  sx={{ color: 'text.secondary' }}
                                >
                                  <CopyIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              {message.sources.map((source, idx) => (
                                <Chip
                                  key={idx}
                                  label={`Sezione ${source.chunk_id} - Similarità: ${(source.similarity_score * 100).toFixed(1)}%`}
                                  size="small"
                                  variant="outlined"
                                  sx={{ fontSize: '0.75rem' }}
                                />
                              ))}
                            </Box>
                          </Box>
                        )}

                        {/* Metadata */}
                        {message.metadata && (
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                            Risposta generata con {message.metadata.chunks_used} sezioni
                            {message.metadata.model && ` • ${message.metadata.model}`}
                          </Typography>
                        )}

                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                          {formatDate(message.timestamp)}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            )}
          </Box>
        ))}

        {/* Indicatore di caricamento */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
            <Card sx={{ bgcolor: 'background.paper' }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
                    <BotIcon sx={{ fontSize: 18 }} />
                  </Avatar>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box className="loading-dots">
                      <span style={{'--i': 0}}></span>
                      <span style={{'--i': 1}}></span>
                      <span style={{'--i': 2}}></span>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      L'AI sta pensando...
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Box>
        )}

        {/* Errore */}
        {error && (
          <Alert 
            severity="error" 
            onClose={() => setError(null)}
            sx={{ mx: 'auto', maxWidth: 500 }}
          >
            {error}
          </Alert>
        )}

        <div ref={messagesEndRef} />
      </Box>

      {/* Form input */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Box 
          component="form" 
          onSubmit={handleSubmit}
          sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}
        >
          <TextField
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
            multiline
            maxRows={4}
            fullWidth
            disabled={loading}
            helperText="Premi Invio per inviare, Shift+Invio per andare a capo"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />
          
          <Button
            type="submit"
            variant="contained"
            disabled={!inputValue.trim() || loading}
            sx={{
              minWidth: 56,
              height: 56,
              borderRadius: 2,
              alignSelf: 'flex-end',
              mb: 2.5, // Align with text field
            }}
          >
            {loading ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              <SendIcon />
            )}
          </Button>
        </Box>
      </Box>

      {/* Dialog conferma eliminazione */}
      <Dialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Conferma eliminazione cronologia
        </DialogTitle>
        <DialogContent>
          <Typography>
            Sei sicuro di voler cancellare tutta la cronologia chat? 
            Questa azione non può essere annullata.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteDialog(false)}>
            Annulla
          </Button>
          <Button 
            onClick={clearHistory}
            color="error"
            variant="contained"
          >
            Elimina
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ChatInterface;