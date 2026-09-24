import http from 'node:http';

import { io as connect } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { User } from '../src/models/index.js';
import { closeRealtime, initRealtime } from '../src/realtime/io.js';
import {
  invalidateUserSessions,
  issueSession,
  revokeRefreshToken,
} from '../src/services/token.service.js';
import { assign, createAttendanceSchool, markBody } from './helpers/attendance.js';
import { clearTestDB, startTestDB, stopTestDB } from './helpers/db.js';
import { tokenFor } from './helpers/factories.js';
import { apiAs } from './helpers/school.js';

let server;
let url;
let app;
const sockets = [];

beforeAll(async () => {
  await startTestDB();
  app = createApp();
  server = http.createServer(app);
  initRealtime(server, { origins: ['http://localhost:5173'] });
  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://localhost:${server.address().port}`;
});

afterEach(async () => {
  sockets.splice(0).forEach((s) => s.disconnect());
  await clearTestDB();
});

afterAll(async () => {
  closeRealtime();
  await new Promise((resolve) => server.close(resolve));
  await stopTestDB();
});

function open(token) {
  const socket = connect(url, {
    path: '/socket.io',
    transports: ['websocket'],
    reconnection: false,
    auth: token === undefined ? {} : { token },
  });
  sockets.push(socket);
  return socket;
}

const connected = (socket) =>
  new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
const rejected = (socket) =>
  new Promise((resolve, reject) => {
    socket.once('connect', () => reject(new Error('connected unexpectedly')));
    socket.once('connect_error', resolve);
  });
const disconnected = (socket) => new Promise((resolve) => socket.once('disconnect', resolve));
const nextEvent = (socket, event) => new Promise((resolve) => socket.once(event, resolve));

let school;
beforeEach(async () => {
  school = await createAttendanceSchool();
});

describe('handshake authentication', () => {
  it('rejects a missing, malformed or outdated token and suspended users', async () => {
    expect((await rejected(open(undefined))).message).toBe('Authentication required');
    expect((await rejected(open('not-a-jwt'))).message).toBe('Invalid access token');

    const [ayaan, nusrat] = school.students;
    const stale = await tokenFor(ayaan);
    await User.updateOne({ _id: ayaan._id }, { $inc: { tokenVersion: 1 } });
    expect((await rejected(open(stale))).message).toMatch(/Session expired/);

    const token = await tokenFor(nusrat);
    await User.updateOne({ _id: nusrat._id }, { status: 'suspended' });
    expect((await rejected(open(token))).message).toBe('Account is not active');
  });

  it('rejects users who must change their password', async () => {
    await User.updateOne({ _id: school.students[0]._id }, { mustChangePassword: true });
    const err = await rejected(open(await tokenFor(school.students[0])));
    expect(err.data.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });
});

describe('delivery and disconnects', () => {
  it('a student receives the absence notification and unread count after the commit', async () => {
    const [ayaan] = school.students;
    await assign(school, { subject: 'english', days: [school.weekday] });
    const socket = open(await tokenFor(ayaan));
    await connected(socket);

    const newEvent = nextEvent(socket, 'notification:new');
    const countEvent = nextEvent(socket, 'notifications:unread-count');
    const res = await apiAs(school.teacher, app).post(
      '/attendance',
      markBody(school, {
        defaultStatus: 'present',
        entries: [{ studentId: String(ayaan._id), status: 'absent' }],
      }),
    );
    expect(res.status).toBe(201);
    expect((await newEvent).type).toBe('absence');
    expect(await countEvent).toEqual({ count: 1 });
  });

  it('invalidating sessions (suspension/password change) disconnects every socket of the user', async () => {
    const [ayaan] = school.students;
    const a = open(await tokenFor(ayaan));
    const b = open(await tokenFor(ayaan));
    await Promise.all([connected(a), connected(b)]);
    const gone = Promise.all([disconnected(a), disconnected(b)]);
    await invalidateUserSessions(ayaan._id, 'suspended');
    await gone;
    expect(a.connected || b.connected).toBe(false);
  });

  it("logout disconnects only that login's sockets (sid)", async () => {
    const [ayaan] = school.students;
    const phone = await issueSession(ayaan);
    const laptop = await issueSession(ayaan);
    const phoneSocket = open(phone.accessToken);
    const laptopSocket = open(laptop.accessToken);
    await Promise.all([connected(phoneSocket), connected(laptopSocket)]);

    const gone = disconnected(phoneSocket);
    await revokeRefreshToken(phone.refreshToken, 'logout');
    await gone;
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(laptopSocket.connected).toBe(true);
  });
});
