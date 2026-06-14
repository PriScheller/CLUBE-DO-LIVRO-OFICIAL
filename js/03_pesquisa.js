// ==========================================================================
// CONFIGURAÇÕES, IMPORTAÇÕES E SELEÇÃO DE ELEMENTOS
// ==========================================================================
import { db, auth } from './12_firebase-config.js'; // Ajustado para o novo padrão numérico
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, addDoc, query, where, getDocs, doc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const inputTermo = document.getElementById('input-termo-busca');
const btnExecutar = document.getElementById('btn-executar-busca');
const containerResultados = document.getElementById('container-resultados');
const tituloResultados = document.getElementById('titulo-resultados');

let usuarioAtual = null;
let buscaPendente = null;
let listaClubesUsuario = [];

// Chave da API do Google Books
const GOOGLE_BOOKS_API_KEY = "AIzaSyCYnO9Bxz3t5DGxzVY7miuH6ArPa_XSG_U";

// ==========================================================================
// 1. GERENCIAMENTO DE SESSÃO E MONITORAMENTO DO USUÁRIO
// ==========================================================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        usuarioAtual = user;
        await carregarClubesDoUsuario();

        // Se o usuário veio de outra página com um termo na URL, executa a busca pendente
        if (buscaPendente) {
            buscarNaGoogleBooks(buscaPendente);
            buscaPendente = null;
        }
    } else {
        // Redirecionamento seguro para a página de login padronizada
        window.location.href = "../html/01_login.html";
    }
});

// Busca os clubes onde o usuário logado é um membro participante ativo
async function carregarClubesDoUsuario() {
    if (!usuarioAtual) return;
    try {
        const q = query(collection(db, "clubes"), where("membrosLista", "array-contains", usuarioAtual.uid));
        const querySnapshot = await getDocs(q);
        listaClubesUsuario = [];

        querySnapshot.forEach((docSnap) => {
            listaClubesUsuario.push({
                id: docSnap.id,
                nome: docSnap.data().nome || "Clube Sem Nome"
            });
        });
    } catch (error) {
        console.error("Erro ao carregar clubes do usuário:", error);
    }
}

// ==========================================================================
// 2. CONTROLE DE URL, PARÂMETROS E HISTÓRICO DO NAVEGADOR
// ==========================================================================
function verificarParametrosERealizarBusca() {
    const params = new URLSearchParams(window.location.search);
    const termoInicial = params.get('busca');

    if (termoInicial) {
        const termoDecodificado = decodeURIComponent(termoInicial);
        if (inputTermo) inputTermo.value = termoDecodificado;

        if (usuarioAtual) {
            buscarNaGoogleBooks(termoDecodificado);
        } else {
            buscaPendente = termoDecodificado;
        }
    } else {
        if (containerResultados) {
            containerResultados.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:#888;">Digite o título de um livro no topo para pesquisar.</p>`;
        }
    }
}

// Escuta o carregamento da árvore DOM e navegações de voltar/avançar no histórico
window.addEventListener('DOMContentLoaded', verificarParametrosERealizarBusca);
window.addEventListener('popstate', verificarParametrosERealizarBusca);

// ==========================================================================
// 3. CAPTURA E DISPARO DA BARRA DE PESQUISA (EVENTOS)
// ==========================================================================
if (btnExecutar) {
    btnExecutar.addEventListener('click', (e) => {
        e.preventDefault();
        executarNovaBusca();
    });
}

if (inputTermo) {
    inputTermo.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            executarNovaBusca();
        }
    });
}

function executarNovaBusca() {
    const termo = inputTermo.value.trim();
    if (termo) {
        // Atualizado para refletir o nome correto do arquivo de destino numerado
        const novaUrl = `../html/03_pesquisa.html?busca=${encodeURIComponent(termo)}`;

        // Altera a URL no navegador sem forçar um refresh na tela, criando histórico limpo
        window.history.pushState({ busca: termo }, '', novaUrl);

        buscarNaGoogleBooks(termo);
    }
}

// ==========================================================================
// 4. INTEGRAÇÃO E RENDERIZAÇÃO DA API GOOGLE BOOKS
// ==========================================================================
async function buscarNaGoogleBooks(termo) {
    if (tituloResultados) tituloResultados.textContent = `🔍 Resultados para: "${termo}"`;
    if (containerResultados) {
        containerResultados.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:#666;">Buscando acervo na biblioteca global... Aguarde.</p>`;
    }

    try {
        let urlBusca = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(termo)}&maxResults=12`;

        // Se o termo de pesquisa for puramente numérico (com hífens/espaços), assume que é uma busca por ISBN
        if (/^\d+$/.test(termo.replace(/[- ]/g, ""))) {
            urlBusca = `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(termo.replace(/[- ]/g, ""))}`;
        }

        if (GOOGLE_BOOKS_API_KEY) {
            urlBusca += `&key=${GOOGLE_BOOKS_API_KEY}`;
        }

        const res = await fetch(urlBusca, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        if (res.status === 429) {
            containerResultados.innerHTML = `
                <p style="grid-column:1/-1; text-align:center; color:#cc0000; font-weight:bold;">
                    ⚠️ Limite de requisições temporárias do Google atingido. Aguarde um minuto.
                </p>`;
            return;
        }

        if (!res.ok) throw new Error(`Erro HTTP: ${res.status}`);
        const dados = await res.json();

        if (!dados.items || dados.items.length === 0) {
            containerResultados.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:#cc0000;">Nenhum livro localizado para esse termo.</p>`;
            return;
        }

        containerResultados.innerHTML = "";

        // Monta as opções dinâmicas dos clubes ativos do usuário
        let opcoesClubesHtml = `<option value="">-- Escolha um Clube --</option>`;
        listaClubesUsuario.forEach(clube => {
            opcoesClubesHtml += `<option value="${clube.id}">${clube.nome}</option>`;
        });

        // Loop principal para criar os cards na tela
        dados.items.forEach((item, index) => {
            const info = item.volumeInfo;
            const titulo = info.title || "Título Indisponível";
            const autor = info.authors ? info.authors.join(', ') : "Autor Não Registrado";
            const editora = info.publisher || "Editora Não Registrada";
            const paginas = info.pageCount || 0;
            const genero = info.categories ? info.categories[0] : "Geral";
            const dataPublicacao = info.publishedDate ? info.publishedDate.split('-')[0] : "N/A";

            let capaUrl = "https://placehold.co/90x130/fff0f2/5c4033?text=📖";
            if (info.imageLinks) {
                capaUrl = info.imageLinks.thumbnail || info.imageLinks.smallThumbnail;
                if (capaUrl.startsWith('http:')) capaUrl = capaUrl.replace('http:', 'https:');
            }

            const card = document.createElement('div');
            card.className = 'busca-card';
            card.innerHTML = `
                <img src="${capaUrl}" alt="Capa" class="busca-capa">
                <div class="busca-info">
                    <div>
                        <h4 style="font-family: sans-serif; font-weight: bold; margin: 0 0 5px 0; color: var(--marrom-cozy);">${titulo}</h4>
                        <p><strong>Autor:</strong> ${autor}</p>
                        <p><strong>Editora:</strong> ${editora} (${dataPublicacao})</p>
                        <p><strong>Gênero:</strong> ${genero} | <strong>Páginas:</strong> ${paginas > 0 ? paginas : 'N/A'}</p>
                    </div>
                    <div style="margin-top: 10px;">
                        <select class="select-categoria" id="select-${index}">
                            <option value="quero-ler">📌 Quero Ler</option>
                            <option value="lendo">☕ Lendo</option>
                            <option value="lidos">✨ Lidos</option>
                        </select>
                        <button class="btn-add-pesquisa" id="btn-add-${index}">Adicionar à Estante</button>
                    
                        <div class="bloco-clube-container" style="margin-top: 10px; border-top: 1px dashed #eee; padding-top: 10px;">
                            <select class="select-categoria" id="select-clube-${index}">
                                ${opcoesClubesHtml}
                            </select>
                            <button class="btn-add-clube" id="btn-add-clube-${index}">Sugerir ao Jarro</button>
                        </div>
                    </div>
                </div>
            `;
            containerResultados.appendChild(card);

            // Ouvinte de Evento 1: Gravação na Estante do Usuário
            document.getElementById(`btn-add-${index}`).addEventListener('click', async () => {
                const categoriaSelecionada = document.getElementById(`select-${index}`).value;
                await salvarLivroNaEstante({
                    titulo, autor, editora, genero,
                    pagTotal: paginas,
                    pagAtual: categoriaSelecionada === 'lidos' ? paginas : 0,
                    status: categoriaSelecionada,
                    capaUrl: info.imageLinks ? capaUrl : "",
                    comentario: "", nota: 0, favorito: false, dataInicio: "", dataTermino: "",
                    formatoLeitura: "Livro Físico"
                }, `btn-add-${index}`);
            });

            // Ouvinte de Evento 2: Envio de Sugestão ao Jarro do Clube Escolhido
            document.getElementById(`btn-add-clube-${index}`).addEventListener('click', async () => {
                const idClubeSelecionado = document.getElementById(`select-clube-${index}`).value;
                if (!idClubeSelecionado) {
                    alert("Por favor, selecione em qual clube deseja sugerir este livro!");
                    return;
                }

                const objetoLivroSugestao = {
                    titulo: titulo,
                    autor: autor,
                    capaUrl: info.imageLinks ? capaUrl : "",
                    adicionadoPorUid: usuarioAtual.uid,
                    dataSugestao: new Date().toISOString()
                };

                await enviarSugestaoAoClube(idClubeSelecionado, objetoLivroSugestao, `btn-add-clube-${index}`);
            });
        });

    } catch (err) {
        console.error("Erro na requisição da API:", err);
        if (containerResultados) {
            containerResultados.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:#cc0000;">Erro ao carregar os resultados do Google Books.</p>`;
        }
    }
}

// ==========================================================================
// 5. BANCO DE DADOS (FIRESTORE) - OPERAÇÕES DE ESCRITA
// ==========================================================================

// Grava o livro de forma independente no perfil/estante do usuário logado
async function salvarLivroNaEstante(dadosLivro, btnId) {
    if (!usuarioAtual) return;
    const botao = document.getElementById(btnId);
    if (!botao) return;

    botao.disabled = true;
    botao.textContent = "Adicionando...";

    try {
        await addDoc(collection(db, "livros"), { ...dadosLivro, userId: usuarioAtual.uid });
        botao.style.backgroundColor = "#d4edda";
        botao.style.color = "#155724";
        botao.style.border = "1px solid #c3e6cb";
        botao.textContent = "✔ Na Estante!";
    } catch (error) {
        console.error("Erro ao salvar livro na estante (Firestore):", error);
        botao.disabled = false;
        botao.textContent = "Erro ao Salvar";
    }
}

// Envia e concatena um objeto de livro sugerido dentro do array do documento do clube
async function enviarSugestaoAoClube(idClube, objetoLivro, btnId) {
    const botao = document.getElementById(btnId);
    if (!botao) return;

    botao.disabled = true;
    botao.textContent = "Enviando...";

    try {
        const clubeDocRef = doc(db, "clubes", idClube);
        await updateDoc(clubeDocRef, {
            sugestoesLivros: arrayUnion(objetoLivro)
        });

        botao.style.backgroundColor = "#d4edda";
        botao.style.color = "#155724";
        botao.style.border = "1px solid #c3e6cb";
        botao.textContent = "✔ No Jarro!";
    } catch (error) {
        console.error("Erro ao enviar sugestão de livro ao clube:", error);
        alert("Falha ao registrar sugestão.");
        botao.disabled = false;
        botao.textContent = "Sugerir ao Jarro";
    }
}