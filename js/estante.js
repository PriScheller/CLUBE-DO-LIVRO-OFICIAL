import { db, auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const gridLivros = document.getElementById('grid-livros-estante');
const tituloSecaoAtual = document.getElementById('titulo-secao-atual');
const botoesAba = document.querySelectorAll('.btn-aba');

let todosOsLivros = []; // Cache local para alternar abas instantaneamente sem re-consultar o banco
let statusAtual = "lendo"; // Categoria inicial padrão

// Mapeamento de títulos para deixar o cabeçalho dinâmico e amigável
const mapasTitulos = {
    "lendo": "☕ Lendo Atualmente",
    "quero-ler": "📌 Próximas Leituras (Quero Ler)",
    "lidos": "✨ Concluídos (Lidos)"
};

// Mapeamento de mensagens amigáveis para prateleiras vazias
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
        window.location.href = "login.html";
    }
});

// 2. BUSCA TODOS OS LIVROS DO USUÁRIO UMA ÚNICA VEZ
async function carregarDadosIniciais(userId) {
    gridLivros.innerHTML = `<p class="msg-vazio">Organizando suas prateleiras... Aguarde.</p>`;
    try {
        const q = query(collection(db, "livros"), where("userId", "==", userId));
        const querySnapshot = await getDocs(q);
        
        todosOsLivros = [];
        querySnapshot.forEach((doc) => {
            todosOsLivros.push({ idDoc: doc.id, ...doc.data() });
        });

        // Renderiza a aba ativa inicial ("lendo")
        renderizarPrateleira();
        configurarEventosDoMenu();

    } catch (error) {
        console.error("Erro ao puxar dados da estante:", error);
        gridLivros.innerHTML = `<p class="msg-vazio" style="color: red;">Erro ao carregar os livros da sua estante.</p>`;
    }
}

// 3. FILTRA E RENDERIZA OS CARDS NO FORMATO HORIZONTAL COM PROGRESSO VISUAL
function renderizarPrateleira() {
    gridLivros.innerHTML = "";
    tituloSecaoAtual.textContent = mapasTitulos[statusAtual];

    // Filtra o array global pelo status selecionado no menu lateral
    const livrosFiltrados = todosOsLivros.filter(l => l.status === statusAtual);

    if (livrosFiltrados.length === 0) {
        gridLivros.innerHTML = `<p class="msg-vazio">${mensagensVazio[statusAtual]}</p>`;
        return;
    }

    livrosFiltrados.forEach((livro) => {
        const cardLivro = document.createElement('div');
        cardLivro.className = 'livro-card';
        
        const capaUrl = livro.capaUrl || "https://placehold.co/90x130/fff0f2/5c4033?text=📖";

        // Bloco customizável para injetar texto simples ou a estrutura da barra de progresso
        let blocoProgressoHTML = "";

        if (livro.status === 'lendo') {
            const total = parseInt(livro.pagTotal) || 0;
            const atual = parseInt(livro.pagAtual) || 0;
            const porcentagem = (total > 0) ? Math.min(Math.round((atual / total) * 100), 100) : 0;

            // Substituição do texto cru pela estrutura da barra Cozy
            blocoProgressoHTML = `
                <div class="progresso-estante-container" style="margin: 0.3rem 0; width: 100%;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.78rem; font-weight: bold; color: var(--marrom-cozy); margin-bottom: 0.2rem;">
                        <span>${porcentagem}% lido</span>
                        <span style="font-weight: normal; color: #888;">${atual}/${total} pág.</span>
                    </div>
                    <div style="width: 100%; height: 7px; background: #f3ebeb; border-radius: 4px; overflow: hidden; border: 1px solid #ebdada;">
                        <div style="width: ${porcentagem}%; height: 100%; background-color: var(--rosa-pastel-medio); transition: width 0.3s ease;"></div>
                    </div>
                </div>
            `;
        } else if (livro.status === 'lidos') {
            blocoProgressoHTML = `<span class="livro-progresso" style="color: #28a745; font-weight: bold;">✨ Concluído</span>`;
        } else {
            blocoProgressoHTML = `<span class="livro-progresso" style="color: var(--marrom-cozy); font-style: italic;">📌 Planejado</span>`;
        }

        // Monta a estrutura horizontal perfeita preservando as classes originais de detalhes
        cardLivro.innerHTML = `
            <img src="${capaUrl}" alt="Capa do Livro" class="livro-capa">
            <div class="livro-detalhes">
                <div class="livro-info-topo">
                    <h4 class="livro-titulo" title="${livro.titulo}">${livro.titulo}</h4>
                    <p class="livro-autor">${livro.autor || 'Autor não cadastrado'}</p>
                </div>
                <div class="livro-info-base" style="flex-direction: column; align-items: flex-start; gap: 0.4rem; width: 100%;">
                    ${blocoProgressoHTML}
                    <button class="btn-abrir-ficha" data-id="${livro.idDoc}" style="align-self: flex-end; margin-top: 2px;">Ver Ficha</button>
                </div>
            </div>
        `;

        gridLivros.appendChild(cardLivro);

        // Evento do botão para abrir a Ficha de Leitura passando o ID do FireStore por parâmetro
        cardLivro.querySelector('.btn-abrir-ficha').addEventListener('click', (e) => {
            const idLivro = e.target.getAttribute('data-id');
            window.location.href = `ficha.html?id=${idLivro}`;
        });
    });
}

// 4. ESCUTA E GERENCIA A MUDANÇA DE ABAS NO MENU LATERAL
function configurarEventosDoMenu() {
    botoesAba.forEach(botao => {
        botao.addEventListener('click', (e) => {
            // Remove a classe 'ativo' de todos os botões do menu
            botoesAba.forEach(b => b.classList.remove('ativo'));
            
            // Adiciona a classe 'ativo' no botão que foi clicado
            e.target.classList.add('ativo');
            
            // Atualiza o status e renderiza a tela instantaneamente
            statusAtual = e.target.getAttribute('data-status');
            renderizarPrateleira();
        });
    });
}