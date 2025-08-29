#!/usr/bin/env bun

/**
 * Statistics Display Script for Manga Server
 * Shows detailed performance metrics and system information
 */

interface ServerStats {
  cache: {
    size: number;
    currentSize: number;
    maxSize: number;
    hits: number;
    misses: number;
    hitRate: string;
    memoryPressure: string;
  };
  server: {
    uptime: number;
    memory: NodeJS.MemoryUsage;
    platform: string;
    version: string;
  };
}

class StatsDisplay {
  private baseUrl: string;
  
  constructor(baseUrl = 'http://localhost:80') {
    this.baseUrl = baseUrl;
  }
  
  async displayStats() {
    console.log('📊 Manga Server Statistics\n');
    
    try {
      const response = await fetch(`${this.baseUrl}/api/stats`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const stats: ServerStats = await response.json();
      
      this.displayServerInfo(stats.server);
      this.displayCacheStats(stats.cache);
      this.displayMemoryStats(stats.server.memory);
      
      // Additional system info
      await this.displaySystemInfo();
      
    } catch (error) {
      console.error('❌ Failed to fetch server statistics:', error.message);
      
      // Display local system stats if server is unreachable
      console.log('\n📱 Local System Information:');
      this.displayLocalSystemInfo();
      process.exit(1);
    }
  }
  
  private displayServerInfo(server: ServerStats['server']) {
    console.log('🖥️  Server Information:');
    console.log(`   Status: ✅ Running`);
    console.log(`   Uptime: ${this.formatUptime(server.uptime)}`);
    console.log(`   Platform: ${server.platform}`);
    console.log(`   Bun Version: ${server.version}`);
    console.log(`   PID: ${process.pid}`);
    console.log('');
  }
  
  private displayCacheStats(cache: ServerStats['cache']) {
    console.log('💾 Cache Performance:');
    console.log(`   Entries: ${cache.size.toLocaleString()}`);
    console.log(`   Size: ${this.formatBytes(cache.currentSize)} / ${this.formatBytes(cache.maxSize)}`);
    console.log(`   Usage: ${((cache.currentSize / cache.maxSize) * 100).toFixed(1)}%`);
    console.log(`   Hit Rate: ${cache.hitRate}`);
    console.log(`   Hits: ${cache.hits.toLocaleString()}`);
    console.log(`   Misses: ${cache.misses.toLocaleString()}`);
    console.log(`   Memory Pressure: ${cache.memoryPressure}`);
    console.log('');
  }
  
  private displayMemoryStats(memory: NodeJS.MemoryUsage) {
    console.log('🧠 Memory Usage:');
    console.log(`   Heap Used: ${this.formatBytes(memory.heapUsed)}`);
    console.log(`   Heap Total: ${this.formatBytes(memory.heapTotal)}`);
    console.log(`   Heap Usage: ${((memory.heapUsed / memory.heapTotal) * 100).toFixed(1)}%`);
    console.log(`   External: ${this.formatBytes(memory.external)}`);
    console.log(`   RSS: ${this.formatBytes(memory.rss)}`);
    
    if (memory.arrayBuffers !== undefined) {
      console.log(`   Array Buffers: ${this.formatBytes(memory.arrayBuffers)}`);
    }
    console.log('');
  }
  
  private async displaySystemInfo() {
    console.log('⚙️  System Configuration:');
    console.log(`   Node.js: ${process.version}`);
    console.log(`   Architecture: ${process.arch}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Working Directory: ${process.cwd()}`);
    
    // Environment variables
    const envVars = [
      'PORT', 'HOSTNAME', 'MANGA_ROOT', 'CACHE_SIZE_MB', 
      'MAX_CONNECTIONS', 'STREAMING_THRESHOLD', 'COMPRESSION_THRESHOLD'
    ];
    
    console.log('\n🔧 Configuration:');
    envVars.forEach(varName => {
      const value = process.env[varName];
      if (value !== undefined) {
        console.log(`   ${varName}: ${value}`);
      }
    });
    
    console.log('');
  }
  
  private displayLocalSystemInfo() {
    const memUsage = process.memoryUsage();
    
    console.log('   Memory:');
    console.log(`     Heap Used: ${this.formatBytes(memUsage.heapUsed)}`);
    console.log(`     Heap Total: ${this.formatBytes(memUsage.heapTotal)}`);
    console.log(`     RSS: ${this.formatBytes(memUsage.rss)}`);
    console.log(`   Platform: ${process.platform}`);
    console.log(`   Architecture: ${process.arch}`);
    console.log(`   Node Version: ${process.version}`);
  }
  
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
    
    return parts.join(' ');
  }
  
  async watchStats(interval = 5000) {
    console.log(`📈 Watching server statistics (updating every ${interval/1000}s)...\n`);
    console.log('Press Ctrl+C to stop\n');
    
    const watch = async () => {
      // Clear screen
      console.clear();
      console.log(`🔄 Live Statistics - ${new Date().toLocaleTimeString()}\n`);
      
      try {
        await this.displayStats();
      } catch (error) {
        console.error('❌ Error updating stats:', error.message);
      }
      
      console.log(`\n⏱️  Next update in ${interval/1000}s...`);
    };
    
    // Initial display
    await watch();
    
    // Set up interval
    const intervalId = setInterval(watch, interval);
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      clearInterval(intervalId);
      console.log('\n👋 Statistics monitoring stopped');
      process.exit(0);
    });
  }
}

// CLI execution
async function main() {
  const args = process.argv.slice(2);
  const baseUrl = args.find(arg => arg.startsWith('http://') || arg.startsWith('https://')) || 'http://localhost:80';
  const watchMode = args.includes('--watch') || args.includes('-w');
  const interval = parseInt(args.find(arg => arg.startsWith('--interval='))?.split('=')[1] || '5000');
  
  const stats = new StatsDisplay(baseUrl);
  
  try {
    if (watchMode) {
      await stats.watchStats(interval);
    } else {
      await stats.displayStats();
    }
  } catch (error) {
    console.error('❌ Statistics display failed:', error);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}

export { StatsDisplay };