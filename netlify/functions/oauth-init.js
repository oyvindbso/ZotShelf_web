import OAuth from 'oauth-1.0a';
import crypto from 'crypto';

export const handler = async (event) => {
  try {
    const clientKey = process.env.ZOTERO_CLIENT_KEY;
    const clientSecret = process.env.ZOTERO_CLIENT_SECRET;
    const callbackUrl = process.env.URL + '/.netlify/functions/oauth-callback';

    if (!clientKey || !clientSecret) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'OAuth credentials not configured' })
      };
    }

    const oauth = new OAuth({
      consumer: {
        key: clientKey,
        secret: clientSecret
      },
      signature_method: 'HMAC-SHA1',
      hash_function(baseString, key) {
        return crypto.createHmac('sha1', key).update(baseString).digest('base64');
      }
    });

    const requestData = {
      url: 'https://www.zotero.org/oauth/request',
      method: 'POST',
      data: {
        oauth_callback: callbackUrl,
        name: 'ZotShelf',
        library_access: 1,  // Read library data
        notes_access: 0,    // No notes access needed
        write_access: 0,    // Read-only access
        all_groups: 'read'  // Read access to all groups
      }
    };

    const authHeader = oauth.toHeader(oauth.authorize(requestData));

    const response = await fetch(requestData.url, {
      method: 'POST',
      headers: {
        ...authHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(requestData.data).toString()
    });

    const responseText = await response.text();
    const params = new URLSearchParams(responseText);

    const oauthToken = params.get('oauth_token');
    const oauthTokenSecret = params.get('oauth_token_secret');

    if (!oauthToken || !oauthTokenSecret) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to get OAuth token' })
      };
    }

    // Store the token secret temporarily (in production, use a database or session store)
    // For now, we'll return it to be stored client-side temporarily
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        authUrl: `https://www.zotero.org/oauth/authorize?oauth_token=${oauthToken}`,
        oauthToken,
        oauthTokenSecret // In production, store this server-side
      })
    };
  } catch (error) {
    console.error('OAuth init error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
