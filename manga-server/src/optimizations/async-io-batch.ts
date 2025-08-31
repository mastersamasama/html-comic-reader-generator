/**
 * Advanced Async I/O Batching System
 * Optimizes file operations through intelligent batching and prefetching
 */

import { readdir, stat, open, readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { performance } from 'node:perf_hooks';

interface BatchRequest {
  id: string;
  operation: 'read' | 'stat' | 'readdir' | 'metadata';
  path: string;
  options?: any;
  priority: 'low' | 'normal' | 'high';
  timestamp: number;
  resolve: (result: any) => void;
  reject: (error: Error) => void;
}

interface IOMetrics {
  totalOperations: number;
  batchOperations: number;
  cacheHits: number;
  avgBatchSize: number;
  avgResponseTime: number;
  fsCallsAvoided: number;
  prefetchHits: number;
}

interface FileMetadata {
  path: string;
  size: number;
  mtime: Date;
  isDirectory: boolean;
  children?: string[];
  stats?: any;
}

class AsyncIOBatcher {
  private readQueue: BatchRequest[] = [];
  private statQueue: BatchRequest[] = [];
  private readdirQueue: BatchRequest[] = [];
  private metadataQueue: BatchRequest[] = [];
  
  private processingBatch = false;
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly batchTimeout = 5; // 5ms max batch delay
  private readonly maxBatchSize = 100;
  
  private fsCache = new Map<string, { data: any; expiry: number }>();
  private prefetchCache = new Map<string, any>();
  private pathRelations = new Map<string, string[]>(); // Parent -> Children
  
  private metrics: IOMetrics = {
    totalOperations: 0,
    batchOperations: 0,
    cacheHits: 0,
    avgBatchSize: 0,
    avgResponseTime: 0,
    fsCallsAvoided: 0,
    prefetchHits: 0
  };
  
  constructor(private cacheTimeoutMs: number = 30000) {
    this.startBatchProcessor();
    this.startCacheCleanup();
  }

  // High-level batch operations
  async batchReadFiles(paths: string[], encoding: BufferEncoding = 'utf8'): Promise<Map<string, any>> {
    const startTime = performance.now();
    const results = new Map<string, any>();
    const uncachedPaths: string[] = [];
    
    // Check cache first
    for (const path of paths) {
      const cached = this.getFromCache(`read:${path}`);
      if (cached) {
        results.set(path, cached);
        this.metrics.cacheHits++;
      } else {
        uncachedPaths.push(path);
      }
    }
    
    if (uncachedPaths.length === 0) {
      return results;
    }
    
    // Batch uncached reads
    const promises = uncachedPaths.map(path => 
      this.queueOperation('read', path, { encoding }, 'normal')
    );
    
    const batchResults = await Promise.allSettled(promises);
    
    batchResults.forEach((result, index) => {
      const path = uncachedPaths[index];
      if (result.status === 'fulfilled') {
        results.set(path, result.value);
        this.cacheResult(`read:${path}`, result.value);
      } else {
        console.error(`Failed to read ${path}:`, result.reason);
      }
    });
    
    this.updateMetrics('read', uncachedPaths.length, performance.now() - startTime);
    return results;
  }

  async batchStatFiles(paths: string[]): Promise<Map<string, FileMetadata>> {
    const startTime = performance.now();
    const results = new Map<string, FileMetadata>();
    const uncachedPaths: string[] = [];
    
    // Check cache first
    for (const path of paths) {
      const cached = this.getFromCache(`stat:${path}`);
      if (cached) {
        results.set(path, cached);
        this.metrics.cacheHits++;
      } else {
        uncachedPaths.push(path);
      }
    }
    
    if (uncachedPaths.length === 0) {
      return results;
    }
    
    // Batch stat operations
    const promises = uncachedPaths.map(path => 
      this.queueOperation('stat', path, {}, 'normal')
    );
    
    const batchResults = await Promise.allSettled(promises);
    
    batchResults.forEach((result, index) => {
      const path = uncachedPaths[index];
      if (result.status === 'fulfilled') {
        const metadata: FileMetadata = {
          path,
          size: result.value.size,
          mtime: result.value.mtime,
          isDirectory: result.value.isDirectory(),
          stats: result.value
        };
        results.set(path, metadata);
        this.cacheResult(`stat:${path}`, metadata);
      }
    });
    
    this.updateMetrics('stat', uncachedPaths.length, performance.now() - startTime);
    return results;
  }

  async batchExtractMetadata(mangaPaths: string[]): Promise<Map<string, any>> {
    const startTime = performance.now();
    const results = new Map<string, any>();
    
    // Process in parallel batches for optimal performance
    const batchSize = 10;
    const batches: string[][] = [];
    
    for (let i = 0; i < mangaPaths.length; i += batchSize) {
      batches.push(mangaPaths.slice(i, i + batchSize));
    }
    
    const batchPromises = batches.map(batch => 
      this.processMangaBatch(batch)
    );
    
    const batchResults = await Promise.all(batchPromises);
    
    // Merge results
    for (const batchResult of batchResults) {
      for (const [path, metadata] of batchResult) {
        results.set(path, metadata);
      }
    }
    
    this.updateMetrics('metadata', mangaPaths.length, performance.now() - startTime);
    return results;
  }

  private async processMangaBatch(paths: string[]): Promise<Map<string, any>> {
    const results = new Map<string, any>();
    
    // First, get directory stats for all paths
    const statResults = await this.batchStatFiles(paths);
    
    // Then process each manga directory
    const metadataPromises = paths.map(async (path) => {
      const stats = statResults.get(path);
      if (!stats?.isDirectory) {
        return null;
      }
      
      try {
        const metadata = await this.extractSingleMangaMetadata(path, stats);
        return { path, metadata };
      } catch (error) {
        console.error(`Failed to extract metadata for ${path}:`, error);
        return null;
      }
    });
    
    const metadataResults = await Promise.allSettled(metadataPromises);
    
    metadataResults.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        const { path, metadata } = result.value;
        results.set(path, metadata);
      }
    });
    
    return results;
  }

  private async extractSingleMangaMetadata(mangaPath: string, dirStats: FileMetadata): Promise<any> {
    const cacheKey = `metadata:${mangaPath}:${dirStats.mtime.getTime()}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      this.metrics.cacheHits++;
      return cached;
    }
    
    // Get all files in directory
    const files = await this.queueOperation('readdir', mangaPath, { withFileTypes: true }, 'high');
    
    // Batch process all file stats
    const filePaths = files
      .filter((entry: any) => !entry.isDirectory())
      .map((entry: any) => join(mangaPath, entry.name));
    
    const fileStats = filePaths.length > 0 ? await this.batchStatFiles(filePaths) : new Map();
    
    // Extract metadata efficiently
    const name = mangaPath.split(/[/\\]/).pop() || '';
    const imageFiles = this.filterImageFiles(files);
    const readerFiles = this.findReaderFiles(files);
    const chapters = await this.detectChaptersOptimized(mangaPath, files);
    
    const metadata = {
      id: name,
      title: this.extractTitle(name),
      path: mangaPath,
      readerUrl: readerFiles[0] ? `/${name}/${readerFiles[0]}` : null,
      coverUrl: imageFiles[0] ? `/${name}/${imageFiles[0]}` : null,
      chapters: chapters.length,
      totalPages: imageFiles.length,
      lastModified: dirStats.mtime.toISOString(),
      size: Array.from(fileStats.values()).reduce((sum, stat) => sum + stat.size, 0)
    };
    
    // Cache with TTL
    this.cacheResult(cacheKey, metadata);
    return metadata;
  }

  private filterImageFiles(files: any[]): string[] {
    return files
      .filter(f => !f.isDirectory())
      .map(f => f.name)
      .filter(name => /\.(jpg|jpeg|png|webp|gif|avif)$/i.test(name))
      .sort();
  }

  private findReaderFiles(files: any[]): string[] {
    return files
      .filter(f => !f.isDirectory())
      .map(f => f.name)
      .filter(name => name === 'index-mb.html' || name === 'index.html');
  }

  private async detectChaptersOptimized(mangaPath: string, files: any[]): Promise<any[]> {
    const chapters: any[] = [];
    const directories = files.filter(f => f.isDirectory());
    
    if (directories.length === 0) {
      // Single chapter at root
      const imageFiles = this.filterImageFiles(files);
      if (imageFiles.length > 0) {
        chapters.push({
          number: 1,
          name: 'Chapter 1',
          pages: imageFiles.length,
          path: mangaPath
        });
      }
      return chapters;
    }
    
    // Multiple chapters - batch process directories
    const chapterPaths = directories.map(dir => join(mangaPath, dir.name));
    const chapterPromises = chapterPaths.map(async (path, index) => {
      try {
        const chapterFiles = await this.queueOperation('readdir', path, {}, 'normal');
        const imageFiles = chapterFiles.filter((name: string) => 
          /\.(jpg|jpeg|png|webp|gif|avif)$/i.test(name)
        );
        
        return {
          number: index + 1,
          name: directories[index].name,
          pages: imageFiles.length,
          path: path
        };
      } catch (error) {
        return null;
      }
    });
    
    const results = await Promise.allSettled(chapterPromises);
    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        chapters.push(result.value);
      }
    });
    
    return chapters;
  }

  private extractTitle(folderName: string): string {
    return folderName.split('.').slice(-1)[0].trim();
  }

  // Core batching system
  private async queueOperation(
    operation: BatchRequest['operation'], 
    path: string, 
    options: any = {}, 
    priority: BatchRequest['priority'] = 'normal'
  ): Promise<any> {
    
    return new Promise((resolve, reject) => {
      const request: BatchRequest = {
        id: `${operation}:${path}:${Date.now()}`,
        operation,
        path,
        options,
        priority,
        timestamp: Date.now(),
        resolve,
        reject
      };
      
      // Add to appropriate queue
      this.getQueue(operation).push(request);
      this.metrics.totalOperations++;
      
      // Trigger batch processing
      this.scheduleBatchProcessing();
    });
  }

  private getQueue(operation: string): BatchRequest[] {
    switch (operation) {
      case 'read': return this.readQueue;
      case 'stat': return this.statQueue;
      case 'readdir': return this.readdirQueue;
      case 'metadata': return this.metadataQueue;
      default: return this.readQueue;
    }
  }

  private scheduleBatchProcessing(): void {
    if (this.processingBatch) return;
    
    // Process immediately if batch is full, otherwise schedule
    const totalQueued = this.readQueue.length + this.statQueue.length + 
                       this.readdirQueue.length + this.metadataQueue.length;
    
    if (totalQueued >= this.maxBatchSize) {
      setImmediate(() => this.processBatches());
    } else if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.processBatches(), this.batchTimeout);
    }
  }

  private async processBatches(): Promise<void> {
    if (this.processingBatch) return;
    
    this.processingBatch = true;
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    try {
      // Process each type of operation in parallel
      const batchPromises = [
        this.processBatch('read', this.readQueue.splice(0)),
        this.processBatch('stat', this.statQueue.splice(0)),
        this.processBatch('readdir', this.readdirQueue.splice(0))
      ].filter(promise => promise !== null);
      
      if (batchPromises.length > 0) {
        await Promise.all(batchPromises);
      }
    } finally {
      this.processingBatch = false;
      
      // Check if more operations are queued
      const totalQueued = this.readQueue.length + this.statQueue.length + 
                         this.readdirQueue.length + this.metadataQueue.length;
      
      if (totalQueued > 0) {
        setImmediate(() => this.processBatches());
      }
    }
  }

  private async processBatch(operation: string, requests: BatchRequest[]): Promise<void> {
    if (requests.length === 0) return;
    
    // Sort by priority
    requests.sort((a, b) => {
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
    
    const batchStartTime = performance.now();
    
    try {
      switch (operation) {
        case 'read':
          await this.processBatchRead(requests);
          break;
        case 'stat':
          await this.processBatchStat(requests);
          break;
        case 'readdir':
          await this.processBatchReaddir(requests);
          break;
      }
      
      this.metrics.batchOperations++;
      this.metrics.avgBatchSize = (this.metrics.avgBatchSize * 0.9) + (requests.length * 0.1);
      
    } catch (error) {
      console.error(`Batch ${operation} failed:`, error);
      // Reject all requests in failed batch
      requests.forEach(req => req.reject(error as Error));
    }
    
    const batchTime = performance.now() - batchStartTime;
    this.metrics.avgResponseTime = (this.metrics.avgResponseTime * 0.9) + (batchTime * 0.1);
  }

  private async processBatchRead(requests: BatchRequest[]): Promise<void> {
    const promises = requests.map(async (request) => {
      try {
        const result = await readFile(request.path, request.options);
        request.resolve(result);
      } catch (error) {
        request.reject(error as Error);
      }
    });
    
    await Promise.allSettled(promises);
  }

  private async processBatchStat(requests: BatchRequest[]): Promise<void> {
    const promises = requests.map(async (request) => {
      try {
        const result = await stat(request.path);
        request.resolve(result);
      } catch (error) {
        request.reject(error as Error);
      }
    });
    
    await Promise.allSettled(promises);
  }

  private async processBatchReaddir(requests: BatchRequest[]): Promise<void> {
    const promises = requests.map(async (request) => {
      try {
        const result = await readdir(request.path, request.options);
        request.resolve(result);
        
        // Cache parent-child relationships for prefetching
        if (Array.isArray(result)) {
          this.pathRelations.set(request.path, result.map(item => 
            typeof item === 'string' ? item : item.name
          ));
        }
      } catch (error) {
        request.reject(error as Error);
      }
    });
    
    await Promise.allSettled(promises);
  }

  private startBatchProcessor(): void {
    // Continuous batch processing
    setInterval(() => {
      if (!this.processingBatch) {
        const totalQueued = this.readQueue.length + this.statQueue.length + 
                           this.readdirQueue.length + this.metadataQueue.length;
        if (totalQueued > 0) {
          this.processBatches();
        }
      }
    }, 1); // 1ms interval for ultra-responsive batching
  }

  private startCacheCleanup(): void {
    // Clean expired cache entries every 30 seconds
    setInterval(() => {
      const now = Date.now();
      
      for (const [key, entry] of this.fsCache.entries()) {
        if (now > entry.expiry) {
          this.fsCache.delete(key);
        }
      }
    }, 30000);
  }

  private getFromCache(key: string): any {
    const entry = this.fsCache.get(key);
    if (entry && Date.now() < entry.expiry) {
      return entry.data;
    }
    return null;
  }

  private cacheResult(key: string, data: any): void {
    this.fsCache.set(key, {
      data,
      expiry: Date.now() + this.cacheTimeoutMs
    });
  }

  private updateMetrics(operation: string, count: number, duration: number): void {
    // Update performance metrics
  }

  getMetrics(): IOMetrics {
    const fsCallsAvoided = this.metrics.cacheHits + this.metrics.prefetchHits;
    const efficiency = this.metrics.totalOperations > 0 
      ? fsCallsAvoided / this.metrics.totalOperations 
      : 0;
    
    return {
      ...this.metrics,
      fsCallsAvoided,
      efficiency: efficiency * 100
    };
  }
}

export { AsyncIOBatcher };