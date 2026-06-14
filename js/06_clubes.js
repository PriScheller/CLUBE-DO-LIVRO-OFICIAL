import { db, auth } from './12_firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, addDoc, query, where, getDocs, updateDoc, doc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// Mapeamento de Elementos do DOM
// ==========================================

// Modais e Botões de Controle de Fluxo
const modalCriar = document.getElementById('modal-criar-clube');
const btnAbrirCriar = document.getElementById('btn-abrir-criar');
const btnFecharCriar = document.getElementById('btn-fechar-criar');
const formCriarClube = document.querySelector('#modal-criar-clube .modal-form');

const modalEntrar = document.getElementById('modal-entrar-clube');
const btnAbrirEntrar = document.getElementById('btn-abrir-entrar');
const btnFecharEntrar = document.getElementById('btn-fechar-entrar');
const formEntrarCodigo = document.getElementById('form-entrar-codigo');

// Elementos de Formulário Internos
const selectGenero = document.getElementById('genero-clube');
const grupoGeneroOutro = document.getElementById('grupo-genero-outro');
const inputGeneroOutro = document.getElementById('genero-clube-outro');
const selectPrivacidade = document.getElementById('clube-privacidade');

// Grid de Renderização e Filtros
const gridClubes = document.getElementById('grid-clubes-leitura');
const inputBusca = document.getElementById('input-busca-clube');
const msgSemResultados = document.getElementById('msg-sem-resultados');

let usuarioLogadoUid = null;

// ==========================================
// Monitor do Ciclo de Vida da Autenticação
// ==========================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        usuarioLogadoUid = user.uid;
        carregarClubesDoUsuario();
    } else {
        window.location.href = "../html/01_login.html";
    }
});

// Manipulação Dinâmica do Campo Customizado de Gênero
selectGenero?.addEventListener('change', (e) => {
    if (e.target.value === 'Outro') {
        grupoGeneroOutro.style.display = 'block';
        inputGeneroOutro.required = true;
        inputGeneroOutro.focus();
    } else {
        grupoGeneroOutro.style.display = 'none';
        inputGeneroOutro.required = false;
        inputGeneroOutro.value = '';
    }
});

// ==========================================
// Funções Utilitárias e Modais
// ==========================================
function alternarModal(modal, abrir) {
    if (!modal) return;
    if (abrir) {
        modal.classList.add('ativo');
    } else {
        modal.classList.remove('ativo');
    }
}

function gerarCodigoConvite() {
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let resultado = '';
    for (let i = 0; i < 6; i++) {
        resultado += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    return resultado;
}

// Controladores dos Modais (Criar e Entrar)
btnAbrirCriar?.addEventListener('click', () => alternarModal(modalCriar, true));
btnFecharCriar?.addEventListener('click', () => {
    formCriarClube?.reset();
    if (grupoGeneroOutro) grupoGeneroOutro.style.display = 'none';
    alternarModal(modalCriar, false);
});

btnAbrirEntrar?.addEventListener('click', () => alternarModal(modalEntrar, true));
btnFecharEntrar?.addEventListener('click', () => {
    formEntrarCodigo?.reset();
    alternarModal(modalEntrar, false);
});

// ==========================================
// Consultas e Renderização Firestore
// ==========================================
async function carregarClubesDoUsuario() {
    if (!gridClubes || !usuarioLogadoUid) return;
    gridClubes.innerHTML = `<p style="text-align: center; color: #888; grid-column: 1/-1;">Carregando seus clubes... ☕</p>`;

    try {
        const q = query(collection(db, "clubes"), where("membrosLista", "array-contains", usuarioLogadoUid));
        const querySnapshot = await getDocs(q);

        gridClubes.innerHTML = "";
        if (querySnapshot.empty) {
            gridClubes.innerHTML = `<p style="text-align: center; color: #5c4033; grid-column: 1/-1; font-style: italic;">Você ainda não participa de nenhum clube de leitura.</p>`;
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const clube = docSnap.data();
            const idClube = docSnap.id;

            const card = document.createElement('div');
            card.className = 'clube-card';
            card.innerHTML = `
                <div class="clube-card-header">
                    <span class="clube-tag">📖 ${clube.genero || 'Geral'}</span>
                    <span class="clube-membros-count"><i class="fa-solid fa-user-group"></i> ${clube.membrosLista?.length || 0}</span>
                </div>
                <div class="clube-card-body">
                    <h4>${clube.nome}</h4>
                    <p class="clube-descricao">${clube.descricao || "Sem descrição disponível."}</p>
                    <button class="btn-entrar-clube" data-id="${idClube}">Acessar Painel</button>
                </div>
            `;

            card.querySelector('.btn-entrar-clube').addEventListener('click', () => {
                window.location.href = `../html/07_clube-interno.html?id=${idClube}`;
            });

            gridClubes.appendChild(card);
        });
    } catch (error) {
        console.error("Erro catastrófico ao carregar lista de clubes:", error);
        gridClubes.innerHTML = `<p style="text-align: center; color: red; grid-column: 1/-1;">Erro ao carregar dados do painel.</p>`;
    }
}

// ==========================================
// Gravação e Submissão: Criar Novo Clube
// ==========================================
if (formCriarClube) {
    formCriarClube.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nome = document.getElementById('nome-clube').value.trim();
        const descricao = document.getElementById('desc-clube').value.trim();
        const selecaoGenero = selectGenero.value;
        const privacidade = selectPrivacidade.value;

        const generoFinal = selecaoGenero === 'Outro' ? inputGeneroOutro.value.trim() : selecaoGenero;

        const novoClubeDados = {
            nome: nome,
            descricao: descricao || "Sem descrição informada.",
            genero: generoFinal || "Geral",
            codigoConvite: gerarCodigoConvite(),
            adminUid: usuarioLogadoUid,
            membrosLista: [usuarioLogadoUid],
            privacidade: privacidade,
            solicitacoesPendentes: [],
            dataCriacao: new Date().toLocaleDateString('pt-BR'),
            livroAtual: {
                titulo: "Nenhum livro em leitura",
                capaUrl: "https://placehold.co/160x240/fff0f2/5c4033?text=📖"
            }
        };

        try {
            await addDoc(collection(db, "clubes"), novoClubeDados);
            alert(`Clube "${nome}" criado com sucesso! 🎉`);
            formCriarClube.reset();
            if (grupoGeneroOutro) grupoGeneroOutro.style.display = 'none';
            alternarModal(modalCriar, false);
            carregarClubesDoUsuario();
        } catch (error) {
            console.error("Falha ao persistir novo clube no Firestore:", error);
            alert("Erro operacional ao criar o clube.");
        }
    });
}

// ==========================================
// Gravação e Submissão: Entrar com Código
// ==========================================
if (formEntrarCodigo) {
    formEntrarCodigo.addEventListener('submit', async (e) => {
        e.preventDefault();
        const codigoDigitado = document.getElementById('codigo-clube').value.trim().toUpperCase();

        if (!codigoDigitado) return;

        try {
            // Busca o clube correspondente ao código único gerado
            const q = query(collection(db, "clubes"), where("codigoConvite", "==", codigoDigitado));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                alert("Código de convite inválido ou inexistente. 🔍");
                return;
            }

            const docSnap = querySnapshot.docs[0];
            const idClube = docSnap.id;
            const dadosClube = docSnap.data();

            // Verifica se o usuário já faz parte do clube
            if (dadosClube.membrosLista && dadosClube.membrosLista.includes(usuarioLogadoUid)) {
                alert("Você já faz parte deste clube de leitura! 😊");
                formEntrarCodigo.reset();
                alternarModal(modalEntrar, false);
                return;
            }

            // Atualiza a lista de membros de forma atômica no banco de dados
            const clubeRef = doc(db, "clubes", idClube);
            await updateDoc(clubeRef, {
                membrosLista: arrayUnion(usuarioLogadoUid)
            });

            alert(`Ingressado com sucesso no clube: ${dadosClube.nome}! ☕`);
            formEntrarCodigo.reset();
            alternarModal(modalEntrar, false);
            carregarClubesDoUsuario();

        } catch (error) {
            console.error("Erro ao tentar entrar no clube via código:", error);
            alert("Não foi possível processar a entrada no clube.");
        }
    });
}

// ==========================================
// Filtro e Busca Reativa Dinâmica (Front-end)
// ==========================================
if (inputBusca) {
    inputBusca.addEventListener('input', (e) => {
        const termoBusca = e.target.value.toLowerCase().trim();
        const cards = document.querySelectorAll('.clube-card');
        let contadorVisiveis = 0;

        cards.forEach(card => {
            const nomeClube = card.querySelector('h4').textContent.toLowerCase();
            const tagGenero = card.querySelector('.clube-tag');
            const generoClube = tagGenero ? tagGenero.textContent.toLowerCase() : "";

            if (nomeClube.includes(termoBusca) || generoClube.includes(termoBusca)) {
                card.style.display = "flex"; // Grid items mantendo integridade estrutural
                contadorVisiveis++;
            } else {
                card.style.display = "none";
            }
        });

        if (msgSemResultados) {
            msgSemResultados.style.display = (contadorVisiveis === 0 && cards.length > 0) ? "block" : "none";
        }
    });
}