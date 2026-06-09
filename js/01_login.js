// 1. Importando as dependências do Firebase e configurações globais
import { auth, db } from "./12_firebase-config.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- LÓGICA VISUAL DAS ABAS ---
const tabLogin = document.getElementById('tab-login');
const tabCadastro = document.getElementById('tab-cadastro');
const formLogin = document.getElementById('form-login');
const formCadastro = document.getElementById('form-cadastro');

if (tabLogin && tabCadastro && formLogin && formCadastro) {
    tabLogin.addEventListener('click', () => {
        tabLogin.classList.add('active');
        tabCadastro.classList.remove('active');
        formLogin.classList.remove('d-none');
        formCadastro.classList.add('d-none');
    });

    tabCadastro.addEventListener('click', () => {
        tabCadastro.classList.add('active');
        tabLogin.classList.remove('active');
        formCadastro.classList.remove('d-none');
        formLogin.classList.add('d-none');
    });
}

// --- LÓGICA DE CADASTRO NO FIREBASE ---
if (formCadastro) {
    formCadastro.addEventListener('submit', (e) => {
        e.preventDefault();

        const nome = document.getElementById('cadastro-nome').value;
        const usernameEscolhido = document.getElementById('cadastro-username').value;
        const email = document.getElementById('cadastro-email').value;
        const senha = document.getElementById('cadastro-senha').value;
        const confirmarSenha = document.getElementById('cadastro-confirmar').value;

        if (senha !== confirmarSenha) {
            alert("As senhas não coincidem! Tente novamente.");
            return;
        }

        // Sanitização e tratamento do username
        const usernameTratado = usernameEscolhido
            .trim()
            .toLowerCase()
            .replace('@', '')
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9_.]/g, "");

        if (!usernameTratado) {
            alert("Por favor, digite um nome de usuário válido contendo apenas letras, números, pontos ou underlines.");
            return;
        }

        let usuarioCriado = null;
        const btnSubmit = formCadastro.querySelector('button[type="submit"]');

        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = 'Criando sua conta...';
        }

        createUserWithEmailAndPassword(auth, email, senha)
            .then((userCredential) => {
                usuarioCriado = userCredential.user;

                // 1. Atualiza o nome de exibição no Auth nativo
                return updateProfile(usuarioCriado, {
                    displayName: nome.trim()
                });
            })
            .then(() => {
                // 2. Registra os dados complementares customizados no Firestore
                return setDoc(doc(db, "usuarios", usuarioCriado.uid), {
                    uid: usuarioCriado.uid,
                    nome: nome.trim(),
                    username: usernameTratado,
                    email: email.trim(),
                    dataCadastro: new Date().toLocaleDateString('pt-BR')
                });
            })
            .then(() => {
                alert("Conta criada com sucesso! Boas-vindas ao Clube! ✨");
                formCadastro.reset();
                window.location.href = "../html/02_dashboard.html";
            })
            .catch((error) => {
                console.error("Erro ao cadastrar:", error.message);
                if (error.code === 'auth/email-already-in-use') {
                    alert("Este e-mail já está sendo utilizado por outra conta.");
                } else {
                    alert("Erro ao criar conta: " + error.message);
                }
            })
            .finally(() => {
                if (btnSubmit) {
                    btnSubmit.disabled = false;
                    btnSubmit.innerHTML = 'Criar Conta';
                }
            });
    });
}

// --- LÓGICA DE LOGIN NO FIREBASE ---
if (formLogin) {
    formLogin.addEventListener('submit', (e) => {
        e.preventDefault();

        const email = document.getElementById('login-email').value;
        const senha = document.getElementById('login-senha').value;

        signInWithEmailAndPassword(auth, email, senha)
            .then(() => {
                alert("Boas-vindas de volta ao seu cantinho de leitura! ☕");
                formLogin.reset();
                window.location.href = "../html/02_dashboard.html";
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
}