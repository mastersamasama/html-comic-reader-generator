#!/usr/bin/env bun

/**
 * Benchmark script for Manga Server
 * Tests performance under various load conditions
 */

interface BenchmarkResult {
  test: string;
  duration: number;
  requests: number;
  requestsPerSecond: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  errors: number;
  success: boolean;
}

class ServerBenchmark {
  private baseUrl: string;
  private concurrency: number;
  
  constructor(baseUrl = 'http://localhost:80', concurrency = 10) {
    this.baseUrl = baseUrl;
    this.concurrency = concurrency;
  }
  
  async runAllBenchmarks(): Promise<BenchmarkResult[]> {
    console.log('🏁 Starting Manga Server Benchmarks\n');
    
    const results: BenchmarkResult[] = [];
    
    // Test server availability first
    if (!await this.checkServerAvailable()) {
      console.error('❌ Server not available at', this.baseUrl);
      process.exit(1);
    }
    
    console.log(`📊 Running benchmarks with ${this.concurrency} concurrent connections\n`);
    
    // API Endpoint Benchmarks
    results.push(await this.benchmarkEndpoint('Health Check', '/api/health', 100));
    results.push(await this.benchmarkEndpoint('Stats API', '/api/stats', 50));
    results.push(await this.benchmarkEndpoint('Manga List API', '/api/manga?limit=20', 50));
    results.push(await this.benchmarkEndpoint('Search API', '/api/search?q=test', 30));
    
    // Static File Benchmarks (if sample files exist)
    results.push(await this.benchmarkStaticFile('Small Static File', '/favicon.ico', 100));
    results.push(await this.benchmarkStaticFile('HTML File', '/index.html', 50));
    
    // Cache Performance Test
    results.push(await this.benchmarkCachePerformance());
    
    // Stress Test
    results.push(await this.benchmarkStressTest());
    
    return results;
  }
  
  private async checkServerAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`, {
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }
  
  private async benchmarkEndpoint(name: string, path: string, requests: number): Promise<BenchmarkResult> {
    console.log(`🧪 Testing: ${name}`);
    
    const url = `${this.baseUrl}${path}`;
    const responseTimes: number[] = [];
    let errors = 0;
    
    const startTime = Date.now();
    
    // Create batches for concurrent execution
    const batches = [];
    const batchSize = Math.ceil(requests / this.concurrency);
    
    for (let i = 0; i < requests; i += batchSize) {
      const batchRequests = [];
      const batchEnd = Math.min(i + batchSize, requests);
      
      for (let j = i; j < batchEnd; j++) {
        batchRequests.push(this.makeRequest(url));
      }
      
      batches.push(Promise.all(batchRequests));
    }
    
    // Execute all batches
    const batchResults = await Promise.all(batches);
    
    // Collect results
    for (const batchResult of batchResults) {
      for (const result of batchResult) {
        if (result.error) {
          errors++;
        } else {
          responseTimes.push(result.responseTime);
        }
      }
    }
    
    const duration = Date.now() - startTime;
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;
    
    const result: BenchmarkResult = {
      test: name,
      duration,
      requests,
      requestsPerSecond: (requests - errors) / (duration / 1000),
      avgResponseTime,
      minResponseTime: Math.min(...responseTimes, 0),
      maxResponseTime: Math.max(...responseTimes, 0),
      errors,
      success: errors === 0
    };
    
    this.displayResult(result);
    return result;
  }
  
  private async benchmarkStaticFile(name: string, path: string, requests: number): Promise<BenchmarkResult> {
    // Similar to benchmarkEndpoint but for static files
    return this.benchmarkEndpoint(name, path, requests);
  }
  
  private async benchmarkCachePerformance(): Promise<BenchmarkResult> {
    console.log('🧪 Testing: Cache Performance');
    
    const path = '/api/stats';
    const requests = 100;
    const responseTimes: number[] = [];
    let errors = 0;
    
    const startTime = Date.now();
    
    // First request to populate cache
    await this.makeRequest(`${this.baseUrl}${path}`);
    
    // Test cached responses
    const promises = [];
    for (let i = 0; i < requests; i++) {
      promises.push(this.makeRequest(`${this.baseUrl}${path}`));
    }
    
    const results = await Promise.all(promises);
    
    for (const result of results) {
      if (result.error) {
        errors++;
      } else {
        responseTimes.push(result.responseTime);
      }
    }
    
    const duration = Date.now() - startTime;
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;
    
    const result: BenchmarkResult = {
      test: 'Cache Performance',
      duration,
      requests,
      requestsPerSecond: (requests - errors) / (duration / 1000),
      avgResponseTime,
      minResponseTime: Math.min(...responseTimes, 0),
      maxResponseTime: Math.max(...responseTimes, 0),
      errors,
      success: errors === 0 && avgResponseTime < 50 // Cache should be very fast
    };
    
    this.displayResult(result);
    return result;
  }
  
  private async benchmarkStressTest(): Promise<BenchmarkResult> {
    console.log('🧪 Testing: Stress Test (High Concurrency)');
    
    const path = '/api/health';
    const requests = 500;
    const highConcurrency = 50;
    const responseTimes: number[] = [];
    let errors = 0;
    
    const startTime = Date.now();
    
    // Create high-concurrency batches
    const batches = [];
    const batchSize = Math.ceil(requests / highConcurrency);
    
    for (let i = 0; i < requests; i += batchSize) {
      const batchRequests = [];
      const batchEnd = Math.min(i + batchSize, requests);
      
      for (let j = i; j < batchEnd; j++) {
        batchRequests.push(this.makeRequest(`${this.baseUrl}${path}`));
      }
      
      batches.push(Promise.all(batchRequests));
    }
    
    const batchResults = await Promise.all(batches);
    
    for (const batchResult of batchResults) {
      for (const result of batchResult) {
        if (result.error) {
          errors++;
        } else {
          responseTimes.push(result.responseTime);
        }
      }
    }
    
    const duration = Date.now() - startTime;
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;
    
    const result: BenchmarkResult = {
      test: 'Stress Test',
      duration,
      requests,
      requestsPerSecond: (requests - errors) / (duration / 1000),
      avgResponseTime,
      minResponseTime: Math.min(...responseTimes, 0),
      maxResponseTime: Math.max(...responseTimes, 0),
      errors,
      success: errors < requests * 0.05 // Less than 5% error rate
    };
    
    this.displayResult(result);
    return result;
  }
  
  private async makeRequest(url: string): Promise<{ responseTime: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10000)
      });
      
      const responseTime = Date.now() - startTime;
      
      if (!response.ok) {
        return { responseTime, error: `HTTP ${response.status}` };
      }
      
      // Read response to ensure full request completion
      await response.text();
      
      return { responseTime };
      
    } catch (error) {
      return { responseTime: Date.now() - startTime, error: error.message };
    }
  }
  
  private displayResult(result: BenchmarkResult) {
    const status = result.success ? '✅' : '❌';
    const errorRate = ((result.errors / result.requests) * 100).toFixed(1);
    
    console.log(`   ${status} ${result.test}`);
    console.log(`      Requests: ${result.requests.toLocaleString()}`);
    console.log(`      Duration: ${result.duration}ms`);
    console.log(`      RPS: ${result.requestsPerSecond.toFixed(2)}`);
    console.log(`      Avg Response: ${result.avgResponseTime.toFixed(2)}ms`);
    console.log(`      Min/Max: ${result.minResponseTime}/${result.maxResponseTime}ms`);
    console.log(`      Errors: ${result.errors} (${errorRate}%)`);
    console.log('');
  }
  
  displaySummary(results: BenchmarkResult[]) {
    console.log('📋 Benchmark Summary\n');
    
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;
    
    console.log(`Total Tests: ${results.length}`);
    console.log(`Successful: ${successful}`);
    console.log(`Failed: ${failed}\n`);
    
    if (failed > 0) {
      console.log('❌ Failed Tests:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`   ${r.test}: ${r.errors} errors, ${r.avgResponseTime.toFixed(2)}ms avg`);
      });
      console.log('');
    }
    
    // Performance ratings
    console.log('🏆 Performance Ratings:');
    results.forEach(r => {
      let rating = 'Poor';
      if (r.requestsPerSecond > 1000) rating = 'Excellent';
      else if (r.requestsPerSecond > 500) rating = 'Good';
      else if (r.requestsPerSecond > 100) rating = 'Fair';
      
      console.log(`   ${r.test}: ${rating} (${r.requestsPerSecond.toFixed(0)} RPS)`);
    });
    
    console.log('');
    
    // Overall assessment
    const overallRPS = results.reduce((sum, r) => sum + r.requestsPerSecond, 0) / results.length;
    const overallAvgResponse = results.reduce((sum, r) => sum + r.avgResponseTime, 0) / results.length;
    
    console.log('🎯 Overall Performance:');
    console.log(`   Average RPS: ${overallRPS.toFixed(2)}`);
    console.log(`   Average Response Time: ${overallAvgResponse.toFixed(2)}ms`);
    console.log(`   Success Rate: ${(successful / results.length * 100).toFixed(1)}%`);
    
    return failed === 0;
  }
}

// CLI execution
async function main() {
  const args = process.argv.slice(2);
  const baseUrl = args.find(arg => arg.startsWith('http')) || 'http://localhost:80';
  const concurrency = parseInt(args.find(arg => arg.startsWith('--concurrency='))?.split('=')[1] || '10');
  
  const benchmark = new ServerBenchmark(baseUrl, concurrency);
  
  try {
    const results = await benchmark.runAllBenchmarks();
    const success = benchmark.displaySummary(results);
    
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}

export { ServerBenchmark };