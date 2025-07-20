import { cache, CacheKeys, CacheTTL } from './cache';

// CDN and file storage caching configuration
export const CDNConfig = {
  // Cache control headers for different file types
  cacheHeaders: {
    // Static assets (long cache)
    images: {
      'Cache-Control': 'public, max-age=31536000, immutable', // 1 year
      'CDN-Cache-Control': 'public, max-age=31536000',
    },
    // Evidence files (medium cache with validation)
    evidence: {
      'Cache-Control': 'private, max-age=3600, must-revalidate', // 1 hour
      'CDN-Cache-Control': 'private, max-age=1800', // 30 minutes
    },
    // API responses (short cache)
    api: {
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=60', // 5 minutes
      'CDN-Cache-Control': 'public, max-age=300',
    },
    // Dynamic content (no cache)
    dynamic: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'CDN-Cache-Control': 'no-cache',
    },
  },

  // File type mappings
  getFileTypeCategory(mimeType: string): keyof typeof CDNConfig.cacheHeaders {
    if (mimeType.startsWith('image/')) return 'images';
    if (mimeType.includes('pdf') || 
        mimeType.includes('document') || 
        mimeType.includes('spreadsheet')) return 'evidence';
    return 'dynamic';
  },
};

// File metadata caching
export class FileMetadataCache {
  // Cache file metadata to avoid repeated S3 calls
  async getFileMetadata(storageKey: string): Promise<any> {
    const cacheKey = `file:metadata:${storageKey}`;
    
    return await cache.warmCache(
      cacheKey,
      async () => {
        // This would typically call your storage service
        // For now, return null to indicate no cached metadata
        return null;
      },
      CacheTTL.LONG
    );
  }

  async setFileMetadata(storageKey: string, metadata: any): Promise<void> {
    const cacheKey = `file:metadata:${storageKey}`;
    await cache.set(cacheKey, metadata, CacheTTL.LONG);
  }

  async invalidateFileMetadata(storageKey: string): Promise<void> {
    const cacheKey = `file:metadata:${storageKey}`;
    await cache.del(cacheKey);
  }
}

// File download URL caching
export class FileURLCache {
  // Cache pre-signed URLs to reduce S3 API calls
  async getDownloadURL(storageKey: string, expiresIn: number = 3600): Promise<string | null> {
    const cacheKey = `file:url:${storageKey}`;
    
    // Check if we have a cached URL that's still valid
    const cached = await cache.get<{url: string, expiresAt: number}>(cacheKey);
    
    if (cached && cached.expiresAt > Date.now()) {
      return cached.url;
    }

    return null;
  }

  async setDownloadURL(storageKey: string, url: string, expiresIn: number = 3600): Promise<void> {
    const cacheKey = `file:url:${storageKey}`;
    const expiresAt = Date.now() + (expiresIn * 1000);
    
    // Cache for 90% of the actual expiry time to ensure validity
    const cacheTTL = Math.floor(expiresIn * 0.9);
    
    await cache.set(cacheKey, { url, expiresAt }, cacheTTL);
  }

  async invalidateDownloadURL(storageKey: string): Promise<void> {
    const cacheKey = `file:url:${storageKey}`;
    await cache.del(cacheKey);
  }
}

// Thumbnail and preview caching
export class ThumbnailCache {
  // Cache generated thumbnails
  async getThumbnail(fileId: string, size: string): Promise<Buffer | null> {
    const cacheKey = `thumbnail:${fileId}:${size}`;
    
    const cached = await cache.get<{data: string}>(cacheKey);
    if (cached) {
      return Buffer.from(cached.data, 'base64');
    }
    
    return null;
  }

  async setThumbnail(fileId: string, size: string, thumbnailBuffer: Buffer): Promise<void> {
    const cacheKey = `thumbnail:${fileId}:${size}`;
    const data = thumbnailBuffer.toString('base64');
    
    // Cache thumbnails for a long time since they rarely change
    await cache.set(cacheKey, { data }, CacheTTL.VERY_LONG);
  }

  async invalidateThumbnails(fileId: string): Promise<void> {
    await cache.delPattern(`thumbnail:${fileId}:*`);
  }
}

// Content delivery optimization
export class ContentDeliveryCache {
  private fileMetadataCache = new FileMetadataCache();
  private fileURLCache = new FileURLCache();
  private thumbnailCache = new ThumbnailCache();

  // Get optimized file delivery configuration
  getDeliveryConfig(mimeType: string, fileSize: number) {
    const category = CDNConfig.getFileTypeCategory(mimeType);
    const headers = CDNConfig.cacheHeaders[category];

    return {
      headers,
      shouldCompress: fileSize > 1024 && !mimeType.startsWith('image/'),
      shouldThumbnail: mimeType.startsWith('image/') && fileSize > 100 * 1024, // 100KB
      cacheStrategy: category,
    };
  }

  // Preload frequently accessed files
  async preloadFile(storageKey: string): Promise<void> {
    try {
      // This would typically trigger a CDN cache warming request
      console.log(`Preloading file: ${storageKey}`);
      
      // You could implement actual CDN cache warming here
      // For example, making a HEAD request to your CDN endpoint
    } catch (error) {
      console.error(`Failed to preload file ${storageKey}:`, error);
    }
  }

  // Batch preload multiple files
  async batchPreload(storageKeys: string[]): Promise<void> {
    const preloadPromises = storageKeys.map(key => this.preloadFile(key));
    await Promise.allSettled(preloadPromises);
  }

  // Get file metadata cache instance
  get metadata() {
    return this.fileMetadataCache;
  }

  // Get file URL cache instance
  get urls() {
    return this.fileURLCache;
  }

  // Get thumbnail cache instance
  get thumbnails() {
    return this.thumbnailCache;
  }
}

// Export singleton instance
export const contentDeliveryCache = new ContentDeliveryCache();

// Cache warming for frequently accessed files
export const FilesCacheWarming = {
  // Warm cache for recently uploaded evidence
  async warmRecentEvidence(limit: number = 50): Promise<void> {
    try {
      // This would typically query your database for recent evidence
      // and preload their metadata and URLs
      console.log(`Warming cache for ${limit} recent evidence files`);
    } catch (error) {
      console.error('Failed to warm recent evidence cache:', error);
    }
  },

  // Warm cache for user's assigned evidence
  async warmUserEvidence(userId: string): Promise<void> {
    try {
      // This would typically query evidence assigned to the user
      // and preload their metadata
      console.log(`Warming evidence cache for user ${userId}`);
    } catch (error) {
      console.error(`Failed to warm evidence cache for user ${userId}:`, error);
    }
  },

  // Warm cache for dashboard thumbnails
  async warmDashboardThumbnails(): Promise<void> {
    try {
      // This would typically preload thumbnails for dashboard previews
      console.log('Warming dashboard thumbnails cache');
    } catch (error) {
      console.error('Failed to warm dashboard thumbnails cache:', error);
    }
  },
};