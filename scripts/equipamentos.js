
// ⚠️ SUBSTITUA ESTE LINK PELO SEU LINK CSV REAL DA PLANILHA PUBLICADA!
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRX6YPq3KN_-WwHebeZxQvxlqYgrsXs_mqQLS3CAwu9aZGDQlVO8PPj-mRJIa6kVWr5RL-qxZeht7Ku/pub?output=csv'; 

let allEquipamentosData = [];

// Referências globais para os objetos Chart.js para evitar o erro .destroy()
let chartStatus = null; 
let chartLocalizacao = null; 

const corTexto = '#9ca3af', corGrid = '#334155'; 

function setDateHeader() {
    document.getElementById('header-date').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

async function buscarDados() {
    if (CSV_URL.includes('SEU_LINK_CSV_DA_PLANILHA_AQUI')) {
        throw new Error("URL da planilha não configurada. Edite a constante CSV_URL.");
    }
    try {
        const resposta = await fetch(`${CSV_URL}&t=${new Date().getTime()}`);
        if (!resposta.ok) throw new Error(`Erro HTTP ${resposta.status}`);
        const csv = await resposta.text();
        if (!csv.trim()) return [];

        const linhas = csv.trim().split('\n');
        const cabecalho = linhas[0].split(',').map(h => h.trim().replace(/"/g, '')); 
        
        const encontrarIndice = (nomes) => nomes.map(n => cabecalho.indexOf(n)).find(i => i !== -1) ?? -1;

        // Mapeamento das colunas conforme sua planilha
        const indices = {
            tag: encontrarIndice(['Tag do Equipamento']),
            idAtivo: encontrarIndice(['ID do Ativo']),
            nome: encontrarIndice(['Nome do Equipamento']),
            localizacao: encontrarIndice(['Localização']),
            status: encontrarIndice(['Status']),
            dataManutencao: encontrarIndice(['Data Manutenção']),
            observacoes: encontrarIndice(['Observações']),
        };
        
        return linhas.slice(1).map(linha => {
            const valores = linha.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map(v => v.replace(/"/g, '')) || [];
            const getValor = (index) => (index > -1 && valores[index]) ? valores[index].trim() : '';

            return {
                Tag: getValor(indices.tag),
                IDAtivo: getValor(indices.idAtivo),
                Nome: getValor(indices.nome),
                Localizacao: getValor(indices.localizacao) || 'Não Alocada',
                Status: getValor(indices.status) || 'Não Definido',
                DataManutencao: getValor(indices.dataManutencao),
                Observacoes: getValor(indices.observacoes),
            };
        }).filter(item => item.Tag || item.Nome);

    } catch (error) {
        console.error("Erro ao buscar dados:", error);
        throw error;
    }
}

function atualizarVisualizacao(dados) {
    if (!dados) return;

    // Cálculos dos KPIs
    const totalAtivos = dados.length;
    const necessitaReparo = dados.filter(i => i.Status.toLowerCase().includes('reparo')).length;
    
    const dataLimite = new Date();
    dataLimite.setMonth(dataLimite.getMonth() - 6);
    const atrasoManutencao = dados.filter(i => {
        if (!i.DataManutencao || i.DataManutencao === '') return false;
        // Tenta criar a data no formato YYYY-MM-DD
        const [ano, mes, dia] = i.DataManutencao.split('-');
        const dataManut = new Date(ano, mes - 1, dia); 
        
        return dataManut.toString() !== "Invalid Date" && dataManut < dataLimite;
    }).length;
    

    // 1. Atualização dos KPIs
    document.getElementById('kpi-total-ativos').textContent = totalAtivos;
    document.getElementById('kpi-necessita-reparo').textContent = necessitaReparo;
    document.getElementById('kpi-atraso-manutencao').textContent = atrasoManutencao;

    // 2. Processamento dos Dados para Gráficos
    const statusCounts = dados.reduce((a, i) => { if(i.Status) a[i.Status] = (a[i.Status] || 0) + 1; return a; }, {});
    const localizacaoCounts = dados.reduce((a, i) => { if(i.Localizacao) a[i.Localizacao] = (a[i.Localizacao] || 0) + 1; return a; }, {});
    
    const baseColors = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#06b6d4', '#e879f9']; 
    
    // 3. Criação dos Gráficos
    
    // Chart Status (Doughnut)
    if (chartStatus) chartStatus.destroy(); // Destrói a instância anterior
    chartStatus = new Chart('chartStatus', { // Cria a nova instância
        type: 'doughnut', 
        data: {
            labels: Object.keys(statusCounts), 
            datasets: [{
                data: Object.values(statusCounts), 
                backgroundColor: baseColors.slice(0, Object.keys(statusCounts).length),
                borderColor: '#0f172a',
                borderWidth: 2
            }]
        }, 
        options: {
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: {
                legend: {position: 'bottom', labels: {color: corTexto, padding: 15}}
            }
        }
    });

    // Chart Localização (Barra)
    if (chartLocalizacao) chartLocalizacao.destroy(); // Destrói a instância anterior
    chartLocalizacao = new Chart('chartLocalizacao', { // Cria a nova instância
        type: 'bar', 
        data: {
            labels: Object.keys(localizacaoCounts), 
            datasets: [{
                label: 'Qtd. Equipamentos', 
                data: Object.values(localizacaoCounts), 
                backgroundColor: '#4f46e5',
                borderRadius: 4
            }]
        }, 
        options: {
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: {legend: {display: false}}, 
            scales: {
                y: {ticks: {color: corTexto, beginAtZero: true}, grid: {color: corGrid}}, 
                x: {ticks: {color: corTexto, autoSkip: false, maxRotation: 45, minRotation: 45}, grid: {display: false}}
            }
        }
    });

    // 4. Renderização da Tabela
    document.getElementById('tabela-equipamentos').innerHTML = dados.map(item => {
        const statusLower = item.Status.toLowerCase();
        const statusClass = statusLower.includes('reparo') || statusLower.includes('danificado') 
            ? 'text-red-400' 
            : statusLower.includes('manutenção')
            ? 'text-amber-400'
            : 'text-emerald-400';

        return `<tr class="hover:bg-slate-700/50">
            <td class="px-4 py-4 text-sm font-medium text-white whitespace-nowrap">${item.Tag||'-'}</td>
            <td class="px-4 py-4 text-sm text-slate-300 max-w-xs truncate" title="${item.Nome||''}">${item.Nome||'-'}</td>
            <td class="px-4 py-4 text-sm text-slate-400 whitespace-nowrap">${item.Localizacao||'-'}</td>
            <td class="px-4 py-4 text-sm font-bold ${statusClass} whitespace-nowrap">${item.Status}</td>
            <td class="px-4 py-4 text-sm text-slate-400 whitespace-nowrap">${item.DataManutencao||'-'}</td>
            <td class="px-4 py-4 text-sm text-slate-400 max-w-sm truncate" title="${item.Observacoes||''}">${item.Observacoes||'-'}</td>
        </tr>`
    }).join('');
}

// Função para popular o filtro de Localização
function popularFiltroLocalizacao() {
    const filtro = document.getElementById('filtro-localizacao');
    const localizacoes = [...new Set(allEquipamentosData.map(i => i.Localizacao).filter(Boolean))].sort();
    filtro.innerHTML = '<option value="todos">Todas as Localizações</option>';
    localizacoes.forEach(loc => filtro.innerHTML += `<option value="${loc}">${loc}</option>`);
}

// Função principal de inicialização
async function inicializarDashboard() {
    const overlay = document.getElementById('loading-overlay');
    overlay.style.display = 'flex';
    overlay.style.opacity = 1;
    document.getElementById('refresh-icon').classList.add('spinning');
    
    try {
        allEquipamentosData = await buscarDados();
        
        if (allEquipamentosData.length > 0) {
            popularFiltroLocalizacao();
            const localizacaoSelecionada = document.getElementById('filtro-localizacao').value;
            const dadosFiltrados = localizacaoSelecionada === 'todos' 
                ? allEquipamentosData 
                : allEquipamentosData.filter(item => item.Localizacao === localizacaoSelecionada);
            atualizarVisualizacao(dadosFiltrados);
        } else {
                throw new Error("Nenhum dado encontrado. Verifique se a planilha está publicada como CSV e se o link está correto.");
        }
        
        overlay.style.opacity = 0;
        setTimeout(() => overlay.style.display = 'none', 300);

    } catch (error) {
        overlay.innerHTML = `<div class="text-center p-4"><ion-icon name="cloud-offline-outline" class="text-5xl text-red-400"></ion-icon><p class="text-white text-lg mt-4">Erro ao Carregar Dados</p><p class="text-slate-400 text-center max-w-sm mt-1">Verifique o link, permissões da planilha e se há dados.</p><p class="text-xs text-slate-500 mt-4">${error.message}</p></div>`;
    } finally {
        document.getElementById('refresh-icon').classList.remove('spinning');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setDateHeader();
    
    document.getElementById('refresh-button').addEventListener('click', inicializarDashboard);
    
    document.getElementById('filtro-localizacao').addEventListener('change', (e) => {
        const localizacaoSelecionada = e.target.value;
        const dadosFiltrados = localizacaoSelecionada === 'todos' 
            ? allEquipamentosData 
            : allEquipamentosData.filter(item => item.Localizacao === localizacaoSelecionada);
        atualizarVisualizacao(dadosFiltrados);
    });
    
    inicializarDashboard();
});

