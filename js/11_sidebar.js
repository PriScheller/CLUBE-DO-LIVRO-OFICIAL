document.addEventListener('DOMContentLoaded', () => {
    // Captura o nome do arquivo atual na URL (ex: '02_dashboard.html')
    const urlPath = window.location.pathname;
    const paginaAtual = urlPath.substring(urlPath.lastIndexOf('/') + 1);

    const linksDeNavegacao = document.querySelectorAll('.nav-link');

    linksDeNavegacao.forEach(link => {
        const hrefAtributo = link.getAttribute('href');

        if (!hrefAtributo) return;

        // Extrai apenas o nome do arquivo final do atributo href (ex: '02_dashboard.html')
        const nomeArquivoLink = hrefAtributo.substring(hrefAtributo.lastIndexOf('/') + 1);

        // Verifica se o arquivo da URL bate com o destino do link do menu
        if (paginaAtual === nomeArquivoLink && nomeArquivoLink !== "") {
            link.classList.add('active');
        }
    });
});