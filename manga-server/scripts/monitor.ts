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
      this.createAlert('critical', `High memory pressure: ${current.cache.memoryPressure}`);\n    } else if (memoryPressure > this.config.alertThresholds.memoryUsage - 10) {\n      this.createAlert('warning', `Memory pressure increasing: ${current.cache.memoryPressure}`);\n    }\n    \n    // Cache performance check\n    const hitRate = parseFloat(current.cache.hitRate);\n    if (hitRate < this.config.alertThresholds.cacheHitRate) {\n      this.createAlert('warning', `Low cache hit rate: ${current.cache.hitRate}`);\n    }\n    \n    // Display current stats\n    console.log(`📊 Stats Update [${timestamp}]`);\n    console.log(`   Cache: ${current.cache.size} entries, ${current.cache.hitRate} hit rate`);\n    console.log(`   Memory: ${current.cache.memoryPressure} pressure`);\n    \n    // Show delta if we have previous stats\n    if (previous) {\n      const hitsDelta = current.cache.hits - previous.cache.hits;\n      const missesDelta = current.cache.misses - previous.cache.misses;\n      \n      if (hitsDelta > 0 || missesDelta > 0) {\n        console.log(`   Delta: +${hitsDelta} hits, +${missesDelta} misses`);\n      }\n    }\n    \n    console.log('');\n  }\n  \n  private createAlert(type: 'warning' | 'critical', message: string) {\n    const alertId = `${type}-${Date.now()}`;\n    \n    // Check if similar alert already exists\n    const existingAlert = this.alerts.find(a => \n      !a.resolved && a.message.includes(message.split(':')[0])\n    );\n    \n    if (existingAlert) {\n      return; // Don't spam duplicate alerts\n    }\n    \n    const alert: Alert = {\n      id: alertId,\n      type,\n      message,\n      timestamp: new Date(),\n      resolved: false\n    };\n    \n    this.alerts.push(alert);\n    \n    // Display alert\n    const icon = type === 'critical' ? '🚨' : '⚠️';\n    const timestamp = alert.timestamp.toLocaleTimeString();\n    \n    console.log(`${icon} ALERT [${timestamp}] ${type.toUpperCase()}: ${message}`);\n    \n    // Send notifications if configured\n    this.sendNotification(alert);\n  }\n  \n  private resolveAlerts(patterns: string[]) {\n    this.alerts.forEach(alert => {\n      if (!alert.resolved && patterns.some(pattern => alert.message.includes(pattern))) {\n        alert.resolved = true;\n        console.log(`✅ RESOLVED: ${alert.message}`);\n      }\n    });\n  }\n  \n  private async sendNotification(alert: Alert) {\n    // Webhook notification\n    if (this.config.notifications.webhook) {\n      try {\n        await fetch(this.config.notifications.webhook, {\n          method: 'POST',\n          headers: { 'Content-Type': 'application/json' },\n          body: JSON.stringify({\n            type: alert.type,\n            message: alert.message,\n            timestamp: alert.timestamp.toISOString(),\n            service: 'manga-server'\n          })\n        });\n      } catch (error) {\n        console.error('Failed to send webhook notification:', error.message);\n      }\n    }\n    \n    // Additional notification methods can be added here\n  }\n  \n  stop() {\n    console.log('\\n🛑 Stopping server monitor...');\n    \n    this.isRunning = false;\n    \n    if (this.healthInterval) {\n      clearInterval(this.healthInterval);\n    }\n    \n    if (this.statsInterval) {\n      clearInterval(this.statsInterval);\n    }\n    \n    // Display final alert summary\n    const activeAlerts = this.alerts.filter(a => !a.resolved);\n    if (activeAlerts.length > 0) {\n      console.log(`\\n⚠️  ${activeAlerts.length} unresolved alerts:`);\n      activeAlerts.forEach(alert => {\n        console.log(`   ${alert.type.toUpperCase()}: ${alert.message}`);\n      });\n    }\n    \n    console.log('\\n👋 Monitor stopped');\n    process.exit(0);\n  }\n  \n  getAlerts() {\n    return this.alerts;\n  }\n  \n  getActiveAlerts() {\n    return this.alerts.filter(a => !a.resolved);\n  }\n}\n\n// CLI execution\nasync function main() {\n  const args = process.argv.slice(2);\n  \n  const config: Partial<MonitorConfig> = {\n    interval: parseInt(args.find(arg => arg.startsWith('--stats-interval='))?.split('=')[1] || '10000'),\n    healthCheckInterval: parseInt(args.find(arg => arg.startsWith('--health-interval='))?.split('=')[1] || '30000')\n  };\n  \n  // Add webhook if provided\n  const webhook = args.find(arg => arg.startsWith('--webhook='))?.split('=')[1];\n  if (webhook) {\n    config.notifications = { webhook };\n  }\n  \n  const monitor = new ServerMonitor(config);\n  \n  try {\n    await monitor.start();\n  } catch (error) {\n    console.error('❌ Monitor failed:', error);\n    process.exit(1);\n  }\n}\n\nif (import.meta.main) {\n  main();\n}\n\nexport { ServerMonitor };