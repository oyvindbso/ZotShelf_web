/**
 * Zotero API service
 * Documentation: https://www.zotero.org/support/dev/web_api/v3/start
 */

const ZOTERO_API_BASE = 'https://api.zotero.org'

/**
 * Makes a request to the Zotero API
 */
async function zoteroRequest(endpoint, apiKey, options = {}) {
  const url = `${ZOTERO_API_BASE}${endpoint}`
  const headers = {
    'Zotero-API-Version': '3',
    'Zotero-API-Key': apiKey,
    ...options.headers
  }

  const response = await fetch(url, {
    ...options,
    headers
  })

  if (!response.ok) {
    throw new Error(`Zotero API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

/**
 * Get all collections for a user with pagination
 */
export async function getCollections(userId, apiKey) {
  let allCollections = []
  let start = 0
  const limit = 100

  while (true) {
    const collections = await zoteroRequest(
      `/users/${userId}/collections?start=${start}&limit=${limit}`,
      apiKey
    )

    allCollections = allCollections.concat(collections)

    // If we got fewer items than the limit, we've reached the end
    if (collections.length < limit) {
      break
    }

    start += limit
  }

  return allCollections
}

/**
 * Get items in a specific collection with pagination
 */
export async function getItemsInCollection(userId, apiKey, collectionKey) {
  let allItems = []
  let start = 0
  const limit = 100

  while (true) {
    const items = await zoteroRequest(
      `/users/${userId}/collections/${collectionKey}/items/top?start=${start}&limit=${limit}`,
      apiKey
    )

    allItems = allItems.concat(items)

    // If we got fewer items than the limit, we've reached the end
    if (items.length < limit) {
      break
    }

    start += limit
  }

  return allItems
}

/**
 * Get child items (attachments, notes) for a specific item
 */
export async function getItemChildren(userId, apiKey, itemKey) {
  return zoteroRequest(`/users/${userId}/items/${itemKey}/children`, apiKey)
}

/**
 * Get a specific item
 */
export async function getItem(userId, apiKey, itemKey) {
  return zoteroRequest(`/users/${userId}/items/${itemKey}`, apiKey)
}

/**
 * Get items by tag with pagination
 */
export async function getItemsByTag(userId, apiKey, tag, collectionKey = null) {
  let allItems = []
  let start = 0
  const limit = 100

  while (true) {
    let endpoint = `/users/${userId}/items?tag=${encodeURIComponent(tag)}&start=${start}&limit=${limit}`

    if (collectionKey) {
      endpoint = `/users/${userId}/collections/${collectionKey}/items?tag=${encodeURIComponent(tag)}&start=${start}&limit=${limit}`
    }

    const items = await zoteroRequest(endpoint, apiKey)
    allItems = allItems.concat(items)

    // If we got fewer items than the limit, we've reached the end
    if (items.length < limit) {
      break
    }

    start += limit
  }

  return allItems
}

/**
 * Get all tags for a user
 */
export async function getTags(userId, apiKey) {
  return zoteroRequest(`/users/${userId}/tags`, apiKey)
}

/**
 * Download a file from Zotero
 */
export async function downloadFile(userId, itemKey, apiKey) {
  const url = `${ZOTERO_API_BASE}/users/${userId}/items/${itemKey}/file`
  const headers = {
    'Zotero-API-Version': '3',
    'Zotero-API-Key': apiKey
  }

  const response = await fetch(url, { headers })

  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status} ${response.statusText}`)
  }

  return response.blob()
}
