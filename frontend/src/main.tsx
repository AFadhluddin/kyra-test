import { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom/client";

const API_BASE_URL = "http://localhost:8000/api/v1";

// Enhanced markdown parser component
function MarkdownText({ text, onLinkClick }) {
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

    // Handle links (including sources) - convert to clickable buttons for modal
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, url) => {
      const linkId = `link_${Math.random().toString(36).substr(2, 9)}`;
      // Store the link handler in a global object
      window.linkHandlers = window.linkHandlers || {};
      window.linkHandlers[linkId] = () => onLinkClick && onLinkClick(url, linkText);
      
      return `<button onclick="window.linkHandlers['${linkId}']()" style="color: #3b82f6; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; background: none; border: none; cursor: pointer; padding: 0; font-size: inherit;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${linkText} <svg style="width: 12px; height: 12px; flex-shrink: 0;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg></button>`;
    });

    // Handle numbered lists (improved to handle sub-bullets)
    text = text.replace(/^(\d+)\.\s+\*\*(.*?)\*\*:\s*([\s\S]*?)(?=\n\d+\.|\n\n|$)/gm, (match, num, title, content) => {
      // Handle sub-bullets within numbered items
      const processedContent = content.replace(/^-\s+(.+)$/gm, '<li style="margin-left: 16px; margin-bottom: 2px; list-style-type: disc; font-size: 14px;">$1</li>');
      const hasSubBullets = processedContent.includes('<li');
      
      if (hasSubBullets) {
        const wrappedSubBullets = processedContent.replace(/(<li[^>]*>.*<\/li>)/gs, '<ul style="margin: 4px 0; padding-left: 0;">$1</ul>');
        return `<li style="margin-bottom: 12px; list-style-type: decimal;"><strong>${title}:</strong> ${wrappedSubBullets}</li>`;
      } else {
        return `<li style="margin-bottom: 12px; list-style-type: decimal;"><strong>${title}:</strong> ${content.trim()}</li>`;
      }
    });

    // Handle regular numbered lists
    text = text.replace(/^(\d+)\.\s+(.+)$/gm, '<li style="margin-bottom: 8px; list-style-type: decimal;">$2</li>');

    // Handle unordered lists  
    text = text.replace(/^[-*]\s+(.+)$/gm, '<li style="margin-bottom: 4px; list-style-type: disc;">$1</li>');
    
    // Wrap consecutive numbered list items
    text = text.replace(/(<li style="[^"]*list-style-type: decimal[^"]*">[^<]*<\/li>(?:\s*<li style="[^"]*list-style-type: decimal[^"]*">[^<]*<\/li>)*)/g, '<ol style="margin: 8px 0; padding-left: 24px;">$1</ol>');
    
    // Wrap consecutive unordered list items  
    text = text.replace(/(<li style="[^"]*list-style-type: disc[^"]*">[^<]*<\/li>(?:\s*<li style="[^"]*list-style-type: disc[^"]*">[^<]*<\/li>)*)/g, '<ul style="margin: 8px 0; padding-left: 24px;">$1</ul>');

    // Handle blockquotes
    text = text.replace(/^>\s+(.+)$/gm, '<blockquote style="border-left: 4px solid #d1d5db; padding-left: 16px; margin: 8px 0; font-style: italic; color: #6b7280;">$1</blockquote>');

    // Handle line breaks (double newline = paragraph break)
    text = text.replace(/\n\n/g, '</p><p style="margin-bottom: 12px;">');
    text = text.replace(/\n/g, '<br>');
    
    // Wrap in paragraph tags
    text = `<p style="margin-bottom: 12px;">${text}</p>`;

    // Clean up empty paragraphs
    text = text.replace(/<p style="margin-bottom: 12px;"><\/p>/g, '');
    
    // Clean up paragraph tags around lists
    text = text.replace(/<p style="margin-bottom: 12px;">(<[ou]l[^>]*>)/g, '$1');
    text = text.replace(/(<\/[ou]l>)<\/p>/g, '$1');

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

// Session list component
function SessionList({ sessions, currentSessionId, onSessionSelect, onNewSession, token, onSessionsReload }) {
  const [showSessions, setShowSessions] = useState(false);

  async function deleteSession(sessionId, event) {
    event.stopPropagation(); // Prevent session selection when clicking delete
    
    if (!confirm('Are you sure you want to delete this conversation? This cannot be undone.')) {
      return;
    }
    
    try {
      await apiRequest(`/chat/session/${sessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // If we deleted the current session, clear the current session
      if (currentSessionId === sessionId) {
        // Reset to empty state
        window.location.reload(); // Simple solution - refresh the page
      } else {
        // Just reload the sessions list
        onSessionsReload();
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
      alert('Failed to delete session. Please try again.');
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        style={{
          backgroundColor: 'transparent',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '8px 12px',
          cursor: 'pointer',
          color: '#6b7280',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
        onClick={() => setShowSessions(!showSessions)}
      >
        <svg style={{width: '16px', height: '16px'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        Sessions
      </button>
      
      {showSessions && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: '0',
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          minWidth: '280px',
          maxHeight: '400px',
          overflowY: 'auto',
          zIndex: 10,
          marginTop: '4px'
        }}>
          <div style={{ padding: '8px' }}>
            <button
              style={{
                width: '100%',
                backgroundColor: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 12px',
                cursor: 'pointer',
                fontSize: '14px',
                marginBottom: '8px'
              }}
              onClick={() => {
                onNewSession();
                setShowSessions(false);
              }}
            >
              + New Conversation
            </button>
            
            {sessions.length === 0 ? (
              <p style={{ padding: '16px', color: '#6b7280', fontSize: '14px', textAlign: 'center', margin: 0 }}>
                No previous conversations
              </p>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  style={{
                    padding: '12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    backgroundColor: currentSessionId === session.id ? '#eff6ff' : 'transparent',
                    borderLeft: currentSessionId === session.id ? '3px solid #2563eb' : '3px solid transparent',
                    marginBottom: '4px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '8px'
                  }}
                  onClick={() => {
                    onSessionSelect(session.id);
                    setShowSessions(false);
                  }}
                  onMouseEnter={(e) => {
                    if (currentSessionId !== session.id) {
                      e.currentTarget.style.backgroundColor = '#f9fafb';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentSessionId !== session.id) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', color: '#111827', marginBottom: '4px' }}>
                      {session.preview}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      {new Date(session.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      color: '#ef4444',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: '24px',
                      height: '24px'
                    }}
                    onClick={(e) => deleteSession(session.id, e)}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#fee2e2'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                    title="Delete conversation"
                  >
                    <svg style={{width: '14px', height: '14px'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
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
  const [loadingSession, setLoadingSession] = useState(false);
  const [error, setError] = useState("");
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [modalUrl, setModalUrl] = useState("");
  const [modalTitle, setModalTitle] = useState("");
  const chatEndRef = useRef(null);

  function openInModal(url, title) {
    // Extract a clean title from the URL if no title provided
    let cleanTitle = title;
    if (!cleanTitle || cleanTitle === url) {
      try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.replace('www.', '');
        const pathSegments = urlObj.pathname.split('/').filter(Boolean);
        
        if (hostname.includes('nhs.uk')) {
          cleanTitle = pathSegments.length > 0 ? 
            pathSegments[pathSegments.length - 1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 
            'NHS Information';
        } else if (hostname.includes('mayoclinic.org')) {
          cleanTitle = pathSegments.length > 0 ? 
            pathSegments[pathSegments.length - 1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 
            'Mayo Clinic Information';
        } else {
          cleanTitle = hostname;
        }
      } catch (e) {
        cleanTitle = 'Medical Information';
      }
    }
    
    setModalUrl(url);
    setModalTitle(cleanTitle);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setModalUrl("");
    setModalTitle("");
  }

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  // Load sessions when user logs in and load the most recent session
  useEffect(() => {
    if (token) {
      loadSessionsAndLatest();
    }
  }, [token]);

  async function loadSessionsAndLatest() {
    try {
      const data = await apiRequest("/chat/sessions", {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log(`[DEBUG] Loaded ${data.length} sessions`);
      setSessions(data);
      
      // Auto-load the most recent session if it exists
      if (data.length > 0 && !currentSessionId) {
        console.log(`[DEBUG] Auto-loading most recent session: ${data[0].id}`);
        await loadSessionMessages(data[0].id);
      }
    } catch (error) {
      console.error("Failed to load sessions:", error);
    }
  }

  async function loadSessionMessages(sessionId) {
    setLoadingSession(true);
    try {
      const messages = await apiRequest(`/chat/session/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Convert API messages to log format, including sources and metadata
      const convertedMessages = messages.map(msg => ({
        text: msg.content,
        type: msg.role === 'user' ? 'user' : 'kyra',
        id: msg.id,
        sources: msg.sources,
        metadata: msg.response_metadata  // Changed from metadata to response_metadata
      }));
      
      setLog(convertedMessages);
      setCurrentSessionId(sessionId);
    } catch (error) {
      console.error("Failed to load session messages:", error);
      setLog([{text: "Failed to load conversation history.", type: 'error'}]);
    } finally {
      setLoadingSession(false);
    }
  }

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
      // Don't show welcome message if we're going to load a session
      // setLog([{text: "Welcome back! You're now logged in.", type: 'kyra'}]);
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
    
    console.log(`[DEBUG] Sending message with session_id: ${currentSessionId}`);
    
    try {
      const data = await apiRequest("/chat", {
        method: "POST",
        body: JSON.stringify({ 
          message: userMessage, 
          location,
          session_id: currentSessionId  // This should be the existing session ID
        }),
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log(`[DEBUG] Response session_id: ${data.session_id}`);
      
      // Update current session ID if it was a new conversation
      if (!currentSessionId) {
        console.log(`[DEBUG] Setting new session_id: ${data.session_id}`);
        setCurrentSessionId(data.session_id);
        // Reload sessions to show the new one
        const sessionsData = await apiRequest("/chat/sessions", {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSessions(sessionsData);
      } else {
        console.log(`[DEBUG] Continuing existing session: ${currentSessionId}`);
        // Just reload sessions list to update previews
        const sessionsData = await apiRequest("/chat/sessions", {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSessions(sessionsData);
      }
      
      // Replace the entire log with the conversation history from the API
      // This ensures we have the complete conversation with proper IDs, sources, and metadata
      const convertedMessages = data.messages.map(msg => ({
        text: msg.content,
        type: msg.role === 'user' ? 'user' : 'kyra',
        id: msg.id,
        sources: msg.sources,
        metadata: msg.response_metadata  // Changed from metadata to response_metadata
      }));
      
      setLog(convertedMessages);
      
    } catch (error) {
      setLog((l) => [...l, {text: error.response?.data?.message || "Failed to send message", type: 'error'}]);
    } finally {
      setLoading(false);
    }
  }

  function startNewSession() {
    setCurrentSessionId(null);
    setLog([]);
  }

  function logout() {
    setToken(null);
    setLog([]);
    setEmail("");
    setPw("");
    setConfirmPw("");
    setError("");
    setCurrentSessionId(null);
    setSessions([]);
  }

  const styles = {
    container: {
      minHeight: '100vh',
      backgroundColor: '#f3f4f6',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '12px'  // Reduced padding from 16px to 12px for more space
    },
    card: {
      width: '100%',
      maxWidth: '900px',  // Increased from 672px to 900px for better use of screen space
      backgroundColor: 'white',
      borderRadius: '16px',
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      overflow: 'hidden',
      maxHeight: '95vh'  // Added max height to prevent overflow on small screens
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
      height: '85vh'  // Changed from '600px' to 85% of viewport height
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
    headerRight: {
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
                  <p style={{fontSize: '12px', color: '#6b7280', margin: 0}}>
                    {currentSessionId ? `Session #${currentSessionId}` : 'Health Assistant'}
                  </p>
                </div>
              </div>
              <div style={styles.headerRight}>
                <SessionList 
                  sessions={sessions}
                  currentSessionId={currentSessionId}
                  onSessionSelect={loadSessionMessages}
                  onNewSession={startNewSession}
                  token={token}
                  onSessionsReload={loadSessionsAndLatest}
                />
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
                >
                  Logout
                </button>
              </div>
            </div>

            <div style={styles.chatArea}>
              {loadingSession ? (
                <div style={styles.emptyState}>
                  <div>
                    <div style={styles.loadingDots}>
                      <div style={{...styles.dot, animationDelay: '0ms'}}></div>
                      <div style={{...styles.dot, animationDelay: '150ms'}}></div>
                      <div style={{...styles.dot, animationDelay: '300ms'}}></div>
                    </div>
                    <p style={{color: '#6b7280', marginTop: '16px'}}>Loading conversation...</p>
                  </div>
                </div>
              ) : log.length === 0 ? (
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
                    <div key={entry.id || i} style={{
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
                            <div>
                              <MarkdownText text={entry.text} onLinkClick={openInModal} />
                              {entry.sources && entry.sources.length > 0 && (
                                <div style={{
                                  marginTop: '12px',
                                  padding: '8px 12px',
                                  backgroundColor: '#f8fafc',
                                  borderRadius: '6px',
                                  borderLeft: '3px solid #3b82f6'
                                }}>
                                  <div style={{
                                    fontSize: '12px',
                                    fontWeight: '500',
                                    color: '#6b7280',
                                    marginBottom: '6px'
                                  }}>
                                    {entry.metadata?.used_rag ? 'NHS/Cancer Research Sources:' : 'General Medical Sources:'}
                                  </div>
                                  {entry.sources.map((source, idx) => {
                                    // Check if source is a URL or just text
                                    const isUrl = source.startsWith('http://') || source.startsWith('https://');
                                    
                                    if (isUrl) {
                                      // Extract domain for display text
                                      let displayText = source;
                                      try {
                                        const url = new URL(source);
                                        displayText = `${url.hostname}${url.pathname}`;
                                        // Truncate long paths
                                        if (displayText.length > 60) {
                                          displayText = displayText.substring(0, 57) + '...';
                                        }
                                      } catch (e) {
                                        // If URL parsing fails, use original source
                                        displayText = source;
                                      }
                                      
                                      return (
                                        <div key={idx} style={{ marginBottom: '4px' }}>
                                          <button
                                            onClick={() => openInModal(source, displayText)}
                                            style={{
                                              fontSize: '11px',
                                              color: '#3b82f6',
                                              textDecoration: 'none',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '4px',
                                              background: 'none',
                                              border: 'none',
                                              cursor: 'pointer',
                                              padding: '2px 0'
                                            }}
                                            onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
                                            onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
                                          >
                                            <svg style={{width: '10px', height: '10px', flexShrink: 0}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                            {displayText}
                                          </button>
                                        </div>
                                      );
                                    } else {
                                      // Non-URL source (like formatted text from GPT-4o)
                                      return (
                                        <div key={idx} style={{
                                          fontSize: '11px',
                                          color: '#374151',
                                          marginBottom: '4px',
                                          paddingLeft: '14px' // Align with URL sources
                                        }}>
                                          • {source}
                                        </div>
                                      );
                                    }
                                  })}
                                </div>
                              )}
                            </div>
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

      {/* Side-by-side modal for viewing sources */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          display: 'flex',
          alignItems: 'stretch',
          zIndex: 1000
        }}>
          {/* Chat side - compressed */}
          <div style={{
            width: '40%',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={styles.card}>
              <div style={styles.chatContainer}>
                <div style={styles.header}>
                  <div style={styles.headerLeft}>
                    <div style={styles.avatar}>K</div>
                    <div>
                      <h1 style={{fontSize: '16px', fontWeight: '600', color: '#111827', margin: 0}}>Kyra</h1>
                      <p style={{fontSize: '11px', color: '#6b7280', margin: 0}}>
                        {currentSessionId ? `Session #${currentSessionId}` : 'Health Assistant'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={closeModal}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '6px',
                      borderRadius: '6px',
                      color: '#6b7280'
                    }}
                  >
                    <svg style={{width: '16px', height: '16px'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                {/* Compressed chat area */}
                <div style={{...styles.chatArea, padding: '12px 16px'}}>
                  <div>
                    {log.slice(-3).map((entry, i) => ( // Show only last 3 messages
                      <div key={entry.id || i} style={{
                        ...styles.messageContainer,
                        justifyContent: entry.type === 'user' ? 'flex-end' : 'flex-start',
                        marginBottom: '12px'
                      }}>
                        <div style={{...styles.messageContent, maxWidth: '85%'}}>
                          {entry.type !== 'user' && (
                            <div style={styles.messageHeader}>
                              <div style={{...styles.avatar, ...styles.smallAvatar}}>K</div>
                              <span style={{fontSize: '11px', color: '#6b7280', fontWeight: '500'}}>Kyra</span>
                            </div>
                          )}
                          <div style={{
                            ...styles.messageBubble,
                            padding: '8px 12px',
                            fontSize: '13px',
                            ...(entry.type === 'user' ? styles.userMessage : styles.kyraMessage)
                          }}>
                            {entry.type === 'kyra' ? (
                              <MarkdownText text={entry.text.substring(0, 300) + (entry.text.length > 300 ? '...' : '')} onLinkClick={openInModal} />
                            ) : (
                              <p style={{margin: 0}}>{entry.text}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {log.length > 3 && (
                      <div style={{textAlign: 'center', fontSize: '12px', color: '#6b7280', marginBottom: '12px'}}>
                        ... and {log.length - 3} more messages
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Source content side */}
          <div style={{
            width: '60%',
            backgroundColor: 'white',
            display: 'flex',
            flexDirection: 'column',
            borderLeft: '1px solid #e5e7eb'
          }}>
            {/* Header with clean title */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid #e5e7eb',
              backgroundColor: '#f9fafb'
            }}>
              <div>
                <h3 style={{
                  margin: 0,
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#111827'
                }}>
                  {modalTitle}
                </h3>
                <p style={{
                  margin: '4px 0 0 0',
                  fontSize: '12px',
                  color: '#6b7280'
                }}>
                  {new URL(modalUrl).hostname}
                </p>
              </div>
              <button
                onClick={closeModal}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                <svg style={{width: '20px', height: '20px'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Content area with fallback */}
            <div style={{ flex: 1, position: 'relative', backgroundColor: '#f9fafb' }}>
              <iframe
                src={modalUrl}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  backgroundColor: 'white'
                }}
                title={modalTitle}
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation"
                onError={() => {
                  // Handle iframe loading errors
                  const iframe = document.querySelector('iframe[src="' + modalUrl + '"]');
                  if (iframe) {
                    iframe.style.display = 'none';
                    const errorDiv = document.createElement('div');
                    errorDiv.innerHTML = `
                      <div style="padding: 40px; text-align: center; color: #6b7280;">
                        <div style="font-size: 48px; margin-bottom: 16px;">🔒</div>
                        <h3 style="margin: 0 0 8px 0; color: #111827;">Content Blocked</h3>
                        <p style="margin: 0 0 20px 0;">This site prevents embedding for security reasons.</p>
                        <button onclick="window.open('${modalUrl}', '_blank')" style="background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
                          Open in New Tab
                        </button>
                      </div>
                    `;
                    iframe.parentNode.appendChild(errorDiv);
                  }
                }}
              />
              
              {/* Fallback content for sites that block embedding */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                color: '#6b7280',
                padding: '40px',
                display: 'none'
              }} id="fallback-content">
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
                <h3 style={{ margin: '0 0 8px 0', color: '#111827' }}>Content Blocked</h3>
                <p style={{ margin: '0 0 20px 0' }}>This site prevents embedding for security reasons.</p>
                <button
                  onClick={() => window.open(modalUrl, '_blank')}
                  style={{
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Open in New Tab
                </button>
              </div>
            </div>
            
            {/* Footer */}
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid #e5e7eb',
              backgroundColor: '#f9fafb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                Source: {modalUrl}
              </div>
              <button
                onClick={() => window.open(modalUrl, '_blank')}
                style={{
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <svg style={{width: '12px', height: '12px'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open in New Tab
              </button>
            </div>
          </div>
        </div>
      )}
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

export default Chat;