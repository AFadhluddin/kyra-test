import { useState, useEffect } from "react";
import axios from "axios";

import Login from "./Login";
import Chat from "./Chat";

const API_BASE =
  import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";
axios.defaults.baseURL = API_BASE;

export default function App() {
  const [token, setToken] = useState<string>(
    () => localStorage.getItem("jwt") ?? ""
  );

  useEffect(() => {
    const id = axios.interceptors.request.use(cfg => {
      if (token) cfg.headers.Authorization = `Bearer ${token}`;
      return cfg;
    });
    return () => axios.interceptors.request.eject(id);
  }, [token]);

  function handleAuth(newToken: string) {
    localStorage.setItem("jwt", newToken);
    setToken(newToken);
  }

  function handleLogout() {
    localStorage.removeItem("jwt");
    setToken("");
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {token ? <Chat onLogout={handleLogout} /> : <Login onAuth={handleAuth} />}
    </div>
  );
}
