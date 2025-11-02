import { useState, useEffect } from 'react'
import './App.css'
import Login from './components/Login'
import CollectionSelector from './components/CollectionSelector'
import CoverGrid from './components/CoverGrid'
import { getCollections, getItemsInCollection, getItemsByTag } from './services/zotero'

function App() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('zotero_api_key') || '')
  const [userId, setUserId] = useState(localStorage.getItem('zotero_user_id') || '')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [collections, setCollections] = useState([])
  const [selectedCollection, setSelectedCollection] = useState(null)
  const [selectedTag, setSelectedTag] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (apiKey && userId) {
      setIsAuthenticated(true)
      loadCollections()
    }
  }, [])

  const handleLogin = (key, id) => {
    setApiKey(key)
    setUserId(id)
    localStorage.setItem('zotero_api_key', key)
    localStorage.setItem('zotero_user_id', id)
    setIsAuthenticated(true)
    loadCollections()
  }

  const handleLogout = () => {
    setApiKey('')
    setUserId('')
    localStorage.removeItem('zotero_api_key')
    localStorage.removeItem('zotero_user_id')
    setIsAuthenticated(false)
    setCollections([])
    setSelectedCollection(null)
    setItems([])
  }

  const loadCollections = async () => {
    try {
      setLoading(true)
      setError(null)
      const apiKey = localStorage.getItem('zotero_api_key')
      const userId = localStorage.getItem('zotero_user_id')
      const collections = await getCollections(userId, apiKey)
      setCollections(collections)
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
      const apiKey = localStorage.getItem('zotero_api_key')
      const userId = localStorage.getItem('zotero_user_id')

      let items
      if (tag) {
        items = await getItemsByTag(userId, apiKey, tag, collectionKey)
      } else if (collectionKey) {
        items = await getItemsInCollection(userId, apiKey, collectionKey)
      }

      // Filter for items that have attachments (PDFs or EPUBs)
      const itemsWithAttachments = items.filter(item => {
        return item.data.itemType === 'attachment' &&
               (item.data.contentType === 'application/pdf' ||
                item.data.contentType === 'application/epub+zip')
      })

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
    if (collection) {
      loadItems(collection.key)
    }
  }

  const handleTagSelect = (tag) => {
    setSelectedTag(tag)
    if (selectedCollection) {
      loadItems(selectedCollection.key, tag)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="app">
        <div className="app-header">
          <h1>ZotShelf</h1>
          <p>Your Zotero library, beautifully displayed</p>
        </div>
        <Login onLogin={handleLogin} />
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
        <CollectionSelector
          collections={collections}
          selectedCollection={selectedCollection}
          onCollectionSelect={handleCollectionSelect}
          onTagSelect={handleTagSelect}
          selectedTag={selectedTag}
          onLogout={handleLogout}
        />

        {error && <div className="error-message">{error}</div>}

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
