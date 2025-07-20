import { FileValidator, FileInfo, FileValidationResult } from '../file-validation';
import { FILE_UPLOAD_LIMITS } from '../constants';

describe('FileValidator', () => {
  const validPdfFile: FileInfo = {
    name: 'test-document.pdf',
    size: 1024 * 1024, // 1MB
    type: 'application/pdf',
    buffer: Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]), // %PDF-1.4
  };

  const validImageFile: FileInfo = {
    name: 'test-image.jpg',
    size: 512 * 1024, // 512KB
    type: 'image/jpeg',
    buffer: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), // JPEG header
  };

  describe('validateFile', () => {
    it('should accept valid PDF file', () => {
      const result = FileValidator.validateFile(validPdfFile);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept valid image file', () => {
      const result = FileValidator.validateFile(validImageFile);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject file exceeding size limit', () => {
      const oversizedFile: FileInfo = {
        ...validPdfFile,
        size: FILE_UPLOAD_LIMITS.MAX_FILE_SIZE + 1,
      };
      
      const result = FileValidator.validateFile(oversizedFile);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        expect.stringContaining('File size exceeds the maximum limit')
      );
    });

    it('should reject empty file', () => {
      const emptyFile: FileInfo = {
        ...validPdfFile,
        size: 0,
      };
      
      const result = FileValidator.validateFile(emptyFile);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File is empty');
    });

    it('should reject disallowed MIME type', () => {
      const disallowedFile: FileInfo = {
        ...validPdfFile,
        type: 'application/x-executable',
      };
      
      const result = FileValidator.validateFile(disallowedFile);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "File type 'application/x-executable' is not allowed"
      );
    });

    it('should reject dangerous file extensions', () => {
      const dangerousFile: FileInfo = {
        ...validPdfFile,
        name: 'malicious.exe',
      };
      
      const result = FileValidator.validateFile(dangerousFile);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "File extension '.exe' is not allowed for security reasons"
      );
    });

    it('should reject invalid filenames with special characters', () => {
      const invalidNameFile: FileInfo = {
        ...validPdfFile,
        name: 'test<>file.pdf',
      };
      
      const result = FileValidator.validateFile(invalidNameFile);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Invalid filename. Avoid special characters and ensure the filename is not too long'
      );
    });

    it('should reject filenames that are too long', () => {
      const longNameFile: FileInfo = {
        ...validPdfFile,
        name: 'a'.repeat(260) + '.pdf',
      };
      
      const result = FileValidator.validateFile(longNameFile);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Invalid filename. Avoid special characters and ensure the filename is not too long'
      );
    });

    it('should reject reserved Windows filenames', () => {
      const reservedNameFile: FileInfo = {
        ...validPdfFile,
        name: 'CON.pdf',
      };
      
      const result = FileValidator.validateFile(reservedNameFile);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Invalid filename. Avoid special characters and ensure the filename is not too long'
      );
    });

    it('should reject file with invalid magic number', () => {
      const invalidMagicFile: FileInfo = {
        ...validPdfFile,
        buffer: Buffer.from([0x12, 0x34, 0x56, 0x78]), // Invalid PDF header
      };
      
      const result = FileValidator.validateFile(invalidMagicFile);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'File content does not match the declared file type'
      );
    });

    it('should generate warning for large files', () => {
      const largeFile: FileInfo = {
        ...validPdfFile,
        size: 200 * 1024 * 1024, // 200MB
      };
      
      const result = FileValidator.validateFile(largeFile);
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Large file detected. Upload may take longer');
    });

    it('should handle files without buffer (no magic number validation)', () => {
      const fileWithoutBuffer: FileInfo = {
        name: 'test.pdf',
        size: 1024,
        type: 'application/pdf',
      };
      
      const result = FileValidator.validateFile(fileWithoutBuffer);
      expect(result.isValid).toBe(true);
    });

    it('should handle text files (no magic number required)', () => {
      const textFile: FileInfo = {
        name: 'test.txt',
        size: 1024,
        type: 'text/plain',
        buffer: Buffer.from('Hello, world!'),
      };
      
      const result = FileValidator.validateFile(textFile);
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateMultipleFiles', () => {
    it('should accept multiple valid files', () => {
      const files = [validPdfFile, validImageFile];
      const userQuota = 10 * 1024 * 1024; // 10MB
      
      const result = FileValidator.validateMultipleFiles(files, userQuota);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty file array', () => {
      const result = FileValidator.validateMultipleFiles([], 10 * 1024 * 1024);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('No files selected');
    });

    it('should reject files exceeding user quota', () => {
      const files = [validPdfFile, validImageFile];
      const userQuota = 1024; // 1KB (too small)
      
      const result = FileValidator.validateMultipleFiles(files, userQuota);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        expect.stringContaining('Total file size exceeds your quota')
      );
    });

    it('should aggregate individual file validation errors', () => {
      const invalidFile: FileInfo = {
        name: 'invalid.exe',
        size: 0,
        type: 'application/x-executable',
      };
      const files = [validPdfFile, invalidFile];
      const userQuota = 10 * 1024 * 1024;
      
      const result = FileValidator.validateMultipleFiles(files, userQuota);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('invalid.exe'))).toBe(true);
    });

    it('should warn about duplicate filenames', () => {
      const duplicateFile: FileInfo = {
        ...validPdfFile,
        name: 'TEST-DOCUMENT.PDF', // Same name but different case
      };
      const files = [validPdfFile, duplicateFile];
      const userQuota = 10 * 1024 * 1024;
      
      const result = FileValidator.validateMultipleFiles(files, userQuota);
      expect(result.warnings).toContain(
        expect.stringContaining('Duplicate filenames detected')
      );
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(FileValidator.formatFileSize(0)).toBe('0 Bytes');
      expect(FileValidator.formatFileSize(1024)).toBe('1 KB');
      expect(FileValidator.formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(FileValidator.formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
      expect(FileValidator.formatFileSize(1536)).toBe('1.5 KB'); // 1.5 KB
    });
  });

  describe('scanForMalware', () => {
    it('should detect embedded executables in PDF files', async () => {
      const maliciousPdf = Buffer.concat([
        Buffer.from([0x25, 0x50, 0x44, 0x46]), // PDF header
        Buffer.from('some content'),
        Buffer.from([0x4D, 0x5A]), // PE executable header
        Buffer.from('malicious payload'),
      ]);

      const result = await FileValidator.scanForMalware(maliciousPdf, 'document.pdf');
      expect(result.isSafe).toBe(false);
      expect(result.threats).toContain('Embedded executable detected: PE Executable (Windows)');
    });

    it('should detect script injection in Office documents', async () => {
      const maliciousDoc = Buffer.from(`
        <script>malicious code</script>
        javascript:void(0)
        document.write('xss')
      `);

      const result = await FileValidator.scanForMalware(maliciousDoc, 'document.docx');
      expect(result.isSafe).toBe(false);
      expect(result.threats).toContain('Suspicious script content detected in document');
    });

    it('should detect suspicious URL patterns', async () => {
      const suspiciousContent = Buffer.from('Visit: http://malicious.tk/payload');

      const result = await FileValidator.scanForMalware(suspiciousContent, 'document.pdf');
      expect(result.warnings).toContain('Suspicious URL pattern detected');
    });

    it('should detect obfuscated content', async () => {
      const obfuscatedContent = Buffer.from('eval(atob("bWFsaWNpb3VzIGNvZGU="))');

      const result = await FileValidator.scanForMalware(obfuscatedContent, 'script.txt');
      expect(result.warnings).toContain('Potentially obfuscated content detected');
    });

    it('should validate PDF structure and detect JavaScript', async () => {
      const maliciousPdf = Buffer.from('%PDF-1.4\n/JavaScript (malicious code)');

      const result = await FileValidator.scanForMalware(maliciousPdf, 'document.pdf');
      expect(result.warnings).toContain('PDF contains JavaScript');
    });

    it('should detect trailing data in JPEG files', async () => {
      const maliciousJpeg = Buffer.concat([
        Buffer.from([0xFF, 0xD8, 0xFF]), // JPEG header
        Buffer.from('image data'),
        Buffer.from([0xFF, 0xD9]), // JPEG end marker
        Buffer.from('hidden malicious data'), // Trailing data
      ]);

      const result = await FileValidator.scanForMalware(maliciousJpeg, 'image.jpg');
      expect(result.warnings).toContain('JPEG file contains data after end marker');
    });

    it('should pass clean files without issues', async () => {
      const cleanPdf = Buffer.from('%PDF-1.4\nClean document content');

      const result = await FileValidator.scanForMalware(cleanPdf, 'clean.pdf');
      expect(result.isSafe).toBe(true);
      expect(result.threats).toHaveLength(0);
    });
  });

  describe('validateFileWithSecurity', () => {
    it('should combine basic validation and security scanning', async () => {
      const result = await FileValidator.validateFileWithSecurity(validPdfFile);
      expect(result.isValid).toBe(true);
      expect(result.securityScan).toBeDefined();
      expect(result.securityScan?.isSafe).toBe(true);
    });

    it('should fail validation if basic validation fails', async () => {
      const invalidFile: FileInfo = {
        name: 'invalid.exe',
        size: 0,
        type: 'application/x-executable',
      };

      const result = await FileValidator.validateFileWithSecurity(invalidFile);
      expect(result.isValid).toBe(false);
      expect(result.securityScan).toBeUndefined();
    });

    it('should fail validation if security scan detects threats', async () => {
      const maliciousFile: FileInfo = {
        name: 'malicious.pdf',
        size: 1024,
        type: 'application/pdf',
        buffer: Buffer.concat([
          Buffer.from([0x25, 0x50, 0x44, 0x46]), // PDF header
          Buffer.from([0x4D, 0x5A]), // PE executable
        ]),
      };

      const result = await FileValidator.validateFileWithSecurity(maliciousFile);
      expect(result.isValid).toBe(false);
      expect(result.securityScan?.isSafe).toBe(false);
      expect(result.errors).toContain('Embedded executable detected: PE Executable (Windows)');
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle files with no extension', () => {
      const noExtensionFile: FileInfo = {
        name: 'filename',
        size: 1024,
        type: 'text/plain',
      };

      const result = FileValidator.validateFile(noExtensionFile);
      expect(result.isValid).toBe(true);
    });

    it('should handle very small buffers in magic number validation', () => {
      const tinyBufferFile: FileInfo = {
        name: 'tiny.pdf',
        size: 1024,
        type: 'application/pdf',
        buffer: Buffer.from([0x25]), // Too small for PDF magic number
      };

      const result = FileValidator.validateFile(tinyBufferFile);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File content does not match the declared file type');
    });

    it('should handle buffer scanning edge cases', async () => {
      const emptyBuffer = Buffer.alloc(0);
      const result = await FileValidator.scanForMalware(emptyBuffer, 'empty.txt');
      expect(result.isSafe).toBe(true);
      expect(result.threats).toHaveLength(0);
    });

    it('should handle all dangerous extensions', () => {
      const dangerousExtensions = [
        'exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js', 'jar', 'php', 'py', 'rb', 'pl', 'sh', 'bash'
      ];

      dangerousExtensions.forEach(ext => {
        const dangerousFile: FileInfo = {
          name: `file.${ext}`,
          size: 1024,
          type: 'text/plain',
        };

        const result = FileValidator.validateFile(dangerousFile);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          `File extension '.${ext}' is not allowed for security reasons`
        );
      });
    });
  });
});