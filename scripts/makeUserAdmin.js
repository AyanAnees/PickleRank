const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function makeUserAdmin(phoneNumber) {
  try {
    console.log(`🔍 Searching for user with phone number: ${phoneNumber}`);
    
    // Find user by phone number
    const usersSnapshot = await db.collection('users').where('phoneNumber', '==', phoneNumber).get();
    
    if (usersSnapshot.empty) {
      console.error(`❌ No user found with phone number: ${phoneNumber}`);
      process.exit(1);
    }
    
    const userDoc = usersSnapshot.docs[0];
    const userId = userDoc.id;
    const userData = userDoc.data();
    
    console.log(`👤 Found user: ${userData.displayName || userData.firstName + ' ' + userData.lastName} (ID: ${userId})`);
    
    if (userData.isAdmin) {
      console.log(`✅ User is already an admin!`);
      process.exit(0);
    }
    
    // Update user to be admin
    await userDoc.ref.update({
      isAdmin: true,
      updatedAt: new Date().toISOString()
    });
    
    console.log(`🎉 Successfully granted admin privileges to ${userData.displayName || userData.firstName + ' ' + userData.lastName}!`);
    
  } catch (error) {
    console.error('❌ Error making user admin:', error);
    process.exit(1);
  }
}

// Get phone number from command line arguments
const phoneNumber = process.argv[2];

if (!phoneNumber) {
  console.error('Usage: node scripts/makeUserAdmin.js <phone_number>');
  console.error('Example: node scripts/makeUserAdmin.js +15856831831');
  process.exit(1);
}

makeUserAdmin(phoneNumber).then(() => {
  console.log('✅ Script completed successfully!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
}); 