/**
 * Parser de movimentações processuais
 * Identifica códigos de pagamento, ofício requisitório, gravames
 */

const CODIGOS_PAGAMENTO = {
  12217: 'DEPOSITO_EFETUADO',
  12218: 'DEPOSITO_PARCIAL',
  12282: 'EXPEDIDA_CERTIFICADA',
  12287: 'EXPEDIDA_CERTIFICADA',
};

const CODIGOS_OFICIO = {
  60: 'EXPEDICAO_DOCUMENTO',
  581: 'DOCUMENTO',
};

const CODIGOS_RELEVANTES = {
  85: 'PETICAO',
  51: 'CONCLUSAO',
  22: 'DESPACHO',
  848: 'REDISTRIBUICAO',
  11009: 'CERTIDAO',
  11010: 'MERO_EXPEDIENTE',
  1051: 'DECURSO_PRAZO',
  246: 'TRANSITO_JULGADO',
  219: 'PROCEDENCIA',
  220: 'IMPROCEDENCIA',
  132: 'RECEBIMENTO',
  982: 'REMESSA',
  123: 'REMESSA_RECURSO',
  26: 'DISTRIBUICAO',
  981: 'RECEBIMENTO',
  785: 'TUTELA_ANTECIPADA',
  787: 'GRATUIDADE_JUSTICA',
};

const TERMOS_PAGAMENTO = [
  'depósito', 'deposito', 'alvará', 'alvara', 'levantamento',
  'transferência', 'transferencia', 'pagamento', 'liberação', 'liberacao',
  'saque', 'banco do brasil', 'caixa econômica', 'caixa economica',
  'ordem bancária', 'ordem bancaria',
];

const TERMOS_GRAVAME = [
  'penhora', 'bloqueio', 'indisponibilidade', 'arresto',
  'sequestro', 'constrição', 'constricao', 'bacenjud', 'sisbajud',
];

const TERMOS_OFICIO = [
  'ofício requisitório', 'oficio requisitorio', 'requisição de pagamento',
  'requisicao de pagamento', 'precatório expedido', 'precatorio expedido',
];

function analisarMovimentacoes(movimentacoes) {
  const resultado = {
    total_movimentacoes: movimentacoes.length,
    status_pagamento: 'PENDENTE',
    data_pagamento: null,
    oficio_requisitorio: null,
    gravames: [],
    movimentacoes_pagamento: [],
    movimentacoes_oficio: [],
    movimentacoes_gravame: [],
    primeira_movimentacao: null,
    ultima_movimentacao: null,
  };

  if (!movimentacoes.length) return resultado;

  resultado.primeira_movimentacao = movimentacoes[movimentacoes.length - 1].dataHora || null;
  resultado.ultima_movimentacao = movimentacoes[0].dataHora || null;

  for (const mov of movimentacoes) {
    const codigo = mov.codigo || 0;
    const nome = (mov.nome || '').toLowerCase();
    const complementos = (mov.complementosTabelados || []).map(c => (c.nome || '').toLowerCase()).join(' ');
    const textoCompleto = nome + ' ' + complementos;
    const dataHora = mov.dataHora || '';

    // Detectar pagamento
    if (CODIGOS_PAGAMENTO[codigo] || TERMOS_PAGAMENTO.some(t => textoCompleto.includes(t))) {
      resultado.movimentacoes_pagamento.push({ codigo, nome: mov.nome, dataHora, tipo: CODIGOS_PAGAMENTO[codigo] || 'TERMO_PAGAMENTO' });
      if (resultado.status_pagamento === 'PENDENTE') {
        resultado.status_pagamento = 'PAGO';
        resultado.data_pagamento = dataHora;
      }
    }

    // Detectar ofício requisitório
    if (CODIGOS_OFICIO[codigo] || TERMOS_OFICIO.some(t => textoCompleto.includes(t))) {
      resultado.movimentacoes_oficio.push({ codigo, nome: mov.nome, dataHora });
      if (!resultado.oficio_requisitorio) {
        resultado.oficio_requisitorio = { dataHora, descricao: mov.nome };
      }
    }

    // Detectar gravames
    if (TERMOS_GRAVAME.some(t => textoCompleto.includes(t))) {
      resultado.movimentacoes_gravame.push({ codigo, nome: mov.nome, dataHora });
      resultado.gravames.push({ tipo: mov.nome, dataHora });
    }
  }

  // Refinar status
  if (resultado.movimentacoes_pagamento.length > 0) {
    const temAlvara = resultado.movimentacoes_pagamento.some(m =>
      (m.nome || '').toLowerCase().includes('alvará') || (m.nome || '').toLowerCase().includes('alvara')
    );
    if (temAlvara) resultado.status_pagamento = 'SAQUE_DISPONIVEL';
  }

  return resultado;
}

module.exports = { analisarMovimentacoes, CODIGOS_PAGAMENTO, TERMOS_PAGAMENTO, TERMOS_GRAVAME };
