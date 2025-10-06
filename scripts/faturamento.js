//Configuração Js do faturamento.

const urlDaPlanilhaCSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTcbocWsEJJnb0Dwk_jI62Sz2mQFmvIi8qtx45n6xGLrvZ2uaCNDv60PSXQdxKlpUkjnuJ4CkOy0Gm1/pub?output=csv';

    const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
    const parseMoeda = (str) => {
        if (!str || typeof str !== 'string') return 0;
        const valorNumerico = parseFloat(str.replace(/\./g, '').replace('R$', '').trim().replace(',', '.'));
        return isNaN(valorNumerico) ? 0 : valorNumerico;
    };

    function setDateHeader() {
        document.getElementById('header-date').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }

    async function buscarDadosDaPlanilha() {
        if (!urlDaPlanilhaCSV || urlDaPlanilhaCSV.includes('COLOQUE_SEU_LINK_CSV_AQUI')) {
            document.getElementById('loading-overlay').innerHTML = `<ion-icon name="warning-outline" class="text-5xl text-amber-400"></ion-icon><p class="text-white text-lg mt-4">Configuração necessária</p><p class="text-slate-400 mt-1">Por favor, insira o link da sua planilha CSV no código.</p>`;
            throw new Error("URL da planilha não configurada.");
        }
        try {
            const resposta = await fetch(`${urlDaPlanilhaCSV}&t=${new Date().getTime()}`);
            if (!resposta.ok) throw new Error(`Falha na rede: ${resposta.statusText}`);
            
            const dadosCSV = await resposta.text();
            if (dadosCSV.trim().startsWith('<')) throw new Error("A resposta foi um HTML. Verifique se o link foi publicado como 'CSV'.");

            const linhas = dadosCSV.trim().split('\n');
            const cabecalho = linhas[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase());

            const encontrarIndice = (nomesPossiveis) => {
                for (const nome of nomesPossiveis) {
                    const index = cabecalho.indexOf(nome.toLowerCase());
                    if (index !== -1) return index;
                }
                return -1;
            };

            const indices = {
                fornecedor: encontrarIndice(['fornecedor']),
                unidade: encontrarIndice(['unidade']),
                descricao: encontrarIndice(['descrição do serviço', 'descricao do servico']),
                anterior: encontrarIndice(['# valor anterior', 'valor anterior']),
                atual: encontrarIndice(['# valor atual', 'valor atual']),
                economia: encontrarIndice(['economia']),
                dataInstalacao: encontrarIndice(['data de instalação', 'data de instalacao'])
            };
            
            return linhas.slice(1).map(linha => {
                const valores = linha.match(/(".*?"|[^,]+)/g).map(v => v.replace(/"/g, '').trim());
                
                const getValor = (index) => valores[index] || '';
                return {
                    Fornecedor: getValor(indices.fornecedor),
                    Unidade: getValor(indices.unidade),
                    Descricao: getValor(indices.descricao),
                    ValorAnterior: parseMoeda(getValor(indices.anterior)),
                    ValorAtual: parseMoeda(getValor(indices.atual)),
                    Economia: parseMoeda(getValor(indices.economia)),
                    DataInstalacao: getValor(indices.dataInstalacao) 
                };
            }).filter(item => item.Fornecedor && item.Fornecedor.trim() !== '');
        } catch (error) {
            document.getElementById('loading-overlay').innerHTML = `<ion-icon name="cloud-offline-outline" class="text-5xl text-red-400"></ion-icon><p class="text-white text-lg mt-4">Erro ao Carregar Dados</p><p class="text-slate-400 text-center max-w-sm mt-1">Não foi possível buscar os dados. Verifique o link, a permissão da planilha e sua conexão.</p><p class="text-xs text-slate-500 mt-4">${error.message}</p>`;
            console.error("Erro em buscarDadosDaPlanilha:", error);
            throw error; 
        }
    }
    
    function calcularKPIs(dados) {
        const valorAnterior = dados.reduce((acc, item) => acc + item.ValorAnterior, 0);
        const valorAtual = dados.reduce((acc, item) => acc + item.ValorAtual, 0);
        const economia = dados.reduce((acc, item) => acc + item.Economia, 0);
        
        const hoje = new Date();
        const faturamentoTotal = dados.reduce((acc, item) => {
            try {
                if (!item.ValorAtual || !item.DataInstalacao || typeof item.DataInstalacao !== 'string' || item.DataInstalacao.trim() === '') {
                    return acc;
                }
            
                const partesData = item.DataInstalacao.split(/[\/\-]/);
                if (partesData.length !== 3) return acc;
                
                const ano = parseInt(partesData[0], 10);
                const mes = parseInt(partesData[1], 10) - 1;
                const dia = parseInt(partesData[2], 10);
                
                if (isNaN(ano) || isNaN(mes) || isNaN(dia)) {
                   return acc;
                }

                const dataInstalacao = new Date(ano, mes, dia);

                if (isNaN(dataInstalacao.getTime()) || dataInstalacao > hoje) {
                    return acc;
                }

                const mesesAtivo = (hoje.getFullYear() - dataInstalacao.getFullYear()) * 12 
                                 + (hoje.getMonth() - dataInstalacao.getMonth()) 
                                 + 1;

                const contribuicao = mesesAtivo > 0 ? item.ValorAtual * mesesAtivo : 0;
                return acc + contribuicao;

            } catch (error) {
                console.error('Erro ao processar um item para o faturamento. Item:', item, 'Erro:', error);
                return acc;
            }
        }, 0);

        document.getElementById('kpi-anterior').textContent = formatarMoeda(valorAnterior);
        document.getElementById('kpi-atual').textContent = formatarMoeda(valorAtual);
        document.getElementById('kpi-economia').textContent = formatarMoeda(economia);
        document.getElementById('kpi-itens').textContent = formatarMoeda(faturamentoTotal);
    }


    function renderizarGraficos(dados) {
        const corTexto = '#9ca3af', corGrid = '#334155';
        
        const economiaPorFornecedor = dados.reduce((acc, item) => {
            if (item.Fornecedor) acc[item.Fornecedor] = (acc[item.Fornecedor] || 0) + item.Economia;
            return acc;
        }, {});
        
        if (window.graficoEconomiaFornecedor) window.graficoEconomiaFornecedor.destroy();
        window.graficoEconomiaFornecedor = new Chart(document.getElementById('chartEconomiaFornecedor'), {
            type: 'doughnut', 
            data: { 
                labels: Object.keys(economiaPorFornecedor), 
                datasets: [{ data: Object.values(economiaPorFornecedor), backgroundColor: ['#4f46e5', '#7c3aed', '#a855f7', '#34d399', '#f97316'], borderColor: '#1e293b' }] 
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: corTexto, padding: 20 } } } }
        });

        const unidades = [...new Set(dados.map(item => item.Unidade))];
        const dadosAnterior = unidades.map(u => dados.filter(d => d.Unidade === u).reduce((s, i) => s + i.ValorAnterior, 0));
        const dadosAtual = unidades.map(u => dados.filter(d => d.Unidade === u).reduce((s, i) => s + i.ValorAtual, 0));
        
        if (window.graficoValoresUnidade) window.graficoValoresUnidade.destroy();
        window.graficoValoresUnidade = new Chart(document.getElementById('chartValoresUnidade'), {
            type: 'bar',
            data: {
                labels: unidades,
                datasets: [
                    { label: 'Valor Anterior', data: dadosAnterior, backgroundColor: '#dc2626', borderRadius: 4 },
                    { label: 'Valor Atual', data: dadosAtual, backgroundColor: '#7c3aed', borderRadius: 4 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: corTexto } } }, scales: { y: { beginAtZero: true, ticks: { color: corTexto, callback: (v) => formatarMoeda(v) }, grid: { color: corGrid } }, x: { ticks: { color: corTexto }, grid: { display: false } } } }
        });
    }

    function preencherTabela(dados) {
        const tabelaCorpo = document.getElementById('tabela-servicos');
        tabelaCorpo.innerHTML = '';
        dados.forEach(item => {
            const economiaCor = item.Economia > 0 ? 'text-green-400' : (item.Economia < 0 ? 'text-red-400' : 'text-slate-400');
            tabelaCorpo.innerHTML += `<tr class="hover:bg-slate-700/50 transition-colors">
                <td class="px-4 py-4 text-sm font-medium text-white whitespace-nowrap">${item.Fornecedor || '-'}</td>
                <td class="px-4 py-4 text-sm text-slate-300 whitespace-nowrap">${item.Unidade || '-'}</td>
                <td class="px-4 py-4 text-sm text-slate-400 max-w-xs truncate" title="${item.Descricao || ''}">${item.Descricao || '-'}</td>
                <td class="px-4 py-4 text-sm text-right font-medium text-slate-400 whitespace-nowrap">${formatarMoeda(item.ValorAnterior)}</td>
                <td class="px-4 py-4 text-sm text-right font-medium text-purple-400 whitespace-nowrap">${formatarMoeda(item.ValorAtual)}</td>
                <td class="px-4 py-4 text-sm text-right font-bold ${economiaCor} whitespace-nowrap">${formatarMoeda(item.Economia)}</td>
            </tr>`;
        });
    }

    async function inicializarDashboard() {
        document.getElementById('loading-overlay').style.display = 'flex';
        document.getElementById('refresh-icon').classList.add('spinning');
        
        try {
            const dadosVivos = await buscarDadosDaPlanilha();
            
            if (dadosVivos && dadosVivos.length > 0) {
                calcularKPIs(dadosVivos);
                renderizarGraficos(dadosVivos);
                preencherTabela(dadosVivos);
                document.getElementById('loading-overlay').style.display = 'none';
            } else if (urlDaPlanilhaCSV && !urlDaPlanilhaCSV.includes('COLOQUE_SEU_LINK_CSV_AQUI')) {
                document.getElementById('loading-overlay').innerHTML = `<ion-icon name="document-text-outline" class="text-5xl text-sky-400"></ion-icon><p class="text-white text-lg mt-4">Nenhum dado encontrado</p><p class="text-slate-400 mt-1">A planilha parece estar vazia ou com formato incorreto.</p>`;
            }
        } catch (e) {
            console.error("Ocorreu um erro fatal ao inicializar o dashboard:", e);
            document.getElementById('loading-overlay').innerHTML = `<ion-icon name="bug-outline" class="text-5xl text-red-400"></ion-icon><p class="text-white text-lg mt-4">Ocorreu um Erro</p><p class="text-slate-400 text-center max-w-sm mt-1">Houve um erro no script que impediu o carregamento. Verifique o console para mais detalhes.</p>`;
        } finally {
            document.getElementById('refresh-icon').classList.remove('spinning');
        }
    }
    
    document.addEventListener('DOMContentLoaded', () => {
        setDateHeader();
        inicializarDashboard();
        document.getElementById('refresh-button').addEventListener('click', inicializarDashboard);
    });