$(document).ready(function() {
    
    carregarLocalidades(); // Carrega as localidades quando a página é carregada

    $('#statusSelect').select2({
        theme: 'bootstrap-5',
        placeholder: "Selecione os status",
        allowClear: true,
        width: '100%'
    });
    
    $('#tipoChecklistSelect').select2({
        theme: 'bootstrap-5',
        placeholder: "Selecione o(s) tipo(s) de checklist",
        allowClear: true,
        width: '100%'
    });

    $('#localidadeSelect').select2({
        theme: 'bootstrap-5',
        placeholder: "Selecione a localidade (Opcional)",
        allowClear: true,
        width: '100%'
    });
});

const filtroJsonPadrao = {
    "filtro": {
        "codigoTipoChecklist": null,
        "codigoEstabelecimento": null,
        "dataIni": null,
        "dataFim": null,
        "status": [
            { "codigo": 0, "nomeExibicao": "Pendente" },
            { "codigo": 3, "nomeExibicao": "Em andamento" },
            { "codigo": 2, "nomeExibicao": "Excluído" },
            { "codigo": 1, "nomeExibicao": "Finalizado" }
        ],
        "pesquisaRapida": ""
    },
    "paginacao": {
        "paginaAtual": 0,
        "quantidadePorPagina": "100", //Limite de 100 registros por página (máximo SIGA)
        "ordenarPor": null,
        "ordenarDirecao": null
    }
};

const statusAvarias = {
    0: 'Pendente',
    1: 'Finalizado',
    2: 'Excluído',
    3: 'Em andamento'
};

function onTokenInput() {
    let token = document.getElementById('token').value;
    if (token) {
        carregarLocalidades();
    }
}

async function detalhesAvaria(codigoAvaria, token) {
    try {
        let response = await fetch(`https://siga-api.congregacao.org.br/api/mnt/mnt002/avaria-selecionar-por-codigo?codigoAvaria=${codigoAvaria}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            }
        });
        if (!response.ok) {
            throw new Error(`Erro na resposta do servidor: ${response.statusText}`);
        }
        let data = await response.json();
        return data;
    } catch (error) {
        console.error(`Erro ao buscar detalhes da avaria ${codigoAvaria}:`, error);
        return null;
    }
}

async function respostasAvaria(codigoAvaria, token) {
    try {
        let response = await fetch(`https://siga-api.congregacao.org.br/api/mnt/mnt002/selecionar/avarias-anotacoes?codigoChecklistItemAvaria=${codigoAvaria}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            }
        });
        if (!response.ok) {
            throw new Error(`Erro na resposta do servidor: ${response.statusText}`);
        }
        let data = await response.json();
        return data;
    } catch (error) {
        console.error(`Erro ao buscar respostas da avaria ${codigoAvaria}:`, error);
        return null;
    }
}

async function listadeAvarias(token, pagina) {
    try {
        filtroJsonPadrao.paginacao.paginaAtual = pagina;

        let response = await fetch('https://siga-api.congregacao.org.br/api/mnt/mnt003/dados/tabela', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify(filtroJsonPadrao)
        });

        if (!response.ok) {
            throw new Error(`Erro na resposta do servidor: ${response.statusText}`);
        }
        
        let data = await response.json();
        return data;
    } catch (error) {
        console.error('Erro ao buscar dados de avarias:', error);
        alert('Erro ao buscar dados de avarias: ' + error.message);
        return null;
    }
}

async function gerarRelatorio() {
    
    let token = document.getElementById('token').value;
    let dataInicio = document.getElementById('dataIni').value;
    let dataFim = document.getElementById('dataFim').value;
    let statusSelecionados = $('#statusSelect').val();
    let tipoChecklistSelecionados = $('#tipoChecklistSelect').val(); 
    let localidadeSelecionada = $('#localidadeSelect').val(); // Pega o valor selecionado para localidade

    //document.getElementById('periodoDashboard').innerHTML = ` Período: ${dataInicio ? dataInicio : 'Sem filtro'} a ${dataFim ? dataFim : 'Sem filtro'}`;

    if (!token) {
        alert('Por favor, insira o ccbsiga-token-api.');
        return;
    }

    document.getElementById('spinner').style.display = 'block';

    filtroJsonPadrao.filtro.dataIni = dataInicio ? dataInicio : null;
    filtroJsonPadrao.filtro.dataFim = dataFim ? dataFim : null;

    if (statusSelecionados && statusSelecionados.length > 0) {
        filtroJsonPadrao.filtro.status = statusSelecionados.map(codigo => {
            return { "codigo": parseInt(codigo) };
        });
    }

    if (tipoChecklistSelecionados && tipoChecklistSelecionados.length > 0) {
        filtroJsonPadrao.filtro.codigoTipoChecklist = tipoChecklistSelecionados.map(codigo => {
            return parseInt(codigo);
        });
    }

    if (localidadeSelecionada) {
        filtroJsonPadrao.filtro.codigoEstabelecimento = parseInt(localidadeSelecionada); // Apenas um localidade
    } else {
        filtroJsonPadrao.filtro.codigoEstabelecimento = null;
    }

    let primeiraPagina = await listadeAvarias(token, 1);
    if (!primeiraPagina) {
        document.getElementById('spinner').style.display = 'none';
        return;
    }

    let totalLinhas = primeiraPagina.totalLinhas;
    let quantidadePorPagina = primeiraPagina.quantitadePorPagina;
    let totalPaginas = Math.ceil(totalLinhas / quantidadePorPagina);

    let avarias = primeiraPagina.dados;

    for (let pagina = 2; pagina <= totalPaginas; pagina++) {
        let paginaDados = await listadeAvarias(token, pagina);
        if (paginaDados && paginaDados.dados) {
            avarias = avarias.concat(paginaDados.dados);
        }
    }

    // Contagem de status
    let contagemStatus = {
        pendente: 0,
        emAndamento: 0,
        finalizado: 0,
        excluido: 0
    };

    // Contagem de "Item Checklist" dinâmica
    let contagemItemChecklist = {};

    // Contagem de "Casa Oração"
    let contagemCasaOracao = {};

    // Contagem de "Apoio Adm", "Oferece Risco" e "Apoio Segurança"
    let contagemApoioAdm = { sim: 0, nao: 0 };
    let contagemOfereceRisco = { sim: 0, nao: 0 };
    let contagemApoioSeguranca = { sim: 0, nao: 0 };

    // Contagem de "Tipo Inspeção"
    let contagemTipoInspecao = {};

    // Percorrer as avarias e contar os status, itens de checklist, casas de oração, e os campos booleanos
    avarias.forEach(avaria => {
        // Contagem de status
        switch (avaria.status) {
            case 0:
                contagemStatus.pendente++;
                break;
            case 3:
                contagemStatus.emAndamento++;
                break;
            case 1:
                contagemStatus.finalizado++;
                break;
            case 2:
                contagemStatus.excluido++;
                break;
        }

        // Contagem de "Item Checklist"
        let itemChecklist = avaria.nomeChecklistItem;
        if (itemChecklist.includes("Instalações Hidráulicas")) {
            itemChecklist = "Instalações Hidráulicas"; // Simplifica o nome
        }
        if (contagemItemChecklist[itemChecklist]) {
            contagemItemChecklist[itemChecklist]++;
        } else {
            contagemItemChecklist[itemChecklist] = 1; // Inicializa a contagem para o novo item
        }

        // Contagem de "Casa Oração"
        let casaOracao = avaria.nomeCasaOracao;
        if (contagemCasaOracao[casaOracao]) {
            contagemCasaOracao[casaOracao]++;
        } else {
            contagemCasaOracao[casaOracao] = 1; // Inicializa a contagem para a nova casa
        }

        // Contagem de "Apoio Adm"
        if (avaria.apoioAdministracao) {
            contagemApoioAdm.sim++;
        } else {
            contagemApoioAdm.nao++;
        }

        // Contagem de "Oferece Risco"
        if (avaria.ofereceRisco) {
            contagemOfereceRisco.sim++;
        } else {
            contagemOfereceRisco.nao++;
        }

        // Contagem de "Apoio Segurança"
        if (avaria.necessarioAtividadeAltura) {
            contagemApoioSeguranca.sim++;
        } else {
            contagemApoioSeguranca.nao++;
        }

        // Contagem de "Tipo Inspeção"
        let tipoInspecao = avaria.nomeChecklist;
        if (contagemTipoInspecao[tipoInspecao]) {
            contagemTipoInspecao[tipoInspecao]++;
        } else {
            contagemTipoInspecao[tipoInspecao] = 1; // Inicializa a contagem para o novo tipo
        }
    });


    // Atualizar o conteúdo do Accordion "Status Atual" com as contagens formatadas em tabelas consistentes
    let conteudoStatus = `
        <table class="table table-bordered gerencial-table mt-3">
            <tr>
                <td class="descricao-coluna"><strong>Total de Avarias</strong></td>
                <td class="valor-coluna">${totalLinhas}</td>
            </tr>
        </table>

        <h5>Total por Status</h5>
        <table class="table table-bordered gerencial-table">
            <tr>
                <td class="descricao-coluna"><strong>Pendente</strong></td>
                <td class="valor-coluna">${contagemStatus.pendente}</td>
            </tr>
            <tr>
                <td class="descricao-coluna"><strong>Em Andamento</strong></td>
                <td class="valor-coluna">${contagemStatus.emAndamento}</td>
            </tr>
            <tr>
                <td class="descricao-coluna"><strong>Finalizado</strong></td>
                <td class="valor-coluna">${contagemStatus.finalizado}</td>
            </tr>
            <tr>
                <td class="descricao-coluna"><strong>Excluído</strong></td>
                <td class="valor-coluna">${contagemStatus.excluido}</td>
            </tr>
        </table>

        <h5>Total por Item Checklist</h5>
        <table class="table table-bordered gerencial-table">
    `;

    // Adiciona as contagens de "Item Checklist"
    for (let item in contagemItemChecklist) {
        conteudoStatus += `<tr><td class="descricao-coluna"><strong>${item}</strong></td><td class="valor-coluna">${contagemItemChecklist[item]}</td></tr>`;
    }

    conteudoStatus += `</table>`;

    // Adiciona as contagens de "Casa Oração"
    conteudoStatus += `
        <h5>Total por Casa Oração</h5>
        <table class="table table-bordered gerencial-table">
    `;
    for (let casa in contagemCasaOracao) {
        conteudoStatus += `<tr><td class="descricao-coluna"><strong>${casa}</strong></td><td class="valor-coluna">${contagemCasaOracao[casa]}</td></tr>`;
    }

    conteudoStatus += `</table>`;

    // Adiciona as contagens de "Apoio Adm", "Oferece Risco", e "Apoio Segurança"
    conteudoStatus += `
        <h5>Total por Apoio Adm</h5>
        <table class="table table-bordered gerencial-table">
            <tr>
                <td class="descricao-coluna"><strong>Sim</strong></td>
                <td class="valor-coluna">${contagemApoioAdm.sim}</td>
            </tr>
            <tr>
                <td class="descricao-coluna"><strong>Não</strong></td>
                <td class="valor-coluna">${contagemApoioAdm.nao}</td>
            </tr>
        </table>

        <h5>Total por Oferece Risco</h5>
        <table class="table table-bordered gerencial-table">
            <tr>
                <td class="descricao-coluna"><strong>Sim</strong></td>
                <td class="valor-coluna">${contagemOfereceRisco.sim}</td>
            </tr>
            <tr>
                <td class="descricao-coluna"><strong>Não</strong></td>
                <td class="valor-coluna">${contagemOfereceRisco.nao}</td>
            </tr>
        </table>

        <h5>Total por Apoio Segurança</h5>
        <table class="table table-bordered gerencial-table">
            <tr>
                <td class="descricao-coluna"><strong>Sim</strong></td>
                <td class="valor-coluna">${contagemApoioSeguranca.sim}</td>
            </tr>
            <tr>
                <td class="descricao-coluna"><strong>Não</strong></td>
                <td class="valor-coluna">${contagemApoioSeguranca.nao}</td>
            </tr>
        </table>
    `;

    // Adiciona as contagens de "Tipo Inspeção"
    conteudoStatus += `
        <h5>Total por Tipo Inspeção</h5>
        <table class="table table-bordered gerencial-table">
    `;
    for (let tipo in contagemTipoInspecao) {
        conteudoStatus += `<tr><td class="descricao-coluna"><strong>${tipo}</strong></td><td class="valor-coluna">${contagemTipoInspecao[tipo]}</td></tr>`;
    }

    conteudoStatus += `</table>`;


    document.getElementById('totalRegistros').innerHTML = conteudoStatus;

    // Chamar a função para gerar os gráficos
    gerarGraficoStatus(contagemStatus);
    gerarGraficoApoioAdm(contagemApoioAdm);
    gerarGraficoOfereceRisco(contagemOfereceRisco);
    gerarGraficoApoioSeguranca(contagemApoioSeguranca);
    gerarGraficoTipoInspecao(contagemTipoInspecao);
    gerarGraficoItemChecklist(contagemItemChecklist);
    gerarGraficoCasaOracao(contagemCasaOracao);


    let tabelaBody = document.querySelector('#tabela-relatorio tbody');
    tabelaBody.innerHTML = '';

    for (let avaria of avarias) {
        await new Promise(resolve => setTimeout(resolve, 100));

        let detalhes = await detalhesAvaria(avaria.codigo, token);
        let detalhesDescricao = detalhes ? detalhes.descricao : 'N/A';
        let detalhesDescricaoCorrecao = detalhes ? detalhes.descricaoCorrecao : 'N/A';
        let qtdAnexos = detalhes.anexos ? detalhes.anexos.length : 0;
        let statusDescricao = statusAvarias[avaria.status];

        let apoioAdm = avaria.apoioAdministracao ? 'Sim' : 'Não';
        let ofereceRisco = avaria.ofereceRisco ? 'Sim' : 'Não';
        let apoioSeguranca = avaria.necessarioAtividadeAltura ? 'Sim' : 'Não';

        let row = document.createElement('tr');
        row.innerHTML = `
            <td>${avaria.id}</td>
            <td>${avaria.nomeCasaOracao}</td>
            <td>${avaria.nome}</td>
            <td>${detalhesDescricao}</td>
            <td>${apoioAdm}</td>
            <td>${ofereceRisco}</td>
            <td>${apoioSeguranca}</td>
            <td>${new Date(avaria.dataAvaria).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
            <td>${avaria.dataCorrecao ? new Date(avaria.dataCorrecao).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A'}</td>
            <td>${detalhesDescricaoCorrecao || 'N/A'}</td>
            <td>${statusDescricao}</td>
            <td>${avaria.nomeChecklist}</td>
            <td>${avaria.nomeChecklistItem}</td>
            <td>${qtdAnexos}</td>
            <td><button class="btn btn-secondary" onclick="mostrarRespostas('${avaria.codigo}')">Ver Respostas</button></td>
        `;
        tabelaBody.appendChild(row);
    }

    document.getElementById('spinner').style.display = 'none';
}


async function mostrarRespostas(codigoAvaria) {
    let token = document.getElementById('token').value;
    let respostas = await respostasAvaria(codigoAvaria, token);
    let respostasConteudo = document.getElementById('respostasConteudo');
    respostasConteudo.innerHTML = ''; // Limpar conteúdo anterior

    if (respostas && respostas.length > 0) {
        respostas.forEach(resposta => {
            let respostaHtml = `
                <div class="mb-3">
                    <strong>Data e Hora:</strong> ${new Date(resposta.dataHora).toLocaleString()}<br>
                    <strong>Descrição:</strong> ${resposta.descricao}<br>
                    <strong>Usuário:</strong> ${resposta.usuario}<br>
                    <strong>Possui Anexos:</strong> ${resposta.possuiAnexos ? 'Sim' : 'Não'}
                </div>
                <hr>
            `;
            respostasConteudo.innerHTML += respostaHtml;
        });
    } else {
        respostasConteudo.innerHTML = '<p>Não há respostas disponíveis para esta avaria.</p>';
    }

    // Mostrar o modal
    let respostasModal = new bootstrap.Modal(document.getElementById('respostasModal'));
    respostasModal.show();
}

function copiarTabela() {
    let tabela = document.getElementById('tabela-relatorio');
    let range = document.createRange();
    range.selectNode(tabela);
    window.getSelection().removeAllRanges(); // Remover qualquer seleção anterior
    window.getSelection().addRange(range); // Selecionar a tabela
    document.execCommand('copy'); // Copiar para a área de transferência
    window.getSelection().removeAllRanges(); // Remover a seleção para evitar que o conteúdo fique selecionado
    alert('Tabela copiada para a área de transferência!');
}

function ordenarTabela(coluna) {
    let tabela = document.getElementById("tabela-relatorio");
    let linhas = Array.from(tabela.rows).slice(1); // Pega todas as linhas, exceto a primeira (cabeçalho)
    let ordemAscendente = tabela.getAttribute("data-ordem") !== "asc"; // Alterna entre ascendente e descendente

    linhas.sort((a, b) => {
        let valorA = a.cells[coluna].innerText.trim();
        let valorB = b.cells[coluna].innerText.trim();

        // Verifica se os valores são datas no formato dd/MM/yyyy
        if (coluna === 7 || coluna === 8) { // Colunas de data, ajuste conforme o índice das colunas de data
            let partesA = valorA.split('/');
            let partesB = valorB.split('/');
            valorA = new Date(partesA[2], partesA[1] - 1, partesA[0]); // ano, mês, dia
            valorB = new Date(partesB[2], partesB[1] - 1, partesB[0]);
        } else if (!isNaN(valorA) && !isNaN(valorB)) {
            // Se ambos valores são números, comparar como números
            valorA = parseFloat(valorA);
            valorB = parseFloat(valorB);
        }

        // Comparação de valores
        if (valorA < valorB) {
            return ordemAscendente ? -1 : 1;
        } else if (valorA > valorB) {
            return ordemAscendente ? 1 : -1;
        } else {
            return 0;
        }
    });

    tabela.setAttribute("data-ordem", ordemAscendente ? "asc" : "desc");

    // Remove as linhas existentes e adiciona as linhas ordenadas
    let tbody = tabela.querySelector("tbody");
    tbody.innerHTML = "";
    linhas.forEach(linha => tbody.appendChild(linha));
}

function exportarTabelaParaExcel() {
    let tabela = document.getElementById('tabela-relatorio');
    let workbook = XLSX.utils.table_to_book(tabela, { sheet: "Relatório" });
    XLSX.writeFile(workbook, 'relatorio_avarias.xlsx');
}

function filtrarTabela() {
    let input = document.getElementById('campoBusca');
    let filtro = input.value.toLowerCase();
    let tabela = document.getElementById('tabela-relatorio');
    let linhas = tabela.getElementsByTagName('tr');

    for (let i = 1; i < linhas.length; i++) { // Começa em 1 para ignorar o cabeçalho
        let colunas = linhas[i].getElementsByTagName('td');
        let encontrado = false;
        for (let j = 0; j < colunas.length; j++) {
            if (colunas[j]) {
                let textoColuna = colunas[j].innerText || colunas[j].textContent;
                if (textoColuna.toLowerCase().indexOf(filtro) > -1) {
                    encontrado = true;
                    break;
                }
            }
        }
        linhas[i].style.display = encontrado ? '' : 'none';
    }
}

async function carregarLocalidades() {
    let token = document.getElementById('token').value;
    if (!token) {
        return;
    }

    try {
        let response = await fetch('https://siga-api.congregacao.org.br/api/mnt/mnt003/listar/estabelecimentos', {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Erro ao buscar as localidades: ' + response.statusText);
        }

        let localidades = await response.json();

        // Preencher o select com as opções
        let selectElement = document.getElementById('localidadeSelect');
        selectElement.innerHTML = ''; // Limpa as opções anteriores

        // Adiciona uma opção vazia no início
        let emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = '';
        selectElement.appendChild(emptyOption);

        localidades.forEach(localidade => {
            let option = document.createElement('option');
            option.value = localidade.codigo;
            option.textContent = localidade.nomeExibicao;
            selectElement.appendChild(option);
        });

        // Inicializar o Select2 após o carregamento dos dados
        $('#localidadeSelect').select2({
            theme: 'bootstrap-5',
            placeholder: "Selecione a localidade",
            allowClear: true,
            width: '100%'
        });

    } catch (error) {
        console.error(error);
        alert('Erro ao carregar as localidades: ' + error.message);
    }
}

let graficoStatus; // Variável para armazenar o gráfico de Status

// Função para gerar o gráfico de Status
function gerarGraficoStatus(contagemStatus) {
    const ctx = document.getElementById('graficoStatus').getContext('2d');

    const totalAvarias = contagemStatus.pendente + contagemStatus.emAndamento + contagemStatus.finalizado + contagemStatus.excluido;

    // Calcula os percentuais de cada status
    const percentuais = {
        pendente: ((contagemStatus.pendente / totalAvarias) * 100).toFixed(2),
        emAndamento: ((contagemStatus.emAndamento / totalAvarias) * 100).toFixed(2),
        finalizado: ((contagemStatus.finalizado / totalAvarias) * 100).toFixed(2),
        excluido: ((contagemStatus.excluido / totalAvarias) * 100).toFixed(2)
    };
    
    // Se o gráfico já existe, destruí-lo antes de criar um novo
    if (graficoStatus) {
        graficoStatus.destroy();
    }

    graficoStatus = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Pendente', 'Em Andamento', 'Finalizado', 'Excluído'],
            datasets: [{
                data: [
                    contagemStatus.pendente,
                    contagemStatus.emAndamento,
                    contagemStatus.finalizado,
                    contagemStatus.excluido
                ],
                backgroundColor: ['#ffcd56', '#36a2eb', '#4bc0c0', '#ff6384'],
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                },
                datalabels: {
                    color: 'white',
                    font: {
                        weight: 'bold',
                        size: 14
                    },
                    formatter: (value) => {
                        return value;
                    }
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}


let graficoApoioAdm; // Variável para armazenar o gráfico de Apoio Adm

// Função para gerar o gráfico de Apoio Adm
function gerarGraficoApoioAdm(contagemApoioAdm) {
    const ctx = document.getElementById('graficoApoioAdm').getContext('2d');

    // Se o gráfico já existe, destruí-lo antes de criar um novo
    if (graficoApoioAdm) {
        graficoApoioAdm.destroy();
    }

    graficoApoioAdm = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Sim', 'Não'],
            datasets: [{
                data: [
                    contagemApoioAdm.sim,
                    contagemApoioAdm.nao
                ],
                backgroundColor: ['#ffcd56','#4bc0c0'],
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                },
                datalabels: {
                    color: 'white',
                    font: {
                        weight: 'bold',
                        size: 14
                    },
                    formatter: (value) => {
                        return value;
                    }
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}


let graficoOfereceRisco; // Variável para armazenar o gráfico de Oferece Risco

// Função para gerar o gráfico de Oferece Risco
function gerarGraficoOfereceRisco(contagemOfereceRisco) {
    const ctx = document.getElementById('graficoOfereceRisco').getContext('2d');

    // Se o gráfico já existe, destruí-lo antes de criar um novo
    if (graficoOfereceRisco) {
        graficoOfereceRisco.destroy();
    }

    graficoOfereceRisco = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Sim', 'Não'],
            datasets: [{
                data: [
                    contagemOfereceRisco.sim,
                    contagemOfereceRisco.nao
                ],
                backgroundColor: ['#ff6384','#4bc0c0'],
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                },
                datalabels: {
                    color: 'white',
                    font: {
                        weight: 'bold',
                        size: 14
                    },
                    formatter: (value) => {
                        return value;
                    }
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

let graficoApoioSeguranca; // Variável para armazenar o gráfico de Apoio Segurança

// Função para gerar o gráfico de Apoio Segurança
function gerarGraficoApoioSeguranca(contagemApoioSeguranca) {
    const ctx = document.getElementById('graficoApoioSeguranca').getContext('2d');

    // Se o gráfico já existe, destruí-lo antes de criar um novo
    if (graficoApoioSeguranca) {
        graficoApoioSeguranca.destroy();
    }

    graficoApoioSeguranca = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Sim', 'Não'],
            datasets: [{
                data: [
                    contagemApoioSeguranca.sim,
                    contagemApoioSeguranca.nao
                ],
                backgroundColor: ['#ff6384','#4bc0c0'],
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                },
                datalabels: {
                    color: 'white',
                    font: {
                        weight: 'bold',
                        size: 14
                    },
                    formatter: (value) => {
                        return value;
                    }
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

let graficoTipoInspecao; // Variável para armazenar o gráfico de Tipo de Inspeção

// Função para gerar o gráfico de Total por Tipo de Inspeção
function gerarGraficoTipoInspecao(contagemTipoInspecao) {
    const ctx = document.getElementById('graficoTipoInspecao').getContext('2d');

    // Se o gráfico já existe, destruí-lo antes de criar um novo
    if (graficoTipoInspecao) {
        graficoTipoInspecao.destroy();
    }

    const labels = Object.keys(contagemTipoInspecao);
    const valores = Object.values(contagemTipoInspecao);

    graficoTipoInspecao = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels, // Tipos de inspeção
            datasets: [{
                label: 'Quantidade',
                data: valores, // Contagens correspondentes
                backgroundColor: ['#ffcd56', '#36a2eb', '#4bc0c0', '#ff6384', '#9966ff', '#ff9f40'],
                borderColor: 'transparent', // Remover borda
                borderWidth: 0 // Bordas removidas
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        display: false // Remover o grid no eixo Y
                    }
                },
                x: {
                    grid: {
                        display: false // Remover o grid no eixo X
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                datalabels: {
                    color: 'black',
                    font: {
                        weight: 'bold',
                        size: 14
                    },
                    formatter: (value) => {
                        return value;
                    }
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}


let graficoItemChecklist; // Variável para armazenar o gráfico de Item Checklist

// Função para gerar o gráfico de Total por Item Checklist
function gerarGraficoItemChecklist(contagemItemChecklist) {
    const ctx = document.getElementById('graficoItemChecklist').getContext('2d');

    // Se o gráfico já existe, destruí-lo antes de criar um novo
    if (graficoItemChecklist) {
        graficoItemChecklist.destroy();
    }

    const labels = Object.keys(contagemItemChecklist);
    const valores = Object.values(contagemItemChecklist);

    // Paleta de cores ampliada
    /*
    const paletaCores = [
        '#ffcd56', '#36a2eb', '#4bc0c0', '#ff6384', '#9966ff', '#ff9f40',
        '#c9cbcf', '#00a65a', '#d2d6de', '#f39c12', '#3c8dbc', '#00c0ef',
        '#39cccc', '#001f3f', '#85144b', '#f012be', '#b10dc9', '#ff851b',
        '#2ecc40', '#e74c3c', '#9b59b6', '#3498db', '#e67e22', '#16a085'
    ];
    */
    const paletaCores = ['#36a2eb']

    // Expandir o número de cores dinamicamente se necessário
    const backgroundColors = labels.map((_, index) => paletaCores[index % paletaCores.length]);

    graficoItemChecklist = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels, // Itens de checklist
            datasets: [{
                label: 'Quantidade',
                data: valores, // Contagens correspondentes
                backgroundColor: backgroundColors,
                borderColor: 'transparent', // Remover borda
                borderWidth: 0 // Bordas removidas
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        display: false // Remover o grid no eixo Y
                    }
                },
                x: {
                    grid: {
                        display: false // Remover o grid no eixo X
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                datalabels: {
                    color: 'black',
                    font: {
                        weight: 'bold',
                        size: 14
                    },
                    formatter: (value) => {
                        return value;
                    }
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}


let graficoCasaOracao; // Variável para armazenar o gráfico de Casa Oração

// Função para gerar o gráfico de Total por Casa Oração
function gerarGraficoCasaOracao(contagemCasaOracao) {
    const ctx = document.getElementById('graficoCasaOracao').getContext('2d');

    // Se o gráfico já existe, destruí-lo antes de criar um novo
    if (graficoCasaOracao) {
        graficoCasaOracao.destroy();
    }

    const labels = Object.keys(contagemCasaOracao);
    const valores = Object.values(contagemCasaOracao);

    // Paleta de cores ampliada (60 cores diferentes)
    /*
    const paletaCores = [
        '#ffcd56', '#36a2eb', '#4bc0c0', '#ff6384', '#9966ff', '#ff9f40',
        '#c9cbcf', '#00a65a', '#d2d6de', '#f39c12', '#3c8dbc', '#00c0ef',
        '#39cccc', '#001f3f', '#85144b', '#f012be', '#b10dc9', '#ff851b',
        '#2ecc40', '#e74c3c', '#9b59b6', '#3498db', '#e67e22', '#16a085',
        '#1abc9c', '#9b59b6', '#f1c40f', '#e74c3c', '#2ecc71', '#ecf0f1',
        '#95a5a6', '#34495e', '#7f8c8d', '#27ae60', '#e67e22', '#d35400',
        '#2980b9', '#8e44ad', '#c0392b', '#bdc3c7', '#3498db', '#16a085',
        '#27ae60', '#f39c12', '#8e44ad', '#2980b9', '#d35400', '#7f8c8d',
        '#34495e', '#e74c3c', '#c0392b', '#bdc3c7', '#95a5a6', '#f1c40f'
    ];
    */
    const paletaCores = ['#00c0ef'];

    const backgroundColors = labels.map((_, index) => paletaCores[index % paletaCores.length]);

    graficoCasaOracao = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels, // Casas de Oração
            datasets: [{
                label: 'Quantidade',
                data: valores, // Contagens correspondentes
                backgroundColor: backgroundColors,
                borderColor: 'transparent', // Remover borda
                borderWidth: 0 // Bordas removidas
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        display: false // Remover o grid no eixo Y
                    }
                },
                x: {
                    grid: {
                        display: false // Remover o grid no eixo X
                    },
                    ticks: {
                        autoSkip: false, // Mostrar todos os rótulos no eixo X
                        maxRotation: 90, // Rotacionar os rótulos se necessário
                        minRotation: 45
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                datalabels: {
                    color: 'black',
                    font: {
                        weight: 'bold',
                        size: 12
                    },
                    formatter: (value) => {
                        return value;
                    }
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}
