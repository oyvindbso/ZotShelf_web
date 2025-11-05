import * as pdfjsLib from 'pdfjs-dist'
import JSZip from 'jszip'

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

/**
 * Compress image to reduce size for caching
 */
async function compressImage(blob, maxWidth = 400) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(blob)

    img.onload = () => {
      URL.revokeObjectURL(url)

      // Calculate new dimensions
      let width = img.width
      let height = img.height

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width)
        width = maxWidth
      }

      // Create canvas and draw compressed image
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)

      // Convert to data URL with compression
      const compressed = canvas.toDataURL('image/jpeg', 0.7)
      resolve(compressed)
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image for compression'))
    }

    img.src = url
  })
}

/**
 * Fetch file via Netlify Function proxy to avoid CORS issues
 */
async function fetchFileViaProxy(userId, itemKey, apiKey) {
  const proxyUrl = `/.netlify/functions/file-proxy?userId=${userId}&itemKey=${itemKey}&apiKey=${encodeURIComponent(apiKey)}`;

  console.log('Fetching file via proxy:', proxyUrl);

  const response = await fetch(proxyUrl);

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const error = await response.json();
      errorMessage = error.error || error.message || errorMessage;
      console.error('Proxy error details:', error);

      // Special handling for file too large errors
      if (response.status === 413) {
        throw new Error('FILE_TOO_LARGE');
      }
    } catch (e) {
      if (e.message === 'FILE_TOO_LARGE') {
        throw e;
      }
      // Failed to parse error as JSON
      const text = await response.text();
      console.error('Proxy error response:', text);
    }
    throw new Error(`Failed to fetch file via proxy: ${errorMessage}`);
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

    // Set up canvas for rendering with lower scale for caching
    // Use scale 1.5 instead of 2.0 to reduce file size
    const viewport = page.getViewport({ scale: 1.5 })
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    canvas.width = viewport.width
    canvas.height = viewport.height

    // Render the page
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise

    // Convert canvas to data URL with lower quality for smaller file size
    return canvas.toDataURL('image/jpeg', 0.6)
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
    let coverImagePath = null

    // First, try to parse OPF metadata for cover reference (most reliable)
    coverImagePath = await findCoverInOPF(zip)
    console.log('Cover from OPF:', coverImagePath)

    // If OPF parsing didn't work, try common naming patterns
    if (!coverImagePath) {
      const files = Object.keys(zip.files)

      // Common cover image locations/names (expanded list)
      const coverPatterns = [
        /^cover\.jpe?g$/i,
        /^cover\.png$/i,
        /^cover\.gif$/i,
        /^cover-image\.jpe?g$/i,
        /^cover-image\.png$/i,
        /^coverimage\.jpe?g$/i,
        /^OEBPS\/cover\.jpe?g$/i,
        /^OEBPS\/cover\.png$/i,
        /^OEBPS\/images\/cover\.jpe?g$/i,
        /^OEBPS\/images\/cover\.png$/i,
        /^OEBPS\/Images\/cover\.jpe?g$/i,
        /^images\/cover\.jpe?g$/i,
        /^images\/cover\.png$/i,
        /^Images\/cover\.jpe?g$/i,
        /\/cover\.jpe?g$/i,
        /\/cover\.png$/i,
        /cover.*\.(jpe?g|png)$/i
      ]

      // Look for files matching cover patterns
      for (const pattern of coverPatterns) {
        const match = files.find(file =>
          pattern.test(file) && !zip.files[file].dir
        )
        if (match) {
          coverImagePath = match
          console.log('Cover from pattern match:', coverImagePath)
          break
        }
      }
    }

    // If still no match, look for the first image file in common folders
    if (!coverImagePath) {
      const files = Object.keys(zip.files)
      const imageExtensions = /\.(jpe?g|png|gif)$/i
      const imageFolders = ['OEBPS/images/', 'OEBPS/Images/', 'images/', 'Images/', 'OEBPS/', 'OPS/images/', 'OPS/']

      for (const folder of imageFolders) {
        const imageInFolder = files.find(file =>
          file.startsWith(folder) &&
          imageExtensions.test(file) &&
          !file.includes('thumb') &&
          !file.includes('icon') &&
          !zip.files[file].dir
        )
        if (imageInFolder) {
          coverImagePath = imageInFolder
          console.log('Cover from folder search:', coverImagePath)
          break
        }
      }
    }

    // Last resort: find any image file
    if (!coverImagePath) {
      const files = Object.keys(zip.files)
      const imageExtensions = /\.(jpe?g|png|gif)$/i
      coverImagePath = files.find(file =>
        imageExtensions.test(file) && !zip.files[file].dir
      )
      if (coverImagePath) {
        console.log('Cover from any image:', coverImagePath)
      }
    }

    if (!coverImagePath) {
      console.warn('No cover image found in EPUB')
      return null
    }

    // Extract and compress the image for caching
    const imageData = await zip.file(coverImagePath).async('blob')

    // Compress image to reduce cache size
    try {
      const compressed = await compressImage(imageData, 400)
      console.log('EPUB cover compressed for caching')
      return compressed
    } catch (compressErr) {
      console.warn('Failed to compress image, using original:', compressErr)
      // Fallback to uncompressed if compression fails
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(imageData)
      })
    }
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
    const files = Object.keys(zip.files)
    const opfFile = files.find(file =>
      file.endsWith('.opf') || file.includes('content.opf') || file.includes('package.opf')
    )

    if (!opfFile) {
      console.log('No OPF file found')
      return null
    }

    console.log('Found OPF file:', opfFile)
    const opfContent = await zip.file(opfFile).async('string')

    // Parse XML to find cover reference
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(opfContent, 'text/xml')

    // Get the directory of the OPF file for resolving relative paths
    const opfDir = opfFile.substring(0, opfFile.lastIndexOf('/') + 1)

    // Method 1: Look for cover in metadata with name="cover"
    const metaElements = xmlDoc.getElementsByTagName('meta')
    for (const meta of metaElements) {
      if (meta.getAttribute('name') === 'cover') {
        const coverId = meta.getAttribute('content')
        console.log('Found cover ID in metadata:', coverId)

        // Find the item with this ID in the manifest
        const items = xmlDoc.getElementsByTagName('item')
        for (const item of items) {
          if (item.getAttribute('id') === coverId) {
            const href = item.getAttribute('href')
            const coverPath = opfDir + href
            console.log('Found cover path from manifest:', coverPath)

            // Check if this file exists in the zip
            if (zip.files[coverPath]) {
              return coverPath
            }
            // Try without the directory prefix
            if (zip.files[href]) {
              return href
            }
          }
        }
      }
    }

    // Method 2: Look for items with properties="cover-image" (EPUB 3)
    const items = xmlDoc.getElementsByTagName('item')
    for (const item of items) {
      const properties = item.getAttribute('properties')
      if (properties && properties.includes('cover-image')) {
        const href = item.getAttribute('href')
        const coverPath = opfDir + href
        console.log('Found cover-image property:', coverPath)

        if (zip.files[coverPath]) {
          return coverPath
        }
        if (zip.files[href]) {
          return href
        }
      }
    }

    // Method 3: Look for guide reference type="cover"
    const references = xmlDoc.getElementsByTagName('reference')
    for (const ref of references) {
      const type = ref.getAttribute('type')
      if (type === 'cover') {
        const href = ref.getAttribute('href')
        // This might be an HTML file, we need to parse it for the image
        console.log('Found cover reference in guide:', href)
        const coverPath = opfDir + href

        if (href.match(/\.(jpe?g|png|gif)$/i)) {
          // It's directly an image
          if (zip.files[coverPath]) {
            return coverPath
          }
          if (zip.files[href]) {
            return href
          }
        }
      }
    }

    console.log('No cover found in OPF metadata')
    return null
  } catch (error) {
    console.error('Error parsing OPF:', error)
    return null
  }
}
