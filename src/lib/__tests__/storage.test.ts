import { FileStorageService, UploadOptions, UploadResult } from '../storage';
import { writeFile, mkdir, readFile, unlink, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// Mock filesystem operations
jest.mock('fs/promises', () => ({
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  readFile: jest.fn(),
  unlink: jest.fn(),
  stat: jest.fn(),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
}));

jest.mock('path', () => ({
  join: jest.fn((...segments) => segments.join('/')),
  dirname: jest.fn((filePath) => filePath.split('/').slice(0, -1).join('/')),
}));

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: jest.fn(() => 'mocked-uuid-123'),
  },
});

const mockWriteFile = writeFile as jest.MockedFunction<typeof writeFile>;
const mockMkdir = mkdir as jest.MockedFunction<typeof mkdir>;
const mockReadFile = readFile as jest.MockedFunction<typeof readFile>;
const mockUnlink = unlink as jest.MockedFunction<typeof unlink>;
const mockStat = stat as jest.MockedFunction<typeof stat>;
const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;

describe('FileStorageService', () => {
  let storageService: FileStorageService;
  let mockUploadOptions: UploadOptions;
  let mockBuffer: Buffer;

  beforeEach(() => {
    storageService = new FileStorageService();
    mockUploadOptions = {
      userId: 'user-123',
      academicYearId: 'year-2024',
      subIndicatorId: 'indicator-456',
      originalName: 'test-document.pdf',
      contentType: 'application/pdf',
      size: 1024,
    };
    mockBuffer = Buffer.from('test file content');

    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock Date.now for consistent timestamps
    jest.spyOn(Date, 'now').mockReturnValue(1640995200000); // 2022-01-01T00:00:00.000Z
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('uploadFile', () => {
    it('should successfully upload a file', async () => {
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      const result = await storageService.uploadFile(mockBuffer, mockUploadOptions);

      expect(result).toEqual({
        key: 'year-2024/indicator-456/user-123/1640995200000-mocked-uuid-123.pdf',
        url: '/api/evidence/download/year-2024%2Findicator-456%2Fuser-123%2F1640995200000-mocked-uuid-123.pdf',
        size: 1024,
        contentType: 'application/pdf',
      });

      expect(mockMkdir).toHaveBeenCalledWith(
        'uploads/evidence/year-2024/indicator-456/user-123',
        { recursive: true }
      );
      expect(mockWriteFile).toHaveBeenCalledWith(
        'uploads/evidence/year-2024/indicator-456/user-123/1640995200000-mocked-uuid-123.pdf',
        mockBuffer
      );
    });

    it('should handle files without extensions', async () => {
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      const optionsWithoutExt = {
        ...mockUploadOptions,
        originalName: 'filename-no-extension',
      };

      const result = await storageService.uploadFile(mockBuffer, optionsWithoutExt);

      expect(result.key).toBe('year-2024/indicator-456/user-123/1640995200000-mocked-uuid-123.filename-no-extension');
    });

    it('should throw error if mkdir fails', async () => {
      mockMkdir.mockRejectedValue(new Error('Permission denied'));

      await expect(
        storageService.uploadFile(mockBuffer, mockUploadOptions)
      ).rejects.toThrow('Failed to upload file to storage');

      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('should throw error if writeFile fails', async () => {
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockRejectedValue(new Error('Disk full'));

      await expect(
        storageService.uploadFile(mockBuffer, mockUploadOptions)
      ).rejects.toThrow('Failed to upload file to storage');
    });

    it('should generate unique keys for multiple uploads', async () => {
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      // Change the mock UUID for the second call
      (global.crypto.randomUUID as jest.Mock)
        .mockReturnValueOnce('uuid-1')
        .mockReturnValueOnce('uuid-2');

      const result1 = await storageService.uploadFile(mockBuffer, mockUploadOptions);
      const result2 = await storageService.uploadFile(mockBuffer, mockUploadOptions);

      expect(result1.key).toContain('uuid-1');
      expect(result2.key).toContain('uuid-2');
      expect(result1.key).not.toBe(result2.key);
    });
  });

  describe('getFile', () => {
    it('should successfully retrieve a file', async () => {
      const mockFileContent = Buffer.from('file content');
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue(mockFileContent);

      const result = await storageService.getFile('test/file/key.pdf');

      expect(result).toBe(mockFileContent);
      expect(mockExistsSync).toHaveBeenCalledWith('uploads/evidence/test/file/key.pdf');
      expect(mockReadFile).toHaveBeenCalledWith('uploads/evidence/test/file/key.pdf');
    });

    it('should throw error if file does not exist', async () => {
      mockExistsSync.mockReturnValue(false);

      await expect(
        storageService.getFile('nonexistent/file.pdf')
      ).rejects.toThrow('Failed to read file from storage');

      expect(mockReadFile).not.toHaveBeenCalled();
    });

    it('should throw error if readFile fails', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockRejectedValue(new Error('Read permission denied'));

      await expect(
        storageService.getFile('test/file.pdf')
      ).rejects.toThrow('Failed to read file from storage');
    });
  });

  describe('uploadChunk', () => {
    it('should upload a chunk and return upload metadata', async () => {
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      const result = await storageService.uploadChunk(
        mockBuffer,
        mockUploadOptions,
        1,
        3,
        'existing-upload-id'
      );

      expect(result).toEqual({
        uploadId: 'existing-upload-id',
        etag: 'year-2024/indicator-456/user-123/1640995200000-mocked-uuid-123.pdf',
      });
    });

    it('should generate new upload ID if not provided', async () => {
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      const result = await storageService.uploadChunk(
        mockBuffer,
        mockUploadOptions,
        1,
        3
      );

      expect(result.uploadId).toBe('mocked-uuid-123');
    });
  });

  describe('getSignedDownloadUrl', () => {
    it('should return encoded download URL', async () => {
      const result = await storageService.getSignedDownloadUrl('test/file with spaces.pdf');

      expect(result).toBe('/api/evidence/download/test%2Ffile%20with%20spaces.pdf');
    });

    it('should handle special characters in key', async () => {
      const result = await storageService.getSignedDownloadUrl('test/file@#$.pdf');

      expect(result).toBe('/api/evidence/download/test%2Ffile%40%23%24.pdf');
    });
  });

  describe('deleteFile', () => {
    it('should successfully delete an existing file', async () => {
      mockExistsSync.mockReturnValue(true);
      mockUnlink.mockResolvedValue(undefined);

      await storageService.deleteFile('test/file.pdf');

      expect(mockExistsSync).toHaveBeenCalledWith('uploads/evidence/test/file.pdf');
      expect(mockUnlink).toHaveBeenCalledWith('uploads/evidence/test/file.pdf');
    });

    it('should not attempt to delete non-existent file', async () => {
      mockExistsSync.mockReturnValue(false);

      await storageService.deleteFile('nonexistent/file.pdf');

      expect(mockExistsSync).toHaveBeenCalledWith('uploads/evidence/nonexistent/file.pdf');
      expect(mockUnlink).not.toHaveBeenCalled();
    });

    it('should throw error if deletion fails', async () => {
      mockExistsSync.mockReturnValue(true);
      mockUnlink.mockRejectedValue(new Error('Permission denied'));

      await expect(
        storageService.deleteFile('test/file.pdf')
      ).rejects.toThrow('Failed to delete file from storage');
    });
  });

  describe('fileExists', () => {
    it('should return true for existing file', async () => {
      mockExistsSync.mockReturnValue(true);

      const result = await storageService.fileExists('test/file.pdf');

      expect(result).toBe(true);
      expect(mockExistsSync).toHaveBeenCalledWith('uploads/evidence/test/file.pdf');
    });

    it('should return false for non-existent file', async () => {
      mockExistsSync.mockReturnValue(false);

      const result = await storageService.fileExists('nonexistent/file.pdf');

      expect(result).toBe(false);
    });
  });

  describe('getFileInfo', () => {
    it('should return file information for existing file', async () => {
      const mockStats = {
        size: 2048,
        mtime: new Date('2024-01-01T12:00:00Z'),
      };

      mockExistsSync.mockReturnValue(true);
      mockStat.mockResolvedValue(mockStats as any);

      const result = await storageService.getFileInfo('test/file.pdf');

      expect(result).toEqual({
        size: 2048,
        contentType: 'application/octet-stream',
        lastModified: mockStats.mtime,
        metadata: {},
      });
    });

    it('should throw error for non-existent file', async () => {
      mockExistsSync.mockReturnValue(false);

      await expect(
        storageService.getFileInfo('nonexistent/file.pdf')
      ).rejects.toThrow('File not found');

      expect(mockStat).not.toHaveBeenCalled();
    });

    it('should throw error if stat fails', async () => {
      mockExistsSync.mockReturnValue(true);
      mockStat.mockRejectedValue(new Error('Stat failed'));

      await expect(
        storageService.getFileInfo('test/file.pdf')
      ).rejects.toThrow('Stat failed');
    });
  });

  describe('UUID generation fallback', () => {
    it('should use fallback UUID generation when crypto.randomUUID is not available', async () => {
      // Temporarily remove crypto.randomUUID
      const originalRandomUUID = global.crypto.randomUUID;
      delete (global.crypto as any).randomUUID;

      // Mock Math.random for predictable fallback UUID
      const mockMathRandom = jest.spyOn(Math, 'random');
      mockMathRandom.mockReturnValue(0.5);

      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      const result = await storageService.uploadFile(mockBuffer, mockUploadOptions);

      // The fallback UUID should be deterministic with our mocked Math.random
      expect(result.key).toContain('88888888-8888-4888-a888-888888888888');

      // Restore original function
      global.crypto.randomUUID = originalRandomUUID;
      mockMathRandom.mockRestore();
    });
  });

  describe('Storage key generation', () => {
    it('should generate storage key with correct format', async () => {
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      const result = await storageService.uploadFile(mockBuffer, mockUploadOptions);

      // Expected format: academicYearId/subIndicatorId/userId/timestamp-uuid.extension
      expect(result.key).toMatch(/^year-2024\/indicator-456\/user-123\/\d+-[a-f0-9-]+\.pdf$/);
    });

    it('should handle file names with multiple dots', async () => {
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      const optionsWithMultipleDots = {
        ...mockUploadOptions,
        originalName: 'my.file.name.with.dots.pdf',
      };

      const result = await storageService.uploadFile(mockBuffer, optionsWithMultipleDots);

      expect(result.key).toEndWith('.pdf');
    });
  });
});