export const handler = async (event) => {
  try {
    // Get parameters from query string
    const { userId, itemKey, apiKey } = event.queryStringParameters || {};

    if (!userId || !itemKey || !apiKey) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required parameters: userId, itemKey, apiKey' })
      };
    }

    // Fetch the file from Zotero
    const fileUrl = `https://api.zotero.org/users/${userId}/items/${itemKey}/file`;

    console.log('Fetching file from Zotero:', fileUrl);

    const response = await fetch(fileUrl, {
      headers: {
        'Zotero-API-Version': '3',
        'Zotero-API-Key': apiKey
      }
    });

    console.log('Zotero file response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Zotero file fetch failed:', response.status, errorText);
      return {
        statusCode: response.status,
        body: JSON.stringify({
          error: `Failed to fetch file from Zotero: ${response.status} ${response.statusText}`,
          details: errorText
        })
      };
    }

    // Get the file content
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log('File downloaded successfully, size:', buffer.length);

    // Get content type from response
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    // Return the file data as base64
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        data: buffer.toString('base64'),
        contentType: contentType
      })
    };
  } catch (error) {
    console.error('File proxy error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};
