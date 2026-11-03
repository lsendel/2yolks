// Enhanced API utilities with caching and optimization
import { Recipe, User, Review } from '../types/api';

// API Response cache
const cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

// Cache TTL in milliseconds
const CACHE_TTL = {
  recipes: 5 * 60 * 1000, // 5 minutes
  users: 10 * 60 * 1000, // 10 minutes
  reviews: 2 * 60 * 1000, // 2 minutes
  featured: 15 * 60 * 1000, // 15 minutes
};

export class ApiCache {
  static set(key: string, data: any, ttl: number = 5 * 60 * 1000) {
    cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  static get(key: string): any | null {
    const cached = cache.get(key);
    if (!cached) return null;

    const isExpired = Date.now() - cached.timestamp > cached.ttl;
    if (isExpired) {
      cache.delete(key);
      return null;
    }

    return cached.data;
  }

  static clear(pattern?: string) {
    if (pattern) {
      for (const key of cache.keys()) {
        if (key.includes(pattern)) {
          cache.delete(key);
        }
      }
    } else {
      cache.clear();
    }
  }
}

// Request deduplication
const pendingRequests = new Map<string, Promise<any>>();

export class ApiOptimizer {
  static async dedupedRequest<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    // Check cache first
    const cached = ApiCache.get(key);
    if (cached) return cached;

    // Check if request is already pending
    if (pendingRequests.has(key)) {
      return pendingRequests.get(key);
    }

    // Make new request
    const promise = requestFn().then((data) => {
      pendingRequests.delete(key);
      return data;
    }).catch((error) => {
      pendingRequests.delete(key);
      throw error;
    });

    pendingRequests.set(key, promise);
    return promise;
  }

  static batchRequests<T>(
    requests: Array<() => Promise<T>>,
    batchSize: number = 5
  ): Promise<T[]> {
    const batches: Array<Array<() => Promise<T>>> = [];
    
    for (let i = 0; i < requests.length; i += batchSize) {
      batches.push(requests.slice(i, i + batchSize));
    }

    return batches.reduce(async (acc, batch) => {
      const results = await acc;
      const batchResults = await Promise.all(batch.map(req => req()));
      return [...results, ...batchResults];
    }, Promise.resolve([] as T[]));
  }
}

// Enhanced API client with retry logic
export class EnhancedApiClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;
  private retryAttempts: number = 3;
  private retryDelay: number = 1000;

  constructor(baseURL: string = '/api') {
    this.baseURL = baseURL;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async retryRequest<T>(
    requestFn: () => Promise<Response>,
    attempt: number = 1
  ): Promise<T> {
    try {
      const response = await requestFn();
      
      if (!response.ok) {
        if (response.status >= 500 && attempt < this.retryAttempts) {
          await this.delay(this.retryDelay * attempt);
          return this.retryRequest(requestFn, attempt + 1);
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (attempt < this.retryAttempts && 
          (error instanceof TypeError || error.message.includes('fetch'))) {
        await this.delay(this.retryDelay * attempt);
        return this.retryRequest(requestFn, attempt + 1);
      }
      throw error;
    }
  }

  async get<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const cacheKey = `GET:${endpoint}`;
    
    return ApiOptimizer.dedupedRequest(cacheKey, async () => {
      const data = await this.retryRequest<T>(() =>
        fetch(`${this.baseURL}${endpoint}`, {
          method: 'GET',
          headers: { ...this.defaultHeaders, ...options.headers },
          ...options,
        })
      );

      // Cache successful GET requests
      ApiCache.set(cacheKey, data, CACHE_TTL.recipes);
      return data;
    });
  }

  async post<T>(endpoint: string, body: any, options: RequestInit = {}): Promise<T> {
    const data = await this.retryRequest<T>(() =>
      fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers: { ...this.defaultHeaders, ...options.headers },
        body: JSON.stringify(body),
        ...options,
      })
    );

    // Clear related cache entries
    ApiCache.clear(endpoint.split('/')[1]);
    return data;
  }

  async put<T>(endpoint: string, body: any, options: RequestInit = {}): Promise<T> {
    const data = await this.retryRequest<T>(() =>
      fetch(`${this.baseURL}${endpoint}`, {
        method: 'PUT',
        headers: { ...this.defaultHeaders, ...options.headers },
        body: JSON.stringify(body),
        ...options,
      })
    );

    // Clear related cache entries
    ApiCache.clear(endpoint.split('/')[1]);
    return data;
  }

  async delete<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const data = await this.retryRequest<T>(() =>
      fetch(`${this.baseURL}${endpoint}`, {
        method: 'DELETE',
        headers: { ...this.defaultHeaders, ...options.headers },
        ...options,
      })
    );

    // Clear related cache entries
    ApiCache.clear(endpoint.split('/')[1]);
    return data;
  }

  setAuthToken(token: string) {
    this.defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  removeAuthToken() {
    delete this.defaultHeaders['Authorization'];
  }
}

// Optimized recipe fetching with pagination
export class RecipeApi {
  private client: EnhancedApiClient;

  constructor(client: EnhancedApiClient) {
    this.client = client;
  }

  async getFeaturedRecipes(limit: number = 6): Promise<Recipe[]> {
    const cacheKey = `featured-recipes-${limit}`;
    const cached = ApiCache.get(cacheKey);
    if (cached) return cached;

    const data = await this.client.get<{ recipes: Recipe[] }>(
      `/recipes/featured?limit=${limit}`
    );

    ApiCache.set(cacheKey, data.recipes, CACHE_TTL.featured);
    return data.recipes;
  }

  async getRecipes(params: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    difficulty?: string;
  } = {}): Promise<{ recipes: Recipe[]; total: number; hasMore: boolean }> {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams.append(key, value.toString());
      }
    });

    const endpoint = `/recipes?${queryParams.toString()}`;
    const data = await this.client.get<{
      recipes: Recipe[];
      pagination: { total: number; page: number; totalPages: number };
    }>(endpoint);

    return {
      recipes: data.recipes,
      total: data.pagination.total,
      hasMore: data.pagination.page < data.pagination.totalPages,
    };
  }

  async getRecipe(id: string): Promise<Recipe> {
    return this.client.get<Recipe>(`/recipes/${id}`);
  }

  async searchRecipes(query: string, filters: any = {}): Promise<Recipe[]> {
    const params = new URLSearchParams({ q: query, ...filters });
    const data = await this.client.get<{ recipes: Recipe[] }>(
      `/recipes/search?${params.toString()}`
    );
    return data.recipes;
  }
}

// Performance monitoring
export class PerformanceMonitor {
  private static metrics = new Map<string, number[]>();

  static startTimer(label: string): () => void {
    const start = performance.now();
    
    return () => {
      const duration = performance.now() - start;
      
      if (!this.metrics.has(label)) {
        this.metrics.set(label, []);
      }
      
      this.metrics.get(label)!.push(duration);
      
      // Keep only last 100 measurements
      const measurements = this.metrics.get(label)!;
      if (measurements.length > 100) {
        measurements.shift();
      }
      
      console.log(`⏱️ ${label}: ${duration.toFixed(2)}ms`);
    };
  }

  static getAverageTime(label: string): number {
    const measurements = this.metrics.get(label);
    if (!measurements || measurements.length === 0) return 0;
    
    return measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
  }

  static getMetrics(): Record<string, { average: number; count: number }> {
    const result: Record<string, { average: number; count: number }> = {};
    
    for (const [label, measurements] of this.metrics.entries()) {
      result[label] = {
        average: this.getAverageTime(label),
        count: measurements.length,
      };
    }
    
    return result;
  }
}

// Export enhanced client instance
export const enhancedApiClient = new EnhancedApiClient();
export const recipeApi = new RecipeApi(enhancedApiClient);