import * as pdfjsLib from 'pdfjs-dist'
import JSZip from 'jszip'

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

/**
 * Fetch file via Netlify Function proxy to avoid CORS issues
 */
async function fetchFileViaProxy(userId, itemKey, apiKey) {
  const proxyUrl = `/.netlify/functions/file-proxy?userId=${userId}&itemKey=${itemKey}&apiKey=${encodeURIComponent(apiKey)}`;

  console.log('Fetching file via proxy:', proxyUrl);

  const response = await fetch(proxyUrl);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch file via proxy');
  }

  const result = await response.json();

  // Convert base64 back to ArrayBuffer
  const binaryString = atob(result.data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes.buffer;
}

/**
 * Extract cover image from PDF (renders first page)
 */
export async function extractCoverFromPDF(fileUrl, apiKey) {
  try {
    // Extract userId and itemKey from the fileUrl
    // Format: https://api.zotero.org/users/{userId}/items/{itemKey}/file
    const urlMatch = fileUrl.match(/users\/(\d+)\/items\/([A-Z0-9]+)\/file/);
    if (!urlMatch) {
      throw new Error('Invalid file URL format');
    }

    const [, userId, itemKey] = urlMatch;
    console.log('Extracting PDF cover for user:', userId, 'item:', itemKey);

    // Fetch via proxy
    const arrayBuffer = await fetchFileViaProxy(userId, itemKey, apiKey);
    console.log('PDF downloaded, size:', arrayBuffer.byteLength);

    // Load the PDF
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
    const pdf = await loadingTask.promise

    // Get the first page
    const page = await pdf.getPage(1)

    // Set up canvas for rendering
    const viewport = page.getViewport({ scale: 2.0 })
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    canvas.width = viewport.width
    canvas.height = viewport.height

    // Render the page
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise

    // Convert canvas to data URL
    return canvas.toDataURL('image/jpeg', 0.8)
  } catch (error) {
    console.error('Error extracting PDF cover:', error)
    return null
  }
}

/**
 * Extract cover image from EPUB
 */
export async function extractCoverFromEPUB(fileUrl, apiKey) {
  try {
    // Extract userId and itemKey from the fileUrl
    const urlMatch = fileUrl.match(/users\/(\d+)\/items\/([A-Z0-9]+)\/file/);
    if (!urlMatch) {
      throw new Error('Invalid file URL format');
    }

    const [, userId, itemKey] = urlMatch;
    console.log('Extracting EPUB cover for user:', userId, 'item:', itemKey);

    // Fetch via proxy
    const arrayBuffer = await fetchFileViaProxy(userId, itemKey, apiKey);
    console.log('EPUB downloaded, size:', arrayBuffer.byteLength);

    // Load the EPUB as a ZIP file
    const zip = await JSZip.loadAsync(arrayBuffer)

    // Try to find the cover image using common patterns
    let coverImage = null

    // Common cover image locations/names
    const coverPatterns = [
      /cover\.jpe?g$/i,
      /cover\.png$/i,
      /cover-image\.jpe?g$/i,
      /cover-image\.png$/i,
      /^OEBPS\/cover\.jpe?g$/i,
      /^OEBPS\/images\/cover\.jpe?g$/i,
      /^images\/cover\.jpe?g$/i,
      /^cover\.jpe?g$/i
    ]

    // First, try to find cover in META-INF/container.xml or content.opf
    // For simplicity, we'll search through all files
    const files = Object.keys(zip.files)

    // Look for files matching cover patterns
    for (const pattern of coverPatterns) {
      const match = files.find(file => pattern.test(file))
      if (match) {
        coverImage = match
        break
      }
    }

    // If no match found, look for first image in common image folders
    if (!coverImage) {
      const imagePatterns = [
        /\.(jpe?g|png)$/i
      ]

      const imageFolders = ['OEBPS/images/', 'images/', 'OEBPS/', '']

      for (const folder of imageFolders) {
        const imageInFolder = files.find(file =>
          file.startsWith(folder) &&
          imagePatterns.some(pattern => pattern.test(file)) &&
          !file.includes('thumb')
        )
        if (imageInFolder) {
          coverImage = imageInFolder
          break
        }
      }
    }

    if (!coverImage) {
      console.warn('No cover image found in EPUB')
      return null
    }

    // Extract and convert the image
    const imageData = await zip.file(coverImage).async('blob')
    const imageUrl = URL.createObjectURL(imageData)

    return imageUrl
  } catch (error) {
    console.error('Error extracting EPUB cover:', error)
    return null
  }
}

/**
 * Parse EPUB OPF file to find cover reference
 * This is a helper function for more accurate cover detection
 */
async function findCoverInOPF(zip) {
  try {
    // Find content.opf file
    const opfFile = Object.keys(zip.files).find(file =>
      file.endsWith('.opf') || file.includes('content.opf')
    )

    if (!opfFile) {
      return null
    }

    const opfContent = await zip.file(opfFile).async('string')

    // Parse XML to find cover reference
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(opfContent, 'text/xml')

    // Look for cover in metadata
    const metaElements = xmlDoc.getElementsByTagName('meta')
    for (const meta of metaElements) {
      if (meta.getAttribute('name') === 'cover') {
        const coverId = meta.getAttribute('content')

        // Find the item with this ID
        const items = xmlDoc.getElementsByTagName('item')
        for (const item of items) {
          if (item.getAttribute('id') === coverId) {
            return item.getAttribute('href')
          }
        }
      }
    }

    return null
  } catch (error) {
    console.error('Error parsing OPF:', error)
    return null
  }
}
