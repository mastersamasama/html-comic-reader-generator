#!/usr/bin/env python3
"""
Enhanced Manga Reader HTML Generator V3 - Virtual Scroll Edition

Optimized for large manga collections (>5000 pages) using virtual scrolling.
Only renders visible pages to prevent browser crashes and improve performance.

Author: mastersamasama  
Version: 3.1-virtualscroll
"""

import os
import sys
import logging
import json
import re
from pathlib import Path
from typing import List, Dict, Tuple, Optional, Set
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor, as_completed
import mimetypes
from datetime import datetime


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


@dataclass
class Chapter:
    """Represents a manga chapter with its metadata."""
    number: int
    name: str
    folder_path: Path
    page_count: int
    start_page: int
    end_page: int


@dataclass
class MangaMetadata:
    """Contains all metadata for a manga series."""
    title: str
    chapters: List[Chapter]
    total_pages: int
    base_path: Path


@dataclass
class ImageMetadata:
    """Metadata for virtual scroll images."""
    page: int
    src: str
    chapter: int
    name: str
    estimated_height: int = 800


class ImageValidator:
    """Handles image file validation and filtering."""
    
    # Supported image formats (whitelist)
    SUPPORTED_EXTENSIONS: Set[str] = {
        'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'avif', 'svg'
    }
    
    # Blocked extensions (blacklist)
    BLOCKED_EXTENSIONS: Set[str] = {
        'html', 'json', 'js', 'py', 'ini', 'txt', 'rar', 'zip', '7z',
        'gitignore', 'url', 'nomedia', 'exe', 'bat', 'cmd', 'sh'
    }
    
    @classmethod
    def is_valid_image(cls, file_path: Path) -> bool:
        """Check if a file is a valid image."""
        try:
            extension = file_path.suffix.lower().lstrip('.')
            
            if extension in cls.BLOCKED_EXTENSIONS:
                return False
                
            if extension in cls.SUPPORTED_EXTENSIONS:
                return True
                
            mime_type, _ = mimetypes.guess_type(str(file_path))
            if mime_type and mime_type.startswith('image/'):
                return True
                
            return False
            
        except Exception:
            return False


class VirtualScrollMangaGenerator:
    """Generates virtual scroll manga readers for large collections."""
    
    def __init__(self, metadata: MangaMetadata, use_virtual_scroll: bool = None):
        self.metadata = metadata
        self.validator = ImageValidator()
        
        # Auto-enable virtual scroll for large collections
        if use_virtual_scroll is None:
            use_virtual_scroll = metadata.total_pages > 1000
        
        self.use_virtual_scroll = use_virtual_scroll
        logger.info(f"Virtual scroll {'enabled' if use_virtual_scroll else 'disabled'} "
                   f"for {metadata.total_pages} pages")
    
    def generate_html(self, output_path: Optional[Path] = None) -> Path:
        """Generate the manga reader HTML file."""
        if output_path is None:
            suffix = "-mb-virtualscroll" if self.use_virtual_scroll else "-mb"
            output_path = self.metadata.base_path / f"index{suffix}.html"
        
        try:
            html_content = self._build_html_content()
            
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(html_content)
                
            logger.info(f"Successfully generated HTML: {output_path}")
            return output_path
            
        except Exception as e:
            logger.error(f"Error generating HTML: {e}")
            raise
    
    def _build_html_content(self) -> str:
        """Build the complete HTML content."""
        return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>{self.metadata.title}</title>
    {self._generate_css()}
</head>
<body data-theme="dark">
{self._generate_navigation()}
{self._generate_nav_trigger()}
{self._generate_reader_content()}
{self._generate_controls()}
{self._generate_javascript()}
</body>
</html>"""
    
    def _generate_css(self) -> str:
        """Generate optimized CSS for virtual scrolling."""
        return """<style>
        :root {
            --bg-primary: #1a1a1a;
            --bg-secondary: #2a2a2a;
            --bg-elevated: #333333;
            --text-primary: #ffffff;
            --text-secondary: #cccccc;
            --text-muted: #999999;
            --accent-primary: #4a9eff;
            --accent-hover: #6bb3ff;
            --border-color: #404040;
            --shadow: rgba(0, 0, 0, 0.3);
            --transition: all 0.2s ease;
            --chapter-accent: #ff6b6b;
            --success: #4caf50;
            --warning: #ff9800;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            font-size: 14px;
            line-height: 1.4;
            -webkit-text-size-adjust: 100%;
            -webkit-tap-highlight-color: transparent;
            overflow-x: hidden;
        }

        /* Virtual Scroll Optimized Styles */
        .reader-container {
            position: relative;
            width: 100%;
            min-height: 100vh;
        }

        .virtual-viewport {
            position: relative;
            width: 100%;
            overflow: hidden;
        }

        .scroll-spacer {
            width: 100%;
            pointer-events: none;
        }

        .page-image {
            position: absolute;
            left: 0;
            width: 100%;
            height: auto;
            display: block;
            object-fit: contain;
            background: var(--bg-secondary);
            transition: opacity 0.2s ease;
        }

        .page-image.loading {
            opacity: 0.5;
        }

        .chapter-marker {
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
            background: var(--chapter-accent);
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            font-weight: bold;
            z-index: 10;
            box-shadow: 0 2px 8px var(--shadow);
        }

        /* Top Navigation */
        .top-nav {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 1000;
            background: rgba(26, 26, 26, 0.95);
            backdrop-filter: blur(10px);
            border-bottom: 1px solid var(--border-color);
            padding: 8px 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            transition: transform 0.3s ease;
            height: 48px;
        }

        .top-nav.hidden {
            transform: translateY(-100%);
        }

        .page-counter {
            font-size: 13px;
            font-weight: 500;
            color: var(--text-secondary);
            white-space: nowrap;
        }

        .progress-bar {
            flex: 1;
            height: 3px;
            background: var(--border-color);
            border-radius: 2px;
            margin: 0 12px;
            overflow: hidden;
        }

        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, var(--accent-primary), var(--accent-hover));
            width: 0%;
            transition: width 0.3s ease;
        }

        .nav-controls {
            display: flex;
            gap: 8px;
        }

        .nav-btn {
            background: none;
            border: none;
            color: var(--text-secondary);
            width: 32px;
            height: 32px;
            border-radius: 6px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: var(--transition);
            font-size: 16px;
        }

        .nav-btn:hover {
            background: var(--bg-elevated);
            color: var(--accent-primary);
        }

        /* Performance Optimized Styles */
        .page-image {
            will-change: transform;
            transform: translateZ(0); /* Force hardware acceleration */
        }

        /* Reduced motion for better performance */
        @media (prefers-reduced-motion: reduce) {
            * {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
            }
        }
        </style>"""
    
    def _generate_navigation(self) -> str:
        """Generate top navigation bar."""
        return f"""    <!-- Top Navigation -->
    <nav class="top-nav" id="topNav">
        <div class="page-counter" id="pageInfo">1 / {self.metadata.total_pages}</div>
        <div class="progress-bar">
            <div class="progress-fill" id="progressBar"></div>
        </div>
        <div class="nav-controls">
            <button class="nav-btn" id="themeBtn" title="Toggle theme">🌓</button>
            <button class="nav-btn" id="chaptersBtn" title="Chapters">📚</button>
            <button class="nav-btn" id="settingsBtn" title="Settings">⚙️</button>
        </div>
    </nav>"""
    
    def _generate_nav_trigger(self) -> str:
        """Generate navigation trigger zone."""
        return """    <div class="nav-trigger-zone" id="navTriggerZone"></div>"""
    
    def _generate_reader_content(self) -> str:
        """Generate virtual scroll container."""
        if self.use_virtual_scroll:
            return self._generate_virtual_scroll_content()
        else:
            return self._generate_traditional_content()
    
    def _generate_virtual_scroll_content(self) -> str:
        """Generate virtual scroll container for large collections."""
        estimated_total_height = self.metadata.total_pages * 800
        
        return f"""    <!-- Virtual Scroll Reading Area -->
    <main class="reader-container" id="readerContainer">
        <div class="virtual-viewport" id="virtualViewport">
            <!-- Dynamic content rendered here -->
        </div>
        <div class="scroll-spacer" id="scrollSpacer" style="height: {estimated_total_height}px;"></div>
    </main>"""
    
    def _generate_traditional_content(self) -> str:
        """Generate traditional content for smaller collections."""
        content = ['    <!-- Reading Area -->', 
                  '    <main class="reader-container" id="readerContainer">']
        
        # Get all images and generate metadata
        image_metadata = self._collect_image_metadata()
        
        for img_data in image_metadata:
            content.append(f'        <img src="{img_data.src}" id="page-{img_data.page}" '
                          f'class="page-image" alt="{img_data.name}" '
                          f'data-chapter="{img_data.chapter}" loading="lazy" />')
        
        content.append('    </main>')
        return '\n'.join(content)
    
    def _collect_image_metadata(self) -> List[ImageMetadata]:
        """Collect metadata for all images."""
        metadata = []
        
        # Get all image files
        all_images = []
        for root, _, files in os.walk(self.metadata.base_path):
            for file in files:
                file_path = Path(root) / file
                if self.validator.is_valid_image(file_path):
                    all_images.append(file_path)
        
        # Natural sort function
        def natural_sort_key(path):
            path_str = str(path.relative_to(self.metadata.base_path))
            parts = re.split(r'(\d+)', path_str.lower())
            result = []
            for part in parts:
                if part.isdigit():
                    result.append(int(part))
                else:
                    result.append(part)
            return result
        
        # Group by chapter and sort
        chapter_images = {}
        for image_path in all_images:
            chapter_num = self._determine_image_chapter(image_path)
            if chapter_num not in chapter_images:
                chapter_images[chapter_num] = []
            chapter_images[chapter_num].append(image_path)
        
        for chapter_num in chapter_images:
            chapter_images[chapter_num].sort(key=natural_sort_key)
        
        # Create metadata
        page_counter = 1
        for chapter in sorted(self.metadata.chapters, key=lambda ch: ch.number):
            chapter_num = chapter.number
            if chapter_num not in chapter_images:
                continue
            
            for image_path in chapter_images[chapter_num]:
                relative_path = image_path.relative_to(self.metadata.base_path)
                src_path = str(relative_path).replace('\\', '/')
                
                metadata.append(ImageMetadata(
                    page=page_counter,
                    src=src_path,
                    chapter=chapter_num,
                    name=f'Page {page_counter}'
                ))
                page_counter += 1
        
        return metadata
    
    def _determine_image_chapter(self, image_path: Path) -> int:
        """Determine which chapter an image belongs to."""
        # Simple implementation - can be enhanced
        for chapter in self.metadata.chapters:
            if str(chapter.folder_path) in str(image_path):
                return chapter.number
        
        # Default to chapter 1 if not found
        return 1
    
    def _generate_controls(self) -> str:
        """Generate reader controls."""
        return """    <!-- Reader Controls -->
    <div class="nav-zone left" id="navZoneLeft"></div>
    <div class="nav-zone right" id="navZoneRight"></div>"""
    
    def _generate_javascript(self) -> str:
        """Generate optimized JavaScript with virtual scroll support."""
        image_metadata_json = json.dumps([
            {
                'page': img.page,
                'src': img.src,
                'chapter': img.chapter,
                'name': img.name
            }
            for img in self._collect_image_metadata()
        ])
        
        return f"""<script>
window.mangaImageData = {image_metadata_json};

/**
 * Optimized manga reader with virtual scroll support.
 */
class OptimizedMangaReader {{
    constructor() {{
        this.currentPage = 1;
        this.totalPages = {self.metadata.total_pages};
        this.useVirtualScroll = {str(self.use_virtual_scroll).lower()};
        
        this.initializeElements();
        this.setupEventListeners();
        
        if (this.useVirtualScroll) {{
            this.virtualScroll = new VirtualScrollManager(this);
        }} else {{
            this.setupIntersectionObserver();
        }}
        
        this.updateProgress();
    }}
    
    initializeElements() {{
        this.topNav = document.getElementById('topNav');
        this.progressBar = document.getElementById('progressBar');
        this.pageInfo = document.getElementById('pageInfo');
        this.readerContainer = document.getElementById('readerContainer');
        
        if (this.useVirtualScroll) {{
            this.viewport = document.getElementById('virtualViewport');
            this.spacer = document.getElementById('scrollSpacer');
        }}
    }}
    
    setupEventListeners() {{
        // Navigation zones
        document.getElementById('navZoneLeft')?.addEventListener('click', () => this.previousPage());
        document.getElementById('navZoneRight')?.addEventListener('click', () => this.nextPage());
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {{
            if (e.key === 'ArrowLeft') this.previousPage();
            else if (e.key === 'ArrowRight') this.nextPage();
        }});
    }}
    
    setupIntersectionObserver() {{
        // Traditional observer for non-virtual scroll
        const observer = new IntersectionObserver((entries) => {{
            const viewportCenter = window.innerHeight / 2;
            let bestPage = null;
            let bestDistance = Infinity;
            
            entries.forEach(entry => {{
                if (entry.isIntersecting && entry.intersectionRatio > 0.2) {{
                    const rect = entry.boundingClientRect;
                    const pageCenter = rect.top + rect.height / 2;
                    const distance = Math.abs(pageCenter - viewportCenter);
                    
                    if (distance < bestDistance) {{
                        bestDistance = distance;
                        bestPage = entry.target;
                    }}
                }}
            }});
            
            if (bestPage) {{
                const pageNum = parseInt(bestPage.id.split('-')[1]);
                if (pageNum && pageNum !== this.currentPage) {{
                    this.currentPage = pageNum;
                    this.updateProgress();
                }}
            }}
        }}, {{ threshold: [0.2, 0.5, 0.8] }});
        
        document.querySelectorAll('.page-image').forEach(page => observer.observe(page));
    }}
    
    /**
     * Navigate to next page.
     */
    nextPage() {{
        if (this.currentPage < this.totalPages) {{
            this.goToPage(this.currentPage + 1);
        }}
    }}
    
    /**
     * Navigate to previous page.
     */
    previousPage() {{
        if (this.currentPage > 1) {{
            this.goToPage(this.currentPage - 1);
        }}
    }}
    
    /**
     * Navigate to specific page.
     * @param {{number}} pageNum - Target page number.
     */
    goToPage(pageNum) {{
        if (pageNum < 1 || pageNum > this.totalPages) return;
        
        this.currentPage = pageNum;
        this.updateProgress();
        
        if (this.useVirtualScroll) {{
            this.virtualScroll.goToPage(pageNum);
        }} else {{
            const targetPage = document.getElementById(`page-${{pageNum}}`);
            if (targetPage) {{
                targetPage.scrollIntoView({{ behavior: 'smooth', block: 'start' }});
            }}
        }}
    }}
    
    /**
     * Update progress indicators.
     */
    updateProgress() {{
        const progress = (this.currentPage / this.totalPages) * 100;
        this.progressBar.style.width = `${{progress}}%`;
        this.pageInfo.textContent = `${{this.currentPage}} / ${{this.totalPages}}`;
    }}
}}

/**
 * Virtual scroll manager for large manga collections.
 */
class VirtualScrollManager {{
    constructor(reader) {{
        this.reader = reader;
        this.viewport = reader.viewport;
        this.spacer = reader.spacer;
        this.visiblePages = new Map();
        this.pageHeight = 800;
        this.renderBuffer = 3;
        this.imageData = window.mangaImageData || [];
        
        this.setupVirtualScroll();
    }}
    
    setupVirtualScroll() {{
        // Throttled scroll handler for 60fps performance
        let scrollTimeout;
        window.addEventListener('scroll', () => {{
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => this.updateVisiblePages(), 16);
        }}, {{ passive: true }});
        
        this.updateVisiblePages();
    }}
    
    updateVisiblePages() {{
        const scrollTop = window.scrollY;
        const viewportHeight = window.innerHeight;
        
        // Calculate visible range
        const startPage = Math.max(1, Math.floor(scrollTop / this.pageHeight) - this.renderBuffer);
        const endPage = Math.min(this.reader.totalPages, 
            Math.ceil((scrollTop + viewportHeight) / this.pageHeight) + this.renderBuffer);
        
        // Remove pages outside range
        this.visiblePages.forEach((element, pageNum) => {{
            if (pageNum < startPage || pageNum > endPage) {{
                element.remove();
                this.visiblePages.delete(pageNum);
            }}
        }});
        
        // Add pages in range
        for (let pageNum = startPage; pageNum <= endPage; pageNum++) {{
            if (!this.visiblePages.has(pageNum)) {{
                this.renderPage(pageNum);
            }}
        }}
        
        // Update current page
        const centerPage = Math.floor((scrollTop + viewportHeight/2) / this.pageHeight) + 1;
        if (centerPage !== this.reader.currentPage && centerPage >= 1 && centerPage <= this.reader.totalPages) {{
            this.reader.currentPage = centerPage;
            this.reader.updateProgress();
        }}
    }}
    
    renderPage(pageNum) {{
        const imageInfo = this.imageData[pageNum - 1];
        if (!imageInfo) return;
        
        const pageElement = document.createElement('img');
        pageElement.id = `page-${{pageNum}}`;
        pageElement.className = 'page-image loading';
        pageElement.src = imageInfo.src;
        pageElement.alt = imageInfo.name;
        pageElement.dataset.chapter = imageInfo.chapter;
        pageElement.loading = 'lazy';
        
        // Position for virtual scroll
        pageElement.style.top = `${{(pageNum - 1) * this.pageHeight}}px`;
        
        // Handle load completion
        pageElement.onload = () => {{
            pageElement.classList.remove('loading');
            const actualHeight = pageElement.offsetHeight;
            if (actualHeight && actualHeight !== this.pageHeight) {{
                this.adjustPageHeight(pageNum, actualHeight);
            }}
        }};
        
        this.viewport.appendChild(pageElement);
        this.visiblePages.set(pageNum, pageElement);
    }}
    
    adjustPageHeight(pageNum, actualHeight) {{
        // Dynamic height adjustment for better accuracy
        const heightDiff = actualHeight - this.pageHeight;
        
        // Update spacer
        const currentSpacerHeight = parseInt(this.spacer.style.height);
        this.spacer.style.height = `${{currentSpacerHeight + heightDiff}}px`;
        
        // Reposition subsequent pages
        this.visiblePages.forEach((element, num) => {{
            if (num > pageNum) {{
                const currentTop = parseInt(element.style.top);
                element.style.top = `${{currentTop + heightDiff}}px`;
            }}
        }});
    }}
    
    goToPage(pageNum) {{
        const targetY = (pageNum - 1) * this.pageHeight;
        window.scrollTo({{ top: targetY, behavior: 'smooth' }});
        
        // Force update after scroll
        setTimeout(() => this.updateVisiblePages(), 100);
    }}
}}

// Initialize reader when DOM is ready
document.addEventListener('DOMContentLoaded', () => {{
    window.mangaReader = new OptimizedMangaReader();
}});
</script>"""


def create_virtual_scroll_reader(folder_path: str, output_filename: str = None) -> Path:
    """Create a progressive loading manga reader based on working template."""
    import subprocess
    import sys
    
    script_dir = Path(__file__).parent
    helper_script = script_dir / "create_progressive_reader.py"
    
    try:
        # Use the helper script to create progressive loading reader
        result = subprocess.run([
            sys.executable, str(helper_script), folder_path
        ], capture_output=True, text=True, encoding='utf-8')
        
        if result.returncode == 0:
            base_path = Path(folder_path)
            output_path = base_path / "index-mb-virtualscroll.html"
            logger.info(f"Successfully created progressive loading reader: {output_path}")
            return output_path
        else:
            logger.error(f"Failed to create progressive loading reader: {result.stderr}")
            raise RuntimeError(f"Progressive loading creation failed: {result.stderr}")
    
    except Exception as e:
        logger.error(f"Error creating progressive loading reader: {e}")
        raise


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python htmlcmb_v3_virtualscroll.py <manga_folder_path>")
        sys.exit(1)
    
    folder_path = sys.argv[1]
    
    try:
        output_path = create_virtual_scroll_reader(folder_path)
        print(f"Virtual scroll manga reader generated: {output_path}")
    except Exception as e:
        logger.error(f"Failed to generate reader: {e}")
        sys.exit(1)