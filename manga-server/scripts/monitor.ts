#!/usr/bin/env bun

/**
 * Real-time monitoring script for Manga Server
 * Provides continuous health monitoring with alerts
 */

import { HealthChecker } from './health-check.ts';
import { StatsDisplay } from './stats.ts';

interface MonitorConfig {
  interval: number;
  healthCheckInterval: number;
  alertThresholds: {
    memoryUsage: number;
    responseTime: number;
    cacheHitRate: number;
    errorRate: number;
  };
  notifications: {
    email?: string;
    webhook?: string;
    slack?: string;
  };
}

interface Alert {
  id: string;
  type: 'warning' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
}

class ServerMonitor {
  private config: MonitorConfig;
  private healthChecker: HealthChecker;
  private statsDisplay: StatsDisplay;
  private alerts: Alert[] = [];
  private isRunning = false;
  private healthInterval?: NodeJS.Timeout;
  private statsInterval?: NodeJS.Timeout;
  
  constructor(config: Partial<MonitorConfig> = {}) {
    this.config = {
      interval: 10000,
      healthCheckInterval: 30000,
      alertThresholds: {
        memoryUsage: 85,
        responseTime: 3000,
        cacheHitRate: 50,
        errorRate: 5
      },
      notifications: {},
      ...config
    };
    
    this.healthChecker = new HealthChecker();
    this.statsDisplay = new StatsDisplay();
  }
  
  async start() {
    console.log('🔍 Starting Manga Server Monitor...\n');
    console.log('📊 Configuration:');
    console.log(`   Stats Interval: ${this.config.interval / 1000}s`);
    console.log(`   Health Check Interval: ${this.config.healthCheckInterval / 1000}s`);
    console.log(`   Memory Alert Threshold: ${this.config.alertThresholds.memoryUsage}%`);
    console.log(`   Response Time Alert: ${this.config.alertThresholds.responseTime}ms`);
    console.log('\nPress Ctrl+C to stop monitoring\n');
    
    this.isRunning = true;
    
    // Start monitoring loops
    this.startHealthMonitoring();
    this.startStatsMonitoring();
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      this.stop();
    });
    
    // Keep process alive
    while (this.isRunning) {
      await Bun.sleep(1000);
    }
  }
  
  private startHealthMonitoring() {
    const runHealthCheck = async () => {
      try {
        const result = await this.healthChecker.runAllChecks();
        this.processHealthResults(result);
      } catch (error) {
        this.createAlert('critical', `Health check failed: ${error.message}`);
      }
    };
    
    // Initial check
    runHealthCheck();
    
    // Regular checks
    this.healthInterval = setInterval(runHealthCheck, this.config.healthCheckInterval);
  }
  
  private startStatsMonitoring() {
    let lastStats: any = null;
    
    const collectStats = async () => {
      try {
        const response = await fetch('http://localhost:80/api/stats');
        
        if (response.ok) {
          const stats = await response.json();
          this.processStatsUpdate(stats, lastStats);
          lastStats = stats;
        } else {
          this.createAlert('warning', `Stats API returned ${response.status}`);
        }
        
      } catch (error) {
        this.createAlert('warning', `Failed to collect stats: ${error.message}`);
      }
    };
    
    this.statsInterval = setInterval(collectStats, this.config.interval);
  }
  
  private processHealthResults(result: any) {
    const timestamp = new Date().toLocaleTimeString();
    
    console.log(`🏥 Health Check [${timestamp}] - ${result.status.toUpperCase()}`);
    
    // Process individual check results
    const failures = result.checks.filter((c: any) => c.status === 'fail');
    const warnings = result.checks.filter((c: any) => c.status === 'warn');
    
    failures.forEach((check: any) => {
      this.createAlert('critical', `${check.name}: ${check.message}`);
    });
    
    warnings.forEach((check: any) => {
      this.createAlert('warning', `${check.name}: ${check.message}`);
    });
    
    if (result.status === 'healthy') {
      this.resolveAlerts(['Server Connectivity', 'Health Endpoint']);
    }
    
    console.log(`   ✅ ${result.summary.passed} passed, ⚠️ ${result.summary.warnings} warnings, ❌ ${result.summary.failures} failures\n`);
  }
  
  private processStatsUpdate(current: any, previous: any) {
    const timestamp = new Date().toLocaleTimeString();
    
    // Memory pressure check
    const memoryPressure = parseFloat(current.cache.memoryPressure);
    if (memoryPressure > this.config.alertThresholds.memoryUsage) {
      this.createAlert('critical', `High memory pressure: ${current.cache.memoryPressure}`);
    } else if (memoryPressure > this.config.alertThresholds.memoryUsage - 10) {
      this.createAlert('warning', `Memory pressure increasing: ${current.cache.memoryPressure}`);
    }
    
    // Cache performance check
    const hitRate = parseFloat(current.cache.hitRate);
    if (hitRate < this.config.alertThresholds.cacheHitRate) {
      this.createAlert('warning', `Low cache hit rate: ${current.cache.hitRate}`);
    }
    
    // Display current stats
    console.log(`📊 Stats Update [${timestamp}]`);
    console.log(`   Cache: ${current.cache.size} entries, ${current.cache.hitRate} hit rate`);
    console.log(`   Memory: ${current.cache.memoryPressure} pressure`);
    
    // Show delta if we have previous stats
    if (previous) {
      const hitsDelta = current.cache.hits - previous.cache.hits;
      const missesDelta = current.cache.misses - previous.cache.misses;
      
      if (hitsDelta > 0 || missesDelta > 0) {
        console.log(`   Delta: +${hitsDelta} hits, +${missesDelta} misses`);
      }
    }
    
    console.log('');
  }
  
  private createAlert(type: 'warning' | 'critical', message: string) {
    const alertId = `${type}-${Date.now()}`;
    
    // Check if similar alert already exists
    const existingAlert = this.alerts.find(a => 
      !a.resolved && a.message.includes(message.split(':')[0])
    );
    
    if (existingAlert) {
      return; // Don't spam duplicate alerts
    }
    
    const alert: Alert = {
      id: alertId,
      type,
      message,
      timestamp: new Date(),
      resolved: false
    };
    
    this.alerts.push(alert);
    
    // Display alert
    const icon = type === 'critical' ? '🚨' : '⚠️';
    const timestamp = alert.timestamp.toLocaleTimeString();
    
    console.log(`${icon} ALERT [${timestamp}] ${type.toUpperCase()}: ${message}`);
    
    // Send notifications if configured
    this.sendNotification(alert);
  }
  
  private resolveAlerts(patterns: string[]) {
    this.alerts.forEach(alert => {
      if (!alert.resolved && patterns.some(pattern => alert.message.includes(pattern))) {
        alert.resolved = true;
        console.log(`✅ RESOLVED: ${alert.message}`);
      }
    });
  }
  
  private async sendNotification(alert: Alert) {
    // Webhook notification
    if (this.config.notifications.webhook) {
      try {
        await fetch(this.config.notifications.webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: alert.type,
            message: alert.message,
            timestamp: alert.timestamp.toISOString(),
            service: 'manga-server'
          })
        });
      } catch (error) {
        console.error('Failed to send webhook notification:', error.message);
      }
    }
    
    // Additional notification methods can be added here
  }
  
  stop() {
    console.log('\n🛑 Stopping server monitor...');
    
    this.isRunning = false;
    
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
    }
    
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }
    
    // Display final alert summary
    const activeAlerts = this.alerts.filter(a => !a.resolved);
    if (activeAlerts.length > 0) {
      console.log(`\n⚠️  ${activeAlerts.length} unresolved alerts:`);
      activeAlerts.forEach(alert => {
        console.log(`   ${alert.type.toUpperCase()}: ${alert.message}`);
      });
    }
    
    console.log('\n👋 Monitor stopped');
    process.exit(0);
  }
  
  getAlerts() {
    return this.alerts;
  }
  
  getActiveAlerts() {
    return this.alerts.filter(a => !a.resolved);
  }
}

// CLI execution
async function main() {
  const args = process.argv.slice(2);
  
  const config: Partial<MonitorConfig> = {
    interval: parseInt(args.find(arg => arg.startsWith('--stats-interval='))?.split('=')[1] || '10000'),
    healthCheckInterval: parseInt(args.find(arg => arg.startsWith('--health-interval='))?.split('=')[1] || '30000')
  };
  
  // Add webhook if provided
  const webhook = args.find(arg => arg.startsWith('--webhook='))?.split('=')[1];
  if (webhook) {
    config.notifications = { webhook };
  }
  
  const monitor = new ServerMonitor(config);
  
  try {
    await monitor.start();
  } catch (error) {
    console.error('❌ Monitor failed:', error);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}

export { ServerMonitor };