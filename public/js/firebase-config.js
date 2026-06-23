import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js";

// Credenciais oficiais do projeto
const firebaseConfig = {
    apiKey: "AIzaSyCCquHW_OM6SPzex2Yef6Veqp5OOnAXnj4",
    authDomain: "date-perfeito-5925e.firebaseapp.com",
    projectId: "date-perfeito-5925e",
    storageBucket: "date-perfeito-5925e.firebasestorage.app",
    messagingSenderId: "958617736891",
    appId: "1:958617736891:web:d45e2a7f8b9b94b4ccfb9e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
