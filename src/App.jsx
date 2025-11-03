import { useState, useEffect } from 'react'
import './App.css'
import CollectionSelector from './components/CollectionSelector'
import CoverGrid from './components/CoverGrid'
import { getCollections, getItemsInCollection, getItemsByTag } from './services/zotero'

// Get credentials from environment variables
const ZOTERO_USER_ID = import.meta.env.VITE_ZOTERO_USER_ID
const ZOTERO_API_KEY = import.meta.env.VITE_ZOTERO_API_KEY

function App() {
  const [collections, setCollections] = useState([])
  const [selectedCollection, setSelectedCollection] = useState(null)
  const [selectedTag, setSelectedTag] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Check if credentials are configured
    if (!ZOTERO_USER_ID || !ZOTERO_API_KEY) {
      setError('Zotero credentials not configured. Please set VITE_ZOTERO_USER_ID and VITE_ZOTERO_API_KEY in your .env file.')
      return
    }
    loadCollections()
  }, [])

  const loadCollections = async () => {
    try {
      setLoading(true)
      setError(null)
      const collections = await getCollections(ZOTERO_USER_ID, ZOTERO_API_KEY)
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

      let items
      if (tag) {
        items = await getItemsByTag(ZOTERO_USER_ID, ZOTERO_API_KEY, tag, collectionKey)
      } else if (collectionKey) {
        items = await getItemsInCollection(ZOTERO_USER_ID, ZOTERO_API_KEY, collectionKey)
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

  return (
    <div className="app">
      <div className="app-header">
        <h1>ZotShelf</h1>
        <p>Your Zotero library, beautifully displayed</p>
      </div>
      <div className="container">
        {error && <div className="error-message">{error}</div>}

        {!error && (
          <>
            <CollectionSelector
              collections={collections}
              selectedCollection={selectedCollection}
              onCollectionSelect={handleCollectionSelect}
              onTagSelect={handleTagSelect}
              selectedTag={selectedTag}
            />

            {loading && <div className="loading">Loading</div>}

            {!loading && items.length > 0 && (
              <CoverGrid items={items} userId={ZOTERO_USER_ID} apiKey={ZOTERO_API_KEY} />
            )}

            {!loading && items.length === 0 && selectedCollection && (
              <div className="loading">No items with PDF or EPUB attachments found in this collection</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default App
