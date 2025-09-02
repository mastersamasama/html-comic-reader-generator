/**
 * Hardware Detection Module
 * Automatically detects system specifications for optimal configuration
 */

import { cpus, totalmem, freemem, platform, arch, networkInterfaces } from 'node:os';
import { statfs } from 'node:fs/promises';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export interface SystemSpecs {
  cpu: {
    cores: number;
    model: string;
    speed: number; // MHz
    architecture: string;
  };
  memory: {
    total: number; // MB
    available: number; // MB
    usagePercent: number;
  };
  storage: {
    type: 'SSD' | 'HDD' | 'UNKNOWN';
    total: number; // GB
    available: number; // GB
    path: string;
  };
  network: {
    interfaces: string[];
    hasGigabit: boolean;
    bandwidth?: number; // Mbps
  };
  platform: {
    os: string;
    arch: string;
    version: string;
  };
  performance: {
    tier: 'low' | 'medium' | 'high' | 'extreme';
    score: number;
    confidence: number;
  };
}

export class HardwareDetector {
  private specs: Partial<SystemSpecs> = {};
  
  async detectAll(): Promise<SystemSpecs> {
    console.log('🔍 Starting hardware detection...');
    
    await Promise.all([
      this.detectCPU(),
      this.detectMemory(),
      this.detectStorage(),
      this.detectNetwork(),
      this.detectPlatform()
    ]);
    
    this.calculatePerformanceTier();
    
    console.log('✅ Hardware detection complete');
    return this.specs as SystemSpecs;
  }
  
  private async detectCPU(): Promise<void> {
    const cpuInfo = cpus();
    
    this.specs.cpu = {
      cores: cpuInfo.length,
      model: cpuInfo[0]?.model || 'Unknown',
      speed: Math.max(...cpuInfo.map(cpu => cpu.speed)),
      architecture: arch()
    };
    
    console.log(`   CPU: ${this.specs.cpu.cores} cores @ ${this.specs.cpu.speed}MHz`);
  }
  
  private async detectMemory(): Promise<void> {
    const total = Math.floor(totalmem() / (1024 * 1024));
    const available = Math.floor(freemem() / (1024 * 1024));
    
    this.specs.memory = {
      total,
      available,
      usagePercent: ((total - available) / total) * 100
    };
    
    console.log(`   Memory: ${total}MB total, ${available}MB available`);
  }
  
  private async detectStorage(): Promise<void> {
    const mangaPath = process.env.MANGA_ROOT || './manga-collection';
    
    try {
      const stats = await statfs(mangaPath);
      const total = Math.floor((stats.blocks * stats.bsize) / (1024 * 1024 * 1024));
      const available = Math.floor((stats.bavail * stats.bsize) / (1024 * 1024 * 1024));
      
      // Detect storage type (simplified - actual detection would be more complex)
      const storageType = await this.detectStorageType(mangaPath);
      
      this.specs.storage = {
        type: storageType,
        total,
        available,
        path: mangaPath
      };
      
      console.log(`   Storage: ${storageType} - ${total}GB total, ${available}GB available`);
    } catch (error) {
      console.warn('   Storage detection failed, using defaults');
      this.specs.storage = {
        type: 'UNKNOWN',
        total: 100,
        available: 50,
        path: mangaPath
      };
    }
  }
  
  private async detectStorageType(path: string): Promise<'SSD' | 'HDD' | 'UNKNOWN'> {
    // Platform-specific storage type detection
    if (platform() === 'win32') {
      try {
        // Windows: Use WMIC to detect drive type
        const { stdout } = await execAsync('wmic diskdrive get MediaType /value');
        if (stdout.includes('SSD') || stdout.includes('Solid')) {
          return 'SSD';
        }
        if (stdout.includes('HDD') || stdout.includes('Fixed')) {
          return 'HDD';
        }
      } catch {
        // Fallback detection
      }
    } else if (platform() === 'linux') {
      try {
        // Linux: Check rotational flag
        const { stdout } = await execAsync('lsblk -d -o name,rota | grep "0$"');
        if (stdout.length > 0) {
          return 'SSD';
        }
      } catch {
        // Fallback detection
      }
    }
    
    // Fallback: Perform quick write test
    const testResult = await this.performStorageSpeedTest(path);
    return testResult > 100 ? 'SSD' : 'HDD'; // MB/s threshold
  }
  
  private async performStorageSpeedTest(path: string): Promise<number> {
    // Simplified speed test - actual implementation would be more thorough
    const testFile = `${path}/.speed_test_${Date.now()}`;
    const testData = Buffer.alloc(10 * 1024 * 1024); // 10MB test
    
    try {
      const start = performance.now();
      await Bun.write(testFile, testData);
      const writeTime = performance.now() - start;
      
      const startRead = performance.now();
      await Bun.file(testFile).arrayBuffer();
      const readTime = performance.now() - startRead;
      
      // Clean up
      await Bun.write(testFile, '');
      require('fs').unlinkSync(testFile);
      
      const avgTime = (writeTime + readTime) / 2;
      const speedMBps = (10 * 1000) / avgTime; // Convert to MB/s
      
      return speedMBps;
    } catch {
      return 50; // Default fallback speed
    }
  }
  
  private async detectNetwork(): Promise<void> {
    const interfaces = networkInterfaces();
    const activeInterfaces: string[] = [];
    let hasGigabit = false;
    
    for (const [name, addrs] of Object.entries(interfaces)) {
      if (addrs) {
        for (const addr of addrs) {
          if (!addr.internal && addr.family === 'IPv4') {
            activeInterfaces.push(name);
            // Check for gigabit capability (simplified)
            if (name.includes('Ethernet') || name.includes('eth')) {
              hasGigabit = true;
            }
          }
        }
      }
    }
    
    this.specs.network = {
      interfaces: activeInterfaces,
      hasGigabit,
      bandwidth: hasGigabit ? 1000 : 100 // Simplified assumption
    };
    
    console.log(`   Network: ${activeInterfaces.join(', ')} - ${hasGigabit ? 'Gigabit' : 'Fast Ethernet'}`);
  }
  
  private async detectPlatform(): Promise<void> {
    this.specs.platform = {
      os: platform(),
      arch: arch(),
      version: process.version
    };
    
    console.log(`   Platform: ${this.specs.platform.os} ${this.specs.platform.arch}`);
  }
  
  private calculatePerformanceTier(): void {
    const cpu = this.specs.cpu!;
    const memory = this.specs.memory!;
    const storage = this.specs.storage!;
    
    let score = 0;
    let confidence = 0;
    
    // CPU scoring (0-40 points)
    if (cpu.cores >= 16) score += 40;
    else if (cpu.cores >= 8) score += 30;
    else if (cpu.cores >= 4) score += 20;
    else score += 10;
    
    if (cpu.speed > 0) confidence += 25;
    
    // Memory scoring (0-40 points)
    const memGB = memory.total / 1024;
    if (memGB >= 32) score += 40;
    else if (memGB >= 16) score += 30;
    else if (memGB >= 8) score += 20;
    else score += 10;
    
    confidence += 25;
    
    // Storage scoring (0-20 points)
    if (storage.type === 'SSD') score += 20;
    else if (storage.type === 'HDD') score += 10;
    else score += 5;
    
    if (storage.type !== 'UNKNOWN') confidence += 25;
    
    // Network bonus (0-10 points)
    if (this.specs.network?.hasGigabit) {
      score += 10;
      confidence += 25;
    }
    
    // Determine tier based on score
    let tier: 'low' | 'medium' | 'high' | 'extreme';
    if (score >= 80) tier = 'extreme';
    else if (score >= 60) tier = 'high';
    else if (score >= 40) tier = 'medium';
    else tier = 'low';
    
    this.specs.performance = {
      tier,
      score,
      confidence: Math.min(confidence, 100)
    };
    
    console.log(`   Performance: ${tier.toUpperCase()} tier (score: ${score}/110, confidence: ${confidence}%)`);
  }
  
  async quickBenchmark(): Promise<number> {
    console.log('⚡ Running quick benchmark...');
    
    const tasks: Promise<number>[] = [];
    
    // CPU benchmark
    tasks.push(this.cpuBenchmark());
    
    // Memory benchmark
    tasks.push(this.memoryBenchmark());
    
    // I/O benchmark
    tasks.push(this.ioBenchmark());
    
    const results = await Promise.all(tasks);
    const avgScore = results.reduce((a, b) => a + b, 0) / results.length;
    
    console.log(`   Benchmark complete: ${avgScore.toFixed(0)}/100`);
    return avgScore;
  }
  
  private async cpuBenchmark(): Promise<number> {
    const start = performance.now();
    
    // Simple CPU-intensive task
    let result = 0;
    for (let i = 0; i < 10000000; i++) {
      result += Math.sqrt(i);
    }
    
    const elapsed = performance.now() - start;
    
    // Score based on time (lower is better)
    if (elapsed < 50) return 100;
    if (elapsed < 100) return 80;
    if (elapsed < 200) return 60;
    if (elapsed < 500) return 40;
    return 20;
  }
  
  private async memoryBenchmark(): Promise<number> {
    const start = performance.now();
    
    // Memory allocation test
    const arrays: Uint8Array[] = [];
    try {
      for (let i = 0; i < 100; i++) {
        arrays.push(new Uint8Array(1024 * 1024)); // 1MB allocations
      }
    } catch {
      return 20; // Low memory
    }
    
    const elapsed = performance.now() - start;
    
    // Score based on allocation speed
    if (elapsed < 10) return 100;
    if (elapsed < 50) return 80;
    if (elapsed < 100) return 60;
    if (elapsed < 200) return 40;
    return 20;
  }
  
  private async ioBenchmark(): Promise<number> {
    const testFile = `./.benchmark_${Date.now()}`;
    const testData = Buffer.alloc(5 * 1024 * 1024); // 5MB test
    
    try {
      const start = performance.now();
      
      // Write test
      await Bun.write(testFile, testData);
      
      // Read test
      await Bun.file(testFile).arrayBuffer();
      
      const elapsed = performance.now() - start;
      
      // Clean up
      require('fs').unlinkSync(testFile);
      
      // Score based on I/O speed
      if (elapsed < 50) return 100;
      if (elapsed < 100) return 80;
      if (elapsed < 200) return 60;
      if (elapsed < 500) return 40;
      return 20;
    } catch {
      return 20;
    }
  }
}

export default new HardwareDetector();