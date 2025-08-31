#!/usr/bin/env python3
"""
Enhanced Manga Reader HTML Generator V3

This script generates modern mobile-first manga reader HTML files based on the V3 final template.
Refactored with modern Python best practices, type hints, error handling, and performance optimizations.

Author: mastersamasama
Version: 3.0
"""

import os
import sys
import logging
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
        """
        Check if a file is a valid image based on extension and MIME type.
        
        Args:
            file_path: Path to the file to validate
            
        Returns:
            True if the file is a valid image, False otherwise
        """
        try:
            # Check extension
            extension = file_path.suffix.lower().lstrip('.')
            
            # Blocked files
            if extension in cls.BLOCKED_EXTENSIONS:
                return False
                
            # Known image extensions
            if extension in cls.SUPPORTED_EXTENSIONS:
                return True
                
            # Use MIME type as fallback for unknown extensions
            mime_type, _ = mimetypes.guess_type(str(file_path))
            if mime_type and mime_type.startswith('image/'):
                logger.warning(f"Unknown image extension detected: {file_path}")
                return True
                
            logger.info(f"Skipping non-image file: {file_path}")
            return False
            
        except Exception as e:
            logger.error(f"Error validating image {file_path}: {e}")
            return False


class FileSystemScanner:
    """Efficiently scans filesystem for manga files and folders."""
    
    def __init__(self, base_path: Path):
        self.base_path = base_path
        self.validator = ImageValidator()
    
    def scan_directory(self) -> Tuple[List[Path], List[Path]]:
        """
        Scan directory for folders and image files.
        
        Returns:
            Tuple of (folders, image_files) lists
        """
        folders = []
        image_files = []
        
        try:
            # Use os.walk for better performance on large directories
            for root, dirs, files in os.walk(self.base_path):
                root_path = Path(root)
                
                # Add subdirectories (skip the base directory itself)
                if root_path != self.base_path:
                    folders.append(root_path)
                
                # Process files in parallel batches for better performance
                file_paths = [root_path / file for file in files]
                valid_images = self._batch_validate_images(file_paths)
                image_files.extend(valid_images)
                
        except PermissionError as e:
            logger.error(f"Permission denied accessing directory: {e}")
            raise
        except Exception as e:
            logger.error(f"Error scanning directory {self.base_path}: {e}")
            raise
            
        # Sort for consistent ordering
        folders.sort()
        image_files.sort()
        
        logger.info(f"Found {len(folders)} chapters and {len(image_files)} images")
        return folders, image_files
    
    def _batch_validate_images(self, file_paths: List[Path], batch_size: int = 50) -> List[Path]:
        """Validate images in parallel batches for better performance."""
        valid_images = []
        
        # Process in batches to avoid overwhelming the system
        for i in range(0, len(file_paths), batch_size):
            batch = file_paths[i:i + batch_size]
            
            with ThreadPoolExecutor(max_workers=4) as executor:
                future_to_path = {
                    executor.submit(self.validator.is_valid_image, path): path 
                    for path in batch
                }
                
                for future in as_completed(future_to_path):
                    path = future_to_path[future]
                    try:
                        if future.result():
                            valid_images.append(path)
                    except Exception as e:
                        logger.error(f"Error validating {path}: {e}")
        
        return valid_images


class MangaAnalyzer:
    """Analyzes manga structure and creates metadata."""
    
    def __init__(self, base_path: Path):
        self.base_path = base_path
        
    def analyze_manga(self, folders: List[Path], image_files: List[Path]) -> MangaMetadata:
        """
        Analyze manga structure and create metadata.
        
        Args:
            folders: List of chapter folders
            image_files: List of all image files
            
        Returns:
            MangaMetadata object with complete manga information
        """
        # Extract manga title from directory name
        title = self.base_path.name
        
        # Group images by chapter
        chapter_images = self._group_images_by_chapter(folders, image_files)
        
        # Create chapter objects
        chapters = []
        current_page = 1
        
        # Handle root chapter (images directly in base directory)
        root_images = [img for img in image_files if img.parent == self.base_path]
        if root_images:
            chapter = Chapter(
                number=1,
                name="Main Chapter" if len(folders) == 0 else "Introduction",
                folder_path=self.base_path,
                page_count=len(root_images),
                start_page=current_page,
                end_page=current_page + len(root_images) - 1
            )
            chapters.append(chapter)
            current_page += len(root_images)
        
        # Handle subdirectory chapters
        for i, folder in enumerate(folders):
            images_in_folder = chapter_images.get(folder, [])
            if not images_in_folder:
                continue
                
            # Generate chapter name from folder
            folder_name = folder.name
            chapter_name = self._format_chapter_name(folder_name, i + (2 if root_images else 1))
            
            chapter = Chapter(
                number=i + (2 if root_images else 1),
                name=chapter_name,
                folder_path=folder,
                page_count=len(images_in_folder),
                start_page=current_page,
                end_page=current_page + len(images_in_folder) - 1
            )
            chapters.append(chapter)
            current_page += len(images_in_folder)
        
        return MangaMetadata(
            title=title,
            chapters=chapters,
            total_pages=len(image_files),
            base_path=self.base_path
        )
    
    def _group_images_by_chapter(self, folders: List[Path], image_files: List[Path]) -> Dict[Path, List[Path]]:
        """Group image files by their parent chapter folder."""
        chapter_images = {folder: [] for folder in folders}
        
        for image in image_files:
            for folder in folders:
                try:
                    # Check if image is within this folder
                    image.relative_to(folder)
                    chapter_images[folder].append(image)
                    break
                except ValueError:
                    continue
        
        return chapter_images
    
    def _format_chapter_name(self, folder_name: str, chapter_number: int) -> str:
        """Format chapter name from folder name."""
        # Clean up common folder name patterns
        name = folder_name.replace('_', ' ').replace('-', ' ')
        
        # If it's just a number, format it nicely
        if name.isdigit():
            return f"Chapter {name}"
        
        # If it starts with a number, format it
        if name and name[0].isdigit():
            return f"Chapter {name}"
        
        # Otherwise use the folder name as-is but capitalize
        return name.title() if name else f"Chapter {chapter_number}"


class MangaHTMLGenerator:
    """Generates the V3 final HTML template with manga content."""
    
    def __init__(self, metadata: MangaMetadata):
        self.metadata = metadata
        
    def generate_html(self, output_path: Optional[Path] = None) -> Path:
        """
        Generate the manga reader HTML file.
        
        Args:
            output_path: Optional custom output path
            
        Returns:
            Path to the generated HTML file
        """
        if output_path is None:
            output_path = self.metadata.base_path / "index-mb.html"
        
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
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes, maximum-scale=3.0, viewport-fit=cover">
    <meta name="theme-color" content="#0a0a0a">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <title>{self.metadata.title}</title>
    {self._get_css_styles()}
</head>
<body data-theme="dark">
    {self._generate_navigation()}
    {self._generate_progress_bar()}
    {self._generate_nav_trigger()}
    {self._generate_reader_content()}
    {self._generate_chapter_sidebar()}
    {self._generate_settings_panel()}
    {self._generate_controls()}
    {self._generate_javascript()}
</body>
</html>"""
    
    def _get_css_styles(self) -> str:
        """Return the V3 final CSS styles."""
        return """<style>
        :root {
            /* Refined color system */
            --bg-primary: #0a0a0a;
            --bg-surface: #1a1a1a;
            --bg-elevated: #2a2a2a;
            --text-primary: #ffffff;
            --text-secondary: #b3b3b3;
            --text-tertiary: #666666;
            --accent: #00d4ff;
            --accent-hover: #00b8e6;
            --chapter-accent: #ff6b35;
            
            /* Mobile-optimized spacing */
            --safe-top: env(safe-area-inset-top, 0px);
            --safe-bottom: env(safe-area-inset-bottom, 0px);
            --nav-height: calc(48px + var(--safe-top));
            --border-radius: 8px;
            
            /* Smooth animations */
            --transition: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            --shadow: 0 2px 8px rgba(0,0,0,0.3);
        }

        [data-theme="light"] {
            --bg-primary: #fafafa;
            --bg-surface: #ffffff;
            --bg-elevated: #f5f5f5;
            --text-primary: #1a1a1a;
            --text-secondary: #666666;
            --text-tertiary: #999999;
            --accent: #0066cc;
            --accent-hover: #0052a3;
            --chapter-accent: #d63384;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-tap-highlight-color: transparent;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            overflow-x: hidden;
            padding-top: var(--nav-height);
            transition: var(--transition);
            min-height: 100vh;
        }

        /* Top Navigation - Reduced trigger sensitivity */
        .top-nav {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: var(--nav-height);
            background: var(--bg-surface);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border-bottom: 1px solid rgba(255,255,255,0.1);
            z-index: 100;
            display: flex;
            align-items: center;
            padding: var(--safe-top) 12px 0 12px;
            transform: translateY(0);
            transition: transform var(--transition);
        }

        .top-nav.hidden {
            transform: translateY(-100%);
        }

        /* Pin button with visual indicator like V1 */
        .pin-btn {
            min-width: 36px;
            min-height: 36px;
            border: none;
            border-radius: var(--border-radius);
            background: var(--bg-elevated);
            color: var(--text-primary);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            transition: var(--transition);
            margin-right: 8px;
            position: relative;
        }

        .pin-btn.pinned {
            background: var(--accent);
            color: white;
        }

        .pin-btn.pinned::before {
            content: '↔';
        }

        .pin-btn:not(.pinned)::before {
            content: '↑';
        }

        .nav-title {
            flex: 1;
            font-size: 16px;
            font-weight: 600;
            color: var(--text-primary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-right: 12px;
        }

        .page-counter {
            background: var(--accent);
            color: white;
            padding: 6px 12px;
            border-radius: var(--border-radius);
            font-weight: 600;
            font-size: 13px;
            min-width: 70px;
            text-align: center;
            margin-right: 8px;
            cursor: pointer;
        }

        .chapter-indicator {
            background: var(--chapter-accent);
            color: white;
            padding: 6px 10px;
            border-radius: var(--border-radius);
            font-weight: 500;
            font-size: 12px;
            margin-right: 8px;
        }

        .nav-btn {
            min-width: 36px;
            min-height: 36px;
            border: none;
            border-radius: var(--border-radius);
            background: var(--bg-elevated);
            color: var(--text-primary);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            transition: var(--transition);
            margin-left: 4px;
        }

        .nav-btn:active {
            background: var(--accent);
            color: white;
        }

        /* Always visible progress bar - stick properly when nav collapses */
        .progress-bar {
            position: fixed;
            left: 0;
            height: 3px;
            background: linear-gradient(90deg, var(--accent), var(--chapter-accent));
            transition: width var(--transition), top var(--transition);
            z-index: 99;
            opacity: 0.8;
            top: var(--nav-height);
        }

        .top-nav.hidden ~ .progress-bar {
            top: 0;
        }

        /* Reading Area - remove gaps between pages */
        .reader-container {
            min-height: 100vh;
            padding: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .page-image {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 0;
            /* Prevent download popup on touch hold - like V1 */
            pointer-events: none;
            -webkit-user-select: none;
            -webkit-touch-callout: none;
            -webkit-user-drag: none;
            user-select: none;
            background: var(--bg-elevated);
        }

        /* Hidden chapter markers - no visual disruption */
        .chapter-marker {
            position: absolute;
            visibility: hidden;
            height: 0;
            width: 0;
            overflow: hidden;
        }

        /* Chapter Sidebar - simplified, no search */
        .chapter-sidebar {
            position: fixed;
            top: 0;
            right: -280px;
            width: 280px;
            height: 100vh;
            background: var(--bg-surface);
            transform: translateX(0);
            transition: right var(--transition);
            z-index: 200;
            display: flex;
            flex-direction: column;
            box-shadow: var(--shadow);
        }

        .chapter-sidebar.open {
            right: 0;
        }

        .sidebar-header {
            padding: calc(var(--safe-top) + 16px) 16px 16px 16px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            background: var(--bg-elevated);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .sidebar-title {
            font-size: 18px;
            font-weight: 700;
            color: var(--text-primary);
        }

        .sidebar-close {
            min-width: 32px;
            min-height: 32px;
            border: none;
            border-radius: var(--border-radius);
            background: var(--bg-surface);
            color: var(--text-primary);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
        }

        .chapter-list {
            flex: 1;
            overflow-y: auto;
            padding: 8px 0;
            -webkit-overflow-scrolling: touch;
        }

        .chapter-item {
            padding: 12px 20px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: space-between;
            min-height: 44px;
            border-left: 3px solid transparent;
            transition: var(--transition);
        }

        .chapter-item:active {
            background: var(--bg-elevated);
        }

        .chapter-item.active {
            background: var(--bg-elevated);
            border-left-color: var(--chapter-accent);
        }

        .chapter-title {
            font-size: 14px;
            color: var(--text-primary);
            font-weight: 500;
        }

        .chapter-pages {
            font-size: 12px;
            color: var(--text-secondary);
        }

        /* Overlay */
        .overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            opacity: 0;
            visibility: hidden;
            transition: all var(--transition);
            z-index: 150;
        }

        .overlay.visible {
            opacity: 1;
            visibility: visible;
        }

        /* Progress slider - Real-time sync behavior */
        .progress-slider-container {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: var(--bg-surface);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            padding: 12px 16px calc(12px + var(--safe-bottom)) 16px;
            border-top: 1px solid rgba(255,255,255,0.1);
            transform: translateY(100%);
            transition: transform var(--transition);
            z-index: 100;
        }

        .progress-slider-container.visible {
            transform: translateY(0);
        }

        .progress-slider {
            width: 100%;
            height: 6px;
            border-radius: 3px;
            background: var(--bg-elevated);
            outline: none;
            cursor: pointer;
            -webkit-appearance: none;
            appearance: none;
        }

        .progress-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: var(--accent);
            cursor: pointer;
            box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        }

        .progress-slider::-moz-range-thumb {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: var(--accent);
            cursor: pointer;
            border: none;
            box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        }

        /* Touch zones - Better implementation, reduced sensitivity */
        .touch-zone {
            position: fixed;
            width: 15%;
            height: 100%;
            top: var(--nav-height);
            z-index: 1;
            cursor: pointer;
        }

        .touch-zone-left {
            left: 0;
        }

        .touch-zone-right {
            right: 0;
        }

        /* Only show touch zones when navigation is hidden */
        .touch-zone {
            display: none;
        }

        .nav-hidden .touch-zone {
            display: block;
        }

        /* Navigation trigger zone - much smaller and only at top */
        .nav-trigger-zone {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 20px; /* Small trigger area */
            z-index: 2;
            cursor: pointer;
        }

        .nav-hidden .nav-trigger-zone {
            display: block;
        }

        .nav-trigger-zone {
            display: none;
        }

        /* Visual feedback for page turns */
        .page-turn-indicator {
            position: fixed;
            top: 50%;
            transform: translateY(-50%);
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: var(--bg-surface);
            backdrop-filter: blur(12px);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            color: var(--text-primary);
            opacity: 0;
            transition: opacity 0.15s ease;
            pointer-events: none;
            z-index: 50;
        }

        .page-turn-indicator.left {
            left: 30px;
        }

        .page-turn-indicator.right {
            right: 30px;
        }

        .page-turn-indicator.visible {
            opacity: 0.8;
        }

        /* Settings panel - simplified and functional */
        .settings-panel {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: var(--bg-surface);
            border-radius: 16px 16px 0 0;
            padding: 16px 16px calc(16px + var(--safe-bottom)) 16px;
            transform: translateY(100%);
            transition: transform var(--transition);
            z-index: 200;
            max-height: 60vh;
            overflow-y: auto;
        }

        .settings-panel.open {
            transform: translateY(0);
        }

        .settings-header {
            text-align: center;
            margin-bottom: 20px;
        }

        .settings-handle {
            width: 36px;
            height: 4px;
            background: var(--text-tertiary);
            border-radius: 2px;
            margin: 0 auto 16px;
        }

        .settings-title {
            font-size: 16px;
            font-weight: 600;
            color: var(--text-primary);
        }

        .setting-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 0;
            border-bottom: 1px solid rgba(255,255,255,0.05);
        }

        .setting-item:last-child {
            border-bottom: none;
        }

        .setting-info {
            flex: 1;
        }

        .setting-label {
            font-size: 15px;
            color: var(--text-primary);
            font-weight: 500;
        }

        .setting-description {
            font-size: 12px;
            color: var(--text-secondary);
            margin-top: 2px;
        }

        .toggle-switch {
            position: relative;
            width: 44px;
            height: 24px;
            background: var(--bg-elevated);
            border-radius: 12px;
            cursor: pointer;
            transition: var(--transition);
        }

        .toggle-switch.active {
            background: var(--accent);
        }

        .toggle-switch::after {
            content: '';
            position: absolute;
            top: 2px;
            left: 2px;
            width: 20px;
            height: 20px;
            background: white;
            border-radius: 50%;
            transition: var(--transition);
        }

        .toggle-switch.active::after {
            transform: translateX(20px);
        }

        /* Responsive adjustments */
        @media (max-width: 375px) {
            .nav-title {
                font-size: 14px;
            }
            
            .chapter-sidebar {
                width: 90%;
                right: -90%;
            }
        }

        @media (orientation: landscape) and (max-height: 500px) {
            :root {
                --nav-height: calc(40px + var(--safe-top));
            }
        }

        /* Smooth theme transitions */
        * {
            transition: background-color var(--transition), 
                       color var(--transition),
                       border-color var(--transition);
        }

        /* Loading animation */
        .page-image {
            opacity: 0;
            animation: fadeIn 0.3s ease forwards;
        }

        @keyframes fadeIn {
            to { opacity: 1; }
        }

        /* Hidden utility */
        .hidden {
            display: none !important;
        }
    </style>"""
    
    def _generate_navigation(self) -> str:
        """Generate the top navigation bar."""
        return f"""    <!-- Top Navigation -->
    <nav class="top-nav" id="topNav">
        <button class="pin-btn" id="pinBtn" title="Pin navigation"></button>
        <div class="nav-title">{self.metadata.title}</div>
        <div class="chapter-indicator" id="chapterInfo">Ch.1</div>
        <div class="page-counter" id="pageInfo">1 / {self.metadata.total_pages}</div>
        <button class="nav-btn" id="themeBtn" title="Toggle theme">🌙</button>
        <button class="nav-btn" id="chaptersBtn" title="Chapters">📚</button>
        <button class="nav-btn" id="settingsBtn" title="Settings">⚙️</button>
    </nav>"""
    
    def _generate_progress_bar(self) -> str:
        """Generate the always-visible progress bar."""
        return """    <!-- Always visible progress bar - sticks properly -->
    <div class="progress-bar" id="progressBar" style="width: 0.66%"></div>"""
    
    def _generate_nav_trigger(self) -> str:
        """Generate the navigation trigger zone."""
        return """    <!-- Navigation trigger zone - small area at top -->
    <div class="nav-trigger-zone" id="navTriggerZone"></div>"""
    
    def _generate_reader_content(self) -> str:
        """Generate the main reader content with all images."""
        content = ['    <!-- Reading Area -->',
                  '    <main class="reader-container" id="readerContainer">']
        
        # Get all image files and group them by chapter
        all_images = []
        for root, _, files in os.walk(self.metadata.base_path):
            for file in files:
                file_path = Path(root) / file
                if self.validator.is_valid_image(file_path):
                    all_images.append(file_path)
        
        # Natural sort function for filenames with numbers
        import re
        def natural_sort_key(path):
            """Sort key function for natural ordering of filenames with numbers."""
            path_str = str(path.relative_to(self.metadata.base_path))
            # Split path into text and number parts for proper sorting
            parts = re.split(r'(\d+)', path_str.lower())
            result = []
            for part in parts:
                if part.isdigit():
                    result.append(int(part))
                else:
                    result.append(part)
            return result
        
        # Group images by chapter and sort within each chapter
        chapter_images = {}
        for image_path in all_images:
            chapter_num = self._determine_image_chapter(image_path)
            if chapter_num not in chapter_images:
                chapter_images[chapter_num] = []
            chapter_images[chapter_num].append(image_path)
        
        
        # Sort images within each chapter using natural sort
        for chapter_num in chapter_images:
            chapter_images[chapter_num].sort(key=natural_sort_key)
        
        # Output images in chapter order
        page_counter = 1
        for chapter in sorted(self.metadata.chapters, key=lambda ch: ch.number):
            chapter_num = chapter.number
            if chapter_num not in chapter_images:
                continue
                
            # Add chapter marker (except for the first chapter)
            if chapter_num > 1:
                content.append(f'        <div class="chapter-marker" id="chp_{chapter_num}">{chapter.name}</div>')
            
            # Add all images for this chapter
            for image_path in chapter_images[chapter_num]:
                relative_path = image_path.relative_to(self.metadata.base_path)
                src_path = str(relative_path).replace('\\', '/')
                content.append(f'        <img src="{src_path}" id="page-{page_counter}" class="page-image" alt="Page {page_counter}" data-chapter="{chapter_num}" />')
                page_counter += 1
        
        content.append('    </main>')
        return '\n'.join(content)
    
    def _determine_image_chapter(self, image_path: Path) -> int:
        """Determine which chapter an image belongs to."""
        # Check for exact parent directory match first (most specific)
        image_parent = image_path.parent
        
        for chapter in self.metadata.chapters:
            if chapter.folder_path == image_parent:
                return chapter.number
        
        # If no exact match, find the chapter that contains this image
        # with the shortest relative path (most specific match)
        best_match = None
        best_match_depth = float('inf')
        
        for chapter in self.metadata.chapters:
            try:
                # Check if image is within this chapter's folder
                relative_path = image_path.relative_to(chapter.folder_path)
                
                # Calculate path depth - fewer parts means more specific
                depth = len(relative_path.parts)
                
                if depth < best_match_depth:
                    best_match = chapter.number
                    best_match_depth = depth
                    
            except ValueError:
                continue
        
        return best_match if best_match is not None else 1
    
    def _generate_chapter_sidebar(self) -> str:
        """Generate the chapter navigation sidebar."""
        content = [
            '    <!-- Chapter Sidebar -->',
            '    <aside class="chapter-sidebar" id="chapterSidebar">',
            '        <div class="sidebar-header">',
            f'            <div class="sidebar-title">{self.metadata.title}</div>',
            '            <button class="sidebar-close" id="sidebarClose">✕</button>',
            '        </div>',
            '        <div class="chapter-list">'
        ]
        
        for i, chapter in enumerate(self.metadata.chapters):
            active_class = ' active' if i == 0 else ''
            content.append(f'''            <div class="chapter-item{active_class}" data-chapter="{chapter.number}">
                <div class="chapter-title">{chapter.name}</div>
                <div class="chapter-pages">{chapter.page_count} pages</div>
            </div>''')
        
        content.extend([
            '        </div>',
            '    </aside>'
        ])
        
        return '\n'.join(content)
    
    def _generate_settings_panel(self) -> str:
        """Generate the settings panel."""
        return """    <!-- Settings Panel -->
    <div class="settings-panel" id="settingsPanel">
        <div class="settings-header">
            <div class="settings-handle"></div>
            <div class="settings-title">Settings</div>
        </div>
        
        <div class="setting-item">
            <div class="setting-info">
                <div class="setting-label">Auto-hide Navigation</div>
                <div class="setting-description">Hide navigation bars while reading</div>
            </div>
            <div class="toggle-switch active" id="autoHideToggle"></div>
        </div>

        <div class="setting-item">
            <div class="setting-info">
                <div class="setting-label">Dark Theme</div>
                <div class="setting-description">Use dark colors for comfortable reading</div>
            </div>
            <div class="toggle-switch active" id="darkThemeToggle"></div>
        </div>

        <div class="setting-item">
            <div class="setting-info">
                <div class="setting-label">Edge Touch Navigation</div>
                <div class="setting-description">Tap screen edges to turn pages</div>
            </div>
            <div class="toggle-switch active" id="edgeTouchToggle"></div>
        </div>
    </div>"""
    
    def _generate_controls(self) -> str:
        """Generate control elements."""
        return f"""    <!-- Progress Slider -->
    <div class="progress-slider-container" id="progressSliderContainer">
        <input type="range" class="progress-slider" id="progressSlider" min="1" max="{self.metadata.total_pages}" value="1">
    </div>

    <!-- Overlay -->
    <div class="overlay" id="overlay"></div>

    <!-- Touch Zones -->
    <div class="touch-zone touch-zone-left" id="touchZoneLeft"></div>
    <div class="touch-zone touch-zone-right" id="touchZoneRight"></div>

    <!-- Page Turn Indicators -->
    <div class="page-turn-indicator left" id="pageTurnLeft">←</div>
    <div class="page-turn-indicator right" id="pageTurnRight">→</div>"""
    
    def _generate_javascript(self) -> str:
        """Generate the JavaScript functionality."""
        # Generate chapter ranges for JavaScript
        chapter_ranges = {}
        for chapter in self.metadata.chapters:
            chapter_ranges[chapter.number] = {
                'start': chapter.start_page,
                'end': chapter.end_page,
                'name': chapter.name
            }
        
        return f"""    <script>
        class FinalMangaReader {{
            constructor() {{
                this.currentPage = 1;
                this.totalPages = {self.metadata.total_pages};
                this.currentChapter = 1;
                this.isNavigationPinned = false;
                this.autoHideEnabled = true;
                this.edgeTouchEnabled = true;
                this.theme = localStorage.getItem('theme') || 'dark';
                this.autoHideTimer = null;
                this.isSliderActive = false; // Track slider interaction
                
                // Chapter configuration
                this.chapterRanges = {str(chapter_ranges).replace("'", '"')};
                
                this.initializeElements();
                this.setupEventListeners();
                this.loadSettings();
                this.setupObservers();
                this.updateProgress();
                this.startAutoHideIfEnabled();
            }}

            initializeElements() {{
                // Navigation elements
                this.topNav = document.getElementById('topNav');
                this.progressBar = document.getElementById('progressBar');
                this.pageInfo = document.getElementById('pageInfo');
                this.chapterInfo = document.getElementById('chapterInfo');
                
                // Button elements
                this.pinBtn = document.getElementById('pinBtn');
                this.themeBtn = document.getElementById('themeBtn');
                this.chaptersBtn = document.getElementById('chaptersBtn');
                this.settingsBtn = document.getElementById('settingsBtn');
                
                // Panel elements
                this.chapterSidebar = document.getElementById('chapterSidebar');
                this.settingsPanel = document.getElementById('settingsPanel');
                this.overlay = document.getElementById('overlay');
                this.sidebarClose = document.getElementById('sidebarClose');
                
                // Progress slider
                this.progressSliderContainer = document.getElementById('progressSliderContainer');
                this.progressSlider = document.getElementById('progressSlider');
                
                // Reader elements
                this.readerContainer = document.getElementById('readerContainer');
                this.pages = Array.from(document.querySelectorAll('.page-image'));
                
                // Touch elements
                this.touchZoneLeft = document.getElementById('touchZoneLeft');
                this.touchZoneRight = document.getElementById('touchZoneRight');
                this.navTriggerZone = document.getElementById('navTriggerZone');
                this.pageTurnLeft = document.getElementById('pageTurnLeft');
                this.pageTurnRight = document.getElementById('pageTurnRight');
                
                // Settings toggles
                this.autoHideToggle = document.getElementById('autoHideToggle');
                this.darkThemeToggle = document.getElementById('darkThemeToggle');
                this.edgeTouchToggle = document.getElementById('edgeTouchToggle');
            }}

            setupEventListeners() {{
                // Top navigation
                this.pinBtn.addEventListener('click', () => this.togglePin());
                this.themeBtn.addEventListener('click', () => this.toggleTheme());
                this.chaptersBtn.addEventListener('click', () => this.toggleChapterSidebar());
                this.settingsBtn.addEventListener('click', () => this.toggleSettingsPanel());
                
                // Sidebar
                this.sidebarClose.addEventListener('click', () => this.closePanels());
                
                // Overlay
                this.overlay.addEventListener('click', () => this.closePanels());
                
                // Touch zones - narrower and only when nav hidden
                this.touchZoneLeft.addEventListener('click', () => this.previousPage());
                this.touchZoneRight.addEventListener('click', () => this.nextPage());
                
                // Navigation trigger zone - small area at top
                this.navTriggerZone.addEventListener('click', () => this.showNavigation());
                
                // Progress slider with real-time sync
                this.progressSlider.addEventListener('input', (e) => {{
                    this.isSliderActive = true;
                    const targetPage = parseInt(e.target.value);
                    this.goToPageImmediate(targetPage); // Real-time page change
                }});
                
                this.progressSlider.addEventListener('change', (e) => {{
                    this.isSliderActive = false;
                }});
                
                // Settings toggles
                this.autoHideToggle.addEventListener('click', () => this.toggleAutoHide());
                this.darkThemeToggle.addEventListener('click', () => this.toggleTheme());
                this.edgeTouchToggle.addEventListener('click', () => this.toggleEdgeTouch());
                
                // Chapter items
                document.querySelectorAll('.chapter-item').forEach(item => {{
                    item.addEventListener('click', () => {{
                        const chapter = parseInt(item.dataset.chapter);
                        this.goToChapter(chapter);
                    }});
                }});
                
                // Keyboard shortcuts
                document.addEventListener('keydown', (e) => this.handleKeyboard(e));
                
                // Touch gestures with reduced sensitivity
                this.setupTouchGestures();
                
                // Scroll handling for auto-hide
                let scrollTimeout;
                window.addEventListener('scroll', () => {{
                    if (this.autoHideEnabled && !this.isNavigationPinned) {{
                        this.showNavigation();
                        clearTimeout(scrollTimeout);
                        scrollTimeout = setTimeout(() => this.startAutoHide(), 2000);
                    }}
                }});

                // Page turn on click for progress slider
                this.pageInfo.addEventListener('click', () => this.toggleProgressSlider());
            }}

            setupTouchGestures() {{
                let touchStartX = 0;
                let touchStartY = 0;
                let touchStartTime = 0;
                
                this.readerContainer.addEventListener('touchstart', (e) => {{
                    touchStartX = e.touches[0].clientX;
                    touchStartY = e.touches[0].clientY;
                    touchStartTime = Date.now();
                }});
                
                this.readerContainer.addEventListener('touchend', (e) => {{
                    const touchEndX = e.changedTouches[0].clientX;
                    const touchEndY = e.changedTouches[0].clientY;
                    const deltaX = touchEndX - touchStartX;
                    const deltaY = touchEndY - touchStartY;
                    const deltaTime = Date.now() - touchStartTime;
                    
                    // Only process if not vertical scroll
                    if (Math.abs(deltaY) > Math.abs(deltaX)) return;
                    
                    // Center tap to toggle navigation - larger zone for easier access
                    if (Math.abs(deltaX) < 30 && deltaTime < 300) {{
                        const centerX = window.innerWidth / 2;
                        const tapZone = 200; // Larger center zone
                        if (Math.abs(touchStartX - centerX) < tapZone) {{
                            this.toggleNavigation();
                            return;
                        }}
                    }}
                    
                    // Swipe gestures - require more deliberate motion
                    if (deltaTime < 500 && Math.abs(deltaX) > 80) {{
                        if (deltaX > 0) {{
                            this.previousPage();
                            this.showPageTurnIndicator('left');
                        }} else {{
                            this.nextPage();
                            this.showPageTurnIndicator('right');
                        }}
                    }}
                }});
            }}

            setupObservers() {{
                // Optimized Intersection Observer for page tracking
                const observer = new IntersectionObserver((entries) => {{
                    // Find most visible page using viewport center alignment
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
                            if (!this.isSliderActive) {{
                                this.updateProgress();
                                this.updateChapter();
                            }}
                        }}
                    }}
                }}, {{ 
                    threshold: [0.2, 0.5, 0.8],
                    rootMargin: '0px'
                }});

                // Performance warning for large collections
                if (this.pages.length > 3000) {{
                    console.warn(`Large collection detected (${{this.pages.length}} pages). Consider using virtual scroll version.`);
                }}
                
                this.pages.forEach(page => observer.observe(page));
            }}

            // Navigation methods
            togglePin() {{
                this.isNavigationPinned = !this.isNavigationPinned;
                this.pinBtn.classList.toggle('pinned', this.isNavigationPinned);
                this.saveSettings();
                
                if (this.isNavigationPinned) {{
                    this.clearAutoHide();
                    this.showNavigation();
                }} else {{
                    this.startAutoHideIfEnabled();
                }}
            }}

            toggleTheme() {{
                this.theme = this.theme === 'dark' ? 'light' : 'dark';
                document.body.setAttribute('data-theme', this.theme);
                this.themeBtn.textContent = this.theme === 'dark' ? '🌙' : '☀️';
                this.updateToggle(this.darkThemeToggle, this.theme === 'dark');
                this.saveSettings();
            }}

            toggleNavigation() {{
                const isHidden = this.topNav.classList.contains('hidden');
                if (isHidden) {{
                    this.showNavigation();
                    this.startAutoHideIfEnabled();
                }} else {{
                    if (!this.isNavigationPinned) {{
                        this.hideNavigation();
                    }}
                }}
            }}

            showNavigation() {{
                this.topNav.classList.remove('hidden');
                document.body.classList.remove('nav-hidden');
            }}

            hideNavigation() {{
                if (this.isNavigationPinned) return;
                this.topNav.classList.add('hidden');
                document.body.classList.add('nav-hidden');
            }}

            startAutoHide() {{
                if (!this.autoHideEnabled || this.isNavigationPinned) return;
                this.clearAutoHide();
                this.autoHideTimer = setTimeout(() => {{
                    this.hideNavigation();
                }}, 3000);
            }}

            startAutoHideIfEnabled() {{
                if (this.autoHideEnabled && !this.isNavigationPinned) {{
                    this.startAutoHide();
                }}
            }}

            clearAutoHide() {{
                if (this.autoHideTimer) {{
                    clearTimeout(this.autoHideTimer);
                    this.autoHideTimer = null;
                }}
            }}

            // Page navigation
            nextPage() {{
                if (this.currentPage < this.totalPages) {{
                    this.goToPage(this.currentPage + 1);
                }}
            }}

            previousPage() {{
                if (this.currentPage > 1) {{
                    this.goToPage(this.currentPage - 1);
                }}
            }}

            goToPage(pageNum) {{
                if (pageNum >= 1 && pageNum <= this.totalPages) {{
                    const targetPage = document.getElementById(`page-${{pageNum}}`);
                    if (targetPage) {{
                        targetPage.scrollIntoView({{ 
                            behavior: 'smooth', 
                            block: 'start' 
                        }});
                    }}
                }}
            }}

            // Immediate page change for slider
            goToPageImmediate(pageNum) {{
                if (pageNum >= 1 && pageNum <= this.totalPages) {{
                    this.currentPage = pageNum;
                    this.updateProgress();
                    this.updateChapter();
                    
                    const targetPage = document.getElementById(`page-${{pageNum}}`);
                    if (targetPage) {{
                        targetPage.scrollIntoView({{ 
                            behavior: 'auto', // Instant scroll for slider
                            block: 'start' 
                        }});
                    }}
                }}
            }}

            // Chapter navigation
            goToChapter(chapter) {{
                if (this.chapterRanges[chapter]) {{
                    this.goToPage(this.chapterRanges[chapter].start);
                    this.closePanels();
                }}
            }}

            updateChapter() {{
                const newChapter = this.getChapterFromPage(this.currentPage);
                if (newChapter !== this.currentChapter) {{
                    this.currentChapter = newChapter;
                    this.updateChapterInfo();
                    this.updateChapterSidebar();
                }}
            }}

            getChapterFromPage(pageNum) {{
                for (const [chapter, range] of Object.entries(this.chapterRanges)) {{
                    if (pageNum >= range.start && pageNum <= range.end) {{
                        return parseInt(chapter);
                    }}
                }}
                return 1;
            }}

            updateChapterInfo() {{
                this.chapterInfo.textContent = `Ch.${{this.currentChapter}}`;
            }}

            updateChapterSidebar() {{
                document.querySelectorAll('.chapter-item').forEach(item => {{
                    const chapter = parseInt(item.dataset.chapter);
                    item.classList.toggle('active', chapter === this.currentChapter);
                }});
            }}

            updateProgress() {{
                const progress = (this.currentPage / this.totalPages) * 100;
                this.progressBar.style.width = `${{progress}}%`;
                this.pageInfo.textContent = `${{this.currentPage}} / ${{this.totalPages}}`;
                if (!this.isSliderActive) {{
                    this.progressSlider.value = this.currentPage;
                }}
                this.updateChapterInfo();
            }}

            // Panel management
            toggleChapterSidebar() {{
                if (this.chapterSidebar.classList.contains('open')) {{
                    this.closePanels();
                }} else {{
                    this.openChapterSidebar();
                }}
            }}

            openChapterSidebar() {{
                this.closePanels();
                this.chapterSidebar.classList.add('open');
                this.overlay.classList.add('visible');
            }}

            toggleSettingsPanel() {{
                if (this.settingsPanel.classList.contains('open')) {{
                    this.closePanels();
                }} else {{
                    this.openSettingsPanel();
                }}
            }}

            openSettingsPanel() {{
                this.closePanels();
                this.settingsPanel.classList.add('open');
                this.overlay.classList.add('visible');
            }}

            toggleProgressSlider() {{
                this.progressSliderContainer.classList.toggle('visible');
            }}

            closePanels() {{
                this.chapterSidebar.classList.remove('open');
                this.settingsPanel.classList.remove('open');
                this.progressSliderContainer.classList.remove('visible');
                this.overlay.classList.remove('visible');
            }}

            // Settings management
            toggleAutoHide() {{
                this.autoHideEnabled = !this.autoHideEnabled;
                this.updateToggle(this.autoHideToggle, this.autoHideEnabled);
                this.saveSettings();
                
                if (!this.autoHideEnabled) {{
                    this.clearAutoHide();
                    this.showNavigation();
                }} else if (!this.isNavigationPinned) {{
                    this.startAutoHide();
                }}
            }}

            toggleEdgeTouch() {{
                this.edgeTouchEnabled = !this.edgeTouchEnabled;
                this.updateToggle(this.edgeTouchToggle, this.edgeTouchEnabled);
                this.touchZoneLeft.style.display = this.edgeTouchEnabled ? 'block' : 'none';
                this.touchZoneRight.style.display = this.edgeTouchEnabled ? 'block' : 'none';
                this.saveSettings();
            }}

            updateToggle(toggle, active) {{
                toggle.classList.toggle('active', active);
            }}

            // Visual feedback
            showPageTurnIndicator(direction) {{
                const indicator = direction === 'left' ? this.pageTurnLeft : this.pageTurnRight;
                indicator.classList.add('visible');
                setTimeout(() => {{
                    indicator.classList.remove('visible');
                }}, 500);
            }}

            // Event handlers
            handleKeyboard(e) {{
                switch (e.key) {{
                    case 'ArrowRight':
                    case ' ':
                        e.preventDefault();
                        this.nextPage();
                        break;
                    case 'ArrowLeft':
                    case 'Backspace':
                        e.preventDefault();
                        this.previousPage();
                        break;
                    case 'Home':
                        e.preventDefault();
                        this.goToPage(1);
                        break;
                    case 'End':
                        e.preventDefault();
                        this.goToPage(this.totalPages);
                        break;
                    case 't':
                    case 'T':
                        e.preventDefault();
                        this.toggleTheme();
                        break;
                    case 'p':
                    case 'P':
                        e.preventDefault();
                        this.togglePin();
                        break;
                    case 'Escape':
                        this.closePanels();
                        break;
                }}
            }}

            // Settings persistence
            loadSettings() {{
                const settings = JSON.parse(localStorage.getItem('mangaReaderSettings') || '{{}}');
                
                this.isNavigationPinned = settings.pinned || false;
                this.autoHideEnabled = settings.autoHide !== false;
                this.edgeTouchEnabled = settings.edgeTouch !== false;
                
                // Apply loaded settings
                this.pinBtn.classList.toggle('pinned', this.isNavigationPinned);
                this.updateToggle(this.autoHideToggle, this.autoHideEnabled);
                this.updateToggle(this.darkThemeToggle, this.theme === 'dark');
                this.updateToggle(this.edgeTouchToggle, this.edgeTouchEnabled);
                
                // Apply edge touch setting
                this.touchZoneLeft.style.display = this.edgeTouchEnabled ? 'block' : 'none';
                this.touchZoneRight.style.display = this.edgeTouchEnabled ? 'block' : 'none';
                
                // Apply theme
                document.body.setAttribute('data-theme', this.theme);
                this.themeBtn.textContent = this.theme === 'dark' ? '🌙' : '☀️';
            }}

            saveSettings() {{
                const settings = {{
                    pinned: this.isNavigationPinned,
                    autoHide: this.autoHideEnabled,
                    theme: this.theme,
                    edgeTouch: this.edgeTouchEnabled
                }};
                
                localStorage.setItem('mangaReaderSettings', JSON.stringify(settings));
                localStorage.setItem('theme', this.theme);
            }}
        }}

        // Initialize the reader when DOM is loaded
        document.addEventListener('DOMContentLoaded', () => {{
            new FinalMangaReader();
        }});
    </script>"""
    
    @property
    def validator(self):
        """Get image validator instance."""
        return ImageValidator()


class MangaReaderGenerator:
    """Main class that orchestrates the manga reader generation process."""
    
    def __init__(self, base_path: str | Path):
        """
        Initialize the manga reader generator.
        
        Args:
            base_path: Path to the manga directory
        """
        self.base_path = Path(base_path).resolve()
        
        if not self.base_path.exists():
            raise FileNotFoundError(f"Directory not found: {self.base_path}")
        
        if not self.base_path.is_dir():
            raise NotADirectoryError(f"Path is not a directory: {self.base_path}")
    
    def generate(self, output_filename: str = "index-mb.html") -> Path:
        """
        Generate the manga reader HTML file.
        
        Args:
            output_filename: Name of the output HTML file
            
        Returns:
            Path to the generated HTML file
        """
        start_time = datetime.now()
        logger.info(f"Starting manga reader generation for: {self.base_path}")
        
        try:
            # Step 1: Scan filesystem
            logger.info("Scanning directory structure...")
            scanner = FileSystemScanner(self.base_path)
            folders, image_files = scanner.scan_directory()
            
            # Step 2: Analyze manga structure
            logger.info("Analyzing manga structure...")
            analyzer = MangaAnalyzer(self.base_path)
            metadata = analyzer.analyze_manga(folders, image_files)
            
            # Log metadata summary
            logger.info(f"Manga: {metadata.title}")
            logger.info(f"Chapters: {len(metadata.chapters)}")
            logger.info(f"Total pages: {metadata.total_pages}")
            
            # Step 3: Generate HTML
            logger.info("Generating HTML file...")
            generator = MangaHTMLGenerator(metadata)
            output_path = self.base_path / output_filename
            result_path = generator.generate_html(output_path)
            
            # Completion
            duration = datetime.now() - start_time
            logger.info(f"Successfully generated manga reader in {duration.total_seconds():.2f} seconds")
            logger.info(f"Output file: {result_path}")
            
            return result_path
            
        except Exception as e:
            logger.error(f"Error generating manga reader: {e}")
            raise


def main():
    """Main entry point for the script."""
    print("🖼️  Enhanced Manga Reader HTML Generator V3")
    print("=" * 50)
    
    while True:
        try:
            # Get user input
            path_input = input("\nEnter the manga directory path (or press Enter to exit): ").strip()
            
            if not path_input:
                print("\n👋 Goodbye!")
                break
            
            # Remove quotes if present
            path_input = path_input.strip('\'"')
            
            # Generate manga reader
            generator = MangaReaderGenerator(path_input)
            output_path = generator.generate()
            
            print(f"\n✅ Success! Generated: {output_path.name}")
            
        except (FileNotFoundError, NotADirectoryError) as e:
            print(f"\n❌ Error: {e}")
        except KeyboardInterrupt:
            print("\n\n👋 Interrupted by user. Goodbye!")
            break
        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            print(f"\n❌ Unexpected error occurred. Check the log for details.")
            
        print("\n" + "=" * 50)


if __name__ == "__main__":
    main()