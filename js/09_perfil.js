import { auth, db } from './12_firebase-config.js';
import { onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- Elementos do DOM ---
const txtPerfilNome = document.getElementById('txt-perfil-nome');
const txtPerfilEmail = document.getElementById('txt-perfil-email');
const txtPerfilData = document.getElementById('txt-perfil-data');
const imgPerfilAvatar = document.getElementById('perfil-avatar');
const tagAdminStatus = document.getElementById('tag-admin-status');

// Elementos das Estatísticas
const numLivrosLidos = document.getElementById('num-livros-lidos');
const numPaginasLidas = document.getElementById('num-paginas-lidas');
const numClubesParticipando = document.getElementById('num-clubes-participando');
const listaGenerosTags = document.getElementById('lista-generos-tags');

// Elementos do Formulário de Edição
const formEditarPerfil = document.getElementById('form-editar-perfil');
const inputNome = document.getElementById('input-nome');
const inputUsername = document.getElementById('input-username');
const inputBio = document.getElementById('input-bio');
const inputLivroFavorito = document.getElementById('input-livro-favorito');
const inputAvatar = document.getElementById('input-avatar');

let usuarioAtual = null;

// --- Monitorar Estado da Autenticação ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        usuarioAtual = user;
        txtPerfilEmail.textContent = user.email;

        // Se o usuário já tiver foto de perfil cadastrada no Auth
        if (user.photoURL) {
            imgPerfilAvatar.src = user.photoURL;
        }

        // Buscar dados complementares no Firestore
        await carregarDadosFirestore(user.uid);
    } else {
        // Redireciona para o login caso tente acessar sem estar logado
        window.location.href = '../html/01_login.html';
    }
});

// --- Carregar Dados do Firestore ---
async function carregarDadosFirestore(uid) {
    try {
        const userDocRef = doc(db, "usuarios", uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            const dados = userDocSnap.data();

            // Preenche o cabeçalho e inputs de texto
            txtPerfilNome.textContent = dados.nome || "Usuário sem nome";
            inputNome.value = dados.nome || "";
            inputUsername.value = dados.username ? dados.username.replace('@', '') : "";
            inputBio.value = dados.bio || "";
            inputLivroFavorito.value = dados.livroFavorito || "";

            // Trata a data de criação da conta
            if (dados.createdAt) {
                const dataCriacao = dados.createdAt.toDate();
                const opcoesData = { year: 'numeric', month: 'long' };
                txtPerfilData.innerHTML = `<i class="fa-solid fa-calendar-days"></i> Membro desde ${dataCriacao.toLocaleDateString('pt-BR', opcoesData)}`;
            }

            // Exibe tag de criador/admin se aplicável
            if (dados.isCriador || dados.role === 'admin') {
                tagAdminStatus.classList.remove('hidden');
            }

            // Atualiza o painel de estatísticas do leitor
            numLivrosLidos.textContent = dados.totalLivrosLidos || 0;
            numPaginasLidas.textContent = dados.totalPaginasLidas || 0;
            numClubesParticipando.textContent = dados.totalClubes || 0;

            // Renderiza as tags de gêneros favoritos dinamicamente
            if (dados.generosFavoritos && dados.generosFavoritos.length > 0) {
                renderizarGeneros(dados.generosFavoritos);
            }

        } else {
            console.log("Nenhum documento encontrado para este usuário no Firestore.");
            txtPerfilNome.textContent = auth.currentUser.displayName || "Leitor";
        }
    } catch (error) {
        console.error("Erro ao buscar dados do Firestore:", error);
    }
}

// --- Renderizar Gêneros Literários ---
function renderizarGeneros(generos) {
    listaGenerosTags.innerHTML = '';
    generos.forEach(genero => {
        const span = document.createElement('span');
        span.className = 'tag-genero';
        span.textContent = genero;
        listaGenerosTags.appendChild(span);
    });
}

// --- Salvar Alterações do Perfil ---
formEditarPerfil.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!usuarioAtual) return;

    const btnSalvar = document.getElementById('btn-salvar-perfil');
    const textoOriginalBtn = btnSalvar.innerHTML;
    btnSalvar.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Salvando...`;
    btnSalvar.disabled = true;

    // Limpa o '@' inserido caso o usuário tenha digitado por engano
    const usernameTratado = `@${inputUsername.value.trim().replace('@', '')}`;

    const novosDados = {
        nome: inputNome.value.trim(),
        username: usernameTratado,
        bio: inputBio.value.trim(),
        livroFavorito: inputLivroFavorito.value.trim()
    };

    try {
        // 1. Atualiza no Firebase Auth
        await updateProfile(usuarioAtual, {
            displayName: novosDados.nome
        });

        // 2. Atualiza no Firestore
        const userDocRef = doc(db, "usuarios", usuarioAtual.uid);
        await updateDoc(userDocRef, novosDados);

        // 3. Atualiza a interface local
        txtPerfilNome.textContent = novosDados.nome;

        alert("Perfil atualizado com sucesso! ✨");
    } catch (error) {
        console.error("Erro ao atualizar perfil:", error);
        alert("Ocorreu um erro ao salvar as alterações.");
    } finally {
        btnSalvar.innerHTML = textoOriginalBtn;
        btnSalvar.disabled = false;
    }
});

// --- Upload de Foto de Perfil (Opcional - Pré-visualização local básica) ---
inputAvatar.addEventListener('change', (e) => {
    const arquivo = e.target.files[0];
    if (arquivo) {
        // Cria uma URL temporária para exibir a imagem na hora
        const urlTemp = URL.createObjectURL(arquivo);
        imgPerfilAvatar.src = urlTemp;
    }
});