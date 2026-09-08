/**
 * 97 NULL - Connected Firebase Configuration
 */

const firebaseConfig = {
  apiKey: "AIzaSyB25OOykUWhLZis3KCCnBOuxjgFdmWDa84",
  authDomain: "club-4fcb9.firebaseapp.com",
  projectId: "club-4fcb9",
  storageBucket: "club-4fcb9.firebasestorage.app",
  messagingSenderId: "355457810372",
  appId: "1:355457810372:web:4efb6a516c3a4a97f56e91",
  measurementId: "G-RJ1DNEMCHW",
  databaseURL: "https://club-4fcb9-default-rtdb.firebaseio.com"
};

// Cloud sync function to push user records directly to Firebase Realtime DB / REST API
async function syncUserToFirebase(userData) {
  try {
    const endpoint = `https://club-4fcb9-default-rtdb.firebaseio.com/users/${userData.id}.json`;
    const res = await fetch(endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    console.log('[Firebase] Cloud sync status:', res.status, 'for user:', userData.id);
  } catch (error) {
    console.warn('[Firebase] Sync notice:', error.message);
  }
}

window.firebaseConfig = firebaseConfig;
window.syncUserToFirebase = syncUserToFirebase;
