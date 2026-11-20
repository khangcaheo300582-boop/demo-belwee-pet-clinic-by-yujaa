import * as Sentry from '@sentry/nextjs';

const sentryClientConfig = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || '',
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  enabled:
    process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_SENTRY_ENABLED === 'true',
  ignoreErrors: [
    'Non-Error promise rejection captured',
    'Non-Error exception captured',
    'ResizeObserver loop limit exceeded',
  ],
  beforeSend(event: any, hint: any) {
    if (event.request?.url?.includes('chrome-extension://')) {
      return null;
    }
    return event;
  },
};

export default sentryClientConfig;
