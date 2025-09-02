import { test, expect, describe } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

describe("Manga Server - Code Structure Tests", () => {
  test("server source file exists and is readable", () => {
    const serverPath = join(import.meta.dir, "../src/optimized-server.ts");
    expect(existsSync(serverPath)).toBe(true);
  });
  
  test("server source files exist", () => {
    const srcDir = join(import.meta.dir, "../src");
    const serverFile = join(srcDir, "optimized-server.ts");
    const scriptsDir = join(import.meta.dir, "../scripts");
    
    expect(existsSync(srcDir)).toBe(true);
    expect(existsSync(serverFile)).toBe(true);
    expect(existsSync(scriptsDir)).toBe(true);
  });
  
  test("parent package.json has required scripts", async () => {
    const packagePath = join(import.meta.dir, "../../package.json");
    expect(existsSync(packagePath)).toBe(true);
    
    const packageText = await Bun.file(packagePath).text();
    const packageJson = JSON.parse(packageText);
    
    expect(packageJson.scripts).toHaveProperty("start");
    expect(packageJson.scripts).toHaveProperty("dev");
    expect(packageJson.scripts).toHaveProperty("health");
    expect(packageJson.scripts).toHaveProperty("stats");
    expect(packageJson.scripts).toHaveProperty("benchmark");
    expect(packageJson.scripts).toHaveProperty("monitor");
  });
  
  test("server code imports should be valid", async () => {
    const serverPath = join(import.meta.dir, "../src/optimized-server.ts");
    const serverCode = await Bun.file(serverPath).text();
    
    // Check for required imports
    expect(serverCode).toContain('import { serve, file, write }');
    expect(serverCode).toContain('from "bun"');
    expect(serverCode).toContain('import { readdir, stat, watch, readFile }');
    expect(serverCode).toContain('from "node:fs/promises"');
    expect(serverCode).toContain('import { join, resolve, extname, relative }');
    expect(serverCode).toContain('from "node:path"');
  });
  
  test("server code has expected classes", async () => {
    const serverPath = join(import.meta.dir, "../src/optimized-server.ts");
    const serverCode = await Bun.file(serverPath).text();
    
    // Check for main classes
    expect(serverCode).toContain('class UltraFastCacheManager');
    expect(serverCode).toContain('class RateLimiter');
    expect(serverCode).toContain('class MangaScanner');
    expect(serverCode).toContain('class StaticHandler');
    expect(serverCode).toContain('class APIHandler');
    expect(serverCode).toContain('class WebSocketHandler');
    expect(serverCode).toContain('class MangaServer');
  });
  
  test("server code has performance optimizations", async () => {
    const serverPath = join(import.meta.dir, "../src/optimized-server.ts");
    const serverCode = await Bun.file(serverPath).text();
    
    // Check for performance features
    expect(serverCode).toContain('LRU'); // LRU cache instead of doubly linked list
    expect(serverCode).toContain('streaming');
    expect(serverCode).toContain('compression');
    expect(serverCode).toContain('backgroundIndexing'); // camelCase version
    expect(serverCode).toContain('memoryPressure'); // camelCase version
  });
  
  test("configuration has proper defaults", async () => {
    const serverPath = join(import.meta.dir, "../src/optimized-server.ts");
    const serverCode = await Bun.file(serverPath).text();
    
    // Check configuration defaults
    expect(serverCode).toContain('process.env.HOSTNAME ||'); // External access
    expect(serverCode).toContain('MAX_CONNECTIONS || "100000"'); // Ultra capacity for 64GB RAM
    expect(serverCode).toContain('STREAMING_THRESHOLD || "32768"'); // 32KB
    expect(serverCode).toContain('COMPRESSION_THRESHOLD || "256"'); // 256B
  });
});

describe("Manga Server - Environment Configuration", () => {
  test("server has environment configuration", async () => {
    const serverPath = join(import.meta.dir, "../src/optimized-server.ts");
    const serverContent = await Bun.file(serverPath).text();
    expect(serverContent).toContain("process.env");
    expect(serverContent).toContain("NODE_ENV");
  });
  
  test("scripts directory has all management tools", () => {
    const scriptsDir = join(import.meta.dir, "../scripts");
    const requiredScripts = [
      "setup.ts",
      "health-check.ts", 
      "stats.ts",
      "monitor.ts",
      "benchmark.ts"
    ];
    
    for (const script of requiredScripts) {
      const scriptPath = join(scriptsDir, script);
      expect(existsSync(scriptPath)).toBe(true);
    }
  });
  
  test("Server configuration has production settings", async () => {
    const serverPath = join(import.meta.dir, "../src/optimized-server.ts");
    const serverContent = await Bun.file(serverPath).text();
    
    // Check server has production configuration
    expect(serverContent).toContain("NODE_ENV");
    expect(serverContent).toContain("process.env");
    expect(serverContent).toContain("production");
  });
  
  test("README documentation exists and is comprehensive", async () => {
    const readmePath = join(import.meta.dir, "../../README.md");
    expect(existsSync(readmePath)).toBe(true);
    
    const readmeContent = await Bun.file(readmePath).text();
    
    // Check for key sections
    expect(readmeContent).toContain("# 📚 Manga Server - High-Performance Manga Reading System");
    expect(readmeContent).toContain("## 🚀 Quick Start");
    expect(readmeContent).toContain("## ⚙️ Configuration");
    expect(readmeContent).toContain("## 🎯 Common Use Cases");
    expect(readmeContent).toContain("## 🆘 Troubleshooting");
    expect(readmeContent).toContain("## 📱 Reading Your Manga");
  });
});

describe("Manga Server - TypeScript Configuration", () => {
  test("code uses proper TypeScript types", async () => {
    const serverPath = join(import.meta.dir, "../src/optimized-server.ts");
    const serverCode = await Bun.file(serverPath).text();
    
    // Check for interface definitions
    expect(serverCode).toContain("interface CacheNode");
    expect(serverCode).toContain("interface CacheEntry");
    expect(serverCode).toContain("interface MangaItem");
    expect(serverCode).toContain("interface Chapter");
    expect(serverCode).toContain("interface ReadingProgress");
  });
  
  test("async/await patterns are used correctly", async () => {
    const serverPath = join(import.meta.dir, "../src/optimized-server.ts");
    const serverCode = await Bun.file(serverPath).text();
    
    // Check for proper async patterns
    expect(serverCode).toMatch(/async\s+\w+\([^)]*\):\s*Promise</);
    expect(serverCode).toContain("await");
    expect(serverCode).toContain("Promise.all");
  });
});

describe("Manga Server - Performance Features", () => {
  test("code has caching implementation", async () => {
    const serverPath = join(import.meta.dir, "../src/optimized-server.ts");
    const serverCode = await Bun.file(serverPath).text();
    
    // Check caching features
    expect(serverCode).toContain("UltraFastCacheManager");
    expect(serverCode).toContain("CacheEntry");
    expect(serverCode).toContain("async get(");
    expect(serverCode).toContain("async set(");
  });
  
  test("code has streaming implementation", async () => {
    const serverPath = join(import.meta.dir, "../src/optimized-server.ts");
    const serverCode = await Bun.file(serverPath).text();
    
    // Check streaming features
    expect(serverCode).toContain("handleZeroCopyStreaming");
    expect(serverCode).toContain("streamingThreshold");
    expect(serverCode).toContain("Zero-copy streaming");
  });
  
  test("code has compression support", async () => {
    const serverPath = join(import.meta.dir, "../src/optimized-server.ts");
    const serverCode = await Bun.file(serverPath).text();
    
    // Check compression features
    expect(serverCode).toContain("shouldCompress");
    expect(serverCode).toContain("compressData");
    expect(serverCode).toContain("Bun.gzipSync");
    expect(serverCode).toContain("Content-Encoding");
  });
});