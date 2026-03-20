// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCPvARxqmMOzT6FT6lHnS9stPTLyI18UFc",
  authDomain: "crypto-bot-98ecc.firebaseapp.com",
  projectId: "crypto-bot-98ecc",
  storageBucket: "crypto-bot-98ecc.firebasestorage.app",
  messagingSenderId: "433037231934",
  appId: "1:433037231934:web:a4c1bb3552ddbc12b6ce6f",
  measurementId: "G-0XSNBCQW27"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
import { getFirestore } from "firebase/firestore";
export const db = getFirestore(app);