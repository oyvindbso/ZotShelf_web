# ZotShelf - Zotero Collection Viewer

A web application that displays your Zotero collection as a beautiful grid of book covers.

## Features

- 🔐 Secure Zotero API authentication via environment variables
- 📚 Browse collections and filter by tags
- 🖼️ Automatic cover extraction from PDFs and EPUBs
- 🔗 Click covers to open items directly in Zotero app
- 📱 Responsive grid layout
- ☁️ Ready for Netlify deployment

## Getting Started

### Prerequisites

- Node.js 18 or higher
- A Zotero account
- Zotero API credentials (obtainable from https://www.zotero.org/settings/keys)

### Installation

```bash
npm install
```

### Configuration

1. Get your Zotero credentials from https://www.zotero.org/settings/keys
   - Your **User ID** is displayed in the "Your userID for use in API calls" section
   - Create a new **API Key** with "Allow library access" permission

2. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` and add your credentials:
   ```
   VITE_ZOTERO_USER_ID=your_user_id
   VITE_ZOTERO_API_KEY=your_api_key
   ```

**Important:** Never commit your `.env` file to git! It's already in `.gitignore`.

### Development

```bash
npm run dev
```

The app will open at http://localhost:3000

### Build

```bash
npm run build
```

### Deploy to Netlify

1. Push your code to GitHub (your `.env` file will NOT be pushed thanks to `.gitignore`)

2. Log in to [Netlify](https://app.netlify.com/) and create a new site from your repository

3. In Netlify's site settings, go to "Environment variables" and add:
   - `VITE_ZOTERO_USER_ID` = your Zotero user ID
   - `VITE_ZOTERO_API_KEY` = your Zotero API key

4. Deploy! Netlify will automatically build and deploy your site.

## Usage

1. Open the application - it will automatically connect to your Zotero library
2. Select a collection from the dropdown
3. Optionally filter by tag
4. View your collection as a grid of covers
5. Click on any cover to open the item in your Zotero desktop app

## Security Notes

- Your API credentials are stored in environment variables and never exposed in the code
- The `.env` file is in `.gitignore` to prevent accidental commits
- When deploying to Netlify, credentials are stored in Netlify's secure environment variable system
- This is designed as a personal/single-user application
- Your API key has read-only access to your library (if configured correctly)

## Technologies

- React 18
- Vite
- Zotero API
- PDF.js for PDF cover extraction
- JSZip for EPUB cover extraction
