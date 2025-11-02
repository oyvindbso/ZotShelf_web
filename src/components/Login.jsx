import { useState } from 'react'
import './Login.css'

function Login({ onLogin }) {
  const [apiKey, setApiKey] = useState('')
  const [userId, setUserId] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')

    if (!apiKey.trim() || !userId.trim()) {
      setError('Please enter both User ID and API Key')
      return
    }

    onLogin(apiKey.trim(), userId.trim())
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>Connect to Zotero</h2>
        <p className="login-description">
          Enter your Zotero credentials to access your library. You can generate an API key from{' '}
          <a href="https://www.zotero.org/settings/keys" target="_blank" rel="noopener noreferrer">
            Zotero Settings
          </a>
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="userId">User ID</label>
            <input
              type="text"
              id="userId"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter your Zotero User ID"
              required
            />
            <small>Find your User ID in your Zotero account settings</small>
          </div>

          <div className="form-group">
            <label htmlFor="apiKey">API Key</label>
            <input
              type="password"
              id="apiKey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your Zotero API Key"
              required
            />
            <small>Create a new API key with read permissions for your library</small>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="login-button">
            Connect to Zotero
          </button>
        </form>

        <div className="help-section">
          <h3>How to get your credentials:</h3>
          <ol>
            <li>Visit <a href="https://www.zotero.org/settings/keys" target="_blank" rel="noopener noreferrer">zotero.org/settings/keys</a></li>
            <li>Click "Create new private key"</li>
            <li>Give it a name and enable "Allow library access"</li>
            <li>Your User ID is shown in the Feeds/API section</li>
          </ol>
        </div>
      </div>
    </div>
  )
}

export default Login
