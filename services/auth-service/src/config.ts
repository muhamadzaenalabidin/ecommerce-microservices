export const config = {
  serviceName: 'auth-service',
  port: Number(process.env.PORT || process.env.AUTH_SERVICE_PORT || 3001),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
} as const;