// 1. IMPORTANDO O AUTH, DB E AS FUNÇÕES NECESSÁRIAS DO FIREBASE
import { auth, db } from "../js/firebase-config.js";
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    updateProfile 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- LÓGICA VISUAL DAS ABAS ---
const tabLogin = document.getElementById('tab-login');
const tabCadastro = document.getElementById('tab-cadastro');
const formLogin = document.getElementById('form-login');
const formCadastro = document.getElementById('form-cadastro');

if (tabLogin && tabCadastro && formLogin && formCadastro) {
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
}

// --- FUNÇÃO AUXILIAR PARA GERAR USERNAME AUTOMÁTICO ---
function gerarUsernameAutomatico(nomeCompleto) {
    // Pega o primeiro nome, transforma em minúsculo e remove espaços/acentos básicos
    const primeiroNome = nomeCompleto.trim().split(" ")[0].toLowerCase();
    const nomeLimpo = primeiroNome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    // Gera um sufixo numérico de 3 dígitos para evitar duplicidade pura
    const numeroAleatorio = Math.floor(100 + Math.random() * 900);
    return `${nomeLimpo}${numeroAleatorio}`;
}

// --- LÓGICA DE CADASTRO REAL NO FIREBASE ---
if (formCadastro) {
    formCadastro.addEventListener('submit', (e) => {
        e.preventDefault();

        // Captura todos os dados, incluindo o novo campo de username escolhido
        const nome = document.getElementById('cadastro-nome').value;
        const usernameEscolhido = document.getElementById('cadastro-username').value; // Novo campo!
        const email = document.getElementById('cadastro-email').value;
        const senha = document.getElementById('cadastro-senha').value;
        const confirmarSenha = document.getElementById('cadastro-confirmar').value;

        if (senha !== confirmarSenha) {
            alert("As senhas não coincidem! Tente novamente.");
            return; 
        }

        // Tratamento rigoroso do username escolhido pelo usuário:
        // Transforma em minúsculo, remove espaços, remove o '@' se digitado e limpa acentos
        const usernameTratado = usernameEscolhido
            .trim()
            .toLowerCase()
            .replace('@', '')
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9_.]/g, ""); // Permite apenas letras, números, pontos ou underlines

        if (!usernameTratado) {
            alert("Por favor, digite um nome de usuário válido contendo apenas letras ou números.");
            return;
        }

        let usuarioCriado = null;
        const btnSubmit = formCadastro.querySelector('button[type="submit"]');

        if(btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = 'Criando sua conta... <i class="fa-solid fa-spinner fa-spin"></i>';
        }

        createUserWithEmailAndPassword(auth, email, senha)
            .then((userCredential) => {
                usuarioCriado = userCredential.user;
                
                // 1. Salva o Nome no perfil nativo do Firebase Auth
                return updateProfile(usuarioCriado, {
                    displayName: nome
                });
            })
            .then(() => {
                // 2. Grava o documento no Firestore usando o USERNAME TRATADO que ele mesmo escolheu
                return setDoc(doc(db, "usuarios", usuarioCriado.uid), {
                    uid: usuarioCriado.uid,
                    nome: nome.trim(),
                    username: usernameTratado, // Grava a escolha real dele!
                    email: email.trim(),
                    dataCadastro: new Date().toLocaleDateString('pt-BR')
                });
            })
            .then(() => {
                alert("Conta criada com sucesso! Boas-vindas ao Clube! ✨");
                formCadastro.reset(); 
                window.location.href = "dashboard.html";
            })
            .catch((error) => {
                console.error("Erro ao cadastrar:", error.message);
                
                // Tratamento amigável para e-mails duplicados comuns em teste
                if (error.code === 'auth/email-already-in-use') {
                    alert("Este e-mail já está sendo utilizado por outra conta.");
                } else {
                    alert("Erro ao criar conta: " + error.message);
                }
            })
            .finally(() => {
                if(btnSubmit) {
                    btnSubmit.disabled = false;
                    btnSubmit.innerHTML = 'Criar Conta';
                }
            });
    });
}

// --- LÓGICA DE LOGIN REAL NO FIREBASE ---
if (formLogin) {
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
}