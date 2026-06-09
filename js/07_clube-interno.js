import { db, auth } from './12_firebase-config.js';
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
    areaAdminSolicitacoes: document.getElementById('area-admin-solicitacoes'),

    // Votação
    containerVotacao: document.getElementById('container-votacao'),
    formAdicionarOpcaoVoto: document.getElementById('form-adicionar-opcao-voto'),
    inputVotoTitulo: document.getElementById('input-voto-titulo'),
    inputVotoOp1: document.getElementById('input-voto-op1'),
    inputVotoOp2: document.getElementById('input-voto-op2'),
    inputVotoOp3: document.getElementById('input-voto-op3'),
    inputVotoPrazo: document.getElementById('input-voto-prazo'),
    txtVotoPerguntaAct: document.getElementById('voto-pergunta-ativa'),
    txtVotoPrazoDisplay: document.getElementById('voto-prazo-display'),
    containerHistoricoVotacoes: document.getElementById('historico-votacoes-encerradas'),

    // Comentários do Livro Atual
    listaComentarios: document.getElementById('lista-comentarios-livro'),
    formEnviarComentario: document.getElementById('form-enviar-comentario'),
    inputTextoComentario: document.getElementById('input-texto-comentario'),

    // Restante das Atividades Extras
    listaProgresso: document.getElementById('lista-progresso-membros'),
    inputProgresso: document.getElementById('input-porcentagem-progresso'),
    btnSalvarProgresso: document.getElementById('btn-salvar-progresso'),
    textoMural: document.getElementById('texto-mural-exibicao'),
    adminMuralControle: document.getElementById('admin-mural-controle'),
    textareaMural: document.getElementById('textarea-mural'),
    btnSalvarMural: document.getElementById('btn-salvar-mural'),
    listaHistorico: document.getElementById('lista-historico-livros')
};

// --- Monitor de Autenticação ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        usuarioLogadoUid = user.uid;
        if (idClubeAtual) carregarDadosClube();
    } else {
        window.location.href = "../html/01_login.html";
    }
});

// --- Carregamento de Dados ---
async function carregarDadosClube() {
    try {
        const docSnap = await getDoc(doc(db, "clubes", idClubeAtual));
        if (docSnap.exists()) {
            dadosClubeAtual = docSnap.data();

            await verificarEArquivarVotacaoExpirada(dadosClubeAtual.votacaoAtiva);

            renderizarComentarios(dadosClubeAtual.comentariosLeitura || []);
            renderizarProgressoMembros(dadosClubeAtual.progressoMembros || {});
            renderizarMural(dadosClubeAtual.muralAviso || "", dadosClubeAtual.adminUid);
            renderizarHistorico(dadosClubeAtual.historicoLeituras || []);
            renderizarHistoricoVotacoes(dadosClubeAtual.historicoVotacoes || []);

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

    if (DOM.txtNomeClube) DOM.txtNomeClube.textContent = dadosClubeAtual.nome || "Clube sem nome";
    if (DOM.txtDescClube) DOM.txtDescClube.textContent = dadosClubeAtual.descricao || "Sem descrição.";
    if (DOM.txtCodigoClube) DOM.txtCodigoClube.textContent = dadosClubeAtual.codigoConvite || "------";
    if (DOM.txtContadorMembros) DOM.txtContadorMembros.textContent = dadosClubeAtual.membrosLista?.length || 0;

    if (DOM.badgePrivacidade) {
        const ehPrivado = dadosClubeAtual.privacidade === 'privado';
        DOM.badgePrivacidade.textContent = ehPrivado ? "🔒 Privado" : "🌐 Público";
        DOM.badgePrivacidade.className = `badge-status ${ehPrivado ? 'status-privado' : 'status-publico'}`;
    }

    if (dadosClubeAtual.livroAtual) {
        if (DOM.txtLivroTitulo) DOM.txtLivroTitulo.textContent = dadosClubeAtual.livroAtual.titulo || "Nenhum livro em pauta";
        if (DOM.txtLivroAutor) DOM.txtLivroAutor.textContent = dadosClubeAtual.livroAtual.autor ? `Por: ${dadosClubeAtual.livroAtual.autor}` : "Autor não registrado";
        if (DOM.imgLivroCapa) DOM.imgLivroCapa.src = dadosClubeAtual.livroAtual.capaUrl || "https://placehold.co/120x180/fff0f2/5c4033?text=📖";
    }

    if (DOM.listaMembrosPrint && dadosClubeAtual.membrosLista) {
        DOM.listaMembrosPrint.innerHTML = "";
        for (const membroId of dadosClubeAtual.membrosLista) {
            try {
                const userSnap = await getDoc(doc(db, "usuarios", membroId));
                const username = userSnap.exists() ? userSnap.data().username : `id:${membroId.substring(0, 5)}`;

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

                // Adiciona Event Listeners para botões de gerenciamento de membros
                const btnExcluir = linha.querySelector('.btn-excluir');
                if (btnExcluir) {
                    btnExcluir.addEventListener('click', async () => {
                        if (confirm("Deseja realmente remover este membro?")) {
                            await updateDoc(doc(db, "clubes", idClubeAtual), { membrosLista: arrayRemove(membroId) });
                            carregarDadosClube();
                        }
                    });
                }

                const btnSair = linha.querySelector('.btn-sair');
                if (btnSair) {
                    btnSair.addEventListener('click', async () => {
                        if (confirm("Tem certeza que deseja sair do clube?")) {
                            await updateDoc(doc(db, "clubes", idClubeAtual), { membrosLista: arrayRemove(usuarioLogadoUid) });
                            window.location.href = "index.html"; // Redireciona para a home pós-saída
                        }
                    });
                }

                DOM.listaMembrosPrint.appendChild(linha);
            } catch (err) {
                console.error(err);
            }
        }
    }
}

// --- Controle de Permissões ---
function gerenciarPermissoes() {
    const ehAdmin = usuarioLogadoUid === dadosClubeAtual?.adminUid;
    if (DOM.areaAdminAdicionar) DOM.areaAdminAdicionar.style.display = ehAdmin ? "block" : "none";
    if (DOM.areaAdminSolicitacoes) DOM.areaAdminSolicitacoes.style.display = ehAdmin ? "block" : "none";
    if (ehAdmin) carregarSolicitacoesPendentes();
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

        // Trata a aprovação de novos membros via painel admin
        item.querySelector('.btn-aprovar').addEventListener('click', async () => {
            try {
                await updateDoc(doc(db, "clubes", idClubeAtual), {
                    solicitacoesPendentes: arrayRemove(uidSolicitante),
                    membrosLista: arrayUnion(uidSolicitante)
                });
                carregarDadosClube();
            } catch (err) { console.error(err); }
        });

        // Trata a recusa de novos membros via painel admin
        item.querySelector('.btn-recusar').addEventListener('click', async () => {
            try {
                await updateDoc(doc(db, "clubes", idClubeAtual), {
                    solicitacoesPendentes: arrayRemove(uidSolicitante)
                });
                carregarDadosClube();
            } catch (err) { console.error(err); }
        });

        DOM.listaSolicitacoesPrint.appendChild(item);
    });
}

// --- Event Listeners Auxiliares ---
if (DOM.btnIrSugestoes) {
    DOM.btnIrSugestoes.addEventListener('click', () => {
        if (idClubeAtual) window.location.href = `../html/08_clube-sugestoes.html?id=${idClubeAtual}`;
    });
}

if (DOM.formAdicionarMembro) {
    DOM.formAdicionarMembro.addEventListener('submit', async (e) => {
        e.preventDefault();
        let usernameDigitado = DOM.inputUsername.value.trim().toLowerCase().replace('@', '');
        if (!usernameDigitado) return;
        try {
            const q = query(collection(db, "usuarios"), where("username", "==", usernameDigitado));
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) return alert(`Usuário "@${usernameDigitado}" não encontrado.`);
            const uidEncontrado = querySnapshot.docs[0].data().uid;
            if (dadosClubeAtual.membrosLista.includes(uidEncontrado)) return alert("Membro já inserido!");

            await updateDoc(doc(db, "clubes", idClubeAtual), { membrosLista: arrayUnion(uidEncontrado) });
            DOM.inputUsername.value = "";
            carregarDadosClube();
        } catch (error) { console.error(error); }
    });
}

// ===================================================
// LÓGICA DE VOTAÇÃO: TÍTULO, OPÇÕES E ARQUIVAMENTO
// ===================================================

async function verificarEArquivarVotacaoExpirada(votacao) {
    if (!votacao || !votacao.prazoLimite) {
        renderizarVotacaoAtiva(votacao);
        return;
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const [ano, mes, dia] = votacao.prazoLimite.split('-');
    const dataLimite = new Date(ano, mes - 1, dia);

    if (hoje > dataLimite) {
        try {
            await updateDoc(doc(db, "clubes", idClubeAtual), {
                historicoVotacoes: arrayUnion(votacao),
                votacaoAtiva: null
            });
            const novoSnap = await getDoc(doc(db, "clubes", idClubeAtual));
            dadosClubeAtual = novoSnap.data();
            renderizarVotacaoAtiva(null);
        } catch (err) {
            console.error("Erro ao arquivar cédula antiga:", err);
        }
    } else {
        renderizarVotacaoAtiva(votacao);
    }
}

function renderizarVotacaoAtiva(votacao) {
    if (!DOM.containerVotacao) return;

    if (!votacao || !votacao.opcoes || votacao.opcoes.length === 0) {
        if (DOM.txtVotoPerguntaAct) DOM.txtVotoPerguntaAct.textContent = "";
        if (DOM.txtVotoPrazoDisplay) DOM.txtVotoPrazoDisplay.textContent = "";
        DOM.containerVotacao.innerHTML = `<p class="msg-vazia" style="font-size:0.85rem;">Nenhuma cédula aberta no momento.</p>`;
        return;
    }

    if (DOM.txtVotoPerguntaAct) DOM.txtVotoPerguntaAct.textContent = `❓ Pergunta: ${votacao.titulo}`;
    if (DOM.txtVotoPrazoDisplay) {
        const [ano, mes, dia] = votacao.prazoLimite.split('-');
        DOM.txtVotoPrazoDisplay.textContent = `Votações abertas até: ${dia}/${mes}/${ano}`;
    }

    DOM.containerVotacao.innerHTML = "";
    votacao.opcoes.forEach((opcao, index) => {
        const totalVotos = opcao.votos ? opcao.votos.length : 0;

        const cardOpcao = document.createElement('div');
        cardOpcao.className = "opcao-voto-card";
        cardOpcao.innerHTML = `
            <div class="voto-info">
                <strong>${opcao.titulo}</strong>
                <small class="tag-votos-qtd" style="display:block; margin-top:4px; color:#8C6239;"><i class="fa-solid fa-check-to-slot"></i> ${totalVotos} votos</small>
            </div>
            <button class="btn-votar-opcao" data-index="${index}" style="background-color:#5C3A21; color:#fff; border:none; padding:5px 12px; border-radius:4px; cursor:pointer;">
                Votar
            </button>
        `;
        DOM.containerVotacao.appendChild(cardOpcao);
    });

    DOM.containerVotacao.querySelectorAll('.btn-votar-opcao').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const indexOpcao = parseInt(e.target.closest('.btn-votar-opcao').dataset.index);
            await registrarVotoNoBanco(indexOpcao, votacao);
        });
    });
}

if (DOM.formAdicionarOpcaoVoto) {
    DOM.formAdicionarOpcaoVoto.addEventListener('submit', async (e) => {
        e.preventDefault();

        const tituloPergunta = DOM.inputVotoTitulo.value.trim();
        const opcoesPreenchidas = [];
        const prazoDefinido = DOM.inputVotoPrazo.value;

        if (DOM.inputVotoOp1.value.trim()) opcoesPreenchidas.push({ titulo: DOM.inputVotoOp1.value.trim(), votos: [] });
        if (DOM.inputVotoOp2.value.trim()) opcoesPreenchidas.push({ titulo: DOM.inputVotoOp2.value.trim(), votos: [] });
        if (DOM.inputVotoOp3.value.trim()) opcoesPreenchidas.push({ titulo: DOM.inputVotoOp3.value.trim(), votos: [] });

        if (opcoesPreenchidas.length < 1) return alert("Adicione ao menos uma opção para a cédula.");

        const novaCedulaVotacao = {
            titulo: tituloPergunta,
            prazoLimite: prazoDefinido,
            opcoes: opcoesPreenchidas
        };

        try {
            await updateDoc(doc(db, "clubes", idClubeAtual), { votacaoAtiva: novaCedulaVotacao });
            DOM.formAdicionarOpcaoVoto.reset();
            alert("Votação aberta com sucesso! 🗳️");
            carregarDadosClube();
        } catch (err) {
            console.error("Erro ao criar votação:", err);
        }
    });
}

async function registrarVotoNoBanco(index, votacao) {
    const opcoesAtualizadas = [...votacao.opcoes];
    opcoesAtualizadas.forEach(op => {
        if (!op.votos) op.votos = [];
        op.votos = op.votos.filter(uid => uid !== usuarioLogadoUid);
    });

    opcoesAtualizadas[index].votos.push(usuarioLogadoUid);

    try {
        await updateDoc(doc(db, "clubes", idClubeAtual), { "votacaoAtiva.opcoes": opcoesAtualizadas });
        carregarDadosClube();
    } catch (err) { console.error(err); }
}

function renderizarHistoricoVotacoes(listaVotacoesAntigas) {
    if (!DOM.containerHistoricoVotacoes) return;

    if (listaVotacoesAntigas.length === 0) {
        DOM.containerHistoricoVotacoes.innerHTML = `<p class="msg-vazia" style="font-size:0.8rem; color:#999; font-style:italic;">Nenhuma votação antiga arquivada.</p>`;
        return;
    }

    DOM.containerHistoricoVotacoes.innerHTML = "";
    listaVotacoesAntigas.forEach(vot => {
        const bloco = document.createElement('div');
        bloco.style.cssText = "background: #F9F5F0; padding: 10px; border-radius: 6px; border-left: 4px solid #BF9B7A; font-size: 0.85rem; margin-bottom: 8px;";

        let htmlOpcoesResultados = "";
        vot.opcoes.forEach(op => {
            htmlOpcoesResultados += `<div style="display:flex; justify-content:space-between; margin-top:3px; color:#555;">
                <span>• ${op.titulo}</span>
                <strong>${op.votos ? op.votos.length : 0} votos</strong>
            </div>`;
        });

        const [ano, mes, dia] = vot.prazoLimite.split('-');
        bloco.innerHTML = `
            <div style="font-weight:bold; color:#4A3525; margin-bottom:4px;">${vot.titulo}</div>
            <div style="font-size:0.75rem; color:#888; margin-bottom:6px;">Encerrada em: ${dia}/${mes}/${ano}</div>
            ${htmlOpcoesResultados}
        `;
        DOM.containerHistoricoVotacoes.appendChild(bloco);
    });
}

// ===================================================
// RECURSO EXTRA: COMENTÁRIOS DO LIVRO ATUAL
// ===================================================
function renderizarComentarios(comentariosArray) {
    if (!DOM.listaComentarios) return;

    const livroEmPauta = dadosClubeAtual?.livroAtual?.titulo || "Nenhum";
    const comentariosFiltrados = comentariosArray.filter(c => c.livroReferencia === livroEmPauta);

    if (comentariosFiltrados.length === 0) {
        DOM.listaComentarios.innerHTML = `<p class="msg-vazia" style="font-size:0.85rem; text-align:center; color:#999;">Ninguém comentou sobre "${livroEmPauta}" ainda. Comece a discussão!</p>`;
        return;
    }

    DOM.listaComentarios.innerHTML = "";
    comentariosFiltrados.forEach(com => {
        const itemComentario = document.createElement('div');
        itemComentario.style.cssText = "background: #FFF; padding: 6px 10px; border-radius: 6px; border: 1px solid #F0E6D8; font-size: 0.85rem; margin-bottom: 6px;";
        itemComentario.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom: 2px;">
                <strong style="color: #734A26;">@${com.autorNome}</strong>
                <span style="font-size: 0.75rem; color: #AAA;">${new Date(com.dataEnvio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <p style="margin: 0; color: #4A3525;">${com.texto}</p>
        `;
        DOM.listaComentarios.appendChild(itemComentario);
    });

    DOM.listaComentarios.scrollTop = DOM.listaComentarios.scrollHeight;
}

if (DOM.formEnviarComentario) {
    DOM.formEnviarComentario.addEventListener('submit', async (e) => {
        e.preventDefault();
        const textoDigitado = DOM.inputTextoComentario.value.trim();
        const livroEmPauta = dadosClubeAtual?.livroAtual?.titulo || "Nenhum";

        if (!textoDigitado) return;
        const autorNome = auth.currentUser.displayName || "Membro";

        const novoComentarioObjeto = {
            texto: textoDigitado,
            autorNome: autorNome,
            autorUid: usuarioLogadoUid,
            livroReferencia: livroEmPauta,
            dataEnvio: new Date().toISOString()
        };

        try {
            await updateDoc(doc(db, "clubes", idClubeAtual), { comentariosLeitura: arrayUnion(novoComentarioObjeto) });
            DOM.inputTextoComentario.value = "";
            carregarDadosClube();
        } catch (err) { console.error(err); }
    });
}

// ===================================================
// RECURSOS COMPLEMENTARES (PROGRESSO, MURAL, HISTÓRICO)
// ===================================================
function renderizarProgressoMembros(progressoMap) {
    if (!DOM.listaProgresso) return;
    const uids = Object.keys(progressoMap);
    if (uids.length === 0) {
        DOM.listaProgresso.innerHTML = `<p class="msg-vazia">Nenhum membro registrou progresso.</p>`;
        return;
    }
    DOM.listaProgresso.innerHTML = "";
    uids.forEach(uid => {
        const dadosMembro = progressoMap[uid];
        const porcentagem = dadosMembro.porcentagem || 0;
        const itemProgresso = document.createElement('div');
        itemProgresso.className = "membro-progresso-item";
        itemProgresso.innerHTML = `
            <div class="membro-progresso-topo"><span>${dadosMembro.nome || "Leitor"}</span><strong>${porcentagem}%</strong></div>
            <div class="barra-progresso-fundo"><div class="barra-progresso-preenchimento" style="width: ${porcentagem}%"></div></div>
        `;
        DOM.listaProgresso.appendChild(itemProgresso);
    });
}

if (DOM.btnSalvarProgresso) {
    DOM.btnSalvarProgresso.addEventListener('click', async () => {
        const valor = parseInt(DOM.inputProgresso.value);
        if (isNaN(valor) || valor < 0 || valor > 100) return alert("De 0 a 100%");
        try {
            await updateDoc(doc(db, "clubes", idClubeAtual), {
                [`progressoMembros.${usuarioLogadoUid}`]: { nome: auth.currentUser.displayName || "Membro", porcentagem: valor }
            });
            carregarDadosClube();
        } catch (err) { console.error(err); }
    });
}

function renderizarMural(textoAviso, adminUid) {
    if (!DOM.textoMural) return;
    DOM.textoMural.textContent = textoAviso || "Nenhum aviso importante fixado pelo moderador.";
    if (usuarioLogadoUid === adminUid) DOM.adminMuralControle?.classList.remove('hidden');
    else DOM.adminMuralControle?.classList.add('hidden');
}

if (DOM.btnSalvarMural) {
    DOM.btnSalvarMural.addEventListener('click', async () => {
        try {
            await updateDoc(doc(db, "clubes", idClubeAtual), { muralAviso: DOM.textareaMural.value.trim() });
            DOM.textareaMural.value = "";
            carregarDadosClube();
        } catch (err) { console.error(err); }
    });
}

// Otimização simples para evitar estouro de margem na lista
function renderizarHistorico(listaHistorico) {
    if (!DOM.listaHistorico) return;
    if (listaHistorico.length === 0) {
        DOM.listaHistorico.innerHTML = `<p class="msg-vazia">Nenhum livro concluído.</p>`;
        return;
    }
    DOM.listaHistorico.innerHTML = "";
    listaHistorico.forEach(livro => {
        let estrelasHTML = "";
        const notaNumerica = Math.round(livro.notaMedia || 0);
        for (let i = 1; i <= 5; i++) estrelasHTML += i <= notaNumerica ? `<i class="fa-solid fa-star"></i>` : `<i class="fa-regular fa-star"></i>`;
        const cardHist = document.createElement('div');
        cardHist.className = "historico-card";
        cardHist.innerHTML = `
            <img src="${livro.capaUrl || 'https://placehold.co/45x65/fff0f2/5c4033?text=📖'}" class="capa-historico">
            <div class="detalhes-historico">
                <h4>${livro.titulo}</h4><p>Por: ${livro.autor || 'Desconhecido'}</p>
                <div class="estrelas-media">${estrelasHTML}</div>
            </div>`;
        DOM.listaHistorico.appendChild(cardHist);
    });
}