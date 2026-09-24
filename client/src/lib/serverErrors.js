/**
 * Map an ApiClientError onto a form. The server's 422 body is
 * { errors: [{ field: 'entries.0.marksObtained', message, location: 'body' }] }, and its dotted
 * paths are the same names react-hook-form uses, so body errors go straight onto their fields.
 */

const GENERIC_422 = 'Validation failed';

/** A field matches if it, or one of its parents ("entries" for "entries.0.marks"), is in the form. */
function matchesForm(field, known) {
  const parts = String(field).split('.');
  return parts.some((_, i) => known.has(parts.slice(0, i + 1).join('.')));
}

/**
 * → { fieldErrors: [{ field, message }], formMessage: string | null }
 * formMessage covers everything that can't be shown on a field (other status codes, network
 * errors, query/param errors or unknown fields); null when every error landed on a field.
 */
export function splitServerErrors(error, fieldNames = []) {
  const known = new Set(fieldNames);
  const errors = Array.isArray(error?.errors) ? error.errors : [];
  const fieldErrors = [];
  const leftovers = [];

  for (const item of errors) {
    const onBody = !item.location || item.location === 'body';
    if (onBody && item.field && matchesForm(item.field, known)) {
      // One message per field: the first is the most relevant.
      if (!fieldErrors.some((e) => e.field === item.field)) {
        fieldErrors.push({ field: item.field, message: item.message });
      }
    } else {
      leftovers.push(item.message);
    }
  }

  let formMessage = null;
  if (leftovers.length) formMessage = leftovers.join(' ');
  else if (!fieldErrors.length) {
    formMessage =
      error?.message && error.message !== GENERIC_422
        ? error.message
        : 'Something went wrong. Please try again.';
  }
  return { fieldErrors, formMessage };
}
