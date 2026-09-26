import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, setCsrfToken } from "./api";

export type MeResponse = {
  user: { id: string; display_name: string; created_at: string };
  csrfToken: string;
  integrations: {
    github: boolean;
    browserRun: boolean;
    workersAi: boolean;
    patchPr: boolean;
    projectDomains: boolean;
    devAuthBypass: boolean;
  };
};

type AuthState = {
  me: MeResponse | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api<MeResponse>("/api/auth/me");
      setMe(data);
      setCsrfToken(data.csrfToken);
    } catch {
      setMe(null);
      setCsrfToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" });
    setMe(null);
    setCsrfToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{ me, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside provider");
  return ctx;
}
