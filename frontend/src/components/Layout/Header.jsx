import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  IconButton,
  Chip,
  Paper,
  Popover,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Button,
  useTheme
} from '@mui/material';
import {
  Menu as MenuIcon,
  Description as DocumentIcon,
  Chat as ChatIcon,
  Settings as SettingsIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { healthAPI } from '../../api/client';
import ModelSelector from '../Models/ModelSelector';

const Header = ({ 
  currentView, 
  onViewChange, 
  documentsCount = 0, 
  onMenuClick, 
  showMenuButton = false 
}) => {
  const [healthStatus, setHealthStatus] = useState(null);
  const [showHealthDetails, setShowHealthDetails] = useState(false);
  const [healthAnchorEl, setHealthAnchorEl] = useState(null);
  const [currentModel, setCurrentModel] = useState('');
  const theme = useTheme();

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
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleHealthClick = (event) => {
    setHealthAnchorEl(event.currentTarget);
    setShowHealthDetails(true);
  };

  const handleHealthClose = () => {
    setHealthAnchorEl(null);
    setShowHealthDetails(false);
  };

  const handleModelChange = (newModel) => {
    setCurrentModel(newModel);
    console.log('Modello cambiato nel header:', newModel);
    // Qui potresti anche notificare altri componenti se necessario
  };

  const getStatusColor = () => {
    if (!healthStatus) return 'warning';
    return healthStatus.status === 'healthy' ? 'success' : 'error';
  };

  const getStatusText = () => {
    if (!healthStatus) return 'Controllo...';
    return healthStatus.status === 'healthy' ? 'Online' : 'Offline';
  };

  return (
    <AppBar 
      position="static" 
      color="inherit" 
      elevation={1}
      sx={{ 
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider'
      }}
    >
      <Toolbar>
        {/* Menu button per mobile */}
        {showMenuButton && (
          <IconButton
            edge="start"
            onClick={onMenuClick}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
        )}

        {/* Logo e titolo */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexGrow: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                bgcolor: 'primary.main',
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <DocumentIcon sx={{ color: 'white', fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                AI Assistant Documenti
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Interroga i tuoi PDF con intelligenza artificiale
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Navigazione desktop */}
        <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1, mr: 2 }}>
          <Button
            startIcon={<DocumentIcon />}
            onClick={() => onViewChange('documents')}
            variant={currentView === 'documents' ? 'contained' : 'text'}
            color="primary"
            sx={{ borderRadius: 2 }}
          >
            Documenti
            {documentsCount > 0 && (
              <Chip
                label={documentsCount}
                size="small"
                sx={{ ml: 1, height: 20, fontSize: '0.75rem' }}
                color="primary"
                variant={currentView === 'documents' ? 'filled' : 'outlined'}
              />
            )}
          </Button>
          
          <Button
            startIcon={<ChatIcon />}
            onClick={() => onViewChange('chat')}
            variant={currentView === 'chat' ? 'contained' : 'text'}
            color="primary"
            sx={{ borderRadius: 2 }}
          >
            Chat AI
          </Button>
        </Box>

        {/* Status e impostazioni */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Indicatore status */}
          <Button
            onClick={handleHealthClick}
            size="small"
            startIcon={
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  bgcolor: `${getStatusColor()}.main`,
                  position: 'relative',
                }}
              >
                {healthStatus?.status === 'healthy' && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      bgcolor: 'success.main',
                      animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
                      '@keyframes ping': {
                        '75%, 100%': {
                          transform: 'scale(2)',
                          opacity: 0,
                        },
                      },
                    }}
                  />
                )}
              </Box>
            }
            sx={{ 
              color: 'text.secondary',
              '&:hover': { color: 'text.primary' },
              display: { xs: 'none', sm: 'flex' }
            }}
          >
            {getStatusText()}
          </Button>

          {/* Selettore modello */}
          <ModelSelector onModelChange={handleModelChange} />

          {/* Impostazioni */}
          <IconButton
            sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
            title="Impostazioni"
          >
            <SettingsIcon />
          </IconButton>
        </Box>

        {/* Popover dettagli health */}
        <Popover
          open={showHealthDetails}
          anchorEl={healthAnchorEl}
          onClose={handleHealthClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
        >
          <Paper sx={{ width: 320, p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" component="h3">
                Status Sistema
              </Typography>
              <IconButton size="small" onClick={handleHealthClose}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
            
            {healthStatus ? (
              <List dense>
                <ListItem>
                  <ListItemText
                    primary="Status"
                    secondary={
                      <Chip
                        label={healthStatus.status === 'healthy' ? 'Operativo' : 'Errore'}
                        color={getStatusColor()}
                        size="small"
                      />
                    }
                  />
                </ListItem>
                {healthStatus.version && (
                  <ListItem>
                    <ListItemText
                      primary="Versione"
                      secondary={healthStatus.version}
                    />
                  </ListItem>
                )}
                {healthStatus.message && (
                  <ListItem>
                    <ListItemText
                      primary="Messaggio"
                      secondary={healthStatus.message}
                    />
                  </ListItem>
                )}
                <ListItem>
                  <ListItemText
                    primary="Backend"
                    secondary="FastAPI + Ollama"
                  />
                </ListItem>
                {currentModel && (
                  <ListItem>
                    <ListItemText
                      primary="Modello AI"
                      secondary={currentModel}
                    />
                  </ListItem>
                )}
              </List>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
                <CircularProgress size={20} />
                <Typography variant="body2" color="text.secondary">
                  Controllo status in corso...
                </Typography>
              </Box>
            )}
          </Paper>
        </Popover>
      </Toolbar>
    </AppBar>
  );
};

export default Header;