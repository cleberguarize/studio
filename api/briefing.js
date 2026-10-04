/* ==========================================================================
   BRIEFING — endpoint de envio (roda no servidor)
   --------------------------------------------------------------------------
   Hosting estático puro (GitHub Pages, Hostinger, S3...) NÃO executa esta
   pasta. Para ativar o envio, publique a raiz do site em uma hospedagem com
   funções de servidor (Vercel ou Netlify) e defina as variáveis de ambiente
   descritas em .env.example.

   Nenhuma credencial fica neste arquivo.
   ========================================================================== */

'use strict';

var z = require('zod');
var emailMod = require('./briefing-email.js');
var DEFS = require('../briefing/config.js');

/* ------------------------------------------------------------------ env */

function env(name, fallback) {
  var v = process.env[name];
  return (v === undefined || v === '') ? fallback : v;
}

var TO_EMAIL = env('BRIEFING_TO_EMAIL');
var FROM_EMAIL = env('BRIEFING_FROM_EMAIL');
var RESEND_API_KEY = env('RESEND_API_KEY');
var SMTP_HOST = env('SMTP_HOST');
var SMTP_PORT = env('SMTP_PORT', '587');
var SMTP_USER = env('SMTP_USER');
var SMTP_PASS = env('SMTP_PASS');
var SMTP_SECURE = env('SMTP_SECURE', 'false') === 'true';

/* Domínios liberados no CORS. Vazio = mesma origem do próprio site. */
var ALLOWED_ORIGINS = env('ALLOWED_ORIGINS', '')
  .split(',').map(function (s) { return s.trim(); }).filter(Boolean);

var MAX_BODY_BYTES = parseInt(env('MAX_BODY_BYTES', '262144'), 10); /* 256 KB */
var RATE_LIMIT_MAX = parseInt(env('RATE_LIMIT_MAX', '5'), 10);
var RATE_LIMIT_WINDOW_MS = parseInt(env('RATE_LIMIT_WINDOW_MS', '3600000'), 10); /* 1 h */

/* -------------------------------------------------------- rate limit em memória */

var hits = Object.create(null);

function rateLimited(ip) {
  var now = Date.now();
  var list = hits[ip] || (hits[ip] = []);
  var kept = list.filter(function (t) { return now - t < RATE_LIMIT_WINDOW_MS; });
  kept.push(now);
  hits[ip] = kept;

  if (Object.keys(hits).length > 5000) {
    Object.keys(hits).forEach(function (k) {
      if (!hits[k].length || now - hits[k][hits[k].length - 1] > RATE_LIMIT_WINDOW_MS) delete hits[k];
    });
  }

  return kept.length > RATE_LIMIT_MAX;
}

/* ----------------------------------------------------------------- CORS */

function applyCors(req, res) {
  var origin = req.headers.origin;
  /* Sem ALLOWED_ORIGINS configurado, nenhuma origem é liberada: aceitar
     qualquer origem permitiria usar o endpoint para spam. */
  if (origin && ALLOWED_ORIGINS.indexOf(origin) > -1) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

/* ------------------------------------------------------------- validação */

const short = (max) => z.string().max(max);
/* `short` puro aceita "" (z.string().max(40) valida string vazia).
   Campos obrigatorios precisam de `req`. */
const req = (max, msg) => z.string().trim().min(1, msg || 'Campo obrigatorio').max(max);
const optShort = (max) => z.string().max(max).optional().or(z.literal('')).nullable();

const schema = z.object({
  negocio: z.object({
    nome: req(160, 'Informe o nome do negocio'),
    gmn_existe: z.enum(['sim', 'nao', 'nao_sei'])
  }),
  resumo_copy: z.object({
    objetivo_site: short(40).optional().or(z.literal('')),
    objetivo_outro: optShort(160),
    forma_conversao: optShort(200),
    publico_ideal: optShort(4000),
    dor_principal: optShort(4000),
    resultado_buscado: optShort(4000),
    diferenciais: optShort(1000),
    provas_sociais: optShort(400),
    tom_de_voz: optShort(400),
    servico_principal: optShort(300),
    servico_mais_vende: optShort(300)
  }),
  contato_dev: z.object({
    nome: req(160, 'Informe o nome do responsavel'),
    email: z.string().trim().email('E-mail invalido').max(200),
    telefone: req(40, 'Informe o telefone do responsavel')
  }),
  consentimento: z.object({
    lgpd: z.literal(true),
    enviar_copia: z.boolean(),
    email_copia: optShort(200)
  }),
  respostas: z.object({
    gmn_existe: z.enum(['sim', 'nao', 'nao_sei']),
    negocio_nome: req(160, 'Informe o nome do negocio'),
    responsavel_nome: req(160, 'Informe o nome do responsavel'),
    contato_email_dev: z.string().trim().email('E-mail invalido').max(200),
    contato_telefone_cliente: req(40, 'Informe um telefone de contato'),
    consentimento_lgpd: z.literal(true),
    /* obrigatorio no config; `.passthrough()` nao valida, entao e declarado aqui */
    objetivo_principal: req(40, 'Escolha o objetivo principal do site'),
    objetivo_outro: optShort(160),
    conversao_canais: z.array(z.string()).min(1, 'Escolha ao menos uma forma de contato')
  }).passthrough().superRefine(function (v, ctx) {
    /* "Outro" so faz sentido com a descricao preenchida. */
    if (v.objetivo_principal === 'outro' && !(v.objetivo_outro || '').trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['objetivo_outro'],
        message: 'Descreva o objetivo do site'
      });
    }
  }),
  /* isca contra robôs */
  website: z.string().max(0).optional().or(z.literal(''))
}).passthrough();

/* ---------------------------------------------------------------- envio */

async function transporterResend(mail, payload) {
  const { Resend } = require('resend');
  const resend = new Resend(RESEND_API_KEY);
  const r = await resend.emails.send({
    from: FROM_EMAIL,
    to: TO_EMAIL,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    replyTo: payload.contato_dev.email,
    attachments: [{
      filename: payload.__jsonFilename,
      content: Buffer.from(payload.__json).toString('base64')
    }]
  });
  if (r.error) throw new Error('Resend: ' + r.error.message);
  return r;
}

async function transporterSmtp(mail, payload) {
  const nodemailer = require('nodemailer');
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT, 10),
    secure: SMTP_SECURE,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
  return transport.sendMail({
    from: FROM_EMAIL,
    to: TO_EMAIL,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    replyTo: payload.contato_dev.email,
    attachments: [{ filename: payload.__jsonFilename, content: payload.__json }]
  });
}

async function enviarParaCliente(mail, payload) {
  if (RESEND_API_KEY) {
    const { Resend } = require('resend');
    const resend = new Resend(RESEND_API_KEY);
    const r = await resend.emails.send({
      from: FROM_EMAIL,
      to: payload.contato_dev.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text
    });
    if (r.error) throw new Error('Resend copia: ' + r.error.message);
    return;
  }

  const nodemailer = require('nodemailer');
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT, 10),
    secure: SMTP_SECURE,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
  await transport.sendMail({
    from: FROM_EMAIL,
    to: payload.contato_dev.email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text
  });
}

function fail(res, code, message) {
  return res.status(code).json({ ok: false, error: message });
}

/* -------------------------------------------------------------- handler */

module.exports = async function handler(req, res) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return fail(res, 405, 'Método não permitido.');

  if (!TO_EMAIL || !FROM_EMAIL) {
    console.error('[briefing] Faltam BRIEFING_TO_EMAIL / BRIEFING_FROM_EMAIL.');
    return fail(res, 500, 'Envio indisponível no momento.');
  }
  if (!RESEND_API_KEY && !SMTP_HOST) {
    console.error('[briefing] Faltam credenciais (RESEND_API_KEY ou SMTP_*).');
    return fail(res, 500, 'Envio indisponível no momento.');
  }

  var ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'desconhecido';
  ip = String(ip).split(',')[0].trim();

  if (rateLimited(ip)) {
    return fail(res, 429, 'Muitas tentativas. Tente novamente mais tarde.');
  }

  /* tamanho do corpo (protege antes de fazer o parse) */
  var raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
    return fail(res, 413, 'Conteúdo muito grande.');
  }

  var parsed;
  try {
    parsed = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return fail(res, 400, 'Não consegui ler os dados.');
  }
  if (!parsed || typeof parsed !== 'object') return fail(res, 400, 'Não consegui ler os dados.');

  /* honeypot: se veio preenchido, é robô. Responde 200 e não envia nada. */
  if (parsed.website) {
    console.warn('[briefing] Honeypot acionado.');
    return res.status(200).json({ ok: true });
  }

  const check = schema.safeParse(parsed);
  if (!check.success) {
    console.warn('[briefing] Payload inválido:', check.error.issues.map(i => i.path.join('.')).join(', '));
    return fail(res, 422, 'Alguns campos obrigatórios não foram preenchidos.');
  }

  const payload = check.data;
  const mail = emailMod.buildEmail(payload);
  payload.__json = mail.json;
  payload.__jsonFilename = mail.jsonFilename;

  try {
    if (RESEND_API_KEY) await transporterResend(mail, payload);
    else await transporterSmtp(mail, payload);

    if (payload.consentimento.enviar_copia && payload.contato_dev.email) {
      try {
        const copia = emailMod.buildClientEmail(payload);
        await enviarParaCliente(copia, payload);
      } catch (e) {
        console.error('[briefing] Cópia para o cliente falhou (e-mail principal já foi):', e.message);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[briefing] Falha no envio:', e);
    return fail(res, 502, 'Não consegui enviar agora.');
  }
};

module.exports.schema = schema;
module.exports.buildEmail = emailMod.buildEmail;