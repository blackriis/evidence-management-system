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

  static scanForMalware(buffer: Buffer): Promise<boolean> {
    // Placeholder for malware scanning
    // In production, integrate with a malware scanning service
    return Promise.resolve(true);
  }
}

export { FileValidator as default };