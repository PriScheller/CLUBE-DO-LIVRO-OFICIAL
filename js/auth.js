// 1. IMPORTANDO O AUTH DO NOSSO ARQUIVO DE CONFIGURAÇÃO E AS FUNÇÕES DO FIREBASE
import { auth } from "../js/firebase-config.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

/// --- LOGICA VISUAL DAS ABAS ---
const tabLogin = document.getElementById('tab-login');
const tabCadastro = document.getElementById('tab-cadastro');
const formLogin = document.getElementById('form-login');
const formCadastro = document.getElementById('form-cadastro');

tabLogin.addEventListener('click', () => {
    console.log("Aba Entrar clicada!"); // Aparecerá no Inspecionar
    tabLogin.classList.add('active');
    tabCadastro.classList.remove('active');
    formLogin.classList.remove('d-none');
    formCadastro.classList.add('d-none');
});

tabCadastro.addEventListener('click', () => {
    console.log("Aba Criar Conta clicada!"); // Aparecerá no Inspecionar
    tabCadastro.classList.add('active');
    tabLogin.classList.remove('active');
    formCadastro.classList.remove('d-none');
    formLogin.classList.add('d-none');
});


// --- LÓGICA DE CADASTRO REAL NO FIREBASE ---
formCadastro.addEventListener('submit', (e) => {
    e.preventDefault(); // Impede a página de recarregar ao enviar o formulário

    // Capturando os dados digitados pelo usuário nos campos de cadastro
    const email = document.getElementById('cadastro-email').value;
    const senha = document.getElementById('cadastro-senha').value;
    const confirmarSenha = document.getElementById('cadastro-confirmar').value;

    // Validação simples: as senhas precisam ser iguais
    if (senha !== confirmarSenha) {
        alert("As senhas não coincidem! Tente novamente.");
        return; 
    }

    // Função mágica do Firebase que cria o usuário na nuvem
    createUserWithEmailAndPassword(auth, email, senha)
        .then((userCredential) => {
            alert("Conta criada com sucesso! Boas-vindas ao Clube!");
            formCadastro.reset(); 
            
            // REDIRECIONAMENTO: Move o usuário para a página do painel
            window.location.href = "dashboard.html";
        })
        .catch((error) => {
            console.error("Erro ao cadastrar:", error.message);
            alert("Erro ao criar conta: " + error.message);
        });
});