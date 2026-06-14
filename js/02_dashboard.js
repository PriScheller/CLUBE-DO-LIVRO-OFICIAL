// 1. IMPORTANDO AS CONFIGURAÇÕES E AS FUNÇÕES DE AUTENTICAÇÃO DO FIREBASE
import { auth } from "./12_firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Selecionando os elementos da página de forma segura
const userDisplayName = document.getElementById('user-display-name');
const btnLogout = document.getElementById('btn-logout');

// 2. MONITORANDO EM TEMPO REAL SE O USUÁRIO ESTÁ LOGADO OU NÃO
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Se o usuário tiver um displayName (nome completo) salvo, exibe ele, senão exibe o email
        const identificadorUsuario = user.displayName || user.email;
        if (userDisplayName) {
            userDisplayName.textContent = `Olá, ${identificadorUsuario} ✨`;
        }
    } else {
        // Proteção de rota: se tentar acessar sem logar, barra e joga de volta
        alert("Acesso negado! Por favor, faça login primeiro.");
        window.location.href = "../html/01_login.html";
    }
});

// 3. LÓGICA DO BOTÃO DE LOGOUT (SAIR)
if (btnLogout) {
    btnLogout.addEventListener('click', () => {
        signOut(auth)
            .then(() => {
                alert("Você saiu do Clube. Até a próxima leitura! ☕");
                window.location.href = "../html/01_login.html";
            })
            .catch((error) => {
                alert("Erro ao deslogar: " + error.message);
            });
    });
}