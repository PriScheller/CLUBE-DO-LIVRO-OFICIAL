import { auth, db } from './12_firebase-config.js';
import { onAuthStateChanged, updatePassword, deleteUser } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- Elementos do DOM ---
const inputEmailAtual = document.getElementById('input-email-atual');
const inputNovaSenha = document.getElementById('input-nova-senha');
const formSeguranca = document.getElementById('form-seguranca');

// Toggles (Switches)
const chkNotifRoleta = document.getElementById('chk-notif-roleta');
const chkNotifChat = document.getElementById('chk-notif-chat');
const chkPrivacidadePerfil = document.getElementById('chk-privacidade-perfil');
const selectTamanhoFonte = document.getElementById('select-tamanho-fonte');
const chkModoNoturno = document.getElementById('chk-modo-noturno');

// Botão de Exclusão
const btnDeletarConta = document.getElementById('btn-deletar-conta');

let usuarioAtual = null;

// --- Monitorar Estado da Autenticação ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        usuarioAtual = user;
        inputEmailAtual.value = user.email; // Preenche o e-mail (desativado para edição)

        // Carrega as preferências salvas no Firestore
        await carregarPreferenciasFirestore(user.uid);

        // Inicializa os ouvintes de eventos para os switches após carregar o estado inicial
        configurarOuvintesToggles();
    } else {
        window.location.href = '../html/01_login.html';
    }
});

// --- Carregar Configurações do Firestore ---
async function carregarPreferenciasFirestore(uid) {
    try {
        const userDocRef = doc(db, "usuarios", uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            const dados = userDocSnap.data();
            const config = dados.configuracoes || {};

            // Define os estados dos elementos com base no banco (ou usa padrões se não existirem)
            chkNotifRoleta.checked = config.notifRoleta !== false; // Padrão true
            chkNotifChat.checked = config.notifChat === true;      // Padrão false
            chkPrivacidadePerfil.checked = config.perfilPublico !== false; // Padrão true
            selectTamanhoFonte.value = config.tamanhoFonte || "padrone";
            chkModoNoturno.checked = config.modoNoturno === true;  // Padrão false

            // Se o modo noturno estiver ativo, já aplica na página atual
            if (config.modoNoturno) {
                document.body.classList.add('dark-cozy-theme'); // Classe opcional para o seu tema escuro
            }
        }
    } catch (error) {
        console.error("Erro ao carregar configurações:", error);
    }
}

// --- Atualizar Preferência Única no Firestore ---
async function salvarPreferencia(chave, valor) {
    if (!usuarioAtual) return;

    try {
        const userDocRef = doc(db, "usuarios", usuarioAtual.uid);

        // Atualiza apenas o nó de configurações para não sobrescrever o resto do perfil
        await updateDoc(userDocRef, {
            [`configuracoes.${chave}`]: valor
        });

        console.log(`Configuração de ${chave} atualizada para:`, valor);
    } catch (error) {
        console.error("Erro ao salvar configuração:", error);
    }
}

// --- Configurar Ouvintes dos Toggles ---
function configurarOuvintesToggles() {
    chkNotifRoleta.addEventListener('change', (e) => salvarPreferencia('notifRoleta', e.target.checked));
    chkNotifChat.addEventListener('change', (e) => salvarPreferencia('notifChat', e.target.checked));
    chkPrivacidadePerfil.addEventListener('change', (e) => salvarPreferencia('perfilPublico', e.target.checked));
    selectTamanhoFonte.addEventListener('change', (e) => salvarPreferencia('tamanhoFonte', e.target.value));

    chkModoNoturno.addEventListener('change', (e) => {
        salvarPreferencia('modoNoturno', e.target.checked);
        // Feedback visual imediato para o usuário
        if (e.target.checked) {
            document.body.classList.add('dark-cozy-theme');
        } else {
            document.body.classList.remove('dark-cozy-theme');
        }
    });
}

// --- Atualização de Senha ---
formSeguranca.addEventListener('submit', async (e) => {
    e.preventDefault();

    const novaSenha = inputNovaSenha.value.trim();

    if (novaSenha.length < 6) {
        alert("A nova senha deve conter pelo menos 6 caracteres.");
        return;
    }

    const btnSenha = document.getElementById('btn-atualizar-senha');
    const textoOriginalBtn = btnSenha.innerHTML;
    btnSenha.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Atualizando...`;
    btnSenha.disabled = true;

    try {
        await updatePassword(usuarioAtual, novaSenha);
        alert("Senha atualizada com sucesso! 🔒");
        inputNovaSenha.value = ""; // Limpa o campo
    } catch (error) {
        console.error("Erro ao atualizar senha:", error);
        // O Firebase exige login recente para trocar senha. Se der erro, avise o usuário:
        if (error.code === 'auth/requires-recent-login') {
            alert("Por segurança, você precisa fazer login novamente antes de alterar a senha.");
            auth.signOut().then(() => window.location.href = '../html/01_login.html');
        } else {
            alert("Erro ao atualizar a senha. Tente novamente.");
        }
    } finally {
        btnSenha.innerHTML = textoOriginalBtn;
        btnSenha.disabled = false;
    }
});

// --- Exclusão de Conta (Zona de Perigo) ---
btnDeletarConta.addEventListener('click', async () => {
    if (!usuarioAtual) return;

    // Confirmação dupla simples via prompt nativo
    const confirmacaoText = "EXCLUIR";
    const entradaUsuario = prompt(`Atenção! Esta ação é irreversível.\nDigite "${confirmacaoText}" para confirmar a exclusão de todos os seus dados:`);

    if (entradaUsuario === confirmacaoText) {
        try {
            const uid = usuarioAtual.uid;

            // 1. Apaga os dados complementares do Firestore
            await deleteDoc(doc(db, "usuarios", uid));

            // 2. Remove o usuário do Firebase Auth
            await deleteUser(usuarioAtual);

            alert("Sua conta foi excluída com sucesso. Sentiremos sua falta! 📖");
            window.location.href = '../html/01_login.html';

        } catch (error) {
            console.error("Erro ao deletar conta:", error);
            if (error.code === 'auth/requires-recent-login') {
                alert("Por motivos de segurança, saia do sistema, faça login novamente e repita o processo de exclusão.");
            } else {
                alert("Houve um erro técnico ao tentar excluir sua conta.");
            }
        }
    } else if (entradaUsuario !== null) {
        alert("Confirmação incorreta. A conta não foi excluída.");
    }
});