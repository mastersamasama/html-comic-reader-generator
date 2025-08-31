/**
 * Advanced Performance Analytics and Monitoring System
 * Provides comprehensive performance insights with predictive analysis
 */

interface PerformanceMetrics {
  timestamp: number;
  requestRate: number;
  responseTime: number;
  memoryUsage: number;
  cpuUsage: number;
  cacheHitRate: number;
  errorRate: number;
  throughputMBps: number;
  activeConnections: number;
  gcPressure: number;
}

interface PerformanceAlert {
  id: string;
  type: 'warning' | 'critical' | 'info';
  metric: string;
  value: number;
  threshold: number;
  message: string;
  timestamp: number;
  resolved: boolean;
  predictionConfidence?: number;
}

interface PerformanceTrend {
  metric: string;
  direction: 'up' | 'down' | 'stable';
  change: number;
  confidence: number;
  prediction: number;
}

class PerformanceAnalytics {
  private metricsBuffer: PerformanceMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private trends = new Map<string, PerformanceTrend>();
  private baselineMetrics = new Map<string, number>();
  
  private readonly maxBufferSize = 1000;
  private readonly alertThresholds = {
    responseTime: { warning: 100, critical: 500 },
    memoryUsage: { warning: 70, critical: 85 },
    errorRate: { warning: 1, critical: 5 },
    cacheHitRate: { warning: 60, critical: 40 },
    throughput: { warning: 5, critical: 1 }
  };
  
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  constructor() {
    this.initializeBaselines();
  }

  // Start comprehensive monitoring
  startMonitoring(intervalMs: number = 1000): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    console.log('Starting advanced performance monitoring...');
    
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.analyzePerformance();
      this.detectAnomalies();
      this.updateTrends();
    }, intervalMs);
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    console.log('Performance monitoring stopped');
  }

  private async collectMetrics(): Promise<void> {
    const timestamp = Date.now();
    
    try {
      // Collect system metrics
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      // Calculate derived metrics
      const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
      const gcPressure = this.calculateGCPressure(memUsage);
      
      // Get application-specific metrics (would integrate with actual server)
      const appMetrics = await this.collectApplicationMetrics();
      
      const metrics: PerformanceMetrics = {
        timestamp,
        requestRate: appMetrics.requestRate,
        responseTime: appMetrics.responseTime,
        memoryUsage: heapUsedPercent,
        cpuUsage: this.calculateCPUPercent(cpuUsage),
        cacheHitRate: appMetrics.cacheHitRate,
        errorRate: appMetrics.errorRate,
        throughputMBps: appMetrics.throughputMBps,
        activeConnections: appMetrics.activeConnections,
        gcPressure
      };
      
      this.addMetrics(metrics);
      
    } catch (error) {
      console.error('Failed to collect metrics:', error);
    }
  }

  private async collectApplicationMetrics(): Promise<any> {
    // This would integrate with the actual server metrics
    // For now, simulate realistic metrics
    return {
      requestRate: Math.random() * 20000 + 1000,
      responseTime: Math.random() * 50 + 5,
      cacheHitRate: Math.random() * 40 + 60,
      errorRate: Math.random() * 2,
      throughputMBps: Math.random() * 100 + 50,
      activeConnections: Math.random() * 1000 + 100
    };
  }

  private addMetrics(metrics: PerformanceMetrics): void {
    this.metricsBuffer.push(metrics);
    
    // Maintain buffer size
    if (this.metricsBuffer.length > this.maxBufferSize) {
      this.metricsBuffer.shift();
    }
  }

  private analyzePerformance(): void {
    if (this.metricsBuffer.length < 10) return; // Need minimum data
    
    const latest = this.metricsBuffer[this.metricsBuffer.length - 1];
    
    // Check thresholds and generate alerts
    this.checkThreshold('responseTime', latest.responseTime, 'ms');
    this.checkThreshold('memoryUsage', latest.memoryUsage, '%');
    this.checkThreshold('errorRate', latest.errorRate, '%');
    this.checkThreshold('cacheHitRate', latest.cacheHitRate, '%', true); // Reverse threshold
    
    // Performance correlation analysis
    this.analyzeCorrelations();
    
    // Predictive analysis
    this.performPredictiveAnalysis();
  }

  private checkThreshold(
    metric: keyof typeof this.alertThresholds, 
    value: number, 
    unit: string,
    reverse: boolean = false
  ): void {
    const thresholds = this.alertThresholds[metric];
    if (!thresholds) return;
    
    let alertType: 'warning' | 'critical' | null = null;
    let threshold = 0;
    
    if (reverse) {
      // For metrics where lower is worse (like cache hit rate)
      if (value < thresholds.critical) {
        alertType = 'critical';
        threshold = thresholds.critical;
      } else if (value < thresholds.warning) {
        alertType = 'warning';
        threshold = thresholds.warning;
      }
    } else {
      // For metrics where higher is worse
      if (value > thresholds.critical) {
        alertType = 'critical';
        threshold = thresholds.critical;
      } else if (value > thresholds.warning) {
        alertType = 'warning';
        threshold = thresholds.warning;
      }
    }
    
    if (alertType) {
      this.createAlert(alertType, metric, value, threshold, unit);
    } else {
      this.resolveAlert(metric);
    }
  }

  private createAlert(
    type: 'warning' | 'critical',
    metric: string,
    value: number,
    threshold: number,
    unit: string
  ): void {
    // Check if similar alert already exists
    const existingAlert = this.alerts.find(
      alert => !alert.resolved && alert.metric === metric && alert.type === type
    );
    
    if (existingAlert) return; // Don't spam duplicate alerts
    
    const alert: PerformanceAlert = {
      id: `${metric}_${type}_${Date.now()}`,
      type,
      metric,
      value,
      threshold,
      message: `${metric} ${type}: ${value.toFixed(2)}${unit} (threshold: ${threshold}${unit})`,
      timestamp: Date.now(),
      resolved: false
    };
    
    this.alerts.push(alert);
    console.warn(`🚨 PERFORMANCE ALERT: ${alert.message}`);
  }

  private resolveAlert(metric: string): void {
    const unresolvedAlert = this.alerts.find(
      alert => !alert.resolved && alert.metric === metric
    );
    
    if (unresolvedAlert) {
      unresolvedAlert.resolved = true;
      console.info(`✅ RESOLVED: ${unresolvedAlert.message}`);
    }
  }

  private analyzeCorrelations(): void {
    if (this.metricsBuffer.length < 30) return; // Need sufficient data
    
    const recent = this.metricsBuffer.slice(-30); // Last 30 data points
    
    // Analyze correlation between memory usage and response time
    const memoryResponseCorr = this.calculateCorrelation(
      recent.map(m => m.memoryUsage),
      recent.map(m => m.responseTime)
    );
    
    // Analyze correlation between request rate and error rate
    const requestErrorCorr = this.calculateCorrelation(
      recent.map(m => m.requestRate),
      recent.map(m => m.errorRate)
    );
    
    // Generate insights based on correlations
    if (Math.abs(memoryResponseCorr) > 0.7) {
      console.info(`📊 Strong correlation detected: Memory usage vs Response time (r=${memoryResponseCorr.toFixed(2)})`);
    }
    
    if (Math.abs(requestErrorCorr) > 0.6) {
      console.info(`📊 Correlation detected: Request rate vs Error rate (r=${requestErrorCorr.toFixed(2)})`);
    }
  }

  private performPredictiveAnalysis(): void {
    if (this.metricsBuffer.length < 50) return; // Need sufficient history
    
    const predictions = [
      this.predictMetric('responseTime', 60), // Predict 1 minute ahead
      this.predictMetric('memoryUsage', 60),
      this.predictMetric('errorRate', 60)
    ];
    
    // Generate predictive alerts
    for (const prediction of predictions) {
      if (prediction && prediction.confidence > 0.7) {
        this.evaluatePredictiveAlert(prediction);
      }
    }
  }

  private predictMetric(metric: keyof PerformanceMetrics, secondsAhead: number): any {
    const recent = this.metricsBuffer.slice(-20); // Last 20 points
    const values = recent.map(m => m[metric] as number);
    const times = recent.map(m => m.timestamp);
    
    // Simple linear regression for prediction
    const { slope, intercept, correlation } = this.linearRegression(times, values);
    
    const futureTime = Date.now() + (secondsAhead * 1000);
    const predictedValue = slope * futureTime + intercept;
    
    return {
      metric,
      predictedValue,
      confidence: Math.abs(correlation),
      timeAhead: secondsAhead
    };
  }

  private evaluatePredictiveAlert(prediction: any): void {
    const { metric, predictedValue, confidence } = prediction;
    const thresholds = this.alertThresholds[metric as keyof typeof this.alertThresholds];
    
    if (!thresholds) return;
    
    let willExceedThreshold = false;
    let thresholdType = '';
    
    if (metric === 'cacheHitRate') {
      // Reverse threshold
      if (predictedValue < thresholds.critical) {
        willExceedThreshold = true;
        thresholdType = 'critical';
      } else if (predictedValue < thresholds.warning) {
        willExceedThreshold = true;
        thresholdType = 'warning';
      }
    } else {
      // Normal threshold
      if (predictedValue > thresholds.critical) {
        willExceedThreshold = true;
        thresholdType = 'critical';
      } else if (predictedValue > thresholds.warning) {
        willExceedThreshold = true;
        thresholdType = 'warning';
      }
    }
    
    if (willExceedThreshold) {
      const alert: PerformanceAlert = {
        id: `pred_${metric}_${Date.now()}`,
        type: 'warning', // Predictive alerts start as warnings
        metric: `predicted_${metric}`,
        value: predictedValue,
        threshold: thresholds[thresholdType as 'warning' | 'critical'],
        message: `Predicted ${metric} ${thresholdType} in ~1 minute: ${predictedValue.toFixed(2)} (confidence: ${(confidence * 100).toFixed(0)}%)`,
        timestamp: Date.now(),
        resolved: false,
        predictionConfidence: confidence
      };
      
      this.alerts.push(alert);
      console.warn(`🔮 PREDICTIVE ALERT: ${alert.message}`);
    }
  }

  private updateTrends(): void {
    if (this.metricsBuffer.length < 20) return;
    
    const metrics = ['responseTime', 'memoryUsage', 'cacheHitRate', 'errorRate'] as const;
    
    for (const metric of metrics) {
      const trend = this.calculateTrend(metric);
      if (trend) {
        this.trends.set(metric, trend);
      }
    }
  }

  private calculateTrend(metric: keyof PerformanceMetrics): PerformanceTrend | null {
    const recent = this.metricsBuffer.slice(-20);
    const values = recent.map(m => m[metric] as number);
    
    if (values.length < 10) return null;
    
    // Calculate trend using linear regression
    const times = recent.map((_, i) => i);
    const { slope, correlation } = this.linearRegression(times, values);
    
    const direction: 'up' | 'down' | 'stable' = 
      Math.abs(slope) < 0.01 ? 'stable' :
      slope > 0 ? 'up' : 'down';
    
    const changePercent = (slope / (values.reduce((a, b) => a + b) / values.length)) * 100;
    
    // Predict next value
    const nextValue = slope * times.length + this.linearRegression(times, values).intercept;
    
    return {
      metric,
      direction,
      change: changePercent,
      confidence: Math.abs(correlation),
      prediction: nextValue
    };
  }

  // Utility methods for statistical calculations
  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length < 2) return 0;
    
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumYY = y.reduce((sum, yi) => sum + yi * yi, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private linearRegression(x: number[], y: number[]): { slope: number; intercept: number; correlation: number } {
    if (x.length !== y.length || x.length < 2) {
      return { slope: 0, intercept: 0, correlation: 0 };
    }
    
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    const correlation = this.calculateCorrelation(x, y);
    
    return { slope, intercept, correlation };
  }

  private calculateCPUPercent(cpuUsage: NodeJS.CpuUsage): number {
    // This is a simplified CPU calculation
    // In a real implementation, you'd compare with previous measurements
    return (cpuUsage.user + cpuUsage.system) / 1000000; // Convert microseconds to percent
  }

  private calculateGCPressure(memUsage: NodeJS.MemoryUsage): number {
    // Calculate GC pressure based on heap usage ratio
    const heapRatio = memUsage.heapUsed / memUsage.heapTotal;
    const externalRatio = memUsage.external / memUsage.heapTotal;
    
    return (heapRatio * 0.8) + (externalRatio * 0.2);
  }

  private initializeBaselines(): void {
    // Initialize baseline metrics for comparison
    this.baselineMetrics.set('responseTime', 10);
    this.baselineMetrics.set('memoryUsage', 50);
    this.baselineMetrics.set('cacheHitRate', 80);
    this.baselineMetrics.set('errorRate', 0.1);
  }

  // Public API methods
  getRealtimeMetrics(): PerformanceMetrics | null {
    return this.metricsBuffer.length > 0 
      ? this.metricsBuffer[this.metricsBuffer.length - 1]
      : null;
  }

  getMetricsHistory(minutes: number = 10): PerformanceMetrics[] {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return this.metricsBuffer.filter(m => m.timestamp > cutoff);
  }

  getActiveAlerts(): PerformanceAlert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  getAllAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  getTrends(): PerformanceTrend[] {
    return Array.from(this.trends.values());
  }

  getPerformanceInsights(): any {
    const recentMetrics = this.getMetricsHistory(5); // Last 5 minutes
    if (recentMetrics.length === 0) return null;
    
    const avgResponseTime = recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length;
    const avgMemoryUsage = recentMetrics.reduce((sum, m) => sum + m.memoryUsage, 0) / recentMetrics.length;
    const avgCacheHitRate = recentMetrics.reduce((sum, m) => sum + m.cacheHitRate, 0) / recentMetrics.length;
    
    return {
      summary: {
        avgResponseTime: avgResponseTime.toFixed(2),
        avgMemoryUsage: avgMemoryUsage.toFixed(2),
        avgCacheHitRate: avgCacheHitRate.toFixed(2),
        totalAlerts: this.getActiveAlerts().length,
        isHealthy: this.getActiveAlerts().filter(a => a.type === 'critical').length === 0
      },
      trends: this.getTrends(),
      topIssues: this.getTopPerformanceIssues(),
      recommendations: this.generateRecommendations()
    };
  }

  private getTopPerformanceIssues(): string[] {
    const issues: string[] = [];
    const recent = this.getRealtimeMetrics();
    
    if (!recent) return issues;
    
    if (recent.responseTime > 100) {
      issues.push(`High response time: ${recent.responseTime.toFixed(2)}ms`);
    }
    
    if (recent.memoryUsage > 80) {
      issues.push(`High memory usage: ${recent.memoryUsage.toFixed(2)}%`);
    }
    
    if (recent.cacheHitRate < 60) {
      issues.push(`Low cache hit rate: ${recent.cacheHitRate.toFixed(2)}%`);
    }
    
    if (recent.errorRate > 2) {
      issues.push(`High error rate: ${recent.errorRate.toFixed(2)}%`);
    }
    
    return issues;
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const recent = this.getRealtimeMetrics();
    const trends = this.getTrends();
    
    if (!recent) return recommendations;
    
    // Memory-based recommendations
    if (recent.memoryUsage > 75) {
      recommendations.push('Consider increasing memory pool size or enabling more aggressive GC');
    }
    
    // Cache-based recommendations
    if (recent.cacheHitRate < 70) {
      recommendations.push('Optimize cache strategy - increase cache size or adjust TTL values');
    }
    
    // Performance trend recommendations
    const responseTimeTrend = trends.find(t => t.metric === 'responseTime');
    if (responseTimeTrend && responseTimeTrend.direction === 'up' && responseTimeTrend.confidence > 0.7) {
      recommendations.push('Response time trending upward - investigate request processing pipeline');
    }
    
    // General recommendations
    if (recommendations.length === 0) {
      recommendations.push('Performance looks healthy - consider load testing to validate scalability');
    }
    
    return recommendations;
  }

  // Cleanup method
  cleanup(): void {
    this.stopMonitoring();
    this.metricsBuffer = [];
    this.alerts = [];
    this.trends.clear();
  }
}

export { PerformanceAnalytics, PerformanceMetrics, PerformanceAlert, PerformanceTrend };