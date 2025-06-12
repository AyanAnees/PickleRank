const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Check for service account files
const prodKeyPath = path.join(__dirname, '..', 'serviceAccountKey.json');
const qaKeyPath = path.join(__dirname, '..', 'serviceAccountKey.qa.json');

if (!fs.existsSync(prodKeyPath)) {
  console.error('Production service account key not found at:', prodKeyPath);
  console.error('Please download it from Firebase Console > Project Settings > Service Accounts');
  process.exit(1);
}

if (!fs.existsSync(qaKeyPath)) {
  console.error('QA service account key not found at:', qaKeyPath);
  console.error('Please download it from Firebase Console > Project Settings > Service Accounts');
  process.exit(1);
}

const serviceAccountProd = require(prodKeyPath);
const serviceAccountQA = require(qaKeyPath);

// Initialize Firebase Admin SDK for production
const prodApp = admin.initializeApp({
  credential: admin.credential.cert(serviceAccountProd)
}, 'prod');

// Initialize Firebase Admin SDK for QA
const qaApp = admin.initializeApp({
  credential: admin.credential.cert(serviceAccountQA)
}, 'qa');

const prodAuth = prodApp.auth();
const qaAuth = qaApp.auth();

async function migrateUsers() {
  try {
    console.log('Starting user migration from production to QA...');
    
    // Get all users from production
    const listUsersResult = await prodAuth.listUsers();
    console.log(`Found ${listUsersResult.users.length} users to migrate`);

    // Migrate each user
    for (const user of listUsersResult.users) {
      try {
        // Create user in QA with the same UID
        await qaAuth.createUser({
          uid: user.uid,
          email: user.email,
          phoneNumber: user.phoneNumber,
          displayName: user.displayName,
          photoURL: user.photoURL,
          disabled: user.disabled,
          emailVerified: user.emailVerified,
          metadata: user.metadata,
          providerData: user.providerData,
          customClaims: user.customClaims
        });

        // If user has a password, set it in QA
        if (user.passwordHash) {
          await qaAuth.updateUser(user.uid, {
            passwordHash: user.passwordHash,
            passwordSalt: user.passwordSalt
          });
        }

        console.log(`Successfully migrated user: ${user.uid}`);
      } catch (error) {
        console.error(`Error migrating user ${user.uid}:`, error);
      }
    }

    console.log('User migration completed!');
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    // Clean up
    await prodApp.delete();
    await qaApp.delete();
  }
}

migrateUsers().catch(console.error); 