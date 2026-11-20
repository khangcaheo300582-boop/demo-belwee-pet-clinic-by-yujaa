import * as Sentry from '@sentry/nextjs';

const sentryServerConfig = {
  dsn: process.env.SENTRY_DSN || '',
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  enabled: process.env.NODE_ENV === 'production' || process.env.SENTRY_ENABLED === 'true',
  beforeSend(event: any, hint: any) {
    if (event.request?.url?.includes('/api/') && event.level === 'error') {
      const originalException = hint?.originalException;
      if (
        originalException &&
        typeof originalException === 'object' &&
        'statusCode' in originalException
      ) {
        const status = (originalException as { statusCode?: number }).statusCode;
        if (status && status >= 400 && status < 500) {
          return null;
        }
      }
    }
    return event;
  },
  beforeBreadcrumb(breadcrumb: any) {
    const data = breadcrumb.data as Record<string, unknown> | undefined;
    if (breadcrumb.category === 'http') {
      if (data?.url && String(data.url).includes('/api/auth/login')) {
        return {
          ...breadcrumb,
          data: { ...data, body: '[REDACTED]' },
        };
      }
    }
    return breadcrumb;
  },
};

export default sentryServerConfig;
