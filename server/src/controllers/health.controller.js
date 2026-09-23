import { env } from '../config/env.js';
import { getDbState } from '../config/db.js';
import { sendSuccess } from '../utils/apiResponse.js';

export function getHealth(req, res) {
  const database = getDbState();

  return sendSuccess(res, {
    message: 'LittleSteps API is running',
    data: {
      status: 'ok',
      environment: env.NODE_ENV,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      database,
    },
  });
}
