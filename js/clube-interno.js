import { db, auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, updateDoc, arrayUnion, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================================================
// CAPTURA DE PARÂMETROS DA URL
// ==========================================================================
const obterIdUrl = () => {
    const parametros = new URLSearchParams(window.location.search);
    return parametros.get('id');
};
const idClubeAtual = obterIdUrl();

// ==========================================================================
// ELEMENTOS DO DOM
// ==========================================================================
const txtNomeClube = document.getElementById('detalhe-nome-clube');
const txtDescClube = document.getElementById('detalhe-desc-clube');
const txtCodigoClube = document.getElementById('detalhe-codigo');
const txtContadorMembros = document.getElementById('contador-membros');
const badgePrivacidade = document.getElementById('badge-privacidade');

const imgLivroCapa = document.getElementById('livro-capa');
const txtLivroTitulo = document.getElementById('livro-titulo');
const txtLivroAutor = document.getElementById('livro-autor');
const btnMudarLivro = document.getElementById('btn-mudar-livro');

const listaMembrosPrint = document.getElementById('lista-usuarios-print');
const areaAdminAdicionar = document.getElementById('area-admin-adicionar');
const areaAdminSolicitacoes = document.getElementById('area-admin-solicitacoes');
const listaSolicitacoesPrint = document.getElementById('lista-solicitacoes-print');
const formAdicionarMembro = document.getElementById('form-adicionar-membro');
const inputUsernameMembro = document.getElementById('input-username-membro');

let usuarioLogadoUid = null;
let dadosClubeAtual = null;

// ==========================================================================
// MONITOR DE AUTENTICAÇÃO
// ==========================================================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        usuarioLogadoUid = user.uid;
        if (idClubeAtual) {
            inicializarPainelClube();
        } else {
            alert("Clube inválido. Retornando...");
            window.location.href = "clubes.html";
        }
    } else {
        window.location.href = "login.html";
    }
});

// ==========================================================================
// BUSCA DADOS NO FIRESTORE
// ==========================================================================
async function inicializarPainelClube() {
    try {
        const docRef = doc(db, "clubes", idClubeAtual);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            alert("O clube procurado não existe.");
            window.location.href = "clubes.html";
            return;
        }

        dadosClubeAtual = docSnap.data();

        if (!dadosClubeAtual.membrosLista.includes(usuarioLogadoUid) && dadosClubeAtual.adminUid !== usuarioLogadoUid) {
            alert("Acesso negado. Você não faz parte deste clube.");
            window.location.href = "clubes.html";
            return;
        }

        renderizarDadosDoClube();
        verificarNivelPermissao();

    } catch (error) {
        console.error("Erro ao carregar painel:", error);
    }
}

// ==========================================================================
// RENDERIZAÇÃO DA INTERFACE
// ==========================================================================
function renderizarDadosDoClube() {
    txtNomeClube.textContent = dadosClubeAtual.nome;
    txtDescClube.textContent = dadosClubeAtual.descricao || "Sem descrição.";
    txtCodigoClube.textContent = dadosClubeAtual.codigoConvite || "------";
    txtContadorMembros.textContent = dadosClubeAtual.membrosLista ? dadosClubeAtual.membrosLista.length : 0;

    if (badgePrivacidade) {
        const ehPrivado = dadosClubeAtual.privacidade === 'privado';
        badgePrivacidade.textContent = ehPrivado ? "🔒 Privado" : "🌐 Público";
        badgePrivacidade.className = `badge-status ${ehPrivado ? 'status-privado' : 'status-publico'}`;
    }

    if (dadosClubeAtual.livroAtual) {
        txtLivroTitulo.textContent = dadosClubeAtual.livroAtual.titulo || "Nenhum livro em pauta";
        txtLivroAutor.textContent = dadosClubeAtual.livroAtual.autor ? `Por: ${dadosClubeAtual.livroAtual.autor}` : "Autor não registrado";
        imgLivroCapa.src = dadosClubeAtual.livroAtual.capaUrl || "https://placehold.co/120x180/fff0f2/5c4033?text=📖";
    }

    // Renderização da lista de membros ativos mapeando os IDs
    if (listaMembrosPrint && dadosClubeAtual.membrosLista) {
        listaMembrosPrint.innerHTML = "";
        dadosClubeAtual.membrosLista.forEach((membroId) => {
            const linha = document.createElement('div');
            linha.className = "membro-item-linha";
            const tagAdmin = membroId === dadosClubeAtual.adminUid ? " <span class='tag-admin-badge'>Admin</span>" : "";
            
            linha.innerHTML = `
                <p style="margin:0; font-size:0.9rem; color:#333;">
                    <i class="fa-solid fa-user" style="color:#8c6d58; margin-right:6px;"></i> ID: ${membroId.substring(0,8)}...${tagAdmin}
                </p>
            `;
            listaMembrosPrint.appendChild(linha);
        });
    }
}

// ==========================================================================
// CONTROLE DE PERMISSÕES
// ==========================================================================
function verificarNivelPermissao() {
    const ehAdmin = usuarioLogadoUid === dadosClubeAtual.adminUid;

    if (ehAdmin) {
        if (btnMudarLivro) btnMudarLivro.style.display = "inline-block";
        if (areaAdminAdicionar) areaAdminAdicionar.style.display = "block";
        if (areaAdminSolicitacoes) areaAdminSolicitacoes.style.display = "block";
        
        carregarSolicitacoesPendentes();
    } else {
        if (btnMudarLivro) btnMudarLivro.style.display = "none";
        if (areaAdminAdicionar) areaAdminAdicionar.style.display = "none";
        if (areaAdminSolicitacoes) areaAdminSolicitacoes.style.display = "none";
    }
}

function carregarSolicitacoesPendentes() {
    if (!listaSolicitacoesPrint) return;
    const fila = dadosClubeAtual.solicitacoesPendentes || [];
    
    if (fila.length === 0) {
        listaSolicitacoesPrint.innerHTML = `<p style="font-size:0.85rem; color:#888; font-style:italic; margin:5px 0 0 0;">Nenhuma solicitação pendente.</p>`;
        return;
    }

    listaSolicitacoesPrint.innerHTML = "";
    fila.forEach((uidSolicitante) => {
        const item = document.createElement('div');
        item.className = "solicitacao-item-linha";
        item.innerHTML = `
            <span style="font-size:0.85rem; color:#333;">ID: ${uidSolicitante.substring(0,8)}...</span>
            <div class="botoes-decisao">
                <button class="btn-aprovar" data-uid="${uidSolicitante}"><i class="fa-solid fa-check"></i></button>
                <button class="btn-recusar" data-uid="${uidSolicitante}"><i class="fa-solid fa-xmark"></i></button>
            </div>
        `;
        listaSolicitacoesPrint.appendChild(item);
    });
}

// ==========================================================================
// ADICIONAR MEMBRO POR USERNAME (AÇÃO DA OPÇÃO 1)
// ==========================================================================
if (formAdicionarMembro) {
    formAdicionarMembro.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Pega o valor digitado e limpa o caractere '@' caso o admin tenha colocado
        let usernameDigitado = inputUsernameMembro.value.trim().toLowerCase();
        if (usernameDigitado.startsWith('@')) {
            usernameDigitado = usernameDigitado.substring(1);
        }

        if (!usernameDigitado) return;

        try {
            const btnSubmit = formAdicionarMembro.querySelector('button');
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

            // 1. Procura o usuário correspondente na coleção "usuarios" pelo username
            const usuariosRef = collection(db, "usuarios");
            const q = query(usuariosRef, where("username", "==", usernameDigitado));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                alert(`Usuário "@${usernameDigitado}" não foi encontrado no sistema.`);
                return;
            }

            // 2. Captura os dados do usuário encontrado
            let uidEncontrado = null;
            querySnapshot.forEach((docUsuario) => {
                uidEncontrado = docUsuario.data().uid || docUsuario.id;
            });

            // 3. Validações de segurança antes de adicionar
            if (dadosClubeAtual.membrosLista.includes(uidEncontrado)) {
                alert("Este usuário já faz parte do clube! ✨");
                return;
            }

            // 4. Salva o novo membro direto no documento do clube no Firestore
            const clubeDocRef = doc(db, "clubes", idClubeAtual);
            await updateDoc(clubeDocRef, {
                membrosLista: arrayUnion(uidEncontrado)
            });

            alert(`Usuário "@${usernameDigitado}" adicionado com sucesso ao grupo! 🎉`);
            
            // Limpa o campo e recarrega as informações atualizadas da tela
            inputUsernameMembro.value = "";
            inicializalizarPainelClube();

        } catch (error) {
            console.error("Erro ao adicionar membro por username:", error);
            alert("Ocorreu um erro ao tentar processar a adição do membro.");
        } finally {
            const btnSubmit = formAdicionarMembro.querySelector('button');
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = '<i class="fa-solid fa-plus"></i> Add';
        }
    });
}
// ==========================================================================
// LÓGICA DE APROVAÇÃO / RECUSA DE MEMBROS (OPÇÃO 2)
// ==========================================================================

// Ouvinte de cliques na área de solicitações
if (listaSolicitacoesPrint) {
    listaSolicitacoesPrint.addEventListener('click', async (e) => {
        // Encontra o botão que foi clicado (seja no ícone ou no botão em si)
        const botaoAprovar = e.target.closest('.btn-aprovar');
        const botaoRecusar = e.target.closest('.btn-recusar');

        if (!botaoAprovar && !botaoRecusar) return; // Se não clicou em um botão, ignora

        // Captura o UID do solicitante guardado no atributo 'data-uid' do botão
        const uidSolicitante = botaoAprovar ? botaoAprovar.getAttribute('data-uid') : botaoRecusar.getAttribute('data-uid');
        const clubeDocRef = doc(db, "clubes", idClubeAtual);

        try {
            // Desabilita temporariamente os botões daquela linha para evitar cliques duplos
            const containerBotoes = e.target.closest('.botoes-decisao');
            if (containerBotoes) containerBotoes.style.pointerEvents = "none";

            // Criamos arrays locais baseados no estado atual para atualizar o Firebase de uma vez
            let novasSolicitacoes = (dadosClubeAtual.solicitacoesPendentes || []).filter(uid => uid !== uidSolicitante);
            let novosMembros = [...(dadosClubeAtual.membrosLista || [])];

            if (botaoAprovar) {
                // Se aprovado, insere o usuário na lista de membros ativos
                if (!novosMembros.includes(uidSolicitante)) {
                    novosMembros.push(uidSolicitante);
                }
                
                // Atualiza o documento no Firestore com o usuário aprovado
                await updateDoc(clubeDocRef, {
                    solicitacoesPendentes: novasSolicitacoes,
                    membrosLista: novosMembros
                });
                alert("Novo leitor aprovado e adicionado ao clube com sucesso! 📖");
            } 
            
            else if (botaoRecusar) {
                // Se recusado, apenas removemos da fila de espera
                await updateDoc(clubeDocRef, {
                    solicitacoesPendentes: novasSolicitacoes
                });
                alert("Solicitação de entrada recusada.");
            }

            // Atualiza os dados locais e recarrega o painel para refletir a mudança na tela
            inicializarPainelClube();

        } catch (error) {
            console.error("Erro ao processar decisão do administrador:", error);
            alert("Não foi possível processar a ação. Tente novamente.");
        }
    });
}