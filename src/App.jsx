import { useState, useEffect } from 'react'
import './App.css'
import OAuthLogin from './components/OAuthLogin'
import CollectionSelector from './components/CollectionSelector'
import CoverGrid from './components/CoverGrid'
import { getCollections, getItemsInCollection, getItemsByTag, getItemChildren } from './services/zotero'
import { exchangeOAuthToken, getStoredAuth, storeAuth, clearAuth, isAuthenticated } from './services/oauth'

function App() {
  const [authenticated, setAuthenticated] = useState(false)
  const [userId, setUserId] = useState(null)
  const [apiKey, setApiKey] = useState(null)
  const [username, setUsername] = useState(null)
  const [collections, setCollections] = useState([])
  const [selectedCollection, setSelectedCollection] = useState(null)
  const [selectedTag, setSelectedTag] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [viewMode, setViewMode] = useState('selection') // 'selection', 'grid', or 'info'
  const [showSettings, setShowSettings] = useState(false)
  const [linkType, setLinkType] = useState(() => {
    // Load saved link type preference
    return localStorage.getItem('link_type') || 'app'
  })

  useEffect(() => {
    // Check for OAuth callback
    const urlParams = new URLSearchParams(window.location.search)
    const oauthToken = urlParams.get('oauth_token')
    const oauthVerifier = urlParams.get('oauth_verifier')

    if (oauthToken && oauthVerifier) {
      handleOAuthCallback(oauthToken, oauthVerifier)
    } else {
      // Check if already authenticated
      if (isAuthenticated()) {
        const auth = getStoredAuth()
        setUserId(auth.userId)
        setApiKey(auth.accessToken)
        setUsername(auth.username)
        setAuthenticated(true)
        loadCollections(auth.userId, auth.accessToken)
      }
    }
  }, [])

  const handleOAuthCallback = async (oauthToken, oauthVerifier) => {
    try {
      setLoading(true)
      setError(null)

      // Get stored token secret
      const oauthTokenSecret = localStorage.getItem('oauth_token_secret')
      if (!oauthTokenSecret) {
        throw new Error('OAuth session expired. Please try again.')
      }

      // Exchange tokens for access token
      const { accessToken, accessTokenSecret, userId, username } = await exchangeOAuthToken(
        oauthToken,
        oauthVerifier,
        oauthTokenSecret
      )

      // Store auth data
      storeAuth(accessToken, userId, username)

      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname)

      // Update state
      setUserId(userId)
      setApiKey(accessToken)
      setUsername(username)
      setAuthenticated(true)

      // Load collections
      await loadCollections(userId, accessToken)

    } catch (err) {
      setError('Authentication failed: ' + err.message)
      clearAuth()
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    clearAuth()
    setAuthenticated(false)
    setUserId(null)
    setApiKey(null)
    setUsername(null)
    setCollections([])
    setSelectedCollection(null)
    setItems([])
  }

  const loadCollections = async (uid, key) => {
    try {
      setLoading(true)
      setError(null)
      const collections = await getCollections(uid || userId, key || apiKey)
      setCollections(collections)

      // Restore previously selected collection
      const savedCollectionKey = localStorage.getItem('selected_collection_key')
      if (savedCollectionKey) {
        const savedCollection = collections.find(c => c.key === savedCollectionKey)
        if (savedCollection) {
          setSelectedCollection(savedCollection)
          // Load items for this collection and switch to grid view
          await loadItems(savedCollection.key)
          setViewMode('grid')
        }
      }
    } catch (err) {
      setError('Failed to load collections: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadItems = async (collectionKey, tag = '') => {
    try {
      setLoading(true)
      setError(null)

      let topLevelItems
      if (tag) {
        topLevelItems = await getItemsByTag(userId, apiKey, tag, collectionKey)
      } else if (collectionKey) {
        topLevelItems = await getItemsInCollection(userId, apiKey, collectionKey)
      }

      // Filter for regular items (not attachments or notes)
      const regularItems = topLevelItems.filter(item =>
        item.data.itemType !== 'attachment' && item.data.itemType !== 'note'
      )

      // For each item, fetch its children and find PDF/EPUB attachments
      const itemsWithAttachments = []
      for (const item of regularItems) {
        try {
          const children = await getItemChildren(userId, apiKey, item.key)
          const pdfEpubAttachments = children.filter(child =>
            child.data.itemType === 'attachment' &&
            (child.data.contentType === 'application/pdf' ||
             child.data.contentType === 'application/epub+zip')
          )

          // If this item has PDF/EPUB attachments, add it with the first attachment
          if (pdfEpubAttachments.length > 0) {
            itemsWithAttachments.push({
              ...item,
              attachment: pdfEpubAttachments[0], // Use first PDF/EPUB found
              allAttachments: pdfEpubAttachments // Store all for potential future use
            })
          }
        } catch (err) {
          console.error(`Error fetching children for item ${item.key}:`, err)
        }
      }

      setItems(itemsWithAttachments)
    } catch (err) {
      setError('Failed to load items: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCollectionSelect = (collection) => {
    setSelectedCollection(collection)
    setSelectedTag('')

    // Save to localStorage
    if (collection) {
      localStorage.setItem('selected_collection_key', collection.key)
    } else {
      localStorage.removeItem('selected_collection_key')
    }
  }

  const handleTagSelect = (tag) => {
    setSelectedTag(tag)
  }

  const handleLinkTypeChange = (type) => {
    setLinkType(type)
    localStorage.setItem('link_type', type)
  }

  const handleViewCollection = async () => {
    if (!selectedCollection) {
      setError('Please select a collection first')
      return
    }

    // Load items and switch to grid view
    await loadItems(selectedCollection.key, selectedTag)
    setViewMode('grid')
    setShowSettings(false)
  }

  const handleBackToSelection = () => {
    setViewMode('selection')
    setShowSettings(false)
  }

  const handleApplySettings = async () => {
    if (!selectedCollection) {
      setError('Please select a collection first')
      return
    }

    // Close modal immediately for better UX
    setShowSettings(false)

    // Save to localStorage
    localStorage.setItem('selected_collection_key', selectedCollection.key)

    // Reload items with new selection
    await loadItems(selectedCollection.key, selectedTag)
  }

  if (!authenticated) {
    return (
      <div className="app">
        <div className="app-header">
          <h1>ZotShelf</h1>
          <p>Your Zotero library, beautifully displayed</p>
        </div>
        {error && <div className="error-message">{error}</div>}
        {loading ? (
          <div className="loading">Authenticating</div>
        ) : (
          <OAuthLogin />
        )}
      </div>
    )
  }

  // Selection view - choose collection and tag
  if (viewMode === 'selection') {
    return (
      <div className="app">
        <div className="app-header">
          <h1>ZotShelf</h1>
          <p>Your Zotero library, beautifully displayed</p>
        </div>
        <div className="container">
          {error && <div className="error-message">{error}</div>}

          <CollectionSelector
            collections={collections}
            selectedCollection={selectedCollection}
            onCollectionSelect={handleCollectionSelect}
            onTagSelect={handleTagSelect}
            selectedTag={selectedTag}
            onLogout={handleLogout}
            username={username}
          />

          <div className="link-type-section">
            <h3>Do you have Zotero installed?</h3>
            <p>Choose how you want to open your books:</p>
            <div className="link-type-options">
              <button
                className={`link-type-option ${linkType === 'app' ? 'active' : ''}`}
                onClick={() => handleLinkTypeChange('app')}
              >
                <div className="option-icon">💻</div>
                <div className="option-content">
                  <strong>Desktop App</strong>
                  <span>I have Zotero installed on this computer</span>
                </div>
              </button>
              <button
                className={`link-type-option ${linkType === 'web' ? 'active' : ''}`}
                onClick={() => handleLinkTypeChange('web')}
              >
                <div className="option-icon">🌐</div>
                <div className="option-content">
                  <strong>Web Library</strong>
                  <span>I'm on a mobile device or don't have the app</span>
                </div>
              </button>
            </div>
          </div>

          <div className="action-buttons">
            <button
              onClick={handleViewCollection}
              disabled={!selectedCollection || loading}
              className="view-collection-button"
            >
              {loading ? 'Loading...' : 'View Collection'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Info/About page
  if (viewMode === 'info') {
    return (
      <div className="app">
        <div className="app-header">
          <h1>ZotShelf</h1>
          <p>Your Zotero library, beautifully displayed</p>
        </div>
        <div className="info-page">
          <div className="info-content">
            <button onClick={() => setViewMode('grid')} className="back-button">
              ← Back to Grid
            </button>

            <h2>About ZotShelf</h2>
            <p>
              ZotShelf is a web application that provides a beautiful grid view of your Zotero library.
              It extracts cover images from PDF and EPUB files in your collections and displays them
              in an easy-to-browse format.
            </p>

            <h3>Features</h3>
            <ul>
              <li>OAuth authentication with Zotero</li>
              <li>Browse collections with hierarchical tree view</li>
              <li>Filter items by tags</li>
              <li>Automatic cover extraction from PDF and EPUB files</li>
              <li>Customizable display formats (Author-Title, Author Only, Title Only)</li>
              <li>Toggle between Zotero app links and web library links</li>
              <li>Persistent collection selection</li>
            </ul>

            <h3>How to Use</h3>
            <ol>
              <li>Log in with your Zotero account</li>
              <li>Select a collection and optionally filter by tag</li>
              <li>Click "View Collection" to see your book covers</li>
              <li>Click any cover to open it in Zotero (app or web, based on your settings)</li>
              <li>Use the Settings button to change collections or preferences</li>
            </ol>

            <h3>Link Types</h3>
            <p>
              <strong>Zotero App:</strong> Opens PDFs directly in the Zotero desktop application's built-in reader.
            </p>
            <p>
              <strong>Web Library:</strong> Opens the item in your Zotero web library where you can view details and access files.
            </p>

            <h3>Technology</h3>
            <p>
              Built with React and Vite, deployed on Netlify. Uses Zotero Web API v3,
              PDF.js for PDF rendering, and JSZip for EPUB processing.
            </p>

            <div className="info-footer">
              <button onClick={() => setViewMode('grid')} className="primary-button">
                Return to Grid View
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Grid view - display covers with settings option
  return (
    <div className="app grid-view">
      {/* Top bar with settings */}
      <div className="grid-view-header">
        <div className="header-left">
          <h1>ZotShelf</h1>
          {selectedCollection && (
            <span className="current-collection">
              {selectedCollection.data.name}
              {selectedTag && ` • ${selectedTag}`}
            </span>
          )}
        </div>
        <div className="header-right">
          <button onClick={() => setViewMode('info')} className="info-button">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
            Info
          </button>
          <button onClick={() => setShowSettings(!showSettings)} className="settings-button">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M17.43 10.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C12.46 2.18 12.25 2 12 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM10 13c-1.65 0-3-1.35-3-3s1.35-3 3-3 3 1.35 3 3-1.35 3-3 3z"/>
            </svg>
            Settings
          </button>
          <button onClick={handleLogout} className="logout-button-small">
            Logout
          </button>
        </div>
      </div>

      {/* Settings panel (slides in from top or modal) */}
      {showSettings && (
        <div className="settings-panel">
          <div className="settings-content">
            <div className="settings-header">
              <h3>Change Collection or Tag</h3>
              <button onClick={() => setShowSettings(false)} className="close-button">×</button>
            </div>
            <CollectionSelector
              collections={collections}
              selectedCollection={selectedCollection}
              onCollectionSelect={handleCollectionSelect}
              onTagSelect={handleTagSelect}
              selectedTag={selectedTag}
              compact={true}
            />

            <div className="link-type-toggle">
              <label>
                <span>Link Type:</span>
                <div className="toggle-group">
                  <button
                    className={linkType === 'app' ? 'active' : ''}
                    onClick={() => handleLinkTypeChange('app')}
                  >
                    Zotero App
                  </button>
                  <button
                    className={linkType === 'web' ? 'active' : ''}
                    onClick={() => handleLinkTypeChange('web')}
                  >
                    Web Library
                  </button>
                </div>
              </label>
            </div>

            <div className="settings-actions">
              <button onClick={handleApplySettings} className="apply-button">
                Apply Changes
              </button>
              <button onClick={() => setShowSettings(false)} className="cancel-button">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cover grid */}
      <div className="grid-container-full">
        {error && <div className="error-message">{error}</div>}

        {loading && <div className="loading">Loading</div>}

        {!loading && items.length > 0 && (
          <CoverGrid items={items} userId={userId} apiKey={apiKey} username={username} linkType={linkType} />
        )}

        {!loading && items.length === 0 && (
          <div className="empty-state">
            <p>No items with PDF or EPUB attachments found in this collection</p>
            <button onClick={() => setShowSettings(true)} className="change-collection-button">
              Choose Different Collection
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
