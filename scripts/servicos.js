
// Registra o plugin para os gráficos
Chart.register(ChartDataLabels);

const urlPlanilhaServicos = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQVA9J4hdQ-G6PN9ddTbJonHYEBiFM-t-jQrozO-HeVAIpR01iyq_Pt1e-sCEeKgGOzqRAw9Z4cT1-e/pub?output=csv';

let allServicosData = [];

const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
const formatarPercentual = (valor) => `${(valor || 0).toFixed(2).replace('.', ',')}%`;
const parseMoeda = (str) => {
    if (!str || typeof str !== 'string') return 0;
    const valorNumerico = parseFloat(str.replace(/\./g, '').replace('R$', '').trim().replace(',', '.'));
    return isNaN(valorNumerico) ? 0 : valorNumerico;
};

function setDateHeader() {
    document.getElementById('header-date').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

async function buscarDados() {
    if (!urlPlanilhaServicos || urlPlanilhaServicos.includes('COLOQUE_SEU_LINK_CSV_AQUI')) {
        throw new Error("URL da planilha não configurada. Edite o arquivo HTML.");
    }
    try {
        const resposta = await fetch(`${urlPlanilhaServicos}&t=${new Date().getTime()}`);
        if (!resposta.ok) throw new Error(`Erro HTTP ${resposta.status}`);
        const csv = await resposta.text();
        if (csv.trim().startsWith('<')) throw new Error("Dados retornaram como HTML. Verifique se publicou como 'CSV'.");
        if (!csv.trim()) return [];

        const linhas = csv.trim().split('\n');
        const cabecalho = linhas[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase());
        
        const encontrarIndice = (nomes) => nomes.map(n => cabecalho.indexOf(n.toLowerCase())).find(i => i !== -1) ?? -1;

        const indices = {
            unidade: encontrarIndice(['unidade']),
            cliente: encontrarIndice(['cliente']),
            descricao: encontrarIndice(['descricao', 'descrição']),
            valorServico: encontrarIndice(['# valor do servico', 'valor do servico', 'faturamento']),
            custo: encontrarIndice(['# custo', 'custo']),
            lucro: encontrarIndice(['lucro']),
            observacoes: encontrarIndice(['observacoes', 'observações']),
        };
        
        return linhas.slice(1).map(linha => {
                const valores = linha.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map(v => v.replace(/"/g, '')) || [];
            const getValor = (index) => (index > -1 && valores[index]) ? valores[index].trim() : '';
            return {
                Unidade: getValor(indices.unidade),
                Cliente: getValor(indices.cliente),
                Descricao: getValor(indices.descricao),
                Faturamento: parseMoeda(getValor(indices.valorServico)),
                Custo: parseMoeda(getValor(indices.custo)),
                Lucro: parseMoeda(getValor(indices.lucro)),
                Observacoes: getValor(indices.observacoes),
            };
        }).filter(item => item.Unidade || item.Cliente);
    } catch (error) {
        console.error("Erro ao buscar dados:", error);
        throw error;
    }
}

function atualizarVisualizacao(dados) {
    if (!dados) return;

    const faturamento = dados.reduce((a, i) => a + i.Faturamento, 0);
    const lucro = dados.reduce((a, i) => a + i.Lucro, 0);
    document.getElementById('kpi-faturamento').textContent = formatarMoeda(faturamento);
    document.getElementById('kpi-lucro').textContent = formatarMoeda(lucro);
    document.getElementById('kpi-margem').textContent = formatarPercentual(faturamento > 0 ? (lucro / faturamento) * 100 : 0);
    document.getElementById('kpi-itens-servicos').textContent = dados.length;

    const corTexto = '#9ca3af', corGrid = '#334155';
    
    const faturamentoPorUnidade = dados.reduce((a, i) => { if(i.Unidade) a[i.Unidade] = (a[i.Unidade] || 0) + i.Faturamento; return a; }, {});
    if (window.graficoFaturamentoUnidade) window.graficoFaturamentoUnidade.destroy();
    
    window.graficoFaturamentoUnidade = new Chart('chartFaturamentoUnidade', {
        type: 'bar', 
        data: {
            labels: Object.keys(faturamentoPorUnidade), 
            datasets: [{
                label: 'Faturamento', 
                data: Object.values(faturamentoPorUnidade), 
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
                    formatter: (value) => formatarMoeda(value),
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

    const lucroPorCliente = dados.reduce((a, i) => { if(i.Cliente) a[i.Cliente] = (a[i.Cliente] || 0) + i.Lucro; return a; }, {});
    if (window.graficoLucroCliente) window.graficoLucroCliente.destroy();
    
    window.graficoLucroCliente = new Chart('chartLucroCliente', {
        type: 'pie', 
        data: {
            labels: Object.keys(lucroPorCliente), 
            datasets: [{
                data: Object.values(lucroPorCliente), 
                backgroundColor: ['#34d399', '#a78bfa', '#fb923c', '#60a5fa', '#f472b6', '#ec4899'], 
                borderColor: '#1e293b'
            }]
        }, 
        options: {
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: {
                legend: {position: 'bottom', labels: {color: corTexto, padding: 15}},
                datalabels: {
                    display: false, 
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const rawValue = context.raw;
                            const total = context.chart.data.datasets[0].data.reduce((acc, val) => acc + val, 0);
                            const percentage = total > 0 ? ((rawValue / total) * 100).toFixed(2) : 0;
                            
                            return `${label}: ${formatarMoeda(rawValue)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
    
    document.getElementById('tabela-servicos').innerHTML = dados.map(item => `<tr class="hover:bg-slate-700/50">
        <td class="px-4 py-4 text-sm font-medium text-white whitespace-nowrap">${item.Unidade||'-'}</td>
        <td class="px-4 py-4 text-sm text-slate-300 whitespace-nowrap">${item.Cliente||'-'}</td>
        <td class="px-4 py-4 text-sm text-slate-400 max-w-xs truncate" title="${item.Descricao||''}">${item.Descricao||'-'}</td>
        <td class="px-4 py-4 text-sm text-right font-medium text-sky-400 whitespace-nowrap">${formatarMoeda(item.Faturamento)}</td>
        <td class="px-4 py-4 text-sm text-right font-medium text-slate-400 whitespace-nowrap">${formatarMoeda(item.Custo)}</td>
        <td class="px-4 py-4 text-sm text-right font-bold text-emerald-400 whitespace-nowrap">${formatarMoeda(item.Lucro)}</td>
        <td class="px-4 py-4 text-sm text-slate-400 whitespace-nowrap">${item.Observacoes||'-'}</td>
    </tr>`).join('');
}

function popularFiltroUnidade() {
    const filtro = document.getElementById('filtro-unidade');
    const unidades = [...new Set(allServicosData.map(i => i.Unidade).filter(Boolean))].sort();
    filtro.innerHTML = '<option value="todos">Todas as Unidades</option>';
    unidades.forEach(unidade => filtro.innerHTML += `<option value="${unidade}">${unidade}</option>`);
}

async function inicializarDashboard() {
    const overlay = document.getElementById('loading-overlay');
    overlay.style.display = 'flex';
    overlay.style.opacity = 1;
    document.getElementById('refresh-icon').classList.add('spinning');
    
    try {
        allServicosData = await buscarDados();
        
        if (allServicosData.length > 0) {
            popularFiltroUnidade();
            atualizarVisualizacao(allServicosData);
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
    
    document.getElementById('filtro-unidade').addEventListener('change', (e) => {
        const unidadeSelecionada = e.target.value;
        const dadosFiltrados = unidadeSelecionada === 'todos' 
            ? allServicosData 
            : allServicosData.filter(item => item.Unidade === unidadeSelecionada);
        atualizarVisualizacao(dadosFiltrados);
    });
    
    inicializarDashboard();
});