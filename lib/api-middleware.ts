import { NextRequest, NextResponse } from 'next/server';
import { apiLogger, perfLogger, authLogger } from './logger';
import { 
  ApiRequestData,
  ApiResponseData
} from './types/logging';

// Types for the wrapper
type ApiHandler = (req: NextRequest) => Promise<NextResponse>;
type ApiMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface LoggedApiOptions {
  logBody?: boolean;
  logHeaders?: boolean;
  sensitiveFields?: string[];
  slowThreshold?: number;
}

// Function to sanitize sensitive data
function sanitizeData<T extends Record<string, unknown>>(
  data: T, 
  sensitiveFields: string[] = []
): T {
  if (!data || typeof data !== 'object') return data;
  
  const defaultSensitive = [
    'password', 'token', 'secret', 'key', 'authorization', 
    'cookie', 'x-api-key', 'api-key', 'credit_card', 'ssn'
  ];
  
  const allSensitive = [...defaultSensitive, ...sensitiveFields];
  
  const sanitized = { ...data };
  
  for (const field of allSensitive) {
    for (const key in sanitized) {
      if (key.toLowerCase().includes(field.toLowerCase())) {
        sanitized[key] = '[REDACTED]' as T[Extract<keyof T, string>];
      }
    }
  }
  
  return sanitized;
}

// Main logging middleware wrapper
export function withApiLogging(
  handler: ApiHandler,
  options: LoggedApiOptions = {}
): ApiHandler {
  const {
    logBody = true,
    logHeaders = false,
    sensitiveFields = [],
    slowThreshold = 1000
  } = options;

  return async (req: NextRequest): Promise<NextResponse> => {
    const startTime = performance.now();
    const method = req.method as ApiMethod;
    const url = req.url;
    const pathname = new URL(url).pathname;
    
    // Generate a unique request ID for tracing
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Log incoming request
    const requestData: Partial<ApiRequestData> = {
      requestId,
      method,
      pathname,
      userAgent: req.headers.get('user-agent'),
      contentType: req.headers.get('content-type'),
    };

    // Add headers if requested
    if (logHeaders) {
      const headers: Record<string, string> = {};
      req.headers.forEach((value, key) => {
        headers[key] = value;
      });
      requestData.headers = sanitizeData(headers, sensitiveFields);
    }

    // Add body for non-GET requests if requested
    if (logBody && method !== 'GET') {
      try {
        const body = await req.text();
        if (body) {
          try {
            requestData.body = sanitizeData(JSON.parse(body), sensitiveFields);
          } catch {
            requestData.body = body.substring(0, 200); // Truncate if not JSON
          }
        }
        
        // Recreate request with the body for the handler
        req = new NextRequest(url, {
          method: req.method,
          headers: req.headers,
          body: body || undefined,
        });
      } catch (error) {
        apiLogger.warn(req, 'Failed to read request body for logging', { 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }

    apiLogger.info(req, `Incoming ${method} request`, requestData);

    let response: NextResponse;
    let error: Error | null = null;

    try {
      // Execute the actual handler
      response = await handler(req);
      
      const duration = performance.now() - startTime;
      const statusCode = response.status;
      
      // Log response
      const responseData: Partial<ApiResponseData> = {
        requestId,
        statusCode,
        duration: Math.round(duration),
      };

      // Add response body if it's an error status
      if (statusCode >= 400) {
        try {
          const responseText = await response.text();
          if (responseText) {
            try {
              responseData.responseBody = JSON.parse(responseText);
            } catch {
              responseData.responseBody = responseText.substring(0, 200);
            }
          }
          
          // Recreate response
          response = new NextResponse(responseText, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
        } catch (logError) {
          apiLogger.warn(req, 'Failed to read response body for logging', { 
            error: logError instanceof Error ? logError.message : String(logError) 
          });
        }
      }

      // Log successful response
      if (statusCode < 400) {
        perfLogger.apiResponse(req, statusCode, duration, responseData);
      } else {
        apiLogger.warn(req, `API request failed with status ${statusCode}`, responseData);
      }

      // Log slow requests
      if (duration > slowThreshold) {
        perfLogger.slow(`API ${method} ${pathname}`, duration, slowThreshold, {
          requestId,
          statusCode,
        });
      }

      return response;

    } catch (caughtError) {
      error = caughtError instanceof Error ? caughtError : new Error(String(caughtError));
      const duration = performance.now() - startTime;
      
      apiLogger.error(req, `API request failed with exception`, error, {
        requestId,
        duration: Math.round(duration),
        method,
        pathname,
      });

      // Return a proper error response
      return NextResponse.json(
        { 
          error: 'Internal server error',
          requestId,
        },
        { status: 500 }
      );
    }
  };
}

// Simplified wrapper for common cases
export function loggedApi(handler: ApiHandler): ApiHandler {
  return withApiLogging(handler, {
    logBody: true,
    logHeaders: false,
    slowThreshold: 1000,
  });
}

// Wrapper for sensitive endpoints (auth, payments, etc.)
export function loggedSensitiveApi(
  handler: ApiHandler,
  additionalSensitiveFields: string[] = []
): ApiHandler {
  return withApiLogging(handler, {
    logBody: true,
    logHeaders: true,
    sensitiveFields: additionalSensitiveFields,
    slowThreshold: 500, // Lower threshold for sensitive operations
  });
}

// Auth-specific logging wrapper
export function loggedAuthApi(handler: ApiHandler): ApiHandler {
  return async (req: NextRequest): Promise<NextResponse> => {
    const wrappedHandler = withApiLogging(handler, {
      logBody: true,
      logHeaders: true,
      sensitiveFields: ['password', 'token', 'refresh_token', 'access_token'],
      slowThreshold: 500,
    });

    const response = await wrappedHandler(req);
    
    // Additional auth-specific logging
    const pathname = new URL(req.url).pathname;
    const status = response.status;
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    
    if (pathname.includes('/login') || pathname.includes('/sign-in')) {
      if (status === 200) {
        // Log successful login (you'll need to extract user info from your response)
        authLogger.login('unknown_user', 'email', ip);
      } else {
        authLogger.failed('unknown_email', 'invalid_credentials', ip);
      }
    } else if (pathname.includes('/logout') || pathname.includes('/sign-out')) {
      if (status === 200) {
        authLogger.logout('unknown_user', ip);
      }
    }

    return response;
  };
}

// Database operation logging helper (to use in API routes)
export function logDbOperation<T>(
  operation: string,
  table: string,
  fn: () => Promise<T>
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    const startTime = performance.now();
    
    try {
      const result = await fn();
      const duration = performance.now() - startTime;
      
      // Import dbLogger here to avoid circular dependencies
      const { dbLogger } = await import('./logger');
      dbLogger.query(operation, table, Math.round(duration));
      
      resolve(result);
    } catch (error) {
      const { dbLogger } = await import('./logger');
      dbLogger.error(operation, table, error instanceof Error ? error : new Error(String(error)));
      reject(error);
    }
  });
} 