/**
 * Security utilities for input sanitization and validation.
 */

/**
 * Sanitize user input to prevent XSS and injection attacks.
 * Removes potentially dangerous characters while preserving Arabic text.
 */
export function sanitizeInput(input: string): string {
  if (!input) return '';
  
  // Remove null bytes and control characters (except common whitespace)
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .trim();
}

/**
 * Validate that a string is safe for use in API calls.
 * Returns true if the string passes basic validation.
 */
export function isValidInput(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  
  // Check for suspicious patterns
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i, // event handlers like onclick=
    /<iframe/i,
    /<object/i,
    /<embed/i,
  ];
  
  return !dangerousPatterns.some(pattern => pattern.test(input));
}

/**
 * Sanitize and validate a parking area name.
 */
export function sanitizeParkingArea(area: string): string {
  const sanitized = sanitizeInput(area);
  // Limit length to prevent abuse
  return sanitized.slice(0, 100);
}

/**
 * Sanitize and validate car description.
 */
export function sanitizeCarDescription(description: string): string {
  const sanitized = sanitizeInput(description);
  // Limit length
  return sanitized.slice(0, 200);
}

/**
 * Sanitize and validate chat message text.
 */
export function sanitizeMessage(text: string): string {
  const sanitized = sanitizeInput(text);
  // Limit message length
  return sanitized.slice(0, 1000);
}
