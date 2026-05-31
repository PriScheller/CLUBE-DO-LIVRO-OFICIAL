// 1. SELECIONANDO OS ELEMENTOS DO HTML
// Aqui pegamos os botões das abas
const tabLogin = document.getElementById('tab-login');
const tabCadastro = document.getElementById('tab-cadastro');

// Aqui pegamos os dois formulários
const formLogin = document.getElementById('form-login');
const formCadastro = document.getElementById('form-cadastro');

// 2. FUNÇÃO PARA ATIVAR A TELA DE LOGIN
tabLogin.addEventListener('click', () => {
    // Adiciona a classe 'active' no botão Entrar e remove do Criar Conta
    tabLogin.classList.add('active');
    tabCadastro.classList.remove('active');

    // Mostra o formulário de login (remove o 'd-none') e esconde o de cadastro (adiciona o 'd-none')
    formLogin.classList.remove('d-none');
    formCadastro.classList.add('d-none');
});

// 3. FUNÇÃO PARA ATIVAR A TELA DE CADASTRO
tabCadastro.addEventListener('click', () => {
    // Adiciona a classe 'active' no botão Criar Conta e remove do Entrar
    tabCadastro.classList.add('active');
    tabLogin.classList.remove('active');

    // Mostra o formulário de cadastro (remove o 'd-none') e esconde o de login (adiciona o 'd-none')
    formCadastro.classList.remove('d-none');
    formLogin.classList.add('d-none');
});