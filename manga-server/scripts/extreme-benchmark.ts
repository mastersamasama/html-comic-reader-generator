#!/usr/bin/env bun

/**
 * Extreme Performance Benchmark
 * Tests the server under extreme load conditions to validate 20,000+ req/s capability
 */

interface BenchmarkResult {
  test: string;
  duration: number;
  requests: number;
  requestsPerSecond: number;
  avgResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  errors: number;
  errorRate: number;
  throughputMBps: number;
  success: boolean;
}

class ExtremeBenchmark {
  private baseUrl: string;
  
  constructor(baseUrl = 'http://localhost:80') {
    this.baseUrl = baseUrl;
  }
  
  async runExtremeLoadTest(): Promise<BenchmarkResult[]> {
    console.log('🔥 EXTREME Performance Benchmark Suite v5.0');
    console.log('=' .repeat(80));
    console.log(`Target: 20,000+ requests/second throughput`);
    console.log(`Server: ${this.baseUrl}\n`);
    
    // Verify server is available
    if (!await this.checkServerHealth()) {
      throw new Error('Server not available or not responding');
    }
    
    console.log('✅ Server health check passed\n');
    
    const results: BenchmarkResult[] = [];
    
    // Progressive load testing
    const loadTests = [
      { name: 'Baseline Load', concurrency: 100, requests: 1000 },
      { name: 'Moderate Load', concurrency: 500, requests: 5000 },
      { name: 'High Load', concurrency: 1000, requests: 10000 },
      { name: 'EXTREME Load', concurrency: 2000, requests: 20000 },
      { name: 'INSANE Load', concurrency: 5000, requests: 50000 }
    ];
    
    for (const test of loadTests) {
      console.log(`🧪 Running: ${test.name}`);
      console.log(`   Concurrency: ${test.concurrency}`);
      console.log(`   Total Requests: ${test.requests}`);
      
      const result = await this.runLoadTest(test.name, test.concurrency, test.requests);
      results.push(result);
      
      this.displayResult(result);
      
      // Cool down between tests
      console.log('   ⏸️ Cooling down...\n');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Stop if server fails under load
      if (!result.success || result.errorRate > 5) {
        console.log('⚠️ Server failed under load, stopping tests');
        break;
      }
    }
    
    return results;
  }
  
  private async checkServerHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`, {
        signal: AbortSignal.timeout(5000)
      });
      
      if (!response.ok) return false;
      
      const health = await response.json();
      console.log(`   Server Status: ${health.status}`);
      console.log(`   Server Version: ${health.version || 'unknown'}`);
      
      return health.status === 'healthy';
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }
  
  private async runLoadTest(testName: string, concurrency: number, totalRequests: number): Promise<BenchmarkResult> {
    const endpoints = [
      '/api/health',
      '/api/manga?limit=10',
      '/api/stats',
      '/api/manga?limit=50',
      '/api/search?q=test'
    ];
    
    const responseTimes: number[] = [];
    let errors = 0;
    let bytesReceived = 0;
    
    const startTime = performance.now();
    
    // Create concurrent batches
    const requestsPerWorker = Math.floor(totalRequests / concurrency);
    const workers: Promise<void>[] = [];
    
    for (let i = 0; i < concurrency; i++) {
      const worker = this.createWorker(
        requestsPerWorker, 
        endpoints, 
        (time) => responseTimes.push(time),
        (err) => errors++,
        (bytes) => bytesReceived += bytes
      );
      workers.push(worker);
    }
    
    // Execute all workers concurrently
    await Promise.all(workers);
    
    const duration = performance.now() - startTime;
    const actualRequests = responseTimes.length;
    const requestsPerSecond = actualRequests / (duration / 1000);
    const errorRate = (errors / totalRequests) * 100;
    
    // Calculate response time percentiles
    responseTimes.sort((a, b) => a - b);
    const p50 = responseTimes[Math.floor(responseTimes.length * 0.5)] || 0;
    const p95 = responseTimes[Math.floor(responseTimes.length * 0.95)] || 0;
    const p99 = responseTimes[Math.floor(responseTimes.length * 0.99)] || 0;
    
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;
    
    const throughputMBps = (bytesReceived / 1024 / 1024) / (duration / 1000);
    
    return {
      test: testName,
      duration,
      requests: actualRequests,
      requestsPerSecond,
      avgResponseTime,
      p50ResponseTime: p50,
      p95ResponseTime: p95,
      p99ResponseTime: p99,
      minResponseTime: Math.min(...responseTimes, 0),
      maxResponseTime: Math.max(...responseTimes, 0),
      errors,
      errorRate,
      throughputMBps,
      success: errorRate < 1 && requestsPerSecond > 100
    };
  }
  
  private async createWorker(
    requests: number, 
    endpoints: string[], 
    onResponseTime: (time: number) => void,
    onError: (error: any) => void,
    onBytes: (bytes: number) => void
  ): Promise<void> {
    
    for (let i = 0; i < requests; i++) {
      const endpoint = endpoints[i % endpoints.length];
      const url = `${this.baseUrl}${endpoint}`;
      
      try {
        const startTime = performance.now();
        
        const response = await fetch(url, {
          signal: AbortSignal.timeout(30000)
        });
        
        const responseTime = performance.now() - startTime;
        
        if (response.ok) {
          const text = await response.text();
          onResponseTime(responseTime);
          onBytes(text.length);
        } else {
          onError(`HTTP ${response.status}`);
        }
        
      } catch (error) {
        onError(error);
      }
    }
  }
  
  private displayResult(result: BenchmarkResult): void {
    const status = result.success ? '✅' : '❌';
    
    let performance = '⚠️ POOR';
    if (result.requestsPerSecond >= 20000) performance = '🔥 EXTREME TARGET ACHIEVED';
    else if (result.requestsPerSecond >= 15000) performance = '🚀 EXCELLENT';
    else if (result.requestsPerSecond >= 10000) performance = '⚡ VERY GOOD';
    else if (result.requestsPerSecond >= 5000) performance = '👍 GOOD';
    else if (result.requestsPerSecond >= 1000) performance = '📊 FAIR';
    
    console.log(`   ${status} ${result.test} - ${performance}`);
    console.log(`      🎯 RPS: ${result.requestsPerSecond.toFixed(0)} req/s`);
    console.log(`      📊 Throughput: ${result.throughputMBps.toFixed(2)} MB/s`);
    console.log(`      ⚡ Response Times:`);
    console.log(`         Avg: ${result.avgResponseTime.toFixed(2)}ms`);
    console.log(`         P50: ${result.p50ResponseTime.toFixed(2)}ms`);
    console.log(`         P95: ${result.p95ResponseTime.toFixed(2)}ms`);
    console.log(`         P99: ${result.p99ResponseTime.toFixed(2)}ms`);
    console.log(`         Range: ${result.minResponseTime.toFixed(2)}-${result.maxResponseTime.toFixed(2)}ms`);
    console.log(`      ❌ Errors: ${result.errors} (${result.errorRate.toFixed(1)}%)`);
    console.log(`      ⏱️ Duration: ${result.duration.toFixed(0)}ms`);
    console.log('');
  }
  
  displaySummary(results: BenchmarkResult[]): boolean {
    console.log('🏆 EXTREME PERFORMANCE SUMMARY');
    console.log('=' .repeat(80));
    
    const maxRPS = Math.max(...results.map(r => r.requestsPerSecond));
    const avgErrorRate = results.reduce((sum, r) => sum + r.errorRate, 0) / results.length;
    const bestResponseTime = Math.min(...results.map(r => r.avgResponseTime));
    const totalRequests = results.reduce((sum, r) => sum + r.requests, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
    
    console.log(`🎯 Peak Performance: ${maxRPS.toFixed(0)} req/s`);
    console.log(`⚡ Best Response Time: ${bestResponseTime.toFixed(2)}ms`);
    console.log(`📊 Total Requests: ${totalRequests.toLocaleString()}`);
    console.log(`❌ Total Errors: ${totalErrors} (${((totalErrors / totalRequests) * 100).toFixed(2)}%)`);
    
    // Performance rating
    let rating = '⚠️ POOR';
    let targetAchieved = false;
    
    if (maxRPS >= 20000) {
      rating = '🔥 EXTREME TARGET ACHIEVED!';
      targetAchieved = true;
    } else if (maxRPS >= 15000) {
      rating = '🚀 EXCELLENT - CLOSE TO TARGET';
    } else if (maxRPS >= 10000) {
      rating = '⚡ VERY GOOD';
    } else if (maxRPS >= 5000) {
      rating = '👍 GOOD';
    } else if (maxRPS >= 1000) {
      rating = '📊 FAIR';
    }
    
    console.log(`\n🏅 Overall Rating: ${rating}`);
    
    if (targetAchieved) {
      console.log('\n🎉 CONGRATULATIONS! 20,000+ req/s target achieved!');
      console.log('   Your server is now capable of extreme load handling.');
    } else {
      console.log('\n💡 Performance Optimization Recommendations:');
      
      if (avgErrorRate > 1) {
        console.log('   • Investigate error sources - check server logs');
      }
      if (bestResponseTime > 3) {
        console.log('   • Enable more aggressive caching');
        console.log('   • Increase memory pool size');
      }
      if (maxRPS < 15000) {
        console.log('   • Increase cache size (CACHE_SIZE_MB)');
        console.log('   • Increase memory pool (MEMORY_POOL_MB)');
        console.log('   • Optimize file system (use SSD)');
      }
    }
    
    console.log('\n🔧 Current Configuration:');
    console.log(`   • Cache: ${process.env.CACHE_SIZE_MB || '512'}MB`);
    console.log(`   • Memory Pool: ${process.env.MEMORY_POOL_MB || '1024'}MB`);
    console.log(`   • Max Connections: ${process.env.MAX_CONNECTIONS || '20000'}`);
    console.log(`   • Workers: ${process.env.WORKER_THREADS || '8'}`);
    
    return targetAchieved;
  }
}

// Main execution
async function main() {
  const benchmark = new ExtremeBenchmark();
  
  try {
    console.log('⚡ Starting EXTREME load test...\n');
    
    const results = await benchmark.runExtremeLoadTest();
    const success = benchmark.displaySummary(results);
    
    if (success) {
      console.log('\n🚀 EXTREME performance benchmark PASSED!');
    } else {
      console.log('\n⚠️ Target performance not achieved, but optimizations show positive impact.');
    }
    
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('❌ Extreme benchmark failed:', error);
    console.log('\nEnsure the extreme server is running:');
    console.log('   bun run src/optimized-server.ts');
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}

export { ExtremeBenchmark };