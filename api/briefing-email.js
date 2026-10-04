/* ==========================================================================
   BRIEFING — montagem do e-mail (roda no servidor)
   Sem dependências: só monta assunto, HTML, texto puro e o anexo JSON.
   Os rótulos vêm de ../briefing/config.js, o mesmo arquivo do formulário,
   para nunca saírem de sincronia.
   ========================================================================== */

'use strict';

var DEFS = require('../briefing/config.js');

/* --------------------------------------------------------------- escapes */

function escapeHtml(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function esc(s) { return escapeHtml(s); }

/* ------------------------------------------------------------- auxiliares */

function slugify(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'negocio';
}

var YES_NO = { sim: 'Sim', nao: 'Não', nao_sei: 'Não sei' };

var DAYS = [
  { key: 'seg', label: 'Segunda-feira' },
  { key: 'ter', label: 'Terça-feira' },
  { key: 'qua', label: 'Quarta-feira' },
  { key: 'qui', label: 'Quinta-feira' },
  { key: 'sex', label: 'Sexta-feira' },
  { key: 'sab', label: 'Sábado' },
  { key: 'dom', label: 'Domingo' }
];

var HOLIDAYS = [
  { key: 'ano_novo', label: 'Ano Novo' },
  { key: 'carnaval', label: 'Carnaval' },
  { key: 'sexta_santa', label: 'Sexta-feira Santa' },
  { key: 'trabalho', label: 'Dia do Trabalho' },
  { key: 'natal', label: 'Natal' },
  { key: 'municipal', label: 'Feriado municipal ou outra data' }
];

function getPath(obj, path) {
  var parts = String(path).split('.');
  var cur = obj;
  for (var i = 0; i < parts.length; i++) {
    if (cur === undefined || cur === null) return undefined;
    cur = cur[parts[i]];
  }
  return cur;
}

function isEmpty(v) {
  if (v === undefined || v === null) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (v === '') return true;
  if (typeof v === 'object' && !Array.isArray(v)) return Object.keys(v).length === 0;
  return false;
}

/* ------------------------------------------------------ valor legível */

function humanValue(field, value) {
  if (isEmpty(value)) return '';

  switch (field.type) {
    case 'radio': {
      var o = (field.options || []).filter(function (x) { return x.value === value; })[0];
      return o ? o.label : String(value);
    }

    case 'multi': {
      var map = {};
      (field.options || []).forEach(function (x) { map[x.value] = x.label; });
      return (value || []).map(function (k) { return map[k] || k; }).join(', ');
    }

    case 'checkbox':
      return value === true ? 'Sim' : 'Não';

    case 'yesno':
      return value === 'sim' ? 'Sim' : (value === 'nao' ? 'Não' : '');

    case 'yesno-group': {
      var on = [];
      (field.options || []).forEach(function (o) {
        if (value[o.id] === 'sim') on.push(o.label + ': Sim');
        else if (value[o.id] === 'nao') on.push(o.label + ': Não');
      });
      return on.join(', ');
    }

    case 'colors':
      return (value || []).filter(Boolean).join(', ');

    case 'hours':
      return DAYS.map(function (d) {
        var o = (value || {})[d.key];
        if (!o || !o.atende) return '';
        var t = [];
        if (o.abre) t.push('abre ' + o.abre);
        if (o.fecha) t.push('fecha ' + o.fecha);
        if (o.pausa) t.push('pausa ' + o.pausa);
        if (o.obs) t.push(o.obs);
        return d.label + ': ' + (t.join(' · ') || 'atende');
      }).filter(Boolean).join('\n');

    case 'holidays':
      return HOLIDAYS.map(function (hd) {
        var o = (value || {})[hd.key];
        if (!o || (!o.atende && !o.abre && !o.obs)) return '';
        if (o.atende === 'nao') return hd.label + ': não atende';
        var t = [];
        if (o.abre) t.push('abre ' + o.abre);
        if (o.fecha) t.push('fecha ' + o.fecha);
        if (o.obs) t.push(o.obs);
        return hd.label + ': ' + (t.join(' · ') || 'atende');
      }).filter(Boolean).join('\n');

    case 'repeat':
      return (value || []).map(function (item, i) {
        if (!item || typeof item !== 'object') return '';
        var bits = [];
        (field.itemFields || []).forEach(function (sub) {
          var x = item[sub.id];
          if (isEmpty(x) || x === false) return;
          if (Array.isArray(x)) {
            var m = {};
            (sub.options || []).forEach(function (o) { m[o.value] = o.label; });
            bits.push(sub.label + ': ' + x.map(function (k) { return m[k] || k; }).join(', '));
          } else if (x === true) {
            bits.push('(destaque)');
          } else {
            bits.push(sub.label + ': ' + x);
          }
        });
        return bits.length ? (i + 1) + '. ' + bits.join(' — ') : '';
      }).filter(Boolean).join('\n');

    default:
      return String(value);
  }
}

/* ------------------------------------------------------------ collect */

function collectRows(step, respostas) {
  var rows = [];
  (step.fields || []).forEach(function (f) {
    if (!f.id || f.type === 'notice') return;

    if (f.type === 'group') {
      (f.fields || []).forEach(function (sub) {
        var v = humanValue(sub, getPath(respostas, sub.id));
        if (v) rows.push({ label: sub.label, value: v });
      });
      return;
    }

    if (typeof f.showIf === 'function' && !f.showIf(respostas)) return;

    var v = humanValue(f, getPath(respostas, f.id));
    if (v) rows.push({ label: f.label, value: v });
  });
  return rows;
}

/* --------------------------------------------------------------- HTML */

function htmlRows(rows) {
  if (!rows.length) {
    return '<p style="color:#8a94a6;font-size:13px;margin:8px 0 0">Nada preenchido.</p>';
  }
  return rows.map(function (r) {
    return '<tr>' +
      '<td style="padding:9px 14px;border-top:1px solid #e8ecf2;vertical-align:top;' +
      'color:#5b6472;font-size:13px;width:38%;line-height:1.5">' + esc(r.label) + '</td>' +
      '<td style="padding:9px 14px;border-top:1px solid #e8ecf2;vertical-align:top;' +
      'color:#1a1f2b;font-size:13.5px;line-height:1.6;white-space:pre-wrap">' +
      esc(r.value).replace(/\n/g, '<br>') + '</td>' +
      '</tr>';
  }).join('');
}

function textRows(rows) {
  if (!rows.length) return '  (nada preenchido)\n';
  return rows.map(function (r) {
    return '  ' + r.label + ': ' + r.value;
  }).join('\n') + '\n';
}

var H = {
  wrap: function (inner, title) {
    return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + esc(title) + '</title></head>' +
      '<body style="margin:0;padding:0;background:#eef1f6;font-family:Helvetica,Arial,sans-serif;' +
      '-webkit-text-size-adjust:100%">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f6">' +
      '<tr><td align="center" style="padding:24px 12px">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ' +
      'style="max-width:680px;background:#ffffff;border-radius:14px;overflow:hidden;' +
      'box-shadow:0 2px 10px rgba(16,24,40,.06)">' +
      '<tr><td style="background:#050a14;padding:22px 26px">' +
      '<div style="color:#29C5F6;font-size:10px;letter-spacing:2px;text-transform:uppercase;' +
      'font-weight:bold;margin-bottom:6px">Studio Gemma Home</div>' +
      '<div style="color:#ffffff;font-size:19px;font-weight:bold;letter-spacing:-.3px">' +
      'Novo briefing recebido</div>' +
      '</td></tr>' +
      '<tr><td style="padding:24px 26px">' + inner + '</td></tr>' +
      '<tr><td style="padding:16px 26px 24px;border-top:1px solid #e8ecf2;color:#8a94a6;font-size:11.5px;' +
      'line-height:1.6">Enviado pela página de briefing. Respostas salvas apenas por e-mail.</td></tr>' +
      '</table></td></tr></table></body></html>';
  },

  copyBlock: function (rows) {
    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ' +
      'style="background:#f5f9ff;border:1px solid #d6e6ff;border-radius:12px;margin:0 0 22px">' +
      '<tr><td style="padding:16px 18px">' +
      '<div style="color:#007bff;font-size:11px;font-weight:bold;letter-spacing:1.4px;' +
      'text-transform:uppercase;margin-bottom:10px">Resumo para a copy</div>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' +
      htmlRows(rows) + '</table>' +
      '</td></tr></table>';
  },

  stepBlock: function (num, title, rows) {
    var head = num ? 'Etapa ' + num + ' · ' + esc(title) : esc(title);
    return '<div style="margin:0 0 18px;border:1px solid #e8ecf2;border-radius:12px;overflow:hidden">' +
      '<div style="background:#f7f9fc;padding:11px 16px;border-bottom:1px solid #e8ecf2;' +
      'font-size:12px;font-weight:bold;color:#1a1f2b">' +
      head + '</div>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' +
      htmlRows(rows) + '</table>' +
      '</div>';
  }
};

function textStepBlock(num, title, rows) {
  var head = num ? 'ETAPA ' + num + ' · ' + title.toUpperCase() : title.toUpperCase();
  return '\n=== ' + head + ' ===\n' + textRows(rows);
}

/* Converte valores crus (ex.: "whatsapp, formulario") nos rótulos da tela. */
function labelFor(fieldId, raw) {
  if (!raw) return '';
  var found = null;
  DEFS.steps.forEach(function (s) {
    (s.fields || []).forEach(function (f) {
      if (f.id === fieldId) found = f;
    });
  });
  if (!found || !found.options) return String(raw);
  var map = {};
  found.options.forEach(function (o) { map[o.value] = o.label; });
  return String(raw).split(',').map(function (k) {
    k = k.trim();
    return map[k] || k;
  }).filter(Boolean).join(', ');
}

/* ------------------------------------------------------- resumo da copy */

function copySummary(payload) {
  var r = payload.resumo_copy || {};
  var respostas = payload.respostas || {};
  return [
    { label: 'Objetivo do site', value: objetivoTexto(r) },
    { label: 'Forma de conversão', value: labelFor('conversao_canais', r.forma_conversao) },
    { label: 'Público ideal', value: r.publico_ideal || '' },
    { label: 'Dor principal', value: r.dor_principal || '' },
    { label: 'Resultado buscado', value: r.resultado_buscado || '' },
    { label: 'Diferenciais', value: r.diferenciais || '' },
    { label: 'Provas sociais', value: labelFor('provas_sociais', r.provas_sociais) },
    { label: 'Tom de voz', value: labelFor('tom_voz', r.tom_de_voz) },
    { label: 'Serviço principal', value: r.servico_principal || r.servico_mais_vende || '' },
    { label: 'Serviço que mais vende', value: respostas.servico_mais_vende || '' }
  ].filter(function (x) { return !!x.value; });
}

var OBJETIVO_LABEL = {
  orcamento: 'Receber pedidos de orçamento',
  agendar: 'Agendar consultas e atendimentos',
  ligacoes: 'Receber ligações',
  formulario: 'Gerar contatos por formulário',
  venda_online: 'Vender online',
  trazer_local: 'Levar clientes ao local físico',
  outro: 'Outro'
};

function objetivoTexto(r) {
  var base = OBJETIVO_LABEL[r.objetivo_site] || r.objetivo_site || '';
  if (r.objetivo_site === 'outro' && r.objetivo_outro) base = r.objetivo_outro;
  return base;
}

/* ----------------------------------------------------------- principal */

function buildEmail(payload) {
  var respostas = (payload && payload.respostas) || {};
  var negocio = (payload && payload.negocio) || {};
  var contato = (payload && payload.contato_dev) || {};

  var nome = negocio.nome || slugify(contato.nome) || 'sem nome';
  var gmnLabel = YES_NO[negocio.gmn_existe] || 'Não sei';
  var subject = 'Novo briefing: ' + nome + ' | GMN: ' + gmnLabel;
  var jsonName = 'briefing-' + slugify(nome) + '.json';

  var summary = copySummary(payload);

  /* ---- HTML completo ---- */
  var inner = '';

  inner += '<div style="font-size:14px;color:#5b6472;line-height:1.7;margin:0 0 18px">' +
    '<strong style="color:#1a1f2b">Negócio:</strong> ' + esc(nome) + '<br>' +
    '<strong style="color:#1a1f2b">Responsável:</strong> ' + esc(contato.nome || '—') + '<br>' +
    '<strong style="color:#1a1f2b">E-mail:</strong> ' + esc(contato.email || '—') + '<br>' +
    '<strong style="color:#1a1f2b">Telefone:</strong> ' + esc(contato.telefone || '—') + '<br>' +
    '<strong style="color:#1a1f2b">Perfil da Empresa no Google:</strong> ' + esc(gmnLabel) +
    '</div>';

  inner += H.copyBlock(summary);

  DEFS.steps.forEach(function (step, i) {
    if (step.final) return;
    if (typeof step.showIf === 'function' && !step.showIf(respostas)) return;
    var rows = collectRows(step, respostas);
    if (!rows.length) return;
    inner += H.stepBlock(i + 1, step.title, rows);
  });

  var html = H.wrap(inner, subject);

  /* ---- texto puro ---- */
  var t = '';
  t += 'NOVO BRIEFING — ' + nome + '\n';
  t += '=====================================\n\n';
  t += 'Negócio: ' + nome + '\n';
  t += 'Responsável: ' + (contato.nome || '—') + '\n';
  t += 'E-mail: ' + (contato.email || '—') + '\n';
  t += 'Telefone: ' + (contato.telefone || '—') + '\n';
  t += 'Perfil da Empresa no Google: ' + gmnLabel + '\n\n';

  t += '--- RESUMO PARA A COPY ---\n';
  summary.forEach(function (s) {
    t += '  ' + s.label + ': ' + s.value + '\n';
  });

  DEFS.steps.forEach(function (step, i) {
    if (step.final) return;
    if (typeof step.showIf === 'function' && !step.showIf(respostas)) return;
    var rows = collectRows(step, respostas);
    if (!rows.length) return;
    t += textStepBlock(i + 1, step.title, rows);
  });

  return {
    subject: subject,
    html: html,
    text: t,
    json: JSON.stringify(payload, null, 2),
    jsonFilename: jsonName
  };
}

/* --------------------------------- versão simplificada para o cliente */

function buildClientEmail(payload) {
  var negocio = (payload && payload.negocio) || {};
  var contato = (payload && payload.contato_dev) || {};
  var respostas = (payload && payload.respostas) || {};
  var nome = negocio.nome || '';
  var site = DEFS.config.siteName;

  var subject = 'Cópia das suas respostas — ' + nome;
  var dataIso = new Date().toISOString().slice(0, 10);

  var inner = '';
  inner += '<div style="font-size:14px;color:#5b6472;line-height:1.7;margin:0 0 20px">' +
    'Oi' + (contato.nome ? ', ' + esc(contato.nome.split(' ')[0]) : '') + '!<br><br>' +
    'Recebi o seu briefing do <strong>' + esc(nome) + '</strong> em ' + esc(dataIso) + '. ' +
    'Abaixo está um resumo do que você respondeu. Guardei tudo na íntegra.' +
    '</div>';

  var etapas = [
    { title: 'Objetivo e conversão', ids: ['objetivo_principal', 'conversao_canais', 'whatsapp_numero'] },
    { title: 'Serviços', ids: ['servico_principal', 'lista_servicos'] },
    { title: 'Contato', ids: ['contato_telefone', 'contato_email_comercial', 'end_logradouro', 'end_cidade'] }
  ];

  etapas.forEach(function (e) {
    var rows = [];
    e.ids.forEach(function (id) {
      var found = null;
      DEFS.steps.forEach(function (s) {
        (s.fields || []).forEach(function (f) {
          if (f.id === id) found = f;
          if (f.type === 'group' && (f.fields || []).some(function (x) { return x.id === id; })) {
            found = f.fields.filter(function (x) { return x.id === id; })[0];
          }
        });
      });
      if (!found) return;
      var v = humanValue(found, getPath(respostas, id));
      if (v) rows.push({ label: found.label, value: v });
    });
    if (rows.length) inner += H.stepBlock(null, e.title, rows);
  });

  inner += '<p style="font-size:13px;color:#8a94a6;line-height:1.7;margin:20px 0 0">' +
    'Se quiser corrigir ou complementar alguma informação, é só responder este e-mail.</p>';

  var html = H.wrap(inner, subject);

  var t = 'Olá' + (contato.nome ? ', ' + contato.nome.split(' ')[0] : '') + '!\n\n' +
    'Recebi o seu briefing do ' + nome + '.\n\n' +
    'Resumo do que você respondeu:\n\n' +
    '---------------------------------------\n';

  etapas.forEach(function (e) {
    var rows = [];
    e.ids.forEach(function (id) {
      var found = null;
      DEFS.steps.forEach(function (s) {
        (s.fields || []).forEach(function (f) {
          if (f.id === id) found = f;
          if (f.type === 'group' && (f.fields || []).some(function (x) { return x.id === id; })) {
            found = f.fields.filter(function (x) { return x.id === id; })[0];
          }
        });
      });
      if (!found) return;
      var v = humanValue(found, getPath(respostas, id));
      if (v) rows.push({ label: found.label, value: v });
    });
    if (rows.length) t += textStepBlock(null, e.title, rows);
  });

  t += '\nSe quiser corrigir ou complementar alguma informação, é só responder este e-mail.\n';

  return { subject: subject, html: html, text: t };
}

module.exports = {
  escapeHtml: escapeHtml,
  slugify: slugify,
  buildEmail: buildEmail,
  buildClientEmail: buildClientEmail
};