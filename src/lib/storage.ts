import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "./env";
import { randomUUID } from "crypto";

export const s3Client = new S3Client({
  region: env.STORAGE_REGION,
  endpoint: env.STORAGE_ENDPOINT,
  credentials: {
    accessKeyId: env.STORAGE_ACCESS_KEY,
    secretAccessKey: env.STORAGE_SECRET_KEY,
  },
  forcePathStyle: true, // Required for MinIO
});

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

export class StorageService {
  private generateStorageKey(options: UploadOptions): string {
    const { userId, academicYearId, subIndicatorId, originalName } = options;
    const timestamp = Date.now();
    const uuid = randomUUID();
    const ext = originalName.split('.').pop();
    
    return `evidence/${academicYearId}/${subIndicatorId}/${userId}/${timestamp}-${uuid}.${ext}`;
  }

  async uploadFile(buffer: Buffer, options: UploadOptions): Promise<UploadResult> {
    const key = this.generateStorageKey(options);
    
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: env.STORAGE_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: options.contentType,
        Metadata: {
          userId: options.userId,
          academicYearId: options.academicYearId,
          subIndicatorId: options.subIndicatorId,
          originalName: options.originalName,
          uploadTimestamp: Date.now().toString(),
        },
      },
    });

    const result = await upload.done();
    
    return {
      key,
      url: result.Location || `${env.STORAGE_ENDPOINT}/${env.STORAGE_BUCKET}/${key}`,
      size: options.size,
      contentType: options.contentType,
    };
  }

  async uploadChunk(
    buffer: Buffer,
    options: UploadOptions,
    chunkIndex: number,
    totalChunks: number,
    uploadId?: string
  ): Promise<{ uploadId: string; etag: string }> {
    // For simplicity, we'll use regular upload for now
    // In production, implement multipart upload for large files
    const result = await this.uploadFile(buffer, options);
    
    return {
      uploadId: uploadId || randomUUID(),
      etag: result.key,
    };
  }

  async getSignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: env.STORAGE_BUCKET,
      Key: key,
    });

    return await getSignedUrl(s3Client, command, { expiresIn });
  }

  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: env.STORAGE_BUCKET,
      Key: key,
    });

    await s3Client.send(command);
  }

  async getFileInfo(key: string) {
    const command = new GetObjectCommand({
      Bucket: env.STORAGE_BUCKET,
      Key: key,
    });

    const response = await s3Client.send(command);
    return {
      size: response.ContentLength,
      contentType: response.ContentType,
      lastModified: response.LastModified,
      metadata: response.Metadata,
    };
  }
}

export const storageService = new StorageService();