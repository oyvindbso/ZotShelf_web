import { useState, useEffect } from 'react'
import './CoverGrid.css'
import { extractCoverFromPDF, extractCoverFromEPUB } from '../utils/coverExtractor'

function CoverItem({ item, userId, apiKey }) {
  const [coverUrl, setCoverUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    loadCover()
  }, [item])

  const loadCover = async () => {
    try {
      setLoading(true)
      setError(false)

      const fileUrl = `https://api.zotero.org/users/${userId}/items/${item.key}/file`
      const isPDF = item.data.contentType === 'application/pdf'
      const isEPUB = item.data.contentType === 'application/epub+zip'

      let cover
      if (isPDF) {
        cover = await extractCoverFromPDF(fileUrl, apiKey)
      } else if (isEPUB) {
        cover = await extractCoverFromEPUB(fileUrl, apiKey)
      }

      if (cover) {
        setCoverUrl(cover)
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

  const getTitle = () => {
    return item.data.title || item.data.filename || 'Untitled'
  }

  return (
    <div className="cover-item">
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
          <img src={coverUrl} alt={getTitle()} className="cover-image" />
        )}
      </div>
      <div className="cover-title">{getTitle()}</div>
    </div>
  )
}

function CoverGrid({ items, userId, apiKey }) {
  return (
    <div className="cover-grid-container">
      <div className="grid-header">
        <h3>Found {items.length} item{items.length !== 1 ? 's' : ''}</h3>
      </div>
      <div className="cover-grid">
        {items.map((item) => (
          <CoverItem key={item.key} item={item} userId={userId} apiKey={apiKey} />
        ))}
      </div>
    </div>
  )
}

export default CoverGrid
