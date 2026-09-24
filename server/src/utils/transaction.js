import mongoose from 'mongoose';

/**
 * Run `fn(session)` in a MongoDB transaction (Mongoose 9 `connection.transaction`): commits when
 * fn resolves, aborts and rethrows when it throws, retries on transient errors. Pass `{ session }`
 * to every read/write inside, e.g. `Model.create([doc], { session })`.
 * Needs a replica set (Atlas; tests use a single-node replica set).
 */
export function withTransaction(fn) {
  return mongoose.connection.transaction(fn);
}
