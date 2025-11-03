# ZotShelf - Zotero Collection Viewer

A web application that displays your Zotero collection as a beautiful grid of book covers. Users sign in with their Zotero account via OAuth to access their personal libraries.

## Features

- 🔐 Secure Zotero OAuth 1.0a authentication
- 📚 Browse collections and filter by tags
- 🖼️ Automatic cover extraction from PDFs and EPUBs
- 🔗 Click covers to open items directly in Zotero app
- 📱 Responsive grid layout
- ☁️ Serverless architecture with Netlify Functions
- 🔒 Multi-user support - each user authenticates with their own Zotero account

## Getting Started

### Prerequisites

- Node.js 18 or higher
- A Netlify account (free tier works fine)
- Zotero OAuth app credentials

### Step 1: Register Your OAuth App

1. Go to https://www.zotero.org/oauth/apps
2. Click "Register a new application"
3. Fill in the details:
   - **Name**: ZotShelf (or your preferred name)
   - **Description**: Personal Zotero library viewer
   - **Callback URL**: `https://your-site-name.netlify.app/.netlify/functions/oauth-callback`
     - For local development: `http://localhost:8888/.netlify/functions/oauth-callback`
4. After registration, you'll receive:
   - **Client Key**
   - **Client Secret**
5. Keep these credentials secure!

### Step 2: Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/zotshelf-web.git
cd zotshelf-web

# Install dependencies
npm install
```

### Step 3: Local Development Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your OAuth credentials:
   ```
   ZOTERO_CLIENT_KEY=your_client_key
   ZOTERO_CLIENT_SECRET=your_client_secret
   ```

3. Install Netlify CLI (for local development with functions):
   ```bash
   npm install -g netlify-cli
   ```

4. Run the development server:
   ```bash
   netlify dev
   ```

   The app will open at http://localhost:8888

**Important:** Never commit your `.env` file! It's already in `.gitignore`.

### Step 4: Deploy to Netlify

#### Option A: Deploy via Netlify UI

1. Push your code to GitHub (your `.env` file will NOT be pushed)

2. Log in to [Netlify](https://app.netlify.com/)

3. Click "Add new site" → "Import an existing project"

4. Connect to your GitHub repository

5. Configure build settings (these should be auto-detected from `netlify.toml`):
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`

6. Before deploying, add environment variables:
   - Go to "Site settings" → "Environment variables"
   - Add these variables:
     - `ZOTERO_CLIENT_KEY` = your client key
     - `ZOTERO_CLIENT_SECRET` = your client secret

7. Click "Deploy site"

8. After deployment, update your Zotero OAuth app callback URL to match your Netlify URL

#### Option B: Deploy via Netlify CLI

```bash
# Build the site
npm run build

# Deploy
netlify deploy --prod

# Set environment variables
netlify env:set ZOTERO_CLIENT_KEY your_client_key
netlify env:set ZOTERO_CLIENT_SECRET your_client_secret
```

## Usage

1. Visit your deployed site
2. Click "Sign in with Zotero"
3. Authorize the app on Zotero's website
4. You'll be redirected back to ZotShelf
5. Select a collection from the dropdown
6. Optionally filter by tag
7. View your collection as a grid of covers
8. Click any cover to open the item in your Zotero desktop app

## How OAuth Works

```
User → ZotShelf → Netlify Function → Zotero OAuth
                      ↓
                 Secure Token
                      ↓
            User's Library Access
```

- Your OAuth client credentials are stored securely in Netlify environment variables
- Users authenticate directly with Zotero
- Each user gets their own temporary access token
- Tokens are stored in the user's browser (localStorage)
- The app never sees or stores user passwords

## Security Notes

- OAuth client credentials are stored in Netlify environment variables (server-side)
- Never exposed to client-side code
- User tokens are stored in browser localStorage
- All OAuth flows are handled by Netlify Functions
- Designed for multi-user deployment
- Users can revoke access anytime from their Zotero account settings

## Architecture

- **Frontend**: React 18 + Vite
- **Backend**: Netlify Functions (serverless)
- **Authentication**: OAuth 1.0a
- **Hosting**: Netlify
- **Cover Extraction**: PDF.js (PDFs) + JSZip (EPUBs)

## Technologies

- React 18
- Vite
- Netlify Functions
- OAuth 1.0a
- Zotero Web API v3
- PDF.js for PDF cover extraction
- JSZip for EPUB cover extraction
- CryptoJS for OAuth signatures

## Development

### Project Structure

```
zotshelf-web/
├── netlify/
│   └── functions/          # Serverless functions
│       ├── oauth-init.js   # Initiate OAuth flow
│       ├── oauth-callback.js # Handle OAuth redirect
│       └── oauth-exchange.js # Exchange tokens
├── src/
│   ├── components/         # React components
│   ├── services/           # API services
│   │   ├── zotero.js      # Zotero API client
│   │   └── oauth.js       # OAuth client
│   └── utils/              # Utilities
│       └── coverExtractor.js # PDF/EPUB processing
├── public/                 # Static assets
├── netlify.toml           # Netlify configuration
└── package.json
```

### Local Development

```bash
# Start dev server with functions
netlify dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Troubleshooting

### OAuth Callback Error

- Ensure your callback URL in Zotero OAuth app settings matches your deployment URL
- For local development: `http://localhost:8888/.netlify/functions/oauth-callback`
- For production: `https://your-site.netlify.app/.netlify/functions/oauth-callback`

### Environment Variables Not Working

- Check that variables are set in Netlify dashboard
- Redeploy after adding new environment variables
- For local dev, ensure `.env` file exists and has correct values

### Covers Not Loading

- Check browser console for errors
- Ensure PDF.js worker is loading correctly
- Some EPUBs may not have cover images

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this project for your own Zotero library!

## Acknowledgments

- [Zotero](https://www.zotero.org/) for their excellent API
- [PDF.js](https://mozilla.github.io/pdf.js/) for PDF rendering
- [Netlify](https://www.netlify.com/) for serverless hosting
