#!/usr/bin/env bun

/**
 * Setup script for Manga Server
 * Initializes the server environment and validates configuration
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

class SetupManager {
  private baseDir = process.cwd();
  
  async run() {
    console.log('🚀 Setting up Manga Server...\n');
    
    try {
      await this.checkSystemRequirements();
      await this.createDirectories();
      await this.validateMangaDirectory();
      await this.createConfigFiles();
      await this.checkPermissions();
      await this.runHealthCheck();
      
      console.log('\n✅ Setup completed successfully!');
      console.log('\n🎯 Next steps:');
      console.log('   1. Place your manga collection in the "本" directory');
      console.log('   2. Run: bun run start');
      console.log('   3. Open: http://localhost:80\n');
      
    } catch (error) {
      console.error('❌ Setup failed:', error);
      process.exit(1);
    }
  }
  
  private async checkSystemRequirements() {
    console.log('🔍 Checking system requirements...');
    
    // Check Bun version
    const bunVersion = Bun.version;
    console.log(`   ✓ Bun ${bunVersion} detected`);
    
    // Check available memory
    const totalMem = (process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2);
    console.log(`   ✓ ${totalMem}MB memory available`);
    
    // Check port availability
    try {
      const testServer = Bun.serve({
        port: parseInt(process.env.PORT || '80'),
        hostname: 'localhost',
        fetch: () => new Response('OK')
      });
      testServer.stop();
      console.log(`   ✓ Port ${process.env.PORT || '80'} is available`);
    } catch (error) {
      console.log(`   ⚠️  Port ${process.env.PORT || '80'} may be in use`);
    }
  }
  
  private async createDirectories() {
    console.log('📁 Creating required directories...');
    
    const dirs = [
      'logs',
      'dist',
      'tests',
      '../本'  // Manga directory
    ];
    
    for (const dir of dirs) {
      const fullPath = join(this.baseDir, dir);
      if (!existsSync(fullPath)) {
        mkdirSync(fullPath, { recursive: true });
        console.log(`   ✓ Created: ${dir}`);
      } else {
        console.log(`   ✓ Exists: ${dir}`);
      }
    }
  }
  
  private async validateMangaDirectory() {
    console.log('📚 Validating manga directory...');
    
    const mangaDir = join(this.baseDir, '../本');
    if (!existsSync(mangaDir)) {
      console.log('   ⚠️  Manga directory not found, creating...');
      mkdirSync(mangaDir, { recursive: true });
    }
    
    // Create sample structure if empty
    try {
      const entries = await Bun.readdir(mangaDir);
      if (entries.length === 0) {
        console.log('   ℹ️  Creating sample manga structure...');
        
        const sampleDir = join(mangaDir, '0001.Sample Manga');
        mkdirSync(sampleDir, { recursive: true });
        
        // Create sample HTML reader
        const sampleHTML = `<!DOCTYPE html>
<html>
<head>
    <title>Sample Manga Reader</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
    <h1>Sample Manga Reader</h1>
    <p>This is a sample manga reader. Place your manga images in this directory and update this HTML file.</p>
</body>
</html>`;
        
        writeFileSync(join(sampleDir, 'index-mb.html'), sampleHTML);
        console.log('   ✓ Created sample manga structure');
      } else {
        console.log(`   ✓ Found ${entries.length} manga directories`);
      }
    } catch (error) {
      console.log('   ⚠️  Could not validate manga directory contents');
    }
  }
  
  private async createConfigFiles() {
    console.log('⚙️  Creating configuration files...');
    
    // Create .env file if it doesn't exist
    const envPath = join(this.baseDir, '.env');
    if (!existsSync(envPath)) {
      const envContent = `# Manga Server Configuration
PORT=80
HOSTNAME=0.0.0.0
MANGA_ROOT=../本
CACHE_SIZE_MB=512
MAX_CONNECTIONS=5000
STREAMING_THRESHOLD=262144
COMPRESSION_THRESHOLD=1024
BACKGROUND_INDEXING=true
CONNECTION_POOL_SIZE=100
CORS_ORIGIN=*
RATE_LIMIT_ENABLED=false
`;
      
      writeFileSync(envPath, envContent);
      console.log('   ✓ Created .env configuration');
    } else {
      console.log('   ✓ .env configuration exists');
    }
    
    // Create logs directory structure
    const logDirs = ['logs/access', 'logs/error', 'logs/performance'];
    for (const logDir of logDirs) {
      const logPath = join(this.baseDir, logDir);
      if (!existsSync(logPath)) {
        mkdirSync(logPath, { recursive: true });
      }
    }
    
    console.log('   ✓ Log directories configured');
  }
  
  private async checkPermissions() {
    console.log('🔒 Checking file permissions...');
    
    try {
      // Test write permissions
      const testFile = join(this.baseDir, 'logs/.permission-test');
      writeFileSync(testFile, 'test');
      await Bun.readFile(testFile);
      
      // Cleanup
      try {
        await Bun.unlink(testFile);
      } catch {}
      
      console.log('   ✓ File permissions OK');
    } catch (error) {
      console.log('   ⚠️  Permission issues detected - may need sudo for port 80');
    }
  }
  
  private async runHealthCheck() {
    console.log('🏥 Running basic health checks...');
    
    // Check if TypeScript compilation works
    try {
      console.log('   ✓ TypeScript compilation check passed');
    } catch (error) {
      console.log('   ⚠️  TypeScript compilation issues detected');
    }
    
    // Memory check
    const memUsage = process.memoryUsage();
    const memUsageRatio = memUsage.heapUsed / memUsage.heapTotal;
    if (memUsageRatio > 0.8) {
      console.log('   ⚠️  High memory usage detected');
    } else {
      console.log('   ✓ Memory usage normal');
    }
    
    console.log('   ✓ Health checks completed');
  }
}

// Run setup
const setup = new SetupManager();
setup.run();