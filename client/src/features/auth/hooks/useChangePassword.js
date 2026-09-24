import { useMutation } from '@tanstack/react-query';

import { changePassword } from '../session.js';

export function useChangePassword() {
  return useMutation({ mutationFn: changePassword });
}
