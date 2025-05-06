# PickleRank 🏓

A modern, mobile-first application for tracking and ranking pickleball players using an ELO rating system.

## Features

- 🔐 Google Authentication
- 📱 Mobile-first design
- 🏆 ELO-based ranking system
- 📊 Game score tracking
- 👥 Player management
- 👑 Admin controls
- 📈 Player statistics and history

## Tech Stack

- Next.js 14
- TypeScript
- Tailwind CSS
- Firebase (Authentication & Database)
- ELO Rating System

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up Firebase:
   - Create a new Firebase project
   - Enable Authentication (Google)
   - Set up Firestore Database
   - Add your Firebase configuration to `.env.local`

4. Run the development server:
   ```bash
   npm run dev
   ```

## Environment Variables

Create a `.env.local` file with the following variables:

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

## Contributing

Feel free to submit issues and enhancement requests! 