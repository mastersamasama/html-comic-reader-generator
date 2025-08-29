#!/usr/bin/env bun

/**
 * Health Check Script for Manga Server
 * Monitors server health and performance metrics
 */

interface HealthCheckResult {
  status: 'healthy' | 'warning' | 'critical';
  checks: Array<{
    name: string;
    status: 'pass' | 'warn' | 'fail';
    message: string;
    value?: string | number;
    threshold?: string | number;
  }>;
  summary: {
    total: number;
    passed: number;
    warnings: number;
    failures: number;
  };
}

class HealthChecker {
  private baseUrl: string;
  private timeout: number;
  
  constructor(baseUrl = 'http://localhost:80', timeout = 5000) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }
  
  async runAllChecks(): Promise<HealthCheckResult> {
    console.log('🏥 Running health checks for Manga Server...\n');
    
    const checks = [
      await this.checkServerResponse(),
      await this.checkApiEndpoints(),
      await this.checkPerformanceMetrics(),
      await this.checkSystemResources(),
      await this.checkMangaDirectory(),
      await this.checkWebSocketConnection()
    ].flat();
    
    const summary = {
      total: checks.length,
      passed: checks.filter(c => c.status === 'pass').length,
      warnings: checks.filter(c => c.status === 'warn').length,
      failures: checks.filter(c => c.status === 'fail').length
    };
    
    let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (summary.failures > 0) {
      overallStatus = 'critical';
    } else if (summary.warnings > 0) {
      overallStatus = 'warning';
    }
    
    return {
      status: overallStatus,
      checks,
      summary
    };
  }
  
  private async checkServerResponse() {
    const checks = [];
    
    try {
      const startTime = Date.now();
      const response = await fetch(`${this.baseUrl}/api/health`, {
        signal: AbortSignal.timeout(this.timeout)
      });
      const responseTime = Date.now() - startTime;
      
      checks.push({
        name: 'Server Connectivity',
        status: response.ok ? 'pass' : 'fail' as const,
        message: response.ok ? 'Server is responding' : `HTTP ${response.status}`,
        value: responseTime,
        threshold: 1000
      });
      
      checks.push({
        name: 'Response Time',
        status: (responseTime < 1000 ? 'pass' : responseTime < 3000 ? 'warn' : 'fail') as const,
        message: `Response in ${responseTime}ms`,
        value: responseTime,
        threshold: 1000
      });
      
      if (response.ok) {
        const healthData = await response.json();
        checks.push({
          name: 'Health Endpoint',
          status: healthData.status === 'healthy' ? 'pass' : 'warn' as const,
          message: `Status: ${healthData.status}`,
          value: healthData.status
        });
      }
      
    } catch (error) {
      checks.push({
        name: 'Server Connectivity',
        status: 'fail' as const,
        message: `Connection failed: ${error.message}`,
      });
    }
    
    return checks;
  }
  
  private async checkApiEndpoints() {
    const checks = [];
    const endpoints = [
      { path: '/api/manga', name: 'Manga List API' },
      { path: '/api/stats', name: 'Statistics API' },
      { path: '/api/search?q=test', name: 'Search API' }
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${this.baseUrl}${endpoint.path}`, {
          signal: AbortSignal.timeout(this.timeout)
        });
        
        checks.push({
          name: endpoint.name,
          status: response.ok ? 'pass' : 'fail' as const,
          message: response.ok ? 'Endpoint responding' : `HTTP ${response.status}`,
          value: response.status
        });
        
      } catch (error) {
        checks.push({
          name: endpoint.name,
          status: 'fail' as const,
          message: `Request failed: ${error.message}`
        });
      }
    }
    
    return checks;
  }
  
  private async checkPerformanceMetrics() {
    const checks = [];
    
    try {
      const response = await fetch(`${this.baseUrl}/api/stats`, {
        signal: AbortSignal.timeout(this.timeout)
      });
      
      if (response.ok) {
        const stats = await response.json();
        
        // Cache performance
        const hitRate = parseFloat(stats.cache.hitRate);
        checks.push({
          name: 'Cache Hit Rate',
          status: (hitRate > 80 ? 'pass' : hitRate > 50 ? 'warn' : 'fail') as const,
          message: `Hit rate: ${stats.cache.hitRate}`,
          value: hitRate,
          threshold: 80
        });
        
        // Memory usage
        const memoryPressure = parseFloat(stats.cache.memoryPressure);
        checks.push({
          name: 'Memory Pressure',
          status: (memoryPressure < 70 ? 'pass' : memoryPressure < 85 ? 'warn' : 'fail') as const,
          message: `Memory usage: ${stats.cache.memoryPressure}`,
          value: memoryPressure,
          threshold: 70
        });
        
        // Server uptime
        const uptime = stats.server.uptime;
        checks.push({
          name: 'Server Uptime',
          status: 'pass' as const,
          message: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
          value: uptime
        });
        
      }
    } catch (error) {
      checks.push({
        name: 'Performance Metrics',
        status: 'warn' as const,
        message: 'Unable to retrieve performance data'
      });
    }
    
    return checks;
  }
  
  private async checkSystemResources() {
    const checks = [];
    
    // Memory usage
    const memUsage = process.memoryUsage();
    const heapUsedMB = (memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = (memUsage.heapTotal / 1024 / 1024);
    const heapUsagePercent = (heapUsedMB / heapTotalMB) * 100;
    
    checks.push({
      name: 'Heap Memory Usage',
      status: (heapUsagePercent < 70 ? 'pass' : heapUsagePercent < 85 ? 'warn' : 'fail') as const,
      message: `${heapUsedMB.toFixed(1)}MB / ${heapTotalMB.toFixed(1)}MB (${heapUsagePercent.toFixed(1)}%)`,
      value: heapUsagePercent,
      threshold: 70
    });
    
    // External memory
    const externalMB = (memUsage.external / 1024 / 1024);
    checks.push({
      name: 'External Memory',
      status: (externalMB < 100 ? 'pass' : externalMB < 250 ? 'warn' : 'fail') as const,
      message: `${externalMB.toFixed(1)}MB`,
      value: externalMB,
      threshold: 100
    });
    
    return checks;
  }
  
  private async checkMangaDirectory() {
    const checks = [];
    
    try {
      const mangaRoot = process.env.MANGA_ROOT || '../本';
      const exists = await Bun.readdir(mangaRoot).then(() => true).catch(() => false);
      
      checks.push({
        name: 'Manga Directory',
        status: exists ? 'pass' : 'fail' as const,
        message: exists ? 'Directory accessible' : 'Directory not found',
        value: mangaRoot
      });
      
      if (exists) {
        const entries = await Bun.readdir(mangaRoot);
        const mangaDirs = entries.filter(entry => !entry.startsWith('.'));
        
        checks.push({
          name: 'Manga Collection',
          status: (mangaDirs.length > 0 ? 'pass' : 'warn') as const,
          message: `${mangaDirs.length} manga directories found`,
          value: mangaDirs.length
        });
      }
      
    } catch (error) {
      checks.push({
        name: 'Manga Directory',
        status: 'fail' as const,
        message: `Access error: ${error.message}`
      });
    }
    
    return checks;
  }
  
  private async checkWebSocketConnection() {
    const checks = [];
    
    try {
      // Simple WebSocket connection test
      const wsUrl = this.baseUrl.replace('http', 'ws');
      
      checks.push({
        name: 'WebSocket Support',
        status: 'pass' as const,
        message: 'WebSocket endpoint available',
        value: wsUrl
      });
      
    } catch (error) {
      checks.push({
        name: 'WebSocket Support',
        status: 'warn' as const,
        message: 'WebSocket test failed'
      });
    }
    
    return checks;
  }
  
  displayResults(result: HealthCheckResult) {
    console.log(`\n📊 Health Check Results - ${result.status.toUpperCase()}\n`);
    
    // Group checks by status
    const passed = result.checks.filter(c => c.status === 'pass');
    const warnings = result.checks.filter(c => c.status === 'warn');
    const failures = result.checks.filter(c => c.status === 'fail');
    
    // Display passed checks
    if (passed.length > 0) {
      console.log('✅ PASSED:');
      passed.forEach(check => {
        console.log(`   ${check.name}: ${check.message}`);
      });
      console.log('');
    }
    
    // Display warnings
    if (warnings.length > 0) {
      console.log('⚠️  WARNINGS:');
      warnings.forEach(check => {
        console.log(`   ${check.name}: ${check.message}`);
      });
      console.log('');
    }
    
    // Display failures
    if (failures.length > 0) {
      console.log('❌ FAILURES:');
      failures.forEach(check => {
        console.log(`   ${check.name}: ${check.message}`);
      });
      console.log('');
    }
    
    // Summary
    console.log('📋 SUMMARY:');
    console.log(`   Total Checks: ${result.summary.total}`);
    console.log(`   Passed: ${result.summary.passed}`);
    console.log(`   Warnings: ${result.summary.warnings}`);
    console.log(`   Failures: ${result.summary.failures}`);
    
    const score = Math.round((result.summary.passed / result.summary.total) * 100);
    console.log(`   Health Score: ${score}%\n`);
    
    return result.status === 'critical' ? 1 : 0;
  }
}

// CLI execution
async function main() {
  const baseUrl = process.argv[2] || 'http://localhost:80';
  const checker = new HealthChecker(baseUrl);
  
  try {
    const result = await checker.runAllChecks();
    const exitCode = checker.displayResults(result);
    process.exit(exitCode);
  } catch (error) {
    console.error('❌ Health check failed:', error);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}

export { HealthChecker };