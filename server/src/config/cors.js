import { env } from './env.js';
import { ApiError } from '../utils/ApiError.js';

// In production the browser calls the API same-origin through the Vercel /api rewrite,
// so CORS only matters for direct calls (local dev tools, previews). Keep the allowlist tight.
export const corsOptions = {
  origin(origin, callback) {
    // Allow non-browser clients (curl, server-to-server, same-origin proxied requests).
    if (!origin || env.CLIENT_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(ApiError.forbidden(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
};
