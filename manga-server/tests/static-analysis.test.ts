import { test, expect, describe } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

describe("Manga Server - Static Analysis & Quality", () => {
  test("Server configuration follows best practices", async () => {
    const serverPath = join(import.meta.dir, "../src/optimized-server.ts");
    const serverContent = await Bun.file(serverPath).text();
    
    // Security best practices in server code
    expect(serverContent).toContain("X-Content-Type-Options"); // Security headers
    expect(serverContent).toContain("X-Frame-Options"); // Clickjacking protection
    expect(serverContent).toContain("resolve("); // Path traversal prevention
    expect(serverContent).toContain("startsWith"); // Path validation
    
    // Production configurations
    expect(serverContent).toContain("process.env.NODE_ENV");
    expect(serverContent).toContain("console.log"); // Logging capability
    
    // Performance optimizations
    expect(serverContent).toContain("cache");
    expect(serverContent).toContain("compression");
  });
  
  test("Server environment configuration is production-ready", async () => {
    const serverPath = join(import.meta.dir, "../src/optimized-server.ts");
    const serverContent = await Bun.file(serverPath).text();
    
    // Production environment handling
    expect(serverContent).toContain("NODE_ENV");
    expect(serverContent).toContain("process.env");
    
    // Security configurations in code
    expect(serverContent).toContain("Security: Prevent path traversal");
    expect(serverContent).toContain("security headers");
    
    // Error handling
    expect(serverContent).toContain("try {");
    expect(serverContent).toContain("catch");
    
    // Process management
    expect(serverContent).toContain("SIGINT");
    expect(serverContent).toContain("SIGTERM");
  });
  
  test("server code follows TypeScript best practices", async () => {
    const serverPath = join(import.meta.dir, "../src/optimized-server.ts");
    const serverContent = await Bun.file(serverPath).text();
    
    // Type safety
    expect(serverContent).toContain("interface");
    expect(serverContent).toContain("Promise<");
    expect(serverContent).toContain("async");
    expect(serverContent).toContain("await");
    
    // Error handling
    expect(serverContent).toContain("try {");
    expect(serverContent).toContain("catch");
    expect(serverContent).toContain("console.error");
    
    // Proper class structure
    expect(serverContent).toContain("class");
    expect(serverContent).toContain("private");
    expect(serverContent).toContain("constructor(");
    
    // No obvious security issues
    expect(serverContent).not.toContain("eval(");
    expect(serverContent).not.toContain("innerHTML");
    expect(serverContent).not.toContain("document.write");
  });
  
  test("performance optimizations are implemented", async () => {
    const serverPath = join(import.meta.dir, "../src/optimized-server.ts");
    const serverContent = await Bun.file(serverPath).text();
    
    // Caching implementations - Updated for hash-based cache
    expect(serverContent).toContain("UltraFastCacheManager");
    expect(serverContent).toContain("evictRandom");
    expect(serverContent).toContain("adaptToMemoryPressure");
    expect(serverContent).toContain("bloomFilter");
    
    // Streaming support
    expect(serverContent).toContain("stream");
    expect(serverContent).toContain("streamingThreshold");
    expect(serverContent).toContain("handleZeroCopyStreaming");
    
    // Compression
    expect(serverContent).toContain("gzipSync");
    expect(serverContent).toContain("shouldCompress");
    expect(serverContent).toContain("Content-Encoding");
    
    // Memory management
    expect(serverContent).toContain("memoryUsage");
    expect(serverContent).toContain("global.gc");
  });
  
  test("security measures are implemented", async () => {
    const serverPath = join(import.meta.dir, "../src/optimized-server.ts");
    const serverContent = await Bun.file(serverPath).text();
    
    // Security headers
    expect(serverContent).toContain("X-Content-Type-Options");
    expect(serverContent).toContain("X-Frame-Options");
    expect(serverContent).toContain("X-XSS-Protection");
    expect(serverContent).toContain("Referrer-Policy");
    
    // Path traversal prevention
    expect(serverContent).toContain("resolve(");
    expect(serverContent).toContain("startsWith");
    expect(serverContent).toContain("Forbidden");
    
    // Input validation
    expect(serverContent).toContain("decodeURIComponent");
    expect(serverContent).toContain("parseInt(");
    
    // Rate limiting framework (even if disabled by default)
    expect(serverContent).toContain("RateLimiter");
    expect(serverContent).toContain("isAllowed");
  });
  
  test("error handling is comprehensive", async () => {
    const serverPath = join(import.meta.dir, "../src/optimized-server.ts");
    const serverContent = await Bun.file(serverPath).text();
    
    // Global error handlers
    expect(serverContent).toContain("uncaughtException");
    expect(serverContent).toContain("unhandledRejection");
    
    // HTTP error responses
    expect(serverContent).toContain("status: 404");
    expect(serverContent).toContain("status: 403");
    expect(serverContent).toContain("status: 500");
    expect(serverContent).toContain("status: 400");
    
    // Graceful shutdown
    expect(serverContent).toContain("SIGINT");
    expect(serverContent).toContain("SIGTERM");
    expect(serverContent).toContain("process.exit");
  });
  
  test("monitoring and observability features exist", async () => {
    const serverPath = join(import.meta.dir, "../src/optimized-server.ts");
    const serverContent = await Bun.file(serverPath).text();
    
    // Health endpoints
    expect(serverContent).toContain("api/health");
    expect(serverContent).toContain("api/stats");
    
    // Metrics collection
    expect(serverContent).toContain("hits");
    expect(serverContent).toContain("misses");
    expect(serverContent).toContain("hitRate");
    expect(serverContent).toContain("uptime");
    expect(serverContent).toContain("memoryUsage");
    
    // WebSocket for real-time monitoring
    expect(serverContent).toContain("WebSocket");
    expect(serverContent).toContain("websocket:");
  });
});

describe("Manga Server - Code Quality Metrics", () => {
  test("server file size is reasonable", async () => {
    const serverPath = join(import.meta.dir, "../src/optimized-server.ts");
    const serverFile = Bun.file(serverPath);
    const fileSize = serverFile.size;
    
    // Should be substantial but not excessively large
    expect(fileSize).toBeGreaterThan(10000); // At least 10KB
    expect(fileSize).toBeLessThan(200000); // Less than 200KB
  });
  
  test("code complexity indicators", async () => {
    const serverPath = join(import.meta.dir, "../src/optimized-server.ts");
    const serverContent = await Bun.file(serverPath).text();
    
    // Count classes (should have multiple well-defined classes)
    const classCount = (serverContent.match(/class \w+/g) || []).length;
    expect(classCount).toBeGreaterThan(5);
    expect(classCount).toBeLessThan(20); // Not overly complex
    
    // Count interfaces (should have proper typing)
    const interfaceCount = (serverContent.match(/interface \w+/g) || []).length;
    expect(interfaceCount).toBeGreaterThan(3);
    
    // Should have reasonable method count
    const methodCount = (serverContent.match(/\s+async \w+\(/g) || []).length;
    expect(methodCount).toBeGreaterThan(10);
  });
  
  test("documentation and comments quality", async () => {
    const serverPath = join(import.meta.dir, "../src/optimized-server.ts");
    const serverContent = await Bun.file(serverPath).text();
    
    // Should have file header documentation
    expect(serverContent).toContain("/**");
    expect(serverContent).toContain("* High-Performance Manga");
    expect(serverContent).toContain("@version");
    expect(serverContent).toContain("@license");
    
    // Should have section separators
    const sectionCount = (serverContent.match(/\/\/ ===+/g) || []).length;
    expect(sectionCount).toBeGreaterThan(5); // Well organized sections
    
    // Should have inline comments for complex logic
    expect(serverContent).toContain("// ");
  });
});

describe("Manga Server - Configuration Validation", () => {
  test("environment variables have proper defaults", async () => {
    const serverPath = join(import.meta.dir, "../src/optimized-server.ts");
    const serverContent = await Bun.file(serverPath).text();
    
    // Check default values - Updated for actual server format
    expect(serverContent).toContain('process.env.PORT || "80"');
    expect(serverContent).toContain('process.env.NODE_ENV === "test" ? "localhost" : "0.0.0.0"');
    expect(serverContent).toContain('process.env.CACHE_SIZE_MB || "8192"');
    expect(serverContent).toContain('process.env.MAX_CONNECTIONS || "100000"');
  });
  
  test("package.json scripts are comprehensive", async () => {
    const packagePath = join(import.meta.dir, "../../package.json");
    const packageContent = await Bun.file(packagePath).text();
    const packageJson = JSON.parse(packageContent);
    
    const requiredScripts = [
      "start", "dev", "server", "test", "health", "stats", 
      "monitor", "benchmark", "setup", "genshelf", "genreader"
    ];
    
    requiredScripts.forEach(script => {
      expect(packageJson.scripts).toHaveProperty(script);
    });
    
    // Should have proper metadata
    expect(packageJson.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(packageJson.engines).toHaveProperty("bun");
    expect(packageJson.keywords).toContain("manga");
  });
});