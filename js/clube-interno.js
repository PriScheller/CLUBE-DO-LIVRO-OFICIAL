import { db, auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- Configuração Inicial ---
const idClubeAtual = new URLSearchParams(window.location.search).get('id');
let usuarioLogadoUid = null;
let dadosClubeAtual = null;

// --- Seleção Centralizada de Elementos DOM ---
const DOM = {
    txtNomeClube: document.getElementById('detalhe-nome-clube'),
    txtDescClube: document.getElementById('detalhe-desc-clube'),
    txtCodigoClube: document.getElementById('detalhe-codigo'),
    txtContadorMembros: document.getElementById('contador-membros'),
    badgePrivacidade: document.getElementById('badge-privacidade'),
    imgLivroCapa: document.getElementById('livro-capa'),
    txtLivroTitulo: document.getElementById('livro-titulo'),
    txtLivroAutor: document.getElementById('livro-autor'),
    listaMembrosPrint: document.getElementById('lista-usuarios-print'),
    listaSolicitacoesPrint: document.getElementById('lista-solicitacoes-print'),
    btnIrSugestoes: document.getElementById('btn-ir-sugestoes'),
    formAdicionarMembro: document.getElementById('form-adicionar-membro'),
    inputUsername: document.getElementById('input-username-membro'),
    areaAdminAdicionar: document.getElementById('area-admin-adicionar'),
    areaAdminSolicitacoes: document.getElementById('area-admin-solicitacoes')
};

// --- Monitor de Autenticação ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        usuarioLogadoUid = user.uid;
        if (idClubeAtual) carregarDadosClube();
    } else {
        window.location.href = "login.html";
    }
});

// --- Carregamento de Dados ---
async function carregarDadosClube() {
    try {
        const docSnap = await getDoc(doc(db, "clubes", idClubeAtual));
        if (docSnap.exists()) {
            dadosClubeAtual = docSnap.data();
            await renderizarPainel();
            gerenciarPermissoes();
        }
    } catch (error) { 
        console.error("Erro ao carregar clube:", error); 
    }
}

// --- Renderização Principal ---
async function renderizarPainel() {
    if (!dadosClubeAtual) return;

    // 1. Informações Básicas
    if (DOM.txtNomeClube) DOM.txtNomeClube.textContent = dadosClubeAtual.nome || "Clube sem nome";
    if (DOM.txtDescClube) DOM.txtDescClube.textContent = dadosClubeAtual.descricao || "Sem descrição.";
    if (DOM.txtCodigoClube) DOM.txtCodigoClube.textContent = dadosClubeAtual.codigoConvite || "------";
    if (DOM.txtContadorMembros) DOM.txtContadorMembros.textContent = dadosClubeAtual.membrosLista?.length || 0;

    // 2. Distintivo de Privacidade
    if (DOM.badgePrivacidade) {
        const ehPrivado = dadosClubeAtual.privacidade === 'privado';
        DOM.badgePrivacidade.textContent = ehPrivado ? "🔒 Privado" : "🌐 Público";
        DOM.badgePrivacidade.className = `badge-status ${ehPrivado ? 'status-privado' : 'status-publico'}`;
    }

    // 3. Bloco do Livro Atual
    if (dadosClubeAtual.livroAtual) {
        if (DOM.txtLivroTitulo) DOM.txtLivroTitulo.textContent = dadosClubeAtual.livroAtual.titulo || "Nenhum livro em pauta";
        if (DOM.txtLivroAutor) DOM.txtLivroAutor.textContent = dadosClubeAtual.livroAtual.autor ? `Por: ${dadosClubeAtual.livroAtual.autor}` : "Autor não registrado";
        if (DOM.imgLivroCapa) DOM.imgLivroCapa.src = dadosClubeAtual.livroAtual.capaUrl || "https://placehold.co/120x180/fff0f2/5c4033?text=📖";
    }

    // 4. Renderização de Membros com Resolução de Usernames e Botões de Ação
    if (DOM.listaMembrosPrint && dadosClubeAtual.membrosLista) {
        DOM.listaMembrosPrint.innerHTML = "";
        
        for (const membroId of dadosClubeAtual.membrosLista) {
            try {
                const userSnap = await getDoc(doc(db, "usuarios", membroId));
                const username = userSnap.exists() ? userSnap.data().username : `id:${membroId.substring(0,5)}`;
                
                const ehAdmin = membroId === dadosClubeAtual.adminUid;
                const ehEuMesmo = membroId === usuarioLogadoUid;
                const souAdminDoClube = dadosClubeAtual.adminUid === usuarioLogadoUid;

                const linha = document.createElement('div');
                linha.className = "membro-item-linha";
                linha.innerHTML = `
                    <p style="margin:0; font-size:0.9rem; color:#333;">
                        <i class="fa-solid fa-user" style="color:#8c6d58; margin-right:6px;"></i> @${username} ${ehAdmin ? '<span class="tag-admin-badge">Admin</span>' : ''}
                    </p>
                    <div>
                        ${(souAdminDoClube && !ehAdmin) ? `<button class="btn-excluir" data-uid="${membroId}" style="color:red; background:none; border:none; cursor:pointer; margin-left:8px;">Excluir</button>` : ''}
                        ${(ehEuMesmo && !ehAdmin) ? `<button class="btn-sair" style="color:orange; background:none; border:none; cursor:pointer; margin-left:8px;">Sair</button>` : ''}
                    </div>
                `;
                DOM.listaMembrosPrint.appendChild(linha);
            } catch (err) {
                console.error("Erro ao buscar dados do membro:", membroId, err);
            }
        }
    }
}

// --- Controle de Permissões e Solicitações ---
function gerenciarPermissoes() {
    // O "?" garante que se dadosClubeAtual for nulo, o código não quebra a tela
    const ehAdmin = usuarioLogadoUid === dadosClubeAtual?.adminUid;
    
    if (DOM.areaAdminAdicionar) {
        DOM.areaAdminAdicionar.style.display = ehAdmin ? "block" : "none";
    }
    if (DOM.areaAdminSolicitacoes) {
        DOM.areaAdminSolicitacoes.style.display = ehAdmin ? "block" : "none";
    }

    if (ehAdmin) {
        carregarSolicitacoesPendentes();
    }
}

function carregarSolicitacoesPendentes() {
    if (!DOM.listaSolicitacoesPrint) return;
    const fila = dadosClubeAtual.solicitacoesPendentes || [];

    if (fila.length === 0) {
        DOM.listaSolicitacoesPrint.innerHTML = `<p style="font-size:0.85rem; color:#888; font-style:italic; margin:5px 0 0 0;">Nenhuma solicitação pendente.</p>`;
        return;
    }

    DOM.listaSolicitacoesPrint.innerHTML = "";
    fila.forEach((uidSolicitante) => {
        const item = document.createElement('div');
        item.className = "solicitacao-item-linha";
        item.innerHTML = `
            <span style="font-size:0.85rem; color:#333;">ID: ${uidSolicitante.substring(0, 8)}...</span>
            <div class="botoes-decisao">
                <button class="btn-aprovar" data-uid="${uidSolicitante}"><i class="fa-solid fa-check"></i></button>
                <button class="btn-recusar" data-uid="${uidSolicitante}"><i class="fa-solid fa-xmark"></i></button>
            </div>
        `;
        DOM.listaSolicitacoesPrint.appendChild(item);
    });
}

// --- Listeners e Eventos de Interação ---

// 1. Redirecionamento do Botão de Sugestões
if (DOM.btnIrSugestoes) {
    DOM.btnIrSugestoes.addEventListener('click', () => {
        if (idClubeAtual) {
            window.location.href = `clube-sugestoes.html?id=${idClubeAtual}`;
        }
    });
}

// 2. Cliques em Excluir Membro ou Sair do Clube
if (DOM.listaMembrosPrint) {
    DOM.listaMembrosPrint.addEventListener('click', async (e) => {
        const btnExcluir = e.target.closest('.btn-excluir');
        const btnSair = e.target.closest('.btn-sair');

        if (!btnExcluir && !btnSair) return;

        const uidAlvo = btnExcluir ? btnExcluir.dataset.uid : usuarioLogadoUid;
        const msg = btnExcluir ? "Remover este membro do clube?" : "Você deseja sair deste clube?";

        if (confirm(msg)) {
            try {
                await updateDoc(doc(db, "clubes", idClubeAtual), {
                    membrosLista: arrayRemove(uidAlvo)
                });
                
                if (btnSair) {
                    window.location.href = "clubes.html";
                } else {
                    carregarDadosClube();
                }
            } catch (error) {
                console.error("Erro ao modificar membros:", error);
                alert("Não foi possível processar a ação.");
            }
        }
    });
}

// 3. Decisão de Solicitações (Aprovar / Recusar)
if (DOM.listaSolicitacoesPrint) {
    DOM.listaSolicitacoesPrint.addEventListener('click', async (e) => {
        const botaoAprovar = e.target.closest('.btn-aprovar');
        const botaoRecusar = e.target.closest('.btn-recusar');

        if (!botaoAprovar && !botaoRecusar) return;

        const uidSolicitante = botaoAprovar ? botaoAprovar.getAttribute('data-uid') : botaoRecusar.getAttribute('data-uid');
        const clubeDocRef = doc(db, "clubes", idClubeAtual);

        try {
            const containerBotoes = e.target.closest('.botoes-decisao');
            if (containerBotoes) containerBotoes.style.pointerEvents = "none";

            let novasSolicitacoes = (dadosClubeAtual.solicitacoesPendentes || []).filter(uid => uid !== uidSolicitante);

            if (botaoAprovar) {
                await updateDoc(clubeDocRef, {
                    solicitacoesPendentes: novasSolicitacoes,
                    membrosLista: arrayUnion(uidSolicitante)
                });
                alert("Novo leitor aprovado com sucesso! 📖");
            } else if (botaoRecusar) {
                await updateDoc(clubeDocRef, {
                    solicitacoesPendentes: novasSolicitacoes
                });
                alert("Solicitação de entrada recusada.");
            }

            carregarDadosClube();
        } catch (error) {
            console.error("Erro ao processar solicitação:", error);
            alert("Erro ao processar a ação.");
        }
    });
}

// 4. Convidar Novo Membro por Form-Inline
if (DOM.formAdicionarMembro) {
    DOM.formAdicionarMembro.addEventListener('submit', async (e) => {
        e.preventDefault();
        let usernameDigitado = DOM.inputUsername.value.trim().toLowerCase().replace('@', '');

        if (!usernameDigitado) return;

        const btnSubmit = DOM.formAdicionarMembro.querySelector('button');
        try {
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

            const q = query(collection(db, "usuarios"), where("username", "==", usernameDigitado));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                alert(`Usuário "@${usernameDigitado}" não foi encontrado.`);
                return;
            }

            const uidEncontrado = querySnapshot.docs[0].data().uid;

            if (dadosClubeAtual.membrosLista.includes(uidEncontrado)) {
                alert("Este usuário já faz parte do clube! ✨");
                return;
            }

            await updateDoc(doc(db, "clubes", idClubeAtual), {
                membrosLista: arrayUnion(uidEncontrado)
            });

            alert(`Usuário "@${usernameDigitado}" adicionado! 🎉`);
            DOM.inputUsername.value = "";
            carregarDadosClube();

        } catch (error) {
            console.error("Erro ao adicionar membro:", error);
            alert("Ocorreu um erro ao processar a adição.");
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = '<i class="fa-solid fa-plus"></i> Add';
        }
    });
}