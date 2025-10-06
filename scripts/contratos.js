
// 1. REGISTRAR O PLUGIN GLOBALMENTE
Chart.register(ChartDataLabels);

// Link da sua planilha publicada como CSV
const urlPlanilha = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTAfsfHNzYa__2CsvGwB2k8q5GH98ixoDfjY9ydzUR57iHrdoqAW6VIboUp3TK0uD5c0rKk2LOYbBAY/pub?output=csv'
let allData = [];

const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
const parseMoeda = (str) => {
    if (!str || typeof str !== 'string') return 0;
    const valorNumerico = parseFloat(str.replace(/\./g, '').replace('R$', '').trim().replace(',', '.'));
    return isNaN(valorNumerico) ? 0 : valorNumerico;
};
const parseData = (str) => {
    if (!str || !/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return null;
    const [dia, mes, ano] = str.split('/');
    return new Date(`${ano}-${mes}-${dia}T00:00:00`);
};

function setDateHeader() {
    document.getElementById('header-date').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

async function buscarDados() {
    if (!urlPlanilha || urlPlanilha.includes('SEU_LINK_CSV_AQUI')) {
        throw new Error("URL da planilha não configurada.");
    }
    try {
        const resposta = await fetch(`${urlPlanilha}&t=${new Date().getTime()}`);
        if (!resposta.ok) throw new Error(`Erro na rede: ${resposta.status}`);
        const csv = await resposta.text();
        if (csv.trim().startsWith('<')) throw new Error("A resposta foi um HTML. Verifique se o link foi publicado como 'CSV'.");
        if (!csv.trim()) return [];

        const linhas = csv.trim().split('\n');
        const cabecalho = linhas.shift().split(',').map(h => h.trim().toLowerCase());
        
        const encontrarIndice = (nomeColuna) => cabecalho.indexOf(nomeColuna);

        const indices = {
            servico: encontrarIndice('serviço ou produto'),
            unidade: encontrarIndice('unidade'),
            fornecedor: encontrarIndice('fornecedor ou cliente'),
            custo: encontrarIndice('custo'),
            dataFinal: encontrarIndice('data final'),
            responsavel: encontrarIndice('responsável'),
        };
        
        if (indices.servico === -1) {
            throw new Error("A coluna obrigatória 'serviço ou produto' não foi encontrada no seu CSV. Verifique o cabeçalho.");
        }

        return linhas.map(linha => {
            const valores = linha.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map(v => v.replace(/"/g, '').trim()) || [];
            const getValor = (index) => (index > -1 && valores[index]) ? valores[index] : '';
            
            return {
                servico: getValor(indices.servico),
                unidade: getValor(indices.unidade),
                fornecedor: getValor(indices.fornecedor),
                custo: parseMoeda(getValor(indices.custo)),
                dataFinal: parseData(getValor(indices.dataFinal)),
                responsavel: getValor(indices.responsavel),
            };
        }).filter(item => item.servico);
    } catch (error) {
        console.error("Erro ao buscar dados:", error);
        throw error;
    }
}

function atualizarVisualizacao(dados) {
    if (!dados) return;

    const custoTotal = dados.reduce((a, i) => a + i.custo, 0);
    const numContratos = dados.length;
    
    const hoje = new Date();
    const dias90 = new Date();
    dias90.setDate(hoje.getDate() + 90);
    
    const vencendo = dados.filter(d => d.dataFinal && d.dataFinal <= dias90).length;

    document.getElementById('kpi-custo-total').textContent = formatarMoeda(custoTotal);
    document.getElementById('kpi-num-contratos').textContent = numContratos;
    document.getElementById('kpi-vencendo').textContent = vencendo;
    document.getElementById('kpi-media-custo').textContent = formatarMoeda(numContratos > 0 ? custoTotal / numContratos : 0);

    const corTexto = '#9ca3af', corGrid = '#334155';
    
    const custoPorUnidade = dados.reduce((a, i) => { if(i.unidade) a[i.unidade] = (a[i.unidade] || 0) + i.custo; return a; }, {});
    if (window.graficoCustoUnidade) window.graficoCustoUnidade.destroy();
    
    window.graficoCustoUnidade = new Chart('chartCustoUnidade', {
        type: 'bar', 
        data: {
            labels: Object.keys(custoPorUnidade), 
            datasets: [{
                label: 'Custo', 
                data: Object.values(custoPorUnidade), 
                backgroundColor: '#38bdf8', 
                borderRadius: 4
            }]
        }, 
        options: {
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: {
                legend: {display: false},
                datalabels: {
                    formatter: (value, context) => formatarMoeda(value),
                    color: '#e2e8f0',
                    anchor: 'end',
                    align: 'top',
                    offset: -5,
                    font: { weight: '500' }
                }
            }, 
            scales: {
                y: {ticks: {color: corTexto, callback: (v) => formatarMoeda(v)}, grid: {color: corGrid}}, 
                x: {ticks: {color: corTexto}}
            }
        }
    });

    const custoPorFornecedor = dados.reduce((a, i) => { if(i.fornecedor) a[i.fornecedor] = (a[i.fornecedor] || 0) + i.custo; return a; }, {});
    if (window.graficoCustoFornecedor) window.graficoCustoFornecedor.destroy();

    window.graficoCustoFornecedor = new Chart('chartCustoFornecedor', {
        type: 'doughnut', 
        data: {
            labels: Object.keys(custoPorFornecedor), 
            datasets: [{
                data: Object.values(custoPorFornecedor), 
                backgroundColor: ['#4f46e5', '#7c3aed', '#a855f7', '#34d399', '#f97316', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#06b6d4', '#e879f9'], 
                borderColor: '#1e293b'
            }]
        }, 
        options: {
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: {
                legend: {position: 'bottom', labels: {color: corTexto, padding: 15}},
                // 2. ALTERAÇÃO - VALORES REMOVIDOS DO GRÁFICO DE ROSCA
                datalabels: {
                    display: false, // Oculta os valores de dentro do gráfico
                },
                // 3. ALTERAÇÃO - TOOLTIP MELHORADO COM VALOR E PERCENTUAL
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const rawValue = context.raw;
                            const total = context.chart.getDatasetMeta(0).total;
                            const percentage = total > 0 ? ((rawValue / total) * 100).toFixed(2) : 0;
                            
                            return `${label}: ${formatarMoeda(rawValue)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
    
    const tabelaBody = document.getElementById('tabela-contratos');
    tabelaBody.innerHTML = dados.length > 0 ? dados.map(item => `
        <tr class="hover:bg-slate-700/50">
            <td class="px-4 py-4 text-sm font-medium text-white whitespace-nowrap">${item.servico || '-'}</td>
            <td class="px-4 py-4 text-sm text-slate-300 whitespace-nowrap">${item.unidade || '-'}</td>
            <td class="px-4 py-4 text-sm text-slate-300 whitespace-nowrap">${item.fornecedor || '-'}</td>
            <td class="px-4 py-4 text-sm text-right font-medium text-sky-400 whitespace-nowrap">${formatarMoeda(item.custo)}</td>
            <td class="px-4 py-4 text-sm text-center text-slate-400 whitespace-nowrap">${item.dataFinal ? item.dataFinal.toLocaleDateString('pt-BR') : '-'}</td>
            <td class="px-4 py-4 text-sm text-slate-300 whitespace-nowrap">${item.responsavel || '-'}</td>
        </tr>`).join('') : `
        <tr>
            <td colspan="6" class="text-center py-10 text-slate-500">Nenhum dado encontrado para os filtros selecionados.</td>
        </tr>`;
}

function popularFiltros() {
    const filtroUnidade = document.getElementById('filtro-unidade');
    const unidades = [...new Set(allData.map(i => i.unidade).filter(Boolean))].sort();
    filtroUnidade.innerHTML = '<option value="todos">Todas as Unidades</option>';
    unidades.forEach(unidade => filtroUnidade.innerHTML += `<option value="${unidade}">${unidade}</option>`);

    const filtroFornecedor = document.getElementById('filtro-fornecedor');
    const fornecedores = [...new Set(allData.map(i => i.fornecedor).filter(Boolean))].sort();
    filtroFornecedor.innerHTML = '<option value="todos">Todos os Fornecedores</option>';
    fornecedores.forEach(fornecedor => filtroFornecedor.innerHTML += `<option value="${fornecedor}">${fornecedor}</option>`);
}

function aplicarFiltros() {
    const unidade = document.getElementById('filtro-unidade').value;
    const fornecedor = document.getElementById('filtro-fornecedor').value;
    let dadosFiltrados = allData;
    if (unidade !== 'todos') {
        dadosFiltrados = dadosFiltrados.filter(item => item.unidade === unidade);
    }
    if (fornecedor !== 'todos') {
        dadosFiltrados = dadosFiltrados.filter(item => item.fornecedor === fornecedor);
    }
    atualizarVisualizacao(dadosFiltrados);
}

async function inicializarDashboard() {
    const overlay = document.getElementById('loading-overlay');
    overlay.style.display = 'flex';
    overlay.style.opacity = 1;
    document.getElementById('refresh-icon').classList.add('spinning');
    
    try {
        allData = await buscarDados();
        if (allData.length > 0) {
            popularFiltros();
            atualizarVisualizacao(allData);
        } else {
            throw new Error("Nenhum dado encontrado na planilha. Verifique o formato ou se há linhas preenchidas.");
        }
        overlay.style.opacity = 0;
        setTimeout(() => overlay.style.display = 'none', 300);
    } catch (error) {
        overlay.innerHTML = `<div class="text-center p-4"><ion-icon name="cloud-offline-outline" class="text-5xl text-red-400"></ion-icon><p class="text-white text-lg mt-4">Erro ao Carregar Dados</p><p class="text-slate-400 text-center max-w-sm mt-1">Verifique o link, permissões da planilha e sua conexão.</p><p class="text-xs text-slate-500 mt-4">${error.message}</p></div>`;
    } finally {
        document.getElementById('refresh-icon').classList.remove('spinning');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setDateHeader();
    document.getElementById('refresh-button').addEventListener('click', inicializarDashboard);
    document.getElementById('filtro-unidade').addEventListener('change', aplicarFiltros);
    document.getElementById('filtro-fornecedor').addEventListener('change', aplicarFiltros);
    inicializarDashboard();
});
