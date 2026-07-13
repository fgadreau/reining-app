import { useEffect, useState } from "react";
import {
  getAuthUser,
  isAuthAvailable,
  onAuthStateChange,
} from "./authRepository";
import { isLocalTestUser } from "./localTestAuth";

export function useAuthUser() {
  const [user, setUser] = useState(null);
  const [authEvent, setAuthEvent] = useState(null);
  const [isLoading, setIsLoading] = useState(isAuthAvailable());

  useEffect(() => {
    let isMounted = true;

    if (!isAuthAvailable()) {
      setUser(null);
      setIsLoading(false);
      return undefined;
    }

    async function loadUser() {
      setIsLoading(true);
      const nextUser = await getAuthUser();

      if (!isMounted) return;
      setUser(nextUser);
      setIsLoading(false);
    }

    const unsubscribe = onAuthStateChange((nextUser, nextAuthEvent) => {
      setUser(nextUser);
      setAuthEvent(nextAuthEvent || null);
      setIsLoading(false);
    });

    loadUser();

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  return {
    user,
    authEvent,
    isLoading,
    isConfigured: isAuthAvailable(),
    isAuthenticated: Boolean(user),
    isLocalTestUser: isLocalTestUser(user),
  };
}
