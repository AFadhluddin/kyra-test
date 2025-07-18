import { useState } from "react";
import ReactDOM from "react-dom/client";
import axios from "axios";

const api = axios.create({ baseURL: "http://localhost:8000/api/v1" });

function Chat() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [msg, setMsg] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function login() {
    if (!email || !pw) {
      setError("Please fill in all fields");
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      const { data } = await api.post("/login", { email, password: pw });
      setToken(data.access_token);
      setLog([`Welcome back! You're now logged in.`]);
    } catch (error: any) {
      setError(error.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function signUp() {
    if (!email || !pw || !confirmPw) {
      setError("Please fill in all fields");
      return;
    }
    
    if (pw !== confirmPw) {
      setError("Passwords don't match");
      return;
    }
    
    if (pw.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      await api.post("/register", { email, password: pw });
      setError("");
      setLog([`Account created successfully! Please log in.`]);
      setIsSignUp(false);
      setPw("");
      setConfirmPw("");
    } catch (error: any) {
      setError(error.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  async function send() {
    if (!token || !msg.trim()) return;
    
    setLoading(true);
    
    try {
      const { data } = await api.post(
        "/chat",
        { message: msg, location },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setLog((l) => [...l, `You: ${msg}`, `Kyra: ${data.response}`]);
      setMsg("");
    } catch (error: any) {
      setLog((l) => [...l, `You: ${msg}`, `Error: ${error.response?.data?.message || "Failed to send message"}`]);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setToken(null);
    setLog([]);
    setEmail("");
    setPw("");
    setConfirmPw("");
    setError("");
  }

  return (
    <div className="w-full max-w-lg bg-white p-6 rounded-xl shadow-lg">
      {!token ? (
        <div className="space-y-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Kyra test</h1>
            <p className="text-gray-600">
              {isSignUp ? "Create your account" : "Sign in to your account"}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <input 
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
              placeholder="Email" 
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
            <input 
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
              type="password" 
              placeholder="Password"
              value={pw} 
              onChange={(e) => setPw(e.target.value)}
              disabled={loading}
            />
            {isSignUp && (
              <input 
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                type="password" 
                placeholder="Confirm Password"
                value={confirmPw} 
                onChange={(e) => setConfirmPw(e.target.value)}
                disabled={loading}
              />
            )}
            <button 
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-medium py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors" 
              onClick={isSignUp ? signUp : login}
              disabled={loading}
            >
              {loading ? "Please wait..." : (isSignUp ? "Sign Up" : "Login")}
            </button>
          </div>

          <div className="text-center">
            <button 
              className="text-blue-500 hover:text-blue-600 text-sm font-medium"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError("");
                setPw("");
                setConfirmPw("");
              }}
              disabled={loading}
            >
              {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-800">Kyra test</h1>
            <button 
              className="text-gray-500 hover:text-gray-700 text-sm"
              onClick={logout}
            >
              Logout
            </button>
          </div>

          <input 
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
            placeholder="Postcode (optional)"
            value={location} 
            onChange={(e) => setLocation(e.target.value)}
            disabled={loading}
          />

          <div className="h-64 overflow-y-auto text-sm border border-gray-200 p-4 rounded-lg bg-gray-50">
            {log.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                Welcome! Ask me any health-related questions.
              </p>
            ) : (
              log.map((l, i) => (
                <p key={i} className={`mb-2 ${l.startsWith('You:') ? 'text-blue-600' : l.startsWith('Kyra:') ? 'text-green-600' : 'text-red-600'}`}>
                  {l}
                </p>
              ))
            )}
          </div>

          <div className="flex gap-2">
            <input 
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && send()}
              placeholder="Ask your question…"
              disabled={loading}
            />
            <button 
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-medium py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors" 
              onClick={send}
              disabled={loading || !msg.trim()}
            >
              {loading ? "..." : "Send"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<Chat />);