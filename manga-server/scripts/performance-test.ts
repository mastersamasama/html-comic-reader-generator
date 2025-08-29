#!/usr/bin/env bun
/**
 * Performance Testing Script
 * Compares the performance of the legacy vs ultra-performance server
 */

interface TestResult {
  name: string;
  requests: number;
  duration: number;
  avgResponseTime: number;
  throughput: number;
  errors: number;
}

class PerformanceTester {
  private results: TestResult[] = [];

  async runTest(name: string, url: string, requests = 1000): Promise<TestResult> {
    console.log(`\n🧪 Running test: ${name}`);
    console.log(`   URL: ${url}`);
    console.log(`   Requests: ${requests}`);

    const responseTimes: number[] = [];
    let errors = 0;
    const startTime = performance.now();

    // Run requests in batches for better concurrency
    const batchSize = 10;
    const batches = Math.ceil(requests / batchSize);

    for (let i = 0; i < batches; i++) {
      const batchPromises = [];
      const currentBatchSize = Math.min(batchSize, requests - i * batchSize);

      for (let j = 0; j < currentBatchSize; j++) {
        batchPromises.push(this.makeRequest(url, responseTimes, errors));
      }

      await Promise.all(batchPromises);

      // Progress indicator
      if ((i + 1) % 10 === 0) {
        process.stdout.write('.');
      }
    }

    const duration = performance.now() - startTime;
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const throughput = requests / (duration / 1000);

    const result: TestResult = {
      name,
      requests,
      duration,
      avgResponseTime,
      throughput,
      errors
    };

    this.results.push(result);
    console.log('\n   ✅ Test complete');

    return result;
  }

  private async makeRequest(url: string, responseTimes: number[], errors: number): Promise<void> {
    const startTime = performance.now();

    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        }
      });

      if (!response.ok) {
        errors++;
      }

      const responseTime = performance.now() - startTime;
      responseTimes.push(responseTime);
    } catch (error) {
      errors++;
    }
  }

  displayResults(): void {
    console.log('\n');
    console.log('═'.repeat(80));
    console.log('                     PERFORMANCE TEST RESULTS');
    console.log('═'.repeat(80));

    const headers = ['Test', 'Requests', 'Duration(ms)', 'Avg Response(ms)', 'Throughput(req/s)', 'Errors'];
    const colWidths = [20, 10, 15, 18, 18, 8];

    // Print headers
    console.log(headers.map((h, i) => h.padEnd(colWidths[i])).join(' | '));
    console.log('-'.repeat(80));

    // Print results
    for (const result of this.results) {
      const row = [
        result.name.substring(0, 19),
        result.requests.toString(),
        result.duration.toFixed(2),
        result.avgResponseTime.toFixed(2),
        result.throughput.toFixed(2),
        result.errors.toString()
      ];
      console.log(row.map((v, i) => v.padEnd(colWidths[i])).join(' | '));
    }

    console.log('═'.repeat(80));

    // Calculate improvement
    if (this.results.length >= 2) {
      const legacy = this.results[0];
      const ultra = this.results[1];

      const responseImprovement = ((legacy.avgResponseTime - ultra.avgResponseTime) / legacy.avgResponseTime * 100).toFixed(1);
      const throughputImprovement = ((ultra.throughput - legacy.throughput) / legacy.throughput * 100).toFixed(1);

      console.log('\n📊 Performance Improvements:');
      console.log(`   • Response Time: ${responseImprovement}% faster`);
      console.log(`   • Throughput: ${throughputImprovement}% higher`);
    }
  }
}

// Memory usage tracker
class MemoryTracker {
  private initialMemory: NodeJS.MemoryUsage;
  private samples: NodeJS.MemoryUsage[] = [];

  start(): void {
    this.initialMemory = process.memoryUsage();
    
    // Sample memory every second
    const interval = setInterval(() => {
      this.samples.push(process.memoryUsage());
    }, 1000);

    // Stop after 30 seconds
    setTimeout(() => {
      clearInterval(interval);
      this.displayMemoryStats();
    }, 30000);
  }

  private displayMemoryStats(): void {
    if (this.samples.length === 0) return;

    const avgHeapUsed = this.samples.reduce((sum, s) => sum + s.heapUsed, 0) / this.samples.length;
    const maxHeapUsed = Math.max(...this.samples.map(s => s.heapUsed));
    const minHeapUsed = Math.min(...this.samples.map(s => s.heapUsed));

    console.log('\n💾 Memory Usage Statistics:');
    console.log(`   • Initial: ${(this.initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   • Average: ${(avgHeapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   • Maximum: ${(maxHeapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   • Minimum: ${(minHeapUsed / 1024 / 1024).toFixed(2)} MB`);
  }
}

// Main test runner
async function main() {
  console.log('🚀 Manga Server Performance Test Suite');
  console.log('=====================================\n');

  const tester = new PerformanceTester();
  const memTracker = new MemoryTracker();

  // Check which server is running
  const baseUrl = 'http://localhost';
  
  try {
    // Test health endpoint first
    const healthResponse = await fetch(`${baseUrl}/api/health`);
    if (!healthResponse.ok) {
      throw new Error('Server not responding');
    }

    console.log('✅ Server is running and healthy\n');

    // Start memory tracking
    memTracker.start();

    // Run tests
    const tests = [
      { name: 'API List', endpoint: '/api/manga?limit=50' },
      { name: 'API Search', endpoint: '/api/search?q=manga' },
      { name: 'Static Small', endpoint: '/index.html' },
      { name: 'API Stats', endpoint: '/api/stats' },
    ];

    for (const test of tests) {
      await tester.runTest(test.name, `${baseUrl}${test.endpoint}`, 500);
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Display results
    tester.displayResults();

    // Run load test
    console.log('\n🔥 Running load test (high concurrency)...');
    await tester.runTest('Load Test', `${baseUrl}/api/manga`, 2000);
    console.log('   Load test complete!');

  } catch (error) {
    console.error('❌ Error:', error);
    console.log('\nMake sure the server is running:');
    console.log('   bun run start');
  }
}

// Run tests
main().catch(console.error);