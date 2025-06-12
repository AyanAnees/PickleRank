# Contributing to Pickleheads

## Onboarding

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

## Environment and Deployment Setup

### Git Branch Workflow

- **main**: Production branch. No direct commits allowed.
- **qa**: Staging branch. Feature branches are merged here for testing.
- **feature/***: Create a new branch for each feature or bugfix.

### Vercel Deployment

1. **Link Vercel to GitHub**:
   - Go to [Vercel](https://vercel.com) and sign in.
   - Import your GitHub repository.
   - Configure the project settings:
     - **Production Branch**: `main`
     - **Preview Branch**: `qa`

2. **Environment Variables**:
   - In Vercel, go to your project settings.
   - Add environment variables for production and preview deployments.
   - Use `.env.production` for production and `.env.qa` for preview.

3. **Deployment Workflow**:
   - `main` is linked to production and deploys automatically on merge.
   - `qa` is linked to a preview deployment and auto-deploys on merge.
   - Only Awais can approve/merge from `qa` into `main`.

### QA Environment

- **Local Testing**: Use Firebase Auth Emulator or whitelisted test phone numbers in Firebase Console.
- **Test Phone Number**: Use a test phone number (e.g., `+15555550123`) and verification code (`123456`).
- Awais may be the only person with permissions to that, so reach out and ask.

### Seeding Test Data

- Use Firebase Emulator Suite for local testing.
- Run the seed script (if available & necessary) to populate Firestore with test data.

## Code Quality

- ESLint and Prettier are configured for code quality.
- Husky enforces pre-commit hooks.
- Write tests using Jest.

## GitHub Branch Protections

- No direct commits to `main` or `qa`.
- Require reviews for `qa`.
- Require your approval for `main`.
- Disallow force-push.

## Need Help?

- Contact Awais. 