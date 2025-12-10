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

  // Tabs state - each tab represents a collection view
  const [tabs, setTabs] = useState(() => {
    // Load saved tabs from localStorage
    const savedTabs = localStorage.getItem('zotshelf_tabs')
    if (savedTabs) {
      const parsed = JSON.parse(savedTabs)
      // Load cached items if available
      return parsed.map(tab => {
        const cachedItems = localStorage.getItem(`zotshelf_items_${tab.id}`)
        return {
          ...tab,
          items: cachedItems ? JSON.parse(cachedItems) : [],
          loading: !cachedItems, // Only show loading if no cached items
          needsRefresh: false
        }
      })
    }
    return []
  })
  const [activeTabId, setActiveTabId] = useState(() => {
    return localStorage.getItem('zotshelf_active_tab') || null
  })

  // For settings modal - temporary selection before applying
  const [tempSelectedCollection, setTempSelectedCollection] = useState(null)
  const [tempSelectedTag, setTempSelectedTag] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [viewMode, setViewMode] = useState(() => {
    // If tabs exist, start in grid view; otherwise selection view
    const savedTabs = localStorage.getItem('zotshelf_tabs')
    return savedTabs && JSON.parse(savedTabs).length > 0 ? 'grid' : 'selection'
  })
  const [showSettings, setShowSettings] = useState(false)
  const [linkType, setLinkType] = useState(() => {
    // Load saved link type preference
    return localStorage.getItem('link_type') || 'app'
  })
  const [itemLimit, setItemLimit] = useState(() => {
    // Load saved item limit preference
    return parseInt(localStorage.getItem('item_limit') || '50')
  })
  const [darkMode, setDarkMode] = useState(() => {
    // Load saved dark mode preference
    return localStorage.getItem('dark_mode') === 'true'
  })

  useEffect(() => {
    // Apply dark mode class
    if (darkMode) {
      document.documentElement.classList.add('dark-mode')
    } else {
      document.documentElement.classList.remove('dark-mode')
    }
  }, [darkMode])

  // Persist tabs to localStorage whenever they change
  useEffect(() => {
    if (tabs.length > 0) {
      // Save tab metadata
      localStorage.setItem('zotshelf_tabs', JSON.stringify(tabs.map(tab => ({
        id: tab.id,
        collectionKey: tab.collectionKey,
        collectionName: tab.collectionName,
        tag: tab.tag
      }))))
      
      // Save items for each tab separately
      tabs.forEach(tab => {
        if (tab.items && tab.items.length > 0) {
          try {
            localStorage.setItem(`zotshelf_items_${tab.id}`, JSON.stringify(tab.items))
          } catch (err) {
            console.warn(`Failed to cache items for tab ${tab.id}:`, err)
            // If storage is full, try to clear old cached items
            clearOldTabCache(tab.id)
          }
        }
      })
    } else {
      localStorage.removeItem('zotshelf_tabs')
    }
  }, [tabs])

  // Persist active tab
  useEffect(() => {
    if (activeTabId) {
      localStorage.setItem('zotshelf_active_tab', activeTabId)
    } else {
      localStorage.removeItem('zotshelf_active_tab')
    }
  }, [activeTabId])

  // Clear cached items for closed tabs
  const clearOldTabCache = (keepTabId) => {
    const allKeys = Object.keys(localStorage)
    const itemCacheKeys = allKeys.filter(key => key.startsWith('zotshelf_items_'))
    const currentTabIds = tabs.map(t => t.id)
    
    itemCacheKeys.forEach(key => {
      const tabId = key.replace('zotshelf_items_', '')
      if (tabId !== keepTabId && !currentTabIds.includes(tabId)) {
        localStorage.removeItem(key)
        console.log(`Cleared old cache for tab: ${tabId}`)
      }
    })
  }

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
        
        // If we have cached tabs, only reload if they need refresh
        // Otherwise they'll load from cache automatically
        const needsReload = tabs.some(tab => tab.needsRefresh || (!tab.items || tab.items.length === 0))
        if (needsReload) {
          reloadAllTabs(auth.userId, auth.accessToken)
        }
      }
    }
  }, [])

  const reloadAllTabs = async (uid, key) => {
    // Reload items for all tabs that need it
    const updatedTabs = await Promise.all(tabs.map(async (tab) => {
      if (tab.needsRefresh || !tab.items || tab.items.length === 0) {
        try {
          const items = await loadItemsForTab(tab.collectionKey, tab.tag, uid, key)
          return { ...tab, items, loading: false, needsRefresh: false }
        } catch (err) {
          console.error(`Error reloading tab ${tab.id}:`, err)
          return { ...tab, loading: false }
        }
      }
      return tab
    }))
    setTabs(updatedTabs)
  }

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
    // Clear all cached data
    clearAuth()
    const allKeys = Object.keys(localStorage)
    allKeys.forEach(key => {
      if (key.startsWith('zotshelf_items_')) {
        localStorage.removeItem(key)
      }
    })
    
    setAuthenticated(false)
    setUserId(null)
    setApiKey(null)
    setUsername(null)
    setCollections([])
    setTabs([])
    setActiveTabId(null)
  }

  const loadCollections = async (uid, key) => {
    try {
      setLoading(true)
      setError(null)
      const collections = await getCollections(uid || userId, key || apiKey)
      setCollections(collections)

      // Tabs with cached data will already be displayed
      // No need to reload them here unless they're missing data
    } catch (err) {
      setError('Failed to load collections: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // Helper function to load items for a tab (doesn't set state)
  const loadItemsForTab = async (collectionKey, tag = '', uid = null, key = null) => {
    try {
      let topLevelItems
      if (tag) {
        topLevelItems = await getItemsByTag(uid || userId, key || apiKey, tag, collectionKey)
      } else if (collectionKey) {
        topLevelItems = await getItemsInCollection(uid || userId, key || apiKey, collectionKey)
      }

      // Filter for regular items (not attachments or notes)
      const regularItems = topLevelItems.filter(item =>
        item.data.itemType !== 'attachment' && item.data.itemType !== 'note'
      )

      // Apply item limit (0 means no limit)
      const limitedItems = itemLimit > 0 ? regularItems.slice(0, itemLimit) : regularItems

      // For each item, fetch its children and find PDF/EPUB attachments
      const itemsWithAttachments = []
      for (const item of limitedItems) {
        try {
          const children = await getItemChildren(uid || userId, key || apiKey, item.key)
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

      return itemsWithAttachments
    } catch (err) {
      throw new Error('Failed to load items: ' + err.message)
    }
  }

  // Tab management functions
  const createNewTab = async (collection, tag = '') => {
    const newTab = {
      id: `tab-${Date.now()}`,
      collectionKey: collection.key,
      collectionName: collection.data.name,
      tag: tag,
      items: [],
      loading: true,
      needsRefresh: false
    }

    setTabs([...tabs, newTab])
    setActiveTabId(newTab.id)

    // Load items for the new tab
    try {
      const items = await loadItemsForTab(collection.key, tag)
      setTabs(prevTabs => prevTabs.map(t =>
        t.id === newTab.id ? { ...t, items, loading: false } : t
      ))
    } catch (err) {
      setError(err.message)
      setTabs(prevTabs => prevTabs.map(t =>
        t.id === newTab.id ? { ...t, loading: false } : t
      ))
    }
  }

  const switchTab = (tabId) => {
    setActiveTabId(tabId)
  }

  const closeTab = (tabId) => {
    const tabIndex = tabs.findIndex(t => t.id === tabId)
    const newTabs = tabs.filter(t => t.id !== tabId)
    setTabs(newTabs)
    
    // Clear cached items for this tab
    localStorage.removeItem(`zotshelf_items_${tabId}`)

    // If closing the active tab, switch to another tab
    if (tabId === activeTabId) {
      if (newTabs.length > 0) {
        // Switch to the tab before or after
        const newActiveTab = newTabs[Math.max(0, tabIndex - 1)]
        setActiveTabId(newActiveTab.id)
      } else {
        setActiveTabId(null)
        setViewMode('selection')
      }
    }
  }

  const updateActiveTab = async (collection, tag = '') => {
    if (!activeTabId) return

    // Update the active tab with new collection/tag
    setTabs(prevTabs => prevTabs.map(t =>
      t.id === activeTabId
        ? { ...t, collectionKey: collection.key, collectionName: collection.data.name, tag, loading: true }
        : t
    ))

    // Load items for updated tab
    try {
      const items = await loadItemsForTab(collection.key, tag)
      setTabs(prevTabs => prevTabs.map(t =>
        t.id === activeTabId ? { ...t, items, loading: false } : t
      ))
    } catch (err) {
      setError(err.message)
      setTabs(prevTabs => prevTabs.map(t =>
        t.id === activeTabId ? { ...t, loading: false } : t
      ))
    }
  }

  const refreshActiveTab = async () => {
    if (!activeTabId) return
    
    const activeTab = tabs.find(t => t.id === activeTabId)
    if (!activeTab) return

    // Set loading state
    setTabs(prevTabs => prevTabs.map(t =>
      t.id === activeTabId ? { ...t, loading: true } : t
    ))

    // Reload items
    try {
      const items = await loadItemsForTab(activeTab.collectionKey, activeTab.tag)
      setTabs(prevTabs => prevTabs.map(t =>
        t.id === activeTabId ? { ...t, items, loading: false, needsRefresh: false } : t
      ))
    } catch (err) {
      setError(err.message)
      setTabs(prevTabs => prevTabs.map(t =>
        t.id === activeTabId ? { ...t, loading: false } : t
      ))
    }
  }

  const handleCollectionSelect = (collection) => {
    setTempSelectedCollection(collection)
    setTempSelectedTag('')
  }

  const handleTagSelect = (tag) => {
    setTempSelectedTag(tag)
  }

  const handleLinkTypeChange = (type) => {
    setLinkType(type)
    localStorage.setItem('link_type', type)
  }

  const handleItemLimitChange = (limit) => {
    setItemLimit(limit)
    localStorage.setItem('item_limit', limit.toString())
  }

  const handleDarkModeToggle = () => {
    const newMode = !darkMode
    setDarkMode(newMode)
    localStorage.setItem('dark_mode', newMode.toString())
  }

  const handleOpenSettings = () => {
    // Initialize temp selection from active tab when opening settings
    if (activeTab) {
      const collection = collections.find(c => c.key === activeTab.collectionKey)
      setTempSelectedCollection(collection || null)
      setTempSelectedTag(activeTab.tag || '')
    }
    setShowSettings(true)
  }

  const handleViewCollection = async () => {
    if (!tempSelectedCollection) {
      setError('Please select a collection first')
      return
    }

    // Create first tab and switch to grid view
    await createNewTab(tempSelectedCollection, tempSelectedTag)
    setViewMode('grid')
  }

  const handleBackToSelection = () => {
    setViewMode('selection')
    setShowSettings(false)
  }

  const handleApplySettings = async (action = 'update') => {
    if (!tempSelectedCollection) {
      setError('Please select a collection first')
      return
    }

    // Close modal immediately for better UX
    setShowSettings(false)

    if (action === 'new-tab') {
      // Create new tab
      await createNewTab(tempSelectedCollection, tempSelectedTag)
    } else {
      // Update active tab
      await updateActiveTab(tempSelectedCollection, tempSelectedTag)
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
            selectedCollection={tempSelectedCollection}
            onCollectionSelect={handleCollectionSelect}
            onTagSelect={handleTagSelect}
            selectedTag={tempSelectedTag}
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
              disabled={!tempSelectedCollection || loading}
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
              <li>Persistent tabs and cached data for instant loading</li>
            </ul>

            <h3>How to Use</h3>
            <ol>
              <li>Log in with your Zotero account</li>
              <li>Select a collection and optionally filter by tag</li>
              <li>Click "View Collection" to see your book covers</li>
              <li>Click any cover to open it in Zotero (app or web, based on your settings)</li>
              <li>Use the Settings button to change collections or preferences</li>
              <li>Use the Refresh button to update data from Zotero</li>
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
  const activeTab = tabs.find(t => t.id === activeTabId)

  return (
    <div className="app grid-view">
      {/* Top bar with settings */}
      <div className="grid-view-header">
        <div className="header-left">
          <h1>ZotShelf</h1>
          {activeTab && (
            <span className="current-collection">
              {activeTab.collectionName}
              {activeTab.tag && ` • ${activeTab.tag}`}
            </span>
          )}
        </div>
        <div className="header-right">
          <button onClick={refreshActiveTab} className="refresh-button" title="Refresh from Zotero" disabled={!activeTab || activeTab.loading}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button onClick={handleDarkModeToggle} className="dark-mode-toggle" title={darkMode ? "Light mode" : "Dark mode"}>
            {darkMode ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 2c-1.05 0-2.05.16-3 .46 4.06 1.27 7 5.06 7 9.54 0 4.48-2.94 8.27-7 9.54.95.3 1.95.46 3 .46 5.52 0 10-4.48 10-10S14.52 2 9 2z"/>
              </svg>
            )}
          </button>
          <button onClick={() => setViewMode('info')} className="info-button">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
          </button>
          <button onClick={handleOpenSettings} className="settings-button">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M17.43 10.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C12.46 2.18 12.25 2 12 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM10 13c-1.65 0-3-1.35-3-3s1.35-3 3-3 3 1.35 3 3-1.35 3-3 3z"/>
            </svg>
          </button>
          <button onClick={handleLogout} className="logout-button-small">
            Logout
          </button>
        </div>
      </div>

      {/* Tabs bar */}
      {tabs.length > 0 && (
        <div className="tabs-bar">
          <div className="tabs-container">
            {tabs.map(tab => (
              <div
                key={tab.id}
                className={`tab ${tab.id === activeTabId ? 'active' : ''}`}
                onClick={() => switchTab(tab.id)}
              >
                <span className="tab-name">
                  {tab.collectionName}
                  {tab.tag && ` • ${tab.tag}`}
                </span>
                {tabs.length > 1 && (
                  <button
                    className="tab-close"
                    onClick={(e) => {
                      e.stopPropagation()
                      closeTab(tab.id)
                    }}
                    title="Close tab"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            className="new-tab-button"
            onClick={handleOpenSettings}
            title="Open new tab"
          >
            +
          </button>
        </div>
      )}

      {/* Settings panel (slides in from top or modal) */}
      {showSettings && (
        <div className="settings-panel">
          <div className="settings-content">
            <div className="settings-header">
              <h3>{activeTab ? 'Change Collection or Open New Tab' : 'Open Collection'}</h3>
              <button onClick={() => setShowSettings(false)} className="close-button">×</button>
            </div>
            <CollectionSelector
              collections={collections}
              selectedCollection={tempSelectedCollection}
              onCollectionSelect={handleCollectionSelect}
              onTagSelect={handleTagSelect}
              selectedTag={tempSelectedTag}
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

            <div className="item-limit-selector">
              <label>
                <span>Items to Load:</span>
                <select value={itemLimit} onChange={(e) => handleItemLimitChange(parseInt(e.target.value))}>
                  <option value="25">25 items</option>
                  <option value="50">50 items (default)</option>
                  <option value="100">100 items</option>
                  <option value="200">200 items</option>
                  <option value="0">All items</option>
                </select>
              </label>
              <p className="limit-description">
                Limiting items improves loading speed. Large collections may be slow with "All items".
              </p>
            </div>

            <div className="settings-actions">
              {activeTab && (
                <>
                  <button onClick={() => handleApplySettings('update')} className="apply-button">
                    Update This Tab
                  </button>
                  <button onClick={() => handleApplySettings('new-tab')} className="apply-button new-tab-action">
                    Open in New Tab
                  </button>
                </>
              )}
              {!activeTab && (
                <button onClick={() => handleApplySettings('new-tab')} className="apply-button">
                  Open Collection
                </button>
              )}
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

        {activeTab && activeTab.loading && <div className="loading">Loading</div>}

        {activeTab && !activeTab.loading && activeTab.items.length > 0 && (
          <CoverGrid items={activeTab.items} userId={userId} apiKey={apiKey} username={username} linkType={linkType} />
        )}

        {activeTab && !activeTab.loading && activeTab.items.length === 0 && (
          <div className="empty-state">
            <p>No items with PDF or EPUB attachments found in this collection</p>
            <button onClick={handleOpenSettings} className="change-collection-button">
              Choose Different Collection
            </button>
          </div>
        )}

        {!activeTab && (
          <div className="empty-state">
            <p>No tabs open</p>
            <button onClick={handleOpenSettings} className="change-collection-button">
              Open Collection
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
