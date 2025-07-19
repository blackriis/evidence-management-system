import { randomUUID } from "crypto";

export interface UploadResult {
  key: string;
  url: string;
  bucket: string;
}

export interface UploadMetadata {
  userId: string;
  academicYearId: string;
  subIndicatorId: string;
  originalName: string;
  contentType: string;
  size: number;
}

export class MockStorageService {
  async uploadFile(buffer: Buffer, metadata: UploadMetadata): Promise<UploadResult> {
    // In a real implementation, this would upload to S3 or another storage service
    // For now, we'll just return a mock result
    const key = `evidence/${metadata.userId}/${metadata.academicYearId}/${metadata.subIndicatorId}/${randomUUID()}-${metadata.originalName}`;
    
    return {
      key,
      url: `/api/evidence/mock-download/${key}`,
      bucket: "mock-bucket"
    };
  }

  async getDownloadUrl(key: string): Promise<string> {
    // Return a mock download URL
    return `/api/evidence/mock-download/${key}`;
  }

  async deleteFile(key: string): Promise<void> {
    // Mock file deletion - in a real implementation, this would delete from storage
    return Promise.resolve();
  }
}

export const storageService = new MockStorageService();