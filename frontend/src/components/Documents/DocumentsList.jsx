import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  IconButton,
  TextField,
  InputAdornment,
  Chip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Collapse,
  Divider,
  Paper,
  Skeleton
} from '@mui/material';
import {
  Description as DocumentIcon,
  Chat as ChatIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import { documentsAPI, formatFileSize, formatDate, uploadAPI } from '../../api/client';

const DocumentsList = ({ onSelectDocument, onDeleteDocument, refreshTrigger }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedDoc, setExpandedDoc] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, documentId: null });
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
      await uploadAPI.deleteDocument(documentId);
      
      // Rimuovi dalla lista locale
      setDocuments(docs => docs.filter(doc => doc.id !== documentId));
      setDeleteDialog({ open: false, documentId: null });
      
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

  // Loading skeleton
  if (loading && documents.length === 0) {
    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h5" gutterBottom>I tuoi documenti</Typography>
            <Skeleton variant="text" width={200} />
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Skeleton variant="rectangular" width={200} height={40} />
            <Skeleton variant="rectangular" width={100} height={40} />
          </Box>
        </Box>
        
        <Grid container spacing={3}>
          {[...Array(6)].map((_, i) => (
            <Grid item xs={12} md={6} lg={4} key={i}>
              <Card>
                <CardContent>
                  <Skeleton variant="text" width="80%" height={24} />
                  <Skeleton variant="text" width="60%" height={20} sx={{ mb: 2 }} />
                  <Skeleton variant="text" width="100%" height={60} />
                  <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                    <Skeleton variant="rectangular" width={80} height={40} />
                    <Skeleton variant="rectangular" width={80} height={40} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  // Stato di errore
  if (error) {
    return (
      <Alert 
        severity="error" 
        action={
          <Button color="inherit" size="small" onClick={loadDocuments}>
            Riprova
          </Button>
        }
        sx={{ mb: 3 }}
      >
        <Typography variant="h6" gutterBottom>Errore nel caricamento</Typography>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header con ricerca */}
      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'space-between',
        alignItems: { xs: 'stretch', sm: 'center' },
        gap: 2,
        mb: 3
      }}>
        <Box>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
            I tuoi documenti
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {documents.length} documento{documents.length !== 1 ? 'i' : ''} caricato{documents.length !== 1 ? 'i' : ''}
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {/* Barra di ricerca */}
          <TextField
            placeholder="Cerca documenti..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            sx={{ minWidth: 250 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          
          {/* Pulsante aggiorna */}
          <Button
            onClick={loadDocuments}
            disabled={loading}
            variant="outlined"
            startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
          >
            Aggiorna
          </Button>
        </Box>
      </Box>

      {/* Lista documenti */}
      {filteredDocuments.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <DocumentIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            {searchTerm ? 'Nessun documento trovato' : 'Nessun documento caricato'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {searchTerm 
              ? 'Prova a modificare i termini di ricerca' 
              : 'Carica il tuo primo documento PDF per iniziare'
            }
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {filteredDocuments.map((document) => (
            <Grid item xs={12} md={6} lg={4} key={document.id}>
              <Card sx={{ 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: 4,
                }
              }}>
                {/* Header documento */}
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                    <DocumentIcon sx={{ color: 'primary.main', fontSize: 32, mt: 0.5 }} />
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography 
                        variant="h6" 
                        component="h3" 
                        noWrap 
                        title={document.filename}
                        sx={{ fontWeight: 600, mb: 0.5 }}
                      >
                        {document.filename}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {formatDate(document.upload_date)}
                      </Typography>
                    </Box>
                    
                    {/* Status indicator */}
                    {document.processing_complete ? (
                      <Chip
                        icon={<CheckCircleIcon />}
                        label="Pronto"
                        color="success"
                        size="small"
                        variant="outlined"
                      />
                    ) : (
                      <Chip
                        icon={<ScheduleIcon />}
                        label="Elaborazione"
                        color="warning"
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Box>

                  {/* Anteprima contenuto */}
                  <Typography 
                    variant="body2" 
                    color="text.secondary"
                    sx={{ 
                      mb: 2,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      lineHeight: 1.4
                    }}
                  >
                    {document.content_preview}
                  </Typography>

                  {/* Statistiche */}
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={6}>
                      <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                        <Typography variant="h6" color="primary">
                          {document.chunk_count}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Sezioni
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6}>
                      <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                        <Typography variant="h6" color="primary">
                          {document.chat_count}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Chat
                        </Typography>
                      </Paper>
                    </Grid>
                  </Grid>

                  {/* Dettagli espandibili */}
                  <Collapse in={expandedDoc === document.id}>
                    <Divider sx={{ mb: 2 }} />
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">ID:</Typography>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                          {document.id.substring(0, 8)}...
                        </Typography>
                      </Box>
                      {document.file_size && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="text.secondary">Dimensione:</Typography>
                          <Typography variant="caption">
                            {formatFileSize(document.file_size)}
                          </Typography>
                        </Box>
                      )}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">Status:</Typography>
                        <Chip
                          label={document.processing_complete ? 'Pronto' : 'In elaborazione'}
                          color={document.processing_complete ? 'success' : 'warning'}
                          size="small"
                        />
                      </Box>
                    </Box>
                  </Collapse>
                </CardContent>

                {/* Azioni */}
                <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {/* Pulsante Chat */}
                    <Button
                      onClick={() => handleSelectForChat(document)}
                      disabled={!document.processing_complete}
                      variant="contained"
                      size="small"
                      startIcon={<ChatIcon />}
                    >
                      Chat
                    </Button>

                    {/* Pulsante Dettagli */}
                    <Button
                      onClick={() => setExpandedDoc(expandedDoc === document.id ? null : document.id)}
                      variant="outlined"
                      size="small"
                      startIcon={expandedDoc === document.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    >
                      Dettagli
                    </Button>
                  </Box>

                  {/* Pulsante Elimina */}
                  <IconButton
                    onClick={() => setDeleteDialog({ open: true, documentId: document.id })}
                    disabled={deleting === document.id}
                    size="small"
                    sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                  >
                    {deleting === document.id ? (
                      <CircularProgress size={20} />
                    ) : (
                      <DeleteIcon />
                    )}
                  </IconButton>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Dialog conferma eliminazione */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, documentId: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <WarningIcon color="warning" />
            Conferma eliminazione
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography>
            Sei sicuro di voler eliminare questo documento? 
            Questa azione non può essere annullata e cancellerà anche la cronologia chat associata.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setDeleteDialog({ open: false, documentId: null })}
          >
            Annulla
          </Button>
          <Button
            onClick={() => handleDelete(deleteDialog.documentId)}
            disabled={deleting}
            color="error"
            variant="contained"
            startIcon={deleting === deleteDialog.documentId ? <CircularProgress size={16} /> : <DeleteIcon />}
          >
            Elimina
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DocumentsList;