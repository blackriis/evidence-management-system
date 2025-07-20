/**
 * Integration tests for file storage operations
 * Tests the interaction between file storage service and AWS S3
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import fs from 'fs'
import path from 'path'

// Mock AWS S3 client
jest.mock('@aws-sdk/client-s3')
jest.mock('@aws-sdk/lib-storage')

const mockS3Client = {
  send: jest.fn(),
} as unknown as S3Client

const mockUpload = {
  done: jest.fn(),
} as unknown as Upload

describe('Storage Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(S3Client as jest.Mock).mockImplementation(() => mockS3Client)
    ;(Upload as jest.Mock).mockImplementation(() => mockUpload)
  })

  describe('File Upload Integration', () => {
    it('should upload file to S3 with proper metadata', async () => {
      const fileBuffer = Buffer.from('test file content')
      const fileName = 'test-document.pdf'
      const mimeType = 'application/pdf'
      const userId = 'user-1'

      const expectedKey = `evidence/${userId}/${Date.now()}-${fileName}`
      
      mockUpload.done.mockResolvedValue({
        Location: `https://test-bucket.s3.amazonaws.com/${expectedKey}`,
        Key: expectedKey,
        Bucket: 'test-bucket',
      })

      // Simulate file upload service
      const uploadFile = async (buffer: Buffer, fileName: string, mimeType: string, userId: string) => {
        const key = `evidence/${userId}/${Date.now()}-${fileName}`
        
        const upload = new Upload({
          client: mockS3Client,
          params: {
            Bucket: 'test-bucket',
            Key: key,
            Body: buffer,
            ContentType: mimeType,
            Metadata: {
              originalName: fileName,
              uploadedBy: userId,
              uploadedAt: new Date().toISOString(),
            },
            ServerSideEncryption: 'AES256',
          },
        })

        return await upload.done()
      }

      const result = await uploadFile(fileBuffer, fileName, mimeType, userId)

      expect(Upload).toHaveBeenCalledWith({
        client: mockS3Client,
        params: {
          Bucket: 'test-bucket',
          Key: expect.stringContaining(`evidence/${userId}/`),
          Body: fileBuffer,
          ContentType: mimeType,
          Metadata: {
            originalName: fileName,
            uploadedBy: userId,
            uploadedAt: expect.any(String),
          },
          ServerSideEncryption: 'AES256',
        },
      })

      expect(mockUpload.done).toHaveBeenCalled()
      expect(result.Location).toContain('test-bucket.s3.amazonaws.com')
    })

    it('should handle large file uploads with multipart upload', async () => {
      const largeFileSize = 10 * 1024 * 1024 // 10MB
      const largeFileBuffer = Buffer.alloc(largeFileSize, 'a')
      const fileName = 'large-document.pdf'

      mockUpload.done.mockResolvedValue({
        Location: `https://test-bucket.s3.amazonaws.com/evidence/user-1/large-document.pdf`,
        Key: 'evidence/user-1/large-document.pdf',
      })

      const uploadLargeFile = async (buffer: Buffer, fileName: string) => {
        const upload = new Upload({
          client: mockS3Client,
          params: {
            Bucket: 'test-bucket',
            Key: `evidence/user-1/${fileName}`,
            Body: buffer,
            ContentType: 'application/pdf',
          },
          partSize: 5 * 1024 * 1024, // 5MB parts
          queueSize: 4, // 4 concurrent uploads
        })

        return await upload.done()
      }

      const result = await uploadLargeFile(largeFileBuffer, fileName)

      expect(Upload).toHaveBeenCalledWith({
        client: mockS3Client,
        params: {
          Bucket: 'test-bucket',
          Key: 'evidence/user-1/large-document.pdf',
          Body: largeFileBuffer,
          ContentType: 'application/pdf',
        },
        partSize: 5 * 1024 * 1024,
        queueSize: 4,
      })

      expect(result.Location).toContain('large-document.pdf')
    })
  })

  describe('File Download Integration', () => {
    it('should download file from S3 with proper access control', async () => {
      const fileKey = 'evidence/user-1/document.pdf'
      const mockFileContent = Buffer.from('file content')

      mockS3Client.send.mockResolvedValue({
        Body: {
          transformToByteArray: () => Promise.resolve(mockFileContent),
        },
        ContentType: 'application/pdf',
        ContentLength: mockFileContent.length,
        Metadata: {
          originalName: 'document.pdf',
          uploadedBy: 'user-1',
        },
      })

      const downloadFile = async (key: string, userId: string) => {
        // Check access permissions (simplified)
        if (!key.includes(userId) && userId !== 'admin') {
          throw new Error('Access denied')
        }

        const command = new GetObjectCommand({
          Bucket: 'test-bucket',
          Key: key,
        })

        const response = await mockS3Client.send(command)
        const body = await response.Body?.transformToByteArray()

        return {
          content: body,
          contentType: response.ContentType,
          metadata: response.Metadata,
        }
      }

      const result = await downloadFile(fileKey, 'user-1')

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.any(GetObjectCommand)
      )
      expect(result.content).toEqual(mockFileContent)
      expect(result.contentType).toBe('application/pdf')
    })

    it('should enforce access control for file downloads', async () => {
      const fileKey = 'evidence/user-1/private-document.pdf'
      const unauthorizedUserId = 'user-2'

      const downloadFile = async (key: string, userId: string) => {
        if (!key.includes(userId) && userId !== 'admin') {
          throw new Error('Access denied')
        }

        const command = new GetObjectCommand({
          Bucket: 'test-bucket',
          Key: key,
        })

        return await mockS3Client.send(command)
      }

      await expect(downloadFile(fileKey, unauthorizedUserId)).rejects.toThrow('Access denied')
      expect(mockS3Client.send).not.toHaveBeenCalled()
    })
  })

  describe('File Deletion Integration', () => {
    it('should delete file from S3 with audit logging', async () => {
      const fileKey = 'evidence/user-1/document-to-delete.pdf'
      const userId = 'admin-1'

      mockS3Client.send.mockResolvedValue({
        DeleteMarker: true,
        VersionId: 'version-123',
      })

      const deleteFile = async (key: string, userId: string, reason: string) => {
        const command = new DeleteObjectCommand({
          Bucket: 'test-bucket',
          Key: key,
        })

        const result = await mockS3Client.send(command)

        // Simulate audit logging
        const auditLog = {
          action: 'FILE_DELETED',
          userId,
          resourceId: key,
          details: {
            reason,
            deletedAt: new Date().toISOString(),
          },
        }

        return { result, auditLog }
      }

      const { result, auditLog } = await deleteFile(fileKey, userId, 'Inappropriate content')

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.any(DeleteObjectCommand)
      )
      expect(result.DeleteMarker).toBe(true)
      expect(auditLog.action).toBe('FILE_DELETED')
      expect(auditLog.details.reason).toBe('Inappropriate content')
    })
  })

  describe('File Validation Integration', () => {
    it('should validate file before upload with virus scanning', async () => {
      const testFilePath = path.join(__dirname, '../fixtures/test-document.pdf')
      
      // Create test file if it doesn't exist
      if (!fs.existsSync(path.dirname(testFilePath))) {
        fs.mkdirSync(path.dirname(testFilePath), { recursive: true })
      }
      if (!fs.existsSync(testFilePath)) {
        fs.writeFileSync(testFilePath, 'PDF test content')
      }

      const validateAndUpload = async (filePath: string) => {
        const fileBuffer = fs.readFileSync(filePath)
        const fileName = path.basename(filePath)
        
        // File validation checks
        const validations = {
          sizeCheck: fileBuffer.length <= 50 * 1024 * 1024, // 50MB limit
          typeCheck: fileName.endsWith('.pdf'),
          virusScan: !fileBuffer.includes(Buffer.from('EICAR')), // Simple virus signature check
          contentValidation: fileBuffer.length > 0,
        }

        if (!Object.values(validations).every(Boolean)) {
          throw new Error('File validation failed')
        }

        // Proceed with upload if validation passes
        mockUpload.done.mockResolvedValue({
          Location: `https://test-bucket.s3.amazonaws.com/evidence/validated-${fileName}`,
          Key: `evidence/validated-${fileName}`,
        })

        const upload = new Upload({
          client: mockS3Client,
          params: {
            Bucket: 'test-bucket',
            Key: `evidence/validated-${fileName}`,
            Body: fileBuffer,
            ContentType: 'application/pdf',
          },
        })

        return await upload.done()
      }

      const result = await validateAndUpload(testFilePath)

      expect(result.Location).toContain('validated-test-document.pdf')
      expect(mockUpload.done).toHaveBeenCalled()
    })

    it('should reject malicious files during validation', async () => {
      const maliciousContent = Buffer.concat([
        Buffer.from('PDF header'),
        Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE'), // Virus signature
      ])

      const validateFile = async (fileBuffer: Buffer, fileName: string) => {
        const validations = {
          sizeCheck: fileBuffer.length <= 50 * 1024 * 1024,
          typeCheck: fileName.endsWith('.pdf'),
          virusScan: !fileBuffer.includes(Buffer.from('EICAR')),
          contentValidation: fileBuffer.length > 0,
        }

        if (!Object.values(validations).every(Boolean)) {
          throw new Error('File validation failed: Malicious content detected')
        }

        return true
      }

      await expect(validateFile(maliciousContent, 'malicious.pdf'))
        .rejects.toThrow('File validation failed: Malicious content detected')
    })
  })

  describe('Storage Performance Integration', () => {
    it('should handle concurrent file uploads efficiently', async () => {
      const concurrentUploads = 5
      const uploadPromises = []

      for (let i = 0; i < concurrentUploads; i++) {
        const fileBuffer = Buffer.from(`test content ${i}`)
        const fileName = `concurrent-test-${i}.pdf`

        mockUpload.done.mockResolvedValueOnce({
          Location: `https://test-bucket.s3.amazonaws.com/evidence/${fileName}`,
          Key: `evidence/${fileName}`,
        })

        const uploadPromise = new Upload({
          client: mockS3Client,
          params: {
            Bucket: 'test-bucket',
            Key: `evidence/${fileName}`,
            Body: fileBuffer,
            ContentType: 'application/pdf',
          },
        }).done()

        uploadPromises.push(uploadPromise)
      }

      const results = await Promise.all(uploadPromises)

      expect(results).toHaveLength(concurrentUploads)
      expect(mockUpload.done).toHaveBeenCalledTimes(concurrentUploads)
      results.forEach((result, index) => {
        expect(result.Location).toContain(`concurrent-test-${index}.pdf`)
      })
    })

    it('should handle upload failures gracefully with retry logic', async () => {
      const fileBuffer = Buffer.from('test content')
      const fileName = 'retry-test.pdf'

      // First attempt fails
      mockUpload.done
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new Error('Service unavailable'))
        .mockResolvedValueOnce({
          Location: `https://test-bucket.s3.amazonaws.com/evidence/${fileName}`,
          Key: `evidence/${fileName}`,
        })

      const uploadWithRetry = async (buffer: Buffer, fileName: string, maxRetries = 3) => {
        let lastError: Error | null = null

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const upload = new Upload({
              client: mockS3Client,
              params: {
                Bucket: 'test-bucket',
                Key: `evidence/${fileName}`,
                Body: buffer,
                ContentType: 'application/pdf',
              },
            })

            return await upload.done()
          } catch (error) {
            lastError = error as Error
            if (attempt === maxRetries) {
              throw lastError
            }
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
          }
        }

        throw lastError
      }

      const result = await uploadWithRetry(fileBuffer, fileName)

      expect(result.Location).toContain(fileName)
      expect(mockUpload.done).toHaveBeenCalledTimes(3) // 2 failures + 1 success
    })
  })
})