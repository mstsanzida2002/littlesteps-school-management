import request from 'supertest';

import { createApp } from '../../src/app.js';
import { AcademicSession, Class, Section, Subject } from '../../src/models/index.js';
import { createUser, tokenFor } from './factories.js';

/**
 * A small school: active session 2026, Playgroup (A, B) and Nursery (A), three subjects,
 * one admin and one teacher.
 */
export async function createSchool() {
  const session = await AcademicSession.create({
    name: '2026',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    isActive: true,
  });
  const [playgroup, nursery] = await Class.create([
    { name: 'Playgroup', order: 1 },
    { name: 'Nursery', order: 2 },
  ]);
  const [pgA, pgB, nurA] = await Section.create([
    { classId: playgroup._id, name: 'A' },
    { classId: playgroup._id, name: 'B' },
    { classId: nursery._id, name: 'A' },
  ]);
  const [english, math, drawing] = await Subject.create([
    { name: 'English', code: 'ENG' },
    { name: 'Math', code: 'MATH' },
    { name: 'Drawing', code: 'DRW' },
  ]);
  const admin = await createUser({ role: 'admin', name: 'Head Admin' });
  const teacher = await createUser({ role: 'teacher', name: 'Farhana Akter' });

  return {
    session,
    classes: { playgroup, nursery },
    sections: { pgA, pgB, nurA },
    subjects: { english, math, drawing },
    admin,
    teacher,
  };
}

/** Supertest client that sends a user's access token. */
export function apiAs(user, app = createApp()) {
  const withAuth = async (method, path, body) => {
    const req = request(app)
      [method](`/api${path}`)
      .set('Authorization', `Bearer ${await tokenFor(user)}`);
    return body === undefined ? req : req.send(body);
  };
  return {
    get: (path) => withAuth('get', path),
    post: (path, body) => withAuth('post', path, body ?? {}),
    patch: (path, body) => withAuth('patch', path, body ?? {}),
    delete: (path) => withAuth('delete', path),
  };
}

export const guardian = {
  name: 'Sharmin Akter',
  relation: 'mother',
  phone: '01712345678',
};
