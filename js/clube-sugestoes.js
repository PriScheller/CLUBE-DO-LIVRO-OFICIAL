import { db } from './firebase-config.js';
import { doc, getDoc, updateDoc, arrayUnion, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const idClube = new URLSearchParams(window.location.search).get('id');
const formSugestao = document.getElementById('form-adicionar-livro');
const listaPrint = document.getElementById('lista-sugestoes-print');
const imgJarro = document.getElementById('img-jarro');
const btnSortear = document.getElementById('btn-sortear');

let sugestoesAtuais = [];

// 1. Monitorar mudanças no Firestore em tempo real
onSnapshot(doc(db, "clubes", idClube), (doc) => {
    if (doc.exists()) {
        sugestoesAtuais = doc.data().sugestoesLivros || [];
        renderizarLista();
    }
});

// 2. Adicionar Sugestão
formSugestao.addEventListener('submit', async (e) => {
    e.preventDefault();
    const titulo = document.getElementById('input-titulo-sugestao').value;
    
    await updateDoc(doc(db, "clubes", idClube), {
        sugestoesLivros: arrayUnion({ titulo: titulo })
    });
    document.getElementById('input-titulo-sugestao').value = "";
});

// 3. Renderizar Lista
function renderizarLista() {
    listaPrint.innerHTML = sugestoesAtuais.map(s => `
        <div class="sugestao-item">
            <span>${s.titulo}</span>
        </div>
    `).join('');
}

// 4. Lógica do Sorteio
btnSortear.addEventListener('click', async () => {
    if (sugestoesAtuais.length === 0) return alert("Adicione livros ao jarro primeiro!");

    imgJarro.classList.add('shake');
    
    setTimeout(async () => {
        imgJarro.classList.remove('shake');
        
        // Sorteia o livro
        const indiceSorteado = Math.floor(Math.random() * sugestoesAtuais.length);
        const sorteado = sugestoesAtuais[indiceSorteado];
        
        try {
            // Atualiza o documento do clube com o livro sorteado
            const clubeRef = doc(db, "clubes", idClube);
            await updateDoc(clubeRef, {
                livroAtual: {
                    titulo: sorteado.titulo,
                    autor: "Autor a definir", // Pode adicionar um campo no input se quiser
                    capaUrl: "https://placehold.co/120x180/fff0f2/5c4033?text=📖" // Padrão
                }
            });

            alert(`🎉 Parabéns! O livro sorteado foi: "${sorteado.titulo}". Ele já foi definido como a leitura atual do clube!`);
            
        } catch (error) {
            console.error("Erro ao definir livro atual:", error);
            alert("Ocorreu um erro ao definir o livro atual.");
        }
    }, 2000);
});