import { useMutation } from '@tanstack/react-query';

import { login } from '../session.js';

export function useLogin() {
  return useMutation({ mutationFn: login });
}
