/**
 * High-Performance Manga Content Delivery Server
 * 
 * A zero-dependency, production-ready manga server built with Bun.js
 * Features: Advanced caching, streaming, compression, WebSocket sync
 * 
 * @author Manga Server Team
 * @version 2.0.0
 * @license MIT
 */

import { serve, file } from "bun";
import { readdir, stat } from "node:fs/promises";
import { join, resolve, extname, relative } from "node:path";
import { createHash } from "node:crypto";

// ============================================================================
// Configuration & Types
// ============================================================================

const CONFIG = {
  // Server basics
  port: parseInt(process.env.PORT || "80"),
  hostname: process.env.HOSTNAME || "0.0.0.0",
  mangaRoot: process.env.MANGA_ROOT || "./本",
  
  // Performance settings
  cacheSize: parseInt(process.env.CACHE_SIZE_MB || "512") * 1024 * 1024,
  maxConnections: parseInt(process.env.MAX_CONNECTIONS || "5000"),
  streamingThreshold: parseInt(process.env.STREAMING_THRESHOLD || "262144"), // 256KB
  compressionThreshold: parseInt(process.env.COMPRESSION_THRESHOLD || "1024"), // 1KB
  connectionPoolSize: parseInt(process.env.CONNECTION_POOL_SIZE || "100"),
  
  // Features
  corsOrigin: process.env.CORS_ORIGIN || "*",
  backgroundIndexing: process.env.BACKGROUND_INDEXING !== "false",
  
  // Rate limiting (disabled by default)
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED === "true",
    window: parseInt(process.env.RATE_LIMIT_WINDOW || "60000"),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "1000")
  }
};

// Type definitions
interface CacheNode {
  key: string;
  data: Uint8Array;
  headers: Record<string, string>;
  size: number;
  hits: number;
  created: number;
  lastAccess: number;
  prev?: CacheNode;
  next?: CacheNode;
}

interface CacheEntry {
  data: Uint8Array;
  headers: Record<string, string>;
  size: number;
  hits: number;
  created: number;
  lastAccess: number;
}

interface MangaItem {
  id: string;
  title: string;
  path: string;
  readerUrl: string | null;
  coverUrl: string | null;
  chapters: number;
  totalPages: number;
  lastModified: string;
}

interface Chapter {
  number: number;
  name: string;
  pages: number;
  path: string;
}

interface ReadingProgress {
  mangaId: string;
  page: number;
  totalPages: number;
  timestamp: number;
  percentage: number;
}

// ============================================================================
// Advanced LRU Cache Manager
// ============================================================================

class CacheManager {
  private cache = new Map<string, CacheNode>();
  private head: CacheNode;
  private tail: CacheNode;
  private currentSize = 0;
  private hits = 0;
  private misses = 0;

  constructor(private maxSize: number) {
    // Initialize doubly linked list with dummy nodes
    this.head = { key: '', data: new Uint8Array(0), headers: {}, size: 0, hits: 0, created: 0, lastAccess: 0 };
    this.tail = { key: '', data: new Uint8Array(0), headers: {}, size: 0, hits: 0, created: 0, lastAccess: 0 };
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  async get(key: string): Promise<CacheEntry | null> {
    const node = this.cache.get(key);
    
    if (node) {
      node.hits++;
      node.lastAccess = Date.now();
      this.hits++;
      
      // Move to front in O(1) time
      this.moveToFront(node);
      
      return {
        data: node.data,
        headers: node.headers,
        size: node.size,
        hits: node.hits,
        created: node.created,
        lastAccess: node.lastAccess
      };
    }
    
    this.misses++;
    return null;
  }

  async set(key: string, data: Uint8Array, headers: Record<string, string>) {
    const size = data.byteLength;
    
    // Skip if data is too large for cache (>10% of total cache)
    if (size > this.maxSize * 0.1) return;
    
    // Remove existing entry if it exists
    const existing = this.cache.get(key);
    if (existing) {
      this.removeNode(existing);
      this.currentSize -= existing.size;
      this.cache.delete(key);
    }
    
    // Evict entries until we have space
    while (this.currentSize + size > this.maxSize && this.cache.size > 0) {
      this.evictLRU();
    }
    
    // Create and add new node
    const node: CacheNode = {
      key,
      data,
      headers,
      size,
      hits: 0,
      created: Date.now(),
      lastAccess: Date.now()
    };
    
    this.addToFront(node);
    this.cache.set(key, node);
    this.currentSize += size;
  }

  private moveToFront(node: CacheNode) {
    this.removeNode(node);
    this.addToFront(node);
  }

  private addToFront(node: CacheNode) {
    node.prev = this.head;
    node.next = this.head.next;
    if (this.head.next) {
      this.head.next.prev = node;
    }
    this.head.next = node;
  }

  private removeNode(node: CacheNode) {
    if (node.prev) node.prev.next = node.next;
    if (node.next) node.next.prev = node.prev;
  }

  private evictLRU() {
    if (this.tail.prev && this.tail.prev !== this.head) {
      const lastNode = this.tail.prev;
      this.removeNode(lastNode);
      this.cache.delete(lastNode.key);
      this.currentSize -= lastNode.size;
    }
  }

  // Memory pressure adaptation
  adaptToMemoryPressure() {
    const memUsage = process.memoryUsage();
    const heapUsedRatio = memUsage.heapUsed / memUsage.heapTotal;
    
    if (heapUsedRatio > 0.8) {
      // Aggressive eviction when memory is tight
      const targetSize = this.maxSize * 0.5;
      while (this.currentSize > targetSize && this.cache.size > 0) {
        this.evictLRU();
      }
    }
  }

  getStats() {
    const hitRate = this.hits / (this.hits + this.misses) || 0;
    const memUsage = process.memoryUsage();
    
    return {
      size: this.cache.size,
      currentSize: this.currentSize,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: (hitRate * 100).toFixed(2) + '%',
      memoryPressure: ((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(2) + '%'
    };
  }
}

// ============================================================================
// Rate Limiter
// ============================================================================

class RateLimiter {
  private requests = new Map<string, number[]>();

  constructor(private window: number, private maxRequests: number) {}

  isAllowed(key: string): boolean {
    const now = Date.now();
    const userRequests = this.requests.get(key) || [];
    
    // Remove old requests outside window
    const valid = userRequests.filter(time => now - time < this.window);
    
    if (valid.length >= this.maxRequests) {
      return false;
    }
    
    valid.push(now);
    this.requests.set(key, valid);
    return true;
  }

  cleanup() {
    const now = Date.now();
    
    for (const [key, times] of this.requests) {
      const valid = times.filter(time => now - time < this.window);
      
      if (valid.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, valid);
      }
    }
  }
}

// ============================================================================
// Manga Collection Scanner
// ============================================================================

class MangaScanner {
  constructor(private rootPath: string) {}

  async scanCollection(): Promise<MangaItem[]> {
    const items: MangaItem[] = [];
    
    try {
      const entries = await readdir(this.rootPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const mangaPath = join(this.rootPath, entry.name);
          const metadata = await this.extractMetadata(mangaPath);
          
          if (metadata) {
            items.push(metadata);
          }
        }
      }
      
      return items.sort((a, b) => a.id.localeCompare(b.id));
    } catch (error) {
      console.error('Failed to scan manga collection:', error);
      return [];
    }
  }

  async extractMetadata(mangaPath: string): Promise<MangaItem | null> {
    try {
      const name = mangaPath.split(/[/\\]/).pop() || '';
      const files = await readdir(mangaPath, { recursive: true });
      
      // Find reader HTML files
      const readerFile = files.find(f => 
        f === 'index-mb.html' || f === 'index.html'
      );
      
      // Find image files for pages and cover
      const imageFiles = files.filter(f => 
        /\.(jpg|jpeg|png|webp|gif|avif)$/i.test(f)
      ).sort();
      
      const coverImage = imageFiles[0];
      const chapters = await this.detectChapters(mangaPath);
      
      return {
        id: name,
        title: this.extractTitle(name),
        path: relative(this.rootPath, mangaPath),
        readerUrl: readerFile ? `/${name}/${readerFile}` : null,
        coverUrl: coverImage ? `/${name}/${coverImage}` : null,
        chapters: chapters.length,
        totalPages: imageFiles.length,
        lastModified: (await stat(mangaPath)).mtime.toISOString()
      };
    } catch (error) {
      console.error(`Failed to extract metadata for ${mangaPath}:`, error);
      return null;
    }
  }

  private extractTitle(folderName: string): string {
    // Extract title from folder name (e.g., "0001.Manga Title" -> "Manga Title")
    return folderName.split('.').slice(-1)[0].trim();
  }

  private async detectChapters(mangaPath: string): Promise<Chapter[]> {
    const chapters: Chapter[] = [];
    
    try {
      const entries = await readdir(mangaPath, { withFileTypes: true });
      
      let chapterNumber = 1;
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const chapterPath = join(mangaPath, entry.name);
          const images = await this.getImages(chapterPath);
          
          if (images.length > 0) {
            chapters.push({
              number: chapterNumber++,
              name: entry.name,
              pages: images.length,
              path: relative(this.rootPath, chapterPath)
            });
          }
        }
      }
      
      // If no subdirectories, treat root as single chapter
      if (chapters.length === 0) {
        const images = await this.getImages(mangaPath);
        if (images.length > 0) {
          chapters.push({
            number: 1,
            name: 'Chapter 1',
            pages: images.length,
            path: relative(this.rootPath, mangaPath)
          });
        }
      }
      
      return chapters;
    } catch {
      return [];
    }
  }

  private async getImages(dirPath: string): Promise<string[]> {
    try {
      const files = await readdir(dirPath);
      return files.filter(f => 
        /\.(jpg|jpeg|png|webp|gif|avif)$/i.test(f)
      ).sort();
    } catch {
      return [];
    }
  }
}

// ============================================================================
// High-Performance Static File Handler
// ============================================================================

class StaticHandler {
  private mimeTypes: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.json': 'application/json'
  };

  private activeStreams = 0;
  private maxConcurrentStreams = CONFIG.connectionPoolSize;
  private etagCache = new Map<string, string>();

  constructor(
    private rootPath: string,
    private cache: CacheManager
  ) {}

  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    let pathname = decodeURIComponent(url.pathname);
    
    // Default to index.html for root
    if (pathname === '/') {
      pathname = '/index.html';
    }
    
    // Security: Prevent path traversal
    const filePath = join(this.rootPath, pathname);
    const resolvedPath = resolve(filePath);
    
    if (!resolvedPath.startsWith(resolve(this.rootPath))) {
      return new Response('Forbidden', { 
        status: 403,
        headers: this.getCorsHeaders()
      });
    }
    
    // Check cache first
    const cacheKey = `static:${pathname}`;
    const cached = await this.cache.get(cacheKey);
    
    if (cached) {
      return new Response(cached.data, {
        headers: { ...cached.headers, ...this.getCorsHeaders() }
      });
    }
    
    // File handling
    try {
      const bunFile = file(resolvedPath);
      
      if (!await bunFile.exists()) {
        return new Response('Not Found', { 
          status: 404,
          headers: this.getCorsHeaders()
        });
      }

      const fileSize = bunFile.size;
      const ext = extname(resolvedPath);
      
      // Fast ETag generation using file stats
      const etag = this.getFastETag(resolvedPath, fileSize);
      
      // Check If-None-Match for 304 response
      if (request.headers.get('if-none-match') === etag) {
        return new Response(null, { 
          status: 304,
          headers: this.getCorsHeaders()
        });
      }

      // Handle range requests for large files
      const range = request.headers.get('range');
      if (range && fileSize > CONFIG.streamingThreshold) {
        return this.handleRangeRequest(bunFile, range, etag);
      }

      // Use streaming for large files
      if (fileSize > CONFIG.streamingThreshold) {
        return this.handleStreamingResponse(bunFile, etag, ext);
      }
      
      // Handle small files with compression and caching
      const data = await bunFile.arrayBuffer();
      const uint8Array = new Uint8Array(data);
      
      const headers = {
        'Content-Type': this.getMimeType(ext),
        'Content-Length': String(fileSize),
        'ETag': etag,
        'Cache-Control': this.getCacheControl(ext),
        'Accept-Ranges': 'bytes',
        ...this.getCorsHeaders()
      };

      // Apply compression for text-based files
      const compressedData = this.shouldCompress(ext, uint8Array) 
        ? await this.compressData(uint8Array, request) 
        : { data: uint8Array, headers: {} };
      
      // Cache small files only
      if (fileSize < CONFIG.streamingThreshold) {
        await this.cache.set(cacheKey, compressedData.data, { ...headers, ...compressedData.headers });
      }
      
      return new Response(compressedData.data, { 
        headers: { ...headers, ...compressedData.headers }
      });
      
    } catch (error) {
      console.error('Static file error:', error);
      return new Response('Internal Server Error', { 
        status: 500,
        headers: this.getCorsHeaders()
      });
    }
  }

  private async handleStreamingResponse(bunFile: any, etag: string, ext: string): Promise<Response> {
    if (this.activeStreams >= this.maxConcurrentStreams) {
      return new Response('Service Unavailable - Too many active streams', { 
        status: 503,
        headers: this.getCorsHeaders()
      });
    }

    this.activeStreams++;
    const self = this;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const chunkSize = 64 * 1024; // 64KB chunks
          let offset = 0;
          
          while (offset < bunFile.size) {
            const chunk = bunFile.slice(offset, Math.min(offset + chunkSize, bunFile.size));
            const data = await chunk.arrayBuffer();
            controller.enqueue(new Uint8Array(data));
            offset += chunkSize;
          }
          
          controller.close();
        } catch (error) {
          controller.error(error);
        } finally {
          // Decrement counter when stream completes
          self.activeStreams--;
        }
      },
      
      cancel() {
        // Stream cancelled by client - decrement counter
        self.activeStreams--;
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': this.getMimeType(ext),
        'Content-Length': String(bunFile.size),
        'ETag': etag,
        'Cache-Control': this.getCacheControl(ext),
        'Accept-Ranges': 'bytes',
        ...this.getCorsHeaders()
      }
    });
  }

  private async handleRangeRequest(bunFile: any, range: string, etag: string): Promise<Response> {
    const size = bunFile.size;
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : size - 1;
    
    if (start >= size || end >= size) {
      return new Response('Range Not Satisfiable', { 
        status: 416,
        headers: {
          'Content-Range': `bytes */${size}`,
          ...this.getCorsHeaders()
        }
      });
    }
    
    const chunkSize = end - start + 1;
    const chunk = bunFile.slice(start, end + 1);
    const data = await chunk.arrayBuffer();
    
    return new Response(data, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(chunkSize),
        'ETag': etag,
        'Content-Type': this.getMimeType(extname(bunFile.name || '')),
        ...this.getCorsHeaders()
      }
    });
  }

  private getFastETag(filePath: string, fileSize: number): string {
    const cacheKey = `${filePath}:${fileSize}`;
    
    if (this.etagCache.has(cacheKey)) {
      return this.etagCache.get(cacheKey)!;
    }
    
    // Generate ETag from file path and size (much faster than content hash)
    const hash = createHash('md5');
    hash.update(filePath + fileSize);
    const etag = `"${hash.digest('hex').substring(0, 16)}"`;
    
    // Cache ETag with size limit
    this.etagCache.set(cacheKey, etag);
    if (this.etagCache.size > 10000) {
      const firstKey = this.etagCache.keys().next().value;
      this.etagCache.delete(firstKey);
    }
    
    return etag;
  }

  private shouldCompress(ext: string, data: Uint8Array): boolean {
    if (data.length < CONFIG.compressionThreshold) return false;
    return ['.html', '.css', '.js', '.json', '.svg'].includes(ext);
  }

  private async compressData(data: Uint8Array, request: Request): Promise<{ data: Uint8Array; headers: Record<string, string> }> {
    const acceptEncoding = request.headers.get('accept-encoding') || '';
    
    if (acceptEncoding.includes('gzip')) {
      const compressed = Bun.gzipSync(data);
      return {
        data: compressed,
        headers: { 'Content-Encoding': 'gzip', 'Vary': 'Accept-Encoding' }
      };
    }
    
    return { data, headers: {} };
  }

  private getCacheControl(ext: string): string {
    if (['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'].includes(ext)) {
      return 'public, max-age=31536000, immutable'; // 1 year for images
    }
    if (['.css', '.js'].includes(ext)) {
      return 'public, max-age=2592000'; // 1 month for CSS/JS
    }
    return 'public, max-age=3600'; // 1 hour for HTML
  }

  private getMimeType(ext: string): string {
    return this.mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
  }

  private getCorsHeaders(): Record<string, string> {
    return {
      'Access-Control-Allow-Origin': CONFIG.corsOrigin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Range',
      'Access-Control-Max-Age': '86400'
    };
  }
}

// ============================================================================
// API Handler
// ============================================================================

class APIHandler {
  constructor(
    private scanner: MangaScanner,
    private cache: CacheManager
  ) {}

  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace('/api/', '');
    
    try {
      switch (true) {
        case path === 'manga':
          return await this.getMangaList(request);
        case path.startsWith('manga/') && path.split('/').length === 2:
          const id = decodeURIComponent(path.split('/')[1]);
          return await this.getMangaDetails(id);
        case path === 'search':
          return await this.searchManga(request);
        case path === 'stats':
          return await this.getStats();
        case path === 'health':
          return await this.getHealth();
        default:
          return this.jsonResponse({ error: 'Not Found' }, 404);
      }
    } catch (error) {
      console.error('API error:', error);
      return this.jsonResponse({ error: 'Internal Server Error' }, 500);
    }
  }

  private async getMangaList(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    
    const cacheKey = `api:manga:${page}:${limit}`;
    const cached = await this.cache.get(cacheKey);
    
    if (cached) {
      return new Response(cached.data, {
        headers: { 'Content-Type': 'application/json', ...this.getCorsHeaders() }
      });
    }
    
    const allManga = await this.scanner.scanCollection();
    const start = (page - 1) * limit;
    const end = start + limit;
    const items = allManga.slice(start, end);
    
    const response = {
      data: items,
      meta: {
        page,
        limit,
        total: allManga.length,
        totalPages: Math.ceil(allManga.length / limit)
      }
    };
    
    const responseData = JSON.stringify(response);
    await this.cache.set(
      cacheKey,
      new TextEncoder().encode(responseData),
      { 'Content-Type': 'application/json' }
    );
    
    return this.jsonResponse(response);
  }

  private async getMangaDetails(id: string): Promise<Response> {
    const mangaPath = join(CONFIG.mangaRoot, id);
    const metadata = await this.scanner.extractMetadata(mangaPath);
    
    if (!metadata) {
      return this.jsonResponse({ error: 'Manga not found' }, 404);
    }
    
    return this.jsonResponse(metadata);
  }

  private async searchManga(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const query = url.searchParams.get('q')?.toLowerCase() || '';
    
    if (!query) {
      return this.jsonResponse({ error: 'Query parameter required' }, 400);
    }
    
    const allManga = await this.scanner.scanCollection();
    const results = allManga.filter(manga => 
      manga.title.toLowerCase().includes(query) ||
      manga.id.toLowerCase().includes(query)
    );
    
    return this.jsonResponse({
      results,
      count: results.length
    });
  }

  private async getStats(): Promise<Response> {
    return this.jsonResponse({
      cache: this.cache.getStats(),
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        platform: process.platform,
        version: Bun.version
      }
    });
  }

  private async getHealth(): Promise<Response> {
    return this.jsonResponse({
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  }

  private jsonResponse(data: any, status: number = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json', ...this.getCorsHeaders() }
    });
  }

  private getCorsHeaders(): Record<string, string> {
    return {
      'Access-Control-Allow-Origin': CONFIG.corsOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };
  }
}

// ============================================================================
// WebSocket Handler for Real-time Progress Sync
// ============================================================================

class WebSocketHandler {
  private clients = new Set<WebSocket>();
  private readingProgress = new Map<string, ReadingProgress>();

  handleConnection(ws: WebSocket, request: Request) {
    this.clients.add(ws);
    console.log(`📱 WebSocket client connected (${this.clients.size} total)`);

    ws.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(ws, data);
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.addEventListener('close', () => {
      this.clients.delete(ws);
      console.log(`📱 WebSocket client disconnected (${this.clients.size} total)`);
    });

    ws.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
      this.clients.delete(ws);
    });
  }

  private handleMessage(ws: WebSocket, data: any) {
    switch (data.type) {
      case 'progress_update':
        this.handleProgressUpdate(data);
        break;
      case 'get_progress':
        this.sendProgress(ws, data.mangaId);
        break;
    }
  }

  private handleProgressUpdate(data: any) {
    const { mangaId, page, totalPages } = data;
    const progress: ReadingProgress = {
      mangaId,
      page,
      totalPages,
      timestamp: Date.now(),
      percentage: Math.round((page / totalPages) * 100)
    };

    this.readingProgress.set(mangaId, progress);

    // Broadcast to all clients
    this.broadcast({
      type: 'progress_sync',
      ...progress
    });
  }

  private sendProgress(ws: WebSocket, mangaId: string) {
    const progress = this.readingProgress.get(mangaId);
    if (progress) {
      ws.send(JSON.stringify({
        type: 'progress_data',
        ...progress
      }));
    }
  }

  private broadcast(message: any) {
    const data = JSON.stringify(message);
    this.clients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });
  }

  getStats() {
    return {
      connectedClients: this.clients.size,
      trackedManga: this.readingProgress.size,
      totalProgress: Array.from(this.readingProgress.values())
    };
  }
}

// ============================================================================
// Main Server Class
// ============================================================================

class MangaServer {
  private cache: CacheManager;
  private rateLimiter: RateLimiter;
  private scanner: MangaScanner;
  private staticHandler: StaticHandler;
  private apiHandler: APIHandler;
  private wsHandler: WebSocketHandler;
  private connections = 0;

  constructor() {
    this.cache = new CacheManager(CONFIG.cacheSize);
    this.rateLimiter = new RateLimiter(CONFIG.rateLimit.window, CONFIG.rateLimit.maxRequests);
    this.scanner = new MangaScanner(CONFIG.mangaRoot);
    this.staticHandler = new StaticHandler(CONFIG.mangaRoot, this.cache);
    this.apiHandler = new APIHandler(this.scanner, this.cache);
    this.wsHandler = new WebSocketHandler();
    
    this.setupPerformanceOptimizations();
  }

  private setupPerformanceOptimizations() {
    // Rate limiter cleanup (only if enabled)
    if (CONFIG.rateLimit.enabled) {
      setInterval(() => this.rateLimiter.cleanup(), 60000);
    }

    // Memory management and cache optimization
    setInterval(() => {
      this.cache.adaptToMemoryPressure();
      
      const memUsage = process.memoryUsage();
      const heapUsedRatio = memUsage.heapUsed / memUsage.heapTotal;
      
      if (heapUsedRatio > 0.85 && global.gc) {
        global.gc();
        console.log('🧹 Forced garbage collection due to high memory usage');
      }
    }, 30000);

    // Background manga collection indexing
    if (CONFIG.backgroundIndexing) {
      setTimeout(() => this.backgroundIndexManga(), 5000);
      setInterval(() => this.backgroundIndexManga(), 300000);
    }
  }

  private async backgroundIndexManga() {
    try {
      console.log('📚 Background indexing manga collection...');
      const start = Date.now();
      await this.scanner.scanCollection();
      console.log(`📚 Background indexing completed in ${Date.now() - start}ms`);
    } catch (error) {
      console.error('Background indexing failed:', error);
    }
  }

  async handleRequest(request: Request, server?: any): Promise<Response> {
    this.connections++;
    
    try {
      // WebSocket upgrade handling
      if (request.headers.get('upgrade') === 'websocket') {
        if (server?.upgrade(request)) {
          return new Response('Upgraded to WebSocket', { status: 101 });
        } else {
          return new Response('WebSocket upgrade failed', { status: 400 });
        }
      }
      
      // Connection limit check
      if (this.connections > CONFIG.maxConnections) {
        return new Response('Service Unavailable', { status: 503 });
      }
      
      // Rate limiting (if enabled)
      if (CONFIG.rateLimit.enabled) {
        const clientIp = request.headers.get('x-forwarded-for') || 
                        request.headers.get('x-real-ip') || 
                        'unknown';
        
        if (!this.rateLimiter.isAllowed(clientIp)) {
          return new Response('Too Many Requests', { 
            status: 429,
            headers: {
              'Retry-After': '60',
              'X-RateLimit-Limit': String(CONFIG.rateLimit.maxRequests),
              'X-RateLimit-Window': String(CONFIG.rateLimit.window / 1000)
            }
          });
        }
      }
      
      // CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': CONFIG.corsOrigin,
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Range',
            'Access-Control-Max-Age': '86400'
          }
        });
      }
      
      // Security headers for all responses
      const baseHeaders = {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
      };
      
      // Route to appropriate handler
      const url = new URL(request.url);
      let response: Response;
      
      if (url.pathname.startsWith('/api/')) {
        response = await this.apiHandler.handle(request);
      } else {
        response = await this.staticHandler.handle(request);
      }
      
      // Add security headers
      Object.entries(baseHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      
      return response;
      
    } finally {
      this.connections--;
    }
  }

  start() {
    const server = serve({
      port: CONFIG.port,
      hostname: CONFIG.hostname,
      
      fetch: (request, server) => this.handleRequest(request, server),
      
      websocket: {
        open: (ws) => {
          this.wsHandler.handleConnection(ws, new Request(''));
        },
        message: () => {}, // Handled in WebSocketHandler
        close: () => {}    // Handled in WebSocketHandler
      },
      
      error(error) {
        console.error('Server error:', error);
        return new Response('Internal Server Error', { 
          status: 500,
          headers: {
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY'
          }
        });
      }
    });
    
    this.displayStartupMessage();
    return server;
  }

  private displayStartupMessage() {
    const memUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    
    console.log(`
╔═══════════════════════════════════════════════════════════════════════╗
║                   High-Performance Manga Server v2.0                 ║
╠═══════════════════════════════════════════════════════════════════════╣
║  Status:  ✅ Running with Advanced Optimizations                     ║
║  URL:     http://${CONFIG.hostname}:${CONFIG.port.toString().padEnd(50)} ║
║  Root:    ${CONFIG.mangaRoot.padEnd(58)} ║
║  Cache:   ${(CONFIG.cacheSize / 1024 / 1024)}MB Memory + ETag Cache${' '.repeat(28)} ║
║  Memory:  ${memUsage}MB used${' '.repeat(48)} ║
║                                                                       ║
║  🚀 Performance Features:                                             ║
║  • Advanced LRU Cache with O(1) operations                           ║
║  • Streaming for files >${(CONFIG.streamingThreshold/1024)}KB (prevents memory bloat)${' '.repeat(16)} ║
║  • Gzip compression for text files >${CONFIG.compressionThreshold}B${' '.repeat(31)} ║
║  • Background manga indexing every 5 minutes                         ║
║  • Memory pressure adaptation & auto-GC                              ║
║  • Connection pooling (max ${CONFIG.maxConnections} concurrent)${' '.repeat(25)} ║
║                                                                       ║
║  🌐 API Endpoints:                                                    ║
║  • GET  /api/manga              - List manga with pagination          ║
║  • GET  /api/manga/[id]         - Get specific manga details          ║
║  • GET  /api/search?q=[query]   - Search manga collection             ║
║  • GET  /api/health             - Health check                        ║
║  • GET  /api/stats              - Performance statistics              ║
║  • WS   ws://${CONFIG.hostname}:${CONFIG.port}          - Real-time progress sync${' '.repeat(16)} ║
╚═══════════════════════════════════════════════════════════════════════╝
    `);
  }
}

// ============================================================================
// Server Startup
// ============================================================================

// Enable garbage collection if available
if (process.argv.includes('--expose-gc')) {
  console.log('🧹 Garbage collection enabled for optimal memory management');
}

// Start server
const server = new MangaServer();
server.start();

// Graceful shutdown handlers
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down gracefully...');
  process.exit(0);
});

// Unhandled error logging
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});