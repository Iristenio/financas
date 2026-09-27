// Configuração inicial — execute a função configurar() no editor do Apps Script
// (na primeira vez e sempre que acrescentar uma entidade nova no ESQUEMA).
// Cria (ou reaproveita) a planilha, prepara as abas e mostra o código de conexão de cada pessoa.

/**
 * ► PREENCHA com o endereço público da implantação (termina em /exec).
 *   Obtenha com: npx @google/clasp list-deployments  → https://script.google.com/macros/s/<ID>/exec
 *   (ScriptApp.getService().getUrl() no editor devolve o endereço de TESTE /dev, que exige login.)
 */
var URL_PUBLICA = 'https://script.google.com/macros/s/AKfycbwgfSFhhu2wjMhRuRiUSBzGTg5PMdG2me0W_ckKhwE4m73LsWr5io1xWO3Oyq2olAbYCw/exec';
var NOME_PLANILHA = 'Finanças - dados';

/** Quem pode sincronizar: cada um recebe seu código. pessoa_id = id da pessoa no app (Cadastros → Pessoas). */
var USUARIOS = [
  { nome: 'Iristenio', pessoa_id: 'pes-1', papel: 'Admin' },
  { nome: 'Paulo', pessoa_id: 'pes-2', papel: 'Colaborador' },
];

function configurar() {
  var props = PropertiesService.getScriptProperties();

  // 1. Planilha
  var planilha;
  var id = props.getProperty(PROP_PLANILHA);
  if (id) {
    planilha = SpreadsheetApp.openById(id);
  } else {
    planilha = SpreadsheetApp.create(NOME_PLANILHA);
    props.setProperty(PROP_PLANILHA, planilha.getId());
  }

  // 2. Abas das entidades + registro
  Object.keys(ESQUEMA).forEach(function (entidade) {
    prepararAba(planilha, ESQUEMA[entidade].aba, cabecalho(entidade));
  });
  prepararAba(planilha, ABA_LOG, ['data_hora', 'entidade', 'registro_id', 'operacao', 'resultado', 'mensagem']);
  var padrao = planilha.getSheetByName('Página1') || planilha.getSheetByName('Sheet1');
  if (padrao && planilha.getSheets().length > 1) planilha.deleteSheet(padrao);

  // 3. Um token secreto por pessoa (mantém os que já existem)
  var tokens = JSON.parse(props.getProperty(PROP_TOKENS) || '{}');
  USUARIOS.forEach(function (u) {
    var atual = Object.keys(tokens).filter(function (t) { return tokens[t].pessoa_id === u.pessoa_id; })[0];
    if (atual) delete tokens[atual];
    tokens[atual || novoToken()] = u; // atualiza nome/papel se mudaram em USUARIOS
  });
  props.setProperty(PROP_TOKENS, JSON.stringify(tokens));

  // 4. Códigos de conexão (um por pessoa)
  Logger.log('Planilha: ' + planilha.getUrl());
  if (!URL_PUBLICA) {
    Logger.log('⚠️ Preencha URL_PUBLICA em configurar.js (endereço /exec da implantação) e execute de novo.');
    return;
  }
  Object.keys(tokens).forEach(function (t) {
    var u = tokens[t];
    Logger.log('================ CÓDIGO DE ' + u.nome.toUpperCase() + ' (' + u.papel + ') ================');
    Logger.log('APP1:' + Utilities.base64EncodeWebSafe(JSON.stringify({ u: URL_PUBLICA, t: t })));
  });
  Logger.log('Cada pessoa cola o SEU código no app, em Ajustes → Sincronização.');
}

function novoToken() {
  return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
}

/** Gera tokens novos para todos (use se desconfiar que algum vazou). Os aparelhos precisarão dos novos códigos. */
function trocarTokens() {
  PropertiesService.getScriptProperties().deleteProperty(PROP_TOKENS);
  configurar();
}

function prepararAba(planilha, nome, colunas) {
  var aba = planilha.getSheetByName(nome) || planilha.insertSheet(nome);
  if (aba.getMaxColumns() < colunas.length) aba.insertColumnsAfter(aba.getMaxColumns(), colunas.length - aba.getMaxColumns());
  aba.getRange(1, 1, 1, colunas.length).setValues([colunas]).setFontWeight('bold').setBackground('#e3ecfd');
  aba.setFrozenRows(1);
  // Tudo como texto: impede a planilha de transformar "2026-09-24" em data ou "10:00" em hora
  aba.getRange(1, 1, aba.getMaxRows(), colunas.length).setNumberFormat('@');
}
