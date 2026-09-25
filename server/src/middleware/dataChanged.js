/**
 * After a successful write (any non-GET request that ends below 400), send the "data:changed"
 * refresh signal for a scope (realtime/dataChanged.js). The response is only sent once the
 * service finished, so the change is already committed. Ids only; no request data is forwarded.
 *
 *   router.use('/users', signalsDataChange('users'), createUserRouter());
 */
import { notifyDataChanged } from '../realtime/dataChanged.js';

export const signalsDataChange = (scope) => (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.on('finish', () => {
      if (res.statusCode < 400) notifyDataChanged({ scope });
    });
  }
  next();
};
