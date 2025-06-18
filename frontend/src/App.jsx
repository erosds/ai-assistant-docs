import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Drawer,
  AppBar,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Paper,
  Divider,
  Badge,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Description as DocumentIcon,
  Chat as ChatIcon
} from '@mui/icons-material';
import Header from './components/Layout/Header';
import UploadZone from './components/Upload/UploadZone';
import DocumentsList from './components/Documents/DocumentsList';
import ChatInterface from './components/Chat/ChatInterface';
import { documentsAPI } from './api/client';

const DRAWER_WIDTH = 280;

function App() {
  const [currentView, setCurrentView] = useState('documents');
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [documentsCount, setDocumentsCount] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

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
    if (view === 'chat' && !selectedDocument) {
      setCurrentView('documents');
      return;
    }
    setCurrentView(view);
    if (isMobile) {
      setMobileOpen(false);
    }
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

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const sidebarContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Logo */}
      <Box sx={{ p: 3, textAlign: 'center', borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h5" component="div" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          AI Docs
        </Typography>
      </Box>

      {/* Navigation */}
      <List sx={{ flexGrow: 1, px: 2, py: 1 }}>
        <ListItem disablePadding>
          <ListItemButton
            onClick={() => handleViewChange('documents')}
            selected={currentView === 'documents'}
            sx={{
              borderRadius: 2,
              mb: 1,
              '&.Mui-selected': {
                bgcolor: 'primary.50',
                color: 'primary.main',
                '&:hover': {
                  bgcolor: 'primary.100',
                },
              },
            }}
          >
            <ListItemIcon sx={{ color: currentView === 'documents' ? 'primary.main' : 'inherit' }}>
              <DocumentIcon />
            </ListItemIcon>
            <ListItemText 
              primary={
                <Box display="flex" alignItems="center" gap={1}>
                  <span>Documenti</span>
                  {documentsCount > 0 && (
                    <Badge badgeContent={documentsCount} color="primary" />
                  )}
                </Box>
              }
            />
          </ListItemButton>
        </ListItem>

        <ListItem disablePadding>
          <ListItemButton
            onClick={() => handleViewChange('chat')}
            disabled={!selectedDocument}
            selected={currentView === 'chat'}
            sx={{
              borderRadius: 2,
              '&.Mui-selected': {
                bgcolor: 'primary.50',
                color: 'primary.main',
                '&:hover': {
                  bgcolor: 'primary.100',
                },
              },
            }}
          >
            <ListItemIcon sx={{ color: currentView === 'chat' ? 'primary.main' : 'inherit' }}>
              <ChatIcon />
            </ListItemIcon>
            <ListItemText primary="Chat" />
          </ListItemButton>
        </ListItem>
      </List>

      {/* Footer */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Typography variant="caption" color="text.secondary">
          Powered by FastAPI + Ollama
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <Box
        component="nav"
        sx={{
          width: { md: DRAWER_WIDTH },
          flexShrink: { md: 0 }
        }}
      >
        {isMobile ? (
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{
              keepMounted: true,
            }}
            sx={{
              '& .MuiDrawer-paper': {
                boxSizing: 'border-box',
                width: DRAWER_WIDTH,
              },
            }}
          >
            {sidebarContent}
          </Drawer>
        ) : (
          <Drawer
            variant="permanent"
            sx={{
              '& .MuiDrawer-paper': {
                boxSizing: 'border-box',
                width: DRAWER_WIDTH,
                position: 'relative',
              },
            }}
            open
          >
            {sidebarContent}
          </Drawer>
        )}
      </Box>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          bgcolor: 'background.default',
          minHeight: '100vh',
        }}
      >
        <Header
          currentView={currentView}
          onViewChange={handleViewChange}
          documentsCount={documentsCount}
          onMenuClick={handleDrawerToggle}
          showMenuButton={isMobile}
        />

        <Container maxWidth="xl" sx={{ py: 3, height: 'calc(100vh - 64px)', overflow: 'auto' }}>
          {currentView === 'documents' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, height: '100%' }}>
              {/* Upload Section */}
              <Paper sx={{ p: 3 }}>
                <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: 600 }}>
                  Carica nuovo documento
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                  Carica un file PDF per iniziare a chattare con il tuo documento
                </Typography>
                <UploadZone
                  onUploadComplete={handleUploadComplete}
                  onUploadStart={(file) => console.log('Inizio upload:', file.name)}
                />
              </Paper>

              {/* Documents List Section */}
              <Paper sx={{ p: 3, flexGrow: 1, overflow: 'auto' }}>
                <DocumentsList
                  onSelectDocument={handleSelectDocument}
                  onDeleteDocument={handleDeleteDocument}
                  refreshTrigger={refreshTrigger}
                />
              </Paper>
            </Box>
          )}

          {currentView === 'chat' && selectedDocument && (
            <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <ChatInterface
                document={selectedDocument}
                onBack={handleBackFromChat}
              />
            </Paper>
          )}
        </Container>
      </Box>
    </Box>
  );
}

export default App;