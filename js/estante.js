import { db, auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    collection, 
    updateDoc, 
    deleteDoc, // importação necessária para exclusão
    doc, 
    query, 
    where, 
    onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- SELETORES DO DOM ---
const btnFecharModal = document.getElementById('btn-fechar-modal');
const modalLivro = document.getElementById('modal-livro');
const formLivro = document.getElementById('form-livro');
const idEdicaoInput = document.getElementById('livro-id-edicao');
const btnExcluirLivro = document.getElementById('btn-excluir-livro'); // Novo seletor

// Inputs do formulário
const tituloInput = document.getElementById('livro-titulo');
const statusInput = document.getElementById('livro-status');
const pagAtualInput = document.getElementById('livro-pag-atual');
const pagTotalInput = document.getElementById('livro-pag-total');
const comentarioInput = document.getElementById('livro-comentario');

// Colunas e Contadores
const listaQuero = document.getElementById('lista-quero-ler');
const listaLendo = document.getElementById('lista-lendo');
const listaLidos = document.getElementById('lista-lidos');
const qtdQuero = document.getElementById('qtd-quero');
const qtdLendo = document.getElementById('qtd-lendo');
const qtdLidos = document.getElementById('qtd-lidos');

let usuarioAtual = null;
let unsubscribeEstante = null; 
let livrosCarregados = []; 

// --- CONTROLE DE SESSÃO ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        usuarioAtual = user;
        escutarEstanteFirebase(user.uid);
    } else {
        usuarioAtual = null;
        if (unsubscribeEstante) unsubscribeEstante();
        window.location.href = "login.html";
    }
});

// --- ESCUTA EM TEMPO REAL ---
function escutarEstanteFirebase(userId) {
    const q = query(collection(db, "livros"), where("userId", "==", userId));
    unsubscribeEstante = onSnapshot(q, (snapshot) => {
        livrosCarregados = [];
        snapshot.forEach((docSnap) => {
            livrosCarregados.push({ id: docSnap.id, ...docSnap.data() });
        });
        renderizarEstante(livrosCarregados);
    });
}

function calcularPorcentagem(atual, total) {
    if (!total || total <= 0) return 0;
    if (atual >= total) return 100;
    return Math.round((atual / total) * 100);
}

// --- RENDERIZAÇÃO DOS CARDS COM AS INFORMAÇÕES AUTOMÁTICAS ---
function renderizarEstante(livros) {
    listaQuero.innerHTML = "";
    listaLendo.innerHTML = "";
    listaLidos.innerHTML = "";
    let contQuero = 0, contLendo = 0, contLidos = 0;

    livros.forEach(livro => {
        const pct = calcularPorcentagem(livro.pagAtual, livro.pagTotal);
        const capaCard = livro.capaUrl ? livro.capaUrl : "https://placehold.co/65x95/fff0f2/5c4033?text=📖";

        const cardHtml = `
            <div class="livro-card" data-id="${livro.id}">
                <img src="${capaCard}" alt="Capa" class="livro-capa" style="object-fit: cover;">
                <div class="livro-info">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
                        <div>
                            <h4 style="margin: 0; font-size: 0.95rem;">${livro.titulo}</h4>
                            <p style="margin: 2px 0 0 0; font-size: 0.75rem; color:#777;">${livro.autor || ''}</p>
                        </div>
                        <button class="btn-editar-livro" data-id="${livro.id}" style="background: none; border: none; cursor: pointer; font-size: 0.85rem;">✏️</button>
                    </div>
                    
                    ${livro.status === 'lendo' ? `
                        <div class="progresso-container">
                            <div class="progresso-texto">
                                <span>Pág. ${livro.pagAtual} / ${livro.pagTotal}</span>
                                <span>${pct}%</span>
                            </div>
                            <div class="barra-progresso-bg">
                                <div class="barra-progresso-fill" style="width: ${pct}%;"></div>
                            </div>
                        </div>
                    ` : ''}

                    ${livro.status === 'lidos' && livro.comentario ? `
                        <p style="font-size: 0.8rem; color: var(--marrom-suave); font-style: italic; margin-top: 0.5rem;">
                            "${livro.comentario}"
                        </p>
                    ` : ''}
                </div>
            </div>
        `;

        if (livro.status === 'quero-ler') { listaQuero.innerHTML += cardHtml; contQuero++; }
        else if (livro.status === 'lendo') { listaLendo.innerHTML += cardHtml; contLendo++; }
        else if (livro.status === 'lidos') { listaLidos.innerHTML += cardHtml; contLidos++; }
    });

    qtdQuero.textContent = contQuero;
    qtdLendo.textContent = contLendo;
    qtdLidos.textContent = contLidos;
    configurarBotoesEditar();
}

// --- SALVAR ALTERAÇÃO DE PROGRESSO ---
if (formLivro) {
    formLivro.addEventListener('submit', async (e) => {
        e.preventDefault();
        const idEdicao = idEdicaoInput.value;
        if (!idEdicao) return;

        const status = statusInput.value;
        let pagAtual = parseInt(pagAtualInput.value) || 0;
        let pagTotal = parseInt(pagTotalInput.value) || 0;
        const comentario = comentarioInput.value;

        if (status === 'lidos' && pagTotal > 0) pagAtual = pagTotal;

        try {
            const livroRef = doc(db, "livros", idEdicao);
            await updateDoc(livroRef, { status, pagAtual, pagTotal, comentario });
            modalLivro.classList.add('d-none');
        } catch (error) {
            console.error("Erro ao atualizar:", error);
        }
    });
}

// --- EVENTO DO BOTÃO EXCLUIR ---
if (btnExcluirLivro) {
    btnExcluirLivro.addEventListener('click', async () => {
        const idExclusao = idEdicaoInput.value;
        if (!idExclusao) return;

        if (confirm("Tem certeza que deseja remover este livro da sua estante?")) {
            try {
                await deleteDoc(doc(db, "livros", idExclusao));
                modalLivro.classList.add('d-none');
            } catch (error) {
                console.error("Erro ao deletar documento:", error);
                alert("Não foi possível excluir o livro.");
            }
        }
    });
}

function configurarBotoesEditar() {
    document.querySelectorAll('.btn-editar-livro').forEach(botao => {
        botao.addEventListener('click', (e) => {
            const idLivro = e.currentTarget.getAttribute('data-id');
            const livro = livrosCarregados.find(l => l.id === idLivro);

            if (livro) {
                idEdicaoInput.value = livro.id;
                tituloInput.value = livro.titulo;
                statusInput.value = livro.status;
                pagAtualInput.value = livro.pagAtual;
                pagTotalInput.value = livro.pagTotal;
                comentarioInput.value = livro.comentario || "";
                modalLivro.classList.remove('d-none');
            }
        });
    });
}

if (btnFecharModal) btnFecharModal.addEventListener('click', () => modalLivro.classList.add('d-none'));