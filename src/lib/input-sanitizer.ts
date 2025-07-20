import DOMPurify from 'dompurify';
import validator from 'validator';
import { JSDOM } from 'jsdom';

// Initialize DOMPurify with JSDOM for server-side usage
const window = new JSDOM('').window;
const purify = DOMPurify(window as any);

// Configure DOMPurify with strict settings
purify.setConfig({
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li', 
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'
  ],
  ALLOWED_ATTR: ['class'],
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  SANITIZE_DOM: true,
  KEEP_CONTENT: true,
});

export interface SanitizationOptions {
  allowHTML?: boolean;
  maxLength?: number;
  trimWhitespace?: boolean;
  normalizeWhitespace?: boolean;
  allowedTags?: string[];
  allowedAttributes?: string[];
}

export class InputSanitizer {
  /**
   * Sanitize a string input to prevent XSS attacks
   */
  static sanitizeString(
    input: string | null | undefined,
    options: SanitizationOptions = {}
  ): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    let sanitized = input;

    // Trim whitespace if requested
    if (options.trimWhitespace !== false) {
      sanitized = sanitized.trim();
    }

    // Normalize whitespace
    if (options.normalizeWhitespace) {
      sanitized = sanitized.replace(/\s+/g, ' ');
    }

    // Enforce maximum length
    if (options.maxLength && sanitized.length > options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength);
    }

    // Handle HTML content
    if (options.allowHTML) {
      // Configure DOMPurify for this specific sanitization
      const config: any = {
        ALLOWED_TAGS: options.allowedTags || purify.getConfig().ALLOWED_TAGS,
        ALLOWED_ATTR: options.allowedAttributes || purify.getConfig().ALLOWED_ATTR,
      };
      
      sanitized = purify.sanitize(sanitized, config);
    } else {
      // Escape HTML entities
      sanitized = validator.escape(sanitized);
    }

    return sanitized;
  }

  /**
   * Sanitize an email address
   */
  static sanitizeEmail(email: string | null | undefined): string {
    if (!email || typeof email !== 'string') {
      return '';
    }

    const sanitized = email.trim().toLowerCase();
    
    if (!validator.isEmail(sanitized)) {
      throw new Error('Invalid email format');
    }

    return validator.normalizeEmail(sanitized) || sanitized;
  }

  /**
   * Sanitize a filename to prevent directory traversal and other attacks
   */
  static sanitizeFilename(filename: string | null | undefined): string {
    if (!filename || typeof filename !== 'string') {
      return '';
    }

    let sanitized = filename.trim();

    // Remove directory traversal attempts
    sanitized = sanitized.replace(/\.\./g, '');
    sanitized = sanitized.replace(/[\/\\]/g, '');

    // Remove or replace dangerous characters
    sanitized = sanitized.replace(/[<>:"|?*\x00-\x1F]/g, '');

    // Limit length
    if (sanitized.length > 255) {
      const extension = sanitized.split('.').pop();
      const nameWithoutExt = sanitized.substring(0, sanitized.lastIndexOf('.'));
      const maxNameLength = 255 - (extension ? extension.length + 1 : 0);
      sanitized = nameWithoutExt.substring(0, maxNameLength) + (extension ? '.' + extension : '');
    }

    // Ensure filename is not empty after sanitization
    if (!sanitized) {
      sanitized = 'file';
    }

    return sanitized;
  }

  /**
   * Sanitize a URL to prevent malicious redirects
   */
  static sanitizeURL(url: string | null | undefined, allowedDomains?: string[]): string {
    if (!url || typeof url !== 'string') {
      return '';
    }

    const sanitized = url.trim();

    // Check if it's a valid URL
    if (!validator.isURL(sanitized, {
      protocols: ['http', 'https'],
      require_protocol: true,
      require_host: true,
      require_valid_protocol: true,
    })) {
      throw new Error('Invalid URL format');
    }

    // Check against allowed domains if specified
    if (allowedDomains && allowedDomains.length > 0) {
      const urlObj = new URL(sanitized);
      const domain = urlObj.hostname.toLowerCase();
      
      const isAllowed = allowedDomains.some(allowedDomain => {
        return domain === allowedDomain.toLowerCase() || 
               domain.endsWith('.' + allowedDomain.toLowerCase());
      });

      if (!isAllowed) {
        throw new Error('URL domain not allowed');
      }
    }

    return sanitized;
  }

  /**
   * Sanitize numeric input
   */
  static sanitizeNumber(
    input: string | number | null | undefined,
    options: { min?: number; max?: number; integer?: boolean } = {}
  ): number {
    if (input === null || input === undefined) {
      throw new Error('Number is required');
    }

    let num: number;

    if (typeof input === 'string') {
      if (!validator.isNumeric(input, { no_symbols: false })) {
        throw new Error('Invalid number format');
      }
      num = parseFloat(input);
    } else if (typeof input === 'number') {
      num = input;
    } else {
      throw new Error('Invalid number input');
    }

    if (isNaN(num) || !isFinite(num)) {
      throw new Error('Invalid number value');
    }

    if (options.integer && !Number.isInteger(num)) {
      throw new Error('Number must be an integer');
    }

    if (options.min !== undefined && num < options.min) {
      throw new Error(`Number must be at least ${options.min}`);
    }

    if (options.max !== undefined && num > options.max) {
      throw new Error(`Number must be at most ${options.max}`);
    }

    return num;
  }

  /**
   * Sanitize an object by applying sanitization to all string properties
   */
  static sanitizeObject<T extends Record<string, any>>(
    obj: T,
    fieldOptions: Record<keyof T, SanitizationOptions> = {}
  ): T {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const sanitized = { ...obj };

    for (const [key, value] of Object.entries(sanitized)) {
      const options = fieldOptions[key as keyof T] || {};

      if (typeof value === 'string') {
        sanitized[key as keyof T] = this.sanitizeString(value, options) as T[keyof T];
      } else if (Array.isArray(value)) {
        sanitized[key as keyof T] = value.map(item => 
          typeof item === 'string' ? this.sanitizeString(item, options) : item
        ) as T[keyof T];
      } else if (value && typeof value === 'object') {
        sanitized[key as keyof T] = this.sanitizeObject(value, {}) as T[keyof T];
      }
    }

    return sanitized;
  }

  /**
   * Validate and sanitize search query parameters
   */
  static sanitizeSearchQuery(query: string | null | undefined): string {
    if (!query || typeof query !== 'string') {
      return '';
    }

    let sanitized = query.trim();

    // Remove potentially dangerous SQL injection patterns
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
      /(--|\/\*|\*\/|;|'|"|`)/g,
      /(\bOR\b|\bAND\b)\s+\d+\s*=\s*\d+/gi,
    ];

    sqlPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });

    // Limit length
    if (sanitized.length > 100) {
      sanitized = sanitized.substring(0, 100);
    }

    // Escape HTML
    sanitized = validator.escape(sanitized);

    return sanitized;
  }

  /**
   * Sanitize JSON input to prevent prototype pollution
   */
  static sanitizeJSON(jsonString: string): any {
    if (!jsonString || typeof jsonString !== 'string') {
      throw new Error('Invalid JSON input');
    }

    try {
      const parsed = JSON.parse(jsonString);
      return this.removePrototypePollution(parsed);
    } catch (error) {
      throw new Error('Invalid JSON format');
    }
  }

  /**
   * Remove potential prototype pollution from objects
   */
  private static removePrototypePollution(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.removePrototypePollution(item));
    }

    const cleaned: any = {};
    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];

    for (const [key, value] of Object.entries(obj)) {
      if (!dangerousKeys.includes(key)) {
        cleaned[key] = this.removePrototypePollution(value);
      }
    }

    return cleaned;
  }
}

// Export commonly used sanitization functions
export const {
  sanitizeString,
  sanitizeEmail,
  sanitizeFilename,
  sanitizeURL,
  sanitizeNumber,
  sanitizeObject,
  sanitizeSearchQuery,
  sanitizeJSON,
} = InputSanitizer;