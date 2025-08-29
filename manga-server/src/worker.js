/**
 * Worker Thread for CPU-intensive manga processing tasks
 * Handles: metadata extraction, image processing, batch updates
 */

import { parentPort, workerData } from "node:worker_threads";
import { readdir, stat } from "node:fs/promises";
import { join, extname, basename } from "node:path";

class MangaWorker {
  constructor(public workerId: number) {}

  async processBatch(paths) {
    const results = [];
    
    for (const path of paths) {
      try {
        const metadata = await this.extractMetadata(path);
        if (metadata) {
          results.push(metadata);
        }
      } catch (error) {
        console.error(`Worker ${this.workerId} failed to process ${path}:`, error);
      }
    }
    
    return results;
  }

  async extractMetadata(mangaPath) {
    try {
      const stats = await stat(mangaPath);
      const name = basename(mangaPath);
      
      // Fast directory scan
      const files = await readdir(mangaPath, { withFileTypes: true });
      
      // Count images efficiently
      let imageCount = 0;
      let coverImage = null;
      let chapterCount = 0;
      
      for (const file of files) {
        if (file.isFile()) {
          const ext = extname(file.name).toLowerCase();
          if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'].includes(ext)) {
            imageCount++;
            if (!coverImage) {
              coverImage = file.name;
            }
          }
        } else if (file.isDirectory()) {
          chapterCount++;
        }
      }
      
      // If no subdirectories, treat as single chapter
      if (chapterCount === 0 && imageCount > 0) {
        chapterCount = 1;
      }

      return {
        id: name,
        title: this.extractTitle(name),
        path: mangaPath,
        coverImage: coverImage ? `/${name}/${coverImage}` : null,
        totalPages: imageCount,
        chapters: chapterCount,
        lastModified: stats.mtime.getTime(),
        size: stats.size
      };
    } catch (error) {
      console.error(`Metadata extraction failed for ${mangaPath}:`, error);
      return null;
    }
  }

  extractTitle(folderName) {
    // Enhanced title extraction
    return folderName
      .replace(/^\d+\./, '') // Remove leading numbers
      .replace(/[._-]/g, ' ') // Replace separators with spaces
      .replace(/\s+/g, ' ')   // Normalize whitespace
      .trim();
  }

  async bulkUpdate(mangaIds, rootPath) {
    const results = [];
    
    for (const id of mangaIds) {
      const mangaPath = join(rootPath, id);
      const metadata = await this.extractMetadata(mangaPath);
      if (metadata) {
        results.push(metadata);
      }
    }
    
    return results;
  }
}

// Worker message handler
if (parentPort) {
  const worker = new MangaWorker(workerData?.workerId || 0);
  
  parentPort.on('message', async (message) => {
    try {
      let result;
      
      switch (message.type) {
        case 'scanBatch':
          result = await worker.processBatch(message.paths);
          break;
        case 'bulkUpdate':
          result = await worker.bulkUpdate(message.mangaIds, message.rootPath);
          break;
        case 'extractMetadata':
          result = await worker.extractMetadata(message.path);
          break;
        default:
          throw new Error(`Unknown task type: ${message.type}`);
      }
      
      parentPort.postMessage({ data: result });
    } catch (error) {
      parentPort.postMessage({ error: error.message });
    }
  });
}