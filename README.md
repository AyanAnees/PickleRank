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

## Project Goals & Requirements

**PickleRank** is a fun, mobile-first app for tracking internal pickleball rankings among friends. Below are the current goals and requirements for the project:

### Core Features
- **Authentication:**
  - Sign in with phone number and verification code.
  - User account persists across devices.
- **User Registration:**
  - First-time users must provide first and last name.
  - Returning users skip registration.
- **Footer:**
  - Present on all pages except the rankings explanation page.
- **Game Entry:**
  - Any user can enter game results, including teams and scores.
  - Game entry displays teams, score, winner, date/time, and who entered it.
- **Seasons:**
  - Each season lasts 2 months.
  - Rankings reset at the start of each season.
  - Users can view past seasons' games and leaderboards.
- **Admin Controls:**
  - Admins can update or delete games.
  - Admin status toggled via user ID.
- **Elo System:**
  - Elo recalculates if games are edited or deleted.
  - Elo is only displayed after a player has played 5 games.
- **Match History:**
  - Show last 10 games by default, with "see more" to load additional history.
- **Design:**
  - User-friendly, intuitive, robust design (not over-engineered).
  - Mobile-first UI using Tailwind CSS.
- **Hosting & Backend:**
  - Firebase Firestore backend.
  - Hosted on Vercel.
- **Database Tables:**
  - Current: `games`, `seasons`, `users` (expandable as needed).

---

*For any future features or changes, please update this section to keep project goals clear for all contributors.* 