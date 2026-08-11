import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCoFNWDXmC1R_AjP9cJutPs-DKpNlgq1fc",
  projectId: "poltroplay",
  storageBucket: "poltroplay.firebasestorage.app",
  messagingSenderId: "1026546614926",
  appId: "1:1026546614926:web:d7a8b9c0d1e2f3a4b5c6d7", // Placeholder for web
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
