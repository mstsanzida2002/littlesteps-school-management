/** A MongoDB ObjectId as the API writes it (24 hex characters). */
export const isObjectId = (value) => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
