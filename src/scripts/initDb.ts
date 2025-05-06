const { db } = require('../lib/firebase');
const { collection, addDoc, Timestamp } = require('firebase/firestore');

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