// 1. IMPORTANDO AS CONFIGURAÇÕES E AS FUNÇÕES DE AUTENTICAÇÃO DO FIREBASE
import { auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Selecionando os elementos da página
const userDisplayName = document.getElementById('user-display-name');
const btnLogout = document.getElementById('btn-logout');

// 2. MONITORANDO EM TEMPO REAL SE O USUÁRIO ESTÁ LOGADO OU NÃO
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Se o usuário existir, mudamos o texto de "Carregando..." para o e-mail dele
        userDisplayName.textContent = `Olá, ${user.email}`;
    } else {
        // Se não houver usuário logado (tentou invadir o link direto), joga para o login
        alert("Acesso negado! Por favor, faça login primeiro.");
        window.location.href = "login.html";
    }
});

// 3. LÓGICA DO BOTÃO DE LOGOUT (SAIR)
btnLogout.addEventListener('click', () => {
    signOut(auth)
        .then(() => {
            alert("Você saiu do Clube. Até a próxima leitura! ☕");
            window.location.href = "login.html";
        })
        .catch((error) => {
            alert("Erro ao deslogar: " + error.message);
        });
});