// Error Tracking Service
// Captures and logs errors to Sentry and the database for admin monitoring
// Optimized for scale - minimal data, no PII, low sampling

import React from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Sentry from '@sentry/react-native';
import { supabase } from './supabase';

const SENTRY_DSN = 'https://43c5dfa04aa07661d095cf7bdb5a824b@o4510662171820032.ingest.us.sentry.io/4510662173327360';

// Rate limit DB inserts: max 10 errors per 60 seconds
const DB_RATE_LIMIT_MAX = 10;
const DB_RATE_LIMIT_WINDOW_MS = 60_000;

type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';
type ErrorType = 'crash' | 'api' | 'validation' | 'network' | 'unknown';

interface ErrorMetadata {
  deviceType?: string;
  osVersion?: string;
  appVersion?: string;
  screen?: string;
  userId?: string;
  extra?: Record<string, any>;
}

class ErrorTrackingService {
  private isInitialized = false;
  private defaultMetadata: ErrorMetadata = {};
  private dbInsertTimestamps: number[] = [];

  // Initialize error tracking with app context
  async initialize() {
    if (this.isInitialized) return;

    try {
      // Initialize Sentry - optimized for scale, no PII, minimal sampling.
      // Sentry.init() automatically sets up global error handlers and
      // promise rejection handlers. Do NOT override them manually.
      Sentry.init({
        dsn: SENTRY_DSN,

        // Environment
        environment: __DEV__ ? 'development' : 'production',
        debug: false,

        // Performance - minimal sampling to reduce costs at scale
        tracesSampleRate: __DEV__ ? 0.1 : 0.01, // 1% in production
        enableAutoSessionTracking: true,
        sessionTrackingIntervalMillis: 60000,

        // Privacy - NO PII
        sendDefaultPii: false,
        attachStacktrace: true,

        // Strip any potential PII before sending
        beforeSend(event) {
          if (event.user) {
            delete event.user.email;
            delete event.user.username;
            delete event.user.ip_address;
          }

          if (event.request) {
            delete event.request.cookies;
            delete event.request.headers;
          }

          // Only send errors and crashes in production
          if (!__DEV__ && event.level && !['error', 'fatal'].includes(event.level)) {
            return null;
          }

          return event;
        },

        // Only capture critical breadcrumbs
        beforeBreadcrumb(breadcrumb) {
          if (breadcrumb.category === 'ui.click') {
            return null;
          }
          return breadcrumb;
        },

        maxBreadcrumbs: 20,
      });

      this.defaultMetadata = {
        deviceType: Device.deviceType ? String(Device.deviceType) : 'unknown',
        osVersion: `${Platform.OS} ${Platform.Version}`,
        appVersion: Constants.expoConfig?.version || '1.0.0',
      };

      this.isInitialized = true;
    } catch (err) {
      console.error('Failed to initialize error tracking:', err);
    }
  }

  // Check if we can write to the DB without exceeding rate limit
  private canWriteToDb(): boolean {
    const now = Date.now();
    // Remove timestamps outside the window
    this.dbInsertTimestamps = this.dbInsertTimestamps.filter(
      (t) => now - t < DB_RATE_LIMIT_WINDOW_MS
    );
    return this.dbInsertTimestamps.length < DB_RATE_LIMIT_MAX;
  }

  // Log an error to Sentry and (non-blocking) to the database
  async logError({
    error,
    severity = 'error',
    type = 'unknown',
    component,
    metadata = {},
  }: {
    error: Error | string;
    severity?: ErrorSeverity;
    type?: ErrorType;
    component?: string;
    metadata?: Record<string, any>;
  }) {
    try {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      // Send to Sentry (always, this is the primary destination)
      const severityToSentryLevel: Record<ErrorSeverity, string> = {
        critical: 'fatal',
        warning: 'warning',
        info: 'info',
        error: 'error',
      };
      const sentryLevel = severityToSentryLevel[severity] || 'error';

      Sentry.withScope((scope) => {
        scope.setLevel(sentryLevel as Sentry.SeverityLevel);
        scope.setTag('error_type', type);
        if (component) scope.setTag('component', component);
        scope.setExtras({ ...this.defaultMetadata, ...metadata });

        if (error instanceof Error) {
          Sentry.captureException(error);
        } else {
          Sentry.captureMessage(errorMessage);
        }
      });

      // Also log to database (non-blocking, rate-limited)
      // Uses cached userId from defaultMetadata -- no network call needed
      if (this.canWriteToDb()) {
        this.dbInsertTimestamps.push(Date.now());

        supabase
          .from('error_logs')
          .insert({
            user_id: this.defaultMetadata.userId || null,
            error_type: type,
            error_message: errorMessage,
            error_stack: errorStack,
            component,
            severity,
            metadata: {
              ...this.defaultMetadata,
              ...metadata,
            },
          })
          .then(({ error: insertError }) => {
            if (insertError) {
              console.error('Failed to log error to database:', insertError);
            }
          })
          .catch(() => {
            // Silently fail -- Sentry is the source of truth
          });
      }
    } catch (err) {
      // Don't throw errors from error logging
      console.error('Error in error tracking:', err);
    }
  }

  // Log API errors
  logApiError(endpoint: string, error: Error | string, statusCode?: number) {
    this.logError({
      error,
      severity: statusCode && statusCode >= 500 ? 'critical' : 'error',
      type: 'api',
      component: endpoint,
      metadata: {
        statusCode,
        endpoint,
      },
    });
  }

  // Log network errors
  logNetworkError(url: string, error: Error | string) {
    this.logError({
      error,
      severity: 'warning',
      type: 'network',
      component: 'NetworkRequest',
      metadata: {
        url,
      },
    });
  }

  // Log validation errors (less severe)
  logValidationError(field: string, message: string, component?: string) {
    this.logError({
      error: `Validation error on ${field}: ${message}`,
      severity: 'info',
      type: 'validation',
      component,
      metadata: {
        field,
      },
    });
  }

  // Log custom errors with context
  logCustomError(message: string, context: Record<string, any>, severity: ErrorSeverity = 'error') {
    this.logError({
      error: message,
      severity,
      type: 'unknown',
      metadata: context,
    });
  }

  // Capture error for React error boundary
  captureException(error: Error, errorInfo?: { componentStack?: string }) {
    this.logError({
      error,
      severity: 'critical',
      type: 'crash',
      component: 'ErrorBoundary',
      metadata: {
        componentStack: errorInfo?.componentStack,
      },
    });
  }

  // Set current screen for context
  setCurrentScreen(screen: string) {
    this.defaultMetadata.screen = screen;
  }

  // Set user ID for context (anonymous ID only - no PII)
  setUserId(userId: string | null) {
    this.defaultMetadata.userId = userId || undefined;

    if (userId) {
      Sentry.setUser({ id: userId });
    } else {
      Sentry.setUser(null);
    }
  }
}

export const errorTracking = new ErrorTrackingService();

// React Error Boundary helper
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: React.ReactNode
) {
  return class ErrorBoundary extends React.Component<P, { hasError: boolean }> {
    constructor(props: P) {
      super(props);
      this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
      return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
      errorTracking.captureException(error, {
        componentStack: errorInfo.componentStack || undefined,
      });
    }

    render() {
      if (this.state.hasError) {
        return fallback || null;
      }

      return React.createElement(WrappedComponent, this.props as P);
    }
  };
}