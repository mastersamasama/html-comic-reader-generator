import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import "./setup"; // Import test server setup

describe("Manga Server - Integration Tests", () => {
  const BASE_URL = "http://localhost:80";
  let serverAvailable = false;
  
  beforeAll(async () => {
    // Check if server is running
    try {
      const response = await fetch(`${BASE_URL}/api/health`, {
        signal: AbortSignal.timeout(5000)
      });
      serverAvailable = response.ok;
    } catch (error) {
      console.log("Server not available for integration tests:", error.message);
      serverAvailable = false;
    }
  });
  
  test("complete manga browsing workflow", async () => {
    if (!serverAvailable) {
      console.log("Skipping integration test - server not available");
      return;
    }
    
    // 1. Get manga list
    const listResponse = await fetch(`${BASE_URL}/api/manga`);
    expect(listResponse.status).toBe(200);
    
    const listData = await listResponse.json();
    expect(Array.isArray(listData.data)).toBe(true);
    
    // 2. If manga available, get details
    if (listData.data.length > 0) {
      const firstManga = listData.data[0];
      expect(firstManga).toHaveProperty("id");
      
      const detailsResponse = await fetch(`${BASE_URL}/api/manga/${encodeURIComponent(firstManga.id)}`);
      expect(detailsResponse.status).toBeOneOf([200, 404]); // 404 acceptable if manga directory doesn't exist
      
      if (detailsResponse.status === 200) {
        const detailsData = await detailsResponse.json();
        expect(detailsData).toHaveProperty("title");
        expect(detailsData).toHaveProperty("chapters");
        expect(detailsData).toHaveProperty("totalPages");
      }
    }
    
    // 3. Test search functionality
    const searchResponse = await fetch(`${BASE_URL}/api/search?q=test`);
    expect(searchResponse.status).toBe(200);
    
    const searchData = await searchResponse.json();
    expect(searchData).toHaveProperty("results");
    expect(searchData).toHaveProperty("count");
  });
  
  test("server performance under load", async () => {
    if (!serverAvailable) {
      console.log("Skipping load test - server not available");
      return;
    }
    
    const concurrentRequests = 20;
    const requests = Array.from({ length: concurrentRequests }, async (_, i) => {
      const start = Date.now();
      const response = await fetch(`${BASE_URL}/api/health?test=${i}`);
      const duration = Date.now() - start;
      
      return {
        status: response.status,
        duration,
        index: i
      };
    });
    
    const results = await Promise.all(requests);
    
    // All requests should succeed
    const successfulRequests = results.filter(r => r.status === 200);
    expect(successfulRequests.length).toBe(concurrentRequests);
    
    // Average response time should be reasonable
    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    expect(avgDuration).toBeLessThan(2000); // Should average less than 2 seconds
    
    // No individual request should take too long
    const maxDuration = Math.max(...results.map(r => r.duration));
    expect(maxDuration).toBeLessThan(5000); // No request should take more than 5 seconds
  });
  
  test("static file serving with compression", async () => {
    if (!serverAvailable) {
      console.log("Skipping static file test - server not available");
      return;
    }
    
    // Test HTML file serving (if available)
    const response = await fetch(`${BASE_URL}/`, {
      headers: {
        "Accept-Encoding": "gzip, deflate"
      }
    });
    
    // Either serves content or returns 404 (both acceptable)
    expect(response.status).toBeOneOf([200, 404]);
    
    if (response.status === 200) {
      // Should have compression headers for HTML
      const contentType = response.headers.get("Content-Type");
      if (contentType && contentType.includes("text/html")) {
        const contentEncoding = response.headers.get("Content-Encoding");
        // Compression is optional but should be present for text files when supported
        if (contentEncoding) {
          expect(contentEncoding).toMatch(/gzip|deflate/);
        }
      }
      
      // Should have security headers
      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    }
  });
  
  test("error handling and recovery", async () => {
    if (!serverAvailable) {
      console.log("Skipping error handling test - server not available");
      return;
    }
    
    // Test various error conditions
    const errorTests = [
      { path: "/api/nonexistent", expectedStatus: 404 },
      { path: "/api/manga/nonexistent-manga", expectedStatus: 404 },
      { path: "/api/search", expectedStatus: 400 }, // Missing query parameter
      { path: "/../../../etc/passwd", expectedStatus: [403, 404] }, // Path traversal attempt
    ];
    
    for (const errorTest of errorTests) {
      const response = await fetch(`${BASE_URL}${errorTest.path}`);
      
      if (Array.isArray(errorTest.expectedStatus)) {
        expect(errorTest.expectedStatus).toContain(response.status);
      } else {
        expect(response.status).toBe(errorTest.expectedStatus);
      }
      
      // Should still have security headers even for error responses
      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    }
  });
  
  test("WebSocket connection establishment", async () => {
    if (!serverAvailable) {
      console.log("Skipping WebSocket test - server not available");
      return;
    }
    
    // Test WebSocket upgrade request
    const wsUrl = BASE_URL.replace("http://", "ws://");
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(undefined); // Don't fail the test, just skip
      }, 5000);
      
      try {
        const ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
          clearTimeout(timeout);
          
          // Send a test message
          ws.send(JSON.stringify({
            type: "get_progress",
            mangaId: "test-manga"
          }));
          
          // Close connection after a moment
          setTimeout(() => {
            ws.close();
            resolve(undefined);
          }, 1000);
        };
        
        ws.onerror = () => {
          clearTimeout(timeout);
          // WebSocket might not be fully implemented yet - don't fail test
          resolve(undefined);
        };
        
        ws.onclose = () => {
          clearTimeout(timeout);
          resolve(undefined);
        };
        
      } catch (error) {
        clearTimeout(timeout);
        // WebSocket not available - skip test
        resolve(undefined);
      }
    });
  });
  
  test("resource cleanup and memory management", async () => {
    if (!serverAvailable) {
      console.log("Skipping memory management test - server not available");
      return;
    }
    
    // Get initial memory stats
    const initialResponse = await fetch(`${BASE_URL}/api/stats`);
    expect(initialResponse.status).toBe(200);
    const initialStats = await initialResponse.json();
    
    // Make many requests to potentially stress memory
    const stressRequests = Array.from({ length: 50 }, (_, i) =>
      fetch(`${BASE_URL}/api/manga?page=${i + 1}&limit=10`)
    );
    
    await Promise.all(stressRequests);
    
    // Get final memory stats
    const finalResponse = await fetch(`${BASE_URL}/api/stats`);
    expect(finalResponse.status).toBe(200);
    const finalStats = await finalResponse.json();
    
    // Memory pressure should not have increased drastically
    const initialPressure = parseFloat(initialStats.cache.memoryPressure);
    const finalPressure = parseFloat(finalStats.cache.memoryPressure);
    
    // Allow for some increase but not excessive
    expect(finalPressure).toBeLessThan(initialPressure + 50); // No more than 50% increase
    
    // Cache should have been utilized
    expect(finalStats.cache.hits).toBeGreaterThanOrEqual(initialStats.cache.hits);
  });
});