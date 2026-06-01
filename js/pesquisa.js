import { db, auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const inputTermo = document.getElementById('input-termo-busca');
const btnExecutar = document.getElementById('btn-executar-busca');
const containerResultados = document.getElementById('container-resultados');

let usuarioAtual = null;

// Garante sessão ativa
onAuthStateChanged(auth, (user) => {
    if (user) {
        usuarioAtual = user;
    } else {
        window.location.href = "login.html";
    }
});

// Captura o termo enviado pela Dashboard na URL (Ex: ?busca=hobbit)
window.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const termoInicial = params.get('busca');
    if (termoInicial) {
        inputTermo.value = decodeURIComponent(termoInicial);
        buscarNaAPI(termoInicial);
    }
});

btnExecutar.addEventListener('click', () => {
    if (inputTermo.value.trim()) {
        buscarNaAPI(inputTermo.value.trim());
    }
});

async function buscarNaAPI(termo) {
    containerResultados.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:#666;">Buscando livros na biblioteca global... Aguarde.</p>`;
    
    try {
        let queryUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(termo)}&limit=12`;
        
        // Se parecer um ISBN (somente números) otimiza a busca
        if (/^\d+$/.test(termo.replace(/[- ]/g, ""))) {
            queryUrl = `https://openlibrary.org/search.json?isbn=${encodeURIComponent(termo.replace(/[- ]/g, ""))}`;
        }

        const res = await fetch(queryUrl);
        if (!res.ok) throw new Error("Erro na API");
        const dados = await res.json();

        if (!dados.docs || dados.docs.length === 0) {
            containerResultados.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:#cc0000;">Nenhum livro encontrado para essa busca.</p>`;
            return;
        }

        containerResultados.innerHTML = "";

        dados.docs.forEach((livro, index) => {
            const titulo = livro.title || "Título Indisponível";
            const autor = livro.author_name ? livro.author_name.join(', ') : "Autor Desconhecido";
            const editora = livro.publisher ? livro.publisher[0] : "Editora Não Registrada";
            const paginas = livro.number_of_pages_median || livro.number_of_pages || 0;
            const isbnDoc = livro.isbn ? livro.isbn[0] : "";
            
            // Monta a URL de imagem caso exista id de capa
            const capaUrl = livro.cover_i 
                ? `https://covers.openlibrary.org/b/id/${livro.cover_i}-L.jpg` 
                : "https://placehold.co/90x130/fff0f2/5c4033?text=📖";

            const card = document.createElement('div');
            card.className = 'busca-card';
            card.innerHTML = `
                <img src="${capaUrl}" alt="Capa" class="busca-capa">
                <div class="busca-info">
                    <div>
                        <h4>${titulo}</h4>
                        <p><strong>Autor:</strong> ${autor}</p>
                        <p><strong>Editora:</strong> ${editora}</p>
                        <p><strong>Páginas:</strong> ${paginas > 0 ? paginas : 'Não informado'}</p>
                    </div>
                    <div>
                        <select class="select-categoria" id="select-${index}">
                            <option value="quero-ler">📌 Quero Ler</option>
                            <option value="lendo">☕ Lendo</option>
                            <option value="lidos">✨ Lidos</option>
                        </select>
                        <button class="btn-add-pesquisa" id="btn-add-${index}">Adicionar Livro</button>
                    </div>
                </div>
            `;

            containerResultados.appendChild(card);

            // Evento do botão Adicionar de cada card
            document.getElementById(`btn-add-${index}`).addEventListener('click', async () => {
                const categoriaSelecionada = document.getElementById(`select-${index}`).value;
                await salvarLivroNaEstante({
                    titulo,
                    autor,
                    editora,
                    pagTotal: paginas,
                    pagAtual: categoriaSelecionada === 'lidos' ? paginas : 0,
                    status: categoriaSelecionada,
                    capaUrl: livro.cover_i ? capaUrl : "",
                    isbn: isbnDoc,
                    comentario: ""
                }, `btn-add-${index}`);
            });
        });

    } catch (err) {
        console.error(err);
        containerResultados.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:#cc0000;">Falha de conexão com o servidor de busca.</p>`;
    }
}

async function salvarLivroNaEstante(dadosLivro, btnId) {
    if (!usuarioAtual) return;
    const botao = document.getElementById(btnId);
    botao.disabled = true;
    botao.textContent = "Adicionando...";

    try {
        await addDoc(collection(db, "livros"), {
            ...dadosLivro,
            userId: usuarioAtual.uid
        });
        botao.style.backgroundColor = "#d4edda";
        botao.style.color = "#155724";
        botao.textContent = "✔ Na Estante!";
    } catch (error) {
        console.error("Erro ao salvar:", error);
        botao.disabled = false;
        botao.textContent = "Erro ao Adicionar";
    }
}