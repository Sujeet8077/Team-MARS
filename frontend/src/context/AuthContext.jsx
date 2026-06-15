import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "@/lib/api";

const AuthCtx = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    const token = localStorage.getItem("ss_token");
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
      applyTheme(data.theme || "light");
    } catch {
      localStorage.removeItem("ss_token");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("ss_token", data.token);
    setUser(data.user);
    applyTheme(data.user.theme || "light");
    return data.user;
  };

  const register = async (name, email, password) => {
    const { data } = await api.post("/auth/register", { name, email, password });
    localStorage.setItem("ss_token", data.token);
    setUser(data.user);
    applyTheme(data.user.theme || "light");
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem("ss_token");
    setUser(null);
    applyTheme("light");
  };

  const refreshUser = async () => {
    const { data } = await api.get("/auth/me");
    setUser(data);
    applyTheme(data.theme || "light");
  };

  return (
    <AuthCtx.Provider value={{ user, loading, login, register, logout, refreshUser, setUser }}>
      {children}
    </AuthCtx.Provider>
  );
};

export const useAuth = () => useContext(AuthCtx);

export const applyTheme = (theme) => {
  document.documentElement.setAttribute("data-theme", theme || "light");
};
