import { useState } from 'react';
import { useNavigate } from 'react-router';

import { ROUTES } from '../../../config/constants.js';
import { useAuth } from '../../auth/hooks/useAuth.js';

/** The login page offers the children remembered on this device when it has ?switch=1. */
export const SWITCH_CHILD_LOGIN = `${ROUTES.LOGIN}?switch=1`;

/**
 * "Switch child" on a shared phone: the normal logout (server revoke, cache cleared, other tabs
 * told), then the login page with this device's remembered children as one-tap choices.
 */
export function useSwitchChild() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [switching, setSwitching] = useState(false);
  const switchChild = async () => {
    setSwitching(true);
    await logout();
    navigate(SWITCH_CHILD_LOGIN, { replace: true });
  };
  return { switchChild, switching };
}
