'use client';

import * as Sentry from '@sentry/nextjs';
import {
  ClientLogData,
  UserActionData,
  NavigationData,
  FormData,
  ApiErrorData,
  PerformanceMeasurement,
  LoggableError
} from './types/logging';

// Client-side logger for React components
export const clientLogger = {
  info: (message: string, data?: Record<string, unknown>) => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.log(`[CLIENT] ${message}`, data ?? {});
    }
    Sentry.addBreadcrumb({
      message,
      level: 'info',
      data: data,
    });
  },

  warn: (message: string, data?: Record<string, unknown>) => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.warn(`[CLIENT WARNING] ${message}`, data ?? {});
    }
    Sentry.addBreadcrumb({
      message,
      level: 'warning',
      data: data,
    });
    Sentry.captureMessage(message, 'warning');
  },

  error: (message: string, error?: Error | unknown, data?: Record<string, unknown>) => {
    if (typeof window !== 'undefined') {
      console.error(`[CLIENT ERROR] ${message}`, error ?? 'Unknown error', data ?? {});
    }
    
    Sentry.withScope((scope) => {
      if (data) {
        Object.keys(data).forEach(key => {
          scope.setExtra(key, data[key]);
        });
      }
      
      if (error instanceof Error) {
        Sentry.captureException(error);
      } else {
        Sentry.captureMessage(message, 'error');
      }
    });
  },

  debug: (message: string, data?: Record<string, unknown>) => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.debug(`[CLIENT DEBUG] ${message}`, data ?? {});
    }
    Sentry.addBreadcrumb({
      message,
      level: 'debug',
      data: data,
    });
  },

  // Component lifecycle logging
  componentMount: (componentName: string, props?: Record<string, unknown>) => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.log(`[COMPONENT] ${componentName} mounted`, props ?? {});
    }
  },

  componentUnmount: (componentName: string) => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.log(`[COMPONENT] ${componentName} unmounted`);
    }
  },

  // User action logging
  userAction: (action: string, context?: string, data?: Record<string, unknown>) => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.log(`[USER ACTION] ${action}${context ? ` in ${context}` : ''}`, data ?? {});
    }
  },
};

// React component error boundary helpers
export const componentLogger = {
  mount: (componentName: string, props?: Record<string, unknown>) => {
    clientLogger.debug(`Component mounted: ${componentName}`, { 
      componentName, 
      action: 'mount' as const, 
      propsCount: props ? Object.keys(props).length : 0
    });
  },

  unmount: (componentName: string) => {
    clientLogger.debug(`Component unmounted: ${componentName}`, {
      componentName,
      action: 'unmount' as const
    });
  },

  interaction: (componentName: string, action: string, data?: Record<string, unknown>) => {
    clientLogger.info(`User interaction: ${action} in ${componentName}`, {
      componentName,
      action: 'interaction' as const,
      ...data
    });
  },

  apiCall: (componentName: string, endpoint: string, method: string, duration?: number) => {
    clientLogger.info(`API call from ${componentName}`, {
      componentName,
      action: 'api_call' as const,
      endpoint,
      method,
      duration,
    });
  },

  renderError: (componentName: string, error: Error, errorInfo?: { componentStack?: string; errorBoundary?: string }) => {
    clientLogger.error(`Render error in ${componentName}`, error, { 
      componentName,
      action: 'render_error' as const,
      errorInfo 
    });
  },
};

// User action tracking
export const userLogger = {
  action: (action: string, data?: Omit<UserActionData, 'action'>) => {
    const logData: UserActionData = { action, ...data };
    clientLogger.info(`User action: ${action}`, logData);
    
    Sentry.addBreadcrumb({
      message: `User action: ${action}`,
      level: 'info',
      category: 'user',
      data: logData,
    });
  },

  navigation: (from: string, to: string, additionalData?: Omit<NavigationData, 'from' | 'to'>) => {
    const logData: NavigationData = { from, to, ...additionalData };
    clientLogger.info(`Navigation: ${from} -> ${to}`, logData);
    
    Sentry.addBreadcrumb({
      message: `Navigation: ${from} -> ${to}`,
      level: 'info',
      category: 'navigation',
      data: logData,
    });
  },

  formSubmit: (formName: string, success: boolean, data?: Omit<FormData, 'formName' | 'success'>) => {
    const logData: FormData = { formName, success, ...data };
    const message = `Form ${formName} ${success ? 'submitted' : 'failed'}`;
    
    if (success) {
      clientLogger.info(message, logData);
    } else {
      clientLogger.warn(message, logData);
    }
  },

  apiError: (endpoint: string, status: number, message: string, additionalData?: Omit<ApiErrorData, 'endpoint' | 'status' | 'message'>) => {
    const logData: ApiErrorData = { endpoint, status, message, ...additionalData };
    clientLogger.error(`API Error: ${endpoint}`, new Error(message), logData);
  },
};

// Performance monitoring
export const perfLogger = {
  measure: (name: string, startTime: number, data?: Omit<PerformanceMeasurement, 'name' | 'duration' | 'startTime'>) => {
    const duration = performance.now() - startTime;
    const logData: PerformanceMeasurement = {
      name,
      duration: Math.round(duration),
      startTime,
      endTime: performance.now(),
      ...data,
    };
    
    clientLogger.info(`Performance: ${name}`, logData);

    // Report slow operations to Sentry
    if (duration > 1000) {
      Sentry.addBreadcrumb({
        message: `Slow operation: ${name} took ${Math.round(duration)}ms`,
        level: 'warning',
        category: 'performance',
        data: logData,
      });
    }

    return duration;
  },

  pageLoad: (pageName: string, loadTime: number, additionalData?: Omit<NavigationData, 'from' | 'to' | 'loadTime'>) => {
    const logData: NavigationData = { 
      from: 'unknown', 
      to: pageName, 
      loadTime,
      ...additionalData 
    };
    
    clientLogger.info(`Page loaded: ${pageName}`, logData);
    
    Sentry.addBreadcrumb({
      message: `Page loaded: ${pageName}`,
      level: 'info',
      category: 'navigation',
      data: logData,
    });
  },
};

// Hook for easy component integration
export const useLogger = (componentName: string) => {
  return {
    info: (message: string, extra?: ClientLogData) => 
      clientLogger.info(`[${componentName}] ${message}`, { 
        component: componentName, 
        ...extra 
      }),
    
    warn: (message: string, extra?: ClientLogData) => 
      clientLogger.warn(`[${componentName}] ${message}`, { 
        component: componentName, 
        ...extra 
      }),
    
    error: (message: string, error?: Error | LoggableError, extra?: ClientLogData) => 
      clientLogger.error(`[${componentName}] ${message}`, error, { 
        component: componentName, 
        ...extra 
      }),
    
    debug: (message: string, extra?: ClientLogData) => 
      clientLogger.debug(`[${componentName}] ${message}`, { 
        component: componentName, 
        ...extra 
      }),
    
    interaction: (action: string, data?: Record<string, unknown>) => 
      componentLogger.interaction(componentName, action, data),
    
    mount: (props?: Record<string, unknown>) => 
      componentLogger.mount(componentName, props),
    
    unmount: () => 
      componentLogger.unmount(componentName),
  };
}; 