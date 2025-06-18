import React, { useState, useEffect } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tooltip,
  Paper
} from '@mui/material';
import {
  SmartToy as ModelIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Speed as SpeedIcon,
  Memory as MemoryIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { modelsAPI } from '../../api/client';

const ModelSelector = ({ onModelChange }) => {
  const [models, setModels] = useState([]);
  const [currentModel, setCurrentModel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [testingModel, setTestingModel] = useState(null);
  const [changingModel, setChangingModel] = useState(false);

  // Carica modelli all'avvio
  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await modelsAPI.getAvailableModels();
      setModels(response.available_models);
      setCurrentModel(response.current_model);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleModelChange = async (newModel) => {
    if (newModel === currentModel) return;

    try {
      setChangingModel(true);
      setError(null);
      
      const response = await modelsAPI.changeModel(newModel);
      
      if (response.success) {
        setCurrentModel(newModel);
        if (onModelChange) {
          onModelChange(newModel);
        }
        setDialogOpen(false);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setChangingModel(false);
    }
  };

  const testModel = async (modelName) => {
    try {
      setTestingModel(modelName);
      const response = await modelsAPI.testModel(modelName);
      return response.success;
    } catch (err) {
      console.error('Errore test modello:', err);
      return false;
    } finally {
      setTestingModel(null);
    }
  };

  const formatModelName = (modelName) => {
    // Rimuovi tag di versione se presente
    const name = modelName.split(':')[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  const getModelSize = (model) => {
    if (model.details?.parameter_size) {
      return model.details.parameter_size;
    }
    if (model.size) {
      // Converti bytes in formato leggibile
      const bytes = parseInt(model.size);
      if (bytes > 1024 * 1024 * 1024) {
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
      } else if (bytes > 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
      }
    }
    return 'N/A';
  };

  const getModelType = (modelName) => {
    const name = modelName.toLowerCase();
    if (name.includes('llama')) return 'LLaMA';
    if (name.includes('mistral')) return 'Mistral';
    if (name.includes('gemma')) return 'Gemma';
    if (name.includes('phi')) return 'Phi';
    if (name.includes('qwen')) return 'Qwen';
    if (name.includes('codellama')) return 'Code LLaMA';
    return 'Altri';
  };

  return (
    <>
      {/* Pulsante principale */}
      <Tooltip title="Seleziona modello AI">
        <IconButton
          onClick={() => setDialogOpen(true)}
          sx={{ 
            color: 'text.secondary', 
            '&:hover': { color: 'primary.main' },
            position: 'relative'
          }}
        >
          <ModelIcon />
          {loading && (
            <CircularProgress
              size={24}
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                marginTop: '-12px',
                marginLeft: '-12px',
              }}
            />
          )}
        </IconButton>
      </Tooltip>

      {/* Dialog selezione modello */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { minHeight: 500 }
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <ModelIcon color="primary" />
              <Typography variant="h6">Seleziona Modello AI</Typography>
            </Box>
            <IconButton onClick={loadModels} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Modello corrente */}
          <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'primary.50' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <CheckIcon color="primary" />
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Modello attivo
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {currentModel ? formatModelName(currentModel) : 'Nessuno'}
                </Typography>
              </Box>
            </Box>
          </Paper>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <List>
              {models.map((model, index) => {
                const isActive = model.name === currentModel;
                const isTesting = testingModel === model.name;
                
                return (
                  <React.Fragment key={model.name}>
                    <ListItem
                      sx={{
                        border: 1,
                        borderColor: isActive ? 'primary.main' : 'divider',
                        borderRadius: 2,
                        mb: 1,
                        bgcolor: isActive ? 'primary.50' : 'background.paper',
                        '&:hover': {
                          bgcolor: isActive ? 'primary.100' : 'grey.50'
                        }
                      }}
                    >
                      <ListItemIcon>
                        {isActive ? (
                          <CheckIcon color="primary" />
                        ) : (
                          <ModelIcon color="action" />
                        )}
                      </ListItemIcon>
                      
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                              {formatModelName(model.name)}
                            </Typography>
                            {isActive && (
                              <Chip
                                label="Attivo"
                                color="primary"
                                size="small"
                                variant="filled"
                              />
                            )}
                            <Chip
                              label={getModelType(model.name)}
                              size="small"
                              variant="outlined"
                            />
                          </Box>
                        }
                        secondary={
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">
                              {model.name}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <MemoryIcon sx={{ fontSize: 14 }} />
                                <Typography variant="caption">
                                  {getModelSize(model)}
                                </Typography>
                              </Box>
                              {model.modified_at && (
                                <Typography variant="caption" color="text.disabled">
                                  Aggiornato: {new Date(model.modified_at).toLocaleDateString()}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        }
                      />

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {!isActive && (
                          <>
                            {/* Pulsante test */}
                            <Button
                              size="small"
                              variant="outlined"
                              disabled={isTesting || changingModel}
                              onClick={() => testModel(model.name)}
                              startIcon={isTesting ? <CircularProgress size={16} /> : <SpeedIcon />}
                            >
                              {isTesting ? 'Test...' : 'Test'}
                            </Button>

                            {/* Pulsante seleziona */}
                            <Button
                              size="small"
                              variant="contained"
                              disabled={changingModel}
                              onClick={() => handleModelChange(model.name)}
                              startIcon={changingModel ? <CircularProgress size={16} /> : null}
                            >
                              {changingModel ? 'Cambio...' : 'Seleziona'}
                            </Button>
                          </>
                        )}
                      </Box>
                    </ListItem>

                    {index < models.length - 1 && <Divider sx={{ my: 1 }} />}
                  </React.Fragment>
                );
              })}
            </List>
          )}

          {!loading && models.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <ErrorIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Nessun modello trovato
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Assicurati che Ollama sia in esecuzione e che ci siano modelli installati
              </Typography>
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>
            Chiudi
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ModelSelector;