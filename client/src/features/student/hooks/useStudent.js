import { useQuery } from '@tanstack/react-query';

import { childName } from '../../../utils/names.js';
import { useAuth } from '../../auth/hooks/useAuth.js';
import { studentApi, studentKeys } from '../api/studentApi.js';

/** The child whose account is open: { id, name, nickname, displayName, username }. */
export function useChild() {
  const { user } = useAuth();
  return {
    id: user?._id ?? user?.id,
    name: user?.name ?? '',
    nickname: user?.nickname ?? null,
    displayName: childName(user),
    username: user?.username,
  };
}

/** GET /api/students/me — rarely changes, so kept for 5 minutes. */
export function useMyProfile() {
  return useQuery({
    queryKey: studentKeys.profile,
    queryFn: studentApi.profile,
    staleTime: 5 * 60 * 1000,
  });
}
