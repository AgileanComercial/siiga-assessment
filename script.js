// ═══════════════════════════════════════════
//  SUPABASE SETUP
// ═══════════════════════════════════════════
const SUPABASE_URL = 'https://ghtdfhupjoddfwiqzdpa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodGRmaHVwam9kZGZ3aXF6ZHBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjY4MTYsImV4cCI6MjA5NTMwMjgxNn0.d0FDQk-P_xTWslTN2zIfxi8wNpxpf1Xwz5AhX3cnUnc';

// Renomeado de "supabase" para "sbClient": o UMD do @supabase/supabase-js@2
// declara um "var supabase" global, que colide com um "const supabase" aqui
// (SyntaxError: Identifier 'supabase' has already been declared), impedindo
// TODO o script.js de rodar. Bug pré-existente, não relacionado ao ROI real.
const sbClient = (window.supabase && SUPABASE_URL !== 'YOUR_SUPABASE_URL_HERE')
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// ═══════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════
var S = {
  empresa:'', consultor:'', contato:'', cargo:'', email:'', telefone:'', data:'',
  numObras:5, orcamentoMedio:8000000, prazoMedio:18, numObrasRange:'', orcamentoRange:'',
  tipologia:'', modeloMO:'', momento:'',
  scores:{ b03:0, b06:0, f1:[0,0,0,0,0,0,0,0], f2:[0,0,0,0,0], f3:[0,0,0,0,0,0,0], mo:{}, f4:[0,0,0,0,0] },
  showMO: false,
  // Dados para o cálculo de ROI real (calculadora-roi-agilean) — coletados dentro das fases relacionadas
  // custoHora: fixo (ROI_REAL_K.CUSTO_HORA_TECNICA) — não é mais perguntado ao cliente
  // diasAtual: derivado da resposta de MO.4/MO.7 — não é mais perguntado ao cliente (evita duplicidade)
  roi2: {
    folha: 0,
    hDiaAtual: 0, hSemQualidade: 0,
    fluxoPlanejar: 0, fluxoCurto: 0, fluxoMedio: 0, fluxoReprogramar: 0,
    fluxoMedir: 0, fluxoConferir: 0, fluxoERP: 0, fluxoCruzar: 0
  },
  mensalidade: 2000, captura: 0.50
};

var currentBlock = 'b0';
var currentQIdx = 0;
var phaseOrder = ['f1','f2','f3','f4'];
var currentPhaseIdx = 0;
var radarChartInst = null;
var RADAR_STATE = null; // último dado usado no radar — reaproveitado para desenhar a versão clara do PDF

// Desenha o radar SIIGA num <canvas>. light=true usa cores para fundo branco
// (usado na exportação do PDF); light=false (padrão) usa o tema escuro do app.
function drawRadarChart(canvasEl, state, light) {
  var gridColor   = light ? 'rgba(0,0,0,0.10)'  : 'rgba(255,255,255,0.07)';
  var tickColor   = light ? 'rgba(0,0,0,0.35)'  : 'rgba(255,255,255,0.25)';
  var labelColor  = light ? 'rgba(0,0,0,0.65)'  : 'rgba(255,255,255,0.65)';
  var marketColor = light ? 'rgba(0,0,0,0.28)'  : 'rgba(255,255,255,0.25)';
  var marketFill  = light ? 'rgba(0,0,0,0.03)'  : 'rgba(255,255,255,0.03)';
  return new Chart(canvasEl.getContext('2d'), {
    type:'radar',
    data:{
      labels: state.labels,
      datasets:[
        {label:'Sua empresa',data:state.clientPct.map(function(p){return Math.round(p*100);}),borderColor:'#ff5f1f',backgroundColor:'rgba(255,95,31,0.12)',borderWidth:2.5,pointRadius:4,pointBackgroundColor:'#ff5f1f'},
        {label:'Média de mercado',data:state.benchmark.map(function(p){return Math.round(p*100);}),borderColor:marketColor,backgroundColor:marketFill,borderWidth:1.5,pointRadius:3,borderDash:[5,3]},
        {label:'Referência SIIGA',data:state.reference.map(function(p){return Math.round(p*100);}),borderColor:'#34d399',backgroundColor:'rgba(52,211,153,0.14)',borderWidth:1.5,pointRadius:3,borderDash:[3,3]}
      ]
    },
    options:{
      responsive: !light,
      animation: light ? false : undefined,
      scales:{r:{min:0,max:100,ticks:{stepSize:25,color:tickColor,backdropColor:'transparent',font:{size:9}},grid:{color:gridColor},angleLines:{color:gridColor},pointLabels:{color:function(ctx){ return ctx.index === state.worstIdx ? '#dc2626' : labelColor; },font:function(ctx){ return {family:'Bai Jamjuree',size:12,weight: ctx.index === state.worstIdx ? '700' : '600'}; }}}},
      plugins:{legend:{display:false}}
    }
  });
}

// ═══════════════════════════════════════════
//  DATA
// ═══════════════════════════════════════════
var B0Q = [
  // TELA 01: Dados da operação — número exato de obras + orçamento médio (entrada principal)
  { id:'b0dados', code:'B0.1', key:'roi', badge:'bb0', blabel:'Bloco 0 · Contexto Estratégico', scored:false, type:'roi',
    text:'Para começarmos, informe os dados básicos da operação:',
    reveals:''
  },
  // TELA 02: Tipologia — com MCMV
  { id:'b02', code:'B0.2', key:'tipologia', badge:'bb0', blabel:'Bloco 0 · Contexto Estratégico', scored:false,
    text:'Qual é o perfil predominante das obras?',
    reveals:'',
    opts:[
      {v:'vert',   l:'Residencial vertical',       s:'Condomínios, edifícios', score:0},
      {v:'horiz',  l:'Residencial horizontal',     s:'Casas, loteamentos, condomínios fechados', score:0},
      {v:'mcmv',   l:'MCMV / Habitação popular',   s:'Minha Casa Minha Vida e programas habitacionais', score:0},
      {v:'com',    l:'Comercial / industrial',     s:'Galpões, edifícios comerciais, hospitais', score:0},
      {v:'div',    l:'Portfólio diversificado',    s:'Mais de um tipo simultaneamente', score:0}
    ]
  },
  // TELA 03: Estrutura de time (scored)
  { id:'b03', code:'B0.3', key:'b03', badge:'bb0', blabel:'Bloco 0 · Contexto Estratégico', scored:true,
    text:'Como vocês estão organizados para gerir o planejamento e controle das obras? Existe uma sala técnica dedicada — ou esse trabalho fica na mão do próprio engenheiro da obra?',
    reveals:'',
    opts:[
      {v:'0', l:'A obra acumula tudo',                         s:'Engenheiro gerencia canteiro, plano e controle ao mesmo tempo', score:0},
      {v:'1', l:'Engenheiro com algum suporte',                s:'Apoio esporádico de escritório ou estagiário', score:1},
      {v:'2', l:'Sala técnica parcial',                        s:'Time dedicado mas sem método estruturado', score:2},
      {v:'3', l:'Sala técnica dedicada ou consultoria estruturada', s:'Especialista em planejamento e controle de obras', score:3}
    ]
  },
  // TELA 04: Modelo de MO
  { id:'b04', code:'B0.4', key:'modeloMO', badge:'bb0', blabel:'Bloco 0 · Contexto Estratégico', scored:false,
    text:'Como vocês trabalham a mão de obra nas obras?',
    reveals:'',
    opts:[
      {v:'propria',      l:'Predominantemente própria',    s:'70%+ de mão de obra CLT ou cooperada', score:0},
      {v:'mista',        l:'Modelo misto',                 s:'Combinação de empreiteiros e equipe própria', score:0},
      {v:'terceirizada', l:'Predominantemente empreitada', s:'70%+ terceirizado via contratos de empreitada', score:0}
    ]
  },
  // TELA 05: Momento estratégico
  { id:'b05', code:'B0.5', key:'momento', badge:'bb0', blabel:'Bloco 0 · Contexto Estratégico', scored:false,
    text:'A empresa está em crescimento — abrindo novas frentes — ou num momento de consolidar e melhorar a operação atual?',
    reveals:'',
    opts:[
      {v:'crescimento',  l:'Crescimento acelerado',   s:'Aumentando obras, equipe e faturamento rapidamente', score:0},
      {v:'consolidacao', l:'Consolidação e melhoria', s:'Melhorando processos e rentabilidade do volume atual', score:0},
      {v:'estavel',      l:'Operação estável',        s:'Volume constante, foco em eficiência operacional', score:0}
    ]
  },
  // TELA 06: Estrutura do orçamento (scored)
  { id:'b06', code:'B0.6', key:'b06', badge:'bb0', blabel:'Bloco 0 · Contexto Estratégico', scored:true,
    text:'Como o orçamento das obras é estruturado?',
    reveals:'',
    opts:[
      {v:'0', l:'Verbalizado ou global por m²',                    s:'Sem separação por serviço ou composição de custos', score:0},
      {v:'1', l:'Quantitativos e preços, sem composição',          s:'Lista de serviços com preços, sem detalhamento de MO', score:1},
      {v:'2', l:'Composições com MO segregada, desalinhado da EAP',s:'Detalhado, mas cronograma e orçamento não conversam', score:2},
      {v:'3', l:'Composições, MO segregada, alinhado à EAP',       s:'Orçamento e planejamento integrados desde a concepção', score:3}
    ]
  }
];

var PQ = {
  f1:{
    phase:1, badgeClass:'bf1', color:'#60a5fa', colorHex:'#1B4F8A',
    label:'Fase 1 · Planejamento Estratégico do Fluxo de Produção',
    maxScore:21,
    insight: function(p){
      if(p<0.4) return 'Seu planejamento existe, mas ainda não governa a execução. A obra toma decisões sem linha de base — cada atraso é uma surpresa, não um desvio calculado.';
      if(p<0.7) return 'Planejamento em construção. A base existe, mas faltam as conexões financeiras e o acompanhamento ativo da Curva S para que o plano governe de verdade.';
      return 'Planejamento bem estruturado. O foco agora é refinar a integração entre cronograma bancário, suprimentos e acompanhamento ativo dos indicadores.';
    },
    qs:[
      { code:'F1.1', text:'Antes de iniciar a obra, existe um planejamento formal aprovado — ou o cronograma vai sendo construído durante a execução?', reveals:'Avalia a cultura de planejamento: se o plano existe antes da obra começar e se passa por aprovação formal da gestão.',
        opts:[{l:'Sem planejamento formal',s:'A obra começa sem cronograma definido',score:0},{l:'Cronograma genérico',s:'Existe, mas só com atividades macro e datas gerais',score:1},{l:'Cronograma detalhado por atividades',s:'Atividades detalhadas, mas sem validação formal antes do início',score:2},{l:'Planejamento formal aprovado antes do início',s:'Cronograma detalhado, validado e aprovado pela gestão antes de mobilizar',score:3}]
      },
      { code:'F1.2', text:'Qual técnica de planejamento vocês utilizam nas obras?', reveals:'Avalia a maturidade técnica do planejamento: desde o cronograma empírico até a Linha de Balanço com lotes formalizados — que é a base do método SIIGA.',
        opts:[{l:'Sem técnica estruturada',s:'Planejamento empírico ou planilha livre sem método definido',score:0},{l:'Gantt com atividades sequenciais',s:'Cronograma tradicional, sem lógica de fluxo por lote',score:1},{l:'Linha de Balanço com lotes macros (ex: pavimento)',s:'Estrutura existe mas sem subdivisão por atividade e sem critérios de terminalidade definidos',score:2},{l:'Linha de Balanço com lotes definidos e critério de terminalidade',s:'Lotes formalizados com dicionário de pacotes e critério claro de conclusão',score:3}]
      },
      { code:'F1.3', text:'A duração de cada pacote é definida por quantidade de serviço e produtividade, ou é mais baseada em experiência anterior e estimativa?', reveals:'Base técnica do dimensionamento — pré-requisito direto do Ensaio de Recursos.',
        opts:[{l:'Estimativa empírica',s:'Baseado no feeling de quem faz',score:0},{l:'Dados históricos informais',s:'Lembramos de obras parecidas',score:1},{l:'Referências de obras similares',s:'Consultamos registros de projetos anteriores',score:2},{l:'Cálculo por quantidades × produtividade',s:'Dimensionamento técnico com base em dados reais de produção',score:3}]
      },
      { code:'F1.4', text:'O orçamento e o planejamento da obra estão integrados — ou são documentos que vivem separados?', reveals:'Avalia se o físico e o financeiro conversam: base para que a Curva S reflita a realidade e não apenas a intenção inicial.',
        anchor:'E quando o orçamento é atualizado — isso reflete automaticamente na sua Curva S, ou ainda tem um passo manual para reprocessar?',
        opts:[{l:'Separados — nunca se encontram',s:'Orçamento e planejamento são documentos independentes',score:0},{l:'Integração inicial congelada',s:'A associação foi feita no início da obra mas não acompanha mudanças — estão descolados',score:1},{l:'Integração manual ativa',s:'Quando o orçamento ou o plano muda, alguém atualiza manualmente — funciona mas gera retrabalho',score:2},{l:'Integração via sistema, sem planilhas',s:'O orçamento vem direto do ERP para a plataforma de planejamento, sem intermediários',score:3}]
      },
      { code:'F1.6', text:'Quando analisam o desempenho da obra, existe uma rotina de comparar o avanço realizado contra o planejado na Curva S — calculando média de avanço e fazendo projeção de término?', reveals:'Leitura estratégica da Curva S: a diferença entre ter o gráfico e usar o gráfico para decidir.',
        anchor:'E quando identificam que o avanço realizado está abaixo do planejado — existe processo para calcular o ritmo necessário de recuperação e validar se ele é viável com as equipes que têm hoje?',
        opts:[{l:'Sem análise',s:'Não olhamos para a Curva S regularmente',score:0},{l:'Análise esporádica e qualitativa',s:'Olhamos quando tem reunião com cliente',score:1},{l:'Análise periódica sem projeção',s:'Sabemos onde estamos mas não onde vamos terminar',score:2},{l:'Análise com % real vs. planejado, média e projeção de término',s:'Leitura completa dos indicadores com decisão baseada em dado',score:3}]
      },
      { code:'F1.7', text:'Além do físico-financeiro de gestão, existe um cronograma bancário estruturado — com as medições previstas alinhadas ao ritmo real de execução da obra?', reveals:'Gap mais custoso e menos visível: retrabalho duplo em toda reprogramação, falta de visão de exposição de caixa e risco de glosa.',
        anchor:'O cronograma que vai para o banco e o que a obra usa para se planejar são dois documentos diferentes, mantidos por pessoas diferentes, que nunca conversam. Você consegue dizer hoje qual é a exposição de caixa da obra?',
        opts:[{l:'Sem cronograma bancário',s:'Medições são feitas sem referência de planejamento',score:0},{l:'Existe, completamente desconectado do planejamento',s:'O financeiro tem uma planilha separada',score:1},{l:'Atualizado manualmente de forma eventual',s:'Atualizamos quando vence medição',score:2},{l:'Integrado na mesma plataforma, atualizado dinamicamente',s:'A medição de avanço de obra alimenta automaticamente o cronograma bancário',score:3}]
      },
      { code:'F1.5', text:'Existe integração entre o planejamento da obra e o processo de suprimentos — o cronograma de compras é definido com base nas datas de início de cada pacote planejado?', reveals:'ROI direto em compras (menos urgência, melhor negociação). A ausência explica grande parte das paradas por material faltante.',
        anchor:'A integração planejamento × suprimentos é um dos ganhos mais rápidos e visíveis quando o SIIGA é implantado. Cada compra emergencial tem custo oculto que nunca aparece no relatório.',
        opts:[{l:'Suprimentos totalmente reativo',s:'Compra quando percebe que vai faltar',score:0},{l:'Alinhamento informal eventual',s:'Avisamos compras quando lembramos',score:1},{l:'Cronograma de compras existe, desconectado do planejamento',s:'Temos um cronograma mas não bate com o plano de obra',score:2},{l:'Cronograma gerado a partir do planejamento',s:'Compras alinhadas com o planejamento e reprogramações de forma automática',score:3}]
      },
      { code:'F1.ROI', type:'numgrid', text:'Para dimensionar o potencial de ganho da sua operação, informe:', reveals:'Esses dados alimentam o cálculo de ROI real do diagnóstico — tempo hoje gasto em rotinas manuais de gestão.',
        fields:[
          {key:'fluxoPlanejar', label:'Horas/mês gastas planejando o cronograma', type:'number', placeholder:'Ex: 16'}
        ]
      }
    ]
  },
  f2:{
    phase:2, badgeClass:'bf2', color:'#2dd4bf', colorHex:'#0D7C8C',
    label:'Fase 2 · Proteção e Garantia da Execução do Plano',
    maxScore:12,
    insight: function(p){
      if(p<0.4) return 'Restrições aparecem quando já estão atrasando. Você está respondendo a problemas que poderia ter antecipado — esse tempo de resposta tem custo direto de produção parada.';
      if(p<0.7) return 'Alguma proteção existe, mas é informal. O lookahead não está funcionando como blindagem real — ainda há surpresas que poderiam ter sido antecipadas.';
      return 'Bom nível de proteção da execução. A maturidade aqui permite colher os frutos de uma Fase 3 mais estruturada.';
    },
    qs:[
      { code:'F2.1', text:'Existe alguma rotina — semanal ou quinzenal — onde a equipe olha para as próximas 4 a 6 semanas e mapeia o que pode travar a execução antes de acontecer?', reveals:'Existência de lookahead estruturado e gestão de restrições. O critério não é o nome da reunião — é se ela realmente antecipa problemas com consistência.',
        opts:[{l:'Sem rotina de médio prazo',s:'Problemas aparecem quando já travaram a produção',score:0},{l:'Discussões baseadas na experiência dos gestores',s:'Sem agenda ou frequência definida — o conhecimento está nas pessoas, não no processo',score:1},{l:'Reuniões com agenda e frequência definidas',s:'Pauta existe e há regularidade, mas os registros são informais e não há processo de cobrança e análise',score:2},{l:'Lookahead estruturado com restrições categorizadas e responsáveis',s:'Processo formal com registro, cobrança e análise de cada restrição por categoria',score:3}]
      },
      { code:'F2.2', text:'Com que antecedência vocês conseguem visualizar riscos de parada — por falta de material, projeto não liberado ou frente bloqueada?', reveals:'Mede a efetividade real da antecipação — independente de existir ou não uma rotina formal. Nota de condução: se F2.1 foi score 0 ou 1, reformule como confirmação: "Dado que ainda não há uma rotina estruturada de médio prazo, é natural que restrições apareçam quando já estão travando — me confirme: isso costuma acontecer dias antes ou só quando já parou?"',
        anchor:'Quanto custa, por mês, cada semana perdida por uma restrição que poderia ter sido antecipada?',
        opts:[{l:'Identificado quando a produção já parou',s:'Descobrimos na hora — sem tempo de agir',score:0},{l:'Dias antes',s:'Percebemos com poucos dias, pouco tempo para resolver',score:1},{l:'1–2 semanas antes',s:'Alguma antecipação mas insuficiente para compras longas',score:2},{l:'4+ semanas antes, com plano de remoção estruturado',s:'Antecipação real com ação planejada',score:3}]
      },
      { code:'F2.3', text:'Os empreiteiros ou equipes próprias que vão entrar nas próximas 2 semanas já estão contratados e confirmados — ou isso ainda está em definição?', reveals:'Planejamento de MO no médio prazo. Equipe não confirmada para as próximas 2 semanas é risco imediato de parada.',
        opts:[{l:'Definido no momento de entrada',s:'Contratamos quando o serviço já vai começar',score:0},{l:'Definido com poucos dias de antecedência',s:'Resolvemos na última hora',score:1},{l:'Planejado com 1–2 semanas',s:'Alguma antecipação na contratação',score:2},{l:'Confirmado com 4+ semanas, alinhado ao lookahead',s:'Contratação integrada ao planejamento de médio prazo',score:3}]
      },
      { code:'F2.4', text:'Ao final de cada ciclo de execução — mensal, bimestral ou conforme o ritmo da obra — existe uma reprogramação formal, revisando o que foi feito e construindo novo plano?', reveals:'Cultura de reprogramação. Não fixamos a frequência — o que importa é se o ciclo existe, seja qual for o intervalo.',
        opts:[{l:'Planejamento original até o fim',s:'Não reprogramamos — seguimos o plano inicial',score:0},{l:'Ajustes informais ocasionais',s:'Quando o desvio é muito grande, conversamos',score:1},{l:'Reprogramação periódica sem dados formais',s:'Fazemos mas é mais no feeling',score:2},{l:'Ciclo formal de reprogramação com PPC e análise de causas',s:'Dados reais alimentam o novo plano',score:3}]
      },
      { code:'F2.ROI', type:'numgrid', text:'Quanto tempo sua equipe gasta hoje nas rotinas de curto e médio prazo?', reveals:'Tempo gasto nessas rotinas manuais é diretamente recuperável com o SIIGA.',
        fields:[
          {key:'fluxoCurto', label:'Horas/mês criando o curto prazo', type:'number', placeholder:'Ex: 4'},
          {key:'fluxoMedio', label:'Horas/mês controlando o médio prazo', type:'number', placeholder:'Ex: 4'},
          {key:'fluxoReprogramar', label:'Horas/mês reprogramando', type:'number', placeholder:'Ex: 14'}
        ]
      }
    ]
  },
  f3:{
    phase:3, badgeClass:'bf3', color:'#34d399', colorHex:'#0D6B45',
    label:'Fase 3 · Gestão Integrada da Produção',
    maxScore:18,
    insight: function(p){
      if(p<0.4) return 'O canteiro está produzindo sem feedback real. O plano existe mas não governa a execução. A gestão descobre o problema 2 semanas depois que ele aconteceu.';
      if(p<0.7) return 'Alguma gestão da produção existe, mas sem integração completa. O dado do canteiro chega com atraso e não conecta ao pagamento de forma sistemática.';
      return 'Boa gestão da produção em campo. A integração qualidade × pagamento e análise intermediária são os próximos passos para fechar o ciclo completo.';
    },
    qs:[
      { code:'F3.1', text:'Existe uma programação semanal estruturada — com metas por equipe, responsáveis definidos e vínculo com o planejamento de médio prazo (lookahead)?', reveals:'Avalia se o plano semanal é um desdobramento real do lookahead ou apenas uma lista de tarefas improvisada. O vínculo com o médio prazo é o que garante que a semana não comece do zero.',
        opts:[{l:'Sem programação semanal',s:'O encarregado decide o que fazer no dia, sem plano definido',score:0},{l:'Programação a cargo do encarregado, desconectada do planejamento global',s:'Existe mas é informal e não consulta o lookahead — o conhecimento está nas pessoas, não no processo',score:1},{l:'Programação semanal estruturada por equipe, sem vínculo formal com o lookahead',s:'O engenheiro monta a semana mas sem consultar o plano de médio prazo',score:2},{l:'Plano de comprometimento semanal gerado a partir do lookahead, com metas por equipe e coleta de causas de não cumprimento e cálculo do PPC',s:'Desdobramento formal do médio prazo com accountability semanal',score:3}]
      },
      { code:'F3.2', text:'Existe uma rotina diária de check-out e check-in — onde a equipe registra o que não foi feito ontem, a causa e a ação imediata, e o que pode impedir a execução hoje?', reveals:'Avalia se o fluxo de informação do canteiro para a gestão acontece diariamente ou só no fechamento. Quando esse ritual não existe, o engenheiro descobre os problemas de forma descoordenada ao longo do dia — o que reduz drasticamente sua capacidade de agir.',
        anchor:'O ciclo de check-out e check-in deve acontecer até que todos os líderes de frente ou equipe cumpram o rito sugerido. Com isso, o tratamento de desvios e restrições passa a ser mais rápido e efetivo.',
        opts:[{l:'Sem rotina diária',s:'O que acontece no canteiro fica no canteiro — engenheiro descobre quando o problema já impactou',score:0},{l:'Conversa informal do encarregado com a equipe no início do turno',s:'Sem método, sem registro, sem causa padrão — depende de quem está presente',score:1},{l:'Reunião diária com participação da engenharia, mas sem formulário padrão nem causa padrão',s:'Existe regularidade mas fica longa, desorganizada ou inconsistente',score:2},{l:'Check-out e check-in estruturados: pauta fixa, até 30 min, formulário de causa padrão, ação imediata com responsável e quadro de gestão à vista atualizado',s:'Ritual completo que garante visibilidade diária do PPC por equipe',score:3}]
      },
      { code:'F3.3', text:'Quando uma meta não é atingida, existe um registro formal da causa — e alguém que trate essa causa para ela não se repetir?', reveals:'Rastreabilidade de desvios e melhoria contínua. Sem isso, os mesmos problemas se repetem indefinidamente.',
        opts:[{l:'Sem registro',s:'Desvios ficam no verbal',score:0},{l:'Registro informal eventual',s:'Às vezes anotamos em planilha',score:1},{l:'Registro sem análise de causa',s:'Sabemos o que não foi feito mas não por quê',score:2},{l:'Registro + análise de causa + ação corretiva com responsável',s:'Ciclo completo de não conformidade',score:3}]
      },
      { code:'F3.4', text:'Com que frequência é feita a coleta do avanço físico — o que foi executado de fato nas obras?', reveals:'A frequência da coleta define a velocidade com que a gestão consegue agir sobre desvios. Coleta mensal significa que um desvio pode se acumular por 4 semanas antes de ser visto.',
        opts:[{l:'Estimativa — sem coleta formal',s:'Ninguém mede de fato, o número vem do feeling do engenheiro',score:0},{l:'Coleta mensal manual',s:'O engenheiro mede o avanço de todas as atividades uma vez por mês',score:1},{l:'Coleta quinzenal',s:'Frequência maior mas ainda manual, com gap de até 15 dias',score:2},{l:'Coleta semanal com autoapontamento',s:'Equipe registra o avanço, encarregado valida — gestão recebe dado em tempo próximo ao real',score:3}]
      },
      { code:'F3.5', text:'Existe algum vínculo entre a qualidade aprovada de um serviço e a liberação do pagamento daquele serviço para a equipe?', reveals:'Integração do ciclo Plano → Produção → Qualidade → Pagamento. Sem esse vínculo, paga-se por produção que pode precisar de retrabalho.',
        opts:[{l:'Sem vínculo',s:'Pagamento e qualidade são processos separados',score:0},{l:'Verificação amostral',s:'Conferimos antes de pagar, mas apenas em parte dos serviços — não em todos',score:1},{l:'Qualidade verificada, mas não trava pagamento',s:'Inspecionamos mas pagamos mesmo com pendência',score:2},{l:'FVS aprovada é pré-requisito para liberação de pagamento',s:'Qualidade trava o pagamento automaticamente',score:3}]
      },
      { code:'F3.6', text:'No meio do período — quinzenal ou semanalmente — existe análise de resultado intermediário: funcionários ou equipes com produção abaixo do esperado, empreiteiros com mais não conformidades?', reveals:'Análise intermediária de MO improdutiva e qualidade de empreiteiros — separa gestão que age antes do fechamento da que descobre o problema depois.',
        opts:[{l:'Sem análise intermediária',s:'Só sabemos no fechamento do mês',score:0},{l:'Análise verbal eventual na reunião',s:'Comentamos quando alguém percebe',score:1},{l:'Análise periódica sem dado formal',s:'Temos percepção mas sem número',score:2},{l:'Relatório quinzenal com ranking de produtividade e NCs por empreiteiro',s:'Dado formal guia decisão de realocação',score:3}]
      },
      { code:'F3.ROI', type:'numgrid', text:'Para dimensionar o ganho operacional, informe os dados abaixo sobre o fechamento e a rotina de produção:', reveals:'Base para o cálculo de horas recuperadas por mês e por obra. Os dias de fechamento já foram capturados no Bloco MO.',
        fields:[
          {key:'hDiaAtual', label:'Horas/dia dedicadas a esse fechamento', type:'number', placeholder:'Ex: 6'},
          {key:'fluxoMedir', label:'Horas/mês medindo avanço físico', type:'number', placeholder:'Ex: 20'},
          {key:'hSemQualidade', label:'Horas/semana conferindo qualidade', type:'number', placeholder:'Ex: 5'},
          {key:'fluxoConferir', label:'Horas/mês conferindo planilhas', type:'number', placeholder:'Ex: 12'},
          {key:'fluxoERP', label:'Horas/mês passando medição para o ERP', type:'number', placeholder:'Ex: 10'}
        ]
      }
    ]
  },
  mo:{
    phase:'MO', badgeClass:'bmo', color:'#34d399', colorHex:'#0D6B45',
    label:'Bloco MO · Gestão de Mão de Obra',
    maxScore:21,
    insight: function(p){ return 'As respostas sobre gestão de MO alimentam diretamente o Mapa de Oportunidades e dimensionam o potencial de captura nos módulos de MO da plataforma.'; },
    qs:[
      { code:'MO.1', moType:'propria', text:'As equipes sabem quanto vão ganhar em cada tarefa antes de começar — o valor está claro antes do início da atividade?', reveals:'Transparência de metas de ganho. Quando o operário não sabe o que vai ganhar, não tem como se comprometer com uma meta.',
        opts:[{l:'Definido só no fechamento',s:'A equipe descobre no pagamento',score:0},{l:'Comunicado informalmente pelo mestre',s:'O mestre fala o valor de boca',score:1},{l:'Valor definido antes, mas sem formalização',s:'Alinhamos verbalmente antes de começar',score:2},{l:'Estudo de pacote entregue à equipe antes do início',s:'Documento formal com valor e meta clara',score:3}]
      },
      { code:'MO.2', moType:'propria', text:'Você consegue identificar hoje quais funcionários estão com produção abaixo do esperado — cujo custo de carteira não está sendo coberto pela produção gerada?', reveals:'Visibilidade de improdutividade individual. Funcionário improdutivo é custo sem dono.',
        opts:[{l:'Sem visibilidade',s:'Não temos como saber individualmente',score:0},{l:'Percepção subjetiva do mestre',s:'O mestre sabe quem rende menos',score:1},{l:'Algum controle manual eventual',s:'Fazemos uma estimativa de vez em quando',score:2},{l:'Relatório quinzenal: valor produzido vs. custo de carteira por funcionário',s:'Dado objetivo por colaborador',score:3}]
      },
      { code:'MO.3', moType:'propria', text:'Quando surge necessidade de pagar por atividade fora do planejado — retrabalho, mobilização emergencial — existe processo formal de solicitação e aprovação de verba antes de executar?', reveals:'Gestão de aditivos e verbas extras. "Puxar de outra atividade" distorce o custo real de cada serviço e cria passivo de ajuste.',
        opts:[{l:'Sem processo formal',s:'Engenheiro ajusta valores entre atividades',score:0},{l:'Aprovação verbal eventual',s:'Ligamos ou mandamos mensagem',score:1},{l:'Solicitação existe, mas posterior à execução',s:'Formalizamos depois que já foi feito',score:2},{l:'Processo formalizado de solicitação, aprovação e registro de motivo da verba, antes da execução',s:'Zero aditivo sem aprovação prévia e motivo documentado — retroalimenta o planejamento futuro',score:3}]
      },
      { code:'MO.4', moType:'propria', text:'O fechamento da folha de produção mensal consome quanto tempo do seu time?', reveals:'Eficiência do processo de fechamento. Cada dia de engenharia nessa rotina tem custo direto — e indica ausência de dados estruturados.',
        opts:[{l:'5 dias ou mais',s:'Uma semana inteira ou mais',score:0},{l:'3–4 dias',s:'Boa parte da semana',score:1},{l:'2 dias',s:'Dois dias de trabalho intenso',score:2},{l:'1 dia ou menos',s:'Processo fluido com dados já estruturados',score:3}]
      },
      { code:'MO.5', moType:'terc', text:'Os empreiteiros têm suas metas de atividades claras e alinhadas ao planejamento da obra — eles sabem o que precisam entregar, em qual prazo e em qual lote?', reveals:'Alinhamento de metas com empreiteiros. Empreiteiro sem meta clara trabalha no ritmo dele — não no ritmo da obra.',
        opts:[{l:'Sem meta formal',s:'Empreiteiro recebe orientação geral',score:0},{l:'Orientação verbal pelo engenheiro',s:'Falamos o que queremos mas não formalizamos',score:1},{l:'Meta definida, sem acompanhamento formal',s:'Definimos mas não acompanhamos sistematicamente',score:2},{l:'Meta alinhada ao planejamento, comunicada e acompanhada formalmente',s:'Contrato de meta integrado ao plano de obra',score:3}]
      },
      { code:'MO.6', moType:'terc', text:'Existe comunicação clara e antecipada informando ao empreiteiro quais atividades têm bloqueio para pagamento — como pendência de qualidade ou FVS não aprovada?', reveals:'Transparência de bloqueios de pagamento. Empreiteiro que descobre no fechamento entra em conflito.',
        opts:[{l:'Empreiteiro descobre no fechamento',s:'Conflito mensal garantido',score:0},{l:'Comunicado verbalmente quando solicitado',s:'Só quando ele pergunta',score:1},{l:'Lista de pendências entregue antes do fechamento',s:'Avisamos alguns dias antes',score:2},{l:'Comunicação automática antecipada vinculada ao sistema de qualidade',s:'Empreiteiro sabe em tempo real',score:3}]
      },
      { code:'MO.7', moType:'terc', text:'O fechamento da medição dos empreiteiros consome quanto tempo do seu time por mês?', reveals:'Eficiência do fechamento de medição. Medição que leva uma semana é feita na base da negociação — não do registro.',
        opts:[{l:'5 dias ou mais',s:'Uma semana inteira ou mais',score:0},{l:'3–4 dias',s:'Boa parte da semana',score:1},{l:'2 dias',s:'Dois dias de trabalho intenso',score:2},{l:'1 dia ou menos',s:'Processo fluido com dados já estruturados',score:3}]
      },
      { code:'MO.ROI1', moType:'propria', type:'numgrid', text:'Para o cálculo financeiro do ROI, informe a folha de mão de obra própria:', reveals:'Alimenta o cálculo de recuperação financeira por retrabalho e pagamentos indevidos.',
        fields:[
          {key:'folha', label:'Folha de mão de obra própria / mês (R$)', type:'currency', placeholder:'Ex: R$ 300.000'}
        ]
      }
    ]
  },
  f4:{
    phase:4, badgeClass:'bf4', color:'#9ca3af', colorHex:'#4a4558',
    label:'Fase 4 · Controle Real e Performance',
    maxScore:12,
    insight: function(p){
      if(p<0.4) return 'As reuniões de resultado são basicamente reuniões de culpa — não de decisão. Sem dados estruturados das fases anteriores, a diretoria toma decisões no feeling.';
      if(p<0.7) return 'Existe análise de resultado, mas sem base de dados completa. PCCQ e improdutividade de MO ainda estão fora do radar da diretoria.';
      return 'Bom ciclo de inteligência. O desafio é refinar a velocidade de resposta — encurtar o tempo entre desvio identificado e decisão tomada.';
    },
    qs:[
      { code:'F4.1', text:'Ao final de cada ciclo de execução, a gerência da obra ou sala técnica reúne com a engenharia para analisar os indicadores do período — prazo, ritmo de produção, restrições abertas, qualidade e custo do projeto — e definir as entradas para a próxima reprogramação? Ou o fechamento é mais informal e não gera decisões estruturadas?', reveals:'Avalia se existe o ciclo técnico de análise que alimenta a Fase 2 — o coração do método SIIGA. Sem esse fechamento, os dados gerados nos Pilares 1, 2 e 3 morrem na semana.',
        opts:[{l:'Sem reunião de fechamento',s:'Cada obra segue sem análise formal do período',score:0},{l:'Reunião existe mas informal',s:'Sem pauta definida, sem saídas estruturadas — depende de quem está presente',score:1},{l:'Reunião periódica com análise parcial dos indicadores',s:'Alguns dados analisados mas sem visão completa e sem registro das decisões',score:2},{l:'Fechamento de período estruturado com análise de prazo, ritmo, restrições, qualidade e custo',s:'Saídas documentadas que alimentam diretamente a próxima Fase 2',score:3}]
      },
      { code:'F4.2', text:'A diretoria recebe mensalmente um relatório consolidado da obra — com status, avanço físico, qualidade e custo do projeto — e valida o plano reprogramado? Ou a visão executiva é baseada em relatos do engenheiro sem dados estruturados?', reveals:'Avalia se o ciclo executivo existe e se a diretoria toma decisão com dado — não com narrativa. A distinção crítica: reunião com dados vs. reunião com relato.',
        opts:[{l:'Sem reunião executiva estruturada',s:'Diretoria só sabe quando o problema já é grave',score:0},{l:'Reunião existe mas baseada em relatos',s:'Cada um chega com um número diferente — sem dado unificado',score:1},{l:'Reunião periódica com alguns indicadores de prazo e custo',s:'Sem visão consolidada de qualidade e análise de tendência',score:2},{l:'Reunião mensal garantida com relatório executivo: semáforo, avanço, qualidade, custo e plano de ação já validado',s:'Diretoria valida o plano reprogramado — não apenas recebe resultado',score:3}]
      },
      { code:'F4.3', text:'Quando analisam o período, vocês conseguem ter simultaneamente a visão de prazo, ritmo de produção, restrições abertas, qualidade e custo do projeto em um único painel — ou cada informação está em uma fonte diferente e alguém precisa compilar manualmente?', reveals:'Integração dos dados e maturidade analítica. O que separa análise real de análise parcial é ter os cinco blocos disponíveis ao mesmo tempo para tomada de decisão.',
        opts:[{l:'Cada informação em um lugar diferente',s:'Ninguém tem a visão completa simultaneamente',score:0},{l:'Alguns indicadores compilados manualmente em planilha antes de cada reunião',s:'Processo manual e demorado, sujeito a erro',score:1},{l:'Painel parcial com prazo e custo, mas qualidade e ritmo de produção ainda fora',s:'Visão incompleta — decisões sem base total',score:2},{l:'Painel integrado com prazo, ritmo, restrições, qualidade e custo atualizado automaticamente',s:'Gerência chega à reunião com diagnóstico pronto — tempo dedicado à decisão, não à montagem do dado',score:3}]
      },
      { code:'F4.4', text:'O fechamento mensal de folha e medição de empreiteiros é baseado nas evidências de produção geradas ao longo do mês — com aprovação hierárquica e registro de exceções — ou é mais um fechamento sem base objetiva de produção?', reveals:'Maturidade do ciclo financeiro mensal. Aplica-se a MO própria (folha) e terceirizada (medição). O que diferencia não é o tipo de MO — é o nível de rastreabilidade e evidência por trás do pagamento.',
        opts:[{l:'Fechamento sem base objetiva',s:'Por estimativa ou negociação — sem dado de produção como referência',score:0},{l:'Critério informal baseado em observação',s:'Engenheiro ou gestor decide pelo que viu — sem registro auditável',score:1},{l:'Critério definido, sem rastreabilidade digital e sem fluxo hierárquico',s:'Temos regra, mas sem aprovação formal e sem registro de exceções',score:2},{l:'Sugestão automática baseada em produção real + FVS aprovada, com aprovação por instâncias e exceções registradas com justificativa',s:'Ciclo financeiro rastreável e auditável — paga pelo que foi produzido com qualidade comprovada',score:3}]
      },
      { code:'F4.ROI', type:'numgrid', text:'Quanto tempo sua equipe gasta hoje cruzando dados de diferentes fontes para montar a visão executiva?', reveals:'Tempo gasto compilando planilhas manualmente antes das reuniões de resultado.',
        fields:[
          {key:'fluxoCruzar', label:'Horas/mês cruzando dados de diferentes fontes', type:'number', placeholder:'Ex: 18'}
        ]
      }
    ]
  }
};

// ═══════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════
function showScreen(id) {
  var screens = document.querySelectorAll('.screen');
  for(var i=0;i<screens.length;i++) screens[i].classList.remove('active');
  document.getElementById(id).classList.add('active');
  window.scrollTo(0,0);
}

function updateProgress() {
  var totalQ = B0Q.length + 7 + 4 + 5 + 7 + 3 + 6; // +6 = novas perguntas numgrid de ROI (F1,F2,F3,F4,MO×2)
  var done = (currentBlock!=='b0') ? B0Q.length : currentQIdx;
  if(currentBlock==='phase') {
    done += B0Q.length;
    for(var i=0;i<currentPhaseIdx;i++) done += PQ[phaseOrder[i]].qs.length;
    done += currentQIdx;
  }
  var pct = Math.min((done/totalQ)*100, 100);
  document.getElementById('progress-fill').style.width = pct+'%';
}

function getScore(key) {
  var arr = S.scores[key];
  if(!Array.isArray(arr)) return 0;
  return arr.reduce(function(a,b){return a+b;}, 0);
}

function getAvgPct(key) {
  var maxes = {f1:21,f2:12,f3:18,f4:12};
  var sum = getScore(key);
  return sum / (maxes[key]||1);
}

function levelFromPct(p) {
  if(p<0.35) return 'Reativo';
  if(p<0.6) return 'Em Construção';
  if(p<0.85) return 'Estruturado';
  return 'Referência SIIGA';
}

function colorFromPct(p) {
  if(p<0.35) return '#f87171';
  if(p<0.6) return '#fb923c';
  if(p<0.85) return '#60a5fa';
  return '#34d399';
}

function fmtNum(n) {
  if(!n || isNaN(n)) return '—';
  if(n>=1000000) return 'R$ '+(n/1000000).toFixed(1).replace('.',',')+'M';
  if(n>=1000) return 'R$ '+Math.round(n/1000)+'K';
  return 'R$ '+Math.round(n);
}
function fmtNumBare(n) {
  // Like fmtNum but without the R$ prefix (used where caller already has R$)
  if(!n || isNaN(n)) return '—';
  if(n>=1000000) return (n/1000000).toFixed(1).replace('.',',')+'M';
  if(n>=1000) return Math.round(n/1000)+'K';
  return Math.round(n)+'';
}

function maskPhone(input) {
  var digits = input.value.replace(/\D/g, '');
  if (digits.length > 11) digits = digits.substring(0, 11);
  var result = '';
  if (digits.length === 0) {
    result = '';
  } else if (digits.length <= 2) {
    result = '(' + digits;
  } else if (digits.length <= 7) {
    result = '(' + digits.substring(0, 2) + ') ' + digits.substring(2);
  } else if (digits.length <= 10) {
    result = '(' + digits.substring(0, 2) + ') ' + digits.substring(2, 6) + '-' + digits.substring(6);
  } else {
    result = '(' + digits.substring(0, 2) + ') ' + digits.substring(2, 7) + '-' + digits.substring(7);
  }
  input.value = result;
}

function maskCapitalize(input) {
  let words = input.value.split(' ');
  for (let i = 0; i < words.length; i++) {
    if (words[i].length > 0) {
      words[i] = words[i].charAt(0).toUpperCase() + words[i].slice(1).toLowerCase();
    }
  }
  input.value = words.join(' ');
}

function maskDate(input) {
  let v = input.value.replace(/\D/g, '');
  if (v.length > 8) v = v.slice(0, 8);
  if (v.length > 2) v = v.substring(0,2) + '/' + v.substring(2);
  if (v.length > 5) v = v.substring(0,5) + '/' + v.substring(5);
  input.value = v;
}

// ═══════════════════════════════════════════
//  COVER
// ═══════════════════════════════════════════
function startAssessment() {
  const empresaInput = document.getElementById('c-empresa');
  const contatoInput = document.getElementById('c-contato');
  const cargoInput = document.getElementById('c-cargo');
  const emailInput = document.getElementById('c-email');
  const telefoneInput = document.getElementById('c-telefone');
  const consultorInput = document.getElementById('c-consultor');

  if (!empresaInput.value.trim()) {
    alert("Por favor, informe a Empresa.");
    empresaInput.focus();
    return;
  }
  if (!contatoInput.value.trim()) {
    alert("Por favor, informe o Contato / Prospect.");
    contatoInput.focus();
    return;
  }
  if (!cargoInput.value.trim()) {
    alert("Por favor, informe o Cargo.");
    cargoInput.focus();
    return;
  }
  if (!emailInput.value.trim()) {
    alert("Por favor, informe o E-mail.");
    emailInput.focus();
    return;
  }
  if (emailInput.value && !emailInput.checkValidity()) {
    alert("Por favor, insira um e-mail válido.");
    emailInput.focus();
    return;
  }
  if (!telefoneInput.value.trim()) {
    alert("Por favor, informe o Telefone.");
    telefoneInput.focus();
    return;
  }
  if (telefoneInput.value && telefoneInput.value.length < 14) {
    alert("Por favor, insira um telefone válido com DDD (mínimo 10 dígitos).");
    telefoneInput.focus();
    return;
  }
  if (!consultorInput.value.trim()) {
    alert("Por favor, informe o nome do Consultor Agilean.");
    consultorInput.focus();
    return;
  }

  S.empresa = empresaInput.value.trim();
  S.consultor = consultorInput.value.trim();
  S.contato = contatoInput.value.trim();
  
  S.data = new Date().toISOString().split('T')[0];
  
  S.cargo = cargoInput.value.trim();
  S.email = emailInput.value.trim();
  S.telefone = telefoneInput.value.trim();
  currentBlock = 'b0';
  currentQIdx = 0;
  renderB0();
  showScreen('screen-b0');
}

// ═══════════════════════════════════════════
//  BLOCO 0
// ═══════════════════════════════════════════
function renderB0() {
  var q = B0Q[currentQIdx];
  var card = document.getElementById('b0-card');
  document.getElementById('nav-step').textContent = 'B0 ' + (currentQIdx+1) + ' / ' + B0Q.length;
  updateProgress();

  if(q.type === 'roi') {
    card.innerHTML = '<div class="phase-badge '+q.badge+'">'+q.blabel+'</div>' +
      '<div class="q-code">'+q.code+'</div>' +
      '<div class="q-text">'+q.text+'</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:8px">' +
        '<div class="input-group"><label>Número de obras em andamento</label>' +
          '<input class="text-input" id="roi-obras" type="number" min="1" placeholder="Ex: 8" value="'+(S.numObras||'')+'"></div>' +
        '<div class="input-group"><label>Orçamento médio por obra (R$)</label>' +
          '<input class="text-input" id="roi-orcamento" type="text" inputmode="numeric" placeholder="Ex: R$ 8.000.000" oninput="fmtOrcamento(this)" value="'+(S.orcamentoMedio ? fmtBRL(S.orcamentoMedio) : '')+'"></div>' +
        '<div class="input-group"><label>Prazo médio das obras (meses)</label>' +
          '<input class="text-input" id="roi-prazo" type="number" min="1" max="120" placeholder="Ex: 18" value="'+(S.prazoMedio||'')+'"></div>' +
        '<div class="input-group" style="display:flex;align-items:flex-end">' +
          '<div style="padding:10px 14px;background:rgba(255,95,31,0.08);border-radius:var(--r3);border:1px solid rgba(255,95,31,0.2);font-size:12px;color:var(--gray2);line-height:1.5;width:100%">' +
            '💡 Esses dados alimentam o cálculo do potencial de ganho da operação.' +
          '</div></div>' +
      '</div>';
    return;
  }

  var revealsHtml = q.reveals ? '<div class="q-reveals">'+q.reveals+'</div>' : '';
  var html = '<div class="phase-badge '+q.badge+'">'+q.blabel+'</div>' +
    '<div class="q-code">'+q.code+'</div>' +
    '<div class="q-text">'+q.text+'</div>' +
    revealsHtml +
    '<div class="options">';

  for(var i=0;i<q.opts.length;i++) {
    var opt = q.opts[i];
    var saved = S[q.key];
    var isSel = (saved !== undefined && saved !== '' && saved == opt.v) ? ' sel' : '';
    var scoreLabel = q.scored ? '<div class="opt-score">Score '+opt.score+'</div>' : '';
    var sub = opt.s ? '<div class="opt-sub">'+opt.s+'</div>' : '';
    html += '<div class="opt'+isSel+'" onclick="selectB0('+i+')">' +
      '<div class="opt-dot">'+(q.scored ? opt.score : (i+1))+'</div>' +
      '<div class="opt-body">'+scoreLabel+'<div class="opt-label">'+opt.l+'</div>'+sub+'</div>' +
      '</div>';
  }

  html += '</div>';
  if(q.anchor) html += '<div class="anchor"><strong>Ancoragem:</strong> "'+q.anchor+'"</div>';
  card.innerHTML = html;
}

function selectB0(idx) {
  var q = B0Q[currentQIdx];
  var opt = q.opts[idx];
  S[q.key] = opt.v;
  if(q.scored) S.scores[q.key] = opt.score;
  if(q.key === 'modeloMO') S.showMO = true;
  renderB0();
}

// ═══════════════════════════════════════════
//  PHASE QUESTIONS
// ═══════════════════════════════════════════
function beginPhases() {
  if(S.showMO && phaseOrder.indexOf('mo') < 0) {
    phaseOrder = ['f1','f2','f3','mo','f4'];
  }
  currentPhaseIdx = 0;
  currentQIdx = 0;
  currentBlock = 'phase';
  renderPhaseQ();
  showScreen('screen-phase');
}

function getFilteredQs(bd) {
  if(bd.phase !== 'MO') return bd.qs;
  var mo = S.modeloMO;
  return bd.qs.filter(function(q) {
    if(!q.moType) return true;          // no filter tag — always show
    if(q.moType === 'propria') return (mo === 'propria' || mo === 'mista');
    if(q.moType === 'terc')    return (mo === 'terceirizada' || mo === 'mista');
    return true;
  });
}

function renderPhaseQ() {
  var bk = phaseOrder[currentPhaseIdx];
  var bd = PQ[bk];
  var filteredQs = getFilteredQs(bd);
  var q = filteredQs[currentQIdx];
  var card = document.getElementById('phase-card');
  var total = filteredQs.length;
  document.getElementById('nav-step').textContent = 'Fase '+bd.phase+' · '+(currentQIdx+1)+'/'+total;
  updateProgress();

  var moNotice = '';
  if(bk === 'mo') {
    var moLabel = S.modeloMO === 'propria' ? 'MO Própria — perguntas sobre equipe própria' :
                  S.modeloMO === 'terceirizada' ? 'MO Terceirizada — perguntas sobre empreiteiros' :
                  'MO Mista — perguntas sobre equipe própria e empreiteiros';
    moNotice = '<div class="cond-notice">🎯 ' + moLabel + '</div>';
  }

  if(q.type === 'numgrid') {
    var fieldsHtml = q.fields.map(function(f) {
      var savedVal = S.roi2[f.key];
      if(f.type === 'currency') {
        return '<div class="input-group"><label>'+f.label+'</label>' +
          '<input class="text-input" id="rg-'+f.key+'" type="text" inputmode="numeric" placeholder="'+f.placeholder+'" oninput="fmtOrcamento(this)" value="'+(savedVal ? fmtBRL(savedVal) : '')+'"></div>';
      }
      return '<div class="input-group"><label>'+f.label+'</label>' +
        '<input class="text-input" id="rg-'+f.key+'" type="number" min="0" placeholder="'+f.placeholder+'" value="'+(savedVal || '')+'"></div>';
    }).join('');
    card.innerHTML = moNotice +
      '<div class="phase-badge '+bd.badgeClass+'">'+bd.label+'</div>' +
      '<div class="q-code">'+q.code+' · Pergunta '+(currentQIdx+1)+' de '+total+'</div>' +
      '<div class="q-text">'+q.text+'</div>' +
      '<div class="q-reveals">'+q.reveals+'</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-top:8px">' + fieldsHtml + '</div>';
    return;
  }

  var arrKey = (bk==='mo') ? 'mo' : bk;
  if(bk === 'mo') {
    if(!S.scores.mo || typeof S.scores.mo !== 'object' || Array.isArray(S.scores.mo)) S.scores.mo = {};
  } else {
    if(!Array.isArray(S.scores[arrKey])) S.scores[arrKey] = [];
  }
  var savedScore = (bk === 'mo') ? S.scores.mo[q.code] : S.scores[arrKey][currentQIdx];

  var html = moNotice +
    '<div class="phase-badge '+bd.badgeClass+'">'+bd.label+'</div>' +
    '<div class="q-code">'+q.code+' · Pergunta '+(currentQIdx+1)+' de '+total+'</div>' +
    '<div class="q-text">'+q.text+'</div>' +
    '<div class="q-reveals">'+q.reveals+'</div>' +
    '<div class="options">';

  for(var i=0;i<q.opts.length;i++) {
    var opt = q.opts[i];
    var isSel = (savedScore !== undefined && savedScore === opt.score) ? ' sel' : '';
    var sub = opt.s ? '<div class="opt-sub">'+opt.s+'</div>' : '';
    html += '<div class="opt'+isSel+'" onclick="selectPhaseOpt('+i+','+opt.score+')">' +
      '<div class="opt-dot">'+opt.score+'</div>' +
      '<div class="opt-body"><div class="opt-score">Score '+opt.score+'</div><div class="opt-label">'+opt.l+'</div>'+sub+'</div>' +
      '</div>';
  }

  html += '</div>';
  if(q.anchor) html += '<div class="anchor"><strong>Ancoragem:</strong> "'+q.anchor+'"</div>';
  card.innerHTML = html;
}

function selectPhaseOpt(optIdx, score) {
  var bk = phaseOrder[currentPhaseIdx];
  var bd = PQ[bk];
  var filteredQs = getFilteredQs(bd);
  var q = filteredQs[currentQIdx];
  if(bk === 'mo') {
    if(!S.scores.mo || typeof S.scores.mo !== 'object' || Array.isArray(S.scores.mo)) S.scores.mo = {};
    S.scores.mo[q.code] = score;
  } else {
    var arrKey = bk;
    if(!Array.isArray(S.scores[arrKey])) S.scores[arrKey] = [];
    S.scores[arrKey][currentQIdx] = score;
  }
  renderPhaseQ();
}

// ═══════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════
function nextQ() {
  if(currentBlock === 'b0') {
    // Save ROI inputs if on that screen
    var q = B0Q[currentQIdx];
    if(q.type === 'roi') {
      var obras = document.getElementById('roi-obras');
      var orc = document.getElementById('roi-orcamento');
      if(obras && obras.value) S.numObras = parseFloat(obras.value);
      if(orc && orc.value) S.orcamentoMedio = orc.dataset.raw ? parseInt(orc.dataset.raw) : parseBRL(orc.value);
      var prazo = document.getElementById('roi-prazo');
      if(prazo && prazo.value) S.prazoMedio = parseFloat(prazo.value);
    }
    if(currentQIdx < B0Q.length - 1) {
      currentQIdx++;
      renderB0();
    } else {
      showScreen('screen-transition');
    }
  } else if(currentBlock === 'phase') {
    var bk = phaseOrder[currentPhaseIdx];
    var bd = PQ[bk];
    var filteredQs = getFilteredQs(bd);
    var curQ = filteredQs[currentQIdx];
    if(curQ.type === 'numgrid') {
      curQ.fields.forEach(function(f) {
        var el = document.getElementById('rg-'+f.key);
        if(!el) return;
        if(f.type === 'currency') {
          S.roi2[f.key] = el.dataset.raw ? parseInt(el.dataset.raw) : parseBRL(el.value);
        } else if(el.value !== '') {
          S.roi2[f.key] = parseFloat(el.value) || 0;
        }
      });
    }
    if(currentQIdx < filteredQs.length - 1) {
      currentQIdx++;
      renderPhaseQ();
      saveDraft();
    } else {
      showPhaseResult(bk);
      saveDraft();
    }
  }
}

function prevQ() {
  if(currentBlock === 'b0') {
    if(currentQIdx > 0) { currentQIdx--; renderB0(); }
  } else if(currentBlock === 'phase') {
    if(currentQIdx > 0) {
      currentQIdx--;
      renderPhaseQ();
    } else if(currentPhaseIdx > 0) {
      currentPhaseIdx--;
      var prevBk = phaseOrder[currentPhaseIdx];
      currentQIdx = getFilteredQs(PQ[prevBk]).length - 1;
      renderPhaseQ();
    } else {
      showScreen('screen-transition');
    }
  }
}

// ═══════════════════════════════════════════
//  PHASE RESULT
// ═══════════════════════════════════════════
function showPhaseResult(bk) {
  var bd = PQ[bk];
  var sum = 0;
  var maxP;
  if(bk === 'mo') {
    var filteredQs = getFilteredQs(bd).filter(function(q){ return q.type !== 'numgrid'; });
    maxP = filteredQs.length * 3;
    var moScores = S.scores.mo || {};
    filteredQs.forEach(function(q){ sum += (moScores[q.code] || 0); });
  } else {
    var arr = Array.isArray(S.scores[bk]) ? S.scores[bk] : [];
    sum = arr.reduce(function(a,b){return a+(b||0);},0);
    maxP = bd.maxScore;
  }
  var pct = sum / maxP;
  var pctPx = Math.round(pct*100);
  var level = levelFromPct(pct);
  var col = colorFromPct(pct);
  var insight = bd.insight(pct);

  var gapItems = '';
  // Short gap titles per question code
  var gapTitles = {
    'F1.1':'Formalidade do planejamento','F1.2':'Técnica de planejamento',
    'F1.3':'Dimensionamento de equipes','F1.4':'Integração orçamento × planejamento',
    'F1.5':'Acompanhamento da Curva S','F1.6':'Cronograma bancário',
    'F1.7':'Integração planejamento × suprimentos',
    'F2.1':'Lookahead / gestão de restrições','F2.2':'Antecipação de riscos de parada',
    'F2.3':'Planejamento de MO no médio prazo','F2.4':'Ciclo de reprogramação',
    'F3.1':'Programação semanal','F3.2':'Check-out e check-in diário',
    'F3.3':'Rastreabilidade de desvios','F3.4':'Frequência de coleta do avanço',
    'F3.5':'Qualidade vinculada ao pagamento','F3.6':'Análise intermediária de MO',
    'F4.1':'Fechamento técnico de período','F4.2':'Reunião executiva com diretoria',
    'F4.3':'Performance HUB — visão integrada','F4.4':'Pagamento por Evidência',
    'MO.1':'Transparência de metas para equipes','MO.2':'Visibilidade de improdutividade',
    'MO.3':'Gestão de aditivos de verba','MO.4':'Eficiência do fechamento de folha',
    'MO.5':'Alinhamento de metas com empreiteiros','MO.6':'Comunicação de bloqueios de pagamento',
    'MO.7':'Eficiência do fechamento de medição'
  };
  var gapQs = (bk === 'mo') ? getFilteredQs(bd) : bd.qs;
  var moScoresForGap = S.scores.mo || {};
  for(var i=0;i<gapQs.length;i++) {
    if(gapQs[i].type === 'numgrid') continue;
    var qScore = (bk === 'mo') ? (moScoresForGap[gapQs[i].code] || 0) : (arr ? (arr[i]||0) : 0);
    if(qScore <= 1) {
      var gtitle = gapTitles[gapQs[i].code] || gapQs[i].code;
      gapItems += '<li style="font-size:12px;color:var(--gray2);margin-bottom:4px;display:flex;gap:8px;align-items:center"><span style="color:var(--orange);font-size:16px;line-height:1;flex-shrink:0">→</span><span><strong style="color:white">'+gapQs[i].code+'</strong> · '+gtitle+'</span></li>';
    }
  }

  var card = document.getElementById('result-card');
  card.innerHTML = '<div class="phase-badge '+bd.badgeClass+'">'+bd.label+'</div>' +
    '<h2 style="font-size:20px;margin-bottom:14px">Resultado desta fase</h2>' +
    '<div class="phase-result-box">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
        '<div style="font-family:Bai Jamjuree;font-size:20px;font-weight:700;color:'+col+'">'+level+'</div>' +
        '<div style="font-family:Bai Jamjuree;font-size:28px;font-weight:700">'+sum+'<span style="font-size:13px;color:var(--gray2)">/'+maxP+'</span></div>' +
      '</div>' +
      '<div class="score-bar"><div class="score-fill" style="width:'+pctPx+'%;background:'+col+'"></div></div>' +
      '<p style="font-size:13px;color:var(--gray2);line-height:1.65;margin-bottom:12px">'+insight+'</p>' +
      (gapItems ? '<div style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:var(--gray2);margin-bottom:7px">Principais gaps identificados</div><ul style="list-style:none">'+gapItems+'</ul>' : '') +
    '</div>';

  // Next button logic
  var btn = document.getElementById('result-next-btn');
  var nextIdx = currentPhaseIdx + 1;
  if(nextIdx < phaseOrder.length) {
    var nextBk = phaseOrder[nextIdx];
    var nextBd = PQ[nextBk];
    btn.textContent = 'Iniciar ' + nextBd.label.split('·')[1].trim() + ' →';
    btn.onclick = function() {
      currentPhaseIdx = nextIdx;
      currentQIdx = 0;
      currentBlock = 'phase';
      renderPhaseQ();
      showScreen('screen-phase');
    };
  } else {
    btn.textContent = 'Ver Radar Completo →';
    btn.onclick = buildAndShowRadar;
  }

  showScreen('screen-phase-result');
}


// ═══════════════════════════════════════════
//  FOCUSED DIAGNOSIS FLOW
// ═══════════════════════════════════════════
var selectedPilars = [];   // ordered list of selected pilars
var focusedQIdx = 0;
var focusedPilarQueue = []; // queue for multi-pilar focused flow
var focusedPilar = null;   // current pilar being answered

var PILAR_LABELS = {f1:'Pilar 1 — Planejamento',f2:'Pilar 2 — Proteção',f3:'Pilar 3 — Produção',f4:'Pilar 4 — Performance'};
var PILAR_QTY = {f1:7, f2:4, f3:6, f4:4};  // approximate question counts

function toggleAccordion(pilar) {
  var body = document.getElementById('acc-' + pilar);
  var icon = document.getElementById('icon-' + pilar);
  if(!body) return;
  var isOpen = body.classList.contains('open');
  // Close all others
  ['f1','f2','f3','f4'].forEach(function(p) {
    var b = document.getElementById('acc-' + p);
    var ic = document.getElementById('icon-' + p);
    if(b) b.classList.remove('open');
    if(ic) ic.classList.remove('open');
  });
  if(!isOpen) {
    body.classList.add('open');
    icon.classList.add('open');
  }
}

function toggleFocused(pilar, evt) {
  if(evt) evt.stopPropagation();
  var idx = selectedPilars.indexOf(pilar);
  if(idx >= 0) {
    selectedPilars.splice(idx, 1);
  } else {
    // If 'all' was selected, clear it
    var allIdx = selectedPilars.indexOf('all');
    if(allIdx >= 0) selectedPilars.splice(allIdx, 1);
    selectedPilars.push(pilar);
  }
  updateFocusUI();
}

function chooseFocusedAll() {
  selectedPilars = ['all'];
  updateFocusUI();
}

function updateFocusUI() {
  var pilars = ['f1','f2','f3','f4'];
  var isAll = selectedPilars.indexOf('all') >= 0;

  // Update dot and card states
  pilars.forEach(function(p) {
    var card = document.getElementById('focus-' + p);
    var dot = document.getElementById('dot-' + p);
    var btn = card ? card.querySelector('.accord-select-btn') : null;
    var selected = selectedPilars.indexOf(p) >= 0;
    if(card) card.classList.toggle('selected', selected);
    if(dot) dot.classList.toggle('active', selected);
    if(btn) {
      btn.textContent = selected ? '✓ Selecionado' : '+ Selecionar este pilar';
      btn.classList.toggle('selected-btn', selected);
    }
  });

  // All card
  var allCard = document.getElementById('focus-all');
  var allDot  = document.getElementById('dot-all');
  if(allCard) allCard.classList.toggle('selected', isAll);
  if(allDot) allDot.classList.toggle('active', isAll);

  // P4 warning
  var hasF4 = selectedPilars.indexOf('f4') >= 0;
  var hasF1F2 = selectedPilars.indexOf('f1') >= 0 || selectedPilars.indexOf('f2') >= 0;
  document.getElementById('p4-warning').style.display = (hasF4 && !hasF1F2) ? 'block' : 'none';

  // Summary + timer
  var summary = document.getElementById('focus-summary');
  var timeLabel = document.getElementById('focus-time-label');
  var priorityHint = document.getElementById('focus-priority-hint');
  var priorityOrder = document.getElementById('focus-priority-order');
  var btn = document.getElementById('btn-start-diagnosis');

  if(selectedPilars.length === 0) {
    if(summary) summary.style.display = 'none';
    if(btn) btn.style.display = 'none';
    return;
  }

  if(summary) summary.style.display = 'block';
  if(btn) btn.style.display = 'inline-flex';

  if(isAll) {
    if(timeLabel) timeLabel.textContent = '~40 min · Diagnóstico completo — todos os pilares';
    if(priorityHint) priorityHint.textContent = 'Você vai receber o Radar SIIGA completo com potencial de ganho total.';
    if(priorityOrder) priorityOrder.style.display = 'none';
    if(btn) btn.textContent = 'Iniciar Diagnóstico Completo →';
    return;
  }

  var count = selectedPilars.length;
  var totalQty = selectedPilars.reduce(function(acc, p) { return acc + (PILAR_QTY[p]||0); }, 0);
  var timeMap = {1:'~10 min', 2:'~18 min', 3:'~26 min', 4:'~40 min'};
  var time = timeMap[count] || '~40 min';
  if(timeLabel) timeLabel.textContent = time + ' · ' + totalQty + ' perguntas · ' + count + ' pilar' + (count > 1 ? 'es' : '');

  if(count > 1) {
    if(priorityHint) priorityHint.textContent = 'Clique nos números para definir a prioridade — o mais urgente primeiro.';
    if(priorityOrder) {
      priorityOrder.style.display = 'block';
      renderPriorityList();
    }
    if(btn) btn.textContent = 'Iniciar diagnóstico focado (' + count + ' pilares) →';
  } else {
    if(priorityHint) priorityHint.textContent = 'O plano de ação vai priorizar os gaps encontrados neste pilar.';
    if(priorityOrder) priorityOrder.style.display = 'none';
    if(btn) btn.textContent = 'Iniciar diagnóstico — ' + PILAR_LABELS[selectedPilars[0]] + ' →';
  }
}

function renderPriorityList() {
  var list = document.getElementById('priority-list');
  if(!list) return;
  list.innerHTML = '';
  selectedPilars.forEach(function(p, i) {
    var div = document.createElement('div');
    div.className = 'priority-item';
    var html = '<div class="pnum">' + (i+1) + '</div>' +
      '<div style="flex:1;font-size:12px;color:rgba(255,255,255,0.85)">' + PILAR_LABELS[p] + '</div>';
    if(i > 0) html += '<button class="mv-btn" data-dir="up" data-p="' + p + '" style="background:none;border:none;color:var(--gray2);cursor:pointer;font-size:14px;padding:2px 6px">↑</button>';
    if(i < selectedPilars.length-1) html += '<button class="mv-btn" data-dir="down" data-p="' + p + '" style="background:none;border:none;color:var(--gray2);cursor:pointer;font-size:14px;padding:2px 6px">↓</button>';
    div.innerHTML = html;
    list.appendChild(div);
  });
  list.querySelectorAll('.mv-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var dir = btn.getAttribute('data-dir');
      var pp  = btn.getAttribute('data-p');
      if(dir === 'up') movePilarUp(pp); else movePilarDown(pp);
    });
  });
}

function movePilarUp(pilar) {
  var idx = selectedPilars.indexOf(pilar);
  if(idx > 0) {
    var tmp = selectedPilars[idx-1];
    selectedPilars[idx-1] = selectedPilars[idx];
    selectedPilars[idx] = tmp;
    renderPriorityList();
    updateFocusUI();
  }
}

function movePilarDown(pilar) {
  var idx = selectedPilars.indexOf(pilar);
  if(idx < selectedPilars.length-1) {
    var tmp = selectedPilars[idx+1];
    selectedPilars[idx+1] = selectedPilars[idx];
    selectedPilars[idx] = tmp;
    renderPriorityList();
    updateFocusUI();
  }
}

function startChosenDiagnosis() {
  if(selectedPilars.length === 0) return;
  if(selectedPilars.indexOf('all') >= 0) {
    beginPhases();
    return;
  }
  // Store priority order in S
  S.pilarPriority = selectedPilars.slice();
  S.focusedPilar = selectedPilars[0];
  focusedPilarQueue = selectedPilars.slice();
  focusedPilar = focusedPilarQueue.shift();
  focusedQIdx = 0;
  renderFocusedQ();
  showScreen('screen-focused');
}

function renderFocusedQ() {
  var bd = PQ[focusedPilar];
  var filteredQs = getFilteredQs(bd);
  var q = filteredQs[focusedQIdx];
  var total = filteredQs.length;
  document.getElementById('nav-step').textContent = bd.label.split('·')[0].trim() + ' · ' + (focusedQIdx+1) + '/' + total;

  if(q.type === 'numgrid') {
    var fieldsHtml = q.fields.map(function(f) {
      var savedVal = S.roi2[f.key];
      if(f.type === 'currency') {
        return '<div class="input-group"><label>'+f.label+'</label>' +
          '<input class="text-input" id="rg-'+f.key+'" type="text" inputmode="numeric" placeholder="'+f.placeholder+'" oninput="fmtOrcamento(this)" value="'+(savedVal ? fmtBRL(savedVal) : '')+'"></div>';
      }
      return '<div class="input-group"><label>'+f.label+'</label>' +
        '<input class="text-input" id="rg-'+f.key+'" type="number" min="0" placeholder="'+f.placeholder+'" value="'+(savedVal || '')+'"></div>';
    }).join('');
    document.getElementById('focused-card').innerHTML =
      '<div class="phase-badge ' + bd.badgeClass + '">' + bd.label + '</div>' +
      '<div style="font-size:10px;color:var(--orange);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:12px;font-weight:600">Diagnóstico Focado · Pergunta ' + (focusedQIdx+1) + ' de ' + total + '</div>' +
      '<div class="q-code">' + q.code + '</div>' +
      '<div class="q-text">' + q.text + '</div>' +
      '<div class="q-reveals">' + q.reveals + '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-top:8px">' + fieldsHtml + '</div>';
    return;
  }

  var arrKey = focusedPilar === 'mo' ? 'mo' : focusedPilar;
  if(!Array.isArray(S.scores[arrKey])) S.scores[arrKey] = [];
  var savedScore = S.scores[arrKey][focusedQIdx];

  var html = '<div class="phase-badge ' + bd.badgeClass + '">' + bd.label + '</div>' +
    '<div style="font-size:10px;color:var(--orange);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:12px;font-weight:600">Diagnóstico Focado · Pergunta ' + (focusedQIdx+1) + ' de ' + total + '</div>' +
    '<div class="q-code">' + q.code + '</div>' +
    '<div class="q-text">' + q.text + '</div>' +
    '<div class="q-reveals">' + q.reveals + '</div>' +
    '<div class="options">';

  for(var i = 0; i < q.opts.length; i++) {
    var opt = q.opts[i];
    var isSel = (savedScore !== undefined && savedScore === opt.score) ? ' sel' : '';
    var sub = opt.s ? '<div class="opt-sub">' + opt.s + '</div>' : '';
    html += '<div class="opt' + isSel + '" onclick="selectFocusedOpt(' + i + ',' + opt.score + ')">' +
      '<div class="opt-dot">' + opt.score + '</div>' +
      '<div class="opt-body"><div class="opt-score">Score ' + opt.score + '</div><div class="opt-label">' + opt.l + '</div>' + sub + '</div>' +
      '</div>';
  }
  html += '</div>';
  if(q.anchor) html += '<div class="anchor"><strong>Ancoragem:</strong> "' + q.anchor + '"</div>';
  document.getElementById('focused-card').innerHTML = html;
}

function selectFocusedOpt(optIdx, score) {
  var bd = PQ[focusedPilar];
  var filteredQs = getFilteredQs(bd);
  var arrKey = focusedPilar === 'mo' ? 'mo' : focusedPilar;
  if(!Array.isArray(S.scores[arrKey])) S.scores[arrKey] = [];
  S.scores[arrKey][focusedQIdx] = score;
  renderFocusedQ();
}

function nextFocusedQ() {
  var bd = PQ[focusedPilar];
  var filteredQs = getFilteredQs(bd);
  var curQ = filteredQs[focusedQIdx];
  if(curQ.type === 'numgrid') {
    curQ.fields.forEach(function(f) {
      var el = document.getElementById('rg-'+f.key);
      if(!el) return;
      if(f.type === 'currency') {
        S.roi2[f.key] = el.dataset.raw ? parseInt(el.dataset.raw) : parseBRL(el.value);
      } else if(el.value !== '') {
        S.roi2[f.key] = parseFloat(el.value) || 0;
      }
    });
  }
  if(focusedQIdx < filteredQs.length - 1) {
    focusedQIdx++;
    renderFocusedQ();
  } else if(focusedPilarQueue.length > 0) {
    // Move to next pilar in queue
    focusedPilar = focusedPilarQueue.shift();
    focusedQIdx = 0;
    renderFocusedQ();
  } else {
    showFocusedResult();
  }
}

function prevFocusedQ() {
  if(focusedQIdx > 0) {
    focusedQIdx--;
    renderFocusedQ();
  } else {
    showScreen('screen-transition');
  }
}

function showFocusedResult() {
  var bd = PQ[focusedPilar];
  var arrKey = focusedPilar === 'mo' ? 'mo' : focusedPilar;
  var arr = Array.isArray(S.scores[arrKey]) ? S.scores[arrKey] : [];
  var filteredQs = getFilteredQs(bd);
  var sum = arr.reduce(function(a,b){return a+(b||0);},0);
  var maxP = filteredQs.filter(function(q){ return q.type !== 'numgrid'; }).length * 3;
  var pct = sum / maxP;
  var level = levelFromPct(pct);
  var col = colorFromPct(pct);
  var insight = bd.insight(pct);

  // Gap items
  var gapHtml = '';
  var gapTitlesLocal = {
    'F1.1':'Formalidade do planejamento','F1.2':'Técnica de planejamento',
    'F1.3':'Dimensionamento de equipes','F1.4':'Integração orçamento × planejamento',
    'F1.5':'Acompanhamento da Curva S','F1.6':'Cronograma bancário',
    'F1.7':'Integração planejamento × suprimentos',
    'F2.1':'Lookahead / gestão de restrições','F2.2':'Antecipação de riscos',
    'F2.3':'Planejamento de MO no médio prazo','F2.4':'Ciclo de reprogramação',
    'F3.1':'Programação semanal','F3.2':'Check-out e check-in',
    'F3.3':'Rastreabilidade de desvios','F3.4':'Frequência de coleta do avanço',
    'F3.5':'Qualidade vinculada ao pagamento','F3.6':'Análise intermediária de MO',
    'F4.1':'Fechamento técnico de período','F4.2':'Reunião executiva',
    'F4.3':'Performance HUB','F4.4':'Pagamento por Evidência'
  };

  filteredQs.forEach(function(q, i) {
    if(q.type === 'numgrid') return;
    if((arr[i]||0) <= 1) {
      gapHtml += '<div style="display:flex;gap:10px;align-items:flex-start;padding:10px 12px;background:rgba(255,255,255,0.03);border-radius:6px;margin-bottom:6px">' +
        '<span style="color:var(--orange);font-size:16px;flex-shrink:0">→</span>' +
        '<div><div style="font-size:12px;font-weight:700;color:white">' + q.code + ' · ' + (gapTitlesLocal[q.code]||q.code) + '</div>' +
        '<div style="font-size:11px;color:var(--gray2);margin-top:2px">' + q.text.substring(0,100) + '...</div></div>' +
        '</div>';
    }
  });

  // Score bar
  var pctPx = Math.round(pct * 100);

  var card = document.getElementById('focused-result-card');
  card.innerHTML =
    '<div class="phase-badge ' + bd.badgeClass + '" style="margin-bottom:16px">' + bd.label + '</div>' +

    // Score summary
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">' +
      '<div style="padding:20px;background:rgba(255,255,255,0.03);border-radius:8px;border:1px solid rgba(255,255,255,0.07)">' +
        '<div style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:var(--gray2);margin-bottom:8px">Maturidade do Pilar</div>' +
        '<div style="font-family:Bai Jamjuree;font-size:36px;font-weight:700;color:' + col + '">' + pctPx + '%</div>' +
        '<div style="font-family:Bai Jamjuree;font-size:14px;color:' + col + '">' + level + '</div>' +
        '<div class="score-bar" style="margin-top:10px"><div class="score-fill" style="width:' + pctPx + '%;background:' + col + '"></div></div>' +
      '</div>' +
      '<div style="padding:20px;background:rgba(255,255,255,0.03);border-radius:8px;border:1px solid rgba(255,255,255,0.07)">' +
        '<div style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:var(--gray2);margin-bottom:8px">Leitura consultiva</div>' +
        '<div style="font-size:13px;color:rgba(255,255,255,0.85);line-height:1.65">' + insight + '</div>' +
      '</div>' +
    '</div>' +

    // Gaps
    (gapHtml ? '<div style="margin-bottom:20px"><div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:var(--gray2);margin-bottom:10px;font-weight:700">Gaps identificados neste pilar</div>' + gapHtml + '</div>' : '') +

    // Next step teaser
    '<div style="padding:20px;background:var(--orange-dim);border-radius:8px;border:1px solid var(--orange-mid)">' +
      '<div style="font-family:Bai Jamjuree;font-size:14px;font-weight:700;margin-bottom:8px">Próximo passo</div>' +
      '<p style="font-size:13px;color:rgba(255,255,255,0.85);line-height:1.65;margin-bottom:12px">' +
        'O diagnóstico focado revelou os principais gaps do <strong>' + bd.label.split('·')[0].trim() + '</strong>. ' +
        'Para ter a visão completa da operação — com potencial de ganho total e road map executivo de 90 dias — ' +
        'recomendamos o Diagnóstico Completo na próxima reunião.' +
      '</p>' +
      '<div style="font-size:12px;color:var(--gray2)">' +
        '💡 Ou continue agora: clique em <strong style="color:white">Diagnóstico Completo</strong> para responder os demais pilares e gerar o relatório completo.' +
      '</div>' +
    '</div>';

  showScreen('screen-focused-result');
}

function showFocusedReport() {
  // Build partial report with what we have
  buildReport();
  showScreen('screen-report');
}

function startFullFromFocused() {
  // Keep scores already answered, go to full flow starting from next pilar after focused
  if(S.showMO && phaseOrder.indexOf('mo') < 0) {
    phaseOrder = ['f1','f2','f3','mo','f4'];
  }
  // Find which pilars still need to be done
  var donePilar = S.focusedPilar || (S.pilarPriority && S.pilarPriority[S.pilarPriority.length-1]);
  var allPilars = S.showMO ? ['f1','f2','f3','mo','f4'] : ['f1','f2','f3','f4'];
  var doneIdx = allPilars.indexOf(donePilar);
  // Start from the first undone pilar
  currentPhaseIdx = doneIdx >= 0 ? (doneIdx + 1) % allPilars.length : 0;
  if(currentPhaseIdx >= allPilars.length) currentPhaseIdx = 0;
  phaseOrder = allPilars;
  currentQIdx = 0;
  currentBlock = 'phase';
  renderPhaseQ();
  showScreen('screen-phase');
}

// ═══════════════════════════════════════════
//  RADAR
// ═══════════════════════════════════════════
function buildAndShowRadar() {
  var phases = ['f1','f2','f3','f4'];
  var maxes = {f1:21,f2:12,f3:18,f4:12};
  var benchmark = [0.45,0.38,0.35,0.30];
  var reference = [0.90,0.85,0.88,0.82];
  var labels = ['Fase 1','Fase 2','Fase 3','Fase 4'];

  var clientPct = phases.map(function(k) {
    var arr = S.scores[k];
    if(!Array.isArray(arr)) return 0;
    var sum = arr.reduce(function(a,b){return a+(b||0);},0);
    return sum/(maxes[k]||1);
  });

  var totalMax = 21+12+18+12+3+3;
  var totalScore = ['f1','f2','f3','f4'].reduce(function(acc,k) {
    var arr = S.scores[k];
    if(!Array.isArray(arr)) return acc;
    return acc + arr.reduce(function(a,b){return a+(b||0);},0);
  },0) + (S.scores.b03||0) + (S.scores.b06||0);

  var totalPct = totalScore / totalMax;
  var totalLevel = levelFromPct(totalPct);

  document.getElementById('total-score').textContent = totalScore+'/'+totalMax;
  document.getElementById('total-level').textContent = totalLevel+' · '+Math.round(totalPct*100)+'% de maturidade SIIGA';
  // Show ROI teaser (total only, no breakdown)
  var roiTeaser = calculateROI();
  var teaserEl = document.getElementById('roi-teaser');
  if(teaserEl) teaserEl.textContent = fmtNum(roiTeaser.totalPortfolio || roiTeaser.total);

  // Ponto 3a: eixo com maior gap vs. referência SIIGA — destacado e com rótulo de distância
  var gaps = clientPct.map(function(p,i){ return reference[i]-p; });
  var worstIdx = 0;
  for(var gi=1; gi<gaps.length; gi++) { if(gaps[gi] > gaps[worstIdx]) worstIdx = gi; }
  var worstGapPct = Math.round(gaps[worstIdx]*100);
  var gapLabelEl = document.getElementById('radar-gap-label');
  if(gapLabelEl) {
    gapLabelEl.textContent = '📍 Maior oportunidade: ' + labels[worstIdx] + ' está ' + worstGapPct + ' pontos percentuais abaixo da Referência SIIGA';
  }

  RADAR_STATE = { clientPct: clientPct, benchmark: benchmark, reference: reference, labels: labels, worstIdx: worstIdx };
  if(radarChartInst) radarChartInst.destroy();
  radarChartInst = drawRadarChart(document.getElementById('radarChart'), RADAR_STATE, false);

  // Insights grid
  var colors = {f1:'#60a5fa',f2:'#2dd4bf',f3:'#34d399',f4:'#9ca3af'};
  var lnames = {f1:'Planejamento Estratégico',f2:'Proteção da Execução',f3:'Gestão da Produção',f4:'Controle e Performance'};
  var insHtml = '';
  phases.forEach(function(k) {
    var arr = S.scores[k];
    var sum = Array.isArray(arr) ? arr.reduce(function(a,b){return a+(b||0);},0) : 0;
    var p = sum/(maxes[k]||1);
    var lv = levelFromPct(p);
    var ins = PQ[k].insight(p);
    insHtml += '<div class="ins-card" style="border-color:'+colors[k]+'33">' +
      '<div class="in" style="color:'+colors[k]+'">'+lnames[k]+'</div>' +
      '<div class="iv" style="color:'+colors[k]+'">'+sum+'<span style="font-size:13px;color:var(--gray2)">/'+maxes[k]+'</span></div>' +
      '<div class="il" style="color:'+colors[k]+'">'+lv+'</div>' +
      '<p>'+ins.substring(0,120)+'...</p></div>';
  });
  document.getElementById('ins-grid').innerHTML = insHtml;
  showScreen('screen-radar');
  // Auto-prompt save after radar
  setTimeout(autoSave, 800);
}

// ═══════════════════════════════════════════
//  REPORT
// ═══════════════════════════════════════════
function showReport() {
  buildReport();
  showScreen('screen-report');
}

function buildReport() {
  var maxes = {f1:21,f2:12,f3:18,f4:12};
  var colors = {f1:'#1B4F8A',f2:'#0D7C8C',f3:'#0D6B45',f4:'#4a4558'};
  var lnames = {f1:'Fase 1 · Planejamento Estratégico',f2:'Fase 2 · Proteção da Execução',f3:'Fase 3 · Gestão da Produção',f4:'Fase 4 · Controle e Performance'};

  // Meta
  document.getElementById('rep-meta').innerHTML =
    '<strong>'+S.empresa+'</strong><br>' +
    (S.contato ? '<strong>'+S.contato+'</strong>'+(S.cargo ? ' · '+S.cargo : '')+'<br>' : '') +
    (S.email ? '<a href="mailto:'+S.email+'" style="color:var(--orange)">'+S.email+'</a><br>' : '') +
    (S.telefone ? S.telefone+'<br>' : '') +
    'Consultor: '+S.consultor+'<br>Data: '+S.data;

  // Section 1
  var insHtml = '';
  ['f1','f2','f3','f4'].forEach(function(k) {
    var arr = S.scores[k];
    var sum = Array.isArray(arr) ? arr.reduce(function(a,b){return a+(b||0);},0) : 0;
    var p = sum/(maxes[k]||1);
    var lv = levelFromPct(p);
    var ins = PQ[k].insight(p);
    insHtml += '<div class="rep-ins-card" style="border-left:3px solid '+colors[k]+'">' +
      '<div class="rn" style="color:'+colors[k]+'">'+lnames[k]+'</div>' +
      '<div class="rv" style="color:'+colors[k]+'">'+sum+'/'+maxes[k]+'</div>' +
      '<div class="rl">'+lv+'</div>' +
      '<div class="rt">'+ins+'</div></div>';
  });
  document.getElementById('rep-ins').innerHTML = insHtml;

  // Section 2: opportunities
  var opps = generateOpportunities();
  var oppHtml = '';
  opps.forEach(function(r) {
    oppHtml += '<tr><td>'+r.gap+'</td><td><span class="gap-tag" style="background:'+r.color+'22;color:'+r.color+'">'+r.phase+'</span></td><td>'+r.impact+'</td></tr>';
  });
  document.getElementById('opp-body').innerHTML = oppHtml;

  // ROI inputs summary
  var portfolio = (S.numObras||5) * (S.orcamentoMedio||8000000);
  var prazoRep = S.prazoMedio || 18;
  document.getElementById('roi-inputs').innerHTML =
    '<div style="padding:11px;background:var(--light);border-radius:var(--r3)"><div style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.08em">Obras em andamento</div><div style="font-family:Bai Jamjuree;font-size:20px;font-weight:700">'+(S.numObras||5)+'</div></div>' +
    '<div style="padding:11px;background:var(--light);border-radius:var(--r3)"><div style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.08em">Orçamento médio por obra</div><div style="font-family:Bai Jamjuree;font-size:20px;font-weight:700">'+fmtNum(S.orcamentoMedio||8000000)+'</div></div>' +
    '<div style="padding:11px;background:var(--light);border-radius:var(--r3)"><div style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.08em">Prazo médio das obras</div><div style="font-family:Bai Jamjuree;font-size:20px;font-weight:700">'+(S.prazoMedio||18)+' meses</div></div>' +
    '<div style="padding:11px;background:var(--light);border-radius:var(--r3)"><div style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.08em">Portfólio estimado</div><div style="font-family:Bai Jamjuree;font-size:20px;font-weight:700">'+fmtNum(portfolio)+'</div></div>';

  // ROI table
  var roi = calculateROI();
  var roiHtml = '<thead><tr>' +
    '<th>Fonte de Ganho</th>' +
    '<th>Pressuposto</th>' +
    '<th style="text-align:center">Fator</th>' +
    '<th style="text-align:right">Por obra</th>' +
    '<th style="text-align:right">Portfólio</th>' +
    '</tr></thead><tbody>';
  roi.items.forEach(function(item, i) {
    var fp = Math.round((item.fator||1)*100);
    var fc = fp >= 80 ? '#ef4444' : fp >= 50 ? '#f97316' : '#22c55e';
    roiHtml += '<tr style="'+(i%2===0?'background:var(--light)':'')+'">' +
      '<td>'+item.label+'</td>' +
      '<td style="color:#777;font-size:11px">'+item.basis+'</td>' +
      '<td style="text-align:center;font-weight:700;color:'+fc+';font-size:12px">'+fp+'%</td>' +
      '<td style="text-align:right" class="roi-val">'+fmtNum(item.porObra)+'</td>' +
      '<td style="text-align:right;font-weight:600" class="roi-val">'+fmtNum(item.portfolio)+'</td>' +
      '</tr>';
  });
  roiHtml += '<tr class="roi-total">' +
    '<td colspan="2">PERDA FINANCEIRA NO PORTFÓLIO</td>' +
    '<td style="text-align:right;color:#666">'+fmtNum(roi.totalPorObra)+'<br><span style="font-size:10px;font-weight:400">por obra</span></td>' +
    '<td style="text-align:right;color:var(--orange)">'+fmtNum(roi.totalPortfolio)+'</td>' +
    '</tr></tbody>';
  document.getElementById('roi-table-el').innerHTML = roiHtml;

  // Update prazo in pressupostos
  var presPrazo = document.getElementById('pres-prazo');
  if(presPrazo) presPrazo.textContent = (S.prazoMedio||18) + ' meses';
  // ROI real (Estratégica + Operacional), com dados coletados do cliente
  buildROIReal();
  // Road map
  buildRoadmap();
}

function roiCapturaLabel(fator) {
  var pct = Math.round(fator*100);
  if(pct <= 35) return 'Pessimista';
  if(pct <= 55) return 'Conservador';
  if(pct <= 80) return 'Realista';
  return 'Pleno';
}

function buildROIReal() {
  var mensInput = document.getElementById('roi2-mensalidade');
  var capInput = document.getElementById('roi2-captura');
  if(mensInput) S.mensalidade = mensInput.dataset.raw ? parseInt(mensInput.dataset.raw,10) : parseBRL(mensInput.value);
  if(capInput && capInput.value !== '') S.captura = Math.max(0.30, Math.min(1, parseFloat(capInput.value)/100));

  var r = calcROIReal(S.captura);
  var fmtH = function(n){ return (n||0).toLocaleString('pt-BR',{maximumFractionDigits:1}) + ' h'; };
  // Código de cores usado na coluna "Como é calculado": distingue o que é dado
  // informado pelo cliente, o que é referência fixa de mercado, e o que é o
  // fator do cenário escolhido — em vez de apontar "ver acima/abaixo".
  var pC = function(t){ return '<strong style="color:#1B4F8A">'+t+'</strong>'; };
  var pF = function(t){ return '<span style="color:#888">'+t+'</span>'; };
  var pS = function(t){ return '<strong style="color:var(--orange)">'+t+'</strong>'; };
  var roiRow = function(label, formula, val) {
    return '<tr><td style="color:#333;font-size:12px">'+label+'</td>' +
      '<td style="font-size:11px;line-height:1.5">'+(formula||'')+'</td>' +
      '<td style="text-align:right;font-weight:600;white-space:nowrap" class="roi-val">'+val+'</td></tr>';
  };
  var roiLegend = '<div style="display:flex;flex-wrap:wrap;gap:16px;font-size:10px;color:#888;margin-bottom:10px">' +
    '<span>'+pC('■')+' dado informado nesta operação</span>' +
    '<span>'+pF('■')+' referência de mercado (Agilean/Lean Construction)</span>' +
    '<span>'+pS('■')+' fator do cenário escolhido</span>' +
  '</div>';
  var roiCard = function(label, val) {
    return '<div style="padding:11px;background:var(--light);border-radius:var(--r3)">' +
      '<div style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.06em">'+label+'</div>' +
      '<div style="font-family:Bai Jamjuree;font-size:18px;font-weight:700">'+val+'</div></div>';
  };

  var cfgEl = document.getElementById('roi2-config');
  if(cfgEl) {
    cfgEl.innerHTML =
      '<div class="input-group"><label>Mensalidade Agilean (R$)</label>' +
        '<input class="text-input" id="roi2-mensalidade" type="text" inputmode="numeric" oninput="fmtOrcamento(this);buildROIReal()" value="'+fmtBRL(S.mensalidade)+'"></div>' +
      '<div class="input-group"><label>Fator de captura / Cenário (%)</label>' +
        '<input class="text-input" id="roi2-captura" type="number" min="30" max="100" step="5" oninput="buildROIReal()" value="'+Math.round(S.captura*100)+'"></div>';
  }

  var sumEl = document.getElementById('roi2-summary');
  if(sumEl) {
    sumEl.innerHTML = 'Mensalidade considerada: <strong style="color:#333">'+fmtNum(S.mensalidade)+'</strong> · Cenário: <strong style="color:#333">'+Math.round(S.captura*100)+'% ('+roiCapturaLabel(S.captura)+')</strong>';
  }

  // Parâmetros base informados pelo cliente (alimentam as linhas de R$ abaixo)
  var diasFechamento = getDiasFechamentoAtual();
  var paramItem = function(label, val, isMarket) {
    var color = isMarket ? '#888' : '#1B4F8A';
    return '<div style="font-size:11px;color:#666">• '+label+': <strong style="color:'+color+'">'+val+'</strong></div>';
  };
  var paramsEl = document.getElementById('roi2-params-box');
  if(paramsEl) {
    paramsEl.innerHTML =
      '<div style="font-size:10px;color:#888;margin-bottom:8px">'+pC('■')+' dado informado nesta operação &nbsp; '+pF('■')+' referência de mercado</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">' +
        paramItem('Folha de MO própria/mês', fmtNum(S.roi2.folha||0)) +
        paramItem('Custo hora técnica', 'R$ '+ROI_REAL_K.CUSTO_HORA_TECNICA+'/h', true) +
        paramItem('Dias p/ fechar medição/folha hoje', fmtNumBare(diasFechamento)+' dias <span style="color:#999;font-weight:400">(resposta do Bloco MO)</span>') +
        paramItem('Horas/dia dedicadas a esse fechamento', fmtH(S.roi2.hDiaAtual)) +
        paramItem('Horas/semana conferindo qualidade', fmtH(S.roi2.hSemQualidade)) +
      '</div>';
  }

  var fluxosTableEl = document.getElementById('roi2-fluxos-table');
  if(fluxosTableEl) {
    var fluxoRows = ROI_REAL_FLUXOS.map(function(f) {
      var horas = S.roi2[f.key] || 0;
      var resultado = horas * f.ganho;
      var pct = Math.round(f.ganho*100);
      return '<tr>' +
        '<td>'+FLUXO_LABELS[f.key]+'</td>' +
        '<td style="text-align:center;color:#1B4F8A;font-weight:600">'+fmtH(horas)+'/mês</td>' +
        '<td style="text-align:center"><span style="padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;background:rgba(52,211,153,0.15);color:#0d6b45">Economiza '+pct+'%</span></td>' +
        '<td style="text-align:right" class="roi-val">'+fmtH(resultado)+'</td>' +
        '</tr>';
    }).join('');
    fluxosTableEl.innerHTML =
      '<thead><tr><th>Fluxo (rotina hoje manual)</th><th style="text-align:center">Horas informadas</th><th style="text-align:center">Economia com SIIGA</th><th style="text-align:right">Horas recuperadas</th></tr></thead>' +
      '<tbody>' + fluxoRows +
      '<tr class="roi-total"><td colspan="3">Total — base de "Economia nos fluxos" e "Capacidade de gestão"</td><td style="text-align:right">'+fmtH(r.operacional.subtotalFluxos)+'</td></tr>' +
      '</tbody>';
  }

  var estEl = document.getElementById('roi2-estrategica');
  if(estEl) {
    estEl.innerHTML =
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">' +
        roiCard('ROI Mensal', Math.round(r.estrategica.roi*100)+'%') +
        roiCard('Payback', isFinite(r.estrategica.payback) ? fmtNumBare(r.estrategica.payback)+' meses' : '—') +
        roiCard('Ganho Líquido/mês', fmtNum(r.estrategica.ganhoLiquido)) +
      '</div>' +
      roiLegend +
      '<table class="roi-table"><thead><tr><th>Item</th><th>Como é calculado</th><th style="text-align:right">Valor</th></tr></thead><tbody>' +
        roiRow('Retrabalho administrativo liberado ('+fmtH(r.estrategica.horasAdmLib)+')',
          pC('Dias de fechamento informados')+' × 8h/dia × '+pF('R$115/h')+' × '+pS('fator do cenário'),
          fmtNum(r.estrategica.rec1)) +
        roiRow('Pagamentos por retrabalho evitados',
          pC('Folha de MO própria informada')+' × '+pF('5% de retrabalho')+' × '+pS('fator do cenário'),
          fmtNum(r.estrategica.rec2)) +
        roiRow('Pagamentos indevidos rastreados',
          pC('Folha de MO própria informada')+' × '+pF('5% indevidos × 80% sem sobreposição')+' × '+pS('fator do cenário'),
          fmtNum(r.estrategica.rec3)) +
        roiRow('<strong>Recuperação financeira total</strong>', '<span style="color:#999">Soma das 3 linhas acima</span>', '<strong>'+fmtNum(r.estrategica.recTotal)+'</strong>') +
        roiRow('Capacidade de gestão liberada ('+fmtH(r.estrategica.horasLib)+')',
          pC('Soma dos 8 fluxos informados')+' (quadro "De onde vêm as horas") × '+pS('fator do cenário')+' × '+pF('R$115/h'),
          fmtNum(r.estrategica.valorCapacidade)) +
        roiRow('Investimento Agilean (mensalidade)', '<span style="color:#999">Valor definido pelo consultor</span>', '− '+fmtNum(S.mensalidade)) +
      '</tbody></table>';
  }

  var opEl = document.getElementById('roi2-operacional');
  if(opEl) {
    opEl.innerHTML =
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">' +
        roiCard('Horas recuperadas/mês', fmtH(r.operacional.hMes)) +
        roiCard('Horas recuperadas/obra', fmtH(r.operacional.hObra)) +
        roiCard('% da jornada liberada', (Math.round(r.operacional.pctJornada*1000)/10)+'%') +
      '</div>' +
      roiLegend +
      '<table class="roi-table"><thead><tr><th>Item</th><th>Como é calculado</th><th style="text-align:right">Valor</th></tr></thead><tbody>' +
        roiRow('Economia nos fluxos de gestão',
          pC('Soma das horas informadas nos 8 fluxos')+' (quadro "De onde vêm as horas") × '+pF('% de economia por fluxo'),
          fmtH(r.operacional.subtotalFluxos)) +
        roiRow('Fechamento de medição mais rápido',
          '('+pC('dias × horas/dia informados hoje')+') − (mesmos dados × '+pF('70% de redução SIIGA')+')',
          fmtH(r.operacional.fechRapido)) +
        roiRow('Fim da conferência manual de qualidade',
          pC('Horas/semana informadas')+' × '+pF('4,33 semanas/mês'),
          fmtH(r.operacional.fimConf)) +
        roiRow('Desconto de sobreposição entre blocos',
          '<span style="color:#999">Soma bruta das linhas acima</span> × '+pF('15% de sobreposição'),
          '− '+fmtH(r.operacional.descBlocos)) +
        roiRow('<strong>Potencial pleno (antes do fator de captura)</strong>', '<span style="color:#999">Soma bruta − desconto de sobreposição</span>', '<strong>'+fmtH(r.operacional.potPleno)+'</strong>') +
      '</tbody></table>';
  }

  var cenTableEl = document.getElementById('roi2-cenarios-table');
  if(cenTableEl) {
    var cenRows = ROI_REAL_CENARIOS.map(function(c) {
      var isAtivo = Math.abs(c.fator - S.captura) < 0.001;
      var rc = calcROIReal(c.fator);
      var rowStyle = isAtivo
        ? 'background:rgba(255,95,31,0.08);border-left:3px solid var(--orange)'
        : '';
      var nomeCell = isAtivo
        ? '<strong style="color:var(--orange)">✓ '+c.nome+'</strong>'
        : c.nome;
      return '<tr style="'+rowStyle+'">' +
        '<td>'+nomeCell+'</td>' +
        '<td style="text-align:center;color:#666">'+Math.round(c.fator*100)+'%</td>' +
        '<td style="text-align:right" class="roi-val">'+Math.round(rc.estrategica.roi*100)+'%</td>' +
        '<td style="text-align:right" class="roi-val">'+fmtNum(rc.estrategica.ganhoLiquido)+'</td>' +
        '<td style="text-align:right" class="roi-val">'+fmtH(rc.operacional.hMes)+'</td>' +
        '</tr>';
    }).join('');
    cenTableEl.innerHTML =
      '<thead><tr>' +
        '<th>Cenário</th><th style="text-align:center">Fator</th>' +
        '<th style="text-align:right">ROI Mensal</th>' +
        '<th style="text-align:right">Ganho Líquido/mês</th>' +
        '<th style="text-align:right">Horas/mês</th>' +
      '</tr></thead><tbody>' + cenRows + '</tbody>';
  }
}

// Título curto + impacto (consequência/custo) para cada pergunta pontuada.
// Cobre F1-F4 e MO por completo — antes só ~9 das ~28 perguntas eram avaliadas aqui.
var GAP_INFO = {
  'F1.1':{title:'Formalidade do planejamento', impact:'Sem aprovação formal antes do início, a obra herda decisões de última hora que já deveriam estar travadas na largada.'},
  'F1.2':{title:'Técnica de planejamento', impact:'Sem Linha de Balanço por lotes, é impossível visualizar gargalos antecipadamente — decisões de equipe são feitas no feeling.'},
  'F1.3':{title:'Dimensionamento de equipes', impact:'Equipes dimensionadas por estimativa geram folga ou furo de mão de obra que só aparece quando o atraso já aconteceu.'},
  'F1.4':{title:'Integração orçamento × planejamento', impact:'Orçamento e planejamento desconectados escondem desvio de custo até o fechamento — quando já é tarde para agir.'},
  'F1.5':{title:'Acompanhamento da Curva S', impact:'Desvios de prazo são identificados semanas depois. Sem projeção de término, não há decisão estruturada de recuperação.'},
  'F1.6':{title:'Cronograma bancário', impact:'Retrabalho duplo em toda reprogramação. Exposição de caixa invisível gera risco financeiro não mapeado.'},
  'F1.7':{title:'Integração planejamento × suprimentos', impact:'Compras emergenciais têm custo 15–25% maior. Paradas por material faltante são evitáveis.'},
  'F2.1':{title:'Lookahead / gestão de restrições', impact:'Restrições aparecem quando já atrasaram. Antecipação reduz paradas não planejadas em até 40%.'},
  'F2.2':{title:'Antecipação de riscos de parada', impact:'Sem visibilidade de risco com semanas de antecedência, cada parada vira surpresa — e surpresa tem custo de produção parada.'},
  'F2.3':{title:'Planejamento de MO no médio prazo', impact:'Equipe não confirmada para as próximas semanas é risco imediato de parada por falta de mão de obra.'},
  'F2.4':{title:'Ciclo de reprogramação', impact:'Sem ciclo formal de reprogramação, os mesmos desvios se acumulam de mês em mês sem correção estrutural.'},
  'F3.1':{title:'Programação semanal', impact:'Obra opera sem feedback real. Uma semana de decisão perdida a cada ciclo.'},
  'F3.2':{title:'Check-out e check-in diário', impact:'Sem ritual diário, o engenheiro descobre os problemas do canteiro de forma descoordenada — depois que já impactaram o dia.'},
  'F3.3':{title:'Rastreabilidade de desvios', impact:'Sem registro e causa raiz, os mesmos problemas se repetem indefinidamente — sem nenhuma curva de aprendizado.'},
  'F3.4':{title:'Frequência de coleta do avanço', impact:'Avanço físico coletado por estimativa mensal. Dado chega semanas atrasado — improdutividade de MO fica invisível até o fechamento.'},
  'F3.5':{title:'Qualidade vinculada ao pagamento', impact:'Sem vínculo entre qualidade aprovada e pagamento, paga-se por produção que pode precisar de retrabalho.'},
  'F3.6':{title:'Análise intermediária de MO', impact:'Sem análise quinzenal, funcionários e empreiteiros improdutivos só são identificados no fechamento — quando o custo já foi gerado.'},
  'F4.1':{title:'Fechamento técnico de período', impact:'Sem fechamento técnico estruturado, os dados gerados nas Fases 1, 2 e 3 morrem na semana — a próxima reprogramação recomeça do zero.'},
  'F4.2':{title:'Reunião executiva com diretoria', impact:'Reunião executiva sem dados estruturados. Decisões tomadas no feeling — cada reunião termina com narrativa, não com plano.'},
  'F4.3':{title:'Performance HUB — visão integrada', impact:'Sem painel único, alguém precisa compilar manualmente prazo, custo e qualidade antes de cada reunião — tempo gasto montando o dado, não decidindo.'},
  'F4.4':{title:'Pagamento por Evidência', impact:'Fechamento sem base objetiva de produção paga por estimativa ou negociação — sem rastreabilidade e sem auditoria possível.'},
  'MO.1':{title:'Transparência de metas para equipes', impact:'Quando o operário não sabe o que vai ganhar, não tem como se comprometer com uma meta — a produtividade fica ao acaso.'},
  'MO.2':{title:'Visibilidade de improdutividade', impact:'Funcionário improdutivo é custo sem dono. Em múltiplas obras simultâneas, esse gap se multiplica — não é problema de uma obra, é padrão de operação.'},
  'MO.3':{title:'Gestão de aditivos de verba', impact:'Verba extra aprovada só depois de executada distorce o custo real de cada serviço e cria passivo de ajuste.'},
  'MO.4':{title:'Eficiência do fechamento de folha', impact:'Cada dia de engenharia gasto fechando folha é um dia a menos de gestão ativa da obra — e indica ausência de dados estruturados.'},
  'MO.5':{title:'Alinhamento de metas com empreiteiros', impact:'Empreiteiro sem meta clara trabalha no ritmo dele — não no ritmo da obra.'},
  'MO.6':{title:'Comunicação de bloqueios de pagamento', impact:'Empreiteiro que descobre pendência de qualidade só no fechamento gera conflito mensal garantido.'},
  'MO.7':{title:'Eficiência do fechamento de medição', impact:'Medição de empreiteiros que leva uma semana é fechada na base da negociação — não do registro.'}
};

function generateOpportunities() {
  var opps = [];

  function pushGaps(bk, arr, qs) {
    arr = arr || [];
    qs.forEach(function(q, i) {
      if(q.type === 'numgrid') return;
      var score = arr[i] || 0;
      if(score <= 1) {
        var info = GAP_INFO[q.code] || { title: q.code, impact: q.reveals || '' };
        opps.push({ gap: info.title, phase: bk.toUpperCase(), color: PQ[bk].colorHex, impact: info.impact, score: score });
      }
    });
  }
  pushGaps('f1', S.scores.f1, PQ.f1.qs);
  pushGaps('f2', S.scores.f2, PQ.f2.qs);
  pushGaps('f3', S.scores.f3, PQ.f3.qs);
  pushGaps('f4', S.scores.f4, PQ.f4.qs);

  // MO usa objeto por código (não array por índice) e é filtrado por modelo de MO
  var moScores = S.scores.mo || {};
  getFilteredQs(PQ.mo).forEach(function(q) {
    if(q.type === 'numgrid') return;
    var score = moScores[q.code] || 0;
    if(score <= 1) {
      var info = GAP_INFO[q.code] || { title: q.code, impact: q.reveals || '' };
      opps.push({ gap: info.title, phase: 'MO', color: PQ.mo.colorHex, impact: info.impact, score: score });
    }
  });

  opps.sort(function(a,b){ return a.score - b.score; }); // pior score primeiro
  return opps.slice(0, 10);
}

function calculateROI() {
  var obras     = S.numObras || 5;
  var orcamento = S.orcamentoMedio || 8000000;
  var prazo     = S.prazoMedio || 18;
  var portfolio = obras * orcamento;
  var mo        = S.modeloMO || '';

  // ── PRESSUPOSTOS BASE ─────────────────────────────────────────────
  var PCT_MO         = 0.45;
  var ESTOURO_MO     = 0.15;
  var CAPTURA_MO     = 0.70;
  var CUSTO_ENG_DIA  = 800;
  var diasRotinas = [
    {atual:4, depois:1}, {atual:4, depois:0.5},
    {atual:5, depois:0.25}, {atual:3, depois:0.5}
  ];
  var diasLib = diasRotinas.reduce(function(a,r){return a+(r.atual-r.depois);},0);

  // ── PHASE PERCENTAGES ─────────────────────────────────────────────
  var f1p = getAvgPct('f1');
  var f2p = getAvgPct('f2');
  var f3p = getAvgPct('f3');
  var f4p = getAvgPct('f4');

  // ── WEIGHTED CAPTURE FACTOR per component ─────────────────────────
  // fator = 0.20 + (1 - score_ponderado_do_componente) × 0.80
  // Min 20% (empresa 100% madura), Max 100% (empresa 0% madura)
  function capFactor(scoreComposto) {
    return Math.max(0.20, Math.min(1.0, 0.20 + (1 - scoreComposto) * 0.80));
  }

  var fatTime    = capFactor(f3p * 0.50 + f4p * 0.50);   // time: F3+F4
  var fatRetr    = capFactor(f2p * 0.30 + f3p * 0.70);   // retrabalho: F2+F3
  var fatVeloc   = capFactor(f1p * 0.50 + f2p * 0.50);   // velocidade: F1+F2
  var fatMO      = capFactor(f3p * 0.70 + f2p * 0.30);   // MO: F3+F2
  var fatErros   = capFactor(f3p * 0.40 + f4p * 0.60);   // erros: F3+F4

  // ── GANHOS BASE (potencial teórico por obra) ──────────────────────
  var engBase    = diasLib * CUSTO_ENG_DIA * prazo;
  var retrBase   = orcamento * 0.10 * 0.40;
  var velocBase  = orcamento * 0.10 * 0.15;
  var erroBase   = orcamento * PCT_MO * 0.02;

  var moBase = 0;
  var moLabel = '', moBasis = '';
  if(mo === 'propria') {
    moBase  = orcamento * PCT_MO * ESTOURO_MO * CAPTURA_MO;
    moLabel = 'Redução de estouro no custo de mão de obra';
    moBasis = 'Orçamento × 45% MO × 15% estouro × 70% de redução com SIIGA';
  } else if(mo === 'mista') {
    moBase  = orcamento * PCT_MO * 0.50 * ESTOURO_MO * CAPTURA_MO;
    moLabel = 'Redução de estouro de MO (50% própria)';
    moBasis = 'Orçamento × 45% × 50% própria × 15% estouro × 70% de redução';
  } else if(mo === 'terceirizada') {
    moBase  = 0;
    moLabel = '';
    moBasis = '';
  }

  // ── GANHOS PONDERADOS ─────────────────────────────────────────────
  var items = [
    {
      key:'time', label:'Otimização do time de gestão',
      basis: Math.round(diasLib) + ' dias/mês × R$800/dia × ' + prazo + ' meses',
      fator: fatTime,
      porObra:   Math.round(engBase  * fatTime),
      portfolio: Math.round(engBase  * fatTime * obras),
      baseValue: Math.round(engBase)
    },
    {
      key:'retrabalho', label:'Redução de retrabalhos',
      basis: 'Orçamento × 10% (retrabalho mercado) × 40% (redução com SIIGA)',
      fator: fatRetr,
      porObra:   Math.round(retrBase * fatRetr),
      portfolio: Math.round(retrBase * fatRetr * obras),
      baseValue: Math.round(retrBase)
    },
    {
      key:'velocidade', label:'Ganho em velocidade de produção',
      basis: 'Orçamento × 10% (redução prazo) × 15% (custos proporcionais)',
      fator: fatVeloc,
      porObra:   Math.round(velocBase * fatVeloc),
      portfolio: Math.round(velocBase * fatVeloc * obras),
      baseValue: Math.round(velocBase)
    },
    {
      key:'erros', label:'Erros de medição e folha de produção',
      basis: 'Orçamento × 45% (custo MO) × 2% (desvio médio)',
      fator: fatErros,
      porObra:   Math.round(erroBase * fatErros),
      portfolio: Math.round(erroBase * fatErros * obras),
      baseValue: Math.round(erroBase)
    }
  ];

  if(moBase > 0) {
    items.push({
      key:'mo', label: moLabel, basis: moBasis,
      fator: fatMO,
      porObra:   Math.round(moBase * fatMO),
      portfolio: Math.round(moBase * fatMO * obras),
      baseValue: Math.round(moBase)
    });
  }

  var totalPorObra   = items.reduce(function(a,b){return a+b.porObra;},0);
  var totalPortfolio = items.reduce(function(a,b){return a+b.portfolio;},0);
  var totalBase      = items.reduce(function(a,b){return a+b.baseValue;},0);

  // Overall weighted factor for display
  var overallFator = totalPorObra / (totalBase || 1);

  return {
    items: items,
    totalPorObra: totalPorObra,
    totalPortfolio: totalPortfolio,
    total: totalPortfolio,
    totalBase: totalBase,
    overallFator: overallFator,
    fatores: {time:fatTime, retrabalho:fatRetr, velocidade:fatVeloc, mo:fatMO, erros:fatErros}
  };
}

// ═══════════════════════════════════════════
//  ROI REAL — portado de calculadora-roi-agilean.html
//  Usa os dados coletados no diagnóstico (S.roi2) em vez de
//  estimativas teóricas baseadas só no score de maturidade.
// ═══════════════════════════════════════════
var ROI_REAL_K = {
  CUSTO_HORA_ADM: 115,        // R$/h reforço administrativo
  CUSTO_HORA_TECNICA: 115,    // R$/h equipe de gestão — fixo, não perguntado ao cliente
  PCT_RETRABALHO: 0.05,       // pagamentos de retrabalho sobre a folha
  PCT_INDEVIDOS: 0.05,        // pagamentos indevidos sem rastreio sobre a folha
  DESC_SOBREPOSICAO: 0.20,    // sobreposição entre riscos (Estratégica)
  DESC_BLOCOS_ENG: 0.15,      // sobreposição entre blocos (Operacional)
  GANHO_PLANEJAR: 0.40,       // fluxo "Planejar cronograma"
  GANHO_PADRAO: 0.90,         // demais fluxos
  JORNADA: 176,               // horas úteis/mês
  HORAS_DIA: 8,               // conversão horas → dias
  FATOR_AGILEAN: 0.30         // valor "com Agilean" = valor atual × 0,30 (redução de 70%)
};

var ROI_REAL_FLUXOS = [
  { key:'fluxoPlanejar',    ganho: ROI_REAL_K.GANHO_PLANEJAR },
  { key:'fluxoCurto',       ganho: ROI_REAL_K.GANHO_PADRAO },
  { key:'fluxoMedio',       ganho: ROI_REAL_K.GANHO_PADRAO },
  { key:'fluxoMedir',       ganho: ROI_REAL_K.GANHO_PADRAO },
  { key:'fluxoReprogramar', ganho: ROI_REAL_K.GANHO_PADRAO },
  { key:'fluxoCruzar',      ganho: ROI_REAL_K.GANHO_PADRAO },
  { key:'fluxoConferir',    ganho: ROI_REAL_K.GANHO_PADRAO },
  { key:'fluxoERP',         ganho: ROI_REAL_K.GANHO_PADRAO }
];

var FLUXO_LABELS = {
  fluxoPlanejar:    'Planejar cronograma',
  fluxoCurto:       'Criar curto prazo',
  fluxoMedio:       'Controlar médio prazo',
  fluxoMedir:       'Medir',
  fluxoReprogramar: 'Reprogramar',
  fluxoCruzar:      'Cruzar dados',
  fluxoConferir:    'Conferir planilhas',
  fluxoERP:         'Passar medição para o ERP'
};

var ROI_REAL_CENARIOS = [
  { nome:'Pessimista',  fator:0.30 },
  { nome:'Conservador', fator:0.50 },
  { nome:'Realista',    fator:0.70 },
  { nome:'Pleno',       fator:1.00 }
];

// Converte a resposta categórica de MO.4/MO.7 (0-3) em uma estimativa de dias
// para fechar medição/folha — evita perguntar de novo o que o Bloco MO já capturou.
function diasFromMOScore(score) {
  var map = { 0:6, 1:3.5, 2:2, 3:1 };
  return map[score] !== undefined ? map[score] : 5;
}

function getDiasFechamentoAtual() {
  var mo = S.scores.mo || {};
  var temPropria = mo['MO.4'] !== undefined;
  var temTerc = mo['MO.7'] !== undefined;
  if(temPropria && temTerc) return (diasFromMOScore(mo['MO.4']) + diasFromMOScore(mo['MO.7'])) / 2;
  if(temPropria) return diasFromMOScore(mo['MO.4']);
  if(temTerc) return diasFromMOScore(mo['MO.7']);
  return 5; // fallback conservador se o Bloco MO ainda não foi respondido
}

function calcROIReal(fator) {
  var r = S.roi2 || {};
  var K = ROI_REAL_K;
  fator = (fator === undefined || fator === null) ? (S.captura || 0.50) : fator;
  var prazo = S.prazoMedio || 18;
  var mensalidade = S.mensalidade || 0;
  var diasAtual = getDiasFechamentoAtual();

  var diasAgilean = diasAtual * K.FATOR_AGILEAN;
  var hDiaAgilean  = (r.hDiaAtual||0) * K.FATOR_AGILEAN;

  // ---- Operacional ----
  var subtotalFluxos = ROI_REAL_FLUXOS.reduce(function(acc, f) {
    return acc + (r[f.key]||0) * f.ganho;
  }, 0);
  var fechRapido = Math.max(0, diasAtual*(r.hDiaAtual||0) - diasAgilean*hDiaAgilean);
  var fimConf = (r.hSemQualidade||0) * 4.33;
  var subtotalRotina = fechRapido + fimConf;
  var bruto = subtotalFluxos + subtotalRotina;
  var descBlocos = bruto * K.DESC_BLOCOS_ENG;
  var potPleno = bruto * (1 - K.DESC_BLOCOS_ENG);
  var hMes = potPleno * fator;
  var hObra = hMes * prazo;
  var pctJornada = hMes / K.JORNADA;

  // ---- Estratégica ----
  // horasLib deriva do detalhamento operacional (subtotalFluxos), em vez de
  // uma estimativa genérica separada de "horas de gestão" + "eficiência".
  var horasAdmLib = Math.max(0, diasAtual - diasAgilean) * K.HORAS_DIA;
  var rec1 = horasAdmLib * K.CUSTO_HORA_ADM * fator;
  var rec2 = (r.folha||0) * K.PCT_RETRABALHO * fator;
  var rec3 = (r.folha||0) * K.PCT_INDEVIDOS * (1 - K.DESC_SOBREPOSICAO) * fator;
  var recTotal = rec1 + rec2 + rec3;
  var horasLib = subtotalFluxos * fator;
  var valorCapacidade = horasLib * K.CUSTO_HORA_TECNICA;
  var ganhoLiquido = recTotal + valorCapacidade - mensalidade;
  var roiPct = mensalidade > 0 ? ganhoLiquido / mensalidade : 0;
  var payback = ganhoLiquido > 0 ? mensalidade / ganhoLiquido : Infinity;

  return {
    fator: fator, mensalidade: mensalidade, prazo: prazo,
    operacional: {
      subtotalFluxos: subtotalFluxos, fechRapido: fechRapido, fimConf: fimConf,
      subtotalRotina: subtotalRotina, bruto: bruto, descBlocos: descBlocos,
      potPleno: potPleno, hMes: hMes, hObra: hObra, pctJornada: pctJornada
    },
    estrategica: {
      horasAdmLib: horasAdmLib, rec1: rec1, rec2: rec2, rec3: rec3, recTotal: recTotal,
      horasLib: horasLib, valorCapacidade: valorCapacidade, ganhoLiquido: ganhoLiquido,
      roi: roiPct, payback: payback
    }
  };
}

function buildRoadmap() {
  var f1p = getAvgPct('f1');
  var f2p = getAvgPct('f2');
  var f3p = getAvgPct('f3');
  var f4p = getAvgPct('f4');

  // ── SPRINT LIBRARY — full item sets per phase ─────────────────────────────
  var SPRINTS = {
    f1_critical: {
      lbl:'S1', color:'#1B4F8A',
      title:'Estruturar a base do planejamento',
      focus:'Os gaps de planejamento identificados impedem que os demais pilares funcionem. A prioridade é criar uma linha de base confiável antes de qualquer outra iniciativa.',
      items: [
        'Lean EAP e Dicionário de Pacotes validados — o que inclui, o que exclui e critério de terminalidade por pacote',
        'Linha de Balanço elaborada com lotes, ritmos e equipes dimensionadas',
        'Físico-financeiro conectado ao orçamento gerando Curva S confiável',
        'Cronograma de suprimentos gerado a partir do planejamento — eliminando compras emergenciais',
        'Análise de viabilidade do prazo contratual com a estrutura atual de equipes'
      ],
      prod:'Planejamento estratégico e linha de base'
    },
    f1_medium: {
      lbl:'S1', color:'#1B4F8A',
      title:'Consolidar e integrar o planejamento',
      focus:'O planejamento existe mas precisa ser conectado ao orçamento e ao canteiro para gerar previsibilidade real.',
      items: [
        'Refinamento da Linha de Balanço com ritmos e defasagens validadas',
        'Curva S e cronograma bancário integrados ao planejamento vigente',
        'Integração planejamento × suprimentos — compras antecipadas pelo cronograma',
        'Alinhamento EAP × orçamento para viabilizar físico-financeiro confiável'
      ],
      prod:'Planejamento estratégico e linha de base'
    },
    f2_critical: {
      lbl:'S2', color:'#0D7C8C',
      title:'Implantar proteção da execução',
      focus:'Sem lookahead e gestão de restrições, os problemas só aparecem quando já travaram a produção. A obra precisa sair do modo reativo antes de evoluir para o canteiro.',
      items: [
        'Lookahead das próximas 4 semanas implantado com responsáveis por restrição',
        'Gestão de restrições ativa — lista semanal com categoria, responsável e prazo de remoção',
        'Custo de MO comprometido por pacote para as próximas 2 semanas',
        'Primeiro ciclo de reprogramação baseado nos desvios identificados',
        'Rotina de reunião de médio prazo com pauta e saídas estruturadas'
      ],
      prod:'Proteção do plano e antecipação de riscos'
    },
    f2_medium: {
      lbl:'S2', color:'#0D7C8C',
      title:'Fortalecer a proteção da execução',
      focus:'O lookahead existe mas não está gerando accountability. O foco é transformar a reunião de médio prazo em um ciclo real de decisão.',
      items: [
        'Padronização do lookahead com análise de restrições por categoria',
        'IRR (Índice de Remoção de Restrições) como indicador semanal de acompanhamento',
        'Ciclo de reprogramação tática com ajuste da Linha de Balanço a cada 30 dias',
        'Alertas automáticos de pacotes sem MO associada nas próximas 2 semanas'
      ],
      prod:'Proteção do plano e antecipação de riscos'
    },
    f3_critical: {
      lbl:'S3', color:'#0D6B45',
      title:'Fazer o planejamento chegar ao canteiro',
      focus:'O principal gap está entre o que é planejado e o que chega ao dia a dia da obra. O objetivo é criar o ciclo diário e semanal que conecta planejamento e execução.',
      items: [
        'Plano semanal com metas por equipe desdobrado do lookahead',
        'Ritual de check-in e checkout implantado — pauta fixa, até 30 min, causa padrão registrada',
        'Registro de avanço físico em tempo real — canteiro gera dado, gestão age na semana',
        'Primeiro PPC semanal por equipe com causas de não cumprimento',
        'Prévia quinzenal de MO — improdutividade visível antes do fechamento'
      ],
      prod:'Gestão integrada de produção e mão de obra'
    },
    f3_medium: {
      lbl:'S3', color:'#0D6B45',
      title:'Fortalecer o ciclo de produção',
      focus:'O canteiro já tem rotinas, mas o dado gerado ainda não alimenta a gestão com velocidade suficiente. O foco é qualidade do dado e integração com qualidade e MO.',
      items: [
        'Vínculo qualidade × pagamento ativado — FVS integrada ao ciclo de medição',
        'Autoapontamento de avanço com validação do encarregado',
        'Análise quinzenal de MO improdutiva com plano de ação por funcionário',
        'PPC semanal com análise de causas acumuladas — Pareto de desvios por frente'
      ],
      prod:'Gestão integrada de produção e mão de obra'
    },
    f4_intro: {
      lbl:'∞', color:'#4a4558',
      title:'Primeiros passos de controle executivo',
      focus:'Com os pilares anteriores estruturados, os dados já existem para alimentar o ciclo de performance. O foco é criar a reunião de inteligência e o fechamento baseado em evidência.',
      items: [
        'Reunião mensal de inteligência com engenharia — análise de prazo, qualidade e custo',
        'Relatório executivo automático para diretoria com indicadores consolidados',
        'Pagamento por evidência — sugestão de folha e medição baseada em produção registrada'
      ],
      prod:'Controle, performance e inteligência de gestão'
    },
    f4_deferred: {
      lbl:'M4+', color:'#4a4558',
      title:'Controle e Performance — Mês 4 em diante',
      focus:null,
      items: [
        'Reunião mensal de inteligência com indicadores reais de prazo, custo e qualidade',
        'Pagamento baseado em evidência de produção com aprovação hierárquica',
        'Ciclo virtuoso SIIGA operando de forma autônoma'
      ],
      prod:'Controle, performance e inteligência de gestão'
    }
  };

  // ── PLAN SELECTION LOGIC ──────────────────────────────────────────────────
  var sprints = [];
  var f4Note = null;

  // Check if client did a focused diagnosis with priority order
  var priority = S.pilarPriority && S.pilarPriority.length > 0
    ? S.pilarPriority
    : null;

  // Core logic: select 2-3 sprints based on the biggest gaps
  // respecting method sequence: F1 → F2 → F3 → F4
  var daysLabels = ['Dias 1–30', 'Dias 31–60', 'Dias 61–90'];
  var sprintDefs = [];

  // F1 assessment
  if(f1p < 0.50) {
    sprintDefs.push(SPRINTS.f1_critical);
  } else if(f1p < 0.75) {
    sprintDefs.push(SPRINTS.f1_medium);
  }

  // F2 assessment (only add if not already 3 sprints)
  if(sprintDefs.length < 3) {
    if(f2p < 0.50) {
      sprintDefs.push(SPRINTS.f2_critical);
    } else if(f2p < 0.70 && sprintDefs.length < 2) {
      sprintDefs.push(SPRINTS.f2_medium);
    }
  }

  // F3 assessment (only add if not already 3 sprints and F1 is minimally ok)
  if(sprintDefs.length < 3) {
    if(f3p < 0.50) {
      sprintDefs.push(SPRINTS.f3_critical);
    } else if(f3p < 0.70 && sprintDefs.length < 2) {
      sprintDefs.push(SPRINTS.f3_medium);
    }
  }

  // If all F1-F3 are strong, or we need a 3rd sprint, check F4
  if(sprintDefs.length < 2) {
    // All pillars reasonably strong — focus on F3→F4 evolution
    if(f3p >= 0.60 && f4p < 0.65) {
      sprintDefs.push(SPRINTS.f3_medium);
    }
  }

  // F4: only include in 90 days if F1+F2+F3 average >= 55%
  var baseAvg = (f1p + f2p + f3p) / 3;
  if(baseAvg >= 0.55) {
    if(sprintDefs.length < 3) {
      sprintDefs.push(SPRINTS.f4_intro);
    } else {
      // Add as month 4+
      sprintDefs.push(SPRINTS.f4_deferred);
      f4Note = null; // no extra note needed, shown in sprint
    }
  } else if(f4p < 0.55) {
    // F4 is weak but base is not ready — defer with explanation
    f4Note = 'O Pilar 4 (Controle e Performance) depende da qualidade dos dados gerados pelos Pilares 1, 2 e 3. Com a base estruturada nos sprints acima, a implantação do ciclo executivo acontece naturalmente a partir do <strong>mês 4</strong> — quando os dados já têm confiabilidade suficiente para alimentar decisões.';
    sprintDefs.push(SPRINTS.f4_deferred);
  } else {
    // F4 is ok — add deferred reference
    sprintDefs.push(SPRINTS.f4_deferred);
  }

  // Ensure at least 2 sprints always
  if(sprintDefs.length < 2) {
    sprintDefs.push(SPRINTS.f3_medium);
    sprintDefs.push(SPRINTS.f4_intro);
  }

  // Assign day labels
  var dayIdx = 0;
  sprintDefs.forEach(function(sp) {
    if(sp.lbl !== '∞' && sp.lbl !== 'M4+' && dayIdx < daysLabels.length) {
      sp.days = daysLabels[dayIdx++];
    } else {
      sp.days = 'Mês 4+';
    }
  });

  sprints = sprintDefs;

  // ── RENDER ────────────────────────────────────────────────────────────────
  var html = '';

  // F4 deferred note
  if(f4Note) {
    html += '<div style="padding:12px 16px;background:rgba(74,69,88,0.3);border-radius:8px;border:1px solid rgba(74,69,88,0.5);font-size:12px;color:rgba(255,255,255,0.65);line-height:1.7;margin-bottom:16px">' +
      '<strong style="color:rgba(255,255,255,0.8)">Sobre o Pilar 4:</strong> ' + f4Note + '</div>';
  }

  sprints.forEach(function(sp, i) {
    var isLast = i === sprints.length - 1;
    var isDeferred = sp.lbl === 'M4+' || sp.lbl === '∞';
    var items = sp.items.map(function(it){return '<li>'+it+'</li>';}).join('');

    var focusHtml = sp.focus
      ? '<div style="font-size:12px;color:rgba(255,255,255,0.55);font-style:italic;line-height:1.6;margin-bottom:10px;padding:8px 10px;background:rgba(255,255,255,0.03);border-radius:6px;border-left:2px solid '+ sp.color+'">' + sp.focus + '</div>'
      : '';

    html += '<div class="sprint">' +
      '<div class="sprint-marker">' +
        '<div class="sprint-dot" style="background:'+(isDeferred?'rgba(74,69,88,0.8)':sp.color)+';color:white;font-size:'+(isDeferred?'9px':'11px')+'">'+sp.lbl+'</div>' +
        (isLast ? '' : '<div class="sprint-line"></div>') +
        '<div class="sprint-lbl">'+sp.days+'</div>' +
      '</div>' +
      '<div class="sprint-body">' +
        '<h4 style="color:'+(isDeferred?'#9ca3af':sp.color)+'">'+sp.title+'</h4>' +
        focusHtml +
        '<ul>'+items+'</ul>' +
        '<span class="prod-tag" style="'+(isDeferred?'opacity:0.6':'')+'">'+sp.prod+'</span>' +
      '</div></div>';
  });

  document.getElementById('roadmap-el').innerHTML = html;
}

// ═══════════════════════════════════════════
//  RESTART
// ═══════════════════════════════════════════
function restartAssessment() {
  clearDraft();
  S = {empresa:'',consultor:'',contato:'',cargo:'',email:'',telefone:'',data:'',numObras:5,orcamentoMedio:8000000,prazoMedio:18,numObrasRange:'',orcamentoRange:'',tipologia:'',modeloMO:'',momento:'',scores:{b03:0,b06:0,f1:[0,0,0,0,0,0,0,0],f2:[0,0,0,0,0],f3:[0,0,0,0,0,0,0],mo:{},f4:[0,0,0,0,0]},showMO:false,
    roi2:{folha:0,hDiaAtual:0,hSemQualidade:0,fluxoPlanejar:0,fluxoCurto:0,fluxoMedio:0,fluxoReprogramar:0,fluxoMedir:0,fluxoConferir:0,fluxoERP:0,fluxoCruzar:0},
    mensalidade:2000, captura:0.50};
  currentBlock='b0'; currentQIdx=0; currentPhaseIdx=0; phaseOrder=['f1','f2','f3','f4'];
  radarChartInst=null;
  document.getElementById('c-empresa').value='';
  document.getElementById('c-consultor').value='';
  document.getElementById('c-contato').value='';
  if(document.getElementById('c-cargo')) document.getElementById('c-cargo').value='';
  document.getElementById('c-email').value='';
  document.getElementById('c-telefone').value='';
  document.getElementById('progress-fill').style.width='0%';
  showScreen('screen-cover');
}

// ── BRL FORMAT HELPERS ──────────────────────────
function fmtBRL(n) {
  if(!n || isNaN(n)) return '';
  return 'R$ ' + Number(n).toLocaleString('pt-BR');
}

function parseBRL(str) {
  if(!str) return 0;
  // Remove R$, dots (thousand sep), keep comma→dot for decimal
  var clean = str.replace(/R\$\s*/g, '').replace(/\./g, '').replace(',', '.').trim();
  return parseFloat(clean) || 0;
}

function fmtOrcamento(input) {
  // Strip everything except digits
  var raw = input.value.replace(/\D/g, '');
  if(!raw) { input.value = ''; return; }
  var num = parseInt(raw, 10);
  // Format as pt-BR
  input.value = 'R$ ' + num.toLocaleString('pt-BR');
  // Store raw value in dataset for retrieval
  input.dataset.raw = num;
}



// ═══════════════════════════════════════════
//  PDF GENERATION
// ═══════════════════════════════════════════
// Aplica o tema claro / texto escuro (mesma lógica de antes) diretamente sobre
// um container REAL (não um clone de iframe do html2canvas) — usado pela
// captura seção-por-seção do generatePDF.
function applyPdfLightTheme(root) {
  root.style.background = 'white';
  root.style.color = '#1a1a1a';

  root.querySelectorAll('.no-print,.btn-row,.top-nav,#progress-bar').forEach(function(b){
    b.style.display = 'none';
  });

  root.querySelectorAll('.card,.card-wide').forEach(function(c){
    c.style.background = 'white';
    c.style.border = '1px solid #e0e0e0';
    c.style.boxShadow = '0 1px 4px rgba(0,0,0,0.08)';
    c.style.color = '#1a1a1a';
  });

  // Fix ALL text elements — força texto escuro e reforça peso da fonte.
  root.querySelectorAll('p,div,span,li,td,th,h1,h2,h3,h4,h5,label').forEach(function(el) {
    var cs = window.getComputedStyle(el);
    var col = cs.color;
    var fontSize = parseFloat(cs.fontSize) || 0;
    var fontWeight = parseInt(cs.fontWeight, 10) || 400;
    var darkened = false;
    if(col === 'rgb(255, 255, 255)' || col === 'rgba(255, 255, 255, 1)') {
      el.style.color = '#1a1a1a';
      darkened = true;
    } else if(col.indexOf('rgba') >= 0) {
      var parts = col.match(/[\d.]+/g);
      if(parts && parseFloat(parts[3]) < 0.7) {
        el.style.color = '#1a1a1a';
        darkened = true;
      }
    } else {
      var m = col.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
      if(m) {
        var r = +m[1], g = +m[2], b = +m[3];
        if(Math.abs(r-g) < 12 && Math.abs(g-b) < 12 && r > 60 && r < 220) {
          el.style.color = fontSize >= 11 ? '#1a1a1a' : '#444444';
          darkened = true;
        }
      }
    }
    if(darkened && fontSize >= 11 && fontWeight < 500) {
      el.style.fontWeight = '500';
    }
  });

  root.querySelectorAll('[style*="color:var(--orange)"], [style*="color: var(--orange)"]').forEach(function(e){
    e.style.color = '#ff5f1f';
  });

  root.querySelectorAll('*').forEach(function(el) {
    if(el.style && el.style.color && el.style.color.indexOf('var(') >= 0) {
      if(el.style.color.indexOf('orange') >= 0) el.style.color = '#ff5f1f';
      else if(el.style.color.indexOf('gray') >= 0) el.style.color = '#666';
      else el.style.color = '#1a1a1a';
    }
    if(el.style && el.style.background && el.style.background.indexOf('var(') >= 0) {
      el.style.background = 'white';
    }
    if(el.style && el.style.borderColor && el.style.borderColor.indexOf('var(') >= 0) {
      el.style.borderColor = '#e0e0e0';
    }
  });

  root.querySelectorAll('.score-bar').forEach(function(b){
    b.style.background = '#f0f0f0';
  });

  root.querySelectorAll('.rep-sec-title').forEach(function(t){
    t.style.color = '#ff5f1f';
    t.style.borderColor = '#ff5f1f';
  });

  root.querySelectorAll('table td, table th').forEach(function(c){
    c.style.color = '#1a1a1a';
    c.style.borderColor = '#e0e0e0';
  });
}

function generatePDF(fromAdmin) {
  // Build report content first
  if(fromAdmin) {
    buildReport();
  }

  showScreen('screen-report');

  // Show loading indicator
  var loadDiv = document.createElement('div');
  loadDiv.id = 'pdf-loading';
  loadDiv.style.cssText = 'position:fixed;inset:0;background:rgba(20,20,27,0.92);z-index:1000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px';
  loadDiv.innerHTML = '<div style="width:48px;height:48px;border:3px solid rgba(255,255,255,0.1);border-top-color:#ff5f1f;border-radius:50%;animation:spin 0.8s linear infinite"></div>' +
    '<div style="font-family:Bai Jamjuree;font-size:14px;color:white">Gerando PDF...</div>' +
    '<div style="font-size:12px;color:var(--gray2)">Aguarde alguns segundos</div>';
  document.body.appendChild(loadDiv);

  // Add spin animation if not already present
  if(!document.getElementById('spin-style')) {
    var st = document.createElement('style');
    st.id = 'spin-style';
    st.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(st);
  }

  // Wait for render then capture
  setTimeout(function() {
    var reportEl = document.getElementById('screen-report');
    var wrapper = reportEl.querySelector(':scope > div');
    var sections = wrapper ? Array.prototype.slice.call(wrapper.children) : [];

    if(sections.length === 0) {
      document.body.removeChild(loadDiv);
      alert('Erro ao gerar PDF: conteúdo do relatório não encontrado.');
      return;
    }

    // Canvas gigante (a página inteira de uma vez) sai com o texto "borrado/apagado"
    // no html2canvas — é uma limitação de qualidade em canvases muito grandes/altos.
    // Por isso capturamos SEÇÃO POR SEÇÃO (cada card em um canvas pequeno e nítido)
    // e cada grupo de seções que cabe numa página do PDF já nasce como uma página —
    // isso também resolve, de graça, o corte de seção no meio entre páginas.
    var CONTENT_PX_WIDTH = 920; // == max-width do wrapper do relatório
    var jsPDFNS = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    var pdf = new jsPDFNS({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    var pageW = pdf.internal.pageSize.getWidth();
    var pageH = pdf.internal.pageSize.getHeight();
    var margin = 10;
    var contentWMm = pageW - margin * 2;
    var mmPerPx = contentWMm / CONTENT_PX_WIDTH;

    var heightsPx = sections.map(function(s){ return s.getBoundingClientRect().height; });

    // Bin-packing simples: agrupa seções consecutivas até estourar a altura da página.
    var pageGroups = [];
    var cur = [], curHMm = 0;
    for(var i = 0; i < sections.length; i++) {
      var hMm = heightsPx[i] * mmPerPx;
      var availMm = pageGroups.length === 0 ? (pageH - margin - 10) : (pageH - margin - margin);
      if(cur.length > 0 && (curHMm + hMm) > availMm) {
        pageGroups.push(cur);
        cur = [];
        curHMm = 0;
      }
      cur.push(i);
      curHMm += hMm;
    }
    if(cur.length > 0) pageGroups.push(cur);

    var pageIdx = 0;
    var globalPageNum = 0; // numeração real do PDF — inclui a página do Radar antes das seções

    function finish() {
      var empresa = (S.empresa || 'diagnostico').replace(/[^a-zA-Z0-9]/g, '_');
      var data = (S.data || new Date().toISOString().split('T')[0]);
      pdf.save('SIIGA_Assessment_' + empresa + '_' + data + '.pdf');
      document.body.removeChild(loadDiv);
      showToast('PDF gerado com sucesso!');
    }

    function fail(err) {
      document.body.removeChild(loadDiv);
      console.error('PDF error:', err);
      alert('Erro ao gerar PDF. Tente usar o botão Imprimir como alternativa.');
    }

    // Adiciona uma página ao PDF a partir de um canvas já capturado (radar ou seção do relatório).
    function addImagePage(canvas) {
      var imgW = canvas.width, imgH = canvas.height;
      var wMm = contentWMm;
      var hMm = (imgH / imgW) * wMm;
      var imgData = canvas.toDataURL('image/png');

      if(globalPageNum > 0) pdf.addPage();
      pdf.setFillColor(255, 95, 31);
      pdf.rect(0, 0, pageW, globalPageNum === 0 ? 8 : 3, 'F');

      var yPos = globalPageNum === 0 ? 10 : margin;
      pdf.addImage(imgData, 'PNG', margin, yPos, wMm, hMm);

      pdf.setFontSize(7);
      pdf.setTextColor(150, 150, 150);
      pdf.text('SIIGA Assessment · Agilean · Avaliação de Maturidade', margin, pageH - 4);
      pdf.text('Página ' + (globalPageNum + 1), pageW - margin - 15, pageH - 4);

      globalPageNum++;
    }

    function renderPage() {
      if(pageIdx >= pageGroups.length) { finish(); return; }

      var idxList = pageGroups[pageIdx];
      var temp = document.createElement('div');
      temp.style.cssText = 'position:fixed;left:-99999px;top:0;width:' + CONTENT_PX_WIDTH + 'px;background:white;';
      idxList.forEach(function(i){ temp.appendChild(sections[i].cloneNode(true)); });
      document.body.appendChild(temp);
      applyPdfLightTheme(temp);

      html2canvas(temp, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      }).then(function(canvas) {
        document.body.removeChild(temp);
        addImagePage(canvas);
        pageIdx++;
        renderPage();
      }).catch(function(err) {
        if(temp.parentNode) document.body.removeChild(temp);
        fail(err);
      });
    }

    // Radar SIIGA vira a primeira página do PDF — hoje só existia dentro do app,
    // nunca aparecia no relatório exportado. O <canvas> do gráfico precisa virar
    // <img> antes de clonar, porque clonar um canvas não copia o desenho.
    function captureRadarPage() {
      return new Promise(function(resolve) {
        // RADAR_STATE normalmente já existe de quando o usuário passou pela tela
        // do Radar durante o diagnóstico. Recalcula se faltar (ex: PDF gerado
        // direto pelo admin) — a função só precisa rodar, não precisa da tela visível.
        if(!RADAR_STATE && typeof buildAndShowRadar === 'function') {
          try { buildAndShowRadar(); showScreen('screen-report'); } catch(e) {}
        }
        var radarCard = document.querySelector('#screen-radar > .card');
        if(!radarCard || !RADAR_STATE) { resolve(null); return; }

        // Clona o card num container isolado (não mexe na tela ao vivo, nem
        // precisa dela visível). O <canvas> clonado nasce sem desenho — em vez
        // de copiar o bitmap do gráfico escuro do app, desenhamos um gráfico
        // NOVO com cores para fundo branco (o do app usa branco/cinza claro
        // nas grades e rótulos, invisível num PDF de fundo branco).
        var temp = document.createElement('div');
        temp.style.cssText = 'position:fixed;left:-99999px;top:0;width:' + CONTENT_PX_WIDTH + 'px;background:white;';
        var clone = radarCard.cloneNode(true);
        temp.appendChild(clone);
        document.body.appendChild(temp);

        var clonedCanvas = clone.querySelector('#radarChart');
        var tempChart = null;
        if(clonedCanvas) {
          clonedCanvas.removeAttribute('style');
          clonedCanvas.width = 360;
          clonedCanvas.height = 360;
          tempChart = drawRadarChart(clonedCanvas, RADAR_STATE, true);
        }

        applyPdfLightTheme(temp);

        html2canvas(temp, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff'
        }).then(function(canvas) {
          if(tempChart) tempChart.destroy();
          document.body.removeChild(temp);
          resolve(canvas);
        }).catch(function() {
          if(tempChart) tempChart.destroy();
          if(temp.parentNode) document.body.removeChild(temp);
          resolve(null);
        });
      });
    }

    captureRadarPage().then(function(radarCanvas) {
      if(radarCanvas) addImagePage(radarCanvas);
      renderPage();
    });
  }, 400);
}

function generatePDFFromAdmin(id) {
  var list = getAllDiagnosticos();
  var rec = list.find(function(r){ return r.id === id; });
  if(!rec) return;
  S = rec.state;
  generatePDF(true);
}


// ═══════════════════════════════════════════
//  AGENTE CONSULTIVO SIIGA
// ═══════════════════════════════════════════
var API_KEY_STORAGE = 'siiga_api_key';

function getApiKey() {
  return localStorage.getItem(API_KEY_STORAGE) || '';
}

function saveApiKey() {
  var key = document.getElementById('api-key-input').value.trim();
  if(!key || !key.startsWith('sk-ant-')) {
    alert('Insira uma API key válida da Anthropic (começa com sk-ant-)');
    return;
  }
  localStorage.setItem(API_KEY_STORAGE, key);
  closeApiModal();
  runAiAnalysis();
}

function openApiModal() {
  var existingKey = getApiKey();
  if(existingKey) {
    // Key already saved — run directly
    runAiAnalysis();
    return;
  }
  var input = document.getElementById('api-key-input');
  if(input) input.value = '';
  document.getElementById('api-modal').style.display = 'flex';
}

function closeApiModal() {
  document.getElementById('api-modal').style.display = 'none';
}

function toggleConsultorBlock() {
  var block = document.getElementById('ai-consultor-block');
  var icon = document.getElementById('consultor-toggle-icon');
  if(block.style.display === 'none') {
    block.style.display = 'block';
    icon.style.transform = 'rotate(180deg)';
  } else {
    block.style.display = 'none';
    icon.style.transform = 'rotate(0deg)';
  }
}

function buildDiagnosticoJSON() {
  var maxes = {f1:21, f2:12, f3:18, f4:12};

  function pct(arr, max) {
    if(!Array.isArray(arr)) return 0;
    var sum = arr.reduce(function(a,b){return a+(b||0);},0);
    return Math.round((sum/max)*100);
  }

  function nivel(p) {
    if(p < 35) return 'Critico';
    if(p < 60) return 'Em Construcao';
    if(p < 85) return 'Estruturado';
    return 'Avancado';
  }

  var f1pct = pct(S.scores.f1, maxes.f1);
  var f2pct = pct(S.scores.f2, maxes.f2);
  var f3pct = pct(S.scores.f3, maxes.f3);
  var f4pct = pct(S.scores.f4, maxes.f4);

  var moScores = S.scores.mo || {};
  var moEntries = Object.entries ? Object.entries(moScores) : Object.keys(moScores).map(function(k){return [k, moScores[k]];});
  var moSum = moEntries.reduce(function(a,e){return a+(e[1]||0);},0);
  var moMax = moEntries.length * 3;
  var moPct = moMax > 0 ? Math.round((moSum/moMax)*100) : null;

  var totalScore = (S.scores.f1||[]).reduce(function(a,b){return a+(b||0);},0) +
    (S.scores.f2||[]).reduce(function(a,b){return a+(b||0);},0) +
    (S.scores.f3||[]).reduce(function(a,b){return a+(b||0);},0) +
    (S.scores.f4||[]).reduce(function(a,b){return a+(b||0);},0) +
    (S.scores.b03||0) + (S.scores.b06||0);
  var totalMax = 66;

  return {
    cliente: {
      empresa: S.empresa || 'Não informado',
      consultor: S.consultor || '',
      tipologia: S.tipologia || '',
      modeloMO: S.modeloMO || '',
      momento: S.momento || '',
      numObras: S.numObras || 0,
      orcamentoMedio: S.orcamentoMedio || 0,
      prazoMedio: S.prazoMedio || 18,
      pilarPriority: S.pilarPriority || [],
      portfolioTotal: (S.numObras||0) * (S.orcamentoMedio||0),
      estruturaTime: { score: S.scores.b03||0, nivel: nivel((S.scores.b03||0)/3*100) },
      nivelOrcamento: { score: S.scores.b06||0, nivel: nivel((S.scores.b06||0)/3*100) },
      roiReal: { dados: S.roi2 || {}, mensalidade: S.mensalidade||0, captura: S.captura||0.5 }
    },
    fases: {
      fase1: { scores: S.scores.f1||[], somatorio: (S.scores.f1||[]).reduce(function(a,b){return a+(b||0);},0), maximo: maxes.f1, percentual: f1pct, nivel: nivel(f1pct) },
      fase2: { scores: S.scores.f2||[], somatorio: (S.scores.f2||[]).reduce(function(a,b){return a+(b||0);},0), maximo: maxes.f2, percentual: f2pct, nivel: nivel(f2pct) },
      fase3: { scores: S.scores.f3||[], somatorio: (S.scores.f3||[]).reduce(function(a,b){return a+(b||0);},0), maximo: maxes.f3, percentual: f3pct, nivel: nivel(f3pct) },
      fase4: { scores: S.scores.f4||[], somatorio: (S.scores.f4||[]).reduce(function(a,b){return a+(b||0);},0), maximo: maxes.f4, percentual: f4pct, nivel: nivel(f4pct) }
    },
    blocoMO: moPct !== null ? { scores: moScores, somatorio: moSum, maximo: moMax, percentual: moPct, nivel: nivel(moPct) } : null,
    scoreGeral: { total: totalScore, maximo: totalMax, percentual: Math.round((totalScore/totalMax)*100) },
    referencia: {
      perguntas: {
        f1: ['Formalidade do planejamento','Tecnica de planejamento (LB)','Dimensionamento tecnico','Integracao orcamento x planejamento','Acompanhamento da Curva S','Cronograma bancario','Integracao planejamento x suprimentos'],
        f2: ['Lookahead e gestao de restricoes','Antecipacao de riscos de parada','Planejamento de MO no medio prazo','Ciclo de reprogramacao'],
        f3: ['Programacao semanal','Check-out e check-in diario','Rastreabilidade de desvios','Frequencia de coleta do avanco','Qualidade vinculada ao pagamento','Analise intermediaria de MO'],
        f4: ['Reuniao executiva com dados','Maturidade dos indicadores','Pagamento por evidencia']
      }
    }
  };
}

var SYSTEM_PROMPT = `Voce e o Agente Consultor SIIGA da Agilean. Especialista senior em gestao de obras, Lean Construction, Last Planner System, Linha de Balanco e gestao de mao de obra. Voce atua como consultor — nao como vendedor.

POSTURA: Linguagem executiva, pratica, orientada a decisao. Nunca academica. Nunca condescendente. Nao diga "voces estao errados" ou "sua obra e desorganizada". Use: "pelo que voce descreveu...", "e muito comum nesse estagio...", "a principal oportunidade parece estar em...".

PRODUTOS AGILEAN:
- Planejamento e Controle: Linha de Balanco digital, reprogramacoes automatizadas, Curva S fisico-financeira, IDP, gestao de restricoes com IRR, assistente Angelina via WhatsApp. Porta de entrada natural.
- Qualidade: FVS automatica pos-medicao, PPCQ, controle de NCs, vinculo producao x qualidade x pagamento. Pre-requisito: P&C ativo.
- Mao de Obra: folha de producao digital, medicao de empreiteiros integrada, produtividade por funcionario, improdutividade visivel. Pre-requisito: medicoes rodando.
- Integracao ERP: API nativa com Sienge, Mega, UAU.

BENCHMARKS REAIS (use com precisao):
- Media de 10% de reducao de custos operacionais
- Media de 15% de ganho de produtividade no canteiro
- 2x mais aderencia entre planejado e realizado
- Reducao de mais de 50% da carga operacional da equipe tecnica
- Fechamento de folha e medicao: de semanas para horas
- Planejamento e reprogramacao: de meses para horas
- +1.500 canteiros impactados, 70M m2 construidos com Agilean

REGRAS DE DEPENDENCIA (inviolaveis):
1. Fase 1 fraca: priorize planejamento antes de tudo
2. Fase 2 fraca: nao recomende Fase 3 sem lookahead funcionando
3. Fase 3 fraca: dados da Fase 4 sao nao confiaveis
4. Orcamento score 0-1: limite a promessa, diga isso
5. MO propria: foco em folha, improdutividade, estudo de pacotes
6. MO terceirizada: foco em meta por empreiteiro, medicao, qualidade, bloqueios
7. Crescimento: risco de escala sem sistema e o argumento central
8. Consolidacao: ganho de controle, margem e previsibilidade

CLASSIFICACAO POR PERCENTUAL:
- Critico: < 35%
- Em Construcao: 35-59%
- Estruturado: 60-84%
- Avancado/Referencia: 85%+

OBJECOES COMUNS:
"Ja tentamos Last Planner e nao funcionou" -> explore por que nao funcionou: sem suporte, sem dados, sem ferramenta. A Agilean resolve os tres.
"Nossa obra e muito complexa para metodo" -> quanto mais complexa, maior o beneficio. Cite 70M m2 construidos.
"O mestre nao vai aderir" -> autoapontamento via WhatsApp, sem treinamento tecnico.
"Ja temos ERP" -> Agilean nao compete com ERP. E a camada de gestao de producao que alimenta o ERP. Integracoes nativas.

FORMATO DE SAIDA OBRIGATORIO:
Responda em dois blocos claramente separados.

BLOCO_CLIENTE_INICIO
## Diagnostico SIIGA — [nome da empresa]

### Leitura geral
[2 paragrafos consultivos. Sem score numerico. Especifico: cite tipologia, modelo de MO, momento estrategico.]

### Onde esta a maior oportunidade
[1 paragrafo focado no gargalo raiz. Por que esse gap vem antes dos outros. Custo de nao agir.]

### Potencial de resultado
[Use benchmarks reais + dados da operacao. Cite 2-3 referencias maximas. Linguagem de negocio.]

### Os proximos 90 dias
Sprint 1 — Dias 1-30: [o que muda na pratica]
Sprint 2 — Dias 31-60: [o que muda na pratica]
Sprint 3 — Dias 61-90: [o que muda na pratica]

### Uma frase para levar
[1 frase que o cliente consegue repetir para um socio que nao estava na reuniao.]
BLOCO_CLIENTE_FIM

BLOCO_CONSULTOR_INICIO
### Radar de maturidade
| Fase | % | Nivel | Observacao principal |
[preencha com os dados reais]

### Gargalo raiz — justificativa tecnica
[Por que esse gargalo. Dependencias entre fases. O que acontece se nao for resolvido.]

### Porta de entrada recomendada
[Produto especifico + por que agora + o que deixar para depois.]

### O que NAO vender agora
[O que seria prematuro e por que. Protege a implantacao e a reputacao.]

### Objecoes provaveis neste cliente
[2-3 objecoes especificas baseadas no perfil. Para cada uma: argumento de resposta.]

### Riscos de implantacao
[O que pode dificultar. Time, MO, orcamento, momento.]

### Perguntas para a proxima reuniao
[3-5 perguntas que criam urgencia e aprofundam o diagnostico.]
BLOCO_CONSULTOR_FIM`;

function runAiAnalysis() {
  var apiKey = getApiKey();
  if(!apiKey) { openApiModal(); return; }

  // Show AI screen in loading state
  document.getElementById('ai-empresa-name').textContent = S.empresa || 'Empresa';
  document.getElementById('ai-loading').style.display = 'block';
  document.getElementById('ai-content').style.display = 'none';
  document.getElementById('ai-error').style.display = 'none';
  showScreen('screen-ai');

  var diagnostico = buildDiagnosticoJSON();
  var userMsg = 'Analise este diagnostico SIIGA e gere a analise consultiva completa conforme o formato definido:\n\n' + JSON.stringify(diagnostico, null, 2);

  fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMsg }]
    })
  })
  .then(function(res) {
    if(!res.ok) {
      return res.json().then(function(err) {
        throw new Error(err.error ? err.error.message : 'HTTP ' + res.status);
      });
    }
    return res.json();
  })
  .then(function(data) {
    var text = data.content && data.content[0] ? data.content[0].text : '';
    if(!text) throw new Error('Resposta vazia da API');
    renderAiResponse(text);
  })
  .catch(function(err) {
    document.getElementById('ai-loading').style.display = 'none';
    document.getElementById('ai-error').style.display = 'block';
    var msg = err.message || 'Erro desconhecido';
    document.getElementById('ai-error-msg').textContent = 'Erro ao gerar análise';
    if(msg.includes('401') || msg.includes('authentication') || msg.includes('invalid') || msg.includes('api_key')) {
      document.getElementById('ai-error-detail').textContent = 'API key inválida ou expirada. Clique em "Reconfigurar API Key" para inserir uma nova.';
      localStorage.removeItem(API_KEY_STORAGE);
    } else if(msg.includes('blocked') || msg.includes('content') || msg.includes('CSP')) {
      document.getElementById('ai-error-detail').textContent = 'Conteúdo bloqueado pelo browser. Tente abrir o arquivo no Chrome ou Edge e verifique se não há extensões bloqueando requisições externas (ex: uBlock, AdBlock).';
    } else if(msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('CORS') || msg.includes('ERR_')) {
      document.getElementById('ai-error-detail').textContent = 'Não foi possível conectar com a API. Verifique: (1) conexão com internet, (2) se está usando Chrome ou Edge, (3) se não há extensões bloqueando requisições.';
    } else {
      document.getElementById('ai-error-detail').textContent = msg;
    }
  });
}

function renderAiResponse(text) {
  // Parse the two blocks
  var clientStart = text.indexOf('BLOCO_CLIENTE_INICIO');
  var clientEnd = text.indexOf('BLOCO_CLIENTE_FIM');
  var consultorStart = text.indexOf('BLOCO_CONSULTOR_INICIO');
  var consultorEnd = text.indexOf('BLOCO_CONSULTOR_FIM');

  var clientText = clientStart >= 0 && clientEnd >= 0
    ? text.slice(clientStart + 'BLOCO_CLIENTE_INICIO'.length, clientEnd).trim()
    : text;

  var consultorText = consultorStart >= 0 && consultorEnd >= 0
    ? text.slice(consultorStart + 'BLOCO_CONSULTOR_INICIO'.length, consultorEnd).trim()
    : '';

  document.getElementById('ai-client-block').innerHTML = markdownToHtml(clientText);
  document.getElementById('ai-consultor-block').innerHTML = markdownToHtml(consultorText);

  document.getElementById('ai-loading').style.display = 'none';
  document.getElementById('ai-content').style.display = 'block';
}

function markdownToHtml(md) {
  if(!md) return '';
  var lines = md.split('\n');
  var result = '';
  var inUl = false;
  for(var i=0; i<lines.length; i++) {
    var line = lines[i];
    if(line.match(/^### /)) {
      if(inUl){result+='</ul>';inUl=false;}
      result += '<h4 style="font-family:Bai Jamjuree;font-size:15px;font-weight:700;color:var(--orange);margin:20px 0 8px">' + line.replace(/^### /,'') + '</h4>';
    } else if(line.match(/^## /)) {
      if(inUl){result+='</ul>';inUl=false;}
      result += '<h3 style="font-family:Bai Jamjuree;font-size:18px;font-weight:700;margin:16px 0 10px">' + line.replace(/^## /,'') + '</h3>';
    } else if(line.match(/^# /)) {
      if(inUl){result+='</ul>';inUl=false;}
      result += '<h2 style="font-family:Bai Jamjuree;font-size:22px;font-weight:700;margin:0 0 16px">' + line.replace(/^# /,'') + '</h2>';
    } else if(line.match(/^Sprint [0-9]/)) {
      if(inUl){result+='</ul>';inUl=false;}
      result += '<div style="background:rgba(255,95,31,0.08);border-left:3px solid var(--orange);padding:10px 14px;border-radius:0 6px 6px 0;margin:10px 0"><strong style="color:var(--orange)">' + inlineFmt(line) + '</strong></div>';
    } else if(line.match(/^[-•] /)) {
      if(!inUl){result+='<ul style="list-style:none;padding:0;margin:10px 0">';inUl=true;}
      result += '<li style="margin-bottom:6px;padding-left:16px;position:relative;color:rgba(255,255,255,0.85)"><span style="position:absolute;left:0;color:var(--orange)">→</span>' + inlineFmt(line.replace(/^[-•] /,'')) + '</li>';
    } else if(line.match(/^\|/)) {
      if(inUl){result+='</ul>';inUl=false;}
      if(line.match(/^\|[\s\-:]+\|/)) continue;
      var cells = line.split('|').filter(function(c){return c.trim();});
      result += '<tr>' + cells.map(function(c){return '<td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.06);font-size:12px">' + inlineFmt(c.trim()) + '</td>';}).join('') + '</tr>';
    } else if(line.trim() === '') {
      if(inUl){result+='</ul>';inUl=false;}
      result += '<br>';
    } else {
      if(inUl){result+='</ul>';inUl=false;}
      result += '<p style="margin:6px 0;line-height:1.7">' + inlineFmt(line) + '</p>';
    }
  }
  if(inUl) result += '</ul>';
  // Wrap table rows
  result = result.replace(/(<tr>[\s\S]*?<\/tr>)/g, function(m){
    return '<table style="width:100%;border-collapse:collapse;margin:12px 0">' + m + '</table>';
  });
  return result;
}

function inlineFmt(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em style="color:var(--gray2)">$1</em>');
}


function loadAndAnalyze(id) {
  var list = getAllDiagnosticos();
  var rec = list.find(function(r){ return r.id === id; });
  if(!rec) return;
  S = rec.state;
  buildAndShowRadar();
  setTimeout(function(){ runAiAnalysis(); }, 200);
}


// ═══════════════════════════════════════════
//  AHA-HA POTENCIAL DE GANHO
// ═══════════════════════════════════════════

var AHA_DETAILS = {
  time: {
    title: 'Otimização do Time de Gestão',
    icon: '⏱',
    color: '#60a5fa',
    desc: 'Com base em dados de empresas que implementaram o SIIGA, as rotinas de gestão são drasticamente otimizadas, liberando tempo e recursos para atividades estratégicas.',
    rotinas: [
      'Medição Semanal de Avanços',
      'Atualização de Indicadores de Longo, Médio e Curto Prazo',
      'Reprogramação e Elaboração de Plano de Ação',
      'Folha de Pagamento e Medição de Empreiteiros — Técnico',
      'Folha de Pagamento e Medição de Empreiteiros — Gestor',
      'Distribuição dos Pacotes de Trabalho no Canteiro',
      'Rotinas de Qualidade Automáticas e Integradas com Medição'
    ]
  },
  retrabalho: {
    title: 'Redução de Retrabalhos',
    icon: '🔧',
    color: '#f87171',
    desc: 'Dados de mercado indicam que de 10% a 15% do custo de uma obra é desperdiçado com retrabalhos. O SIIGA tem potencial de reduzir pelo menos 40% desse custo — número conservador, com relatos de até 80% em casos documentados.',
    formula: 'Orçamento × 10% (retrabalho médio de mercado) × 40% (redução conservadora com SIIGA)'
  },
  velocidade: {
    title: 'Ganho em Velocidade de Produção',
    icon: '🚀',
    color: '#34d399',
    desc: 'As rotinas, tecnologia e metodologia do SIIGA permitem um aumento significativo na velocidade de produção. Números de mercado e cases da Agilean comprovam aumentos de até 10% na velocidade de entrega. Calculamos apenas os custos proporcionais ao tempo — equipe, equipamentos e custos fixos de canteiro.',
    formula: 'Orçamento × 10% (redução de prazo) × 15% (custos proporcionais ao tempo)'
  },
  mo: {
    title: 'Redução de Estouro no Custo de MO',
    icon: '👷',
    color: '#fb923c',
    desc: 'Dados de mercado e histórico de obras mostram que o custo de mão de obra estoura em média 15% acima do orçado, principalmente por improdutividade não identificada a tempo. O SIIGA permite identificar e corrigir esse desvio ao longo da obra — não apenas no fechamento.',
    formula: 'Orçamento × 45% (participação de MO) × 15% (estouro médio) × 70% (redução com SIIGA)'
  },
  erros: {
    title: 'Erros de Medição e Folha de Produção',
    icon: '📋',
    color: '#a78bfa',
    desc: 'Erros de aferição, fórmulas inconsistentes e falta de segurança em planilhas geram desvios médios de 2% no custo de mão de obra. Com o SIIGA, o fechamento passa a ser baseado em evidência digital — eliminando esses desvios.',
    formula: 'Orçamento × 45% (custo de MO) × 2% (desvio médio de planilhas)'
  }
};

function showAhaScreen() {
  document.getElementById('aha-anchor').style.display = 'block';
  document.getElementById('aha-reveal').style.display = 'none';
  showScreen('screen-aha');
}

function revealAha(guess) {
  var roi = calculateROI();
  var perObra = roi.totalPorObra;
  var total   = roi.totalPortfolio;
  var obras   = S.numObras || 5;

  // Anchor contrast message
  var contrastMsg = '';
  if(guess === 'low') {
    contrastMsg = perObra < 500000
      ? 'Você estava certo — e isso já representa uma perda relevante. 💡'
      : 'Você está perdendo <strong style="color:var(--orange)">' + fmtNum(perObra) + ' por obra</strong> — mais do que você imaginou.';
  } else if(guess === 'mid') {
    contrastMsg = perObra >= 500000 && perObra <= 2000000
      ? 'Você estava na faixa certa! Você está perdendo <strong style="color:var(--orange)">' + fmtNum(perObra) + ' por obra</strong>. 🎯'
      : perObra < 500000
        ? 'Você está perdendo <strong style="color:var(--orange)">' + fmtNum(perObra) + ' por obra</strong> — conservador, mas real.'
        : 'Acima do que você imaginou: você está perdendo <strong style="color:var(--orange)">' + fmtNum(perObra) + ' por obra</strong>. 🔥';
  } else {
    contrastMsg = perObra >= 2000000
      ? 'Você sabia que era grande. Nossa estimativa confirma: você está perdendo <strong style="color:var(--orange)">' + fmtNum(perObra) + ' por obra</strong>. 🔥'
      : 'Você está perdendo <strong style="color:var(--orange)">' + fmtNum(perObra) + ' por obra</strong> — um número conservador mas concreto.';
  }
  document.getElementById('aha-contrast-text').innerHTML = contrastMsg;

  // Build components
  var compsHtml = '';
  var delay = 0;
  roi.items.forEach(function(item) {
    var key = item.key;
    var detail = AHA_DETAILS[key] || {};
    var rotulaDesc = detail.formula
      ? '<div style="font-size:11px;color:var(--gray2);margin-top:2px">' + item.basis + '</div>'
      : '';

    var fatorPct = Math.round((item.fator || 1) * 100);
    var fatorColor = fatorPct >= 80 ? '#f87171' : fatorPct >= 50 ? '#fb923c' : '#34d399';
    compsHtml += '<div class="aha-comp" style="animation-delay:' + delay + 'ms">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px">' +
        '<div style="display:flex;align-items:center;gap:10px;flex:1">' +
          '<div style="width:34px;height:34px;border-radius:8px;background:' + (detail.color||'var(--orange)') + '22;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:16px">' + (detail.icon||'💰') + '</div>' +
          '<div>' +
            '<div style="font-size:13px;font-weight:600">' + item.label + '</div>' +
            rotulaDesc +
          '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:10px;flex-shrink:0">' +
          '<div style="text-align:right">' +
            '<div class="aha-num">' + fmtNum(item.porObra) + '</div>' +
            '<div style="font-size:10px;color:' + fatorColor + ';margin-top:2px">' + fatorPct + '% de captura</div>' +
          '</div>' +
          '<button class="aha-expand-btn" onclick="toggleAhaDetail(this)">▼ ver mais</button>' +
        '</div>' +
      '</div>' +
      '<div class="aha-expand-detail">' +
        (detail.desc || '') +
        (detail.rotinas ? '<ul style="margin-top:8px;padding-left:16px">' + detail.rotinas.map(function(r){return '<li style="margin-bottom:3px">'+r+'</li>';}).join('') + '</ul>' : '') +
        '<div style="margin-top:8px;padding:6px 10px;background:rgba(0,0,0,0.2);border-radius:4px;font-size:10px;color:rgba(255,255,255,0.4)">' +
          'Fator de captura: <strong style="color:' + fatorColor + '">' + fatorPct + '%</strong> — ' +
          'Potencial teórico: ' + fmtNum(item.baseValue||item.porObra) + ' · Com maturidade atual: ' + fmtNum(item.porObra) +
        '</div>' +
      '</div>' +
    '</div>';
    delay += 120;
  });

  document.getElementById('aha-components').innerHTML = compsHtml;
  document.getElementById('aha-per-obra').textContent = fmtNum(perObra);
  document.getElementById('aha-per-obra-sm').textContent = fmtNum(perObra);
  document.getElementById('aha-nobs').textContent = obras + (obras === 1 ? ' obra' : ' obras');
  document.getElementById('aha-total').textContent = fmtNum(total);
  document.getElementById('aha-multiplier-text').textContent = 'Sua operação tem ' + obras + (obras===1?' obra':' obras') + '. A perda total estimada no portfólio é:';

  // Qualitative gains — 6 items in 3-col grid
  var quals = [
    {icon:'🎯', text:'Previsibilidade de prazo e custo'},
    {icon:'📊', text:'Decisões baseadas em dado real'},
    {icon:'🔍', text:'Antecipação antes do problema'},
    {icon:'✅', text:'Qualidade integrada à produção'},
    {icon:'📈', text:'Escala sem crescer headcount'},
    {icon:'🏆', text:'Método replicável em todas as obras'},
  ];
  document.getElementById('aha-qualitative').innerHTML = quals.map(function(q){
    return '<div style="display:flex;align-items:center;gap:8px;font-size:12px;color:rgba(255,255,255,0.6);padding:10px 12px;background:rgba(255,255,255,0.025);border-radius:8px;border:1px solid rgba(255,255,255,0.06)">' +
      '<span style="font-size:16px;flex-shrink:0">' + q.icon + '</span>' +
      '<span style="line-height:1.4">' + q.text + '</span></div>';
  }).join('');

  // Update subtotal
  var sub = document.getElementById('aha-subtotal');
  if(sub) sub.textContent = fmtNum(perObra);

  // Show reveal
  document.getElementById('aha-anchor').style.display = 'none';
  document.getElementById('aha-reveal').style.display = 'block';
}

function toggleAhaDetail(btn) {
  var detail = btn.closest('.aha-comp').querySelector('.aha-expand-detail');
  var isOpen = detail.style.display === 'block';
  detail.style.display = isOpen ? 'none' : 'block';
  btn.textContent = isOpen ? '▼ ver mais' : '▲ fechar';
}


function switchAdminTab(tab) {
  ['diag','maturidade','ganhos'].forEach(function(t) {
    document.getElementById('admin-tab-' + t).style.display = (t === tab) ? 'block' : 'none';
    var btn = document.getElementById('tab-' + t);
    if(btn) btn.classList.toggle('active', t === tab);
  });
}


// ═══════════════════════════════════════════
//  AUTO-SAVE DRAFT (incremental)
// ═══════════════════════════════════════════
var DRAFT_KEY = 'siiga_draft';

function saveDraft() {
  try {
    var draft = {
      ts: Date.now(),
      state: JSON.parse(JSON.stringify(S)),
      currentBlock: currentBlock,
      currentPhaseIdx: currentPhaseIdx,
      currentQIdx: currentQIdx,
      phaseOrder: phaseOrder.slice(),
      focusedPilar: focusedPilar,
      focusedQIdx: focusedQIdx,
      selectedPilars: selectedPilars.slice()
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    showDraftIndicator();
  } catch(e) {}
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
  var ind = document.getElementById('draft-indicator');
  if(ind) ind.style.display = 'none';
}

function getDraft() {
  try {
    var d = localStorage.getItem(DRAFT_KEY);
    return d ? JSON.parse(d) : null;
  } catch(e) { return null; }
}

function showDraftIndicator() {
  var ind = document.getElementById('draft-indicator');
  if(ind) {
    ind.textContent = '✓ salvo';
    ind.style.display = 'inline-flex';
    setTimeout(function(){ ind.style.opacity='0'; }, 2000);
    setTimeout(function(){ ind.style.opacity='1'; ind.textContent=''; }, 2600);
  }
}

function checkAndOfferResume() {
  var draft = getDraft();
  if(!draft || !draft.state || !draft.state.empresa) return;
  var age = Date.now() - draft.ts;
  if(age > 7 * 24 * 60 * 60 * 1000) { clearDraft(); return; } // older than 7 days

  var banner = document.getElementById('resume-banner');
  var info   = document.getElementById('resume-info');
  if(!banner || !info) return;

  var dt = new Date(draft.ts);
  var dtStr = dt.getDate()+'/'+(dt.getMonth()+1)+'/'+dt.getFullYear()+' às '+
    dt.getHours()+':'+(dt.getMinutes()<10?'0':'')+dt.getMinutes();
  info.textContent = (draft.state.empresa || 'diagnóstico') + ' — iniciado em ' + dtStr;
  banner.style.display = 'flex';
}

function resumeDraft() {
  var draft = getDraft();
  if(!draft) return;

  // Restore full state
  S = draft.state;
  currentBlock    = draft.currentBlock    || 'b0';
  currentPhaseIdx = draft.currentPhaseIdx || 0;
  currentQIdx     = draft.currentQIdx     || 0;
  if(draft.phaseOrder) phaseOrder = draft.phaseOrder;
  if(draft.focusedPilar) focusedPilar = draft.focusedPilar;
  if(draft.focusedQIdx !== undefined) focusedQIdx = draft.focusedQIdx;
  if(draft.selectedPilars) selectedPilars = draft.selectedPilars;

  // Repopulate cover fields
  if(document.getElementById('c-empresa')) {
    document.getElementById('c-empresa').value  = S.empresa  || '';
    document.getElementById('c-consultor').value = S.consultor || '';
    document.getElementById('c-contato').value  = S.contato  || '';
    document.getElementById('c-cargo').value    = S.cargo    || '';
    document.getElementById('c-email').value    = S.email    || '';
    document.getElementById('c-telefone').value = S.telefone || '';
    if(document.getElementById('c-data')) document.getElementById('c-data').value = S.data || '';
  }

  // Navigate to where the user was
  document.getElementById('resume-banner').style.display = 'none';
  if(currentBlock === 'b0') {
    startAssessment();
  } else if(currentBlock === 'transition') {
    showScreen('screen-transition');
  } else if(currentBlock === 'phase') {
    renderPhaseQ();
    showScreen('screen-phase');
  } else if(currentBlock === 'focused') {
    renderFocusedQ();
    showScreen('screen-focused');
  } else {
    startAssessment();
  }
  showToast('Diagnóstico retomado!');
}

function discardDraft() {
  clearDraft();
  document.getElementById('resume-banner').style.display = 'none';
}

// ═══════════════════════════════════════════
//  ADMIN / PERSISTENCE
// ═══════════════════════════════════════════
var STORAGE_KEY = 'siiga_diagnosticos';

function getAllDiagnosticos() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch(e) { return []; }
}

function saveDiagnosticos(list) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch(e) {}
}

function autoSave() {
  // Called after radar is built — prompt to save
  var suggestedName = S.empresa + (S.empresa ? ' — ' : '') + formatDate(S.data || new Date().toISOString().split('T')[0]);
  document.getElementById('save-nome').value = suggestedName;
  document.getElementById('save-modal').style.display = 'flex';
}

function closeSaveModal() {
  document.getElementById('save-modal').style.display = 'none';
}

async function confirmSave() {
  var nome = document.getElementById('save-nome').value.trim() || 'Diagnóstico sem nome';
  var list = getAllDiagnosticos();
  var maxes = {f1:21,f2:12,f3:18,f4:12};
  var totalMax = 21+12+18+12+3+3;
  var totalScore = ['f1','f2','f3','f4'].reduce(function(acc,k) {
    var arr = S.scores[k];
    if(!Array.isArray(arr)) return acc;
    return acc + arr.reduce(function(a,b){return a+(b||0);},0);
  },0) + (S.scores.b03||0) + (S.scores.b06||0);

  var record = {
    id: Date.now(),
    nome: nome,
    empresa: S.empresa,
    consultor: S.consultor,
    contato: S.contato,
    cargo: S.cargo || '',
    email: S.email || '',
    telefone: S.telefone || '',
    data: S.data || new Date().toISOString().split('T')[0],
    modeloMO: S.modeloMO,
    numObras: S.numObras,
    orcamentoMedio: S.orcamentoMedio,
    totalScore: totalScore,
    totalMax: totalMax,
    nivel: levelFromPct(totalScore/totalMax),
    scores: JSON.parse(JSON.stringify(S.scores)),
    state: JSON.parse(JSON.stringify(S))
  };
  list.unshift(record); // newest first
  saveDiagnosticos(list);
  closeSaveModal();
  clearDraft();

  // Enviar para o Supabase
  if(sbClient) {
    try {
      const { data, error } = await sbClient.from('assessments').insert([{
        id: record.id,
        nome: record.nome,
        empresa: record.empresa,
        consultor: record.consultor,
        contato: record.contato,
        cargo: record.cargo,
        email: record.email,
        telefone: record.telefone,
        data: record.data,
        modelo_mo: record.modeloMO,
        num_obras: record.numObras,
        orcamento_medio: record.orcamentoMedio,
        total_score: record.totalScore,
        total_max: record.totalMax,
        nivel: record.nivel,
        scores: record.scores,
        state: record.state
      }]);
      if(error) {
        console.error("Erro ao salvar no Supabase:", error);
      } else {
        console.log("Salvo no Supabase com sucesso!");
      }
    } catch(err) {
      console.error("Erro ao conectar com Supabase:", err);
    }
  }

  showToast('Diagnóstico salvo com sucesso!');
}

function showToast(msg) {
  var t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#34d399;color:#14141b;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:700;z-index:600;font-family:Bai Jamjuree;box-shadow:0 4px 16px rgba(0,0,0,0.3)';
  document.body.appendChild(t);
  setTimeout(function(){ t.style.opacity='0'; t.style.transition='opacity 0.5s'; }, 2000);
  setTimeout(function(){ document.body.removeChild(t); }, 2600);
}

function formatDate(d) {
  if(!d) return '';
  var parts = d.split('-');
  if(parts.length === 3) return parts[2]+'/'+parts[1]+'/'+parts[0];
  return d;
}

function showAdminPanel() {
  renderAdminList();
  showScreen('screen-admin');
}

function renderAdminList() {
  var list = getAllDiagnosticos();
  var container = document.getElementById('admin-list');
  var empty = document.getElementById('admin-empty');
  if(list.length === 0) {
    container.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  var levelColors = {'Reativo':'#f87171','Em Construção':'#fb923c','Estruturado':'#60a5fa','Referência SIIGA':'#34d399'};
  var html = '';
  list.forEach(function(rec) {
    var pct = Math.round((rec.totalScore/rec.totalMax)*100);
    var col = levelColors[rec.nivel] || '#aaa';
    html += '<div style="background:var(--black2);border:1px solid rgba(255,255,255,0.07);border-radius:var(--r);padding:20px 24px;margin-bottom:12px;display:flex;align-items:center;gap:20px">' +
      '<div style="width:52px;height:52px;border-radius:50%;background:'+col+'22;border:2px solid '+col+';display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
        '<span style="font-family:Bai Jamjuree;font-size:14px;font-weight:700;color:'+col+'">'+pct+'%</span>' +
      '</div>' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-family:Bai Jamjuree;font-size:16px;font-weight:700;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+rec.nome+'</div>' +
        '<div style="font-size:12px;color:var(--gray2)">' +
          (rec.empresa ? rec.empresa+' · ' : '') +
          'Consultor: '+rec.consultor+' · '+formatDate(rec.data) +
          ' · MO: '+(rec.modeloMO||'—') +
        '</div>' +
        '<div style="font-size:11px;margin-top:4px;color:'+col+'">'+rec.nivel+' · Score: '+rec.totalScore+'/'+rec.totalMax+'</div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;flex-shrink:0">' +
        '<button onclick="loadDiagnostico('+rec.id+')" class="btn btn-p" style="font-size:11px;padding:7px 14px">📊 Ver relatório</button>' +
        '<button onclick="loadAndAnalyze('+rec.id+')" style="background:linear-gradient(135deg,#ff5f1f,#e03d00);color:white;border:none;padding:7px 14px;border-radius:6px;cursor:pointer;font-size:11px;font-family:Bai Jamjuree;font-weight:700">🤖 IA</button>' +
        '<button onclick="generatePDFFromAdmin('+rec.id+')" style="background:#1B4F8A;color:white;border:none;padding:7px 14px;border-radius:6px;cursor:pointer;font-size:11px;font-family:Bai Jamjuree;font-weight:700">📄 PDF</button>' +
        '<button onclick="exportDiagnostico('+rec.id+')" class="btn btn-s" style="font-size:11px;padding:7px 14px">⬇ JSON</button>' +
        '<button onclick="deleteDiagnostico('+rec.id+')" style="background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.3);color:#f87171;padding:7px 10px;border-radius:6px;cursor:pointer;font-size:11px">✕</button>' +
      '</div>' +
    '</div>';
  });
  container.innerHTML = html;
}

function loadDiagnostico(id) {
  var list = getAllDiagnosticos();
  var rec = list.find(function(r){ return r.id === id; });
  if(!rec) return;
  // Restore full state
  S = rec.state;
  // Rebuild radar and show report
  buildAndShowRadar();
  setTimeout(function(){ showReport(); }, 100);
}

function deleteDiagnostico(id) {
  if(!confirm('Excluir este diagnóstico? Esta ação não pode ser desfeita.')) return;
  var list = getAllDiagnosticos().filter(function(r){ return r.id !== id; });
  saveDiagnosticos(list);
  renderAdminList();
  showToast('Diagnóstico excluído.');
}

function exportDiagnostico(id) {
  var list = getAllDiagnosticos();
  var rec = list.find(function(r){ return r.id === id; });
  if(!rec) return;
  // Public export: only business-relevant fields, no internal scoring weights
  var publicRec = {
    id: rec.id,
    nome: rec.nome,
    empresa: rec.empresa,
    contato: rec.contato,
    cargo: rec.cargo || '',
    email: rec.email || '',
    telefone: rec.telefone || '',
    consultor: rec.consultor,
    data: rec.data,
    modeloMO: rec.modeloMO,
    numObras: rec.numObras,
    orcamentoMedio: rec.orcamentoMedio,
    prazoMedio: rec.prazoMedio || 18,
    totalScore: rec.totalScore,
    totalMax: rec.totalMax,
    nivel: rec.nivel,
    // Phase levels only — no raw scores or internal weights
    fases: {
      fase1: { nivel: rec.scores && rec.scores.f1 ? levelFromPct(rec.scores.f1.reduce(function(a,b){return a+(b||0);},0)/21) : '—' },
      fase2: { nivel: rec.scores && rec.scores.f2 ? levelFromPct(rec.scores.f2.reduce(function(a,b){return a+(b||0);},0)/12) : '—' },
      fase3: { nivel: rec.scores && rec.scores.f3 ? levelFromPct(rec.scores.f3.reduce(function(a,b){return a+(b||0);},0)/18) : '—' },
      fase4: { nivel: rec.scores && rec.scores.f4 ? levelFromPct(rec.scores.f4.reduce(function(a,b){return a+(b||0);},0)/12) : '—' }
    }
  };
  var blob = new Blob([JSON.stringify(publicRec, null, 2)], {type:'application/json'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'SIIGA_' + (rec.empresa||'diagnostico').replace(/[^a-zA-Z0-9]/g,'_') + '_' + rec.data + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importDiagnostico(input) {
  var file = input.files[0];
  if(!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var rec = JSON.parse(e.target.result);
      if(!rec.id || !rec.state) { alert('Arquivo inválido ou corrompido.'); return; }
      var list = getAllDiagnosticos();
      // Avoid duplicates by id
      var exists = list.findIndex(function(r){ return r.id === rec.id; });
      if(exists >= 0) {
        if(!confirm('Este diagnóstico já existe. Deseja substituí-lo?')) return;
        list[exists] = rec;
      } else {
        list.unshift(rec);
      }
      saveDiagnosticos(list);
      renderAdminList();
      showToast('Diagnóstico importado com sucesso!');
    } catch(err) { alert('Erro ao importar: arquivo inválido.'); }
  };
  reader.readAsText(file);
  input.value = '';
}

// Init
checkAndOfferResume();
if(document.getElementById('c-data')) document.getElementById('c-data').value = new Date().toISOString().split('T')[0];
