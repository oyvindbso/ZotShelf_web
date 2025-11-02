import { useState } from 'react'
import './CollectionSelector.css'

function CollectionSelector({
  collections,
  selectedCollection,
  onCollectionSelect,
  onTagSelect,
  selectedTag,
  onLogout
}) {
  const [tagInput, setTagInput] = useState('')

  const handleCollectionChange = (e) => {
    const collectionKey = e.target.value
    const collection = collections.find(c => c.key === collectionKey)
    onCollectionSelect(collection || null)
  }

  const handleTagSubmit = (e) => {
    e.preventDefault()
    if (tagInput.trim()) {
      onTagSelect(tagInput.trim())
    }
  }

  const handleClearTag = () => {
    setTagInput('')
    onTagSelect('')
  }

  return (
    <div className="selector-container">
      <div className="selector-header">
        <h2>Browse Your Library</h2>
        <button onClick={onLogout} className="logout-button">
          Logout
        </button>
      </div>

      <div className="selector-controls">
        <div className="control-group">
          <label htmlFor="collection-select">Collection</label>
          <select
            id="collection-select"
            value={selectedCollection?.key || ''}
            onChange={handleCollectionChange}
            className="collection-select"
          >
            <option value="">Select a collection...</option>
            {collections.map((collection) => (
              <option key={collection.key} value={collection.key}>
                {collection.data.name}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label htmlFor="tag-input">Filter by Tag (optional)</label>
          <form onSubmit={handleTagSubmit} className="tag-form">
            <input
              type="text"
              id="tag-input"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Enter a tag name..."
              className="tag-input"
              disabled={!selectedCollection}
            />
            <button
              type="submit"
              className="tag-button"
              disabled={!selectedCollection || !tagInput.trim()}
            >
              Filter
            </button>
            {selectedTag && (
              <button
                type="button"
                onClick={handleClearTag}
                className="clear-tag-button"
              >
                Clear
              </button>
            )}
          </form>
          {selectedTag && (
            <div className="active-tag">
              Active filter: <strong>{selectedTag}</strong>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CollectionSelector
