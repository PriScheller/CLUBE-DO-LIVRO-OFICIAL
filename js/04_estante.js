import { db, auth } from './12_firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const gridLivros = document.getElementById('grid-livros-estante');
const tituloSecaoAtual = document.getElementById('titulo-secao-atual');
const botoesAba = document.querySelectorAll('.btn-aba');

let todosOsLivros = []; // Cache local para evitar requisições repetidas ao Firestore
let statusAtual = "lendo"; // Categoria ativa inicial padrão

const mapasTitulos = {
    "lendo": "☕ Lendo Atualmente",
    "quero-ler": "📌 Próximas Leituras (Quero Ler)",
    "lidos": "✨ Concluídos (Lidos)"
};

const mensagensVazio = {
    "lendo": "Nenhum livro sendo lido no momento. Que tal começar um? ☕",
    "quero-ler": "Sua lista de desejos está vazia. Explore novos títulos! 📌",
    "lidos": "Nenhum livro finalizado ainda. O conhecimento é uma jornada! ✨"
};

// 1. MONITOR DE SESSÃO DO USUÁRIO
onAuthStateChanged(auth, (user) => {
    if (user) {
        carregarDadosIniciais(user.uid);
    } else {
        window.location.href = "../html/01_login.html";
    }
});

// 2. BUSCA DA COLEÇÃO DO FIRESTORE (EXECUTA UMA ÚNICA VEZ)
async function carregarDadosIniciais(userId) {
    gridLivros.innerHTML = `<p class="msg-vazio">Organizando suas prateleiras... Aguarde.</p>`;
    try {
        const q = query(collection(db, "livros"), where("userId", "==", userId));
        const querySnapshot = await getDocs(q);

        todosOsLivros = [];
        querySnapshot.forEach((doc) => {
            todosOsLivros.push({ idDoc: doc.id, ...doc.data() });
        });

        renderizarPrateleira();
        configurarEventosDoMenu();

    } catch (error) {
        console.error("Erro ao puxar dados da estante:", error);
        gridLivros.innerHTML = `<p class="msg-vazio" style="color: #b04d5c;">Erro ao carregar os livros da sua estante.</p>`;
    }
}

// 3. RENDERIZAÇÃO DINÂMICA DOS CARDS HORIZONTAIS
function renderizarPrateleira() {
    gridLivros.innerHTML = "";
    tituloSecaoAtual.textContent = mapasTitulos[statusAtual];

    // Filtra em memória o status selecionado
    const livrosFiltrados = todosOsLivros.filter(l => l.status === statusAtual);

    if (livrosFiltrados.length === 0) {
        gridLivros.innerHTML = `<p class="msg-vazio">${mensagensVazio[statusAtual]}</p>`;
        return;
    }

    livrosFiltrados.forEach((livro) => {
        const cardLivro = document.createElement('div');
        cardLivro.className = 'livro-card';

        const capaUrl = livro.capaUrl || "https://placehold.co/90x130/fff0f2/5c4033?text=📖";
        let blocoProgressoHTML = "";

        if (livro.status === 'lendo') {
            const total = parseInt(livro.pagTotal) || 0;
            const atual = parseInt(livro.pagAtual) || 0;
            const porcentagem = (total > 0) ? Math.min(Math.round((atual / total) * 100), 100) : 0;

            blocoProgressoHTML = `
                <div class="progresso-estante-container" style="margin: 0.2rem 0; width: 100%;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.78rem; font-weight: bold; color: var(--marrom-cozy, #5c4033); margin-bottom: 0.2rem;">
                        <span>${porcentagem}% lido</span>
                        <span style="font-weight: normal; color: #8a7a75;">${atual}/${total} pág.</span>
                    </div>
                    <div style="width: 100%; height: 7px; background: #f3ebeb; border-radius: 4px; overflow: hidden; border: 1px solid #ebdada;">
                        <div style="width: ${porcentagem}%; height: 100%; background-color: var(--rosa-pastel-medio, #f5dade); transition: width 0.3s ease;"></div>
                    </div>
                </div>
            `;
        } else if (livro.status === 'lidos') {
            blocoProgressoHTML = `<span class="livro-progresso" style="color: #4a7c59; background: #eaf4ec; border-color: #d1e7d6;">✨ Concluído</span>`;
        } else {
            blocoProgressoHTML = `<span class="livro-progresso" style="color: var(--marrom-cozy, #5c4033); font-style: italic;">求 Quero Ler</span>`;
        }

        cardLivro.innerHTML = `
            <img src="${capaUrl}" alt="Capa do Livro" class="livro-capa">
            <div class="livro-detalhes">
                <div class="livro-info-topo">
                    <h4 class="livro-titulo" title="${livro.titulo}">${livro.titulo}</h4>
                    <p class="livro-autor">${livro.autor || 'Autor não cadastrado'}</p>
                </div>
                <div class="livro-info-base" style="width: 100%;">
                    ${blocoProgressoHTML}
                    <button class="btn-abrir-ficha" data-id="${livro.idDoc}" style="align-self: flex-end; margin-top: 4px;">Ver Ficha</button>
                </div>
            </div>
        `;

        gridLivros.appendChild(cardLivro);

        // Disparador de link para a Ficha de Leitura específica
        cardLivro.querySelector('.btn-abrir-ficha').addEventListener('click', (e) => {
            const idLivro = e.target.getAttribute('data-id');
            window.location.href = `../html/05_ficha.html?id=${idLivro}`;
        });
    });
}

// 4. INTERRUPTOR DE ABAS DO MENU LATERAL
function configurarEventosDoMenu() {
    botoesAba.forEach(botao => {
        botao.addEventListener('click', (e) => {
            const alvo = e.currentTarget; // Garante o elemento pai caso clique no ícone interno i
            botoesAba.forEach(b => b.classList.remove('ativo'));
            alvo.classList.add('ativo');

            statusAtual = alvo.getAttribute('data-status');
            renderizarPrateleira();
        });
    });
}