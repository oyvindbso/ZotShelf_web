import { useState } from 'react'
import './Login.css'
import { initiateOAuth } from '../services/oauth'

function OAuthLogin({ onLoginStart }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    try {
      setLoading(true)
      setError('')

      // Initiate OAuth flow
      const { authUrl, oauthToken, oauthTokenSecret } = await initiateOAuth()

      // Store the token secret temporarily
      localStorage.setItem('oauth_token_secret', oauthTokenSecret)

      // Notify parent component
      if (onLoginStart) {
        onLoginStart()
      }

      // Redirect to Zotero for authorization
      window.location.href = authUrl

    } catch (err) {
      setError('Failed to start login: ' + err.message)
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>Connect to Zotero</h2>
        <p className="login-description">
          Sign in with your Zotero account to access your library and view your collection as a beautiful grid of covers.
        </p>

        {error && <div className="error-message">{error}</div>}

        <button
          onClick={handleLogin}
          className="login-button"
          disabled={loading}
        >
          {loading ? 'Connecting...' : 'Sign in with Zotero'}
        </button>

        <div className="help-section">
          <h3>About this app:</h3>
          <ul>
            <li>View your Zotero collections as a grid of book covers</li>
            <li>Covers are automatically extracted from PDFs and EPUBs</li>
            <li>Click covers to open items in your Zotero desktop app</li>
            <li>Filter by collection and tags</li>
          </ul>

          <h3>Privacy & Security:</h3>
          <ul>
            <li>We only request read access to your library</li>
            <li>Your credentials are never stored on our servers</li>
            <li>Authentication is handled directly by Zotero</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default OAuthLogin
