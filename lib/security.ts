/**
 * Security utilities for input sanitization and validation
 */

/**
 * Sanitizes user input to prevent XSS attacks
 * Removes HTML tags and special characters
 */
export function sanitizeInput(input: string): string {
  if (!input) return '';
  
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers like onclick=
    .trim();
}

/**
 * Validates email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates text length
 */
export function isValidLength(text: string, min: number, max: number): boolean {
  const trimmed = text.trim();
  return trimmed.length >= min && trimmed.length <= max;
}

/**
 * Rate limiting tracker (in-memory for client-side)
 * In production, this should be server-side with Redis or similar
 */
class RateLimiter {
  private timestamps: Map<string, number[]> = new Map();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number = 5, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  canMakeRequest(identifier: string): boolean {
    const now = Date.now();
    const userTimestamps = this.timestamps.get(identifier) || [];
    
    // Remove timestamps outside the window
    const validTimestamps = userTimestamps.filter(
      (timestamp) => now - timestamp < this.windowMs
    );
    
    if (validTimestamps.length >= this.maxRequests) {
      return false;
    }
    
    // Add current timestamp
    validTimestamps.push(now);
    this.timestamps.set(identifier, validTimestamps);
    
    return true;
  }

  getRemainingRequests(identifier: string): number {
    const now = Date.now();
    const userTimestamps = this.timestamps.get(identifier) || [];
    const validTimestamps = userTimestamps.filter(
      (timestamp) => now - timestamp < this.windowMs
    );
    return Math.max(0, this.maxRequests - validTimestamps.length);
  }

  getResetTime(identifier: string): number {
    const userTimestamps = this.timestamps.get(identifier);
    if (!userTimestamps || userTimestamps.length === 0) return 0;
    
    const oldestTimestamp = Math.min(...userTimestamps);
    return oldestTimestamp + this.windowMs;
  }
}

// Export singleton instances for different use cases
export const feedbackRateLimiter = new RateLimiter(3, 60000); // 3 requests per minute
export const reportRateLimiter = new RateLimiter(5, 300000); // 5 reports per 5 minutes
export const messageRateLimiter = new RateLimiter(10, 60000); // 10 messages per minute

/**
 * Prevents extremely long text input
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength);
}

/**
 * Checks for common spam patterns
 */
export function isSpam(text: string): boolean {
  const spamPatterns = [
    /buy\s+now/i,
    /click\s+here/i,
    /free\s+money/i,
    /winner/i,
    /lottery/i,
    /casino/i,
    /xxx/i,
    /http:\/\/\w+\.\w+/i,
    /https?:\/\/\w+\.\w+/i,
  ];
  
  return spamPatterns.some(pattern => pattern.test(text));
}

/**
 * Validates Arabic text (optional, for fields that should be Arabic)
 */
export function isArabicText(text: string): boolean {
  const arabicRegex = /[\u0600-\u06FF]/;
  return arabicRegex.test(text);
}
