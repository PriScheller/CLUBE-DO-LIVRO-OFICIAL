// 1. IMPORTANDO O AUTH DO NOSSO ARQUIVO DE CONFIGURAÇÃO E AS FUNÇÕES DO FIREBASE
import { auth } from "../js/firebase-config.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- LÓGICA VISUAL DAS ABAS ---
const tabLogin = document.getElementById('tab-login');
const tabCadastro = document.getElementById('tab-cadastro');
const formLogin = document.getElementById('form-login');
const formCadastro = document.getElementById('form-cadastro');

tabLogin.addEventListener('click', () => {
    console.log("Aba Entrar clicada!");
    tabLogin.classList.add('active');
    tabCadastro.classList.remove('active');
    formLogin.classList.remove('d-none');
    formCadastro.classList.add('d-none');
});

tabCadastro.addEventListener('click', () => {
    console.log("Aba Criar Conta clicada!");
    tabCadastro.classList.add('active');
    tabLogin.classList.remove('active');
    formCadastro.classList.remove('d-none');
    formLogin.classList.add('d-none');
});

// --- LÓGICA DE CADASTRO REAL NO FIREBASE ---
formCadastro.addEventListener('submit', (e) => {
    e.preventDefault();

    const email = document.getElementById('cadastro-email').value;
    const senha = document.getElementById('cadastro-senha').value;
    const confirmarSenha = document.getElementById('cadastro-confirmar').value;

    if (senha !== confirmarSenha) {
        alert("As senhas não coincidem! Tente novamente.");
        return; 
    }

    createUserWithEmailAndPassword(auth, email, senha)
        .then((userCredential) => {
            alert("Conta criada com sucesso! Boas-vindas ao Clube!");
            formCadastro.reset(); 
            window.location.href = "dashboard.html";
        })
        .catch((error) => {
            console.error("Erro ao cadastrar:", error.message);
            alert("Erro ao criar conta: " + error.message);
        });
});

// --- LÓGICA DE LOGIN REAL NO FIREBASE ---
formLogin.addEventListener('submit', (e) => {
    e.preventDefault();

    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;

    signInWithEmailAndPassword(auth, email, senha)
        .then((userCredential) => {
            alert("Boas-vindas de volta ao seu cantinho de leitura! ☕");
            formLogin.reset();
            window.location.href = "dashboard.html";
        })
        .catch((error) => {
            console.error("Erro ao entrar:", error.code);
            
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
                alert("E-mail ou senha incorretos. Dê uma espiadinha e tente de novo!");
            } else {
                alert("Ops! Ocorreu um erro ao tentar entrar: " + error.message);
            }
        });
});