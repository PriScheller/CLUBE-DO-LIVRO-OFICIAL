import { db, auth } from './12_firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// Mapeamento de Elementos do DOM
// ==========================================

// Dados de Exibição do Livro
const txtTitulo = document.getElementById('txt-titulo');
const txtAutor = document.getElementById('txt-autor');
const txtEditora = document.getElementById('txt-editora');
const txtGenero = document.getElementById('txt-genero');
const imgCapa = document.getElementById('ficha-capa');

// Formulário de Metadados e Progresso
const inputEdicao = document.getElementById('input-edicao');
const inputPaginas = document.getElementById('input-paginas');
const inputPagAtual = document.getElementById('input-pag-atual');
const labelPorcentagem = document.getElementById('label-porcentagem');
const inputDataInicio = document.getElementById('input-data-inicio');
const inputDataTermino = document.getElementById('input-data-termino');
const btnFavorito = document.getElementById('btn-favorito-coracao');
const iconeCoracao = document.getElementById('icone-coracao');

// Componente Interativo de Avaliação
const containerEstrelas = document.getElementById('estrelas-interativas-container');
const notaDisplayTexto = document.getElementById('nota-display-texto');

// Seção de Comentários e Persistência Global
const textareaNovoComentario = document.getElementById('textarea-novo-comentario');
const btnAdicionarComentario = document.getElementById('btn-adicionar-comentario');
const containerHistoricoComentarios = document.getElementById('container-historico-comentarios');
const btnSalvarFichaGlobal = document.getElementById('btn-salvar-ficha-inteira');

// ==========================================
// Gerenciamento de Estado da Aplicação
// ==========================================
let idLivroAtual = null;
let livroDadosGlobais = {};
let ehFavorito = false;
let notaSelecionada = 0.0;

// Extração segura do ID do livro via Query String da URL
const params = new URLSearchParams(window.location.search);
idLivroAtual = params.get('id');

// ==========================================
// Monitor do Ciclo de Vida da Autenticação
// ==========================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        if (idLivroAtual) {
            puxarDadosDoLivro();
            inicializarSistemaDeEstrelas();
            configurarCalculoPorcentagem();
            configurarFormatadorTexto();
        } else {
            console.error("ID do livro ausente nos parâmetros de URL.");
            window.location.href = "../html/04_estante.html";
        }
    } else {
        window.location.href = "../html/01_login.html";
    }
});

// ==========================================
// Requisições e Renderização Firestore
// ==========================================
async function puxarDadosDoLivro() {
    try {
        const docRef = doc(db, "livros", idLivroAtual);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            livroDadosGlobais = docSnap.data();

            // População dos campos de texto estáticos
            if (txtTitulo) txtTitulo.textContent = livroDadosGlobais.titulo || "Sem título";
            if (txtAutor) txtAutor.textContent = livroDadosGlobais.autor || "Autor não informado";
            if (txtEditora) txtEditora.textContent = livroDadosGlobais.editora || "Não informada";
            if (txtGenero) txtGenero.textContent = livroDadosGlobais.genero || "Geral";
            if (imgCapa) imgCapa.src = livroDadosGlobais.capaUrl || "https://placehold.co/160x240/fff0f2/5c4033?text=📖";

            // População de Inputs Editáveis
            if (inputEdicao) inputEdicao.value = livroDadosGlobais.edicao || "";
            if (inputPaginas) inputPaginas.value = livroDadosGlobais.pagTotal || "";
            if (inputPagAtual) inputPagAtual.value = livroDadosGlobais.pagAtual || "";
            if (inputDataInicio) inputDataInicio.value = livroDadosGlobais.dataInicio || "";
            if (inputDataTermino) inputDataTermino.value = livroDadosGlobais.dataTermino || "";

            // Tratamento de Nota e Favoritos
            notaSelecionada = parseFloat(livroDadosGlobais.nota) || 0.0;
            atualizarVisualEstrelas(notaSelecionada);

            ehFavorito = livroDadosGlobais.favorito || false;
            atualizarVisualCoracao();
            calcularEMostrarPorcentagem();

            // Sincronização dos Radios de Formato
            if (livroDadosGlobais.formatoLeitura) {
                const radio = document.querySelector(`input[name="formatoLeitura"][value="${livroDadosGlobais.formatoLeitura}"]`);
                if (radio) radio.checked = true;
            }

            // Histórico de Comentários / Diário de Bordo
            renderizarComentarios(livroDadosGlobais.comentariosLista || []);
        } else {
            console.error("Nenhum registro de livro correspondente no Firebase.");
        }
    } catch (error) {
        console.error("Falha ao recuperar dados do Firestore:", error);
    }
}

// ==========================================
// Lógica Complexa de Classificação (Estrelas)
// ==========================================
function inicializarSistemaDeEstrelas() {
    if (!containerEstrelas) return;
    const caixasEstrelas = containerEstrelas.querySelectorAll('.estrela-box');

    caixasEstrelas.forEach(box => {
        const indexEstrela = parseInt(box.getAttribute('data-index'));

        box.querySelector('.metade-esquerda').addEventListener('click', (e) => {
            e.stopPropagation();
            notaSelecionada = indexEstrela - 0.5;
            atualizarVisualEstrelas(notaSelecionada);
        });

        box.querySelector('.metade-direita').addEventListener('click', (e) => {
            e.stopPropagation();
            notaSelecionada = indexEstrela;
            atualizarVisualEstrelas(notaSelecionada);
        });
    });
}

function atualizarVisualEstrelas(nota) {
    if (notaDisplayTexto) notaDisplayTexto.textContent = `(${nota.toFixed(1)})`;
    if (!containerEstrelas) return;

    const caixasEstrelas = containerEstrelas.querySelectorAll('.estrela-box');
    caixasEstrelas.forEach(box => {
        const indexEstrela = parseInt(box.getAttribute('data-index'));
        const icone = box.querySelector('i');
        box.classList.remove('marcada-cheia', 'marcada-metade');
        icone.className = "fa-regular fa-star";

        if (indexEstrela <= nota) {
            box.classList.add('marcada-cheia');
            icone.className = "fa-solid fa-star";
        } else if (indexEstrela - 0.5 === nota) {
            box.classList.add('marcada-metade');
            icone.className = "fa-solid fa-star-half-stroke";
        }
    });
}

// ==========================================
// Métrica de Evolução de Progresso (%)
// ==========================================
function configurarCalculoPorcentagem() {
    if (inputPaginas) inputPaginas.addEventListener('input', calcularEMostrarPorcentagem);
    if (inputPagAtual) inputPagAtual.addEventListener('input', calcularEMostrarPorcentagem);
}

function calcularEMostrarPorcentagem() {
    if (!inputPaginas || !inputPagAtual || !labelPorcentagem) return;
    const total = parseInt(inputPaginas.value) || 0;
    const atual = parseInt(inputPagAtual.value) || 0;

    if (total > 0 && atual >= 0) {
        const porc = Math.min(Math.round((atual / total) * 100), 100);
        labelPorcentagem.textContent = `${porc}% lido`;
    } else {
        labelPorcentagem.textContent = `0% lido`;
    }
}

// ==========================================
// Interação do Marcador de Favoritos
// ==========================================
if (btnFavorito) {
    btnFavorito.addEventListener('click', (e) => {
        e.preventDefault();
        ehFavorito = !ehFavorito;
        atualizarVisualCoracao();
    });
}

function atualizarVisualCoracao() {
    if (!iconeCoracao || !btnFavorito) return;
    if (ehFavorito) {
        iconeCoracao.className = "fa-solid fa-heart";
        btnFavorito.classList.add('ativo');
    } else {
        iconeCoracao.className = "fa-regular fa-heart";
        btnFavorito.classList.remove('ativo');
    }
}

// ==========================================
// Editor com Tags Rico e Emojis
// ==========================================
function configurarFormatadorTexto() {
    if (!textareaNovoComentario) return;

    const aplicarTag = (tagAbre, tagFecha) => {
        const start = textareaNovoComentario.selectionStart;
        const end = textareaNovoComentario.selectionEnd;
        const textoCompleto = textareaNovoComentario.value;
        const selecionado = textoCompleto.substring(start, end);

        const novoTexto = textoCompleto.substring(0, start) + tagAbre + selecionado + tagFecha + textoCompleto.substring(end);
        textareaNovoComentario.value = novoTexto;
        textareaNovoComentario.focus();
        textareaNovoComentario.setSelectionRange(start + tagAbre.length, start + tagAbre.length + selecionado.length);
    };

    document.getElementById('btn-format-b')?.addEventListener('click', (e) => { e.preventDefault(); aplicarTag('<b>', '</b>'); });
    document.getElementById('btn-format-i')?.addEventListener('click', (e) => { e.preventDefault(); aplicarTag('<i>', '</i>'); });
    document.getElementById('btn-format-u')?.addEventListener('click', (e) => { e.preventDefault(); aplicarTag('<u>', '</u>'); });

    // Manipulação dinâmica para inserção de Emojis
    document.querySelectorAll('.emoji-option').forEach(emojiSpan => {
        emojiSpan.addEventListener('click', (e) => {
            e.preventDefault();
            const emoji = emojiSpan.textContent;
            const start = textareaNovoComentario.selectionStart;
            const end = textareaNovoComentario.selectionEnd;
            const textoCompleto = textareaNovoComentario.value;

            textareaNovoComentario.value = textoCompleto.substring(0, start) + emoji + textoCompleto.substring(end);
            textareaNovoComentario.focus();
            textareaNovoComentario.setSelectionRange(start + emoji.length, start + emoji.length);
        });
    });
}

// ==========================================
// Inserção e Remoção de Comentários (Array Firebase)
// ==========================================
if (btnAdicionarComentario) {
    btnAdicionarComentario.addEventListener('click', async (e) => {
        e.preventDefault();
        const texto = textareaNovoComentario.value.trim();
        if (!texto) return;

        const novoComentario = {
            id: Date.now().toString(),
            data: new Date().toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            conteudo: texto
        };

        if (!livroDadosGlobais.comentariosLista) livroDadosGlobais.comentariosLista = [];
        livroDadosGlobais.comentariosLista.unshift(novoComentario);

        try {
            const docRef = doc(db, "livros", idLivroAtual);
            await updateDoc(docRef, { comentariosLista: livroDadosGlobais.comentariosLista });
            textareaNovoComentario.value = "";
            renderizarComentarios(livroDadosGlobais.comentariosLista);
        } catch (err) {
            console.error("Erro ao inserir comentário no banco:", err);
            alert("Erro ao salvar comentário. Tente novamente.");
        }
    });
}

function renderizarComentarios(lista) {
    if (!containerHistoricoComentarios) return;
    containerHistoricoComentarios.innerHTML = "";

    if (lista.length === 0) {
        containerHistoricoComentarios.innerHTML = `<p style="text-align:center; color:#aaa; font-size:0.9rem; font-style:italic;">Nenhum comentário adicionado ainda.</p>`;
        return;
    }

    lista.forEach((coment) => {
        const div = document.createElement('div');
        div.className = 'item-comentario';
        div.innerHTML = `
            <div class="meta-comentario">
                <span>📅 ${coment.data}</span>
                <button class="btn-deletar-comentario" data-id="${coment.id}" title="Excluir Comentário">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
            <p class="texto-comentario">${coment.conteudo}</p>
        `;

        // Atribuição de evento diretamente ao nó gerado
        div.querySelector('.btn-deletar-comentario').addEventListener('click', async (e) => {
            const idComent = e.currentTarget.getAttribute('data-id');
            livroDadosGlobais.comentariosLista = livroDadosGlobais.comentariosLista.filter(c => c.id !== idComent);

            try {
                const docRef = doc(db, "livros", idLivroAtual);
                await updateDoc(docRef, { comentariosLista: livroDadosGlobais.comentariosLista });
                renderizarComentarios(livroDadosGlobais.comentariosLista);
            } catch (error) {
                console.error("Erro ao remover comentário da lista:", error);
            }
        });

        containerHistoricoComentarios.appendChild(div);
    });
}

// ==========================================
// Persistência Completa dos Dados da Ficha
// ==========================================
if (btnSalvarFichaGlobal) {
    btnSalvarFichaGlobal.addEventListener('click', async () => {
        btnSalvarFichaGlobal.disabled = true;
        const textoOriginalBotao = btnSalvarFichaGlobal.innerHTML;
        btnSalvarFichaGlobal.textContent = "Salvando alterações...";

        const radioChecked = document.querySelector('input[name="formatoLeitura"]:checked');
        const formatoSelecionado = radioChecked ? radioChecked.value : "Livro Físico";

        const dadosAtualizados = {
            edicao: inputEdicao.value.trim(),
            pagTotal: parseInt(inputPaginas.value) || 0,
            pagAtual: parseInt(inputPagAtual.value) || 0,
            dataInicio: inputDataInicio.value,
            dataTermino: inputDataTermino.value,
            nota: notaSelecionada,
            favorito: ehFavorito,
            formatoLeitura: formatoSelecionado
        };

        try {
            const docRef = doc(db, "livros", idLivroAtual);
            await updateDoc(docRef, dadosAtualizados);

            // Fusão de segurança com os dados de cache locais
            livroDadosGlobais = { ...livroDadosGlobais, ...dadosAtualizados };

            alert("Ficha de leitura salva com sucesso! ✨");
        } catch (error) {
            console.error("Erro ao persistir atualizações globais:", error);
            alert("Não foi possível salvar os dados da ficha.");
        } finally {
            btnSalvarFichaGlobal.disabled = false;
            btnSalvarFichaGlobal.innerHTML = textoOriginalBotao;
        }
    });
}