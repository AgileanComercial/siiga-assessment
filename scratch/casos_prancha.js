// Casos de respostas do questionário (os mesmos de test_relatorio_prancha.js) para os testes da proposta.
const CASES = {
  // Construtora PCL (call answers; same as test_gaps_ancora.js)
  pcl: {
    empresa: 'Construtora PCL', contato: 'Thiago Toscano', cargo: 'Sócio', consultor: 'Adailton',
    obras: '1', prazo: '15', orcamento: '3.500.000', b0: { tipologia: 'vert', b03: '0', modeloMO: 'mista', momento: 'crescimento' },
    ferr: { planejamento: 'Excel', medicao: 'Excel', qualidade: 'Excel' }, erp: '',
    resp: { 'F1.1':1.5,'F1.2':0,'F1.3':0,'F1.4':1.5,'F1.6':3,'F1.7':0,'F1.5':1.5,'F2.1':3,'F2.2':1.5,'F2.3':1.5,
      'F3.1':1,'F3.2':0,'F3.3':1.5,'F3.4':1.5,'F3.5':0,'F4.1':1,'F4.2':1,'F4.3':1,'F4.4':1,
      'MO.1':1.5,'MO.2':1,'MO.3':0,'MO.4':1.5,'MO.5':1.5,'MO.6':1,'MO.7':1.5 },
    dores: { 'F4.3':'o custo sou eu que compilo', 'MO.6':'a gente avisa o empreiteiro pelo WhatsApp' },
    folha: '100.000', horas: [16, 24, 32, 16, 32]
  },
  // Second case: outsourced labor, no ERP, other company name (no article), other term
  terc: {
    empresa: 'Horizonte Engenharia', contato: 'Marina Lopes', cargo: 'Diretor', consultor: 'Israel Chacon',
    obras: '3', prazo: '24', orcamento: '12.000.000', b0: { tipologia: 'com', b03: '1', modeloMO: 'terceirizada', momento: 'consolidacao' },
    ferr: { planejamento: 'MS Project', medicao: 'Planilha própria', qualidade: 'Papel', contratos: 'Excel' }, erp: 'nenhum',
    resp: { 'F1.1':3,'F1.2':1,'F1.3':1.5,'F1.4':0,'F1.6':1,'F1.7':1.5,'F1.5':0,'F2.1':1,'F2.2':0,'F2.3':1.5,
      'F3.1':1.5,'F3.2':1,'F3.3':0,'F3.4':0,'F3.5':1.5,'F4.1':1.5,'F4.2':3,'F4.3':0,'F4.4':1,
      'MO.5':0,'MO.6':1.5,'MO.7':1 },
    dores: { 'F3.4':'a gente paga o empreiteiro e depois descobre o retrabalho' },
    folha: null, horas: [24, 30, 50, 20, 26]
  }
};
// PCL with a star on an alert point (F3.4 = 1.5, becomes priority 4) and on a structured point (F2.1 = 3, tool warning)
CASES.pcl2 = Object.assign({}, CASES.pcl, { dores: Object.assign({}, CASES.pcl.dores, { 'F3.4':'a gente paga o empreiteiro e depois descobre o retrabalho', 'F2.1':'a gente sempre corre atrás de material' }) });
// PCL with own labor only (Phase III = Folha de Produção, 90 days)
CASES.prop = Object.assign({}, CASES.pcl, { b0: Object.assign({}, CASES.pcl.b0, { modeloMO: 'propria' }) });
// PCL with the vendedor's adjustment from the Conferência screen: priority 3 (Estouro de MO, MO.3) taken out of the priorities
CASES.ajuste = Object.assign({}, CASES.pcl, { ajustes: { travados: [], excluidos: ['MO.3'] }, prioFontes: ['retrabalho', 'time', 'erros'] });
// PCL without hours informed on the horas screen (Israel's pilot case): time source falls back to the market reference
CASES.semhoras = Object.assign({}, CASES.pcl, { consultor: 'Israel Chacon', horas: null });

// 5 prioridades: PCL com ★ em F3.4 (alerta), F1.2 e F3.5 além das duas do PCL
CASES.p5 = Object.assign({}, CASES.pcl, { dores: Object.assign({}, CASES.pcl.dores, { 'F3.4':'a gente paga o empreiteiro e depois descobre o retrabalho', 'F1.2':'o cronograma nasce de estimativa', 'F3.5':'cada engenheiro usa um painel diferente' }) });

module.exports = CASES;
