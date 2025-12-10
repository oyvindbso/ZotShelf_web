import { useState, useEffect } from 'react'
import './CoverGrid.css'
import { extractCoverFromPDF, extractCoverFromEPUB } from '../utils/coverExtractor'

function CoverItem({ item, userId, apiKey, displayFormat, username, linkType }) {
  const [coverUrl, setCoverUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [errorType, setErrorType] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadCover()
  }, []) // Remove dependencies to prevent re-running on prop changes

  const getCacheKey = () => {
    // Use attachment key and version for cache key
    const key = item.attachment.key
    const version = item.attachment.version || item.attachment.data?.version || '0'
    return `cover_${key}_${version}`
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
    // Don't cache if data is too large (> 500KB base64)
    if (coverData.length > 500000) {
      console.log('Cover too large to cache, skipping')
      return
    }

    try {
      const cacheKey = getCacheKey()
      localStorage.setItem(cacheKey, coverData)
    } catch (err) {
      // If localStorage is full, try to clear old covers
      console.warn('Cache full, attempting cleanup...')
      try {
        clearOldCovers(5)
        localStorage.setItem(getCacheKey(), coverData)
      } catch (retryErr) {
        console.warn('Still full, clearing all cover cache...')
        try {
          clearAllCovers()
          localStorage.setItem(getCacheKey(), coverData)
        } catch (finalErr) {
          console.error('Cannot cache - localStorage full:', finalErr.message)
        }
      }
    }
  }

  const clearOldCovers = (count = 10) => {
    // Remove oldest cover cache entries
    const coverKeys = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('cover_')) {
        coverKeys.push(key)
      }
    }

    coverKeys.sort()
    const toRemove = Math.min(count, coverKeys.length)

    for (let i = 0; i < toRemove; i++) {
      localStorage.removeItem(coverKeys[i])
    }
  }

  const clearAllCovers = () => {
    // Remove all cover cache entries
    const coverKeys = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('cover_')) {
        coverKeys.push(key)
      }
    }
    coverKeys.forEach(key => localStorage.removeItem(key))
  }

  const loadCover = async () => {
    // Check cache first BEFORE setting any state
    const cached = getCachedCover()
    if (cached) {
      setCoverUrl(cached)
      setLoading(false)
      return
    }

    // Only set loading state if we need to extract
    try {
      setLoading(true)
      setError(false)
      setErrorType(null)

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
        setErrorType('NO_COVER')
      }
    } catch (err) {
      console.error('Error loading cover:', err)
      setError(true)

      // Check if it's a file too large error
      if (err.message === 'FILE_TOO_LARGE') {
        setErrorType('FILE_TOO_LARGE')
      } else {
        setErrorType('UNKNOWN')
      }
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

  const handleCopyLink = async (e) => {
    e.preventDefault()
    e.stopPropagation()

    const link = getZoteroLink()
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy link:', err)
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
          <div className={`cover-error ${errorType === 'FILE_TOO_LARGE' ? 'cover-too-large' : ''}`}>
            {errorType === 'FILE_TOO_LARGE' ? (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="cover-error-text">File too large</span>
              </>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
          </div>
        )}
        {coverUrl && !loading && (
          <img src={coverUrl} alt={getDisplayText()} className="cover-image" />
        )}

        {/* Copy link button */}
        <button
          className="copy-link-button"
          onClick={handleCopyLink}
          title="Copy link"
        >
          {copied ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
      </div>
      <div className="cover-title">{getDisplayText()}</div>
    </a>
  )
}

function CoverGrid({ items, userId, apiKey, username, linkType }) {
  const [displayFormat, setDisplayFormat] = useState('author-title')
  const [sortBy, setSortBy] = useState(() => {
    return localStorage.getItem('sort_by') || 'title'
  })

  const handleSortChange = (newSort) => {
    setSortBy(newSort)
    localStorage.setItem('sort_by', newSort)
  }

  const getAuthorLastName = (item) => {
    const creators = item.data.creators || []
    const authors = creators.filter(c => c.creatorType === 'author')
    if (authors.length === 0) return 'zzz'
    return (authors[0].lastName || authors[0].name || 'zzz').toLowerCase()
  }

  const getYear = (item) => {
    const date = item.data.date || ''
    const yearMatch = date.match(/\d{4}/)
    return yearMatch ? parseInt(yearMatch[0]) : 9999
  }

  const getTitle = (item) => {
    return (item.data.title || 'Untitled').toLowerCase()
  }

  const sortedItems = [...items].sort((a, b) => {
    switch (sortBy) {
      case 'author':
        const authorA = getAuthorLastName(a)
        const authorB = getAuthorLastName(b)
        return authorA.localeCompare(authorB)

      case 'year':
        const yearA = getYear(a)
        const yearB = getYear(b)
        return yearB - yearA

      case 'title':
      default:
        const titleA = getTitle(a)
        const titleB = getTitle(b)
        return titleA.localeCompare(titleB)
    }
  })

  return (
    <div className="cover-grid-container">
      <div className="grid-header">
        <div>
          <h3>Found {items.length} item{items.length !== 1 ? 's' : ''}</h3>
        </div>
        <div className="grid-controls">
          <div className="display-format-selector">
            <label htmlFor="sort-by">Sort by: </label>
            <select
              id="sort-by"
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value)}
              className="format-select"
            >
              <option value="title">Title</option>
              <option value="author">Author</option>
              <option value="year">Year (newest first)</option>
            </select>
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
      </div>
      <div className="cover-grid">
        {sortedItems.map((item) => (
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
