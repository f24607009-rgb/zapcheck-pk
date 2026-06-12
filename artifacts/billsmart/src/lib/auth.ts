import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { createElement } from "react";

type User = { id: number; email: string; name?: string | null };
type AuthCtx = {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthCtx>({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
  isAuthenticated: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("bs_token"));
  const [user, setUser] = useState<User | null>(() => {
    const u = localStorage.getItem("bs_user");
    return u ? JSON.parse(u) : null;
  });

  const login = useCallback((tok: string, usr: User) => {
    localStorage.setItem("bs_token", tok);
    localStorage.setItem("bs_user", JSON.stringify(usr));
    setToken(tok);
    setUser(usr);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("bs_token");
    localStorage.removeItem("bs_user");
    setToken(null);
    setUser(null);
  }, []);

  return createElement(
    AuthContext.Provider,
    { value: { user, token, login, logout, isAuthenticated: !!token && !!user } },
    children
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function authHeaders(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}
