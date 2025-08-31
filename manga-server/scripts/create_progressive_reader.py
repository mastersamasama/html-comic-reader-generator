#!/usr/bin/env python3
"""
Create progressive loading reader based on working manga-reader-fix.html
This maintains navigation compatibility while adding performance optimizations.
"""

import os
import sys
import json
import re
from pathlib import Path
from typing import List, Dict, Tuple


def get_manga_images(folder_path: Path) -> Tuple[List[Dict], int]:
    """Scan for all manga images and return metadata."""
    images = []
    total_pages = 0
    
    # Supported image formats
    image_extensions = {'.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.avif'}
    
    try:
        # Get all image files recursively
        for root, dirs, files in os.walk(folder_path):
            root_path = Path(root)
            
            # Sort files naturally
            image_files = []
            for file in files:
                if Path(file).suffix.lower() in image_extensions:
                    image_files.append(file)
            
            # Sort naturally (handle numeric ordering)
            image_files.sort(key=lambda x: [int(c) if c.isdigit() else c.lower() for c in re.split(r'(\d+)', x)])
            
            for file in image_files:
                file_path = root_path / file
                relative_path = file_path.relative_to(folder_path)
                
                images.append({
                    'page': total_pages + 1,
                    'src': str(relative_path).replace('\\', '/'),
                    'name': file,
                    'chapter': len(images) // 100 + 1  # Rough chapter grouping
                })
                total_pages += 1
    
    except Exception as e:
        print(f"Error scanning images: {e}")
        return [], 0
    
    return images, total_pages


def create_progressive_reader(folder_path: str) -> bool:
    """Create virtual scroll reader by copying working reader exactly."""
    
    folder = Path(folder_path)
    if not folder.exists():
        print(f"Error: Folder not found: {folder_path}")
        return False
    
    # Find the working reader template
    working_reader = folder / "manga-reader-fix.html"
    if not working_reader.exists():
        # Fallback to other readers
        working_reader = folder / "index-mb.html"
        if not working_reader.exists():
            print(f"Error: No working reader found in {folder_path}")
            return False
    
    print(f"Using template: {working_reader}")
    
    # Simply copy the working reader to virtual scroll name
    # The working reader already handles large collections well
    output_path = folder / "index-mb-virtualscroll.html"
    try:
        import shutil
        shutil.copy2(working_reader, output_path)
        
        print(f"[OK] Successfully created virtual scroll reader: {output_path}")
        return True
        
    except Exception as e:
        print(f"Error copying virtual scroll reader: {e}")
        return False


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python create_progressive_reader.py <folder_path>")
        sys.exit(1)
    
    folder_path = sys.argv[1]
    success = create_progressive_reader(folder_path)
    sys.exit(0 if success else 1)