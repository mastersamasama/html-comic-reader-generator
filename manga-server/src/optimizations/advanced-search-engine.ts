/**
 * Advanced Search Engine with Multiple Optimization Techniques
 * Features: Bloom filters, inverted index, fuzzy matching, and autocomplete
 */

interface SearchResult {
  id: string;
  title: string;
  score: number;
  matchType: 'exact' | 'fuzzy' | 'partial' | 'phonetic';
  matchedFields: string[];
  highlights: Record<string, string>;
}

interface SearchMetrics {
  totalSearches: number;
  avgSearchTime: number;
  bloomFilterRejects: number;
  cacheHits: number;
  fuzzySearches: number;
  exactMatches: number;
}

interface IndexEntry {
  id: string;
  title: string;
  titleNormalized: string;
  tokens: string[];
  soundex: string;
  trigrams: Set<string>;
  metadata: any;
}

class AdvancedSearchEngine {
  private bloomFilter: BloomFilter;
  private invertedIndex = new Map<string, Set<string>>(); // token -> document IDs
  private trigramIndex = new Map<string, Set<string>>(); // trigram -> document IDs
  private soundexIndex = new Map<string, Set<string>>(); // soundex -> document IDs
  private documentStore = new Map<string, IndexEntry>();
  private searchCache = new Map<string, SearchResult[]>();
  private autocompleteIndex = new Map<string, string[]>();
  
  private metrics: SearchMetrics = {
    totalSearches: 0,
    avgSearchTime: 0,
    bloomFilterRejects: 0,
    cacheHits: 0,
    fuzzySearches: 0,
    exactMatches: 0
  };

  constructor(expectedDocuments = 100000) {
    this.bloomFilter = new BloomFilter(expectedDocuments, 0.001); // 0.1% false positive rate
    this.initializeSearch();
  }

  // Build optimized indexes from manga collection
  buildIndexes(mangaCollection: any[]): void {
    console.log(`Building search indexes for ${mangaCollection.length} documents...`);
    const startTime = performance.now();
    
    // Clear existing indexes
    this.clearIndexes();
    
    // Build all indexes in parallel
    const indexPromises = mangaCollection.map(manga => this.indexDocument(manga));
    
    Promise.all(indexPromises).then(() => {
      const buildTime = performance.now() - startTime;
      console.log(`Search indexes built in ${buildTime.toFixed(2)}ms`);
      this.buildAutocompleteIndex();
    });
  }

  private async indexDocument(manga: any): Promise<void> {
    const entry: IndexEntry = {
      id: manga.id,
      title: manga.title,
      titleNormalized: this.normalizeString(manga.title),
      tokens: this.tokenize(manga.title),
      soundex: this.generateSoundex(manga.title),
      trigrams: this.generateTrigrams(manga.title),
      metadata: manga
    };
    
    // Store document
    this.documentStore.set(manga.id, entry);
    
    // Add to bloom filter
    this.bloomFilter.add(entry.titleNormalized);
    
    // Build inverted index
    for (const token of entry.tokens) {
      if (!this.invertedIndex.has(token)) {
        this.invertedIndex.set(token, new Set());
      }
      this.invertedIndex.get(token)!.add(manga.id);
    }
    
    // Build trigram index for fuzzy search
    for (const trigram of entry.trigrams) {
      if (!this.trigramIndex.has(trigram)) {
        this.trigramIndex.set(trigram, new Set());
      }
      this.trigramIndex.get(trigram)!.add(manga.id);
    }
    
    // Build soundex index for phonetic search
    if (entry.soundex) {
      if (!this.soundexIndex.has(entry.soundex)) {
        this.soundexIndex.set(entry.soundex, new Set());
      }
      this.soundexIndex.get(entry.soundex)!.add(manga.id);
    }
  }

  // Ultra-fast search with multiple strategies
  search(query: string, options: {
    limit?: number;
    fuzzy?: boolean;
    phonetic?: boolean;
    autocomplete?: boolean;
  } = {}): SearchResult[] {
    const startTime = performance.now();
    this.metrics.totalSearches++;
    
    const { limit = 50, fuzzy = true, phonetic = false, autocomplete = false } = options;
    
    if (!query || query.length < 1) {
      return [];
    }
    
    // Check search cache
    const cacheKey = `${query}:${JSON.stringify(options)}`;
    const cached = this.searchCache.get(cacheKey);
    if (cached) {
      this.metrics.cacheHits++;
      return cached.slice(0, limit);
    }
    
    const normalizedQuery = this.normalizeString(query);
    
    // Bloom filter pre-check (ultra-fast rejection)
    if (!this.bloomFilter.mightContain(normalizedQuery)) {
      const queryTokens = this.tokenize(query);
      const hasAnyToken = queryTokens.some(token => this.bloomFilter.mightContain(token));
      
      if (!hasAnyToken) {
        this.metrics.bloomFilterRejects++;
        return [];
      }
    }
    
    // Multi-strategy search
    const results = new Map<string, SearchResult>();
    
    // 1. Exact match search (highest priority)
    this.performExactSearch(query, results);
    
    // 2. Token-based search
    this.performTokenSearch(query, results);
    
    // 3. Fuzzy search (if enabled and needed)
    if (fuzzy && results.size < limit) {
      this.performFuzzySearch(query, results);
    }
    
    // 4. Phonetic search (if enabled)
    if (phonetic && results.size < limit) {
      this.performPhoneticSearch(query, results);
    }
    
    // Convert to array and sort by score
    const sortedResults = Array.from(results.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    // Add highlights
    this.addHighlights(sortedResults, query);
    
    // Cache results
    this.cacheSearchResults(cacheKey, sortedResults);
    
    // Update metrics
    const searchTime = performance.now() - startTime;
    this.metrics.avgSearchTime = (this.metrics.avgSearchTime * 0.9) + (searchTime * 0.1);
    
    return sortedResults;
  }

  private performExactSearch(query: string, results: Map<string, SearchResult>): void {
    const normalizedQuery = this.normalizeString(query);
    
    for (const [id, entry] of this.documentStore) {
      if (entry.titleNormalized.includes(normalizedQuery)) {
        const score = this.calculateExactScore(entry.titleNormalized, normalizedQuery);
        
        results.set(id, {
          id,
          title: entry.title,
          score,
          matchType: entry.titleNormalized === normalizedQuery ? 'exact' : 'partial',
          matchedFields: ['title'],
          highlights: {}
        });
        
        if (entry.titleNormalized === normalizedQuery) {
          this.metrics.exactMatches++;
        }
      }
    }
  }

  private performTokenSearch(query: string, results: Map<string, SearchResult>): void {
    const queryTokens = this.tokenize(query);
    const candidateIds = new Set<string>();
    
    // Find all documents containing any query token
    for (const token of queryTokens) {
      const documentIds = this.invertedIndex.get(token);
      if (documentIds) {
        documentIds.forEach(id => candidateIds.add(id));
      }
    }
    
    // Score candidates based on token matches
    for (const id of candidateIds) {
      if (results.has(id)) continue; // Skip if already found in exact search
      
      const entry = this.documentStore.get(id)!;
      const score = this.calculateTokenScore(entry.tokens, queryTokens);
      
      if (score > 0.1) { // Minimum threshold
        results.set(id, {
          id,
          title: entry.title,
          score,
          matchType: 'partial',
          matchedFields: ['title'],
          highlights: {}
        });
      }
    }
  }

  private performFuzzySearch(query: string, results: Map<string, SearchResult>): void {
    this.metrics.fuzzySearches++;
    
    const queryTrigrams = this.generateTrigrams(query);
    const candidateScores = new Map<string, number>();
    
    // Find candidates using trigram similarity
    for (const trigram of queryTrigrams) {
      const documentIds = this.trigramIndex.get(trigram);
      if (documentIds) {
        for (const id of documentIds) {
          if (results.has(id)) continue; // Skip if already found
          
          const currentScore = candidateScores.get(id) || 0;
          candidateScores.set(id, currentScore + 1);
        }
      }
    }
    
    // Calculate final fuzzy scores
    const queryTrigramCount = queryTrigrams.size;
    
    for (const [id, trigramMatches] of candidateScores) {
      const entry = this.documentStore.get(id)!;
      const entryTrigramCount = entry.trigrams.size;
      
      // Jaccard similarity for trigrams
      const unionSize = queryTrigramCount + entryTrigramCount - trigramMatches;
      const similarity = trigramMatches / unionSize;
      
      if (similarity > 0.3) { // Minimum fuzzy threshold
        // Additional Levenshtein distance check for precision
        const editDistance = this.calculateEditDistance(query, entry.title);
        const maxLength = Math.max(query.length, entry.title.length);
        const editSimilarity = 1 - (editDistance / maxLength);
        
        // Combined score
        const finalScore = (similarity * 0.6) + (editSimilarity * 0.4);
        
        if (finalScore > 0.4) {
          results.set(id, {
            id,
            title: entry.title,
            score: finalScore,
            matchType: 'fuzzy',
            matchedFields: ['title'],
            highlights: {}
          });
        }
      }
    }
  }

  private performPhoneticSearch(query: string, results: Map<string, SearchResult>): void {
    const querySoundex = this.generateSoundex(query);
    if (!querySoundex) return;
    
    const documentIds = this.soundexIndex.get(querySoundex);
    if (!documentIds) return;
    
    for (const id of documentIds) {
      if (results.has(id)) continue; // Skip if already found
      
      const entry = this.documentStore.get(id)!;
      results.set(id, {
        id,
        title: entry.title,
        score: 0.6, // Lower score for phonetic matches
        matchType: 'phonetic',
        matchedFields: ['title'],
        highlights: {}
      });
    }
  }

  // Autocomplete suggestions
  getAutocompleteSuggestions(prefix: string, limit: number = 10): string[] {
    const normalizedPrefix = this.normalizeString(prefix);
    const suggestions = this.autocompleteIndex.get(normalizedPrefix) || [];
    return suggestions.slice(0, limit);
  }

  private buildAutocompleteIndex(): void {
    const prefixes = new Map<string, Set<string>>();
    
    for (const entry of this.documentStore.values()) {
      const title = entry.titleNormalized;
      
      // Generate prefixes for autocomplete
      for (let i = 1; i <= Math.min(title.length, 20); i++) {
        const prefix = title.substring(0, i);
        
        if (!prefixes.has(prefix)) {
          prefixes.set(prefix, new Set());
        }
        prefixes.get(prefix)!.add(entry.title);
      }
      
      // Generate token prefixes
      for (const token of entry.tokens) {
        for (let i = 1; i <= Math.min(token.length, 10); i++) {
          const prefix = token.substring(0, i);
          
          if (!prefixes.has(prefix)) {
            prefixes.set(prefix, new Set());
          }
          prefixes.get(prefix)!.add(entry.title);
        }
      }
    }
    
    // Convert to final autocomplete index
    for (const [prefix, titlesSet] of prefixes) {
      const titles = Array.from(titlesSet).sort();
      this.autocompleteIndex.set(prefix, titles);
    }
  }

  // Utility methods
  private normalizeString(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fff]/g, '') // Keep alphanumeric and CJK
      .replace(/\s+/g, ' ')
      .trim();
  }

  private tokenize(text: string): string[] {
    const normalized = this.normalizeString(text);
    return normalized.split(/\s+/).filter(token => token.length > 0);
  }

  private generateTrigrams(text: string): Set<string> {
    const trigrams = new Set<string>();
    const normalized = this.normalizeString(text);
    const padded = `  ${normalized}  `; // Add padding for edge trigrams
    
    for (let i = 0; i <= padded.length - 3; i++) {
      const trigram = padded.substring(i, i + 3);
      trigrams.add(trigram);
    }
    
    return trigrams;
  }

  private generateSoundex(text: string): string {
    const normalized = this.normalizeString(text);
    if (!normalized) return '';
    
    // Simplified Soundex algorithm
    const firstChar = normalized[0].toUpperCase();
    let code = firstChar;
    
    const mapping: Record<string, string> = {
      'bfpv': '1', 'cgjkqsxz': '2', 'dt': '3',
      'l': '4', 'mn': '5', 'r': '6'
    };
    
    for (let i = 1; i < normalized.length && code.length < 4; i++) {
      const char = normalized[i];
      
      for (const [letters, digit] of Object.entries(mapping)) {
        if (letters.includes(char)) {
          code += digit;
          break;
        }
      }
    }
    
    return code.padEnd(4, '0').substring(0, 4);
  }

  private calculateExactScore(text: string, query: string): number {
    if (text === query) return 1.0;
    if (text.startsWith(query)) return 0.9;
    if (text.includes(query)) {
      // Score based on position and length ratio
      const position = text.indexOf(query);
      const positionScore = 1 - (position / text.length);
      const lengthScore = query.length / text.length;
      return 0.7 + (positionScore * 0.1) + (lengthScore * 0.1);
    }
    return 0;
  }

  private calculateTokenScore(entryTokens: string[], queryTokens: string[]): number {
    let matches = 0;
    let totalWeight = 0;
    
    for (const queryToken of queryTokens) {
      for (const entryToken of entryTokens) {
        if (entryToken.includes(queryToken)) {
          const weight = queryToken.length / entryToken.length;
          matches += weight;
        }
      }
      totalWeight += 1;
    }
    
    return matches / totalWeight;
  }

  private calculateEditDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + substitutionCost // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private addHighlights(results: SearchResult[], query: string): void {
    const queryTokens = this.tokenize(query);
    
    for (const result of results) {
      const title = result.title.toLowerCase();
      let highlightedTitle = result.title;
      
      // Highlight matching tokens
      for (const token of queryTokens) {
        const regex = new RegExp(`(${this.escapeRegex(token)})`, 'gi');
        highlightedTitle = highlightedTitle.replace(regex, '<mark>$1</mark>');
      }
      
      if (highlightedTitle !== result.title) {
        result.highlights.title = highlightedTitle;
      }
    }
  }

  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private cacheSearchResults(key: string, results: SearchResult[]): void {
    this.searchCache.set(key, results);
    
    // Limit cache size
    if (this.searchCache.size > 10000) {
      const firstKey = this.searchCache.keys().next().value;
      if (firstKey) {
        this.searchCache.delete(firstKey);
      }
    }
  }

  private clearIndexes(): void {
    this.invertedIndex.clear();
    this.trigramIndex.clear();
    this.soundexIndex.clear();
    this.documentStore.clear();
    this.searchCache.clear();
    this.autocompleteIndex.clear();
  }

  private initializeSearch(): void {
    // Periodic cache cleanup
    setInterval(() => {
      // Clear old search cache entries
      if (this.searchCache.size > 5000) {
        const entries = Array.from(this.searchCache.keys());
        const toDelete = entries.slice(0, 2000);
        toDelete.forEach(key => this.searchCache.delete(key));
      }
    }, 300000); // Every 5 minutes
  }

  // Performance monitoring
  getSearchMetrics() {
    const bloomFilterEfficiency = this.metrics.bloomFilterRejects / Math.max(this.metrics.totalSearches, 1);
    const cacheHitRate = this.metrics.cacheHits / Math.max(this.metrics.totalSearches, 1);
    
    return {
      ...this.metrics,
      bloomFilterEfficiency: (bloomFilterEfficiency * 100).toFixed(2) + '%',
      cacheHitRate: (cacheHitRate * 100).toFixed(2) + '%',
      indexSizes: {
        documents: this.documentStore.size,
        invertedIndex: this.invertedIndex.size,
        trigramIndex: this.trigramIndex.size,
        soundexIndex: this.soundexIndex.size,
        autocomplete: this.autocompleteIndex.size
      }
    };
  }
}

// Bloom Filter implementation (optimized for search)
class BloomFilter {
  private bitArray: Uint8Array;
  private hashFunctions: number;
  private size: number;

  constructor(expectedItems: number, falsePositiveRate: number = 0.01) {
    // Calculate optimal size and hash functions
    this.size = Math.ceil(-(expectedItems * Math.log(falsePositiveRate)) / (Math.log(2) ** 2));
    this.hashFunctions = Math.ceil((this.size / expectedItems) * Math.log(2));
    this.bitArray = new Uint8Array(Math.ceil(this.size / 8));
  }

  add(item: string): void {
    const hashes = this.getHashes(item);
    for (const hash of hashes) {
      const index = hash % this.size;
      const byteIndex = Math.floor(index / 8);
      const bitIndex = index % 8;
      this.bitArray[byteIndex] |= (1 << bitIndex);
    }
  }

  mightContain(item: string): boolean {
    const hashes = this.getHashes(item);
    for (const hash of hashes) {
      const index = hash % this.size;
      const byteIndex = Math.floor(index / 8);
      const bitIndex = index % 8;
      if ((this.bitArray[byteIndex] & (1 << bitIndex)) === 0) {
        return false;
      }
    }
    return true;
  }

  private getHashes(item: string): number[] {
    const hashes: number[] = [];
    let hash1 = this.djb2Hash(item);
    let hash2 = this.sdbmHash(item);
    
    for (let i = 0; i < this.hashFunctions; i++) {
      hashes.push(Math.abs(hash1 + i * hash2));
    }
    
    return hashes;
  }

  private djb2Hash(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  }

  private sdbmHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + (hash << 6) + (hash << 16) - hash;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  }
}

export { AdvancedSearchEngine, BloomFilter };