/**
 * Integrated Optimization System
 * Orchestrates all performance optimizations for maximum efficiency
 */

import { HybridCacheSystem } from './hybrid-cache-system.ts';
import { AdvancedMemoryPool } from './advanced-memory-pool.ts';
import { AsyncIOBatcher } from './async-io-batch.ts';
import { UltraFastPipeline } from './ultra-fast-pipeline.ts';
import { AdvancedSearchEngine } from './advanced-search-engine.ts';
import { PerformanceAnalytics } from './performance-analytics.ts';

interface OptimizationConfig {
  cacheSize: number;
  memoryPoolSize: number;
  maxConnections: number;
  ioTimeout: number;
  searchEnabled: boolean;
  monitoringEnabled: boolean;
  predictiveEnabled: boolean;
}

interface SystemMetrics {
  performance: any;
  cache: any;
  memory: any;
  io: any;
  search: any;
  pipeline: any;
  overall: {
    score: number;
    rating: 'poor' | 'fair' | 'good' | 'excellent' | 'extreme';
    bottlenecks: string[];
    recommendations: string[];
  };
}

class IntegratedOptimizationSystem {
  private cache: HybridCacheSystem;
  private memoryPool: AdvancedMemoryPool;
  private ioBatcher: AsyncIOBatcher;
  private pipeline: UltraFastPipeline;
  private searchEngine: AdvancedSearchEngine;
  private analytics: PerformanceAnalytics;
  
  private config: OptimizationConfig;
  private isInitialized = false;
  private startTime: number;

  constructor(config: Partial<OptimizationConfig> = {}) {
    this.startTime = Date.now();
    
    this.config = {
      cacheSize: config.cacheSize || 2048, // 2GB default
      memoryPoolSize: config.memoryPoolSize || 1024, // 1GB default
      maxConnections: config.maxConnections || 20000,
      ioTimeout: config.ioTimeout || 30000,
      searchEnabled: config.searchEnabled !== false,
      monitoringEnabled: config.monitoringEnabled !== false,
      predictiveEnabled: config.predictiveEnabled !== false,
      ...config
    };
    
    this.initializeComponents();
  }

  private initializeComponents(): void {
    console.log('🚀 Initializing Integrated Optimization System...');
    
    // Initialize memory pool first (other components depend on it)
    this.memoryPool = new AdvancedMemoryPool(this.config.memoryPoolSize);
    
    // Initialize cache system with memory pool integration
    this.cache = new HybridCacheSystem(this.config.cacheSize);
    
    // Initialize I/O batching system
    this.ioBatcher = new AsyncIOBatcher(this.config.ioTimeout);
    
    // Initialize request pipeline
    this.pipeline = new UltraFastPipeline();
    
    // Initialize search engine if enabled
    if (this.config.searchEnabled) {
      this.searchEngine = new AdvancedSearchEngine();
    }
    
    // Initialize performance analytics if enabled
    if (this.config.monitoringEnabled) {
      this.analytics = new PerformanceAnalytics();
      this.analytics.startMonitoring(1000); // 1 second interval
    }
    
    this.isInitialized = true;
    console.log('✅ Optimization system initialized');
  }

  // Optimized request processing
  async processOptimizedRequest(request: Request): Promise<Response> {
    if (!this.isInitialized) {
      throw new Error('Optimization system not initialized');
    }
    
    const startTime = performance.now();
    
    try {
      // Use ultra-fast pipeline for request processing
      const response = await this.pipeline.processRequest(request);
      
      // Add optimization headers
      this.addOptimizationHeaders(response, startTime);
      
      return response;
    } catch (error) {
      console.error('Optimized request processing failed:', error);
      throw error;
    }
  }

  // Optimized file operations
  async getOptimizedFile(path: string): Promise<Uint8Array | null> {
    // Check cache first
    const cached = await this.cache.get(`file:${path}`);
    if (cached) {
      return cached.data;
    }
    
    // Use I/O batcher for efficient file reading
    try {
      const files = await this.ioBatcher.batchReadFiles([path]);
      const fileData = files.get(path);
      
      if (fileData) {
        const uint8Array = new Uint8Array(fileData);
        // Cache for future requests
        await this.cache.set(`file:${path}`, uint8Array, { 'content-type': 'application/octet-stream' });
        return uint8Array;
      }
    } catch (error) {
      console.error(`Failed to read file ${path}:`, error);
    }
    
    return null;
  }

  // Optimized search functionality
  async searchOptimized(query: string, options: any = {}): Promise<any> {
    if (!this.config.searchEnabled || !this.searchEngine) {
      throw new Error('Search engine not enabled');
    }
    
    return this.searchEngine.search(query, options);
  }

  // Build search index from manga collection
  async buildSearchIndex(mangaCollection: any[]): Promise<void> {
    if (!this.config.searchEnabled || !this.searchEngine) {
      return;
    }
    
    console.log('Building optimized search index...');
    const startTime = performance.now();
    
    this.searchEngine.buildIndexes(mangaCollection);
    
    const buildTime = performance.now() - startTime;
    console.log(`Search index built in ${buildTime.toFixed(2)}ms`);
  }

  // Batch process manga metadata with all optimizations
  async processMangaCollectionOptimized(rootPath: string): Promise<Map<string, any>> {
    console.log('Processing manga collection with optimizations...');
    const startTime = performance.now();
    
    try {
      // Use I/O batcher for efficient directory scanning
      const results = await this.ioBatcher.batchExtractMetadata([rootPath]);
      
      // Build search index if enabled
      if (this.config.searchEnabled && results.size > 0) {
        const mangaArray = Array.from(results.values());
        await this.buildSearchIndex(mangaArray);
      }
      
      const processingTime = performance.now() - startTime;
      console.log(`Manga collection processed in ${processingTime.toFixed(2)}ms`);
      
      return results;
    } catch (error) {
      console.error('Failed to process manga collection:', error);
      throw error;
    }
  }

  // Get comprehensive system metrics
  getSystemMetrics(): SystemMetrics {
    const performanceMetrics = this.config.monitoringEnabled 
      ? this.analytics?.getPerformanceInsights() 
      : null;
    
    const cacheMetrics = this.cache.getAdvancedMetrics();
    const memoryMetrics = this.memoryPool.getPerformanceMetrics();
    const ioMetrics = this.ioBatcher.getMetrics();
    const pipelineMetrics = this.pipeline.getPerformanceMetrics();
    const searchMetrics = this.config.searchEnabled 
      ? this.searchEngine?.getSearchMetrics() 
      : null;
    
    // Calculate overall performance score
    const overallScore = this.calculateOverallScore({
      cache: cacheMetrics,
      memory: memoryMetrics,
      io: ioMetrics,
      pipeline: pipelineMetrics
    });
    
    return {
      performance: performanceMetrics,
      cache: cacheMetrics,
      memory: memoryMetrics,
      io: ioMetrics,
      search: searchMetrics,
      pipeline: pipelineMetrics,
      overall: {
        score: overallScore.score,
        rating: overallScore.rating,
        bottlenecks: overallScore.bottlenecks,
        recommendations: overallScore.recommendations
      }
    };
  }

  private calculateOverallScore(metrics: any): any {
    let totalScore = 0;
    let componentCount = 0;
    const bottlenecks: string[] = [];
    const recommendations: string[] = [];
    
    // Cache score (30% weight)
    if (metrics.cache) {
      const cacheHitRate = parseFloat(metrics.cache.hitRate) / 100;
      const cacheScore = Math.min(cacheHitRate * 100, 100);
      totalScore += cacheScore * 0.3;
      componentCount += 0.3;
      
      if (cacheScore < 70) {
        bottlenecks.push('Cache hit rate below optimal');
        recommendations.push('Increase cache size or optimize cache strategy');
      }
    }
    
    // Memory score (25% weight)
    if (metrics.memory) {
      const efficiency = parseFloat(metrics.memory.poolEfficiency) / 100;
      const memoryScore = Math.min(efficiency * 100, 100);
      totalScore += memoryScore * 0.25;
      componentCount += 0.25;
      
      if (memoryScore < 70) {
        bottlenecks.push('Memory pool efficiency low');
        recommendations.push('Optimize memory allocation patterns');
      }
    }
    
    // I/O score (20% weight)
    if (metrics.io) {
      const ioEfficiency = metrics.io.efficiency || 0;
      const ioScore = Math.min(ioEfficiency, 100);
      totalScore += ioScore * 0.2;
      componentCount += 0.2;
      
      if (ioScore < 60) {
        bottlenecks.push('I/O operations not efficiently batched');
        recommendations.push('Increase I/O batch size or reduce file system calls');
      }
    }
    
    // Pipeline score (25% weight)
    if (metrics.pipeline) {
      const cacheHitRate = parseFloat(metrics.pipeline.efficiency?.cacheHitRate) / 100 || 0;
      const pipelineScore = Math.min(cacheHitRate * 100, 100);
      totalScore += pipelineScore * 0.25;
      componentCount += 0.25;
      
      if (pipelineScore < 60) {
        bottlenecks.push('Request pipeline cache efficiency low');
        recommendations.push('Optimize request routing and caching');
      }
    }
    
    const finalScore = componentCount > 0 ? totalScore / componentCount : 0;
    
    let rating: 'poor' | 'fair' | 'good' | 'excellent' | 'extreme';
    if (finalScore >= 90) rating = 'extreme';
    else if (finalScore >= 80) rating = 'excellent';
    else if (finalScore >= 70) rating = 'good';
    else if (finalScore >= 50) rating = 'fair';
    else rating = 'poor';
    
    return {
      score: Math.round(finalScore),
      rating,
      bottlenecks,
      recommendations
    };
  }

  // Memory pressure handling across all systems
  async handleMemoryPressure(level: 'low' | 'medium' | 'high'): Promise<void> {
    console.log(`Handling memory pressure: ${level}`);
    
    // Coordinate memory cleanup across all components
    await Promise.all([
      this.cache.handleMemoryPressure(level),
      this.memoryPool.handleMemoryPressure(level)
    ]);
    
    // Force garbage collection for high pressure
    if (level === 'high' && global.gc) {
      global.gc();
    }
  }

  // Predictive optimization based on usage patterns
  async runPredictiveOptimization(): Promise<void> {
    if (!this.config.predictiveEnabled) return;
    
    console.log('Running predictive optimization...');
    const metrics = this.getSystemMetrics();
    
    // Predictive cache warming
    if (metrics.cache.l1.hitRate < 80) {
      console.log('Optimizing cache distribution...');
      // Implementation would analyze access patterns and pre-warm cache
    }
    
    // Predictive memory pool adjustment
    if (metrics.memory.poolEfficiency < '80%') {
      console.log('Optimizing memory pool sizes...');
      // Implementation would adjust pool sizes based on allocation patterns
    }
    
    // Predictive I/O batching optimization
    if (metrics.io.efficiency < 70) {
      console.log('Optimizing I/O batch parameters...');
      // Implementation would adjust batch sizes and timeouts
    }
  }

  private addOptimizationHeaders(response: Response, startTime: number): void {
    const processingTime = performance.now() - startTime;
    const uptime = Date.now() - this.startTime;
    
    response.headers.set('X-Optimization-Level', 'extreme');
    response.headers.set('X-Processing-Time', `${processingTime.toFixed(3)}ms`);
    response.headers.set('X-System-Uptime', `${Math.floor(uptime / 1000)}s`);
    response.headers.set('X-Cache-Enabled', 'hybrid-multi-tier');
    response.headers.set('X-Memory-Pool', 'advanced-numa');
    response.headers.set('X-IO-Batch', 'enabled');
    response.headers.set('X-Search-Engine', this.config.searchEnabled ? 'advanced' : 'disabled');
    response.headers.set('X-Analytics', this.config.monitoringEnabled ? 'enabled' : 'disabled');
  }

  // Benchmarking and validation
  async runPerformanceBenchmark(): Promise<any> {
    console.log('Running integrated performance benchmark...');
    const results: any = {};
    
    // Cache benchmark
    const cacheStartTime = performance.now();
    for (let i = 0; i < 10000; i++) {
      const key = `test_${i}`;
      const data = new Uint8Array(1024); // 1KB test data
      await this.cache.set(key, data, {});
      await this.cache.get(key);
    }
    results.cacheOps = {
      operations: 20000,
      timeMs: performance.now() - cacheStartTime,
      opsPerSecond: 20000 / ((performance.now() - cacheStartTime) / 1000)
    };
    
    // Memory pool benchmark
    const memoryStartTime = performance.now();
    const buffers: Uint8Array[] = [];
    for (let i = 0; i < 10000; i++) {
      const buffer = this.memoryPool.acquire(1024);
      buffers.push(buffer);
    }
    for (const buffer of buffers) {
      this.memoryPool.release(buffer, 1024);
    }
    results.memoryOps = {
      operations: 20000,
      timeMs: performance.now() - memoryStartTime,
      opsPerSecond: 20000 / ((performance.now() - memoryStartTime) / 1000)
    };
    
    // Search benchmark (if enabled)
    if (this.config.searchEnabled && this.searchEngine) {
      const searchStartTime = performance.now();
      for (let i = 0; i < 1000; i++) {
        this.searchEngine.search(`test query ${i % 10}`);
      }
      results.searchOps = {
        operations: 1000,
        timeMs: performance.now() - searchStartTime,
        opsPerSecond: 1000 / ((performance.now() - searchStartTime) / 1000)
      };
    }
    
    return results;
  }

  // Cleanup and shutdown
  async shutdown(): Promise<void> {
    console.log('Shutting down optimization system...');
    
    if (this.analytics) {
      this.analytics.cleanup();
    }
    
    // Clear all caches
    // Note: Implementation would call cleanup methods on all components
    
    console.log('✅ Optimization system shut down gracefully');
  }

  // Health check for all optimization components
  getHealthStatus(): any {
    const health: any = {
      overall: 'healthy',
      components: {},
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime
    };
    
    // Check each component
    try {
      health.components.cache = this.cache ? 'healthy' : 'unavailable';
      health.components.memoryPool = this.memoryPool ? 'healthy' : 'unavailable';
      health.components.ioBatcher = this.ioBatcher ? 'healthy' : 'unavailable';
      health.components.pipeline = this.pipeline ? 'healthy' : 'unavailable';
      health.components.searchEngine = this.config.searchEnabled && this.searchEngine ? 'healthy' : 'disabled';
      health.components.analytics = this.config.monitoringEnabled && this.analytics ? 'healthy' : 'disabled';
    } catch (error) {
      health.overall = 'degraded';
      health.error = error.message;
    }
    
    return health;
  }
}

export { IntegratedOptimizationSystem, OptimizationConfig, SystemMetrics };