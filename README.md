# موقفي - Mawqifi

تطبيق لمشاركة مواقف السيارات المتاحة - A parking spot sharing app

## Features

- 🌐 Arabic RTL support
- 📱 Mobile-first responsive design
- ⏰ Realtime countdown timers for parking spots
- ➕ Create and delete parking posts
- 💾 Local storage for data persistence
- 🚀 PWA support for offline use
- ⚡ Fast loading with Next.js 14

## Tech Stack

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Lucide Icons
- PWA (next-pwa)

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
```

### Production

```bash
npm start
```

## Deployment

This app is ready for Vercel deployment:

1. Push your code to GitHub
2. Import your repository in Vercel
3. Deploy!

## Usage

1. Click "إضافة موقف جديد" to add a new parking spot
2. Fill in the location, description, and duration
3. The post will appear with a countdown timer
4. Delete posts when they're no longer available

## Note

Currently uses local storage for data persistence. In production, you may want to integrate a backend service like Firebase or Supabase for real-time sync across devices.
