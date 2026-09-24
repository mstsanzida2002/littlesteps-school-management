import { describe, expect, it } from 'vitest';

import { ApiClientError } from '../lib/axios.js';
import { splitServerErrors } from '../lib/serverErrors.js';

const error422 = (errors) =>
  new ApiClientError({ status: 422, message: 'Validation failed', errors });

describe('splitServerErrors', () => {
  it('puts body errors on their fields, first message per field', () => {
    const result = splitServerErrors(
      error422([
        { field: 'newPassword', message: 'Password must contain a number', location: 'body' },
        { field: 'newPassword', message: 'Second message', location: 'body' },
        { field: 'currentPassword', message: 'Current password is incorrect' },
      ]),
      ['currentPassword', 'newPassword', 'confirmPassword'],
    );
    expect(result.fieldErrors).toEqual([
      { field: 'newPassword', message: 'Password must contain a number' },
      { field: 'currentPassword', message: 'Current password is incorrect' },
    ]);
    expect(result.formMessage).toBeNull();
  });

  it('matches nested paths through their parent field (field arrays)', () => {
    const result = splitServerErrors(
      error422([
        { field: 'entries.2.marksObtained', message: 'Marks cannot exceed 20', location: 'body' },
      ]),
      ['entries'],
    );
    expect(result.fieldErrors).toEqual([
      { field: 'entries.2.marksObtained', message: 'Marks cannot exceed 20' },
    ]);
  });

  it('sends unknown fields and query/param errors to the form message', () => {
    const result = splitServerErrors(
      error422([
        { field: 'sectionId', message: 'Section does not belong to the class', location: 'body' },
        { field: 'date', message: 'Invalid date', location: 'query' },
      ]),
      ['date'],
    );
    expect(result.fieldErrors).toEqual([]);
    expect(result.formMessage).toBe('Section does not belong to the class Invalid date');
  });

  it('uses the server message for other errors, and a friendly one for a bare 422', () => {
    const conflict = new ApiClientError({ status: 409, message: 'Already marked' });
    const offline = new ApiClientError({ status: 0, message: 'Cannot reach the server.' });
    expect(splitServerErrors(conflict, ['x']).formMessage).toBe('Already marked');
    expect(splitServerErrors(offline).formMessage).toBe('Cannot reach the server.');
    expect(splitServerErrors(error422([])).formMessage).toBe(
      'Something went wrong. Please try again.',
    );
  });
});
