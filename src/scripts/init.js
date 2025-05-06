require('dotenv').config({ path: '.env.local' });
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, Timestamp } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyCcsEY9DUd8eM3LNm5AIji0QRP0XUM8IL4",
  authDomain: "picklerank-6c246.firebaseapp.com",
  projectId: "picklerank-6c246",
  storageBucket: "picklerank-6c246.firebasestorage.app",
  messagingSenderId: "53751825189",
  appId: "1:53751825189:web:4ac67bd9ea905ce8ea10cc",
  measurementId: "G-DZBYVGCC5F"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function initializeDatabase() {
  try {
    // Create a test season
    const seasonsRef = collection(db, 'seasons');
    const now = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 3); // 3 months from now

    const season = await addDoc(seasonsRef, {
      name: 'Season 1',
      startDate: Timestamp.fromDate(now),
      endDate: Timestamp.fromDate(endDate),
      createdAt: Timestamp.now()
    });

    console.log('Database initialized successfully!');
    console.log('Created test season with ID:', season.id);
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

// Run the initialization
initializeDatabase(); 