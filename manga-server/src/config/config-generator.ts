/**
 * Configuration Generator Module
 * Maps hardware specifications to optimal server configuration
 */

import type { SystemSpecs } from './hardware-detector';

export interface ServerConfig {
  // Core settings
  port: number;
  hostname: string;
  environment: 'development' | 'production' | 'auto';
  
  // Performance settings
  cacheSize: number; // MB
  maxConnections: number;
  workerThreads: number;
  streamingThreshold: number; // bytes
  compressionThreshold: number; // bytes
  compressionLevel: 'none' | 'fast' | 'balanced' | 'maximum';
  
  // Memory management
  memoryLimit: number; // MB
  gcInterval: number; // ms
  memoryPoolSize: number; // MB
  
  // Network settings
  keepAliveTimeout: number; // ms
  requestTimeout: number; // ms
  uploadLimit: number; // MB
  
  // Feature flags
  enableCompression: boolean;
  enableStreaming: boolean;
  enableCaching: boolean;
  enableWebSocket: boolean;
  enableMetrics: boolean;
  
  // Paths
  mangaPath: string;
  dataPath: string;
  logsPath: string;
  
  // Auto-tuning
  autoTuning: boolean;
  performanceMode: 'conservative' | 'balanced' | 'aggressive' | 'extreme';
}

export class ConfigGenerator {
  private readonly profiles = {
    low: {
      cacheSize: 256,
      maxConnections: 100,
      workerThreads: 2,
      streamingThreshold: 65536,
      compressionThreshold: 1048576,
      compressionLevel: 'none' as const,
      memoryLimit: 512,
      gcInterval: 60000,
      memoryPoolSize: 64,
      keepAliveTimeout: 5000,
      requestTimeout: 30000,
      uploadLimit: 10,
      enableCompression: false,
      enableStreaming: true,
      enableCaching: true,
      enableWebSocket: false,
      enableMetrics: false,
      performanceMode: 'conservative' as const
    },
    medium: {
      cacheSize: 1024,
      maxConnections: 5000,
      workerThreads: 4,
      streamingThreshold: 32768,
      compressionThreshold: 262144,
      compressionLevel: 'fast' as const,
      memoryLimit: 2048,
      gcInterval: 30000,
      memoryPoolSize: 256,
      keepAliveTimeout: 10000,
      requestTimeout: 60000,
      uploadLimit: 50,
      enableCompression: true,
      enableStreaming: true,
      enableCaching: true,
      enableWebSocket: true,
      enableMetrics: true,
      performanceMode: 'balanced' as const
    },
    high: {
      cacheSize: 4096,
      maxConnections: 20000,
      workerThreads: 8,
      streamingThreshold: 16384,
      compressionThreshold: 131072,
      compressionLevel: 'balanced' as const,
      memoryLimit: 8192,
      gcInterval: 15000,
      memoryPoolSize: 1024,
      keepAliveTimeout: 30000,
      requestTimeout: 120000,
      uploadLimit: 100,
      enableCompression: true,
      enableStreaming: true,
      enableCaching: true,
      enableWebSocket: true,
      enableMetrics: true,
      performanceMode: 'aggressive' as const
    },
    extreme: {
      cacheSize: 8192,
      maxConnections: 100000,
      workerThreads: 16,
      streamingThreshold: 8192,
      compressionThreshold: 65536,
      compressionLevel: 'maximum' as const,
      memoryLimit: 16384,
      gcInterval: 5000,
      memoryPoolSize: 2048,
      keepAliveTimeout: 60000,
      requestTimeout: 300000,
      uploadLimit: 500,
      enableCompression: true,
      enableStreaming: true,
      enableCaching: true,
      enableWebSocket: true,
      enableMetrics: true,
      performanceMode: 'extreme' as const
    }
  };
  
  generateConfig(specs: SystemSpecs, userPreferences?: Partial<ServerConfig>): ServerConfig {
    console.log('🔧 Generating optimal configuration...');
    
    // Get base profile based on performance tier
    const baseProfile = this.profiles[specs.performance.tier];
    
    // Calculate dynamic adjustments
    const adjustments = this.calculateAdjustments(specs);
    
    // Merge base profile with adjustments
    const generatedConfig: ServerConfig = {
      // Core settings
      port: userPreferences?.port || parseInt(process.env.PORT || '80'),
      hostname: userPreferences?.hostname || process.env.HOSTNAME || '0.0.0.0',
      environment: this.determineEnvironment(),
      
      // Apply base profile with adjustments
      cacheSize: Math.min(
        baseProfile.cacheSize * adjustments.memoryMultiplier,
        specs.memory.available * 0.5 // Never use more than 50% of available memory
      ),
      maxConnections: baseProfile.maxConnections * adjustments.cpuMultiplier,
      workerThreads: Math.min(baseProfile.workerThreads, specs.cpu.cores),
      streamingThreshold: baseProfile.streamingThreshold,
      compressionThreshold: baseProfile.compressionThreshold,
      compressionLevel: baseProfile.compressionLevel,
      
      // Memory management with safety margins
      memoryLimit: Math.min(
        baseProfile.memoryLimit,
        specs.memory.total * 0.75 // Never use more than 75% of total memory
      ),
      gcInterval: baseProfile.gcInterval,
      memoryPoolSize: Math.min(
        baseProfile.memoryPoolSize,
        specs.memory.available * 0.1
      ),
      
      // Network settings
      keepAliveTimeout: baseProfile.keepAliveTimeout,
      requestTimeout: baseProfile.requestTimeout,
      uploadLimit: baseProfile.uploadLimit,
      
      // Feature flags based on capabilities
      enableCompression: baseProfile.enableCompression && specs.cpu.cores >= 2,
      enableStreaming: baseProfile.enableStreaming,
      enableCaching: baseProfile.enableCaching,
      enableWebSocket: baseProfile.enableWebSocket && specs.memory.total >= 2048,
      enableMetrics: baseProfile.enableMetrics && specs.memory.total >= 4096,
      
      // Paths
      mangaPath: userPreferences?.mangaPath || process.env.MANGA_ROOT || './manga-collection',
      dataPath: userPreferences?.dataPath || './manga-server/data',
      logsPath: userPreferences?.logsPath || './manga-server/logs',
      
      // Auto-tuning
      autoTuning: userPreferences?.autoTuning ?? true,
      performanceMode: baseProfile.performanceMode
    };
    
    // Apply user preferences overrides
    if (userPreferences) {
      Object.assign(generatedConfig, userPreferences);
    }
    
    // Validate and adjust for safety
    this.validateAndAdjust(generatedConfig, specs);
    
    console.log(`   Configuration generated for ${specs.performance.tier.toUpperCase()} tier system`);
    console.log(`   Cache: ${generatedConfig.cacheSize}MB, Connections: ${generatedConfig.maxConnections}`);
    
    return generatedConfig;
  }
  
  private calculateAdjustments(specs: SystemSpecs): {
    memoryMultiplier: number;
    cpuMultiplier: number;
    storageMultiplier: number;
  } {
    // Memory adjustment based on available memory
    const memGB = specs.memory.available / 1024;
    let memoryMultiplier = 1;
    if (memGB > 16) memoryMultiplier = 1.5;
    else if (memGB > 8) memoryMultiplier = 1.2;
    else if (memGB < 2) memoryMultiplier = 0.5;
    
    // CPU adjustment based on core count
    let cpuMultiplier = 1;
    if (specs.cpu.cores > 16) cpuMultiplier = 2;
    else if (specs.cpu.cores > 8) cpuMultiplier = 1.5;
    else if (specs.cpu.cores < 4) cpuMultiplier = 0.5;
    
    // Storage adjustment based on type
    let storageMultiplier = 1;
    if (specs.storage.type === 'SSD') storageMultiplier = 1.5;
    else if (specs.storage.type === 'HDD') storageMultiplier = 0.75;
    
    return { memoryMultiplier, cpuMultiplier, storageMultiplier };
  }
  
  private determineEnvironment(): 'development' | 'production' | 'auto' {
    if (process.env.NODE_ENV === 'production') return 'production';
    if (process.env.NODE_ENV === 'development') return 'development';
    return 'auto';
  }
  
  private validateAndAdjust(config: ServerConfig, specs: SystemSpecs): void {
    // Ensure cache doesn't exceed available memory
    const maxCache = specs.memory.available * 0.5;
    if (config.cacheSize > maxCache) {
      console.warn(`   ⚠️ Adjusting cache size from ${config.cacheSize}MB to ${maxCache}MB`);
      config.cacheSize = Math.floor(maxCache);
    }
    
    // Ensure worker threads don't exceed CPU cores
    if (config.workerThreads > specs.cpu.cores) {
      console.warn(`   ⚠️ Adjusting worker threads from ${config.workerThreads} to ${specs.cpu.cores}`);
      config.workerThreads = specs.cpu.cores;
    }
    
    // Disable compression on very low-end systems
    if (specs.cpu.cores < 2 && config.enableCompression) {
      console.warn('   ⚠️ Disabling compression for low-end CPU');
      config.enableCompression = false;
    }
    
    // Adjust connection limits based on memory
    const maxConnectionsPerGB = 5000;
    const memGB = specs.memory.total / 1024;
    const maxSafeConnections = Math.floor(memGB * maxConnectionsPerGB);
    
    if (config.maxConnections > maxSafeConnections) {
      console.warn(`   ⚠️ Adjusting max connections from ${config.maxConnections} to ${maxSafeConnections}`);
      config.maxConnections = maxSafeConnections;
    }
  }
  
  exportConfig(config: ServerConfig): string {
    return JSON.stringify(config, null, 2);
  }
  
  exportEnvVars(config: ServerConfig): string {
    const envVars = [
      `PORT=${config.port}`,
      `HOSTNAME=${config.hostname}`,
      `NODE_ENV=${config.environment === 'auto' ? 'production' : config.environment}`,
      `CACHE_SIZE_MB=${config.cacheSize}`,
      `MAX_CONNECTIONS=${config.maxConnections}`,
      `WORKER_THREADS=${config.workerThreads}`,
      `STREAMING_THRESHOLD=${config.streamingThreshold}`,
      `COMPRESSION_THRESHOLD=${config.compressionThreshold}`,
      `MEMORY_LIMIT_MB=${config.memoryLimit}`,
      `GC_INTERVAL=${config.gcInterval}`,
      `MEMORY_POOL_MB=${config.memoryPoolSize}`,
      `KEEP_ALIVE_TIMEOUT=${config.keepAliveTimeout}`,
      `REQUEST_TIMEOUT=${config.requestTimeout}`,
      `UPLOAD_LIMIT_MB=${config.uploadLimit}`,
      `ENABLE_COMPRESSION=${config.enableCompression}`,
      `ENABLE_STREAMING=${config.enableStreaming}`,
      `ENABLE_CACHING=${config.enableCaching}`,
      `ENABLE_WEBSOCKET=${config.enableWebSocket}`,
      `ENABLE_METRICS=${config.enableMetrics}`,
      `MANGA_ROOT=${config.mangaPath}`,
      `DATA_PATH=${config.dataPath}`,
      `LOGS_PATH=${config.logsPath}`,
      `AUTO_TUNING=${config.autoTuning}`,
      `PERFORMANCE_MODE=${config.performanceMode}`
    ];
    
    return envVars.join('\n');
  }
  
  generateRecommendations(specs: SystemSpecs, config: ServerConfig): string[] {
    const recommendations: string[] = [];
    
    // Memory recommendations
    const memGB = specs.memory.total / 1024;
    if (memGB < 4) {
      recommendations.push('💡 Consider upgrading RAM to 8GB+ for better performance');
    }
    
    // Storage recommendations
    if (specs.storage.type === 'HDD') {
      recommendations.push('💡 An SSD would significantly improve loading times');
    }
    
    if (specs.storage.available < 10) {
      recommendations.push('⚠️ Low disk space - consider freeing up storage');
    }
    
    // CPU recommendations
    if (specs.cpu.cores < 4) {
      recommendations.push('💡 More CPU cores would allow higher concurrent connections');
    }
    
    // Network recommendations
    if (!specs.network.hasGigabit) {
      recommendations.push('💡 Gigabit ethernet recommended for multiple users');
    }
    
    // Configuration suggestions
    if (config.performanceMode === 'conservative' && specs.performance.score > 60) {
      recommendations.push('✨ Your system can handle more aggressive performance settings');
    }
    
    if (config.cacheSize < 1024 && memGB >= 8) {
      recommendations.push('✨ You have enough RAM to increase cache size for better performance');
    }
    
    return recommendations;
  }
}

export default new ConfigGenerator();