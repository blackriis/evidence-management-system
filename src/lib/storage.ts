// Edge runtime compatible UUID generation
const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  } else {
    // Fallback UUID v4 implementation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
};
import { writeFile, mkdir, readFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export interface UploadResult {
  key: string;
  url: string;
  size: number;
  contentType: string;
}

export interface UploadOptions {
  userId: string;
  academicYearId: string;
  subIndicatorId: string;
  originalName: string;
  contentType: string;
  size: number;
}

export class FileStorageService {
  private uploadDir: string;

  constructor() {
    this.uploadDir = path.join(process.cwd(), 'uploads', 'evidence');
  }

  private generateStorageKey(options: UploadOptions): string {
    const { userId, academicYearId, subIndicatorId, originalName } = options;
    const timestamp = Date.now();
    const uuid = generateUUID();
    const ext = originalName.split('.').pop();
    
    return `${academicYearId}/${subIndicatorId}/${userId}/${timestamp}-${uuid}.${ext}`;
  }

  async uploadFile(buffer: Buffer, options: UploadOptions): Promise<UploadResult> {
    try {
      const key = this.generateStorageKey(options);
      const filePath = path.join(this.uploadDir, key);
      
      // Create directory structure if it doesn't exist
      await mkdir(path.dirname(filePath), { recursive: true });

      // Write file to disk
      await writeFile(filePath, buffer);

      return {
        key,
        url: `/api/evidence/download/${encodeURIComponent(key)}`,
        size: options.size,
        contentType: options.contentType,
      };
    } catch (error) {
      console.error('File upload error:', error);
      throw new Error('Failed to upload file to storage');
    }
  }

  async getFile(key: string): Promise<Buffer> {
    try {
      const filePath = path.join(this.uploadDir, key);
      
      if (!existsSync(filePath)) {
        throw new Error('File not found');
      }

      return await readFile(filePath);
    } catch (error) {
      console.error('File read error:', error);
      throw new Error('Failed to read file from storage');
    }
  }

  async uploadChunk(
    buffer: Buffer,
    options: UploadOptions,
    chunkIndex: number,
    totalChunks: number,
    uploadId?: string
  ): Promise<{ uploadId: string; etag: string }> {
    // For simplicity, we'll use regular upload for now
    const result = await this.uploadFile(buffer, options);
    
    return {
      uploadId: uploadId || generateUUID(),
      etag: result.key,
    };
  }

  async getSignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    // Return a download URL for local file storage
    return `/api/evidence/download/${encodeURIComponent(key)}`;
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const filePath = path.join(this.uploadDir, key);
      
      if (existsSync(filePath)) {
        await unlink(filePath);
      }
    } catch (error) {
      console.error('File deletion error:', error);
      throw new Error('Failed to delete file from storage');
    }
  }

  async fileExists(key: string): Promise<boolean> {
    const filePath = path.join(this.uploadDir, key);
    return existsSync(filePath);
  }

  async getFileInfo(key: string) {
    const filePath = path.join(this.uploadDir, key);
    
    if (!existsSync(filePath)) {
      throw new Error('File not found');
    }

    const stats = await import('fs/promises').then(fs => fs.stat(filePath));
    
    return {
      size: stats.size,
      contentType: 'application/octet-stream', // Default content type
      lastModified: stats.mtime,
      metadata: {},
    };
  }
}

export const storageService = new FileStorageService();