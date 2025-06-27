import pino from 'pino';
import { NextRequest } from 'next/server';
import {
  BaseLogData,
  RequestContext,
  DatabaseLogData,
  PerformanceLogData,
  WorkflowLogData,
  ResearchLogData,
  PaymentLogData,
  LoggableError
} from './types/logging';

// Create the base logger instance
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  ...(process.env.NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        ignore: 'pid,hostname',
        translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
      },
    },
  }),
});

// Helper function to create request context
export const createRequestContext = (req: NextRequest, additionalData?: BaseLogData): RequestContext & BaseLogData => {
  const url = req.url;
  const method = req.method;
  const userAgent = req.headers.get('user-agent');
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  
  return {
    request: {
      method,
      url,
      userAgent,
      ip,
    },
    ...additionalData,
  };
};

// API Route logging helpers
export const apiLogger = {
  info: (req: NextRequest, message: string, data?: BaseLogData) => {
    logger.info(createRequestContext(req, data), message);
  },
  
  error: (req: NextRequest, message: string, error?: Error | LoggableError, data?: BaseLogData) => {
    const errorData = error instanceof Error 
      ? { error: { message: error.message, stack: error.stack, name: error.name } }
      : { error };
    
    logger.error(createRequestContext(req, { ...errorData, ...data }), message);
  },
  
  warn: (req: NextRequest, message: string, data?: BaseLogData) => {
    logger.warn(createRequestContext(req, data), message);
  },
  
  debug: (req: NextRequest, message: string, data?: BaseLogData) => {
    logger.debug(createRequestContext(req, data), message);
  },
};

// Database operation logging
export const dbLogger = {
  query: (operation: string, table: string, duration?: number, data?: Omit<DatabaseLogData, 'operation' | 'table' | 'duration'>) => {
    logger.info({
      database: {
        operation,
        table,
        duration,
        ...data,
      },
    }, `Database ${operation} on ${table}`);
  },
  
  error: (operation: string, table: string, error: Error, data?: Omit<DatabaseLogData, 'operation' | 'table'>) => {
    logger.error({
      database: {
        operation,
        table,
        error: {
          message: error.message,
          stack: error.stack,
        },
        ...data,
      },
    }, `Database ${operation} failed on ${table}`);
  },
};

// Auth logging
export const authLogger = {
  login: (userId: string, method: string, ip?: string) => {
    logger.info({
      auth: {
        action: 'login',
        userId,
        method,
        ip,
      },
    }, 'User login attempt');
  },
  
  logout: (userId: string, ip?: string) => {
    logger.info({
      auth: {
        action: 'logout',
        userId,
        ip,
      },
    }, 'User logout');
  },
  
  failed: (email: string, reason: string, ip?: string) => {
    logger.warn({
      auth: {
        action: 'failed_login',
        email,
        reason,
        ip,
      },
    }, 'Login failed');
  },
};

// Performance logging
export const perfLogger = {
  apiResponse: (req: NextRequest, statusCode: number, duration: number, data?: Omit<PerformanceLogData, 'statusCode' | 'duration'>) => {
    logger.info(createRequestContext(req, {
      performance: {
        statusCode,
        duration,
        ...data,
      },
    }), `API response ${statusCode} in ${duration}ms`);
  },
  
  slow: (operation: string, duration: number, threshold: number, data?: Omit<PerformanceLogData, 'operation' | 'duration' | 'threshold'>) => {
    logger.warn({
      performance: {
        operation,
        duration,
        threshold,
        ...data,
      },
    }, `Slow operation detected: ${operation} took ${duration}ms (threshold: ${threshold}ms)`);
  },
};

// Business logic logging
export const businessLogger = {
  workflow: (workflowId: string, userId: string, action: WorkflowLogData['action'], data?: Omit<WorkflowLogData, 'workflowId' | 'userId' | 'action'>) => {
    logger.info({
      workflow: {
        workflowId,
        userId,
        action,
        ...data,
      },
    }, `Workflow ${action}: ${workflowId}`);
  },
  
  research: (userId: string, query: string, provider: string, cost?: number, additionalData?: Omit<ResearchLogData, 'userId' | 'query' | 'provider' | 'cost'>) => {
    logger.info({
      research: {
        userId,
        query: query.substring(0, 100), // Truncate for privacy
        provider,
        cost,
        ...additionalData,
      },
    }, 'Research query executed');
  },
  
  payment: (userId: string, amount: number, currency: string, status: PaymentLogData['status'], additionalData?: Omit<PaymentLogData, 'userId' | 'amount' | 'currency' | 'status'>) => {
    logger.info({
      payment: {
        userId,
        amount,
        currency,
        status,
        ...additionalData,
      },
    }, `Payment ${status}`);
  },
};

// Export the base logger for direct use
export { logger };
export default logger; 