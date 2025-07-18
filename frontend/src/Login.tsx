// src/Login.tsx
import { useState } from "react";
import { login, register } from "./api";

export default function Login({ onAuth }: { onAuth: (token: string) => void }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [err, setErr] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (mode === "signup") await register(email, pw);
      const token = await login(email, pw);
      onAuth(token);
    } catch {
      setErr("Invalid credentials or user already exists");
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-20 p-6 rounded-xl shadow bg-white">
      <h2 className="text-xl font-semibold mb-4">
        {mode === "login" ? "Sign in" : "Create account"}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          className="w-full border p-2 rounded"
          placeholder="email@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <input
          type="password"
          className="w-full border p-2 rounded"
          placeholder="password"
          value={pw}
          onChange={e => setPw(e.target.value)}
        />

        {err && <p className="text-red-600 text-sm">{err}</p>}

        <button className="w-full py-2 rounded bg-blue-600 text-white">
          {mode === "login" ? "Log in" : "Sign up & log in"}
        </button>
      </form>

      <p className="mt-3 text-sm text-center">
        {mode === "login" ? (
          <>
            No account?{" "}
            <button className="underline" onClick={() => setMode("signup")}>
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have one?{" "}
            <button className="underline" onClick={() => setMode("login")}>
              Log in
            </button>
          </>
        )}
      </p>
    </div>
  );
}
