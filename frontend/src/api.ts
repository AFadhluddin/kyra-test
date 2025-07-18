// src/api.ts
import axios from "axios";

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1" });

export async function login(email: string, password: string) {
  const { data } = await api.post("/login", { email, password });
  return data.access_token as string;
}

export async function register(email: string, password: string) {
  await api.post("/register", { email, password });
  // server returns 200 with token OR 400 "already exists" – we ignore body
}
