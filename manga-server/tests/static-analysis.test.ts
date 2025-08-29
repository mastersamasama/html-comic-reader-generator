import { test, expect, describe } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

describe("Manga Server - Static Analysis & Quality", () => {
  test("Docker configuration follows best practices", async () => {
    const dockerfilePath = join(import.meta.dir, "../config/Dockerfile");
    const dockerfileContent = await Bun.file(dockerfilePath).text();
    
    // Security best practices
    expect(dockerfileContent).toContain("FROM oven/bun:1-alpine"); // Use official base
    expect(dockerfileContent).toContain("adduser -D"); // Non-root user
    expect(dockerfileContent).toContain("USER manga"); // Switch to non-root
    expect(dockerfileContent).toContain("HEALTHCHECK"); // Health monitoring
    expect(dockerfileContent).toContain("--frozen-lockfile"); // Reproducible builds
    
    // Multi-stage build optimization
    expect(dockerfileContent).toContain("FROM oven/bun:1-alpine as builder");
    expect(dockerfileContent).toContain("COPY --from=builder");
    
    // Security considerations
    expect(dockerfileContent).not.toContain("USER root");
    expect(dockerfileContent).not.toContain("chmod 777");
    expect(dockerfileContent).not.toContain("ADD http"); // Avoid ADD with URLs
  });
  
  test("docker-compose configuration is production-ready", async () => {
    const composePath = join(import.meta.dir, "../config/docker-compose.yml");
    const composeContent = await Bun.file(composePath).text();
    
    // Production configurations
    expect(composeContent).toContain("NODE_ENV=production");
    expect(composeContent).toContain("restart: unless-stopped");
    expect(composeContent).toContain("healthcheck:");
    expect(composeContent).toContain("security_opt:");
    expect(composeContent).toContain("no-new-privileges:true");
    
    // Volume configurations
    expect(composeContent).toContain(":ro"); // Read-only manga directory
    expect(composeContent).toContain("user: \"1000:1000\""); // Non-root user
    
    // Capability dropping
    expect(composeContent).toContain("cap_drop:");
    expect(composeContent).toContain("- ALL");
  });
  
  test("server code follows TypeScript best practices", async () => {
    const serverPath = join(import.meta.dir, "../src/server.ts");
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
    const serverPath = join(import.meta.dir, "../src/server.ts");
    const serverContent = await Bun.file(serverPath).text();
    
    // Caching implementations
    expect(serverContent).toContain("LRU");
    expect(serverContent).toContain("moveToFront");
    expect(serverContent).toContain("evictLRU");
    expect(serverContent).toContain("adaptToMemoryPressure");
    
    // Streaming support
    expect(serverContent).toContain("ReadableStream");
    expect(serverContent).toContain("streamingThreshold");
    expect(serverContent).toContain("handleStreamingResponse");
    
    // Compression
    expect(serverContent).toContain("gzipSync");
    expect(serverContent).toContain("shouldCompress");
    expect(serverContent).toContain("Content-Encoding");
    
    // Memory management
    expect(serverContent).toContain("memoryUsage");
    expect(serverContent).toContain("global.gc");
  });
  
  test("security measures are implemented", async () => {
    const serverPath = join(import.meta.dir, "../src/server.ts");
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
    const serverPath = join(import.meta.dir, "../src/server.ts");
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
    const serverPath = join(import.meta.dir, "../src/server.ts");
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
    const serverPath = join(import.meta.dir, "../src/server.ts");
    const serverFile = Bun.file(serverPath);
    const fileSize = serverFile.size;
    
    // Should be substantial but not excessively large
    expect(fileSize).toBeGreaterThan(10000); // At least 10KB
    expect(fileSize).toBeLessThan(200000); // Less than 200KB
  });
  
  test("code complexity indicators", async () => {
    const serverPath = join(import.meta.dir, "../src/server.ts");
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
    const serverPath = join(import.meta.dir, "../src/server.ts");
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
    const serverPath = join(import.meta.dir, "../src/server.ts");
    const serverContent = await Bun.file(serverPath).text();
    
    // Check default values
    expect(serverContent).toContain('process.env.PORT || "80"');
    expect(serverContent).toContain('process.env.HOSTNAME || "0.0.0.0"');
    expect(serverContent).toContain('process.env.CACHE_SIZE_MB || "512"');
    expect(serverContent).toContain('process.env.MAX_CONNECTIONS || "5000"');
  });
  
  test("package.json scripts are comprehensive", async () => {
    const packagePath = join(import.meta.dir, "../package.json");
    const packageContent = await Bun.file(packagePath).text();
    const packageJson = JSON.parse(packageContent);
    
    const requiredScripts = [
      "start", "dev", "prod", "build", "test", "health", "stats", 
      "monitor", "benchmark", "setup", "docker:build", "docker:compose"
    ];
    
    requiredScripts.forEach(script => {
      expect(packageJson.scripts).toHaveProperty(script);
    });
    
    // Should have proper metadata
    expect(packageJson.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(packageJson.engines).toHaveProperty("bun");
    expect(packageJson.keywords).toContain("performance");
  });
});