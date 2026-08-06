/**
 * Friendly Arabic error messages and error handling utilities
 */

export type ErrorCode = 
  | 'NETWORK_ERROR'
  | 'AUTH_ERROR'
  | 'PERMISSION_DENIED'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMIT_EXCEEDED'
  | 'SERVER_ERROR'
  | 'UNKNOWN_ERROR';

const errorMessages: Record<ErrorCode, string> = {
  NETWORK_ERROR: 'تعذر الاتصال بالخادم. الرجاء التحقق من اتصال الإنترنت والمحاولة مرة أخرى',
  AUTH_ERROR: 'يجب تسجيل الدخول للوصول إلى هذه الصفحة',
  PERMISSION_DENIED: 'ليس لديك الصلاحية للقيام بهذا الإجراء',
  NOT_FOUND: 'المحتوى المطلوب غير موجود',
  VALIDATION_ERROR: 'البيانات المدخلة غير صحيحة. الرجاء التحقق والمحاولة مرة أخرى',
  RATE_LIMIT_EXCEEDED: 'لقد تجاوزت الحد المسموح من المحاولات. الرجاء الانتظار قليلاً والمحاولة مرة أخرى',
  SERVER_ERROR: 'حدث خطأ في الخادم. نحن نعمل على إصلاحه. الرجاء المحاولة لاحقاً',
  UNKNOWN_ERROR: 'حدث خطأ غير متوقع. الرجاء المحاولة مرة أخرى',
};

/**
 * Get friendly Arabic error message
 */
export function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }
  
  if (error instanceof Error) {
    // Try to extract error code from message
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch')) {
      return errorMessages.NETWORK_ERROR;
    }
    if (message.includes('auth') || message.includes('unauthorized')) {
      return errorMessages.AUTH_ERROR;
    }
    if (message.includes('permission') || message.includes('forbidden')) {
      return errorMessages.PERMISSION_DENIED;
    }
    if (message.includes('not found') || message.includes('404')) {
      return errorMessages.NOT_FOUND;
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return errorMessages.VALIDATION_ERROR;
    }
    if (message.includes('rate limit') || message.includes('too many')) {
      return errorMessages.RATE_LIMIT_EXCEEDED;
    }
    if (message.includes('server') || message.includes('500')) {
      return errorMessages.SERVER_ERROR;
    }
    
    return errorMessages.UNKNOWN_ERROR;
  }
  
  return errorMessages.UNKNOWN_ERROR;
}

/**
 * Log error for debugging (in production, send to error tracking service)
 */
export function logError(error: unknown, context?: string) {
  console.error(`[Error${context ? ` - ${context}` : ''}]:`, error);
  // In production, send to Sentry, LogRocket, or similar service
}

/**
 * Safe error handler that prevents app crashes
 */
export function safeErrorHandler<T>(
  fn: () => T,
  fallback: T,
  context?: string
): T {
  try {
    return fn();
  } catch (error) {
    logError(error, context);
    return fallback;
  }
}

/**
 * Async safe error handler
 */
export async function safeAsyncErrorHandler<T>(
  fn: () => Promise<T>,
  fallback: T,
  context?: string
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logError(error, context);
    return fallback;
  }
}
