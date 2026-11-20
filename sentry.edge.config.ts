import * as Sentry from '@sentry/nextjs';

const sentryEdgeConfig = {
  dsn: process.env.SENTRY_DSN || '',
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: 0.0,
  enabled: process.env.NODE_ENV === 'production',
  beforeSend(event: any) {
    if (event.level === 'error') {
      return event;
    }
    return null;
  },
};

export default sentryEdgeConfig;
