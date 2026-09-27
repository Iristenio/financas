// API do app (Google Apps Script, publicada como "App da Web").
// Toda requisição precisa de um token secreto — um por pessoa, gerados em configurar().
// O token diz quem está sincronizando e com qual papel (Admin ou Colaborador).

var PROP_PLANILHA = 'PLANILHA_ID';
var PROP_TOKENS = 'TOKENS'; // JSON { token: { nome, pessoa_id, papel } }
var ABA_LOG = 'LOG_SYNC';
var MAX_LINHAS_LOG = 3000;

function doGet() {
  return ContentService.createTextOutput('API ativa (versão ' + VERSAO_API + ').');
}

function doPost(e) {
  var resposta;
  try {
    var req = JSON.parse(e.postData.contents);
    var usuario = identificar(req.token);
    if (!usuario) {
      resposta = { ok: false, erro: 'Token inválido', codigo: 401 };
    } else {
      var trava = LockService.getScriptLock();
      trava.waitLock(30000);
      try {
        var planilha = abrirPlanilha();
        var tabelas = tabelasDaPlanilha(planilha);
        resposta = processar(tabelas, req, new Date().toISOString(), usuario);
        if (resposta.log && resposta.log.length) registrarLog(planilha, resposta.log);
        delete resposta.log;
        if (req.acao === 'ping') resposta.planilha = planilha.getUrl();
      } finally {
        trava.releaseLock();
      }
    }
  } catch (erro) {
    resposta = { ok: false, erro: String(erro && erro.message ? erro.message : erro) };
  }
  return ContentService.createTextOutput(JSON.stringify(resposta)).setMimeType(ContentService.MimeType.JSON);
}

/** Dono do token (ou null se o token não existe). */
function identificar(token) {
  if (!token) return null;
  var tokens = JSON.parse(PropertiesService.getScriptProperties().getProperty(PROP_TOKENS) || '{}');
  return tokens[token] || null;
}

function abrirPlanilha() {
  var id = PropertiesService.getScriptProperties().getProperty(PROP_PLANILHA);
  if (!id) throw new Error('Execute configurar() no editor do Apps Script primeiro.');
  return SpreadsheetApp.openById(id);
}

/** Adapta cada aba ao formato esperado pelo núcleo (lê uma vez, grava linha a linha). */
function tabelasDaPlanilha(planilha) {
  var tabelas = {};
  Object.keys(ESQUEMA).forEach(function (entidade) {
    var aba = planilha.getSheetByName(ESQUEMA[entidade].aba);
    if (!aba) throw new Error('Aba ' + ESQUEMA[entidade].aba + ' não existe — execute configurar() de novo.');
    var colunas = cabecalho(entidade).length;
    var cache = null;
    var ler = function () {
      if (cache === null) {
        var n = aba.getLastRow() - 1;
        cache = n > 0 ? aba.getRange(2, 1, n, colunas).getDisplayValues() : [];
      }
      return cache;
    };
    tabelas[entidade] = {
      linhas: ler,
      atualizar: function (i, valores) {
        ler()[i] = valores;
        aba.getRange(i + 2, 1, 1, colunas).setValues([valores]);
      },
      anexar: function (valores) {
        ler().push(valores);
        aba.getRange(cache.length + 1, 1, 1, colunas).setValues([valores]);
      },
    };
  });
  return tabelas;
}

function registrarLog(planilha, linhas) {
  var aba = planilha.getSheetByName(ABA_LOG);
  aba.getRange(aba.getLastRow() + 1, 1, linhas.length, linhas[0].length).setValues(linhas);
  var excesso = aba.getLastRow() - 1 - MAX_LINHAS_LOG;
  if (excesso > 500) aba.deleteRows(2, excesso);
}
