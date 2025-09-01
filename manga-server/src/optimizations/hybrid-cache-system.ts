/**
 * Hybrid Multi-Tier Cache System
 * 
 * A sophisticated caching solution with three tiers optimized for different access patterns:
 * - L1 (Hot): Ultra-fast in-memory cache for frequently accessed data
 * - L2 (Warm): Secondary cache for moderately accessed data
 * - L3 (Cold): Large capacity cache for infrequently accessed data
 * 
 * Features:
 * - Predictive prefetching based on access patterns
 * - Smart eviction with efficiency-based replacement
 * - Automatic tier promotion/demotion
 * - Near O(1) operations across all tiers
 */

import { createHash } from 'crypto';

interface CacheEntry<T> {
  key: string;
  value: T;
  size: number;
  accessCount: number;
  lastAccess: number;
  createTime: number;
  tier: 'L1' | 'L2' | 'L3';
  prefetchScore: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  promotions: number;
  demotions: number;
  prefetchHits: number;
  totalAccessTime: number;
}

interface TierConfig {
  maxSize: number;
  maxEntries: number;
  ttl: number;
  promotionThreshold: number;
  demotionThreshold: number;
}

export class HybridCacheSystem<T = any> {
  private l1Cache: Map<string, CacheEntry<T>>;
  private l2Cache: Map<string, CacheEntry<T>>;
  private l3Cache: Map<string, CacheEntry<T>>;
  
  private l1Size: number = 0;
  private l2Size: number = 0;
  private l3Size: number = 0;
  
  private accessPatterns: Map<string, number[]>;
  private prefetchQueue: Set<string>;
  private stats: Map<'L1' | 'L2' | 'L3', CacheStats>;
  
  private readonly config: {
    L1: TierConfig;
    L2: TierConfig;
    L3: TierConfig;
  };
  
  constructor(totalSizeMB: number = 1024) {
    // Tier distribution: L1=20%, L2=30%, L3=50%
    this.config = {
      L1: {
        maxSize: totalSizeMB * 0.2 * 1024 * 1024,
        maxEntries: 1000,
        ttl: 60000, // 1 minute
        promotionThreshold: 5,
        demotionThreshold: 2
      },
      L2: {
        maxSize: totalSizeMB * 0.3 * 1024 * 1024,
        maxEntries: 5000,
        ttl: 300000, // 5 minutes
        promotionThreshold: 3,
        demotionThreshold: 1
      },
      L3: {
        maxSize: totalSizeMB * 0.5 * 1024 * 1024,
        maxEntries: 20000,
        ttl: 3600000, // 1 hour
        promotionThreshold: 2,
        demotionThreshold: 0
      }
    };
    
    this.l1Cache = new Map();
    this.l2Cache = new Map();
    this.l3Cache = new Map();
    
    this.accessPatterns = new Map();
    this.prefetchQueue = new Set();
    
    this.stats = new Map([
      ['L1', this.createEmptyStats()],
      ['L2', this.createEmptyStats()],
      ['L3', this.createEmptyStats()]
    ]);
    
    // Start background processes
    this.startMaintenanceLoop();
    this.startPrefetchLoop();
  }
  
  /**
   * Get value from cache with automatic tier management
   */
  async get(key: string): Promise<T | null> {
    const startTime = performance.now();
    
    // Check L1 (Hot) - O(1)
    let entry = this.l1Cache.get(key);
    if (entry) {
      this.recordHit('L1', startTime);
      this.updateAccessPattern(key);
      entry.accessCount++;
      entry.lastAccess = Date.now();
      return entry.value;
    }
    
    // Check L2 (Warm) - O(1)
    entry = this.l2Cache.get(key);
    if (entry) {
      this.recordHit('L2', startTime);
      this.updateAccessPattern(key);
      entry.accessCount++;
      entry.lastAccess = Date.now();
      
      // Consider promotion to L1
      if (entry.accessCount >= this.config.L2.promotionThreshold) {
        await this.promoteEntry(entry, 'L2', 'L1');
      }
      
      return entry.value;
    }
    
    // Check L3 (Cold) - O(1)
    entry = this.l3Cache.get(key);
    if (entry) {
      this.recordHit('L3', startTime);
      this.updateAccessPattern(key);
      entry.accessCount++;
      entry.lastAccess = Date.now();
      
      // Consider promotion to L2
      if (entry.accessCount >= this.config.L3.promotionThreshold) {
        await this.promoteEntry(entry, 'L3', 'L2');
      }
      
      return entry.value;
    }
    
    // Cache miss
    this.recordMiss('L1', startTime);
    this.analyzePrefetchOpportunity(key);
    return null;
  }
  
  /**
   * Set value in cache with intelligent tier placement
   */
  async set(key: string, value: T, sizeBytes?: number): Promise<void> {
    const size = sizeBytes || this.estimateSize(value);
    const now = Date.now();
    
    const entry: CacheEntry<T> = {
      key,
      value,
      size,
      accessCount: 1,
      lastAccess: now,
      createTime: now,
      tier: 'L3', // Start in L3 by default
      prefetchScore: 0
    };
    
    // Determine initial tier based on size and patterns
    const tier = this.determineInitialTier(key, size);
    entry.tier = tier;
    
    // Add to appropriate tier
    await this.addToTier(entry, tier);
    
    // Update access patterns
    this.updateAccessPattern(key);
  }
  
  /**
   * Prefetch related content based on access patterns
   */
  async prefetch(key: string, fetcher: (key: string) => Promise<T>): Promise<void> {
    const relatedKeys = this.predictRelatedKeys(key);
    
    for (const relatedKey of relatedKeys) {
      if (!this.has(relatedKey) && !this.prefetchQueue.has(relatedKey)) {
        this.prefetchQueue.add(relatedKey);
        
        // Async prefetch without blocking
        setImmediate(async () => {
          try {
            const value = await fetcher(relatedKey);
            await this.set(relatedKey, value);
            this.stats.get('L1')!.prefetchHits++;
          } catch (error) {
            // Prefetch failed, remove from queue
          } finally {
            this.prefetchQueue.delete(relatedKey);
          }
        });
      }
    }
  }
  
  /**
   * Clear all cache tiers
   */
  clear(): void {
    this.l1Cache.clear();
    this.l2Cache.clear();
    this.l3Cache.clear();
    this.l1Size = 0;
    this.l2Size = 0;
    this.l3Size = 0;
    this.accessPatterns.clear();
    this.prefetchQueue.clear();
  }
  
  /**
   * Get comprehensive cache statistics
   */
  getStats(): {
    overall: {
      hitRate: number;
      avgAccessTime: number;
      totalEntries: number;
      totalSize: number;
    };
    tiers: Map<string, CacheStats>;
  } {
    let totalHits = 0;
    let totalMisses = 0;
    let totalAccessTime = 0;
    
    for (const stats of this.stats.values()) {
      totalHits += stats.hits;
      totalMisses += stats.misses;
      totalAccessTime += stats.totalAccessTime;
    }
    
    const totalAccesses = totalHits + totalMisses;
    
    return {
      overall: {
        hitRate: totalAccesses > 0 ? totalHits / totalAccesses : 0,
        avgAccessTime: totalAccesses > 0 ? totalAccessTime / totalAccesses : 0,
        totalEntries: this.l1Cache.size + this.l2Cache.size + this.l3Cache.size,
        totalSize: this.l1Size + this.l2Size + this.l3Size
      },
      tiers: this.stats
    };
  }
  
  // Private methods
  
  private has(key: string): boolean {
    return this.l1Cache.has(key) || this.l2Cache.has(key) || this.l3Cache.has(key);
  }
  
  private async addToTier(entry: CacheEntry<T>, tier: 'L1' | 'L2' | 'L3'): Promise<void> {
    const cache = this.getTierCache(tier);
    const config = this.config[tier];
    let tierSize = this.getTierSize(tier);
    
    // Check if we need to evict
    while (tierSize + entry.size > config.maxSize || cache.size >= config.maxEntries) {
      await this.evictFromTier(tier);
      tierSize = this.getTierSize(tier);
    }
    
    // Add entry
    cache.set(entry.key, entry);
    this.updateTierSize(tier, tierSize + entry.size);
  }
  
  private async evictFromTier(tier: 'L1' | 'L2' | 'L3'): Promise<void> {
    const cache = this.getTierCache(tier);
    if (cache.size === 0) return;
    
    // Find least valuable entry (efficiency-based eviction)
    let victimKey: string | null = null;
    let minScore = Infinity;
    
    for (const [key, entry] of cache) {
      const age = Date.now() - entry.lastAccess;
      const score = this.calculateEfficiencyScore(entry, age);
      
      if (score < minScore) {
        minScore = score;
        victimKey = key;
      }
    }
    
    if (victimKey) {
      const victim = cache.get(victimKey)!;
      
      // Try to demote instead of evict
      const nextTier = this.getNextLowerTier(tier);
      if (nextTier && victim.accessCount >= this.config[tier].demotionThreshold) {
        await this.demoteEntry(victim, tier, nextTier);
      } else {
        // Full eviction
        cache.delete(victimKey);
        this.updateTierSize(tier, this.getTierSize(tier) - victim.size);
        this.stats.get(tier)!.evictions++;
      }
    }
  }
  
  private async promoteEntry(
    entry: CacheEntry<T>,
    fromTier: 'L1' | 'L2' | 'L3',
    toTier: 'L1' | 'L2' | 'L3'
  ): Promise<void> {
    const fromCache = this.getTierCache(fromTier);
    
    // Remove from current tier
    fromCache.delete(entry.key);
    this.updateTierSize(fromTier, this.getTierSize(fromTier) - entry.size);
    
    // Update tier and add to new tier
    entry.tier = toTier;
    await this.addToTier(entry, toTier);
    
    this.stats.get(fromTier)!.promotions++;
  }
  
  private async demoteEntry(
    entry: CacheEntry<T>,
    fromTier: 'L1' | 'L2' | 'L3',
    toTier: 'L1' | 'L2' | 'L3'
  ): Promise<void> {
    const fromCache = this.getTierCache(fromTier);
    
    // Remove from current tier
    fromCache.delete(entry.key);
    this.updateTierSize(fromTier, this.getTierSize(fromTier) - entry.size);
    
    // Update tier and add to new tier
    entry.tier = toTier;
    entry.accessCount = Math.floor(entry.accessCount / 2); // Reduce access count on demotion
    await this.addToTier(entry, toTier);
    
    this.stats.get(fromTier)!.demotions++;
  }
  
  private calculateEfficiencyScore(entry: CacheEntry<T>, age: number): number {
    // Higher score = more valuable to keep
    // Consider: access frequency, recency, size efficiency
    const frequencyScore = entry.accessCount;
    const recencyScore = 1 / (age + 1);
    const sizeEfficiency = entry.accessCount / entry.size;
    const prefetchBonus = entry.prefetchScore;
    
    return (
      frequencyScore * 0.4 +
      recencyScore * 10000 * 0.3 +
      sizeEfficiency * 1000 * 0.2 +
      prefetchBonus * 0.1
    );
  }
  
  private determineInitialTier(key: string, size: number): 'L1' | 'L2' | 'L3' {
    // Small, frequently accessed items go to L1
    if (size < 10240 && this.isPredictedHot(key)) {
      return 'L1';
    }
    
    // Medium items or moderately accessed go to L2
    if (size < 102400 || this.isPredictedWarm(key)) {
      return 'L2';
    }
    
    // Everything else starts in L3
    return 'L3';
  }
  
  private isPredictedHot(key: string): boolean {
    const patterns = this.accessPatterns.get(key);
    if (!patterns || patterns.length < 3) return false;
    
    // Check if access frequency is increasing
    const recent = patterns.slice(-3);
    return recent[2] - recent[0] < 1000; // Accessed 3 times within 1 second
  }
  
  private isPredictedWarm(key: string): boolean {
    const patterns = this.accessPatterns.get(key);
    if (!patterns || patterns.length < 2) return false;
    
    const recent = patterns.slice(-2);
    return recent[1] - recent[0] < 5000; // Accessed 2 times within 5 seconds
  }
  
  private predictRelatedKeys(key: string): string[] {
    const related: string[] = [];
    
    // For manga system, predict chapter navigation patterns
    const match = key.match(/^(.+)\/(\d+)\.(jpg|png|webp)$/);
    if (match) {
      const [, base, pageNum, ext] = match;
      const page = parseInt(pageNum);
      
      // Prefetch next 3 pages
      for (let i = 1; i <= 3; i++) {
        related.push(`${base}/${String(page + i).padStart(3, '0')}.${ext}`);
      }
    }
    
    return related;
  }
  
  private updateAccessPattern(key: string): void {
    if (!this.accessPatterns.has(key)) {
      this.accessPatterns.set(key, []);
    }
    
    const patterns = this.accessPatterns.get(key)!;
    patterns.push(Date.now());
    
    // Keep only last 10 accesses
    if (patterns.length > 10) {
      patterns.shift();
    }
  }
  
  private analyzePrefetchOpportunity(key: string): void {
    // Analyze if this miss is part of a pattern
    const similar = this.findSimilarKeys(key);
    
    for (const similarKey of similar) {
      const entry = this.getFromAnyTier(similarKey);
      if (entry) {
        entry.prefetchScore = Math.min(entry.prefetchScore + 0.1, 1);
      }
    }
  }
  
  private findSimilarKeys(key: string): string[] {
    const similar: string[] = [];
    const keyHash = this.hashKey(key);
    
    // Find keys with similar hash prefix (locality)
    for (const cache of [this.l1Cache, this.l2Cache, this.l3Cache]) {
      for (const [k] of cache) {
        if (this.hashKey(k).startsWith(keyHash.substring(0, 4))) {
          similar.push(k);
        }
      }
    }
    
    return similar;
  }
  
  private hashKey(key: string): string {
    return createHash('md5').update(key).digest('hex');
  }
  
  private getFromAnyTier(key: string): CacheEntry<T> | undefined {
    return this.l1Cache.get(key) || this.l2Cache.get(key) || this.l3Cache.get(key);
  }
  
  private getTierCache(tier: 'L1' | 'L2' | 'L3'): Map<string, CacheEntry<T>> {
    switch (tier) {
      case 'L1': return this.l1Cache;
      case 'L2': return this.l2Cache;
      case 'L3': return this.l3Cache;
    }
  }
  
  private getTierSize(tier: 'L1' | 'L2' | 'L3'): number {
    switch (tier) {
      case 'L1': return this.l1Size;
      case 'L2': return this.l2Size;
      case 'L3': return this.l3Size;
    }
  }
  
  private updateTierSize(tier: 'L1' | 'L2' | 'L3', newSize: number): void {
    switch (tier) {
      case 'L1': this.l1Size = newSize; break;
      case 'L2': this.l2Size = newSize; break;
      case 'L3': this.l3Size = newSize; break;
    }
  }
  
  private getNextLowerTier(tier: 'L1' | 'L2' | 'L3'): 'L2' | 'L3' | null {
    switch (tier) {
      case 'L1': return 'L2';
      case 'L2': return 'L3';
      case 'L3': return null;
    }
  }
  
  private recordHit(tier: 'L1' | 'L2' | 'L3', startTime: number): void {
    const stats = this.stats.get(tier)!;
    stats.hits++;
    stats.totalAccessTime += performance.now() - startTime;
  }
  
  private recordMiss(tier: 'L1' | 'L2' | 'L3', startTime: number): void {
    const stats = this.stats.get(tier)!;
    stats.misses++;
    stats.totalAccessTime += performance.now() - startTime;
  }
  
  private createEmptyStats(): CacheStats {
    return {
      hits: 0,
      misses: 0,
      evictions: 0,
      promotions: 0,
      demotions: 0,
      prefetchHits: 0,
      totalAccessTime: 0
    };
  }
  
  private estimateSize(value: any): number {
    // Simple size estimation
    if (typeof value === 'string') {
      return value.length * 2; // UTF-16
    } else if (Buffer.isBuffer(value)) {
      return value.length;
    } else if (typeof value === 'object') {
      return JSON.stringify(value).length * 2;
    } else {
      return 8; // Default for primitives
    }
  }
  
  private startMaintenanceLoop(): void {
    setInterval(() => {
      // Clean up expired entries
      const now = Date.now();
      
      for (const [tier, config] of Object.entries(this.config) as Array<['L1' | 'L2' | 'L3', TierConfig]>) {
        const cache = this.getTierCache(tier);
        
        for (const [key, entry] of cache) {
          if (now - entry.lastAccess > config.ttl) {
            cache.delete(key);
            this.updateTierSize(tier, this.getTierSize(tier) - entry.size);
          }
        }
      }
      
      // Clean up old access patterns
      for (const [key, patterns] of this.accessPatterns) {
        if (patterns.length > 0 && now - patterns[patterns.length - 1] > 3600000) {
          this.accessPatterns.delete(key);
        }
      }
    }, 60000); // Run every minute
  }
  
  private startPrefetchLoop(): void {
    // Periodic prefetch analysis
    setInterval(() => {
      // Analyze top accessed items for prefetch opportunities
      const hotItems: Array<[string, CacheEntry<T>]> = [];
      
      for (const [key, entry] of this.l1Cache) {
        if (entry.accessCount > 5) {
          hotItems.push([key, entry]);
        }
      }
      
      // Sort by access count
      hotItems.sort((a, b) => b[1].accessCount - a[1].accessCount);
      
      // Trigger prefetch for top items
      for (const [key] of hotItems.slice(0, 10)) {
        const related = this.predictRelatedKeys(key);
        for (const relatedKey of related) {
          if (!this.has(relatedKey)) {
            // Mark for potential prefetch
            this.prefetchQueue.add(relatedKey);
          }
        }
      }
    }, 5000); // Run every 5 seconds
  }

  // Server compatibility methods
  delete(key: string): boolean {
    let deleted = false;
    
    if (this.l1Cache.has(key)) {
      const entry = this.l1Cache.get(key)!;
      this.l1Cache.delete(key);
      this.l1Size -= entry.size;
      this.stats.get('L1')!.evictions++;
      deleted = true;
    }
    
    if (this.l2Cache.has(key)) {
      const entry = this.l2Cache.get(key)!;
      this.l2Cache.delete(key);
      this.l2Size -= entry.size;
      this.stats.get('L2')!.evictions++;
      deleted = true;
    }
    
    if (this.l3Cache.has(key)) {
      const entry = this.l3Cache.get(key)!;
      this.l3Cache.delete(key);
      this.l3Size -= entry.size;
      this.stats.get('L3')!.evictions++;
      deleted = true;
    }
    
    if (deleted) {
      this.accessPatterns.delete(key);
    }
    
    return deleted;
  }

  get size(): number {
    return this.l1Cache.size + this.l2Cache.size + this.l3Cache.size;
  }

  keys(): IterableIterator<string> {
    const allKeys = new Set<string>();
    
    for (const key of this.l1Cache.keys()) {
      allKeys.add(key);
    }
    for (const key of this.l2Cache.keys()) {
      allKeys.add(key);
    }
    for (const key of this.l3Cache.keys()) {
      allKeys.add(key);
    }
    
    return allKeys.keys();
  }

  has(key: string): boolean {
    return this.l1Cache.has(key) || this.l2Cache.has(key) || this.l3Cache.has(key);
  }

  adaptToMemoryPressure(): void {
    // Reduce cache sizes under memory pressure
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = memoryUsage.heapUsed / (1024 * 1024);
    
    if (heapUsedMB > 500) { // High memory pressure
      // Reduce L3 cache by 50%
      const l3Target = Math.floor(this.l3Cache.size / 2);
      let evicted = 0;
      
      for (const [key, entry] of this.l3Cache) {
        if (evicted >= l3Target) break;
        this.l3Cache.delete(key);
        this.l3Size -= entry.size;
        this.stats.get('L3')!.evictions++;
        evicted++;
      }
      
      // Reduce L2 cache by 25%
      const l2Target = Math.floor(this.l2Cache.size / 4);
      evicted = 0;
      
      for (const [key, entry] of this.l2Cache) {
        if (evicted >= l2Target) break;
        this.l2Cache.delete(key);
        this.l2Size -= entry.size;
        this.stats.get('L2')!.evictions++;
        evicted++;
      }
      
      console.log('🧹 Cache adapted to memory pressure - reduced by ~35%');
    }
  }

  // CRITICAL FIX: Add missing handleMemoryPressure method for IntegratedOptimizationSystem
  async handleMemoryPressure(level: 'low' | 'medium' | 'high'): Promise<void> {
    const reductionPercent = {
      low: 10,      // Reduce cache by 10%
      medium: 25,   // Reduce cache by 25%
      high: 50      // Reduce cache by 50%
    }[level];

    console.log(`🧹 Cache handling ${level} memory pressure - reducing by ${reductionPercent}%`);

    // Calculate targets for each tier
    const l1Target = Math.floor(this.l1Cache.size * (reductionPercent / 100));
    const l2Target = Math.floor(this.l2Cache.size * (reductionPercent / 100));
    const l3Target = Math.floor(this.l3Cache.size * (reductionPercent / 100));

    let totalEvicted = 0;

    // Evict from L3 first (least important)
    let evicted = 0;
    for (const [key, entry] of this.l3Cache) {
      if (evicted >= l3Target) break;
      this.l3Cache.delete(key);
      this.l3Size -= entry.size;
      this.stats.get('L3')!.evictions++;
      evicted++;
      totalEvicted++;
    }

    // Evict from L2 if high pressure
    if (level === 'high' || level === 'medium') {
      evicted = 0;
      for (const [key, entry] of this.l2Cache) {
        if (evicted >= l2Target) break;
        this.l2Cache.delete(key);
        this.l2Size -= entry.size;
        this.stats.get('L2')!.evictions++;
        evicted++;
        totalEvicted++;
      }
    }

    // Only touch L1 under extreme pressure
    if (level === 'high') {
      evicted = 0;
      for (const [key, entry] of this.l1Cache) {
        if (evicted >= l1Target) break;
        this.l1Cache.delete(key);
        this.l1Size -= entry.size;
        this.stats.get('L1')!.evictions++;
        evicted++;
        totalEvicted++;
      }
    }

    console.log(`🧹 Cache pressure handling complete - evicted ${totalEvicted} entries`);
  }

  // CRITICAL FIX: Add alias for IntegratedOptimizationSystem compatibility
  getAdvancedMetrics() {
    return this.getStats();
  }
}

// Export singleton instance for easy usage
export const hybridCache = new HybridCacheSystem(4096); // 4GB default cache