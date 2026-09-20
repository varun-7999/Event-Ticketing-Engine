// src/context/AuthContext.jsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import api from "../services/api";

const AuthContext = createContext(undefined);
//A helper function that checks browser storage on first boot
function readStoredUser() {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Keep localStorage in sync whenever user/token state changes.
  useEffect(() => {
    if (user && token) {
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("token", token);
    }
  }, [user, token]);

  const login = useCallback(async (email, password) => {
    setIsLoading(true);
    setError(null);
    try {
      // Response shape per spec: { success: true, token, user: { _id, name, email } }
      const response = await api.post("/auth/login", { email, password });
      const { user: loggedInUser, token: authToken } = response.data;

      setUser(loggedInUser);
      setToken(authToken);
      localStorage.setItem("user", JSON.stringify(loggedInUser));
      localStorage.setItem("token", authToken);

      return { success: true, user: loggedInUser };
    } catch (err) {
      const message =
        err.response?.data?.message || "Unable to log in. Please try again.";
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (name, email, password, role = "attendee") => {
    setIsLoading(true);
    setError(null);
    try {
      // Response shape per spec: { success: true, token, user: { _id, name, email } }
      const response = await api.post("/auth/register", {
        name,
        email,
        password,
        role,
      });
      const { user: newUser, token: authToken } = response.data;

      setUser(newUser);
      setToken(authToken);
      localStorage.setItem("user", JSON.stringify(newUser));
      localStorage.setItem("token", authToken);

      return { success: true, user: newUser };
    } catch (err) {
      const message =
        err.response?.data?.message ||
        "Unable to create an account. Please try again.";
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  }, []);

  const value = {
    user,
    token,
    isAuthenticated: Boolean(user && token),
    isLoading,
    error,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}