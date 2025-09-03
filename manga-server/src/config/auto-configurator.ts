/**
 * Auto-Configurator Module
 * Main orchestrator for automatic system configuration
 */

import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import hardwareDetector from './hardware-detector';
import configGenerator from './config-generator';
import interactiveWizard from './interactive-wizard';
import { SimpleInput } from './simple-input';
import type { SystemSpecs } from './hardware-detector';
import type { ServerConfig } from './config-generator';

export interface AutoConfigOptions {
  interactive?: boolean;
  force?: boolean;
  testOnly?: boolean;
  outputPath?: string;
  silent?: boolean;
}

export class AutoConfigurator {
  private configPath: string;
  private userConfigPath: string;
  private specs?: SystemSpecs;
  private config?: ServerConfig;
  
  constructor() {
    this.configPath = resolve('./manga-server/.env');
    this.userConfigPath = resolve('./manga-server/.env'); // Single .env file
    
    // Ensure manga-server directory exists
    this.ensureConfigDirectory();
  }
  
  private ensureConfigDirectory(): void {
    const configDir = resolve('./manga-server');
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }
  }
  
  async run(options: AutoConfigOptions = {}): Promise<ServerConfig> {
    if (!options.silent) {
      console.log('\n🚀 Starting Auto-Configuration System...\n');
    }
    
    // Check for existing configuration
    if (!options.force && this.hasExistingConfig()) {
      console.log('📁 Found existing configuration');
      
      if (options.interactive) {
        const useExisting = await this.askUseExisting();
        if (useExisting) {
          return this.loadExistingConfig();
        }
      } else {
        console.log('   Using existing configuration (use --force to regenerate)');
        return this.loadExistingConfig();
      }
    }
    
    // Step 1: Detect hardware
    if (!options.silent) {
      console.log('📊 Step 1/4: Detecting hardware...\n');
    }
    this.specs = await hardwareDetector.detectAll();
    
    // Step 2: Run benchmark
    if (!options.silent) {
      console.log('\n⚡ Step 2/4: Running performance benchmark...\n');
    }
    const benchmarkScore = await hardwareDetector.quickBenchmark();
    
    // Adjust performance tier based on benchmark
    this.adjustTierFromBenchmark(benchmarkScore);
    
    // Step 3: Generate configuration
    if (!options.silent) {
      console.log('\n🔧 Step 3/4: Generating configuration...\n');
    }
    
    // Load user preferences if they exist
    const userPrefs = this.loadUserPreferences();
    
    // Generate base configuration
    let generatedConfig = configGenerator.generateConfig(this.specs, userPrefs);
    
    // Always prompt for manga path if not exists or in auto mode
    const currentMangaPath = generatedConfig.mangaPath || './manga-collection';
    if (!options.interactive && !existsSync(currentMangaPath)) {
      console.log('\n📁 Manga collection path configuration:\n');
      generatedConfig.mangaPath = await this.promptMangaPath(currentMangaPath);
    }
    
    // Step 4: Interactive customization (if requested)
    if (options.interactive) {
      console.log('\n🎨 Step 4/4: Interactive customization...\n');
      generatedConfig = await interactiveWizard.run(this.specs, generatedConfig);
    } else {
      if (!options.silent) {
        console.log('\n✅ Step 4/4: Applying configuration...\n');
      }
    }
    
    this.config = generatedConfig;
    
    // Test configuration if requested
    if (options.testOnly) {
      const testPassed = await this.testConfiguration();
      if (!testPassed) {
        throw new Error('Configuration test failed');
      }
      console.log('\n✅ Configuration test passed!');
      return this.config;
    }
    
    // Save configuration
    await this.saveConfiguration(this.config, options.outputPath);
    
    // Display recommendations
    if (!options.silent) {
      this.displayRecommendations();
    }
    
    // Apply configuration to environment
    this.applyToEnvironment(this.config);
    
    if (!options.silent) {
      console.log('\n🎉 Auto-configuration complete!\n');
      this.displayNextSteps();
    }
    
    return this.config;
  }
  
  private hasExistingConfig(): boolean {
    return existsSync(this.configPath) || existsSync(this.userConfigPath);
  }
  
  private async askUseExisting(): Promise<boolean> {
    return await SimpleInput.confirm('Use existing configuration?', true);
  }
  
  private loadExistingConfig(): ServerConfig {
    // Load from single .env file
    if (!existsSync(this.configPath)) {
      throw new Error('No configuration found');
    }
    
    const envContent = require('fs').readFileSync(this.configPath, 'utf-8');
    const config: ServerConfig = configGenerator.parseEnvToConfig(envContent);
    
    return config;
  }
  
  private loadUserPreferences(): Partial<ServerConfig> | undefined {
    // User preferences are now in the same .env file
    if (existsSync(this.configPath)) {
      try {
        const envContent = require('fs').readFileSync(this.configPath, 'utf-8');
        return configGenerator.parseEnvToConfig(envContent);
      } catch {
        console.warn('⚠️ Failed to load preferences from .env');
      }
    }
    return undefined;
  }
  
  private adjustTierFromBenchmark(score: number): void {
    if (!this.specs) return;
    
    // Adjust tier based on actual benchmark performance
    const currentTier = this.specs.performance.tier;
    let newTier = currentTier;
    
    if (score >= 90 && currentTier !== 'extreme') {
      newTier = 'extreme';
    } else if (score >= 70 && score < 90) {
      newTier = 'high';
    } else if (score >= 50 && score < 70) {
      newTier = 'medium';
    } else if (score < 50) {
      newTier = 'low';
    }
    
    if (newTier !== currentTier) {
      console.log(`   📊 Adjusting tier from ${currentTier} to ${newTier} based on benchmark`);
      this.specs.performance.tier = newTier;
    }
  }
  
  private async saveConfiguration(config: ServerConfig, outputPath?: string): Promise<void> {
    // Export directly as environment variables to single .env file
    const envPath = outputPath || resolve('./manga-server/.env');
    const envContent = configGenerator.exportEnvVars(config);
    await Bun.write(envPath, envContent);
    console.log(`   ✅ Configuration saved to ${envPath}`);
  }
  
  private async testConfiguration(): Promise<boolean> {
    if (!this.config) return false;
    
    console.log('\n🧪 Testing configuration...\n');
    
    const tests = [
      {
        name: 'Port availability',
        test: async () => {
          const server = Bun.serve({
            port: this.config!.port,
            hostname: 'localhost',
            fetch: () => new Response('test')
          });
          if (server) {
            server.stop();
            return true;
          }
          return false;
        }
      },
      {
        name: 'Manga path accessibility',
        test: async () => {
          return existsSync(this.config!.mangaPath);
        }
      },
      {
        name: 'Memory allocation',
        test: async () => {
          try {
            const buffer = new Uint8Array(this.config!.cacheSize * 1024 * 1024);
            buffer[0] = 1; // Touch memory
            return true;
          } catch {
            return false;
          }
        }
      },
      {
        name: 'Configuration validity',
        test: async () => {
          return this.config!.cacheSize > 0 &&
                 this.config!.maxConnections > 0 &&
                 this.config!.workerThreads > 0;
        }
      }
    ];
    
    let allPassed = true;
    
    for (const test of tests) {
      process.stdout.write(`   ${test.name}...`);
      try {
        const passed = await test.test();
        console.log(passed ? ' ✅' : ' ❌');
        if (!passed) allPassed = false;
      } catch (error) {
        console.log(' ❌');
        allPassed = false;
      }
    }
    
    return allPassed;
  }
  
  private displayRecommendations(): void {
    if (!this.specs || !this.config) return;
    
    const recommendations = configGenerator.generateRecommendations(this.specs, this.config);
    
    if (recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:\n');
      recommendations.forEach(rec => console.log(`   ${rec}`));
    }
  }
  
  private applyToEnvironment(config: ServerConfig): void {
    // Set environment variables for immediate use
    process.env.PORT = config.port.toString();
    process.env.HOSTNAME = config.hostname;
    process.env.NODE_ENV = config.environment === 'auto' ? 'production' : config.environment;
    process.env.CACHE_SIZE_MB = config.cacheSize.toString();
    process.env.MAX_CONNECTIONS = config.maxConnections.toString();
    process.env.WORKER_THREADS = config.workerThreads.toString();
    process.env.STREAMING_THRESHOLD = config.streamingThreshold.toString();
    process.env.COMPRESSION_THRESHOLD = config.compressionThreshold.toString();
    process.env.MANGA_ROOT = config.mangaPath;
    process.env.AUTO_TUNING = config.autoTuning.toString();
    process.env.PERFORMANCE_MODE = config.performanceMode;
  }
  
  private async promptMangaPath(defaultPath: string): Promise<string> {
    while (true) {
      const answer = await SimpleInput.prompt(
        `Enter manga collection path (default: ${defaultPath}): `
      );
      
      const path = answer.trim() || defaultPath;
      const resolvedPath = resolve(path);
      
      if (existsSync(resolvedPath)) {
        console.log(`   ✅ Path exists: ${resolvedPath}`);
        return resolvedPath;
      }
      
      console.log(`   ⚠️ Path does not exist: ${resolvedPath}`);
      
      const shouldCreate = await SimpleInput.confirm('Create this directory?', true);
      
      if (shouldCreate) {
        try {
          require('fs').mkdirSync(resolvedPath, { recursive: true });
          console.log('   ✅ Directory created');
          return resolvedPath;
        } catch (error) {
          console.log('   ❌ Failed to create directory:', (error as Error).message);
          console.log('   Please enter a different path.');
        }
      }
    }
  }
  
  private displayNextSteps(): void {
    console.log('📋 NEXT STEPS:\n');
    console.log('   1. Start the server:');
    console.log('      bun run start\n');
    console.log('   2. Generate manga library:');
    console.log('      bun run genshelf\n');
    console.log('   3. Access your manga:');
    console.log(`      http://${this.config?.hostname}:${this.config?.port}\n`);
    
    if (this.config?.hostname === '0.0.0.0') {
      console.log('   📱 Access from other devices:');
      console.log(`      http://[YOUR-IP]:${this.config.port}\n`);
    }
  }
  
  async reset(): Promise<void> {
    console.log('🔄 Resetting configuration...\n');
    
    // Remove single .env file
    const envPath = resolve('./manga-server/.env');
    if (existsSync(envPath)) {
      require('fs').unlinkSync(envPath);
      console.log('   ✅ Removed .env file');
    }
    
    console.log('\n✅ Configuration reset complete');
  }
  
  async showConfig(): Promise<void> {
    const envPath = resolve('./manga-server/.env');
    if (!existsSync(envPath)) {
      console.log('❌ No configuration found. Run auto-configuration first.');
      return;
    }
    
    const envContent = require('fs').readFileSync(envPath, 'utf-8');
    
    console.log('\n🔧 CURRENT CONFIGURATION (.env):\n');
    console.log(envContent);
  }
  
  getConfig(): ServerConfig | undefined {
    return this.config;
  }
  
  getSpecs(): SystemSpecs | undefined {
    return this.specs;
  }
}

export default new AutoConfigurator();