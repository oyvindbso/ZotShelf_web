import { useState, useEffect } from 'react'
import './CoverGrid.css'
import { extractCoverFromPDF, extractCoverFromEPUB } from '../utils/coverExtractor'

function CoverItem({ item, userId, apiKey, displayFormat, username, linkType }) {
  const [coverUrl, setCoverUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    loadCover()
  }, [item])

  const getCacheKey = () => {
    // Use attachment key and version for cache key
    return `cover_${item.attachment.key}_${item.attachment.version}`
  }

  const getCachedCover = () => {
    try {
      const cacheKey = getCacheKey()
      const cached = localStorage.getItem(cacheKey)
      return cached
    } catch (err) {
      console.error('Error reading from cache:', err)
      return null
    }
  }

  const setCachedCover = (coverData) => {
    try {
      const cacheKey = getCacheKey()
      localStorage.setItem(cacheKey, coverData)
    } catch (err) {
      // If localStorage is full, try to clear old covers
      console.error('Error writing to cache:', err)
      try {
        clearOldCovers()
        localStorage.setItem(getCacheKey(), coverData)
      } catch (retryErr) {
        console.error('Failed to cache cover after cleanup:', retryErr)
      }
    }
  }

  const clearOldCovers = () => {
    // Remove old cover cache entries (keep last 100)
    const coverKeys = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('cover_')) {
        coverKeys.push(key)
      }
    }
    // Remove oldest entries if we have more than 100
    if (coverKeys.length > 100) {
      coverKeys.slice(0, coverKeys.length - 100).forEach(key => {
        localStorage.removeItem(key)
      })
    }
  }

  const loadCover = async () => {
    try {
      setLoading(true)
      setError(false)

      // Check cache first
      const cached = getCachedCover()
      if (cached) {
        setCoverUrl(cached)
        setLoading(false)
        return
      }

      // Use the attachment for the cover
      const attachment = item.attachment
      const fileUrl = `https://api.zotero.org/users/${userId}/items/${attachment.key}/file`
      const isPDF = attachment.data.contentType === 'application/pdf'
      const isEPUB = attachment.data.contentType === 'application/epub+zip'

      let cover
      if (isPDF) {
        cover = await extractCoverFromPDF(fileUrl, apiKey)
      } else if (isEPUB) {
        cover = await extractCoverFromEPUB(fileUrl, apiKey)
      }

      if (cover) {
        setCoverUrl(cover)
        setCachedCover(cover)
      } else {
        setError(true)
      }
    } catch (err) {
      console.error('Error loading cover:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  const getAuthors = () => {
    const creators = item.data.creators || []
    const authors = creators.filter(c => c.creatorType === 'author')
    if (authors.length === 0) return null

    if (authors.length === 1) {
      return `${authors[0].lastName || authors[0].name || ''}`
    } else if (authors.length === 2) {
      return `${authors[0].lastName || authors[0].name} & ${authors[1].lastName || authors[1].name}`
    } else {
      return `${authors[0].lastName || authors[0].name} et al.`
    }
  }

  const getDisplayText = () => {
    const title = item.data.title || 'Untitled'
    const authors = getAuthors()

    switch (displayFormat) {
      case 'author':
        return authors || title
      case 'title':
        return title
      case 'author-title':
      default:
        return authors ? `${authors} - ${title}` : title
    }
  }

  const getZoteroLink = () => {
    if (linkType === 'web') {
      // Link to web library reader - open the parent item in reader view
      return `https://www.zotero.org/${username}/items/${item.key}/reader`
    } else {
      // Use open-pdf to open the PDF/EPUB directly in Zotero's reader
      // Link to the attachment (not the parent item)
      return `zotero://open-pdf/library/items/${item.attachment.key}`
    }
  }

  return (
    <a
      href={getZoteroLink()}
      className="cover-item"
      title={`Open "${getDisplayText()}" in Zotero`}
    >
      <div className="cover-image-container">
        {loading && (
          <div className="cover-loading">
            <div className="spinner"></div>
          </div>
        )}
        {error && !loading && (
          <div className="cover-error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        )}
        {coverUrl && !loading && (
          <img src={coverUrl} alt={getDisplayText()} className="cover-image" />
        )}
      </div>
      <div className="cover-title">{getDisplayText()}</div>
    </a>
  )
}

function CoverGrid({ items, userId, apiKey, username, linkType }) {
  const [displayFormat, setDisplayFormat] = useState('author-title')

  return (
    <div className="cover-grid-container">
      <div className="grid-header">
        <div>
          <h3>Found {items.length} item{items.length !== 1 ? 's' : ''}</h3>
        </div>
        <div className="display-format-selector">
          <label htmlFor="display-format">Display: </label>
          <select
            id="display-format"
            value={displayFormat}
            onChange={(e) => setDisplayFormat(e.target.value)}
            className="format-select"
          >
            <option value="author-title">Author - Title</option>
            <option value="author">Author Only</option>
            <option value="title">Title Only</option>
          </select>
        </div>
      </div>
      <div className="cover-grid">
        {items.map((item) => (
          <CoverItem
            key={item.key}
            item={item}
            userId={userId}
            apiKey={apiKey}
            displayFormat={displayFormat}
            username={username}
            linkType={linkType}
          />
        ))}
      </div>
    </div>
  )
}

export default CoverGrid
