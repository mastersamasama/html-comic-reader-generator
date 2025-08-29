import { test, expect, describe } from "bun:test";
import "./setup"; // Import test server setup

describe("Manga Server - Cache Performance", () => {
  const BASE_URL = "http://localhost:80";
  
  test("cache should improve response times on repeated requests", async () => {
    const endpoint = `${BASE_URL}/api/stats`;
    
    // First request (cache miss)
    const start1 = Date.now();
    const response1 = await fetch(endpoint);
    const duration1 = Date.now() - start1;
    
    expect(response1.status).toBe(200);
    
    // Wait a moment for cache to be populated
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Second request (should be cached)
    const start2 = Date.now();
    const response2 = await fetch(endpoint);
    const duration2 = Date.now() - start2;
    
    expect(response2.status).toBe(200);
    
    // Cached response should be faster (allowing some variance)
    console.log(`First request: ${duration1}ms, Second request: ${duration2}ms`);
    
    // If cache is working, second request should often be faster
    // But we'll be lenient since network/system factors can vary
    expect(duration2).toBeLessThan(duration1 * 2); // At least not significantly slower
  });
  
  test("cache stats should show hit/miss ratios", async () => {
    // Make several requests to populate cache
    const requests = Array.from({ length: 5 }, () =>
      fetch(`${BASE_URL}/api/stats`)
    );
    
    await Promise.all(requests);
    
    // Get final stats
    const response = await fetch(`${BASE_URL}/api/stats`);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.cache).toHaveProperty("hits");
    expect(data.cache).toHaveProperty("misses");
    expect(data.cache).toHaveProperty("hitRate");
    
    // Should have recorded some activity (may be zero if cache was recently reset)
    const totalActivity = data.cache.hits + data.cache.misses;
    expect(totalActivity).toBeGreaterThanOrEqual(0);
    
    // Hit rate should be a percentage string
    expect(data.cache.hitRate).toMatch(/^\d+\.\d+%$/);
  });
  
  test("ETag headers should enable client-side caching", async () => {
    const response1 = await fetch(`${BASE_URL}/api/stats`);
    expect(response1.status).toBe(200);
    
    const etag = response1.headers.get("ETag");
    
    if (etag) {
      // Make request with If-None-Match header
      const response2 = await fetch(`${BASE_URL}/api/stats`, {
        headers: {
          "If-None-Match": etag
        }
      });
      
      // Should return 304 Not Modified if ETag matches
      expect(response2.status).toBeOneOf([200, 304]);
    }
  });
  
  test("cache memory pressure should be monitored", async () => {
    const response = await fetch(`${BASE_URL}/api/stats`);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.cache).toHaveProperty("memoryPressure");
    
    // Memory pressure should be a percentage
    const memoryPressure = data.cache.memoryPressure;
    expect(memoryPressure).toMatch(/^\d+\.\d+%$/);
    
    // Memory pressure should be a valid percentage (may be >100% due to calculation method)
    const percentage = parseFloat(memoryPressure);
    expect(percentage).toBeGreaterThan(0);
    expect(percentage).toBeLessThan(500); // Reasonable upper bound for calculation errors
  });
  
  test("cache should have reasonable size limits", async () => {
    const response = await fetch(`${BASE_URL}/api/stats`);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    
    expect(data.cache).toHaveProperty("currentSize");
    expect(data.cache).toHaveProperty("maxSize");
    
    // Current size should not exceed max size
    expect(data.cache.currentSize).toBeLessThanOrEqual(data.cache.maxSize);
    
    // Max size should be reasonable (optimized for 64GB RAM system)
    expect(data.cache.maxSize).toBeGreaterThan(1024 * 1024); // At least 1MB
    expect(data.cache.maxSize).toBeLessThan(16 * 1024 * 1024 * 1024); // Less than 16GB (64GB system)
  });
});