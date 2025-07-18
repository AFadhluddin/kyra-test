import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import axios from "axios";

const api = axios.create({ baseURL: "http://localhost:8000/api/v1" });

function Chat() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [location, setLocation] = useState("");

  async function login() {
    const { data } = await api.post("/login", { email, password: pw });
    setToken(data.access_token);
  }

  async function send() {
    if (!token) return;
    const { data } = await api.post(
      "/chat",
      { message: msg, location },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setLog((l) => [...l, `You: ${msg}`, `Bot: ${data.response}`]);
    setMsg("");
  }

  return (
    <div className="w-full max-w-lg bg-white p-4 rounded-xl shadow">
      {!token ? (
        <div className="flex flex-col gap-2">
          <input className="input" placeholder="Email" value={email}
                 onChange={(e) => setEmail(e.target.value)} />
          <input className="input" type="password" placeholder="Password"
                 value={pw} onChange={(e) => setPw(e.target.value)} />
          <button className="btn" onClick={login}>Login</button>
        </div>
      ) : (
        <>
          <input className="input mb-2" placeholder="Postcode (optional)"
                 value={location} onChange={(e) => setLocation(e.target.value)} />
          <div className="h-64 overflow-y-auto text-sm mb-2 border p-2 rounded">
            {log.map((l, i) => <p key={i}>{l}</p>)}
          </div>
          <div className="flex gap-2">
            <input className="flex-1 input" value={msg}
                   onChange={(e) => setMsg(e.target.value)}
                   onKeyDown={(e) => e.key === "Enter" && send()}
                   placeholder="Ask your question…" />
            <button className="btn" onClick={send}>Send</button>
          </div>
        </>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<Chat />);
