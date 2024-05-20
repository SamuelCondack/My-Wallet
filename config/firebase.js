import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from 'firebase/auth'

const firebaseConfig = {
  apiKey: "AIzaSyCJuj4ZNwI2SYfN-UQTv7mtkZ2BqrbFT2w",
  authDomain: "backendapp-38e8d.firebaseapp.com",
  projectId: "backendapp-38e8d",
  storageBucket: "backendapp-38e8d.appspot.com",
  messagingSenderId: "378033328678",
  appId: "1:378033328678:web:1b4abf8d7acb203b864ce7",
  measurementId: "G-L8EGQ4NX9F"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()