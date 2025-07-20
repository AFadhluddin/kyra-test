import { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom/client";

const API_BASE_URL = "http://localhost:8000/api/v1";

// Enhanced markdown parser component
function MarkdownText({ text }) {
  const parseMarkdown = (text) => {
    // First, escape HTML to prevent XSS
    const escapeHtml = (str) => {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    };

    // Handle code blocks (triple backticks)
    text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre style="background-color: #1a1a1a; color: #e5e5e5; padding: 12px; border-radius: 8px; margin: 8px 0; overflow-x: auto;"><code style="font-size: 14px; font-family: monospace;">${escapeHtml(code.trim())}</code></pre>`;
    });

    // Handle inline code (single backticks)
    text = text.replace(/`([^`]+)`/g, '<code style="background-color: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 14px; font-family: monospace; color: #374151;">$1</code>');

    // Handle headers
    text = text.replace(/^### (.*?)$/gm, '<h3 style="font-size: 18px; font-weight: 600; margin-top: 12px; margin-bottom: 8px;">$1</h3>');
    text = text.replace(/^## (.*?)$/gm, '<h2 style="font-size: 20px; font-weight: 600; margin-top: 16px; margin-bottom: 8px;">$1</h2>');
    text = text.replace(/^# (.*?)$/gm, '<h1 style="font-size: 24px; font-weight: 700; margin-top: 16px; margin-bottom: 12px;">$1</h1>');

    // Handle bold text
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: 600;">$1</strong>');

    // Handle italic text
    text = text.replace(/(?<!\*)\*(?!\*)([^*]+)\*(?!\*)/g, '<em style="font-style: italic;">$1</em>');

    // Handle links
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #3b82f6; text-decoration: underline;" target="_blank" rel="noopener noreferrer">$1</a>');

    // Handle unordered lists
    text = text.replace(/^[-*]\s+(.+)$/gm, '<li style="margin-left: 24px; margin-bottom: 4px; list-style-type: disc;">$1</li>');
    
    // Handle numbered lists
    text = text.replace(/^\d+\.\s+(.+)$/gm, '<li style="margin-left: 24px; margin-bottom: 4px; list-style-type: decimal;">$1</li>');
    
    // Wrap consecutive list items
    text = text.replace(/(<li style="margin-left: 24px; margin-bottom: 4px; list-style-type: disc;">[\s\S]*?<\/li>(?:\n<li style="margin-left: 24px; margin-bottom: 4px; list-style-type: disc;">[\s\S]*?<\/li>)*)/g, '<ul style="margin: 8px 0; list-style-type: disc;">$1</ul>');
    text = text.replace(/(<li style="margin-left: 24px; margin-bottom: 4px; list-style-type: decimal;">[\s\S]*?<\/li>(?:\n<li style="margin-left: 24px; margin-bottom: 4px; list-style-type: decimal;">[\s\S]*?<\/li>)*)/g, '<ol style="margin: 8px 0; list-style-type: decimal;">$1</ol>');

    // Handle blockquotes
    text = text.replace(/^>\s+(.+)$/gm, '<blockquote style="border-left: 4px solid #d1d5db; padding-left: 16px; margin: 8px 0; font-style: italic; color: #6b7280;">$1</blockquote>');

    // Handle line breaks (double newline = paragraph break)
    text = text.replace(/\n\n/g, '</p><p style="margin-bottom: 12px;">');
    text = text.replace(/\n/g, '<br>');
    
    // Wrap in paragraph tags
    text = `<p style="margin-bottom: 12px;">${text}</p>`;

    // Clean up empty paragraphs
    text = text.replace(/<p style="margin-bottom: 12px;"><\/p>/g, '');

    return text;
  };

  return (
    <div 
      className="markdown-content"
      dangerouslySetInnerHTML={{ 
        __html: parseMarkdown(text) 
      }} 
    />
  );
}

// API helper functions
async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw { response: { data } };
  }

  return data;
}

function Chat() {
  const [token, setToken] = useState(null);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [msg, setMsg] = useState("");
  const [log, setLog] = useState([]);
  const [location, setLocation] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const chatEndRef = useRef(null);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  async function login() {
    if (!email || !pw) {
      setError("Please fill in all fields");
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      const data = await apiRequest("/login", {
        method: "POST",
        body: JSON.stringify({ email, password: pw })
      });
      setToken(data.access_token);
      setLog([{text: "Welcome back! You're now logged in.", type: 'kyra'}]);
    } catch (error) {
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
      await apiRequest("/register", {
        method: "POST",
        body: JSON.stringify({ email, password: pw })
      });
      setError("");
      setLog([{text: "Account created successfully! Please log in.", type: 'kyra'}]);
      setIsSignUp(false);
      setPw("");
      setConfirmPw("");
    } catch (error) {
      setError(error.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  async function send() {
    if (!token || !msg.trim()) return;
    
    const userMessage = msg;
    setMsg("");
    setLoading(true);
    
    // Add user message immediately
    setLog((l) => [...l, {text: userMessage, type: 'user'}]);
    
    try {
      const data = await apiRequest("/chat", {
        method: "POST",
        body: JSON.stringify({ message: userMessage, location }),
        headers: { Authorization: `Bearer ${token}` }
      });
      setLog((l) => [...l, {text: data.response, type: 'kyra'}]);
    } catch (error) {
      setLog((l) => [...l, {text: error.response?.data?.message || "Failed to send message", type: 'error'}]);
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

  const styles = {
    container: {
      minHeight: '100vh',
      backgroundColor: '#f3f4f6',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    },
    card: {
      width: '100%',
      maxWidth: '672px',
      backgroundColor: 'white',
      borderRadius: '16px',
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      overflow: 'hidden'
    },
    loginContainer: {
      padding: '32px'
    },
    title: {
      fontSize: '30px',
      fontWeight: 'bold',
      color: '#111827',
      marginBottom: '8px',
      textAlign: 'center'
    },
    subtitle: {
      color: '#6b7280',
      textAlign: 'center',
      marginBottom: '24px'
    },
    errorBox: {
      backgroundColor: '#fef2f2',
      border: '1px solid #fecaca',
      color: '#dc2626',
      padding: '12px 16px',
      borderRadius: '8px',
      fontSize: '14px',
      marginBottom: '16px'
    },
    input: {
      width: '100%',
      border: '1px solid #d1d5db',
      borderRadius: '8px',
      padding: '12px 16px',
      fontSize: '16px',
      marginBottom: '16px',
      outline: 'none',
      transition: 'all 0.2s'
    },
    button: {
      width: '100%',
      backgroundColor: '#2563eb',
      color: 'white',
      fontWeight: '500',
      padding: '12px 16px',
      borderRadius: '8px',
      border: 'none',
      cursor: 'pointer',
      fontSize: '16px',
      transition: 'all 0.2s',
      marginBottom: '16px'
    },
    link: {
      color: '#2563eb',
      fontSize: '14px',
      fontWeight: '500',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      textAlign: 'center',
      display: 'block',
      width: '100%'
    },
    chatContainer: {
      display: 'flex',
      flexDirection: 'column',
      height: '600px'
    },
    header: {
      backgroundColor: 'white',
      borderBottom: '1px solid #e5e7eb',
      padding: '16px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    headerLeft: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    },
    avatar: {
      width: '40px',
      height: '40px',
      background: 'linear-gradient(to bottom right, #3b82f6, #2563eb)',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      fontWeight: 'bold',
      fontSize: '18px'
    },
    smallAvatar: {
      width: '28px',
      height: '28px',
      fontSize: '12px'
    },
    chatArea: {
      flex: 1,
      overflowY: 'auto',
      backgroundColor: '#f9fafb',
      padding: '16px 24px'
    },
    messageContainer: {
      marginBottom: '16px',
      display: 'flex',
      animation: 'fadeIn 0.3s ease-out'
    },
    messageContent: {
      maxWidth: '70%'
    },
    messageHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '4px'
    },
    messageBubble: {
      padding: '10px 16px',
      borderRadius: '16px',
      fontSize: '14px',
      lineHeight: '1.5'
    },
    userMessage: {
      backgroundColor: '#2563eb',
      color: 'white',
      marginLeft: 'auto',
      borderBottomRightRadius: '4px'
    },
    kyraMessage: {
      backgroundColor: 'white',
      color: '#1f2937',
      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      border: '1px solid #f3f4f6',
      borderBottomLeftRadius: '4px'
    },
    errorMessage: {
      backgroundColor: '#fef2f2',
      color: '#dc2626',
      border: '1px solid #fecaca',
      borderBottomLeftRadius: '4px'
    },
    emptyState: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      textAlign: 'center'
    },
    inputArea: {
      borderTop: '1px solid #e5e7eb',
      backgroundColor: 'white',
      padding: '16px 24px'
    },
    inputRow: {
      display: 'flex',
      gap: '12px'
    },
    messageInput: {
      flex: 1,
      border: '1px solid #d1d5db',
      borderRadius: '24px',
      padding: '10px 20px',
      fontSize: '14px',
      outline: 'none'
    },
    sendButton: {
      backgroundColor: '#2563eb',
      color: 'white',
      padding: '10px',
      borderRadius: '50%',
      border: 'none',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '40px',
      height: '40px',
      transition: 'all 0.2s'
    },
    loadingDots: {
      display: 'flex',
      gap: '8px'
    },
    dot: {
      width: '8px',
      height: '8px',
      backgroundColor: '#9ca3af',
      borderRadius: '50%',
      animation: 'bounce 1.4s infinite'
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {!token ? (
          <div style={styles.loginContainer}>
            <h1 style={styles.title}>Kyra Health Assistant</h1>
            <p style={styles.subtitle}>
              {isSignUp ? "Create your account to get started" : "Sign in to continue"}
            </p>

            {error && (
              <div style={styles.errorBox}>
                {error}
              </div>
            )}

            <div>
              <input 
                style={styles.input}
                placeholder="Email address" 
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
              <input 
                style={styles.input}
                type="password" 
                placeholder="Password"
                value={pw} 
                onChange={(e) => setPw(e.target.value)}
                disabled={loading}
              />
              {isSignUp && (
                <input 
                  style={styles.input}
                  type="password" 
                  placeholder="Confirm Password"
                  value={confirmPw} 
                  onChange={(e) => setConfirmPw(e.target.value)}
                  disabled={loading}
                />
              )}
              <button 
                style={{...styles.button, opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer'}}
                onClick={isSignUp ? signUp : login}
                disabled={loading}
              >
                {loading ? "Processing..." : (isSignUp ? "Create Account" : "Sign In")}
              </button>
            </div>

            <button 
              style={styles.link}
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError("");
                setPw("");
                setConfirmPw("");
              }}
              disabled={loading}
            >
              {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Create one"}
            </button>
          </div>
        ) : (
          <div style={styles.chatContainer}>
            <div style={styles.header}>
              <div style={styles.headerLeft}>
                <div style={styles.avatar}>K</div>
                <div>
                  <h1 style={{fontSize: '18px', fontWeight: '600', color: '#111827', margin: 0}}>Kyra</h1>
                  <p style={{fontSize: '12px', color: '#6b7280', margin: 0}}>Health Assistant</p>
                </div>
              </div>
              <button 
                style={{
                  color: '#6b7280',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  background: 'transparent',
                  fontSize: '14px'
                }}
                onClick={logout}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                Logout
              </button>
            </div>

            <div style={styles.chatArea}>
              {log.length === 0 ? (
                <div style={styles.emptyState}>
                  <div>
                    <div style={{
                      width: '64px',
                      height: '64px',
                      backgroundColor: '#e5e7eb',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px'
                    }}>
                      <svg style={{width: '32px', height: '32px', color: '#9ca3af'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                    </div>
                    <p style={{color: '#6b7280', marginBottom: '8px'}}>Welcome! Ask me any health-related questions.</p>
                    <p style={{color: '#9ca3af', fontSize: '14px'}}>I'm here to help with medical information and guidance.</p>
                  </div>
                </div>
              ) : (
                <div>
                  {log.map((entry, i) => (
                    <div key={i} style={{
                      ...styles.messageContainer,
                      justifyContent: entry.type === 'user' ? 'flex-end' : 'flex-start'
                    }}>
                      <div style={styles.messageContent}>
                        {entry.type !== 'user' && (
                          <div style={styles.messageHeader}>
                            <div style={{...styles.avatar, ...styles.smallAvatar}}>K</div>
                            <span style={{fontSize: '12px', color: '#6b7280', fontWeight: '500'}}>
                              {entry.type === 'error' ? 'Error' : 'Kyra'}
                            </span>
                          </div>
                        )}
                        <div style={{
                          ...styles.messageBubble,
                          ...(entry.type === 'user' ? styles.userMessage : 
                              entry.type === 'kyra' ? styles.kyraMessage : 
                              styles.errorMessage)
                        }}>
                          {entry.type === 'kyra' ? (
                            <MarkdownText text={entry.text} />
                          ) : (
                            <p style={{margin: 0}}>{entry.text}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div style={{...styles.messageContainer, justifyContent: 'flex-start'}}>
                      <div style={styles.messageContent}>
                        <div style={styles.messageHeader}>
                          <div style={{...styles.avatar, ...styles.smallAvatar}}>K</div>
                          <span style={{fontSize: '12px', color: '#6b7280', fontWeight: '500'}}>Kyra</span>
                        </div>
                        <div style={{...styles.messageBubble, ...styles.kyraMessage}}>
                          <div style={styles.loadingDots}>
                            <div style={{...styles.dot, animationDelay: '0ms'}}></div>
                            <div style={{...styles.dot, animationDelay: '150ms'}}></div>
                            <div style={{...styles.dot, animationDelay: '300ms'}}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              )}
            </div>

            <div style={styles.inputArea}>
              <div style={styles.inputRow}>
                <input 
                  style={styles.messageInput}
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !loading && send()}
                  placeholder="Type your health question..."
                  disabled={loading}
                />
                <button 
                  style={{
                    ...styles.sendButton,
                    backgroundColor: loading || !msg.trim() ? '#d1d5db' : '#2563eb',
                    cursor: loading || !msg.trim() ? 'not-allowed' : 'pointer'
                  }}
                  onClick={send}
                  disabled={loading || !msg.trim()}
                >
                  <svg style={{width: '20px', height: '20px'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes bounce {
    0%, 60%, 100% {
      transform: translateY(0);
    }
    30% {
      transform: translateY(-10px);
    }
  }
  
  .markdown-content p:last-child {
    margin-bottom: 0;
  }
  
  input:focus {
    border-color: #3b82f6 !important;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
  
  button:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }
  
  button:active:not(:disabled) {
    transform: translateY(0);
  }
`;
document.head.appendChild(style);

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(<Chat />);
}