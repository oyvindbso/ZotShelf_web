/**
 * Zotero OAuth service
 * Handles OAuth 1.0a authentication flow with Netlify Functions
 */

/**
 * Initiate OAuth flow
 * Returns the authorization URL and temporary tokens
 */
export async function initiateOAuth() {
  try {
    const response = await fetch('/.netlify/functions/oauth-init');
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to initiate OAuth');
    }

    return data;
  } catch (error) {
    console.error('OAuth initiation error:', error);
    throw error;
  }
}

/**
 * Exchange OAuth tokens for access token
 */
export async function exchangeOAuthToken(oauthToken, oauthVerifier, oauthTokenSecret) {
  try {
    const response = await fetch('/.netlify/functions/oauth-exchange', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        oauth_token: oauthToken,
        oauth_verifier: oauthVerifier,
        oauth_token_secret: oauthTokenSecret
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to exchange OAuth token');
    }

    return data;
  } catch (error) {
    console.error('OAuth exchange error:', error);
    throw error;
  }
}

/**
 * Store authentication data in localStorage
 */
export function storeAuth(accessToken, userId, username) {
  localStorage.setItem('zotero_access_token', accessToken);
  localStorage.setItem('zotero_user_id', userId);
  localStorage.setItem('zotero_username', username);
}

/**
 * Get stored authentication data
 */
export function getStoredAuth() {
  return {
    accessToken: localStorage.getItem('zotero_access_token'),
    userId: localStorage.getItem('zotero_user_id'),
    username: localStorage.getItem('zotero_username')
  };
}

/**
 * Clear stored authentication data
 */
export function clearAuth() {
  localStorage.removeItem('zotero_access_token');
  localStorage.removeItem('zotero_user_id');
  localStorage.removeItem('zotero_username');
  localStorage.removeItem('oauth_token_secret');
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated() {
  const { accessToken, userId } = getStoredAuth();
  return !!(accessToken && userId);
}
