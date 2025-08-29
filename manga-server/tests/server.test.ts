import { test, expect, describe } from "bun:test";
import "./setup"; // Import test server setup

describe("Manga Server - Core Functionality", () => {
  const BASE_URL = "http://localhost:80";
  
  test("server should be running and respond to health checks", async () => {
    const response = await fetch(`${BASE_URL}/api/health`);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty("status");
    expect(data.status).toBe("healthy");
  });
  
  test("should serve static files with proper headers", async () => {
    const response = await fetch(`${BASE_URL}/`);
    expect(response.status).toBeOneOf([200, 404]); // 404 is acceptable if no index.html
    
    // Check security headers
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("X-XSS-Protection")).toBe("1; mode=block");
  });
  
  test("CORS headers should be present", async () => {
    const response = await fetch(`${BASE_URL}/api/health`);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("GET");
  });
  
  test("OPTIONS preflight requests should work", async () => {
    const response = await fetch(`${BASE_URL}/api/health`, {
      method: "OPTIONS"
    });
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

describe("Manga Server - API Endpoints", () => {
  const BASE_URL = "http://localhost:80";
  
  test("manga list API should return proper structure", async () => {
    const response = await fetch(`${BASE_URL}/api/manga`);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty("data");
    expect(data).toHaveProperty("meta");
    expect(Array.isArray(data.data)).toBe(true);
    
    // Check meta structure
    expect(data.meta).toHaveProperty("page");
    expect(data.meta).toHaveProperty("limit");
    expect(data.meta).toHaveProperty("total");
    expect(data.meta).toHaveProperty("totalPages");
  });
  
  test("pagination should work correctly", async () => {
    const response1 = await fetch(`${BASE_URL}/api/manga?page=1&limit=5`);
    const response2 = await fetch(`${BASE_URL}/api/manga?page=2&limit=5`);
    
    expect(response1.status).toBe(200);
    expect(response2.status).toBe(200);
    
    const data1 = await response1.json();
    const data2 = await response2.json();
    
    expect(data1.meta.page).toBe(1);
    expect(data2.meta.page).toBe(2);
    expect(data1.data.length).toBeLessThanOrEqual(5);
    expect(data2.data.length).toBeLessThanOrEqual(5);
  });
  
  test("search API should work", async () => {
    const response = await fetch(`${BASE_URL}/api/search?q=test`);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty("results");
    expect(data).toHaveProperty("count");
    expect(Array.isArray(data.results)).toBe(true);
    expect(typeof data.count).toBe("number");
  });
  
  test("search API should require query parameter", async () => {
    const response = await fetch(`${BASE_URL}/api/search`);
    expect(response.status).toBe(400);
    
    const data = await response.json();
    expect(data).toHaveProperty("error");
  });
  
  test("stats API should return performance metrics", async () => {
    const response = await fetch(`${BASE_URL}/api/stats`);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty("cache");
    expect(data).toHaveProperty("server");
    
    // Check cache stats structure
    expect(data.cache).toHaveProperty("size");
    expect(data.cache).toHaveProperty("hits");
    expect(data.cache).toHaveProperty("misses");
    expect(data.cache).toHaveProperty("hitRate");
    
    // Check server stats structure  
    expect(data.server).toHaveProperty("uptime");
    expect(data.server).toHaveProperty("memory");
    expect(data.server).toHaveProperty("platform");
  });
  
  test("non-existent API endpoint should return 404", async () => {
    const response = await fetch(`${BASE_URL}/api/nonexistent`);
    expect(response.status).toBe(404);
    
    const data = await response.json();
    expect(data).toHaveProperty("error");
  });
});

describe("Manga Server - Performance", () => {
  const BASE_URL = "http://localhost:80";
  
  test("health endpoint should respond quickly", async () => {
    const start = Date.now();
    const response = await fetch(`${BASE_URL}/api/health`);
    const duration = Date.now() - start;
    
    expect(response.status).toBe(200);
    expect(duration).toBeLessThan(1000); // Should respond within 1 second
  });
  
  test("should handle multiple concurrent requests", async () => {
    const promises = Array.from({ length: 10 }, () =>
      fetch(`${BASE_URL}/api/health`)
    );
    
    const responses = await Promise.all(promises);
    
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });
  });
  
  test("cache headers should be present for static files", async () => {
    const response = await fetch(`${BASE_URL}/`);
    
    if (response.status === 200) {
      const cacheControl = response.headers.get("Cache-Control");
      const etag = response.headers.get("ETag");
      
      expect(cacheControl).toBeTruthy();
      // ETag should be present for cacheable responses
      if (cacheControl && !cacheControl.includes("no-cache")) {
        expect(etag).toBeTruthy();
      }
    }
  });
});

describe("Manga Server - Error Handling", () => {
  const BASE_URL = "http://localhost:80";
  
  test("should handle malformed requests gracefully", async () => {
    const response = await fetch(`${BASE_URL}/api/manga?limit=invalid`);
    expect(response.status).toBeOneOf([200, 400]); // Should either parse or reject gracefully
  });
  
  test("should prevent path traversal attacks", async () => {
    const maliciousPath = `${BASE_URL}/../../../etc/passwd`;
    const response = await fetch(maliciousPath);
    
    expect(response.status).toBeOneOf([403, 404]); // Should be forbidden or not found
  });
  
  test("should handle large request volumes", async () => {
    const requests = Array.from({ length: 50 }, () =>
      fetch(`${BASE_URL}/api/health`)
    );
    
    const responses = await Promise.all(requests);
    const successfulResponses = responses.filter(r => r.status === 200);
    
    // Should handle at least 80% of requests successfully
    expect(successfulResponses.length).toBeGreaterThan(40);
  });
});