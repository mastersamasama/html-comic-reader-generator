/**
 * Interactive Configuration Wizard
 * User-friendly interface for system configuration
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { SimpleInput } from './simple-input';
import type { SystemSpecs } from './hardware-detector';
import type { ServerConfig } from './config-generator';

export class InteractiveWizard {
  constructor() {
    // No longer need readline interface - using SimpleInput
  }
  
  async run(specs: SystemSpecs, defaultConfig: ServerConfig): Promise<ServerConfig> {
    console.clear();
    this.displayWelcome();
    
    // Show detected specs
    await this.displaySpecs(specs);
    
    // Ask if user wants to use auto-config or customize
    const useAuto = await this.askYesNo(
      '\n🎯 Use recommended configuration based on your system?',
      true
    );
    
    // Always ask for manga path first
    console.log('\n📁 First, let\'s configure your manga collection path:\n');
    const mangaPath = await this.askMangaPath(defaultConfig.mangaPath);
    defaultConfig.mangaPath = mangaPath;
    
    if (useAuto) {
      console.log('\n✅ Using recommended configuration for your system');
      
      // Quick review
      await this.displayConfigSummary(defaultConfig);
      
      const confirm = await this.askYesNo('\n📋 Apply this configuration?', true);
      if (confirm) {
        return defaultConfig;
      }
    }
    
    // Custom configuration
    console.log('\n🔧 Starting custom configuration...\n');
    const customConfig = await this.customizeConfig(defaultConfig, specs);
    
    // Final review
    await this.displayConfigSummary(customConfig);
    
    const confirm = await this.askYesNo('\n📋 Apply this configuration?', true);
    if (!confirm) {
      console.log('\n❌ Configuration cancelled');
      process.exit(0);
    }
    
    return customConfig;
  }
  
  private displayWelcome(): void {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     🚀 MANGA SERVER AUTO-CONFIGURATION WIZARD 🚀          ║');
    console.log('║                                                            ║');
    console.log('║  This wizard will help you configure your manga server    ║');
    console.log('║  based on your system specifications.                     ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
  }
  
  private async displaySpecs(specs: SystemSpecs): Promise<void> {
    console.log('\n📊 DETECTED SYSTEM SPECIFICATIONS:\n');
    console.log('┌─────────────────────────────────────────────┐');
    console.log(`│ CPU:     ${specs.cpu.cores} cores @ ${specs.cpu.speed}MHz`);
    console.log(`│ Memory:  ${(specs.memory.total / 1024).toFixed(1)}GB total`);
    console.log(`│ Storage: ${specs.storage.type} - ${specs.storage.total}GB`);
    console.log(`│ Network: ${specs.network.hasGigabit ? 'Gigabit' : 'Fast'} Ethernet`);
    console.log(`│ Platform: ${specs.platform.os} ${specs.platform.arch}`);
    console.log('└─────────────────────────────────────────────┘');
    console.log(`\n🎯 Performance Tier: ${this.getColoredTier(specs.performance.tier)}`);
    console.log(`📈 Confidence: ${specs.performance.confidence}%`);
  }
  
  private getColoredTier(tier: string): string {
    const colors = {
      low: '\x1b[33m', // Yellow
      medium: '\x1b[36m', // Cyan
      high: '\x1b[32m', // Green
      extreme: '\x1b[35m' // Magenta
    };
    const reset = '\x1b[0m';
    return `${colors[tier as keyof typeof colors]}${tier.toUpperCase()}${reset}`;
  }
  
  private async customizeConfig(config: ServerConfig, specs: SystemSpecs): Promise<ServerConfig> {
    const custom = { ...config };
    
    // Basic Settings
    console.log('━━━ BASIC SETTINGS ━━━\n');
    
    custom.mangaPath = await this.askMangaPath(config.mangaPath);
    custom.port = await this.askNumber('Server port', config.port, 1, 65535);
    
    const bindAll = await this.askYesNo('Allow access from other devices?', true);
    custom.hostname = bindAll ? '0.0.0.0' : 'localhost';
    
    // Performance Settings
    const customizePerf = await this.askYesNo('\n🚀 Customize performance settings?', false);
    
    if (customizePerf) {
      console.log('\n━━━ PERFORMANCE SETTINGS ━━━\n');
      
      const modes = ['conservative', 'balanced', 'aggressive', 'extreme'];
      console.log('Performance modes:');
      modes.forEach((mode, i) => {
        console.log(`  ${i + 1}. ${mode} ${mode === config.performanceMode ? '(recommended)' : ''}`);
      });
      
      const modeIndex = await this.askNumber('Select mode (1-4)', 
        modes.indexOf(config.performanceMode) + 1, 1, 4);
      custom.performanceMode = modes[modeIndex - 1] as any;
      
      // Advanced settings
      const advancedPerf = await this.askYesNo('\n⚙️ Configure advanced settings?', false);
      
      if (advancedPerf) {
        const maxMem = specs.memory.available;
        custom.cacheSize = await this.askNumber(
          `Cache size (MB, max ${maxMem})`,
          config.cacheSize,
          64,
          maxMem
        );
        
        custom.maxConnections = await this.askNumber(
          'Max connections',
          config.maxConnections,
          10,
          100000
        );
        
        custom.workerThreads = await this.askNumber(
          `Worker threads (max ${specs.cpu.cores})`,
          config.workerThreads,
          1,
          specs.cpu.cores
        );
      }
    }
    
    // Features
    const customizeFeatures = await this.askYesNo('\n🎨 Customize features?', false);
    
    if (customizeFeatures) {
      console.log('\n━━━ FEATURE SETTINGS ━━━\n');
      
      custom.enableCompression = await this.askYesNo('Enable compression?', config.enableCompression);
      custom.enableWebSocket = await this.askYesNo('Enable WebSocket sync?', config.enableWebSocket);
      custom.enableMetrics = await this.askYesNo('Enable performance metrics?', config.enableMetrics);
      custom.autoTuning = await this.askYesNo('Enable auto-tuning?', config.autoTuning);
    }
    
    return custom;
  }
  
  private async askMangaPath(defaultPath: string): Promise<string> {
    while (true) {
      const answer = await SimpleInput.prompt(
        `Enter the path to your manga collection folder\n` +
        `(e.g., ./manga-collection, G:\\manga\\本, /home/user/manga)\n` +
        `Path [${defaultPath}]: `
      );
      
      const path = answer || defaultPath;
      const resolvedPath = resolve(path);
      
      if (existsSync(resolvedPath)) {
        console.log(`   ✅ Path exists: ${resolvedPath}`);
        return resolvedPath;
      }
      
      console.log(`   ⚠️ Path does not exist: ${resolvedPath}`);
      const create = await SimpleInput.confirm('   Create this directory?', true);
      
      if (create) {
        try {
          require('fs').mkdirSync(resolvedPath, { recursive: true });
          console.log('   ✅ Directory created');
          return resolvedPath;
        } catch (error) {
          console.log('   ❌ Failed to create directory:', (error as Error).message);
        }
      }
    }
  }
  
  private async askYesNo(question: string, defaultYes: boolean): Promise<boolean> {
    return await SimpleInput.confirm(question, defaultYes);
  }
  
  private async askNumber(
    question: string,
    defaultValue: number,
    min: number,
    max: number
  ): Promise<number> {
    while (true) {
      const answer = await SimpleInput.prompt(
        `${question} (${min}-${max}, default: ${defaultValue}): `
      );
      
      if (!answer.trim()) return defaultValue;
      
      const num = parseInt(answer);
      if (!isNaN(num) && num >= min && num <= max) {
        return num;
      }
      
      console.log(`   ⚠️ Please enter a number between ${min} and ${max}`);
    }
  }
  
  private async displayConfigSummary(config: ServerConfig): Promise<void> {
    console.log('\n📋 CONFIGURATION SUMMARY:\n');
    console.log('┌──────────────────────────────────────────────────┐');
    console.log('│ BASIC SETTINGS                                   │');
    console.log(`│   Manga Path: ${config.mangaPath.substring(0, 30)}...`);
    console.log(`│   Server: http://${config.hostname}:${config.port}`);
    console.log(`│   Environment: ${config.environment}`);
    console.log('│                                                  │');
    console.log('│ PERFORMANCE                                      │');
    console.log(`│   Mode: ${config.performanceMode.toUpperCase()}`);
    console.log(`│   Cache: ${config.cacheSize}MB`);
    console.log(`│   Max Connections: ${config.maxConnections}`);
    console.log(`│   Worker Threads: ${config.workerThreads}`);
    console.log('│                                                  │');
    console.log('│ FEATURES                                         │');
    console.log(`│   Compression: ${config.enableCompression ? '✅' : '❌'}`);
    console.log(`│   WebSocket: ${config.enableWebSocket ? '✅' : '❌'}`);
    console.log(`│   Metrics: ${config.enableMetrics ? '✅' : '❌'}`);
    console.log(`│   Auto-tuning: ${config.autoTuning ? '✅' : '❌'}`);
    console.log('└──────────────────────────────────────────────────┘');
  }
  
  async testConfiguration(config: ServerConfig): Promise<boolean> {
    console.log('\n🧪 Testing configuration...\n');
    
    const tests = [
      { name: 'Port availability', fn: () => this.testPort(config.port) },
      { name: 'Manga path access', fn: () => this.testPath(config.mangaPath) },
      { name: 'Memory allocation', fn: () => this.testMemory(config.cacheSize) },
      { name: 'Network binding', fn: () => this.testNetwork(config.hostname) }
    ];
    
    let allPassed = true;
    
    for (const test of tests) {
      process.stdout.write(`   ${test.name}...`);
      try {
        await test.fn();
        console.log(' ✅');
      } catch (error) {
        console.log(' ❌');
        allPassed = false;
      }
    }
    
    return allPassed;
  }
  
  private async testPort(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = Bun.serve({
        port,
        hostname: 'localhost',
        fetch: () => new Response('test')
      });
      
      if (server) {
        server.stop();
        resolve();
      } else {
        reject(new Error('Port not available'));
      }
    });
  }
  
  private async testPath(path: string): Promise<void> {
    if (!existsSync(path)) {
      throw new Error('Path does not exist');
    }
    
    // Test write permissions
    const testFile = `${path}/.test_${Date.now()}`;
    try {
      await Bun.write(testFile, 'test');
      require('fs').unlinkSync(testFile);
    } catch {
      throw new Error('No write permissions');
    }
  }
  
  private async testMemory(sizeMB: number): Promise<void> {
    try {
      const buffer = new Uint8Array(sizeMB * 1024 * 1024);
      // Quick allocation test
      buffer[0] = 1;
    } catch {
      throw new Error('Insufficient memory');
    }
  }
  
  private async testNetwork(hostname: string): Promise<void> {
    // Simple network test
    if (hostname !== 'localhost' && hostname !== '0.0.0.0') {
      // Validate IP format
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!ipRegex.test(hostname)) {
        throw new Error('Invalid hostname format');
      }
    }
  }
}

export default new InteractiveWizard();