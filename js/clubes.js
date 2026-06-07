import { db, auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, addDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================================================
// ELEMENTOS DO DOM
// ==========================================================================
const modalCriar = document.getElementById('modal-criar-clube');
const modalEntrar = document.getElementById('modal-entrar-clube');
const btnAbrirCriar = document.getElementById('btn-abrir-criar');
const btnAbrirEntrar = document.getElementById('btn-abrir-entrar');
const btnFecharCriar = document.getElementById('btn-fechar-criar');
const btnFecharEntrar = document.getElementById('btn-fechar-entrar');

const formCriarClube = document.querySelector('#modal-criar-clube .modal-form');
const selectGenero = document.getElementById('genero-clube');
const grupoGeneroOutro = document.getElementById('grupo-genero-outro');
const inputGeneroOutro = document.getElementById('genero-clube-outro');
// NOVO: Seleção de privacidade
const selectPrivacidade = document.getElementById('clube-privacidade');

const formEntrarClube = document.querySelector('#modal-entrar-clube .modal-form');
const gridClubes = document.getElementById('grid-clubes-leitura');

let usuarioLogadoUid = null;

// ==========================================================================
// MONITOR DE AUTENTICAÇÃO
// ==========================================================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        usuarioLogadoUid = user.uid;
        carregarClubesDoUsuario();
    } else {
        window.location.href = "login.html";
    }
});

// ==========================================================================
// CONTROLE EXIBIÇÃO DO CAMPO "OUTRO GÊNERO"
// ==========================================================================
selectGenero?.addEventListener('change', (e) => {
    if (e.target.value === 'Outro') {
        grupoGeneroOutro.style.display = 'flex';
        inputGeneroOutro.required = true;
        inputGeneroOutro.focus();
    } else {
        grupoGeneroOutro.style.display = 'none';
        inputGeneroOutro.required = false;
        inputGeneroOutro.value = '';
    }
});

// ==========================================================================
// GERENCIAMENTO DOS MODAIS (ABRIR / FECHAR)
// ==========================================================================
function alternarModal(modal, abrir) {
    if (abrir) {
        modal.classList.add('ativo');
    } else {
        modal.classList.remove('ativo');
    }
}

btnAbrirCriar?.addEventListener('click', () => alternarModal(modalCriar, true));
btnAbrirEntrar?.addEventListener('click', () => alternarModal(modalEntrar, true));
btnFecharCriar?.addEventListener('click', () => { alternarModal(modalCriar, false); limparFormularioCriar(); });
btnFecharEntrar?.addEventListener('click', () => alternarModal(modalEntrar, false));

window.addEventListener('click', (e) => {
    if (e.target === modalCriar) { alternarModal(modalCriar, false); limparFormularioCriar(); }
    if (e.target === modalEntrar) { alternarModal(modalEntrar, false); }
});

function limparFormularioCriar() {
    if (formCriarClube) formCriarClube.reset();
    grupoGeneroOutro.style.display = 'none';
    inputGeneroOutro.required = false;
    inputGeneroOutro.value = '';
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
// ETAPA ATUAL: AÇÃO DE CRIAR O CLUBE (SUBMIT DO FORMULÁRIO)
// ==========================================================================
if (formCriarClube) {
    formCriarClube.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nome = document.getElementById('nome-clube').value.trim();
        const descricao = document.getElementById('desc-clube').value.trim();
        const selecaoGenero = selectGenero.value;
        const privacidade = selectPrivacidade.value; // Captura a escolha (público/privado)
        
        let generoFinal = selecaoGenero === 'Outro' ? inputGeneroOutro.value.trim() : selecaoGenero;

        if (!nome || !generoFinal) {
            alert("Por favor, preencha todos os campos obrigatórios.");
            return;
        }

        const codigoGerado = gerarCodigoConvite();
        const btnSubmit = formCriarClube.querySelector('.btn-submit-form');

        // 3. Objeto com os novos campos de privacidade e fila de espera
        const novoClubeDados = {
            nome: nome,
            descricao: descricao || "Sem descrição disponível por enquanto. ☕",
            genero: generoFinal,
            codigoConvite: codigoGerado,
            adminUid: usuarioLogadoUid,
            membrosLista: [usuarioLogadoUid],
            privacidade: privacidade, // 'publico' ou 'privado'
            solicitacoesPendentes: [], // Fila inicial vazia
            dataCriacao: new Date().toLocaleDateString('pt-BR'),
            livroAtual: {
                titulo: "Nenhum livro em leitura",
                capaUrl: "https://placehold.co/40x60/fff0f2/5c4033?text=📖"
            }
        };

        try {
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = 'Criando Clube... <i class="fa-solid fa-spinner fa-spin"></i>';

            await addDoc(collection(db, "clubes"), novoClubeDados);

            alert(`🎉 Clube "${nome}" criado com sucesso!\n\nPrivacidade: ${privacidade === 'privado' ? '🔒 Privado' : '🌐 Público'}\nCódigo: ${codigoGerado}`);
            
            limparFormularioCriar();
            alternarModal(modalCriar, false);
            carregarClubesDoUsuario();

        } catch (error) {
            console.error("Erro ao salvar clube:", error);
            alert("Oops! Erro ao tentar criar seu clube.");
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = 'Criar e Gerar Código ✨';
        }
    });
}

// ... (Restante do seu código de carregamento e entrar em clube permanece inalterado)