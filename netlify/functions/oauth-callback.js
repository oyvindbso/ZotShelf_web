export const handler = async (event) => {
  try {
    const { oauth_token, oauth_verifier } = event.queryStringParameters;

    if (!oauth_token || !oauth_verifier) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'text/html'
        },
        body: '<html><body><h1>Error: Missing OAuth parameters</h1></body></html>'
      };
    }

    // Redirect back to the app with the tokens
    const redirectUrl = `${process.env.URL}?oauth_token=${oauth_token}&oauth_verifier=${oauth_verifier}`;

    return {
      statusCode: 302,
      headers: {
        'Location': redirectUrl
      }
    };
  } catch (error) {
    console.error('OAuth callback error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'text/html'
      },
      body: '<html><body><h1>Error processing OAuth callback</h1></body></html>'
    };
  }
};
