import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';

const app = createApp();

describe('GET /api/health', () => {
  it('returns 200 with the standard success envelope', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toMatchObject({
      success: true,
      message: expect.any(String),
      data: {
        status: 'ok',
        environment: 'test',
        uptime: expect.any(Number),
        timestamp: expect.any(String),
        database: 'disconnected',
      },
    });
  });

  it('sets security headers via Helmet', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('unknown routes', () => {
  it('returns 404 with the standard error envelope', async () => {
    const res = await request(app).get('/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      success: false,
      message: expect.stringContaining('not found'),
    });
  });
});

describe('database unavailable', () => {
  // This file never connects to MongoDB, so every DB-backed route must fail fast with 503.
  it('returns 503 DATABASE_UNAVAILABLE for API routes but keeps /api/health up', async () => {
    const res = await request(app).post('/api/auth/login').send({ identifier: 'a', password: 'b' });
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({
      success: false,
      code: 'DATABASE_UNAVAILABLE',
      message: expect.stringMatching(/^Service temporarily unavailable/),
    });
    expect((await request(app).get('/api/health')).status).toBe(200);
  });
});
