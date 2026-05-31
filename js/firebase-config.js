// 1. IMPORTANDO AS FUNÇÕES DO FIREBASE VIA CDN (Links completos para a Web)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// 2. SUAS CREDENCIAIS EXCLUSIVAS (Mantive as suas credenciais certinhas!)
const firebaseConfig = {
  apiKey: "AIzaSyBLbovIWFNDsktMJTppqhhwCKlBx17VITw",
  authDomain: "clube-do-livro-oficial.firebaseapp.com",
  projectId: "clube-do-livro-oficial",
  storageBucket: "clube-do-livro-oficial.firebasestorage.app",
  messagingSenderId: "564871657033",
  appId: "1:564871657033:web:77de1e6bb86faa9ed87198",
  measurementId: "G-TC0F45KHGZ"
};

// 3. INICIALIZANDO O APP E O MÓDULO DE AUTENTICAÇÃO
const app = initializeApp(firebaseConfig);
const auth = getAuth(app); // <-- Aqui nós criamos o 'auth' que estava faltando!

// 4. EXPORTANDO O 'AUTH' PARA O SEU ARQUIVO AUTH.JS
export { auth };