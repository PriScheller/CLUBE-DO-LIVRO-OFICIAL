import { db, auth } from './12_firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, updateDoc, arrayRemove, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- Configuração de Estado ---
const idClubeAtual = new URLSearchParams(window.location.search).get('id');
let usuarioLogadoUid = null;
let dadosClubeAtual = null;

let anguloAtual = 0;
let estaGirando = false;
const coresFatias = ["#8C6239", "#5C3A21", "#A67C52", "#D9B48F", "#4A3525", "#BF9B7A", "#734A26"];

// --- Elementos do DOM ---
const DOM = {
    btnVoltar: document.getElementById('btn-voltar'),
    listaSugestoes: document.getElementById('lista-sugestoes-print'),
    canvasRoleta: document.getElementById('canvas-roleta'),
    btnSortear: document.getElementById('btn-sortear'),
    boxResultado: document.getElementById('resultado-sorteio-box'),
    txtSorteado: document.getElementById('txt-livro-sorteado'),
    btnDefinirLeitura: document.getElementById('btn-definir-leitura'),
};

// --- Autenticação ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        usuarioLogadoUid = user.uid;
        if (idClubeAtual) {
            escutarDadosClube();
        } else {
            alert("Clube não identificado. Retornando.");
            window.location.href = "../html/06_clubes.html";
        }
    } else {
        window.location.href = "../html/01_login.html";
    }
});

// --- Conexão Firebase Realtime (O Snapshot atualiza a roleta ao vivo caso alguém adicione um livro) ---
function escutarDadosClube() {
    const clubeRef = doc(db, "clubes", idClubeAtual);

    onSnapshot(clubeRef, (docSnap) => {
        if (docSnap.exists()) {
            dadosClubeAtual = docSnap.data();
            const listaLivros = dadosClubeAtual.sugestoesLivros || [];

            renderizarListaSugestoes(listaLivros);
            desenharRoleta(listaLivros);
            gerenciarPermissoesAdmin();
        } else {
            alert("Este clube não existe mais.");
            window.location.href = "../html/06_clubes.html";
        }
    }, (error) => {
        console.error("Erro ao escutar modificações:", error);
    });
}

// --- Renderizar Lista Lateral ---
function renderizarListaSugestoes(lista) {
    if (!DOM.listaSugestoes) return;

    if (lista.length === 0) {
        DOM.listaSugestoes.innerHTML = `<p class="msg-vazia"><i class="fa-solid fa-box-open"></i> Nenhum livro sugerido ainda.</p>`;
        return;
    }

    const ehAdminDoClube = dadosClubeAtual && usuarioLogadoUid === dadosClubeAtual.adminUid;

    DOM.listaSugestoes.innerHTML = "";
    lista.forEach((livro, index) => {
        const numeroPosicao = index + 1;
        const capaCard = livro.capaUrl ? livro.capaUrl : 'https://placehold.co/45x65/fff0f2/5c4033?text=📖';
        const autorCard = livro.autor ? livro.autor : 'Autor Desconhecido';

        const ehDonoDaSugestao = usuarioLogadoUid === livro.adicionadoPorUid;
        const temPermissaoExcluir = ehDonoDaSugestao || ehAdminDoClube;

        const botaoDeletarHTML = temPermissaoExcluir
            ? `<button class="btn-deletar-sugestao" data-index="${index}" title="${ehAdminDoClube && !ehDonoDaSugestao ? 'Remover como Administrador' : 'Remover minha sugestão'}">
                    <i class="fa-solid fa-trash-can"></i>
               </button>`
            : `<span class="tag-sugerido">Membro</span>`;

        const item = document.createElement('div');
        item.className = "sugestao-item-card";
        item.innerHTML = `
            <div class="sugestao-esquerda">
                <span class="badge-posicao">${numeroPosicao}</span>
                <img src="${capaCard}" alt="Capa" class="capa-sugestao-mini">
                <div class="sugestao-detalhes">
                    <p class="sugestao-titulo"><strong>${livro.titulo}</strong></p>
                    <p class="sugestao-autor">${autorCard}</p>
                </div>
            </div>
            <div class="sugestao-direita">
                ${botaoDeletarHTML}
            </div>
        `;
        DOM.listaSugestoes.appendChild(item);
    });
}

// --- Desenhar a Roleta Gráfica no Canvas ---
function desenharRoleta(lista) {
    if (!DOM.canvasRoleta) return;
    const ctx = DOM.canvasRoleta.getContext('2d');
    const qtdFatias = lista.length;
    const centroX = DOM.canvasRoleta.width / 2;
    const centroY = DOM.canvasRoleta.height / 2;
    const raio = centroX - 10;

    ctx.clearRect(0, 0, DOM.canvasRoleta.width, DOM.canvasRoleta.height);

    if (qtdFatias === 0) {
        ctx.beginPath();
        ctx.arc(centroX, centroY, raio, 0, 2 * Math.PI);
        ctx.fillStyle = "#E6D7C3";
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = "#8C6239";
        ctx.stroke();
        ctx.fillStyle = "#8C6239";
        ctx.font = "bold 16px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Adicione livros para ver a roleta", centroX, centroY);
        return;
    }

    const arcoTamanho = (2 * Math.PI) / qtdFatias;

    for (let i = 0; i < qtdFatias; i++) {
        const anguloInicio = anguloAtual + (i * arcoTamanho);
        const anguloFim = anguloInicio + arcoTamanho;

        ctx.beginPath();
        ctx.moveTo(centroX, centroY);
        ctx.arc(centroX, centroY, raio, anguloInicio, anguloFim);
        ctx.fillStyle = coresFatias[i % coresFatias.length];
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#FFF";
        ctx.stroke();

        ctx.save();
        ctx.translate(centroX, centroY);
        ctx.rotate(anguloInicio + arcoTamanho / 2);
        ctx.textAlign = "right";
        ctx.fillStyle = "#FFF";
        ctx.font = "bold 13px sans-serif";

        let textoLivro = lista[i].titulo || "Livro";
        if (textoLivro.length > 20) textoLivro = textoLivro.substring(0, 18) + "...";

        ctx.fillText(textoLivro, raio - 20, 5);
        ctx.restore();
    }

    // Pino central estático
    ctx.beginPath();
    ctx.arc(centroX, centroY, 20, 0, 2 * Math.PI);
    ctx.fillStyle = "#FFF";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#8C6239";
    ctx.stroke();
}

// --- Mecanismo de Física de Giro ---
function girarRoleta() {
    const lista = dadosClubeAtual?.sugestoesLivros || [];
    if (lista.length === 0 || estaGirando) return;

    estaGirando = true;
    if (DOM.boxResultado) DOM.boxResultado.classList.add('hidden');

    let velocidadeGiro = Math.random() * 0.4 + 0.4; // Um pouco mais de variação no impulso inicial
    const desaceleracao = 0.985;

    function animar() {
        velocidadeGiro *= desaceleracao;
        anguloAtual += velocidadeGiro;
        desenharRoleta(lista);

        if (velocidadeGiro > 0.002) {
            requestAnimationFrame(animar);
        } else {
            estaGirando = false;
            computarResultadoSorteio(lista);
        }
    }
    animar();
}

function computarResultadoSorteio(lista) {
    const qtdFatias = lista.length;
    const arcoTamanho = (2 * Math.PI) / qtdFatias;

    // O marcador do topo aponta para 1.5 * Math.PI (270 graus no Canvas)
    const anguloNormalizado = anguloAtual % (2 * Math.PI);
    let indiceSorteado = Math.floor((1.5 * Math.PI - anguloNormalizado) / arcoTamanho);

    if (indiceSorteado < 0) {
        indiceSorteado = Math.floor((1.5 * Math.PI - anguloNormalizado + 2 * Math.PI) / arcoTamanho);
    }
    indiceSorteado = (indiceSorteado % qtdFatias + qtdFatias) % qtdFatias;

    const livroSorteado = lista[indiceSorteado];

    if (DOM.txtSorteado && DOM.boxResultado) {
        DOM.txtSorteado.textContent = livroSorteado.titulo;
        DOM.txtSorteado.dataset.objetoCompleto = JSON.stringify(livroSorteado);
        DOM.boxResultado.classList.remove('hidden');
    }
}

// --- Gerenciar Visibilidade de Admin ---
function gerenciarPermissoesAdmin() {
    if (!dadosClubeAtual) return;
    const ehAdmin = usuarioLogadoUid === dadosClubeAtual.adminUid;
    if (ehAdmin) {
        DOM.btnDefinirLeitura?.classList.remove('hidden');
    } else {
        DOM.btnDefinirLeitura?.classList.add('hidden');
    }
}

if (DOM.btnSortear) DOM.btnSortear.addEventListener('click', girarRoleta);

// --- Remoção da Sugestão ---
if (DOM.listaSugestoes) {
    DOM.listaSugestoes.addEventListener('click', async (e) => {
        const botaoRemover = e.target.closest('.btn-deletar-sugestao');
        if (!botaoRemover) return;

        const indexAlvo = parseInt(botaoRemover.dataset.index);
        const livroAlvo = dadosClubeAtual.sugestoesLivros[indexAlvo];

        if (!livroAlvo) return;

        if (confirm(`Deseja retirar "${livroAlvo.titulo}" da lista de sugestões?`)) {
            try {
                const clubeRef = doc(db, "clubes", idClubeAtual);
                await updateDoc(clubeRef, {
                    sugestoesLivros: arrayRemove(livroAlvo)
                });
            } catch (error) {
                console.error("Erro ao deletar livro:", error);
            }
        }
    });
}

// --- Persistir Escolha como Leitura Oficial ---
if (DOM.btnDefinirLeitura) {
    DOM.btnDefinirLeitura.addEventListener('click', async () => {
        const tituloDefinido = DOM.txtSorteado?.textContent;
        if (!tituloDefinido || tituloDefinido === "Nome do Livro") return;

        try {
            const clubeRef = doc(db, "clubes", idClubeAtual);
            const livroObjetoCompleto = JSON.parse(DOM.txtSorteado.dataset.objetoCompleto);

            await updateDoc(clubeRef, {
                "livroAtual.titulo": livroObjetoCompleto.titulo,
                "livroAtual.autor": livroObjetoCompleto.autor || "Não Informado",
                "livroAtual.capaUrl": livroObjetoCompleto.capaUrl || "",
                sugestoesLivros: arrayRemove(livroObjetoCompleto) // Remove da roleta após virar oficial
            });

            alert(`"${tituloDefinido}" agora é a leitura oficial do clube!`);
            window.location.href = `../html/07_clube-interno.html?id=${idClubeAtual}`;

        } catch (error) {
            console.error("Erro ao atualizar leitura oficial:", error);
            alert("Erro ao tentar salvar a leitura.");
        }
    });
}