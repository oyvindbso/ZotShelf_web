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
          // Load items for this collection
          loadItems(savedCollection.key)
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
      loadItems(collection.key)
    } else {
      localStorage.removeItem('selected_collection_key')
    }
  }

  const handleTagSelect = (tag) => {
    setSelectedTag(tag)
    if (selectedCollection) {
      loadItems(selectedCollection.key, tag)
    }
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

        {loading && <div className="loading">Loading</div>}

        {!loading && items.length > 0 && (
          <CoverGrid items={items} userId={userId} apiKey={apiKey} />
        )}

        {!loading && items.length === 0 && selectedCollection && (
          <div className="loading">No items with PDF or EPUB attachments found in this collection</div>
        )}
      </div>
    </div>
  )
}

export default App
