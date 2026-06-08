document.addEventListener('DOMContentLoaded', () => {
    const caminhosUrl = window.location.pathname;
    const paginaAtual = caminhosUrl.substring(caminhosUrl.lastIndexOf('/') + 1);

    const linksDeNavegacao = document.querySelectorAll('.nav-link');
    linksDeNavegacao.forEach(link => {
        const hrefAtributo = link.getAttribute('href');
        
        // Compara se o arquivo atual bate com o link
        if (paginaAtual === hrefAtributo) {
            link.classList.add('active');
        }
    });
});