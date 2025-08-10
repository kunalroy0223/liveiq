// src/config/firebase_config.js

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyAV9QeSGyGlDx5wN5wRSkJ4yVC7eLwTwPM",
  authDomain: "liveiq-f0511.firebaseapp.com",
  projectId: "liveiq-f0511",
  storageBucket: "liveiq-f0511.appspot.com",
  messagingSenderId: "43152650655",
  appId: "1:43152650655:web:a05748b22de5e27bce4daa",
  measurementId: "G-YH8NDSS7P3"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Make db accessible globally
window.db = db;
