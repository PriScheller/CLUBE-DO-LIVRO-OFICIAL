import { db, auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const inputTermo = document.getElementById('input-termo-busca');
const btnExecutar = document.getElementById('btn-executar-busca');
const containerResultados = document.getElementById('container-resultados');
const tituloResultados = document.getElementById('titulo-resultados');

let usuarioAtual = null;
let buscaPendente = null;

// Insira aqui sua chave de API do Google Cloud para evitar o erro 429 (Too Many Requests)
const GOOGLE_BOOKS_API_KEY = "AIzaSyCyMSAsn4Q9GUDfsmvKzM0iyWW8oflcTl8"; 

// 1. GERENCIAMENTO DE SESSÃO
onAuthStateChanged(auth, (user) => {
    if (user) { 
        usuarioAtual = user; 
        if (buscaPendente) {
            buscarNaGoogleBooks(buscaPendente);
            buscaPendente = null;
        }
    } else { 
        window.location.href = "login.html"; 
    }
});

// 2. CAPTURA INICIAL DA URL
window.addEventListener('DOMContentLoaded', () => {
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
});

// 3. EVENTOS DE DISPARO DA BARRA DE PESQUISA
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
        const novaUrl = `pesquisa.html?busca=${encodeURIComponent(termo)}`;
        window.history.pushState({ path: novaUrl }, '', novaUrl);
        buscarNaGoogleBooks(termo);
    }
}

// 4. REQUISIÇÃO PARA A API DO GOOGLE BOOKS
async function buscarNaGoogleBooks(termo) {
    if (tituloResultados) tituloResultados.textContent = `🔍 Resultados para: "${termo}"`;
    if (containerResultados) containerResultados.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:#666;">Buscando acervo na biblioteca global... Aguarde.</p>`;
    
    try {
        // Monta a URL base limpando espaços extras
        let urlBusca = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(termo)}&maxResults=12`;
        
        // Se for uma busca por ISBN numérico
        if (/^\d+$/.test(termo.replace(/[- ]/g, ""))) {
            urlBusca = `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(termo.replace(/[- ]/g, ""))}`;
        }

        // Se você configurou a chave do passo 1, ela é anexada aqui para autenticar a requisição
        if (GOOGLE_BOOKS_API_KEY && GOOGLE_BOOKS_API_KEY !== "SUA_GOOGLE_BOOKS_API_KEY_AQUI") {
            urlBusca += `&key=${GOOGLE_BOOKS_API_KEY}`;
        }

        const res = await fetch(urlBusca, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        // Tratamento explícito caso o erro 429 persista temporariamente por IP
        if (res.status === 429) {
            containerResultados.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:#cc0000; font-weight:bold;">
                ⚠️ Limite de requisições temporárias do Google atingido (Erro 429). <br>
                Aguarde um minuto ou adicione uma Google API Key no seu arquivo js/pesquisa.js para liberar o acesso.
            </p>`;
            return;
        }

        if (!res.ok) throw new Error(`Erro HTTP: ${res.status}`);
        
        const dados = await res.json();

        if (!dados.items || dados.items.length === 0) {
            containerResultados.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:#cc0000;">Nenhum livro localizado para esse termo. Tente outro título.</p>`;
            return;
        }

        containerResultados.innerHTML = "";

        // RENDERIZAÇÃO DOS CARDS NA TELA
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
                    </div>
                </div>
            `;
            containerResultados.appendChild(card);

            // Ouvinte para salvar o livro selecionado no Firestore
            document.getElementById(`btn-add-${index}`).addEventListener('click', async () => {
                const categoriaSelecionada = document.getElementById(`select-${index}`).value;
                await salvarLivroNaEstante({
                    titulo,
                    autor,
                    editora,
                    genero,
                    pagTotal: paginas,
                    pagAtual: categoriaSelecionada === 'lidos' ? paginas : 0,
                    status: categoriaSelecionada,
                    capaUrl: info.imageLinks ? capaUrl : "",
                    comentario: "",
                    nota: 0,
                    favorito: false,
                    dataInicio: "",
                    dataTermino: "",
                    formatoLeitura: "Livro Físico"
                }, `btn-add-${index}`);
            });
        });

    } catch (err) {
        console.error("Erro detalhado da requisição:", err);
        containerResultados.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:#cc0000;">Erro ao carregar os resultados do Google Books. Tente novamente em instantes.</p>`;
    }
}

// 5. GRAVAÇÃO DOS DADOS NO FIRESTORE
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