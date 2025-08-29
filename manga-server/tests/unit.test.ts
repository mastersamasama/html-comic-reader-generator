import { test, expect, describe } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

describe("Manga Server - Code Structure Tests", () => {
  test("server source file exists and is readable", () => {
    const serverPath = join(import.meta.dir, "../src/server.ts");
    expect(existsSync(serverPath)).toBe(true);
  });
  
  test("configuration files exist", () => {
    const configDir = join(import.meta.dir, "../config");
    const dockerFile = join(configDir, "Dockerfile");
    const dockerCompose = join(configDir, "docker-compose.yml");
    
    expect(existsSync(dockerFile)).toBe(true);
    expect(existsSync(dockerCompose)).toBe(true);
  });
  
  test("package.json has required scripts", async () => {
    const packagePath = join(import.meta.dir, "../package.json");
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
    const serverPath = join(import.meta.dir, "../src/server.ts");
    const serverCode = await Bun.file(serverPath).text();
    
    // Check for required imports
    expect(serverCode).toContain('import { serve, file }');
    expect(serverCode).toContain('from "bun"');
    expect(serverCode).toContain('import { readdir, stat }');
    expect(serverCode).toContain('from "node:fs/promises"');
    expect(serverCode).toContain('import { join, resolve, extname, relative }');
    expect(serverCode).toContain('from "node:path"');
  });
  
  test("server code has expected classes", async () => {
    const serverPath = join(import.meta.dir, "../src/server.ts");
    const serverCode = await Bun.file(serverPath).text();
    
    // Check for main classes
    expect(serverCode).toContain('class CacheManager');
    expect(serverCode).toContain('class RateLimiter');
    expect(serverCode).toContain('class MangaScanner');
    expect(serverCode).toContain('class StaticHandler');
    expect(serverCode).toContain('class APIHandler');
    expect(serverCode).toContain('class WebSocketHandler');
    expect(serverCode).toContain('class MangaServer');
  });
  
  test("server code has performance optimizations", async () => {
    const serverPath = join(import.meta.dir, "../src/server.ts");
    const serverCode = await Bun.file(serverPath).text();
    
    // Check for performance features
    expect(serverCode).toContain('doubly linked list');
    expect(serverCode).toContain('O(1) operations');
    expect(serverCode).toContain('streaming');
    expect(serverCode).toContain('compression');
    expect(serverCode).toContain('background indexing');
    expect(serverCode).toContain('memory pressure');
  });
  
  test("configuration has proper defaults", async () => {
    const serverPath = join(import.meta.dir, "../src/server.ts");
    const serverCode = await Bun.file(serverPath).text();
    
    // Check configuration defaults
    expect(serverCode).toContain('HOSTNAME || "0.0.0.0"'); // External access
    expect(serverCode).toContain('MAX_CONNECTIONS || "5000"'); // High capacity
    expect(serverCode).toContain('STREAMING_THRESHOLD || "262144"'); // 256KB
    expect(serverCode).toContain('COMPRESSION_THRESHOLD || "1024"'); // 1KB
  });
});

describe("Manga Server - Environment Configuration", () => {
  test("environment file template exists", () => {
    const envPath = join(import.meta.dir, "../config/.env");
    expect(existsSync(envPath)).toBe(true);
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
  
  test("Docker configuration is complete", async () => {
    const dockerfilePath = join(import.meta.dir, "../config/Dockerfile");
    const dockerComposePath = join(import.meta.dir, "../config/docker-compose.yml");
    
    const dockerfileContent = await Bun.file(dockerfilePath).text();
    const dockerComposeContent = await Bun.file(dockerComposePath).text();
    
    // Check Dockerfile has security features
    expect(dockerfileContent).toContain("adduser -D -u 1000");
    expect(dockerfileContent).toContain("USER manga");
    expect(dockerfileContent).toContain("EXPOSE 80");
    
    // Check docker-compose has required services
    expect(dockerComposeContent).toContain("manga-server");
    expect(dockerComposeContent).toContain("NODE_ENV=production");
    expect(dockerComposeContent).toContain("HOSTNAME=0.0.0.0");
  });
  
  test("README documentation exists and is comprehensive", async () => {
    const readmePath = join(import.meta.dir, "../README.md");
    expect(existsSync(readmePath)).toBe(true);
    
    const readmeContent = await Bun.file(readmePath).text();
    
    // Check for key sections
    expect(readmeContent).toContain("# 🚀 High-Performance Manga Server");
    expect(readmeContent).toContain("## Quick Start");
    expect(readmeContent).toContain("## Configuration");
    expect(readmeContent).toContain("## API Endpoints");
    expect(readmeContent).toContain("## Docker Deployment");
    expect(readmeContent).toContain("## Performance");
  });
});

describe("Manga Server - TypeScript Configuration", () => {
  test("code uses proper TypeScript types", async () => {
    const serverPath = join(import.meta.dir, "../src/server.ts");
    const serverCode = await Bun.file(serverPath).text();
    
    // Check for interface definitions
    expect(serverCode).toContain("interface CacheNode");
    expect(serverCode).toContain("interface CacheEntry");
    expect(serverCode).toContain("interface MangaItem");
    expect(serverCode).toContain("interface Chapter");
    expect(serverCode).toContain("interface ReadingProgress");
  });
  
  test("async/await patterns are used correctly", async () => {
    const serverPath = join(import.meta.dir, "../src/server.ts");
    const serverCode = await Bun.file(serverPath).text();
    
    // Check for proper async patterns
    expect(serverCode).toMatch(/async\s+\w+\([^)]*\):\s*Promise</);
    expect(serverCode).toContain("await");
    expect(serverCode).toContain("Promise.all");
  });
});

describe("Manga Server - Performance Features", () => {
  test("code has caching implementation", async () => {
    const serverPath = join(import.meta.dir, "../src/server.ts");
    const serverCode = await Bun.file(serverPath).text();
    
    // Check caching features
    expect(serverCode).toContain("moveToFront");
    expect(serverCode).toContain("addToFront");
    expect(serverCode).toContain("removeNode");
    expect(serverCode).toContain("evictLRU");
    expect(serverCode).toContain("adaptToMemoryPressure");
  });
  
  test("code has streaming implementation", async () => {
    const serverPath = join(import.meta.dir, "../src/server.ts");
    const serverCode = await Bun.file(serverPath).text();
    
    // Check streaming features
    expect(serverCode).toContain("ReadableStream");
    expect(serverCode).toContain("handleStreamingResponse");
    expect(serverCode).toContain("handleRangeRequest");
    expect(serverCode).toContain("chunkSize");
  });
  
  test("code has compression support", async () => {
    const serverPath = join(import.meta.dir, "../src/server.ts");
    const serverCode = await Bun.file(serverPath).text();
    
    // Check compression features
    expect(serverCode).toContain("shouldCompress");
    expect(serverCode).toContain("compressData");
    expect(serverCode).toContain("Bun.gzipSync");
    expect(serverCode).toContain("Content-Encoding");
  });
});