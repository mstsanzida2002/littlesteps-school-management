import http from 'node:http';

import { io as connect } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { User } from '../src/models/index.js';
import { notifyDataChanged, resetDataChanged, THROTTLE_MS } from '../src/realtime/dataChanged.js';
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

describe('session:ended (why a user was signed out)', () => {
  it('a suspended user is told why before the disconnect', async () => {
    const [ayaan] = school.students;
    const socket = open(await tokenFor(ayaan));
    await connected(socket);
    const told = nextEvent(socket, 'session:ended');
    const gone = disconnected(socket);
    await invalidateUserSessions(ayaan._id, 'suspended');
    expect(await told).toEqual({ reason: 'suspended' });
    await gone;
  });

  it('a password change on another device is not announced (only disconnected)', async () => {
    const [ayaan] = school.students;
    const socket = open(await tokenFor(ayaan));
    await connected(socket);
    let told = false;
    socket.on('session:ended', () => {
      told = true;
    });
    const gone = disconnected(socket);
    await invalidateUserSessions(ayaan._id, 'password_changed');
    await gone;
    expect(told).toBe(false);
  });
});

describe('data:changed (refresh signal, ids only)', () => {
  beforeEach(() => resetDataChanged());

  const collect = (socket) => {
    const events = [];
    socket.on('data:changed', (payload) => events.push(payload));
    return events;
  };
  const settle = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

  it('attendance reaches admins and the teachers of that class-section, not others', async () => {
    const [ayaan] = school.students;
    await assign(school, { subject: 'english', days: [school.weekday] });
    await assign(school, {
      subject: 'math',
      teacher: school.secondTeacher,
      days: [school.weekday],
      start: '09:00',
      end: '09:30',
    });
    const outsider = await User.create({
      name: 'Other Teacher',
      username: 'other.teacher',
      role: 'teacher',
      status: 'active',
      passwordHash: 'x'.repeat(60),
    });
    const sockets = {
      admin: open(await tokenFor(school.admin)),
      coTeacher: open(await tokenFor(school.secondTeacher)),
      outsider: open(await tokenFor(outsider)),
      guardian: open(await tokenFor(ayaan)),
    };
    await Promise.all(Object.values(sockets).map(connected));
    const seen = Object.fromEntries(Object.entries(sockets).map(([k, s]) => [k, collect(s)]));

    const res = await apiAs(school.teacher, app).post(
      '/attendance',
      markBody(school, { defaultStatus: 'present', entries: [] }),
    );
    expect(res.status).toBe(201);
    await settle();

    const expected = {
      scope: 'attendance',
      classId: String(school.classes.playgroup._id),
      sectionId: String(school.sections.pgA._id),
      dates: [school.dayKey],
    };
    expect(seen.admin).toEqual([expected]);
    expect(seen.coTeacher).toEqual([expected]);
    expect(seen.outsider).toEqual([]);
    expect(seen.guardian).toEqual([]);
    // Never personal data: only these keys.
    expect(Object.keys(seen.admin[0]).sort()).toEqual(['classId', 'dates', 'scope', 'sectionId']);
  });

  it('bursts are merged: one event at once, then one trailing event with every date', async () => {
    const admin = open(await tokenFor(school.admin));
    await connected(admin);
    const seen = collect(admin);
    const base = { scope: 'attendance', classId: 'c1', sectionId: 's1' };
    notifyDataChanged({ ...base, date: '2026-09-20' });
    notifyDataChanged({ ...base, date: '2026-09-21' });
    notifyDataChanged({ ...base, date: '2026-09-22' });
    await settle();
    expect(seen).toHaveLength(1);
    await settle(THROTTLE_MS);
    expect(seen).toHaveLength(2);
    expect(seen[1].dates).toEqual(['2026-09-21', '2026-09-22']);
  });

  it('admin writes signal their scope after success only; teachers get settings changes', async () => {
    const admin = open(await tokenFor(school.admin));
    const teacher = open(await tokenFor(school.teacher));
    await Promise.all([connected(admin), connected(teacher)]);
    const seenAdmin = collect(admin);
    const seenTeacher = collect(teacher);

    expect(
      (await apiAs(school.admin, app).patch('/settings', { attendanceThreshold: 80 })).status,
    ).toBe(200);
    // A failed write sends nothing.
    expect(
      (await apiAs(school.admin, app).patch('/settings', { attendanceThreshold: 900 })).status,
    ).toBe(422);
    const created = await apiAs(school.admin, app).post('/subjects', {
      name: 'Science',
      code: 'SCI',
    });
    expect(created.status).toBe(201);
    await settle();

    expect(seenAdmin).toEqual([{ scope: 'settings' }, { scope: 'structure' }]);
    expect(seenTeacher).toEqual([{ scope: 'settings' }, { scope: 'structure' }]);
  });
});
