// Error Tracking Service
// Logs errors to the database for admin monitoring

import React from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { supabase } from './supabase';

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
    this.dbInsertTimestamps = this.dbInsertTimestamps.filter(
      (t) => now - t < DB_RATE_LIMIT_WINDOW_MS
    );
    return this.dbInsertTimestamps.length < DB_RATE_LIMIT_MAX;
  }

  // Log an error to the database
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

      // Log to console in dev
      if (__DEV__) {
        console.error(`[${severity}/${type}] ${errorMessage}`);
      }

      // Log to database (non-blocking, rate-limited)
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
          .then(() => {}, () => {});
      }
    } catch (err) {
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
      metadata: { statusCode, endpoint },
    });
  }

  // Log network errors
  logNetworkError(url: string, error: Error | string) {
    this.logError({
      error,
      severity: 'warning',
      type: 'network',
      component: 'NetworkRequest',
      metadata: { url },
    });
  }

  // Log validation errors (less severe)
  logValidationError(field: string, message: string, component?: string) {
    this.logError({
      error: `Validation error on ${field}: ${message}`,
      severity: 'info',
      type: 'validation',
      component,
      metadata: { field },
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
      metadata: { componentStack: errorInfo?.componentStack },
    });
  }

  // Set current screen for context
  setCurrentScreen(screen: string) {
    this.defaultMetadata.screen = screen;
  }

  // Set user ID for context
  setUserId(userId: string | null) {
    this.defaultMetadata.userId = userId || undefined;
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
