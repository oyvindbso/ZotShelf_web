# ZotShelf - Zotero Collection Viewer

A web application that displays your Zotero collection as a beautiful grid of book covers.

## Features

- 🔐 Secure Zotero OAuth authentication
- 📚 Browse collections and filter by tags
- 🖼️ Automatic cover extraction from PDFs and EPUBs
- 🔗 Click covers to open items directly in Zotero app
- 📱 Responsive grid layout
- ☁️ Deployed on Netlify

## Getting Started

### Prerequisites

- Node.js 18 or higher
- A Zotero account
- Zotero API credentials (obtainable from https://www.zotero.org/settings/keys)

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Deploy to Netlify

1. Push your code to GitHub
2. Connect your repository to Netlify
3. Add your Zotero API credentials as environment variables:
   - `VITE_ZOTERO_CLIENT_ID`
   - `VITE_ZOTERO_CLIENT_SECRET`
4. Deploy!

## Environment Variables

Create a `.env` file in the root directory:

```
VITE_ZOTERO_CLIENT_ID=your_client_id
VITE_ZOTERO_CLIENT_SECRET=your_client_secret
```

## Usage

1. Log in with your Zotero credentials
2. Select a collection from the dropdown
3. Optionally filter by tags
4. View your collection as a grid of covers
5. Click on any cover to open the item in your Zotero desktop app

## Technologies

- React 18
- Vite
- Zotero API
- PDF.js for PDF cover extraction
- JSZip for EPUB cover extraction
