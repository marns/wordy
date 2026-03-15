# Wordy

A Wordle clone where you can challenge friends by sharing a link with an embedded word.

**Play at [wordy.marn.dev](https://wordy.marn.dev)**

## Features

- Classic Wordle gameplay — guess the 5-letter word in 6 tries
- Challenge friends — pick a word and share a link (word is base64-encoded in the URL)
- Web Share API support on mobile (iOS/Android share sheet)
- Light and dark mode (follows system preference)
- Dictionary validation with ~13k valid words — challenges can use non-dictionary words too
- Fully static — no backend required

## Development

```bash
npm install
npm run dev       # local dev server with HTTPS (for testing share/clipboard APIs)
```

## Deploy (optional)

```bash
npm run deploy    # builds and deploys to Cloudflare Pages
```

## Stack

TypeScript, Vite, Cloudflare Pages
