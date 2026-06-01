import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// SUAS CREDENCIAIS DO FIREBASE (Mantenha as suas chaves aqui se forem diferentes!)
const firebaseConfig = {
  apiKey: "AIzaSyBLbovIWFNDsktMJTppqhhwCKlBx17VITw",
  authDomain: "clube-do-livro-oficial.firebaseapp.com",
  projectId: "clube-do-livro-oficial",
  storageBucket: "clube-do-livro-oficial.firebasestorage.app",
  messagingSenderId: "564871657033",
  appId: "1:564871657033:web:77de1e6bb86faa9ed87198",
  measurementId: "G-TC0F45KHGZ"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Inicializa os Serviços
const auth = getAuth(app);
const db = getFirestore(app); // <-- ESSA LINHA É CRUCIAL!

// EXPORTAÇÃO COMPLETA (Isso resolve o erro do console!)
export { auth, db };