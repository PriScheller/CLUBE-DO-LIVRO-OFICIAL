// Importamos os módulos necessários do Firebase e a nossa configuração existente
import { db, auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    collection, 
    addDoc, 
    updateDoc, 
    doc, 
    query, 
    where, 
    onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- SELETORES DO DOM ---
const btnNovoLivro = document.getElementById('btn-novo-livro');
const btnFecharModal = document.getElementById('btn-fechar-modal');
const modalLivro = document.getElementById('modal-livro');
const formLivro = document.getElementById('form-livro');
const modalTituloAcao = document.getElementById('modal-titulo-acao');
const idEdicaoInput = document.getElementById('livro-id-edicao');

// Inputs do formulário
const tituloInput = document.getElementById('livro-titulo');
const isbnInput = document.getElementById('livro-isbn'); // Seletor do novo campo
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

// --- CONTROLE DE SESSÃO DO USUÁRIO ---
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

// --- ESCUTA EM TEMPO REAL DO FIRESTORE ---
function escutarEstanteFirebase(userId) {
    try {
        const q = query(collection(db, "livros"), where("userId", "==", userId));
        
        unsubscribeEstante = onSnapshot(q, (snapshot) => {
            livrosCarregados = [];
            snapshot.forEach((docSnap) => {
                livrosCarregados.push({ id: docSnap.id, ...docSnap.data() });
            });
            renderizarEstante(livrosCarregados);
        }, (error) => {
            console.error("Erro interno do Firestore:", error);
        });
    } catch (err) {
        console.error("Falha ao conectar com o banco:", err);
    }
}

// --- FUNÇÃO INTEGRAÇÃO COM API OPEN LIBRARY ---
async function buscarCapaOpenLibrary(titulo, isbn) {
    // Tratamento básico para remover espaços em branco extras
    const isbnLimpo = isbn ? isbn.trim() : "";
    const tituloLimpo = titulo.trim();

    try {
        let urlBusca = "";
        
        // Estratégia de busca inteligente
        if (isbnLimpo) {
            urlBusca = `https://openlibrary.org/search.json?isbn=${encodeURIComponent(isbnLimpo)}`;
        } else {
            urlBusca = `https://openlibrary.org/search.json?title=${encodeURIComponent(tituloLimpo)}`;
        }

        const resposta = await fetch(urlBusca);
        if (!resposta.ok) return "";

        const dados = await resposta.json();
        
        // Verifica se encontramos documentos válidos com ID de capa
        if (dados.docs && dados.docs.length > 0) {
            for (let livro of dados.docs) {
                if (livro.cover_i) {
                    return `https://covers.openlibrary.org/b/id/${livro.cover_i}-L.jpg`;
                }
            }
        }
        return ""; // Caso não ache nenhuma capa correspondente
    } catch (err) {
        console.error("Erro ao consultar a API Open Library:", err);
        return "";
    }
}

// --- FUNÇÃO DE CÁLCULO DE PORCENTAGEM ---
function calcularPorcentagem(atual, total) {
    if (!total || total <= 0) return 0;
    if (atual >= total) return 100;
    return Math.round((atual / total) * 100);
}

// --- RENDERIZAÇÃO DOS CARDS NA TELA ---
function renderizarEstante(livros) {
    listaQuero.innerHTML = "";
    listaLendo.innerHTML = "";
    listaLidos.innerHTML = "";

    let contQuero = 0, contLendo = 0, contLidos = 0;

    livros.forEach(livro => {
        const pct = calcularPorcentagem(livro.pagAtual, livro.pagTotal);
        // Se a API trouxe uma URL válida ela renderiza aqui, senão cai no placeholder do emoji de livro
        const capaCard = livro.capaUrl ? livro.capaUrl : "https://placehold.co/65x95/fff0f2/5c4033?text=📖";

        const cardHtml = `
            <div class="livro-card" data-id="${livro.id}">
                <img src="${capaCard}" alt="Capa" class="livro-capa" style="object-fit: cover;">
                <div class="livro-info">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
                        <h4 style="margin: 0; font-size: 0.95rem; line-height: 1.2;">${livro.titulo}</h4>
                        <button class="btn-editar-livro" data-id="${livro.id}" style="background: none; border: none; cursor: pointer; color: var(--marrom-suave); font-size: 0.85rem;">✏️</button>
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
                        <p style="font-size: 0.8rem; color: var(--marrom-suave); font-style: italic; margin-top: 0.5rem; line-height: 1.2;">
                            "${livro.comentario}"
                        </p>
                    ` : ''}
                </div>
            </div>
        `;

        if (livro.status === 'quero-ler') {
            listaQuero.innerHTML += cardHtml;
            contQuero++;
        } else if (livro.status === 'lendo') {
            listaLendo.innerHTML += cardHtml;
            contLendo++;
        } else if (livro.status === 'lidos') {
            listaLidos.innerHTML += cardHtml;
            contLidos++;
        }
    });

    qtdQuero.textContent = contQuero;
    qtdLendo.textContent = contLendo;
    qtdLidos.textContent = contLidos;

    configurarBotoesEditar();
}

// --- EVENTO DE SUBMIT (SALVAR COM REQUISIÇÃO DA API) ---
if (formLivro) {
    formLivro.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!usuarioAtual) {
            alert("Erro de sessão.");
            return;
        }

        const titulo = tituloInput.value.trim();
        const isbn = isbnInput ? isbnInput.value.trim() : "";
        const status = statusInput.value;
        let pagAtual = parseInt(pagAtualInput.value) || 0;
        let pagTotal = parseInt(pagTotalInput.value) || 0;
        const comentario = comentarioInput.value;
        const idEdicao = idEdicaoInput ? idEdicaoInput.value : "";

        if (status === 'lidos' && pagTotal > 0) {
            pagAtual = pagTotal;
        }

        // 1. Aciona a busca da capa de forma dinâmica
        let capaUrlDefinitiva = "";
        
        // Se for um livro novo, buscamos a capa na API
        if (!idEdicao) {
            capaUrlDefinitiva = await buscarCapaOpenLibrary(titulo, isbn);
        } else {
            // Se for edição, mantém a capa atual do array local para não sobrescrever com vazio
            const livroExistente = livrosCarregados.find(l => l.id === idEdicao);
            capaUrlDefinitiva = livroExistente ? livroExistente.capaUrl : "";
        }

        const dadosLivro = {
            titulo,
            isbn, // salvando o código também para registro
            status,
            pagAtual,
            pagTotal,
            comentario,
            userId: usuarioAtual.uid,
            capaUrl: capaUrlDefinitiva 
        };

        try {
            if (idEdicao) {
                const livroRef = doc(db, "livros", idEdicao);
                await updateDoc(livroRef, dadosLivro);
            } else {
                await addDoc(collection(db, "livros"), dadosLivro);
            }
            
            modalLivro.classList.add('d-none');
            formLivro.reset();
        } catch (error) {
            console.error("Erro ao salvar no Firestore:", error);
        }
    });
}

// --- FUNÇÃO PARA ABRIR O MODAL EM MODO DE EDIÇÃO ---
function configurarBotoesEditar() {
    const botoes = document.querySelectorAll('.btn-editar-livro');
    botoes.forEach(botao => {
        botao.addEventListener('click', (e) => {
            const idLivro = e.currentTarget.getAttribute('data-id');
            const livro = livrosCarregados.find(l => l.id === idLivro);

            if (livro) {
                idEdicaoInput.value = livro.id;
                tituloInput.value = livro.titulo;
                if (isbnInput) isbnInput.value = livro.isbn || "";
                statusInput.value = livro.status;
                pagAtualInput.value = livro.pagAtual;
                pagTotalInput.value = livro.pagTotal;
                comentarioInput.value = livro.comentario || "";

                modalTituloAcao.textContent = "Editar Informações do Livro";
                modalLivro.classList.remove('d-none');
            }
        });
    });
}

// --- CONTROLE DOS BOTÕES DE ABRIR/FECHAR MODAL ---
if (btnNovoLivro) {
    btnNovoLivro.addEventListener('click', () => {
        formLivro.reset();
        if (idEdicaoInput) idEdicaoInput.value = ""; 
        modalTituloAcao.textContent = "Adicionar Novo Livro";
        modalLivro.classList.remove('d-none');
    });
}

if (btnFecharModal) {
    btnFecharModal.addEventListener('click', () => modalLivro.classList.add('d-none'));
}
if (modalLivro) {
    modalLivro.addEventListener('click', (e) => { if (e.target === modalLivro) modalLivro.classList.add('d-none'); });
}