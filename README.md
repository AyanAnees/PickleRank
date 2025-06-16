# Pickleheads

Pickleheads is a pickleball web app used to rank players based on their game scores, opponents' ratings, and teammates' ratings.

## Quickstart

1. **Clone the repository**
   Open your terminal and run:
   ```
   git clone https://github.com/yourusername/Pickleheads.git
   cd Pickleheads
   ```

2. **Install dependencies**
   Run:
   ```
   npm install
   ```

3. **Set up environment variables**
   - Copy `.env.example` to `.env.local` for local development.
   - Fill in your Firebase credentials and other required variables.
   - Never commit real secrets or credentials.

4. **Run the development server**
   Run:
   ```
   npm run dev
   ```
   The app will be available at [http://localhost:3000](http://localhost:3000).

## Detailed Instructions

For detailed instructions on contributing, testing, and deployment, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Firebase Setup

- Obtain your Firebase credentials from the Firebase Console.
- Never commit real credentials or service account keys.
- For local development, use Firebase Emulator Suite.

## License

This project is licensed under the MIT License.

# PickleRank 🏓

A modern, mobile-first application for tracking and ranking pickleball players using an ELO rating system.

## Features

- 🔐 Google Authentication
- 📱 Mobile-first design
- 🏆 ELO-based ranking system (with margin of victory)
- 📊 Game score tracking
- 👥 Player management
- 👑 Admin controls
- 📈 Player statistics and history
- 🎯 ELO change displayed for each game
- 🕒 Clean, mobile-friendly match history UI

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

## Recent Updates

- **ELO System:** ELO now factors in the margin of victory (score difference) for each game, not just win/loss.
- **Game History UI:** 
  - Teams are displayed in a stacked, modern format with a clear winner highlight and trophy.
  - ELO change for each game is shown as a subtle badge under the score.
  - Date/timestamp is tiny and left-aligned at the bottom of each game card for mobile-friendliness.
- **User ELO Sync:** The top-level `elo` field in each user document is always kept in sync with their current season ELO for future features like matchmaking.
- **Scripts:**
  - `scripts/recalculateElos.js`: Recalculates all ELOs for a season, updates rankings, user ELOs, and each game's `eloChange` field.
  - `scripts/syncUserElos.js`: Syncs all users' top-level `elo` field to match their current ELO in the active season's rankings.
- **Admin Controls:** Admins (by phone number) can edit or delete games.

## How ELO Works

- ELO is updated after every game, factoring in both win/loss and the margin of victory.
- Editing or deleting a game triggers a full season ELO recalculation for all players and updates all affected game `eloChange` values.
- ELO change is displayed for each game in match history.

## Scripts

- **Recalculate ELOs:**  
  Run `node scripts/recalculateElos.js <seasonId>` to recalculate all ELOs, update rankings, user ELOs, and each game's `eloChange`.
- **Sync User ELOs:**  
  Run `node scripts/syncUserElos.js` to sync all users' top-level `elo` field to their current ELO in the active season.

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

## Future Ideas & Discussion

- **Shorten or Remove Games Played in Rankings:**
  - The current display of 'Games: X/X' can push the ELO value off to the side. Consider shortening, reformatting, or removing it for a cleaner look.

- **Gamify ELO/Ranking Progression:**
  - Consider rebranding ELO points to something more addictive and game-like (e.g., 'RR' as in Valorant) to make climbing the leaderboard more engaging.

- **Matchmaker Module:**
  - Add a 'Matchmaker' button under the Season title. This would open a module where users can select which players are present (via checkboxes), and the system suggests fair or randomized teams.
  - Possible parameters: most fair game (by ELO), most randomized, or based on match history (who has played with/against each other the least this season).
  - This could help balance games and keep things fresh and fun.

*These are ideas for future discussion and not yet implemented. Feel free to add, discuss, or refine further!* 
