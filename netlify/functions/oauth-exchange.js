import OAuth from 'oauth-1.0a';
import crypto from 'crypto';

export const handler = async (event) => {
  try {
    const { oauth_token, oauth_verifier, oauth_token_secret } = JSON.parse(event.body);

    if (!oauth_token || !oauth_verifier || !oauth_token_secret) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required parameters' })
      };
    }

    const clientKey = process.env.ZOTERO_CLIENT_KEY;
    const clientSecret = process.env.ZOTERO_CLIENT_SECRET;

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
      url: 'https://www.zotero.org/oauth/access',
      method: 'POST',
      data: {
        oauth_token: oauth_token,
        oauth_verifier: oauth_verifier
      }
    };

    const token = {
      key: oauth_token,
      secret: oauth_token_secret
    };

    const authHeader = oauth.toHeader(oauth.authorize(requestData, token));

    const response = await fetch(requestData.url, {
      method: 'POST',
      headers: {
        ...authHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        oauth_verifier: oauth_verifier
      }).toString()
    });

    const responseText = await response.text();
    const params = new URLSearchParams(responseText);

    const accessToken = params.get('oauth_token');
    const accessTokenSecret = params.get('oauth_token_secret');
    const userId = params.get('userID');
    const username = params.get('username');

    if (!accessToken || !accessTokenSecret || !userId) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to exchange OAuth token' })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        accessToken,
        accessTokenSecret,
        userId,
        username
      })
    };
  } catch (error) {
    console.error('OAuth exchange error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
