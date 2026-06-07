import { db, auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, addDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================================================
// ELEMENTOS DO DOM (TODOS INCLUÍDOS)
// ==========================================================================
const modalCriar = document.getElementById('modal-criar-clube');
const btnAbrirCriar = document.getElementById('btn-abrir-criar');
const btnFecharCriar = document.getElementById('btn-fechar-criar');
const formCriarClube = document.querySelector('#modal-criar-clube .modal-form');

const selectGenero = document.getElementById('genero-clube');
const grupoGeneroOutro = document.getElementById('grupo-genero-outro');
const inputGeneroOutro = document.getElementById('genero-clube-outro');
const selectPrivacidade = document.getElementById('clube-privacidade');

const gridClubes = document.getElementById('grid-clubes-leitura');

let usuarioLogadoUid = null;

// ==========================================================================
// MONITOR DE AUTENTICAÇÃO E LÓGICA DE GÊNERO
// ==========================================================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        usuarioLogadoUid = user.uid;
        carregarClubesDoUsuario();
    } else {
        window.location.href = "login.html";
    }
});

// Lógica para mostrar/esconder o campo "Outro"
selectGenero?.addEventListener('change', (e) => {
    if (e.target.value === 'Outro') {
        grupoGeneroOutro.style.display = 'block';
        inputGeneroOutro.required = true;
    } else {
        grupoGeneroOutro.style.display = 'none';
        inputGeneroOutro.required = false;
        inputGeneroOutro.value = '';
    }
});

// ==========================================================================
// FUNÇÕES AUXILIARES
// ==========================================================================
function alternarModal(modal, abrir) {
    if (abrir) modal.classList.add('ativo');
    else modal.classList.remove('ativo');
}

function gerarCodigoConvite() {
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let resultado = '';
    for (let i = 0; i < 6; i++) {
        resultado += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    return resultado;
}

// ==========================================================================
// RENDERIZAÇÃO DINÂMICA
// ==========================================================================
async function carregarClubesDoUsuario() {
    if (!gridClubes || !usuarioLogadoUid) return;
    gridClubes.innerHTML = `<p style="text-align: center; color: #888;">Carregando seus clubes... ☕</p>`;

    try {
        const q = query(collection(db, "clubes"), where("membrosLista", "array-contains", usuarioLogadoUid));
        const querySnapshot = await getDocs(q);

        gridClubes.innerHTML = "";
        if (querySnapshot.empty) {
            gridClubes.innerHTML = `<p style="text-align: center; color: #5c4033;">Você ainda não participa de nenhum clube.</p>`;
            return;
        }

        querySnapshot.forEach((doc) => {
            const clube = doc.data();
            const idClube = doc.id;

            const card = document.createElement('div');
            card.className = 'clube-card';
            card.innerHTML = `
                <div class="clube-card-header">
                    <span class="clube-tag">📖 ${clube.genero || 'Geral'}</span>
                    <span class="clube-membros-count"><i class="fa-solid fa-user-group"></i> ${clube.membrosLista?.length || 0}</span>
                </div>
                <div class="clube-card-body">
                    <h4>${clube.nome}</h4>
                    <p class="clube-descricao">${clube.descricao}</p>
                    <button class="btn-entrar-clube" data-id="${idClube}">Acessar Painel</button>
                </div>
            `;

            card.querySelector('.btn-entrar-clube').addEventListener('click', () => {
                window.location.href = `clube-interno.html?id=${idClube}`;
            });

            gridClubes.appendChild(card);
        });
    } catch (error) {
        console.error("Erro ao carregar clubes:", error);
    }
}

// ==========================================================================
// CRIAÇÃO DE CLUBE
// ==========================================================================
btnAbrirCriar?.addEventListener('click', () => alternarModal(modalCriar, true));
btnFecharCriar?.addEventListener('click', () => alternarModal(modalCriar, false));

if (formCriarClube) {
    formCriarClube.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nome = document.getElementById('nome-clube').value.trim();
        const descricao = document.getElementById('desc-clube').value.trim();
        const selecaoGenero = selectGenero.value;
        const privacidade = selectPrivacidade.value;

        // Regra do Gênero: Se "Outro", pega do input text, senão pega do select
        const generoFinal = selecaoGenero === 'Outro' ? inputGeneroOutro.value.trim() : selecaoGenero;

        const novoClubeDados = {
            nome: nome,
            descricao: descricao || "Sem descrição.",
            genero: generoFinal,
            codigoConvite: gerarCodigoConvite(),
            adminUid: usuarioLogadoUid,
            membrosLista: [usuarioLogadoUid],
            privacidade: privacidade,
            solicitacoesPendentes: [],
            dataCriacao: new Date().toLocaleDateString('pt-BR'),
            livroAtual: { titulo: "Nenhum livro em leitura", capaUrl: "https://placehold.co/40x60/fff0f2/5c4033?text=📖" }
        };

        try {
            await addDoc(collection(db, "clubes"), novoClubeDados);
            alert("Clube criado com sucesso!");
            formCriarClube.reset();
            grupoGeneroOutro.style.display = 'none'; // Esconde campo extra
            alternarModal(modalCriar, false);
            carregarClubesDoUsuario();
        } catch (error) {
            console.error("Erro ao salvar:", error);
            alert("Erro ao criar clube.");
        }
    });
}

// ==========================================================================
// SISTEMA DE PESQUISA (FILTRO EM TEMPO REAL)
// ==========================================================================
const inputBusca = document.getElementById('input-busca-clube');
const msgSemResultados = document.getElementById('msg-sem-resultados');

if (inputBusca) {
    // Escuta tanto a digitação quanto qualquer tentativa de "Enter"
    inputBusca.addEventListener('input', (e) => {
        const termoBusca = e.target.value.toLowerCase().trim();
        const cards = document.querySelectorAll('.clube-card');
        let contadorVisiveis = 0;

        cards.forEach(card => {
            const nomeClube = card.querySelector('h4').textContent.toLowerCase();
            // Verificação de segurança caso o gênero não esteja presente
            const tagGenero = card.querySelector('.clube-tag');
            const generoClube = tagGenero ? tagGenero.textContent.toLowerCase() : "";

            if (nomeClube.includes(termoBusca) || generoClube.includes(termoBusca)) {
                card.style.display = "block";
                contadorVisiveis++;
            } else {
                card.style.display = "none";
            }
        });

        // Feedback visual
        if (msgSemResultados) {
            msgSemResultados.style.display = (contadorVisiveis === 0 && cards.length > 0) ? "block" : "none";
        }
    });
}