#!/usr/bin/env python3
"""
Enhanced Manga Bookshelf Generator V4

High-performance, configurable manga bookshelf generator with:
- Recursive image searching (fixes frontpage detection issues)
- No artificial limits (processes all manga)  
- Configurable index-mb.html generation
- Detailed performance metrics
- Clean, readable code structure

Author: mastersamasama
Version: 4.0
"""

import os
import sys
import logging
import time
from pathlib import Path
from typing import List, Dict, Optional, Set, Tuple
from dataclasses import dataclass, field
from concurrent.futures import ThreadPoolExecutor, as_completed
import mimetypes
from datetime import datetime


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@dataclass
class BookItem:
    """Represents a manga book with its metadata."""
    title: str
    folder_path: Path
    cover_image: Optional[str]
    reader_link: str
    page_count: int
    subfolders: int = 0


@dataclass 
class GenerationConfig:
    """Configuration for bookshelf generation."""
    base_path: Path
    generate_readers: bool = True
    output_filename: str = "index.html"
    max_workers: int = 4
    enable_metrics: bool = True


@dataclass
class PerformanceMetrics:
    """Tracks detailed performance metrics."""
    start_time: float = field(default_factory=time.perf_counter)
    scan_start: float = 0.0
    html_start: float = 0.0
    scan_time: float = 0.0
    image_search_time: float = 0.0
    html_generation_time: float = 0.0
    total_books: int = 0
    books_with_images: int = 0
    books_without_images: int = 0
    total_images_found: int = 0
    
    def mark_scan_complete(self):
        current_time = time.perf_counter()
        self.scan_time = current_time - self.start_time
        self.html_start = current_time
    
    def mark_html_complete(self):
        if self.html_start > 0:
            self.html_generation_time = time.perf_counter() - self.html_start
        else:
            # Fallback if html_start wasn't set properly
            self.html_generation_time = 0.001  # Set minimum time to show it ran
    
    def get_total_time(self) -> float:
        return time.perf_counter() - self.start_time
    
    def print_summary(self):
        total = self.get_total_time()
        
        # Calculate accounted time and remaining time
        accounted_time = self.scan_time + self.image_search_time + self.html_generation_time
        other_time = total - accounted_time
        
        print(f"\n{'='*50}")
        print(f"PERFORMANCE METRICS")
        print(f"{'='*50}")
        print(f"Total Time: {total:.3f}s")
        print(f"Scan Time: {self.scan_time:.3f}s ({self.scan_time/total*100:.1f}%)")
        print(f"Image Search: {self.image_search_time:.3f}s ({self.image_search_time/total*100:.1f}%)")
        print(f"HTML Generation: {self.html_generation_time:.3f}s ({self.html_generation_time/total*100:.1f}%)")
        if other_time > 0.001:  # Show other time if significant
            print(f"Other Operations: {other_time:.3f}s ({other_time/total*100:.1f}%)")
        print(f"Total Books: {self.total_books}")
        print(f"Books with Images: {self.books_with_images}")
        print(f"Books without Images: {self.books_without_images}")
        print(f"Total Images Found: {self.total_images_found}")
        if self.total_books > 0:
            print(f"Success Rate: {self.books_with_images/self.total_books*100:.1f}%")
            print(f"Books/Second: {self.total_books/total:.1f}")
        print(f"{'='*50}")


class ImageSearchEngine:
    """High-performance recursive image finder (based on original logic)."""
    
    SUPPORTED_EXTENSIONS: Set[str] = {
        'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'avif'
    }
    
    @classmethod
    def find_first_image(cls, folder_path: Path, base_path: Path) -> Optional[str]:
        """
        Find the first image using the original recursive logic.
        
        This mimics the original get_first_picture() function:
        1. First check direct files in folder
        2. Then recursively check all subfolders
        
        Args:
            folder_path: Path to search for images
            base_path: Base path for relative path calculation
            
        Returns:
            Relative path to first image found, or None
        """
        try:
            # Step 1: Check direct files first (original behavior)
            files = list(folder_path.iterdir())
            for file in sorted(files):
                if file.is_file() and cls._is_image(file):
                    return str(file.relative_to(base_path)).replace('\\', '/')
            
            # Step 2: Recursively check all subfolders (original behavior)
            subfolders = [f for f in files if f.is_dir()]
            for subfolder in sorted(subfolders):
                image = cls.find_first_image(subfolder, base_path)
                if image:
                    return image
                    
        except (PermissionError, OSError) as e:
            logger.warning(f"Cannot access {folder_path}: {e}")
            
        return None
    
    @classmethod
    def _is_image(cls, file_path: Path) -> bool:
        """Check if file is a supported image format."""
        extension = file_path.suffix.lower().lstrip('.')
        return extension in cls.SUPPORTED_EXTENSIONS


class ReaderFileFinder:
    """Finds reader HTML files with priority ordering."""
    
    READER_PRIORITIES = ['index-mb-virtualscroll.html', 'index-mb.html', 'index.html', 'index-mobile.html']
    
    @classmethod
    def find_reader_file(cls, folder: Path, base_path: Path) -> Optional[str]:
        """
        Find the main reader HTML file with priority ordering.
        Based on original get_dedecated_file() logic with index-mb.html priority.
        """
        # Priority order for reader files
        for priority_file in cls.READER_PRIORITIES:
            file_path = folder / priority_file
            if file_path.exists():
                return str(file_path.relative_to(base_path)).replace('\\', '/')
        
        # Fallback: any HTML file
        try:
            for file in folder.iterdir():
                if file.suffix.lower() == '.html':
                    return str(file.relative_to(base_path)).replace('\\', '/')
        except (PermissionError, OSError):
            pass
        
        return None


class BookshelfScanner:
    """High-performance manga collection scanner."""
    
    def __init__(self, config: GenerationConfig):
        self.config = config
        self.metrics = PerformanceMetrics() if config.enable_metrics else None
    
    def scan_books(self) -> List[BookItem]:
        """
        Scan for all manga books in the base directory (NO LIMITS).
        
        Returns:
            List of all BookItem objects found
        """
        books = []
        
        try:
            # Get all subdirectories (use original os.listdir() order)
            import os
            folder_names = os.listdir(str(self.config.base_path))
            subdirs = []
            for name in folder_names:
                path = self.config.base_path / name
                if path.is_dir():
                    subdirs.append(path)
            
            if self.metrics:
                self.metrics.total_books = len(subdirs)
            
            logger.info(f"Scanning {len(subdirs)} manga directories...")
            
            # Always use sequential processing to maintain original order
            # (Parallel processing would break the filesystem ordering)
            books = self._scan_sequential(subdirs)
                
        except Exception as e:
            logger.error(f"Error scanning books: {e}")
            
        if self.metrics:
            self.metrics.mark_scan_complete()
            
        logger.info(f"Found {len(books)} books with valid covers")
        return books
    
    def _scan_sequential(self, subdirs: List[Path]) -> List[BookItem]:
        """Sequential book scanning."""
        books = []
        for i, folder in enumerate(subdirs, 1):
            if i % 50 == 0:  # Progress indicator for large collections
                logger.info(f"Processed {i}/{len(subdirs)} folders...")
                
            book = self._analyze_book_folder(folder)
            if book:
                books.append(book)
                if self.metrics:
                    if book.cover_image:
                        self.metrics.books_with_images += 1
                    else:
                        self.metrics.books_without_images += 1
                    # Add all page images to total count
                    self.metrics.total_images_found += book.page_count
        return books
    
    def _scan_parallel(self, subdirs: List[Path]) -> List[BookItem]:
        """Parallel book scanning for better performance."""
        books = []
        processed = 0
        
        with ThreadPoolExecutor(max_workers=self.config.max_workers) as executor:
            future_to_folder = {
                executor.submit(self._analyze_book_folder, folder): folder 
                for folder in subdirs
            }
            
            for future in as_completed(future_to_folder):
                processed += 1
                if processed % 50 == 0:
                    logger.info(f"Processed {processed}/{len(subdirs)} folders...")
                
                try:
                    book = future.result()
                    if book:
                        books.append(book)
                        if self.metrics:
                            if book.cover_image:
                                self.metrics.books_with_images += 1
                            else:
                                self.metrics.books_without_images += 1
                            # Add all page images to total count
                            self.metrics.total_images_found += book.page_count
                except Exception as e:
                    folder = future_to_folder[future]
                    logger.warning(f"Error processing {folder}: {e}")
        
        return books
    
    def _analyze_book_folder(self, folder: Path) -> Optional[BookItem]:
        """Analyze a single book folder and create BookItem."""
        try:
            # Count pages and subfolders first
            page_count, subfolder_count = self._count_content(folder)
            
            # Auto-generate virtual scroll reader for large collections
            reader_link = self._ensure_optimal_reader(folder, page_count)
            if not reader_link:
                return None
            
            # Find cover image using original recursive logic
            img_start = time.perf_counter()
            cover_image = ImageSearchEngine.find_first_image(folder, self.config.base_path)
            if self.metrics:
                self.metrics.image_search_time += time.perf_counter() - img_start
            
            # Extract title from folder name (original logic)
            title = self._extract_title(folder.name)
            
            return BookItem(
                title=title,
                folder_path=folder,
                cover_image=cover_image,
                reader_link=reader_link,
                page_count=page_count,
                subfolders=subfolder_count
            )
            
        except Exception as e:
            logger.warning(f"Error analyzing folder {folder}: {e}")
            return None
    
    def _ensure_optimal_reader(self, folder: Path, page_count: int) -> Optional[str]:
        """Ensure optimal reader exists (virtual scroll for large collections)."""
        # Check for existing readers
        existing_reader = ReaderFileFinder.find_reader_file(folder, self.config.base_path)
        
        # Determine if virtual scroll is needed
        needs_virtual_scroll = page_count > 5000
        virtual_scroll_exists = (folder / "index-mb-virtualscroll.html").exists()
        
        if needs_virtual_scroll and not virtual_scroll_exists:
            # Generate virtual scroll reader for large collection
            logger.info(f"Generating virtual scroll reader for {folder.name} ({page_count} pages)")
            try:
                # Import with absolute path
                import sys
                import importlib.util
                
                script_dir = Path(__file__).parent
                virtualscroll_path = script_dir / "htmlcmb_v3_virtualscroll.py"
                
                if virtualscroll_path.exists():
                    spec = importlib.util.spec_from_file_location("htmlcmb_v3_virtualscroll", virtualscroll_path)
                    htmlcmb_v3_virtualscroll = importlib.util.module_from_spec(spec)
                    spec.loader.exec_module(htmlcmb_v3_virtualscroll)
                    
                    htmlcmb_v3_virtualscroll.create_virtual_scroll_reader(str(folder))
                    # Return full relative path
                    virtual_file = folder / "index-mb-virtualscroll.html"
                    return str(virtual_file.relative_to(self.config.base_path)).replace('\\', '/')
                else:
                    logger.warning(f"Virtual scroll script not found: {virtualscroll_path}")
            except Exception as e:
                logger.warning(f"Failed to generate virtual scroll reader for {folder}: {e}")
        
        # Use virtual scroll if available for large collections
        if needs_virtual_scroll and virtual_scroll_exists:
            virtual_file = folder / "index-mb-virtualscroll.html"
            return str(virtual_file.relative_to(self.config.base_path)).replace('\\', '/')
        
        # Fall back to existing reader
        return existing_reader
    
    def _extract_title(self, folder_name: str) -> str:
        """Extract title using original htmlcs.py logic: take LAST part after splitting by dots."""
        # Original logic: books.split('/')[-1].split('.')[-1]
        # This takes the LAST part after splitting by dots
        title = folder_name.split('.')[-1]
        
        # Clean up underscores (keeping this improvement)
        title = title.replace('_', ' ').strip()
        
        # If empty after processing, use original folder name
        if not title:
            title = folder_name
        
        return title
    
    def _count_content(self, folder: Path) -> Tuple[int, int]:
        """Count pages and subfolders."""
        page_count = 0
        subfolder_count = 0
        
        try:
            for item in folder.rglob('*'):
                if item.is_file() and ImageSearchEngine._is_image(item):
                    page_count += 1
                elif item.is_dir() and item.parent == folder:
                    subfolder_count += 1
        except:
            pass
            
        return page_count, subfolder_count


class ModernBookshelfHTMLGenerator:
    """Generates modern, responsive HTML bookshelf."""
    
    def __init__(self, books: List[BookItem], config: GenerationConfig, metrics: Optional[PerformanceMetrics] = None):
        self.books = books
        self.config = config
        self.metrics = metrics
    
    def generate(self) -> Path:
        """Generate the bookshelf HTML file."""
        output_path = self.config.base_path / self.config.output_filename
        
        try:
            html_content = self._build_html()
            
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(html_content)
                
            if self.metrics:
                self.metrics.mark_html_complete()
                
            logger.info(f"Generated bookshelf: {output_path}")
            return output_path
            
        except Exception as e:
            logger.error(f"Error generating HTML: {e}")
            raise
    
    def _build_html(self) -> str:
        """Build complete HTML content."""
        return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#0a0a0a">
    <title>Manga Bookshelf</title>
    {self._get_styles()}
</head>
<body data-theme="dark">
    {self._get_header()}
    {self._get_bookshelf()}
    {self._get_javascript()}
</body>
</html>"""
    
    def _get_styles(self) -> str:
        """Generate modern CSS styles."""
        return """<style>
        :root {
            /* Dark theme colors */
            --bg-primary: #0a0a0a;
            --bg-surface: #1a1a1a;
            --bg-elevated: #2a2a2a;
            --text-primary: #ffffff;
            --text-secondary: #b3b3b3;
            --text-tertiary: #666666;
            --accent: #00d4ff;
            --accent-hover: #00b8e6;
            --border: rgba(255,255,255,0.1);
            
            /* Spacing and layout */
            --border-radius: 12px;
            --shadow: 0 4px 12px rgba(0,0,0,0.4);
            --transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        [data-theme="light"] {
            --bg-primary: #ffffff;
            --bg-surface: #f8f9fa;
            --bg-elevated: #ffffff;
            --text-primary: #1a1a1a;
            --text-secondary: #666666;
            --text-tertiary: #999999;
            --accent: #0066cc;
            --accent-hover: #0052a3;
            --border: rgba(0,0,0,0.1);
            --shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.6;
            min-height: 100vh;
            transition: all var(--transition);
        }

        /* Header */
        .header {
            padding: 2rem 1rem;
            text-align: center;
            background: linear-gradient(135deg, var(--bg-surface), var(--bg-elevated));
            border-bottom: 1px solid var(--border);
        }

        .title {
            font-size: clamp(2.5rem, 5vw, 4rem);
            font-weight: 700;
            background: linear-gradient(135deg, var(--accent), #ff6b35);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 0.5rem;
        }

        .subtitle {
            color: var(--text-secondary);
            font-size: 1.1rem;
            margin-bottom: 1.5rem;
        }

        .controls {
            display: flex;
            gap: 1rem;
            justify-content: center;
            align-items: center;
            flex-wrap: wrap;
        }

        .theme-toggle {
            background: var(--bg-elevated);
            border: 1px solid var(--border);
            border-radius: var(--border-radius);
            color: var(--text-primary);
            padding: 0.75rem 1.5rem;
            cursor: pointer;
            font-size: 0.9rem;
            transition: all var(--transition);
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .theme-toggle:hover {
            background: var(--accent);
            color: white;
            transform: translateY(-2px);
        }

        .book-count {
            color: var(--text-secondary);
            font-size: 0.9rem;
            padding: 0.75rem;
        }

        /* Bookshelf Grid */
        .bookshelf {
            padding: 2rem 1rem;
            max-width: 1400px;
            margin: 0 auto;
        }

        .books-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 1.5rem;
            animation: fadeInUp 0.6s ease-out;
        }

        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        /* Book Items */
        .book-item {
            background: var(--bg-surface);
            border: 1px solid var(--border);
            border-radius: var(--border-radius);
            overflow: hidden;
            transition: all var(--transition);
            cursor: pointer;
            position: relative;
        }

        .book-item:hover {
            transform: translateY(-4px) scale(1.02);
            box-shadow: var(--shadow);
            border-color: var(--accent);
        }

        .book-link {
            display: block;
            text-decoration: none;
            color: inherit;
            height: 100%;
        }

        .cover-container {
            position: relative;
            aspect-ratio: 3/4;
            overflow: hidden;
            background: var(--bg-elevated);
        }

        .cover-image {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: transform var(--transition);
            opacity: 0;
        }

        .cover-image.loaded {
            opacity: 1;
        }

        .book-item:hover .cover-image {
            transform: scale(1.05);
        }

        .loading-placeholder {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--bg-elevated);
            color: var(--text-tertiary);
            font-size: 0.9rem;
        }

        .no-image-placeholder {
            background: linear-gradient(135deg, var(--bg-elevated), var(--bg-surface));
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: var(--text-tertiary);
            font-size: 0.9rem;
        }

        .page-count-badge {
            position: absolute;
            top: 0.75rem;
            right: 0.75rem;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 0.25rem 0.5rem;
            border-radius: 6px;
            font-size: 0.75rem;
            font-weight: 600;
            backdrop-filter: blur(4px);
        }

        .book-info {
            padding: 1rem;
        }

        .book-title {
            font-size: 1rem;
            font-weight: 600;
            margin-bottom: 0.5rem;
            line-height: 1.3;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            color: var(--text-primary);
        }

        .book-meta {
            display: flex;
            justify-content: space-between;
            align-items: center;
            color: var(--text-secondary);
            font-size: 0.85rem;
        }

        /* Loading Animation */
        .loading-spinner {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 2px solid var(--text-tertiary);
            border-radius: 50%;
            border-top-color: var(--accent);
            animation: spin 1s ease-in-out infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        /* Responsive Design */
        @media (max-width: 768px) {
            .books-grid {
                grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
                gap: 1rem;
            }
            
            .bookshelf {
                padding: 1rem 0.5rem;
            }
            
            .controls {
                flex-direction: column;
                gap: 0.75rem;
            }
        }

        @media (max-width: 480px) {
            .books-grid {
                grid-template-columns: repeat(2, 1fr);
                gap: 0.75rem;
            }
            
            .book-info {
                padding: 0.75rem;
            }
            
            .book-title {
                font-size: 0.9rem;
            }
        }

        /* Accessibility */
        @media (prefers-reduced-motion: reduce) {
            * {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
            }
        }

        .book-item:focus-visible {
            outline: 2px solid var(--accent);
            outline-offset: 2px;
        }
    </style>"""
    
    def _get_header(self) -> str:
        """Generate header section."""
        books_with_images = len([b for b in self.books if b.cover_image])
        books_without_images = len(self.books) - books_with_images
        
        return f"""<header class="header">
        <h1 class="title">Manga Bookshelf</h1>
        <p class="subtitle">Complete collection of your favorite manga</p>
        <div class="controls">
            <button class="theme-toggle" id="themeToggle">
                <span id="themeIcon">🌙</span>
                <span>Dark Mode</span>
            </button>
            <div class="book-count">{len(self.books)} books ({books_with_images} with covers)</div>
        </div>
    </header>"""
    
    def _get_bookshelf(self) -> str:
        """Generate bookshelf grid."""
        books_html = []
        
        for book in self.books:
            page_text = f"{book.page_count} pages" if book.page_count > 0 else "Unknown"
            
            # Handle books without cover images
            if book.cover_image:
                cover_content = f'''
                        <div class="loading-placeholder">
                            <div class="loading-spinner"></div>
                        </div>
                        <img 
                            class="cover-image" 
                            data-src="{book.cover_image}"
                            alt="{book.title} cover"
                            loading="lazy"
                        >'''
            else:
                cover_content = f'''
                        <div class="no-image-placeholder">
                            <div>📚</div>
                            <div>No Cover</div>
                        </div>'''
            
            books_html.append(f"""
            <article class="book-item" tabindex="0">
                <a href="{book.reader_link}" class="book-link">
                    <div class="cover-container">
                        {cover_content}
                        <div class="page-count-badge">{page_text}</div>
                    </div>
                    <div class="book-info">
                        <h2 class="book-title">{book.title}</h2>
                        <div class="book-meta">
                            <span>Manga</span>
                            <span>📖 Read</span>
                        </div>
                    </div>
                </a>
            </article>""")
        
        books_content = '\n'.join(books_html)
        
        return f"""<main class="bookshelf">
        <section class="books-grid">
            {books_content}
        </section>
    </main>"""
    
    def _get_javascript(self) -> str:
        """Generate JavaScript functionality."""
        return """<script>
        class BookshelfManager {
            constructor() {
                this.theme = localStorage.getItem('bookshelf-theme') || 'dark';
                this.init();
            }
            
            init() {
                this.setupTheme();
                this.setupLazyLoading();
                this.setupEventListeners();
            }
            
            setupTheme() {
                document.body.setAttribute('data-theme', this.theme);
                const themeToggle = document.getElementById('themeToggle');
                const themeIcon = document.getElementById('themeIcon');
                
                if (themeToggle && themeIcon) {
                    themeIcon.textContent = this.theme === 'dark' ? '🌙' : '☀️';
                    themeToggle.querySelector('span:last-child').textContent = 
                        this.theme === 'dark' ? 'Dark Mode' : 'Light Mode';
                }
            }
            
            setupLazyLoading() {
                const images = document.querySelectorAll('.cover-image[data-src]');
                
                if ('IntersectionObserver' in window) {
                    const imageObserver = new IntersectionObserver((entries) => {
                        entries.forEach(entry => {
                            if (entry.isIntersecting) {
                                const img = entry.target;
                                this.loadImage(img);
                                imageObserver.unobserve(img);
                            }
                        });
                    }, {
                        rootMargin: '50px 0px'
                    });
                    
                    images.forEach(img => imageObserver.observe(img));
                } else {
                    // Fallback for older browsers
                    images.forEach(img => this.loadImage(img));
                }
            }
            
            loadImage(img) {
                img.src = img.dataset.src;
                img.onload = () => {
                    img.classList.add('loaded');
                    const placeholder = img.parentElement.querySelector('.loading-placeholder');
                    if (placeholder) {
                        placeholder.style.display = 'none';
                    }
                };
                img.onerror = () => {
                    const placeholder = img.parentElement.querySelector('.loading-placeholder');
                    if (placeholder) {
                        placeholder.innerHTML = '<div>❌</div><div>Error</div>';
                    }
                };
            }
            
            setupEventListeners() {
                const themeToggle = document.getElementById('themeToggle');
                if (themeToggle) {
                    themeToggle.addEventListener('click', () => this.toggleTheme());
                }
                
                // Keyboard navigation for book items
                document.querySelectorAll('.book-item').forEach(item => {
                    item.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            const link = item.querySelector('.book-link');
                            if (link) {
                                link.click();
                            }
                        }
                    });
                });
            }
            
            toggleTheme() {
                this.theme = this.theme === 'dark' ? 'light' : 'dark';
                localStorage.setItem('bookshelf-theme', this.theme);
                this.setupTheme();
            }
        }
        
        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => new BookshelfManager());
        } else {
            new BookshelfManager();
        }
    </script>"""


class BookshelfGenerator:
    """Main orchestrator for bookshelf generation."""
    
    def __init__(self, base_path: str | Path, **kwargs):
        self.config = GenerationConfig(
            base_path=Path(base_path).resolve(),
            generate_readers=kwargs.get('generate_readers', True),
            output_filename=kwargs.get('output_filename', 'index.html'),
            max_workers=kwargs.get('max_workers', 4),
            enable_metrics=kwargs.get('enable_metrics', True)
        )
        
        # Validation
        if not self.config.base_path.exists():
            raise FileNotFoundError(f"Directory not found: {self.config.base_path}")
        if not self.config.base_path.is_dir():
            raise NotADirectoryError(f"Path is not a directory: {self.config.base_path}")
    
    def generate(self) -> Path:
        """Generate the complete bookshelf."""
        logger.info(f"Starting bookshelf generation for: {self.config.base_path}")
        
        try:
            # Scan for books (NO LIMITS)
            scanner = BookshelfScanner(self.config)
            books = scanner.scan_books()
            
            if not books:
                logger.warning("No books found!")
                return None
            
            # Generate index-mb.html files if requested
            if self.config.generate_readers:
                self._generate_readers()
            
            # Generate HTML bookshelf
            generator = ModernBookshelfHTMLGenerator(books, self.config, scanner.metrics)
            output_path = generator.generate()
            
            # Print performance metrics
            if self.config.enable_metrics and scanner.metrics:
                scanner.metrics.print_summary()
            
            return output_path
            
        except Exception as e:
            logger.error(f"Error generating bookshelf: {e}")
            raise
    
    def _generate_readers(self):
        """Generate index-mb.html files for all manga."""
        logger.info("Generating reader files...")
        try:            
            from htmlcmb_v3 import MangaReaderGenerator
            
            subdirs = [d for d in self.config.base_path.iterdir() if d.is_dir()]
            logger.info(f"Generating readers for {len(subdirs)} manga...")
            
            for i, folder in enumerate(subdirs, 1):
                try:
                    if i % 50 == 0:  # Progress indicator
                        logger.info(f"Generated readers for {i}/{len(subdirs)} manga...")
                    generator = MangaReaderGenerator(folder)
                    generator.generate()
                except Exception as e:
                    logger.warning(f"Failed to generate reader for {folder}: {e}")
                    
            logger.info(f"Completed reader generation for {len(subdirs)} manga")
        except ImportError as e:
            logger.warning(f"htmlcmb_v3.py not found - skipping reader generation: {e}")


def main():
    """Command-line interface."""
    print("Enhanced Manga Bookshelf Generator V4")
    print("=" * 50)
    
    while True:
        try:
            print("\nConfiguration:")
            path_input = input("Collection path (Enter for default './本'): ").strip()
            
            if not path_input:
                path_input = "./本"
                print(f"Using default path: {path_input}")
            
            # Remove quotes
            path_input = path_input.strip('\'"')
            
            # Ask for options
            try:
                generate_readers_input = input("Generate reader files? (Y/n): ").strip().lower()
                generate_readers = generate_readers_input != 'n'  # Default to True, False only if 'n'
            except EOFError:
                generate_readers = True  # Default to True when no input
                print("Using default: Yes")
            
            try:
                output_name = input("Output filename (default: index.html): ").strip() or "index.html"
            except EOFError:
                output_name = "index.html"
                print("Using default: index.html")
            
            # Generate bookshelf
            generator = BookshelfGenerator(
                path_input,
                generate_readers=generate_readers,
                output_filename=output_name,
                enable_metrics=True
            )
            
            output_path = generator.generate()
            
            if output_path:
                print(f"\nSuccess! Generated: {output_path}")
                # Exit after successful generation when running non-interactively
                break
            else:
                print("\nNo books found in the specified directory.")
            
        except (FileNotFoundError, NotADirectoryError) as e:
            print(f"\nError: {e}")
        except KeyboardInterrupt:
            print("\n\nInterrupted by user. Goodbye!")
            break
        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            print(f"\nUnexpected error occurred: {e}")


if __name__ == "__main__":
    main()