/**
 * Zotero API service
 * Documentation: https://www.zotero.org/support/dev/web_api/v3/start
 */

const ZOTERO_API_BASE = 'https://api.zotero.org'

/**
 * Makes a request to the Zotero API
 */
async function zoteroRequest(endpoint, apiKey) {
  const url = `${ZOTERO_API_BASE}${endpoint}`
  const headers = {
    'Zotero-API-Version': '3',
    'Zotero-API-Key': apiKey
  }

  const response = await fetch(url, { headers })

  if (!response.ok) {
    throw new Error(`Zotero API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

/**
 * Get all collections for a user
 */
export async function getCollections(userId, apiKey) {
  return zoteroRequest(`/users/${userId}/collections`, apiKey)
}

/**
 * Get items in a specific collection
 */
export async function getItemsInCollection(userId, apiKey, collectionKey) {
  return zoteroRequest(`/users/${userId}/collections/${collectionKey}/items/top`, apiKey)
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
 * Get items by tag
 */
export async function getItemsByTag(userId, apiKey, tag, collectionKey = null) {
  let endpoint = `/users/${userId}/items?tag=${encodeURIComponent(tag)}`

  if (collectionKey) {
    endpoint = `/users/${userId}/collections/${collectionKey}/items?tag=${encodeURIComponent(tag)}`
  }

  return zoteroRequest(endpoint, apiKey)
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
