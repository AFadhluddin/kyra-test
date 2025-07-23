import { useState } from 'react'
import { authApi } from '../api'

interface LoginProps {
  onAuth: (token: string) => void
}

function Login({ onAuth }: LoginProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Please fill in all fields")
      return
    }
    
    setLoading(true)
    setError("")
    
    try {
      const data = await authApi.login(email, password)
      onAuth(data.access_token)
    } catch (error: any) {
      setError(error.response?.data?.message || "Login failed")
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword) {
      setError("Please fill in all fields")
      return
    }
    
    if (password !== confirmPassword) {
      setError("Passwords don't match")
      return
    }
    
    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }
    
    setLoading(true)
    setError("")
    
    try {
      await authApi.register(email, password)
      setError("")
      alert("Account created successfully! Please log in.")
      setIsSignUp(false)
      setPassword("")
      setConfirmPassword("")
    } catch (error: any) {
      setError(error.response?.data?.message || "Registration failed")
    } finally {
      setLoading(false)
    }
  }

  const toggleMode = () => {
    setIsSignUp(!isSignUp)
    setError("")
    setPassword("")
    setConfirmPassword("")
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">Kyra Health Assistant</h1>
        <p className="login-subtitle">
          {isSignUp ? "Create your account to get started" : "Sign in to continue"}
        </p>

        {error && (
          <div className="error-box">
            {error}
          </div>
        )}

        <div className="login-form">
          <input 
            className="form-input"
            placeholder="Email address" 
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
          <input 
            className="form-input"
            type="password" 
            placeholder="Password"
            value={password} 
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
          {isSignUp && (
            <input 
              className="form-input"
              type="password" 
              placeholder="Confirm Password"
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
            />
          )}
          <button 
            className={`form-button ${loading ? 'loading' : ''}`}
            onClick={isSignUp ? handleSignUp : handleLogin}
            disabled={loading}
          >
            {loading ? "Processing..." : (isSignUp ? "Create Account" : "Sign In")}
          </button>
        </div>

        <button 
          className="toggle-button"
          onClick={toggleMode}
          disabled={loading}
        >
          {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Create one"}
        </button>
      </div>
    </div>
  )
}

export default Login