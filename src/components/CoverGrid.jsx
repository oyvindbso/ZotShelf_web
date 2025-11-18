import { useState, useEffect } from 'react'
import './CoverGrid.css'
import { extractCoverFromPDF, extractCoverFromEPUB } from '../utils/coverExtractor'

function CoverItem({ item, userId, apiKey, displayFormat, username, linkType }) {
  const [coverUrl, setCoverUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [errorType, setErrorType] = useState(null)

  useEffect(() => {
    loadCover()
  }, [item.attachment.key, item.attachment.version]) // Use stable values instead of entire item object

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
      if (cached) {
        console.log(`Cache HIT for ${cacheKey}, size: ${cached.length} chars`)
      } else {
        console.log(`Cache MISS for ${cacheKey}`)
      }
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
      console.log(`Cached cover: ${cacheKey}`)
    } catch (err) {
      // If localStorage is full, try to clear old covers
      console.warn('Cache full, attempting cleanup...')
      try {
        clearOldCovers(5) // More aggressive - remove 5 oldest
        localStorage.setItem(getCacheKey(), coverData)
        console.log('Successfully cached after cleanup')
      } catch (retryErr) {
        // Still failed, clear all covers and try once more
        console.warn('Still full, clearing all cover cache...')
        try {
          clearAllCovers()
          localStorage.setItem(getCacheKey(), coverData)
          console.log('Successfully cached after full cleanup')
        } catch (finalErr) {
          // Give up - user has too much other data in localStorage
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

    // Sort by key (which includes timestamp-like data) and remove oldest
    coverKeys.sort()
    const toRemove = Math.min(count, coverKeys.length)
    console.log(`Removing ${toRemove} old covers from cache`)

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
    console.log(`Clearing all ${coverKeys.length} covers from cache`)
    coverKeys.forEach(key => localStorage.removeItem(key))
  }

  const loadCover = async () => {
    try {
      setLoading(true)
      setError(false)
      setErrorType(null)

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
        console.log(`Extracting cover from PDF: ${attachment.key}`)
        cover = await extractCoverFromPDF(fileUrl, apiKey)
      } else if (isEPUB) {
        console.log(`Extracting cover from EPUB: ${attachment.key}`)
        cover = await extractCoverFromEPUB(fileUrl, apiKey)
      }

      if (cover) {
        console.log(`Cover extracted successfully for ${attachment.key}`)
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
    if (authors.length === 0) return 'zzz' // Sort items without authors last
    return (authors[0].lastName || authors[0].name || 'zzz').toLowerCase()
  }

  const getYear = (item) => {
    const date = item.data.date || ''
    // Extract year from date string (e.g., "2020", "2020-01-01", "January 2020")
    const yearMatch = date.match(/\d{4}/)
    return yearMatch ? parseInt(yearMatch[0]) : 9999 // Sort items without year last
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
        return yearB - yearA // Newest first

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
