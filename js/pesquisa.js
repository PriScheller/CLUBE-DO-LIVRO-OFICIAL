import { db, auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    collection, 
    addDoc, 
    query, 
    where, 
    getDocs, 
    doc, 
    updateDoc, 
    arrayUnion 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const inputTermo = document.getElementById('input-termo-busca');
const btnExecutar = document.getElementById('btn-executar-busca');
const containerResultados = document.getElementById('container-resultados');
const tituloResultados = document.getElementById('titulo-resultados');

let usuarioAtual = null;
let buscaPendente = null;
let listaClubesUsuario = [];

// Chave da API do Google Books
const GOOGLE_BOOKS_API_KEY = "AIzaSyCYnO9Bxz3t5DGxzVY7miuH6ArPa_XSG_U";

// 1. GERENCIAMENTO DE SESSÃO E BUSCA DE CLUBES
onAuthStateChanged(auth, async (user) => {
    if (user) {
        usuarioAtual = user;
        await carregarClubesDoUsuario();

        if (buscaPendente) {
            buscarNaGoogleBooks(buscaPendente);
            buscaPendente = null;
        }
    } else {
        window.location.href = "login.html";
    }
});

// Busca os clubes onde o usuário atual é membro ativo
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

// Função isolada para ler parâmetros da URL e executar a busca de acordo com o estado atual da página
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

// 2. CAPTURA INICIAL DA URL (E escuta a navegação histórica do usuário)
window.addEventListener('DOMContentLoaded', verificarParametrosERealizarBusca);

// Captura se o usuário clicar nas setas de Voltar/Avançar do navegador mantendo a reatividade
window.addEventListener('popstate', verificarParametrosERealizarBusca);


// 3. EVENTOS DE DISPARO DA BARRA DE PESQUISA
if (btnExecutar) {
    btnExecutar.addEventListener('click', (e) => {
        e.preventDefault();
        ejecutarNovaBusca();
    });
}

if (inputTermo) {
    inputTermo.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            ejecutarNovaBusca();
        }
    });
}

function ejecutarNovaBusca() {
    const termo = inputTermo.value.trim();
    if (termo) {
        const novaUrl = `pesquisa.html?busca=${encodeURIComponent(termo)}`;
        
        // Passamos o termo de busca dentro do estado do pushState
        window.history.pushState({ busca: termo }, '', novaUrl);
        
        // Dispara a busca imediatamente sem precisar reiniciar a página
        buscarNaGoogleBooks(termo);
    }
}

// 4. REQUISIÇÃO PARA A API DO GOOGLE BOOKS
async function buscarNaGoogleBooks(termo) {
    if (tituloResultados) tituloResultados.textContent = `🔍 Resultados para: "${termo}"`;
    if (containerResultados) containerResultados.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:#666;">Buscando acervo na biblioteca global... Aguarde.</p>`;

    try {
        let urlBusca = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(termo)}&maxResults=12`;

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
            containerResultados.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:#cc0000; font-weight:bold;">
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

        let opcoesClubesHtml = `<option value="">-- Escolha um Clube --</option>`;
        listaClubesUsuario.forEach(clube => {
            opcoesClubesHtml += `<option value="${clube.id}">${clube.nome}</option>`;
        });

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

            // Ouvinte 1: Salvar na Estante
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

            // Ouvinte 2: Sugerir ao Jarro
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
        console.error("Erro na requisição:", err);
        containerResultados.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:#cc0000;">Erro ao carregar os resultados do Google Books.</p>`;
    }
}

// 5. GRAVAÇÃO DOS DADOS NO FIRESTORE (ESTANTE)
async function salvarLivroNaEstante(dadosLivro, btnId) {
    if (!usuarioAtual) return;
    const botao = document.getElementById(btnId);
    botao.disabled = true;
    botao.textContent = "Adicionando...";

    try {
        await addDoc(collection(db, "livros"), { ...dadosLivro, userId: usuarioAtual.uid });
        botao.style.backgroundColor = "#d4edda";
        botao.style.color = "#155724";
        botao.style.border = "1px solid #c3e6cb";
        botao.textContent = "✔ Na Estante!";
    } catch (error) {
        console.error("Erro ao salvar no Firestore:", error);
        botao.disabled = false;
        botao.textContent = "Erro ao Salvar";
    }
}

// 6. GRAVAÇÃO DA SUGESTÃO NO CLUBE SELECIONADO
async function enviarSugestaoAoClube(idClube, objetoLivro, btnId) {
    const botao = document.getElementById(btnId);
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
        console.error("Erro ao enviar sugestão ao clube:", error);
        alert("Falha ao registrar sugestão.");
        botao.disabled = false;
        botao.textContent = "Sugerir ao Jarro";
    }
}