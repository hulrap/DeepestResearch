// Base logging interfaces
export interface BaseLogData {
  [key: string]: string | number | boolean | null | undefined | BaseLogData | BaseLogData[] | Record<string, unknown>;
}

export interface RequestContext {
  method: string;
  url: string;
  userAgent: string | null;
  ip: string;
}

export interface DatabaseLogData extends BaseLogData {
  operation: string;
  table: string;
  duration?: number;
  rowsAffected?: number;
  queryParams?: Record<string, unknown>;
}

export interface AuthLogData extends BaseLogData {
  action: 'login' | 'logout' | 'failed_login' | 'token_refresh' | 'password_reset';
  userId?: string;
  email?: string;
  method?: string;
  ip?: string;
  reason?: string;
  attemptCount?: number;
}

export interface PerformanceLogData extends BaseLogData {
  statusCode?: number;
  duration: number;
  operation?: string;
  threshold?: number;
  memoryUsage?: number;
  cpuUsage?: number;
}

export interface WorkflowLogData extends BaseLogData {
  workflowId: string;
  userId: string;
  action: 'started' | 'completed' | 'failed' | 'paused' | 'resumed';
  stepCount?: number;
  currentStep?: string;
  errorStep?: string;
}

export interface ResearchLogData extends BaseLogData {
  userId: string;
  query: string;
  provider: string;
  cost?: number;
  tokensUsed?: number;
  model?: string;
  responseTime?: number;
}

export interface PaymentLogData extends BaseLogData {
  userId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled';
  paymentId?: string;
  gateway?: string;
  errorCode?: string;
}

export interface ApiRequestData extends BaseLogData {
  requestId: string;
  method: string;
  pathname: string;
  userAgent?: string | null;
  contentType?: string | null;
  headers?: Record<string, string>;
  body?: Record<string, unknown> | string;
  queryParams?: Record<string, string>;
}

export interface ApiResponseData extends BaseLogData {
  requestId: string;
  statusCode: number;
  duration: number;
  responseSize?: number;
  responseBody?: Record<string, unknown> | string;
  errorDetails?: {
    message: string;
    stack?: string;
    name?: string;
    code?: string;
  };
}

export interface ClientLogData extends BaseLogData {
  component?: string;
  action?: string;
  props?: Record<string, unknown>;
  userAgent?: string;
  url?: string;
  timestamp?: number;
}

export interface ComponentLogData extends BaseLogData {
  componentName: string;
  action: 'mount' | 'unmount' | 'interaction' | 'api_call' | 'render_error';
  props?: Record<string, unknown>;
  endpoint?: string;
  method?: string;
  duration?: number;
  errorInfo?: {
    componentStack?: string;
    errorBoundary?: string;
  };
}

export interface UserActionData extends BaseLogData {
  action: string;
  userId?: string;
  sessionId?: string;
  page?: string;
  element?: string;
  metadata?: Record<string, unknown>;
}

export interface NavigationData extends BaseLogData {
  from: string;
  to: string;
  userId?: string;
  sessionId?: string;
  referrer?: string;
  loadTime?: number;
}

export interface FormData extends BaseLogData {
  formName: string;
  success: boolean;
  fields?: string[];
  validationErrors?: Record<string, string>;
  submissionTime?: number;
}

export interface ApiErrorData extends BaseLogData {
  endpoint: string;
  status: number;
  message: string;
  requestId?: string;
  userId?: string;
  retryCount?: number;
}

export interface PerformanceMeasurement extends BaseLogData {
  name: string;
  duration: number;
  startTime?: number;
  endTime?: number;
  memoryDelta?: number;
  category?: 'api' | 'database' | 'computation' | 'rendering' | 'network';
}

// Union types for different log contexts
export type LogData = 
  | BaseLogData 
  | DatabaseLogData 
  | AuthLogData 
  | PerformanceLogData 
  | WorkflowLogData 
  | ResearchLogData 
  | PaymentLogData
  | ClientLogData
  | ComponentLogData
  | UserActionData
  | NavigationData
  | FormData
  | ApiErrorData
  | PerformanceMeasurement;

// Error types
export interface LoggableError {
  message: string;
  stack?: string;
  name?: string;
  code?: string | number;
  cause?: LoggableError;
}

// Sensitive field configuration
export interface SensitiveFieldConfig {
  defaultFields: string[];
  customFields: string[];
  redactionText: string;
} 