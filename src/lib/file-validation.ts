import { FILE_UPLOAD_LIMITS } from "./constants";

export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface FileInfo {
  name: string;
  size: number;
  type: string;
  buffer?: Buffer;
}

export class FileValidator {
  private static readonly DANGEROUS_EXTENSIONS = [
    'exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js', 'jar', 'php', 'py', 'rb', 'pl', 'sh', 'bash'
  ];

  private static readonly MAGIC_NUMBERS = {
    'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
    'image/jpeg': [0xFF, 0xD8, 0xFF],
    'image/png': [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
    'image/gif': [0x47, 0x49, 0x46, 0x38],
    'application/msword': [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [0x50, 0x4B, 0x03, 0x04], // ZIP header
    'application/vnd.ms-excel': [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [0x50, 0x4B, 0x03, 0x04], // ZIP header
    'application/vnd.ms-powerpoint': [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': [0x50, 0x4B, 0x03, 0x04], // ZIP header
    'text/plain': null, // Text files can start with any character
  };

  static validateFile(file: FileInfo): FileValidationResult {
    const result: FileValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    // Check file size
    if (file.size > FILE_UPLOAD_LIMITS.MAX_FILE_SIZE) {
      result.isValid = false;
      result.errors.push(`File size exceeds the maximum limit of ${this.formatFileSize(FILE_UPLOAD_LIMITS.MAX_FILE_SIZE)}`);
    }

    if (file.size === 0) {
      result.isValid = false;
      result.errors.push('File is empty');
    }

    // Check file type
    if (!FILE_UPLOAD_LIMITS.ALLOWED_MIME_TYPES.includes(file.type)) {
      result.isValid = false;
      result.errors.push(`File type '${file.type}' is not allowed`);
    }

    // Check file extension
    const extension = this.getFileExtension(file.name);
    if (this.DANGEROUS_EXTENSIONS.includes(extension.toLowerCase())) {
      result.isValid = false;
      result.errors.push(`File extension '.${extension}' is not allowed for security reasons`);
    }

    // Check filename
    if (!this.isValidFilename(file.name)) {
      result.isValid = false;
      result.errors.push('Invalid filename. Avoid special characters and ensure the filename is not too long');
    }

    // Magic number validation (if buffer is provided)
    if (file.buffer && !this.validateMagicNumber(file.buffer, file.type)) {
      result.isValid = false;
      result.errors.push('File content does not match the declared file type');
    }

    // Warnings for large files
    if (file.size > 100 * 1024 * 1024) { // 100MB
      result.warnings.push('Large file detected. Upload may take longer');
    }

    return result;
  }

  static validateMultipleFiles(files: FileInfo[], userQuota: number): FileValidationResult {
    const result: FileValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    if (files.length === 0) {
      result.isValid = false;
      result.errors.push('No files selected');
      return result;
    }

    // Check total size against user quota
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > userQuota) {
      result.isValid = false;
      result.errors.push(`Total file size exceeds your quota of ${this.formatFileSize(userQuota)}`);
    }

    // Validate each file individually
    for (const file of files) {
      const fileResult = this.validateFile(file);
      if (!fileResult.isValid) {
        result.isValid = false;
        result.errors.push(...fileResult.errors.map(error => `${file.name}: ${error}`));
      }
      result.warnings.push(...fileResult.warnings.map(warning => `${file.name}: ${warning}`));
    }

    // Check for duplicate filenames
    const filenames = files.map(f => f.name.toLowerCase());
    const duplicates = filenames.filter((name, index) => filenames.indexOf(name) !== index);
    if (duplicates.length > 0) {
      result.warnings.push(`Duplicate filenames detected: ${duplicates.join(', ')}`);
    }

    return result;
  }

  private static validateMagicNumber(buffer: Buffer, mimeType: string): boolean {
    const magicNumbers = this.MAGIC_NUMBERS[mimeType as keyof typeof this.MAGIC_NUMBERS];
    
    if (!magicNumbers) {
      return true; // Skip validation for types without magic numbers
    }

    if (buffer.length < magicNumbers.length) {
      return false;
    }

    for (let i = 0; i < magicNumbers.length; i++) {
      if (buffer[i] !== magicNumbers[i]) {
        return false;
      }
    }

    return true;
  }

  private static getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1] : '';
  }

  private static isValidFilename(filename: string): boolean {
    // Check length
    if (filename.length > 255) {
      return false;
    }

    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*\x00-\x1F]/;
    if (invalidChars.test(filename)) {
      return false;
    }

    // Check for reserved names (Windows)
    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    const nameWithoutExtension = filename.split('.')[0].toUpperCase();
    if (reservedNames.includes(nameWithoutExtension)) {
      return false;
    }

    return true;
  }

  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Enhanced security scanning for uploaded files
   */
  static async scanForMalware(buffer: Buffer, filename: string): Promise<{
    isSafe: boolean;
    threats: string[];
    warnings: string[];
  }> {
    const result = {
      isSafe: true,
      threats: [] as string[],
      warnings: [] as string[],
    };

    // Check for embedded executables in various file types
    const threats = this.scanForEmbeddedThreats(buffer, filename);
    if (threats.length > 0) {
      result.isSafe = false;
      result.threats.push(...threats);
    }

    // Check for suspicious patterns
    const suspiciousPatterns = this.scanForSuspiciousPatterns(buffer);
    if (suspiciousPatterns.length > 0) {
      result.warnings.push(...suspiciousPatterns);
    }

    // Check file structure integrity
    const structureIssues = this.validateFileStructure(buffer, filename);
    if (structureIssues.length > 0) {
      result.warnings.push(...structureIssues);
    }

    return result;
  }

  /**
   * Scan for embedded executables and scripts
   */
  private static scanForEmbeddedThreats(buffer: Buffer, filename: string): string[] {
    const threats: string[] = [];
    const extension = this.getFileExtension(filename).toLowerCase();

    // Check for executable signatures in non-executable files
    const executableSignatures = [
      { signature: [0x4D, 0x5A], name: 'PE Executable (Windows)' }, // MZ header
      { signature: [0x7F, 0x45, 0x4C, 0x46], name: 'ELF Executable (Linux)' }, // ELF header
      { signature: [0xFE, 0xED, 0xFA, 0xCE], name: 'Mach-O Executable (macOS)' }, // Mach-O 32-bit
      { signature: [0xFE, 0xED, 0xFA, 0xCF], name: 'Mach-O Executable (macOS)' }, // Mach-O 64-bit
    ];

    // Only check for executables in document/image files
    if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'gif'].includes(extension)) {
      for (const { signature, name } of executableSignatures) {
        if (this.containsSignature(buffer, signature)) {
          threats.push(`Embedded executable detected: ${name}`);
        }
      }
    }

    // Check for script injections in Office documents
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(extension)) {
      const scriptPatterns = [
        /javascript:/gi,
        /vbscript:/gi,
        /<script[^>]*>/gi,
        /eval\s*\(/gi,
        /document\.write/gi,
        /ActiveXObject/gi,
        /WScript\.Shell/gi,
      ];

      const content = buffer.toString('utf8');
      for (const pattern of scriptPatterns) {
        if (pattern.test(content)) {
          threats.push('Suspicious script content detected in document');
          break;
        }
      }
    }

    // Check for macro signatures in Office documents
    if (['doc', 'xls', 'ppt'].includes(extension)) {
      // Check for OLE compound document with macros
      if (this.containsSignature(buffer, [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])) {
        // Look for macro indicators
        const content = buffer.toString('binary');
        if (content.includes('Microsoft Office Word') && content.includes('Macros')) {
          threats.push('Document contains macros');
        }
      }
    }

    return threats;
  }

  /**
   * Scan for suspicious patterns that might indicate malicious content
   */
  private static scanForSuspiciousPatterns(buffer: Buffer): string[] {
    const warnings: string[] = [];
    const content = buffer.toString('utf8');

    // Suspicious URLs or domains
    const suspiciousPatterns = [
      /https?:\/\/[a-z0-9.-]+\.tk\//gi, // .tk domains often used for malicious purposes
      /https?:\/\/[a-z0-9.-]+\.ml\//gi, // .ml domains
      /https?:\/\/bit\.ly\//gi, // Shortened URLs
      /https?:\/\/tinyurl\.com\//gi,
      /data:text\/html/gi, // Data URLs with HTML
      /javascript:void\(0\)/gi,
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        warnings.push('Suspicious URL pattern detected');
        break;
      }
    }

    // Check for obfuscated content
    const obfuscationPatterns = [
      /eval\s*\(\s*atob\s*\(/gi, // Base64 decode and eval
      /String\.fromCharCode\s*\(/gi, // Character code obfuscation
      /unescape\s*\(/gi, // URL unescape
      /\\x[0-9a-f]{2}/gi, // Hex encoding
    ];

    for (const pattern of obfuscationPatterns) {
      if (pattern.test(content)) {
        warnings.push('Potentially obfuscated content detected');
        break;
      }
    }

    return warnings;
  }

  /**
   * Validate file structure integrity
   */
  private static validateFileStructure(buffer: Buffer, filename: string): string[] {
    const warnings: string[] = [];
    const extension = this.getFileExtension(filename).toLowerCase();

    // Check PDF structure
    if (extension === 'pdf') {
      if (!buffer.toString('ascii', 0, 4).startsWith('%PDF')) {
        warnings.push('PDF file structure appears corrupted');
      }
      
      // Check for suspicious PDF elements
      const pdfContent = buffer.toString('binary');
      if (pdfContent.includes('/JavaScript') || pdfContent.includes('/JS')) {
        warnings.push('PDF contains JavaScript');
      }
      if (pdfContent.includes('/Launch')) {
        warnings.push('PDF contains launch actions');
      }
    }

    // Check ZIP-based formats (Office documents)
    if (['docx', 'xlsx', 'pptx'].includes(extension)) {
      if (!this.containsSignature(buffer, [0x50, 0x4B, 0x03, 0x04])) {
        warnings.push('Office document structure appears corrupted');
      }
    }

    // Check image files for unusual size ratios
    if (['jpg', 'jpeg', 'png', 'gif'].includes(extension)) {
      const fileSize = buffer.length;
      
      // Unusually large files for images might contain hidden data
      if (fileSize > 50 * 1024 * 1024) { // 50MB
        warnings.push('Image file is unusually large');
      }

      // Check for trailing data after image end markers
      if (extension === 'jpg' || extension === 'jpeg') {
        const jpegEndMarker = Buffer.from([0xFF, 0xD9]);
        const lastMarkerIndex = buffer.lastIndexOf(jpegEndMarker);
        if (lastMarkerIndex !== -1 && lastMarkerIndex < buffer.length - 2) {
          warnings.push('JPEG file contains data after end marker');
        }
      }
    }

    return warnings;
  }

  /**
   * Check if buffer contains a specific byte signature
   */
  private static containsSignature(buffer: Buffer, signature: number[]): boolean {
    for (let i = 0; i <= buffer.length - signature.length; i++) {
      let match = true;
      for (let j = 0; j < signature.length; j++) {
        if (buffer[i + j] !== signature[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        return true;
      }
    }
    return false;
  }

  /**
   * Enhanced file validation with security scanning
   */
  static async validateFileWithSecurity(file: FileInfo): Promise<FileValidationResult & {
    securityScan?: {
      isSafe: boolean;
      threats: string[];
      warnings: string[];
    };
  }> {
    const basicValidation = this.validateFile(file);
    
    if (!basicValidation.isValid || !file.buffer) {
      return basicValidation;
    }

    // Perform security scanning
    const securityScan = await this.scanForMalware(file.buffer, file.name);
    
    if (!securityScan.isSafe) {
      basicValidation.isValid = false;
      basicValidation.errors.push(...securityScan.threats);
    }

    basicValidation.warnings.push(...securityScan.warnings);

    return {
      ...basicValidation,
      securityScan,
    };
  }
}

export { FileValidator as default };