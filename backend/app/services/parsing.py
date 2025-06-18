import fitz  # PyMuPDF
from typing import List, Dict, Optional, Tuple
import re
import logging
from pathlib import Path
import hashlib

logger = logging.getLogger(__name__)

class PDFParser:
    """Parser per documenti PDF"""
    
    def __init__(self):
        self.supported_extensions = ['.pdf']
    
    def is_supported_file(self, filename: str) -> bool:
        """Verifica se il file è supportato"""
        return Path(filename).suffix.lower() in self.supported_extensions
    
    async def extract_text_from_pdf(self, file_path: str) -> Dict[str, any]:
        """
        Estrae testo da un file PDF
        
        Returns:
            Dict con testo, metadati e informazioni sulle pagine
        """
        try:
            doc = fitz.open(file_path)
            
            # Metadati documento
            metadata = {
                'title': doc.metadata.get('title', ''),
                'author': doc.metadata.get('author', ''),
                'subject': doc.metadata.get('subject', ''),
                'creator': doc.metadata.get('creator', ''),
                'producer': doc.metadata.get('producer', ''),
                'creation_date': doc.metadata.get('creationDate', ''),
                'modification_date': doc.metadata.get('modDate', ''),
                'page_count': doc.page_count
            }
            
            # Estrai testo da ogni pagina
            pages_content = []
            full_text = ""
            
            for page_num in range(doc.page_count):
                page = doc[page_num]
                
                # Estrai testo
                page_text = page.get_text()
                
                # Pulisci testo
                cleaned_text = self._clean_text(page_text)
                
                if cleaned_text.strip():  # Solo se la pagina ha contenuto
                    page_info = {
                        'page_number': page_num + 1,
                        'text': cleaned_text,
                        'char_count': len(cleaned_text),
                        'word_count': len(cleaned_text.split())
                    }
                    pages_content.append(page_info)
                    full_text += f"\n\n--- PAGINA {page_num + 1} ---\n{cleaned_text}"
            
            doc.close()
            
            # Statistiche finali
            total_chars = len(full_text)
            total_words = len(full_text.split())
            
            result = {
                'success': True,
                'full_text': full_text,
                'pages': pages_content,
                'metadata': metadata,
                'statistics': {
                    'total_pages': len(pages_content),
                    'total_characters': total_chars,
                    'total_words': total_words,
                    'average_words_per_page': total_words / len(pages_content) if pages_content else 0
                }
            }
            
            logger.info(f"✅ PDF estratto: {len(pages_content)} pagine, {total_words} parole")
            return result
            
        except Exception as e:
            logger.error(f"❌ Errore estrazione PDF {file_path}: {e}")
            return {
                'success': False,
                'error': str(e),
                'full_text': '',
                'pages': [],
                'metadata': {},
                'statistics': {}
            }
    
    def _clean_text(self, text: str) -> str:
        """Pulisce il testo estratto"""
        if not text:
            return ""
        
        # Rimuovi caratteri di controllo
        text = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', text)
        
        # Normalizza spazi multipli
        text = re.sub(r'\s+', ' ', text)
        
        # Rimuovi righe vuote multiple
        text = re.sub(r'\n\s*\n', '\n\n', text)
        
        # Rimuovi spazi all'inizio e fine
        text = text.strip()
        
        return text
    
    def get_content_preview(self, full_text: str, max_length: int = 500) -> str:
        """Genera anteprima del contenuto"""
        if len(full_text) <= max_length:
            return full_text
        
        # Trova un punto di taglio naturale (fine frase)
        truncated = full_text[:max_length]
        last_sentence = truncated.rfind('.')
        
        if last_sentence > max_length * 0.7:  # Se il punto è ragionevolmente vicino
            return truncated[:last_sentence + 1] + "..."
        else:
            return truncated + "..."

class TextChunker:
    """Divide il testo in chunk per l'embedding"""
    
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
    
    def chunk_text(self, text: str, document_name: str = "") -> List[Dict[str, any]]:
        """
        Divide il testo in chunk
        
        Args:
            text: Testo da dividere
            document_name: Nome del documento per metadati
            
        Returns:
            Lista di chunk con metadati
        """
        if not text or not text.strip():
            return []
        
        # Dividi per paragrafi prima
        paragraphs = self._split_into_paragraphs(text)
        
        chunks = []
        chunk_id = 0
        
        current_chunk = ""
        current_chunk_start = 0
        
        for paragraph in paragraphs:
            # Se il paragrafo è troppo lungo, dividilo
            if len(paragraph) > self.chunk_size:
                # Salva chunk corrente se non vuoto
                if current_chunk.strip():
                    chunks.append(self._create_chunk(
                        current_chunk, chunk_id, document_name, current_chunk_start
                    ))
                    chunk_id += 1
                
                # Dividi paragrafo lungo
                para_chunks = self._split_long_paragraph(paragraph)
                for para_chunk in para_chunks:
                    chunks.append(self._create_chunk(
                        para_chunk, chunk_id, document_name, len(text)
                    ))
                    chunk_id += 1
                
                current_chunk = ""
                current_chunk_start = len(text)
                
            # Se aggiungere il paragrafo supera la dimensione
            elif len(current_chunk) + len(paragraph) > self.chunk_size:
                # Salva chunk corrente
                if current_chunk.strip():
                    chunks.append(self._create_chunk(
                        current_chunk, chunk_id, document_name, current_chunk_start
                    ))
                    chunk_id += 1
                
                # Inizia nuovo chunk con overlap
                if chunks and self.chunk_overlap > 0:
                    prev_chunk = chunks[-1]['content']
                    overlap_text = prev_chunk[-self.chunk_overlap:]
                    current_chunk = overlap_text + "\n\n" + paragraph
                else:
                    current_chunk = paragraph
                
                current_chunk_start = len(text) - len(current_chunk)
                
            else:
                # Aggiungi paragrafo al chunk corrente
                if current_chunk:
                    current_chunk += "\n\n" + paragraph
                else:
                    current_chunk = paragraph
                    current_chunk_start = len(text) - len(current_chunk)
        
        # Aggiungi ultimo chunk se non vuoto
        if current_chunk.strip():
            chunks.append(self._create_chunk(
                current_chunk, chunk_id, document_name, current_chunk_start
            ))
        
        logger.info(f"✅ Testo diviso in {len(chunks)} chunk")
        return chunks
    
    def _split_into_paragraphs(self, text: str) -> List[str]:
        """Divide il testo in paragrafi"""
        # Dividi per doppio newline o marcatori di pagina
        paragraphs = re.split(r'\n\s*\n|--- PAGINA \d+ ---', text)
        
        # Pulisci e filtra paragrafi vuoti
        paragraphs = [p.strip() for p in paragraphs if p.strip()]
        
        return paragraphs
    
    def _split_long_paragraph(self, paragraph: str) -> List[str]:
        """Divide un paragrafo troppo lungo"""
        # Prova a dividere per frasi
        sentences = re.split(r'[.!?]+\s+', paragraph)
        
        chunks = []
        current_chunk = ""
        
        for sentence in sentences:
            if len(current_chunk) + len(sentence) > self.chunk_size:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = sentence
            else:
                if current_chunk:
                    current_chunk += ". " + sentence
                else:
                    current_chunk = sentence
        
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        return chunks
    
    def _create_chunk(self, content: str, chunk_id: int, document_name: str, start_pos: int) -> Dict[str, any]:
        """Crea un oggetto chunk con metadati"""
        # Genera hash per il chunk
        chunk_hash = hashlib.md5(content.encode()).hexdigest()
        
        return {
            'chunk_id': chunk_id,
            'content': content.strip(),
            'document_name': document_name,
            'char_count': len(content),
            'word_count': len(content.split()),
            'start_position': start_pos,
            'chunk_hash': chunk_hash
        }

# Istanze globali
pdf_parser = PDFParser()
text_chunker = TextChunker()

def get_pdf_parser() -> PDFParser:
    """Ottieni istanza PDFParser"""
    return pdf_parser

def get_text_chunker() -> TextChunker:
    """Ottieni istanza TextChunker"""
    return text_chunker