/* ==========================================================================
   BRIEFING — motor do formulário
   Toda a lógica vive aqui. Para mudar perguntas, edite briefing/config.js.
   ========================================================================== */

(function () {
  'use strict';

  var DEFS = window.BRIEFING_CONFIG;
  var CONFIG = DEFS.config;
  var STEPS = DEFS.steps;

  var data = {};
  var current = 0;
  var submitting = false;
  var booting = true;
  var hasDraft = false;

  var DAYS = [
    { key: 'seg', label: 'Segunda-feira' },
    { key: 'ter', label: 'Terça-feira' },
    { key: 'qua', label: 'Quarta-feira' },
    { key: 'qui', label: 'Quinta-feira' },
    { key: 'sex', label: 'Sexta-feira' },
    { key: 'sab', label: 'Sábado' },
    { key: 'dom', label: 'Domingo' }
  ];
  var WEEKDAYS = ['seg', 'ter', 'qua', 'qui', 'sex'];

  var HOLIDAYS = [
    { key: 'ano_novo', label: 'Ano Novo (1º de janeiro)' },
    { key: 'carnaval', label: 'Carnaval' },
    { key: 'sexta_santa', label: 'Sexta-feira Santa' },
    { key: 'trabalho', label: 'Dia do Trabalho (1º de maio)' },
    { key: 'natal', label: 'Natal (25 de dezembro)' },
    { key: 'municipal', label: 'Feriado municipal ou outra data' }
  ];

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------------------------------------------------------- DOM utils */

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') n.className = attrs[k];
        else if (k === 'text') n.textContent = attrs[k];
        else if (k === 'html') n.innerHTML = attrs[k];
        else if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) n.setAttribute(k, attrs[k]);
      });
    }
    (kids || []).forEach(function (k) {
      if (k === null || k === undefined || k === false) return;
      n.appendChild(typeof k === 'string' ? document.createTextNode(k) : k);
    });
    return n;
  }

  function uid() { return 'f' + Math.random().toString(36).slice(2, 9); }

  function labelText(f) { return f._display || f.label; }

  /* --------------------------------------------------------- get / set  */

  function setPath(obj, path, value) {
    var parts = path.split('.');
    var cur = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      var k = parts[i];
      if (cur[k] === undefined || cur[k] === null || typeof cur[k] !== 'object') {
        cur[k] = /^\d+$/.test(parts[i + 1]) ? [] : {};
      }
      cur = cur[k];
    }
    cur[parts[parts.length - 1]] = value;
  }

  function getPath(obj, path) {
    var parts = path.split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur === undefined || cur === null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function visibleSteps() {
    return STEPS.filter(function (s) {
      return typeof s.showIf !== 'function' || s.showIf(data);
    });
  }

  /* ------------------------------------------------------------ máscaras */

  function onlyDigits(v) { return (v || '').replace(/\D/g, ''); }

  function maskPhone(v) {
    var d = onlyDigits(v).slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  }

  function maskCnpj(v) {
    var d = onlyDigits(v).slice(0, 14);
    if (d.length <= 2) return d;
    if (d.length <= 5) return d.slice(0, 2) + '.' + d.slice(2);
    if (d.length <= 8) return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5);
    if (d.length <= 12) return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/' + d.slice(8);
    return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/' + d.slice(8, 12) + '-' + d.slice(12);
  }

  function maskCep(v) {
    var d = onlyDigits(v).slice(0, 8);
    return d.length <= 5 ? d : d.slice(0, 5) + '-' + d.slice(5);
  }

  function normalizeUrl(v) {
    var s = (v || '').trim();
    if (!s) return '';
    if (/^https?:\/\//i.test(s)) return s;
    if (/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(s)) return 'https://' + s;
    return s;
  }

  function validUrl(v) {
    if (!v) return true;
    try {
      var u = new URL(normalizeUrl(v));
      return !!u.hostname && u.hostname.indexOf('.') > -1;
    } catch (e) { return false; }
  }

  function validEmail(v) {
    if (!v) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim());
  }

  /* ------------------------------------------------------- persistência */

  var saveTimer = null;
  var flagTimer = null;

  function save() {
    if (booting) return;
    try {
      window.localStorage.setItem(CONFIG.storageKey, JSON.stringify({ v: 1, step: current, data: data }));
      hasDraft = true;
      var f = $('#saveFlag');
      if (f) {
        f.classList.add('show');
        clearTimeout(flagTimer);
        flagTimer = setTimeout(function () { f.classList.remove('show'); }, 1800);
      }
    } catch (e) { /* navegação privada ou cota cheia */ }
  }

  function load() {
    try {
      var raw = window.localStorage.getItem(CONFIG.storageKey);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.v !== 1 || typeof parsed.data !== 'object') return null;
      return parsed;
    } catch (e) { return null; }
  }

  function clearDraft() {
    try { window.localStorage.removeItem(CONFIG.storageKey); } catch (e) { }
  }

  /* ------------------------------------------------- registro de visibilidade */

  var visTargets = [];

  function registerVisibility(node, fn) {
    if (typeof fn === 'function') {
      visTargets.push({ node: node, fn: fn });
      node.classList.add('hidden');
    }
    return node;
  }

  var visScheduled = false;
  function scheduleVisibility() {
    if (visScheduled) return;
    visScheduled = true;
    setTimeout(function () { visScheduled = false; applyVisibility(); }, 0);
  }

  function applyVisibility() {
    visTargets.forEach(function (t) {
      var show = false;
      try { show = !!t.fn(data); } catch (e) { show = false; }
      t.node.classList.toggle('hidden', !show);
      $$('input, select, textarea', t.node).forEach(function (i) { i.disabled = !show; });
    });
    renderProgress();
  }

  /* ------------------------------------------------- peças reutilizáveis */

  function labelNode(f, required) {
    var l = el('label', { class: 'field-label', for: f._id });
    l.appendChild(document.createTextNode(labelText(f)));
    if (required) l.appendChild(el('span', { class: 'req', text: '*', 'aria-hidden': 'true' }));
    else l.appendChild(el('span', { class: 'opt-tag', text: 'opcional' }));
    return l;
  }

  function hintNode(text) {
    return text ? el('p', { class: 'hint', text: text }) : null;
  }

  function errNode(id, text) {
    return el('p', { class: 'err', id: id }, [
      el('span', { 'aria-hidden': 'true', text: '⚠' }),
      el('span', { text: text || 'Verifique este campo' })
    ]);
  }

  function counterNode(max) {
    return el('span', { class: 'counter', text: '0/' + max });
  }

  function wireCounter(input, counter, max) {
    function upd() {
      var n = input.value.length;
      counter.textContent = n + '/' + max;
      counter.classList.toggle('near', n > max * 0.85 && n <= max);
      counter.classList.toggle('over', n > max);
    }
    input.addEventListener('input', upd);
    upd();
  }

  function applyMask(input) {
    input.addEventListener('input', function () {
      var kind = input.getAttribute('data-mask');
      if (kind === 'phone') input.value = maskPhone(input.value);
      else if (kind === 'cnpj') input.value = maskCnpj(input.value);
      else if (kind === 'cep') input.value = maskCep(input.value);
    });
  }

  function onChange(path, value, node) {
    setPath(data, path, value);
    if (node) clearFieldError(node);
    save();
    scheduleVisibility();
  }

  function announce(msg) {
    var live = $('#live');
    if (live) live.textContent = msg;
  }

  /* ---------------------------------------------------- construção campos */

  function buildInput(f) {
    var wrap = el('div', { class: 'field' });
    var type = (f.type === 'cep' || f.type === 'url') ? 'text' : f.type;

    var input = el('input', {
      id: f._id, name: f.id, type: type,
      placeholder: f.placeholder || '', autocomplete: 'off'
    });

    if (f.type === 'tel') input.setAttribute('data-mask', 'phone');
    if (f.type === 'cep') input.setAttribute('data-mask', 'cep');
    if (f.type === 'number') {
      if (f.min !== undefined) input.setAttribute('min', f.min);
      if (f.max !== undefined) input.setAttribute('max', f.max);
    }
    if (f.type === 'email') input.setAttribute('inputmode', 'email');
    if (f.type === 'url') input.setAttribute('inputmode', 'url');

    wrap.appendChild(labelNode(f, f.required));
    var h = hintNode(f.hint);
    if (h) wrap.appendChild(h);
    wrap.appendChild(input);

    if (f.maxlength) {
      input.setAttribute('maxlength', String(f.maxlength));
      var cnt = counterNode(f.maxlength);
      wrap.appendChild(cnt);
      wireCounter(input, cnt, f.maxlength);
    }

    var err = errNode(f._id + '-err');
    input.setAttribute('aria-describedby', err.id);
    wrap.appendChild(err);

    applyMask(input);
    input.addEventListener('input', function () { onChange(f.id, input.value, input); });

    if (f.type === 'url') {
      input.addEventListener('blur', function () {
        var n = normalizeUrl(input.value);
        if (n && n !== input.value) { input.value = n; onChange(f.id, n, input); }
      });
    }
    if (f.type === 'cep') wireCep(input);

    return wrap;
  }

  function buildTextarea(f) {
    var wrap = el('div', { class: 'field' });
    var ta = el('textarea', {
      id: f._id, name: f.id,
      rows: f.rows || 4, placeholder: f.placeholder || ''
    });

    wrap.appendChild(labelNode(f, f.required));
    var h = hintNode(f.hint);
    if (h) wrap.appendChild(h);
    wrap.appendChild(ta);

    if (f.maxlength) {
      ta.setAttribute('maxlength', String(f.maxlength));
      var cnt = counterNode(f.maxlength);
      wrap.appendChild(cnt);
      wireCounter(ta, cnt, f.maxlength);
    }

    var err = errNode(f._id + '-err');
    ta.setAttribute('aria-describedby', err.id);
    wrap.appendChild(err);
    ta.addEventListener('input', function () { onChange(f.id, ta.value, ta); });
    return wrap;
  }

  function buildSelect(f) {
    var wrap = el('div', { class: 'field' });
    var sel = el('select', { id: f._id, name: f.id });
    sel.appendChild(el('option', { value: '', text: 'Selecione...' }));
    (f.options || []).forEach(function (o) {
      sel.appendChild(el('option', { value: o.value, text: o.label }));
    });
    wrap.appendChild(labelNode(f, f.required));
    var h = hintNode(f.hint);
    if (h) wrap.appendChild(h);
    wrap.appendChild(sel);
    var err = errNode(f._id + '-err');
    sel.setAttribute('aria-describedby', err.id);
    wrap.appendChild(err);
    sel.addEventListener('change', function () { onChange(f.id, sel.value, sel); });
    return wrap;
  }

  function buildChoices(f, kind) {
    var wrap = el('div', { class: 'field' });
    var opts = el('div', { class: 'opts' + (f.inline ? ' inline' : ''), role: 'group' });

    (f.options || []).forEach(function (o) {
      var id = f._id + '-' + o.value;
      var input = el('input', {
        type: kind === 'multi' ? 'checkbox' : 'radio',
        id: id,
        name: kind === 'multi' ? f.id + '.items' : f.id,
        value: o.value
      });
      opts.appendChild(el('label', { class: 'opt', for: id }, [
        input,
        el('span', { class: 'mark', 'aria-hidden': 'true' }),
        el('span', { class: 'opt-txt' }, [
          o.label,
          o.hint ? el('span', { class: 'oh', text: o.hint }) : null
        ])
      ]));
    });

    wrap.appendChild(labelNode(f, f.required));
    var h = hintNode(f.hint);
    if (h) wrap.appendChild(h);
    wrap.appendChild(opts);

    var err = errNode(f._id + '-err');
    opts.setAttribute('aria-describedby', err.id);
    wrap.appendChild(err);

    $$('input', opts).forEach(function (i) {
      i.addEventListener('change', function () {
        if (kind === 'multi') {
          var arr = $$('input:checked', opts).map(function (c) { return c.value; });
          onChange(f.id, arr, i);
        } else {
          onChange(f.id, i.value, i);
        }
      });
    });

    return wrap;
  }

  function buildYesNo(f) {
    var wrap = el('div', { class: 'field' });
    var opts = el('div', { class: 'opts yn' });

    [
      { value: 'sim', label: 'Sim' },
      { value: 'nao', label: 'Não' },
      { value: '', label: 'Prefiro não responder' }
    ].forEach(function (o) {
      var id = f._id + (o.value === '' ? '-n' : '-' + o.value);
      var input = el('input', { type: 'radio', id: id, name: f.id, value: o.value });
      input.addEventListener('change', function () {
        opts.classList.add('has-val');
        onChange(f.id, o.value, input);
      });
      opts.appendChild(el('label', { class: 'opt', for: id }, [
        input,
        el('span', { class: 'mark', 'aria-hidden': 'true' }),
        el('span', { class: 'opt-txt', text: o.label })
      ]));
    });

    wrap.appendChild(labelNode(f, false));
    var h = hintNode(f.hint);
    if (h) wrap.appendChild(h);
    wrap.appendChild(opts);
    return wrap;
  }

  function buildYesNoGroup(f) {
    var wrap = el('div', { class: 'field' });
    var box = el('div', {});

    (f.options || []).forEach(function (o) {
      var row = el('div', { class: 'field slot' });
      var opts = el('div', { class: 'opts yn' });
      var firstId = f._id + '-' + o.id + '-sim';

      [['sim', 'Sim'], ['nao', 'Não']].forEach(function (v) {
        var id = f._id + '-' + o.id + '-' + v[0];
        var input = el('input', { type: 'radio', id: id, name: f.id + '.' + o.id, value: v[0] });
        input.addEventListener('change', function () {
          opts.classList.add('has-val');
          var obj = getPath(data, f.id) || {};
          obj[o.id] = v[0];
          setPath(data, f.id, obj);
          save();
          scheduleVisibility();
        });
        opts.appendChild(el('label', { class: 'opt', for: id }, [
          input,
          el('span', { class: 'mark', 'aria-hidden': 'true' }),
          el('span', { class: 'opt-txt', text: v[1] })
        ]));
      });

      var lab = el('label', { class: 'field-label', for: firstId });
      lab.appendChild(document.createTextNode(o.label));
      row.appendChild(lab);
      if (o.hint) row.appendChild(el('p', { class: 'hint tight', text: o.hint }));
      row.appendChild(opts);
      box.appendChild(row);
    });

    wrap.appendChild(labelNode(f, false));
    var h = hintNode(f.hint);
    if (h) wrap.appendChild(h);
    wrap.appendChild(box);
    return wrap;
  }

  function buildCheckbox(f) {
    var wrap = el('div', { class: 'field' });
    var input = el('input', { type: 'checkbox', id: f._id, name: f.id });

    var txt = el('span', { class: 'opt-txt' });
    txt.appendChild(document.createTextNode(f.label));
    if (f.required) txt.appendChild(el('span', { class: 'req', text: '*', 'aria-hidden': 'true' }));
    else txt.appendChild(el('span', { class: 'opt-tag', text: 'opcional' }));

    input.addEventListener('change', function () { onChange(f.id, input.checked, input); });

    var head = el('label', { class: 'field-label', for: f._id });
    head.textContent = f.required ? 'Consentimento obrigatório' : 'Preferência';

    wrap.appendChild(head);
    var h = hintNode(f.hint);
    if (h) wrap.appendChild(h);
    wrap.appendChild(el('div', { class: 'opt' }, [
      input, el('span', { class: 'mark', 'aria-hidden': 'true' }), txt
    ]));

    var err = errNode(f._id + '-err');
    input.setAttribute('aria-describedby', err.id);
    wrap.appendChild(err);

    if (f.id === 'consentimento_lgpd') {
      wrap.classList.add('check-lgpd');
      wrap.appendChild(el('a', {
        class: 'privacy-link', href: CONFIG.privacyPolicyUrl,
        target: '_blank', rel: 'noopener',
        text: 'Ver minha política de privacidade'
      }));
    }
    return wrap;
  }

  function buildNotice(f) {
    var box = el('div', { class: 'notice ' + (f.tone || 'info') });
    box.appendChild(el('span', { class: 'n-icon', 'aria-hidden': 'true', text: f.tone === 'info' ? 'ⓘ' : '⚠' }));
    var body = el('div', { class: 'n-body' });
    if (f.title) body.appendChild(el('p', { class: 'n-title', text: f.title }));
    body.appendChild(el('p', { class: 'n-text', text: f.text }));
    box.appendChild(body);
    return box;
  }

  function buildColors(f) {
    var wrap = el('div', { class: 'field' });
    wrap.appendChild(labelNode(f, false));
    var h = hintNode(f.hint);
    if (h) wrap.appendChild(h);

    var row = el('div', { class: 'colors-row' });
    var n = f.slots || 3;

    for (var i = 0; i < n; i++) {
      var slot = el('div', { class: 'color-slot' });
      var picker = el('input', { type: 'color', 'aria-label': 'Seletor de cor ' + (i + 1), name: f.id + '.' + i + '.picker' });
      var txt = el('input', { type: 'text', name: f.id + '.' + i, maxlength: '20', placeholder: 'cor ' + (i + 1) });

      picker.addEventListener('input', function () {
        txt.value = picker.value;
        onChange(f.id, readColors(f), txt);
      });
      txt.addEventListener('input', function () { onChange(f.id, readColors(f), txt); });

      slot.appendChild(picker);
      slot.appendChild(txt);
      row.appendChild(slot);
    }
    wrap.appendChild(row);
    return wrap;
  }

  function readColors(f) {
    var vals = [];
    for (var j = 0; j < (f.slots || 3); j++) vals.push(getPath(data, f.id + '.' + j) || '');
    return vals;
  }

  function buildGroup(f) {
    var box = el('fieldset', { class: 'group' });
    box.appendChild(el('legend', { class: 'group-legend', text: f.label }));
    if (f.hint) box.appendChild(el('p', { class: 'hint tight', text: f.hint }));
    (f.fields || []).forEach(function (sub) {
      sub._id = uid();
      box.appendChild(buildAny(sub));
    });
    return box;
  }

  function buildRepeat(f) {
    var wrap = el('div', { class: 'field' });
    wrap.appendChild(labelNode(f, f.required));
    var h = hintNode(f.hint);
    if (h) wrap.appendChild(h);

    var list = el('div', { class: 'repeat-list' });
    wrap.appendChild(list);

    var hintCount = el('p', { class: 'repeat-hint' });
    wrap.appendChild(hintCount);

    var add = el('button', { type: 'button', class: 'btn-add' }, [
      el('span', { class: 'plus', 'aria-hidden': 'true', text: '+' }),
      el('span', { text: f.addLabel || 'Adicionar' })
    ]);
    wrap.appendChild(add);

    function rows() { return getPath(data, f.id) || []; }

    function refresh() {
      var c = list.children.length;
      if (f.max) {
        add.disabled = c >= f.max;
        add.setAttribute('aria-disabled', add.disabled ? 'true' : 'false');
      }
      hintCount.textContent = f.min
        ? (c < f.min
          ? 'Recomendado: ' + f.min + ' ou mais. Você adicionou ' + c + '.'
          : 'Você adicionou ' + c + '.')
        : 'Você adicionou ' + c + '.';
    }

    function addRow(focus) {
      var idx = list.children.length;
      var item = el('div', { class: 'repeat-item' });

      var head = el('div', { class: 'repeat-head' }, [
        el('span', { class: 'repeat-n', text: 'Item ' + (idx + 1) })
      ]);
      var del = el('button', { type: 'button', class: 'btn-del', text: 'Remover' });
      head.appendChild(del);
      item.appendChild(head);

      (f.itemFields || []).forEach(function (sub) {
        var c = {};
        Object.keys(sub).forEach(function (k) { c[k] = sub[k]; });
        c._id = uid();
        c._display = sub.label;
        c.id = f.id + '.' + idx + '.' + sub.id;
        c._key = sub.id;
        item.appendChild(buildAny(c));
      });

      list.appendChild(item);

      var arr = rows();
      arr[idx] = arr[idx] || {};
      setPath(data, f.id, arr);

      del.addEventListener('click', function () {
        var r = rows();
        r.splice(idx, 1);
        setPath(data, f.id, r);
        item.remove();
        Array.prototype.forEach.call(list.children, function (c, i) {
          $('.repeat-n', c).textContent = 'Item ' + (i + 1);
          rebindItem(c, i);
        });
        save();
        scheduleVisibility();
        refresh();
      });

      refresh();
      if (focus) {
        var first = item.querySelector('input:not([type=hidden]), textarea, select');
        if (first) first.focus();
      }
    }

    /* Reindexa os nomes após remover um item do meio. */
    function rebindItem(item, newIdx) {
      var inputs = $$('input[name], select[name], textarea[name]', item);
      inputs.forEach(function (i) {
        var parts = i.name.split('.');
        if (parts.length >= 4 && parts[0] === f.id) parts[1] = String(newIdx);
        i.name = parts.join('.');
        i.id = i.id.replace(new RegExp('^' + f.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '-?'), f.id + '-' + newIdx + '-');
      });
      $$('label[for]', item).forEach(function (l) {
        var m = l.getAttribute('for').match(new RegExp('^' + f.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '-'));
        if (m) l.setAttribute('for', l.getAttribute('for').replace(m[0], f.id + '-' + newIdx));
      });
    }

    add.addEventListener('click', function () { addRow(true); });

    var initial = f.min ? f.min : 1;
    for (var i = 0; i < initial; i++) addRow(false);
    refresh();

    wrap._sync = function (values) {
      while (list.children.length) list.removeChild(list.lastChild);
      /* Sem valores salvos, recria as linhas iniciais recomendadas
         (ex.: 5 serviços, 3 perguntas) em vez de deixar só uma. */
      var count = values && values.length ? values.length : (f.min || 1);
      for (var i = 0; i < count; i++) addRow(false);
      if (!values || !values.length) return;
      Array.prototype.forEach.call(list.children, function (item, idx) {
        var row = values[idx];
        if (!row) return;
        (f.itemFields || []).forEach(function (sub) {
          var v = row[sub.id];
          if (v === undefined || v === null || v === '') return;
          var base = f.id + '.' + idx + '.' + sub.id;
          var inputs = $$('[name="' + base + '"], [name="' + base + '.items"]', item);
          if (Array.isArray(v)) {
            inputs.forEach(function (i) { if (i.type === 'checkbox') i.checked = v.indexOf(i.value) > -1; });
            setPath(data, base, v);
          } else if (sub.type === 'checkbox') {
            inputs.forEach(function (i) { if (i.type === 'checkbox') i.checked = v === true; });
            setPath(data, base, v === true);
          } else if (sub.type === 'radio') {
            inputs.forEach(function (i) { if (i.type === 'radio') i.checked = i.value === v; });
            setPath(data, base, v);
          } else {
            inputs.forEach(function (i) {
              if (i.type !== 'checkbox' && i.type !== 'radio' && i.tagName !== 'BUTTON') i.value = v;
            });
            setPath(data, base, v);
          }
        });
      });
      refresh();
    };

    return wrap;
  }

  function buildHours(f) {
    var wrap = el('div', { class: 'field' });
    wrap.appendChild(labelNode(f, false));
    var h = hintNode(f.hint);
    if (h) wrap.appendChild(h);

    var table = el('div', { class: 'hours-table' });
    table.appendChild(el('div', { class: 'hours-head' }, [
      el('span', { text: 'Dia' }),
      el('span', { text: 'Atende' }),
      el('span', { text: 'Abre' }),
      el('span', { text: 'Fecha' }),
      el('span', { text: 'Pausa' }),
      el('span', { text: 'Observação' })
    ]));

    DAYS.forEach(function (d) {
      var row = el('div', { class: 'hours-row' });

      var dayBox = el('div', { class: 'hr-day' });
      dayBox.appendChild(el('span', { text: d.label }));

      var ynOpts = el('div', { class: 'opts yn hr-check' });
      [['sim', 'Sim'], ['nao', 'Não']].forEach(function (v) {
        var id = f._id + '-' + d.key + '-' + v[0];
        var input = el('input', { type: 'radio', id: id, name: 'horarios_semana.' + d.key + '.atende', value: v[0] });
        input.addEventListener('change', function () {
          ynOpts.classList.add('has-val');
          var obj = getPath(data, 'horarios_semana.' + d.key) || {};
          obj.atende = v[0];
          setPath(data, 'horarios_semana.' + d.key, obj);
          save();
        });
        ynOpts.appendChild(el('label', { class: 'opt', for: id }, [
          input, el('span', { class: 'mark', 'aria-hidden': 'true' }), el('span', { class: 'opt-txt', text: v[1] })
        ]));
      });
      dayBox.appendChild(ynOpts);
      row.appendChild(dayBox);

      var times = el('div', { class: 'hr-times' });
      [['abre', 'Abre'], ['fecha', 'Fecha'], ['pausa', 'Pausa (almoço)']].forEach(function (t) {
        var cell = el('div', {});
        cell.appendChild(el('label', { class: 'hr-label', for: f._id + '-' + d.key + '-' + t[0], text: t[1] }));
        var inp = el('input', { type: 'time', id: f._id + '-' + d.key + '-' + t[0], name: 'horarios_semana.' + d.key + '.' + t[0] });
        inp.addEventListener('change', function () {
          var obj = getPath(data, 'horarios_semana.' + d.key) || {};
          obj[t[0]] = inp.value;
          setPath(data, 'horarios_semana.' + d.key, obj);
          save();
        });
        cell.appendChild(inp);
        times.appendChild(cell);
      });
      row.appendChild(times);

      var obsCell = el('div', { class: 'hr-obs' });
      obsCell.appendChild(el('label', { class: 'hr-label', for: f._id + '-' + d.key + '-obs', text: 'Observação' }));
      var obs = el('input', {
        type: 'text', id: f._id + '-' + d.key + '-obs', maxlength: '120',
        name: 'horarios_semana.' + d.key + '.obs', placeholder: 'Ex.: só manhã'
      });
      obs.addEventListener('input', function () {
        var obj = getPath(data, 'horarios_semana.' + d.key) || {};
        obj.obs = obs.value;
        setPath(data, 'horarios_semana.' + d.key, obj);
        save();
      });
      obsCell.appendChild(obs);
      row.appendChild(obsCell);

      table.appendChild(row);
    });
    wrap.appendChild(table);

    var copy = el('button', { type: 'button', class: 'btn btn-ghost btn-block', text: 'Copiar para todos os dias úteis' });
    copy.style.marginTop = '14px';
    copy.addEventListener('click', function () {
      var src = getPath(data, 'horarios_semana.' + WEEKDAYS[0]);
      if (!src || (!src.atende && !src.abre)) {
        window.alert('Preencha a segunda-feira primeiro e depois use o botão para copiar.');
        return;
      }
      WEEKDAYS.forEach(function (k) {
        setPath(data, 'horarios_semana.' + k, JSON.parse(JSON.stringify(src)));
      });
      applyHours();
      save();
      announce('Horários copiados para os dias úteis.');
    });
    wrap.appendChild(copy);
    return wrap;
  }

  function applyHours() {
    var hs = getPath(data, 'horarios_semana');
    if (!hs) return;
    DAYS.forEach(function (d) {
      var o = hs[d.key];
      if (!o) return;
      $$('[name="horarios_semana.' + d.key + '.atende"]').forEach(function (i) {
        i.checked = i.value === o.atende;
        var box = i.closest('.opts');
        if (box) box.classList.toggle('has-val', i.checked);
      });
      ['abre', 'fecha', 'pausa', 'obs'].forEach(function (k) {
        var input = document.querySelector('[name="horarios_semana.' + d.key + '.' + k + '"]');
        if (input) input.value = o[k] || '';
      });
    });
  }

  function buildHolidays(f) {
    var wrap = el('div', { class: 'field' });
    wrap.appendChild(labelNode(f, false));
    var h = hintNode(f.hint);
    if (h) wrap.appendChild(h);

    var list = el('div', { class: 'holidays-list' });

    HOLIDAYS.forEach(function (hd) {
      var base = 'feriados.' + hd.key;
      var item = el('div', { class: 'holiday-item' });
      item.appendChild(el('p', { class: 'h-name', text: hd.label }));

      var opts = el('div', { class: 'opts yn' });
      [['sim', 'Atende'], ['nao', 'Não atende']].forEach(function (v) {
        var id = f._id + '-' + hd.key + '-' + v[0];
        var input = el('input', { type: 'radio', id: id, name: base + '.atende', value: v[0] });
        input.addEventListener('change', function () {
          opts.classList.add('has-val');
          var obj = getPath(data, base) || {};
          obj.atende = v[0];
          setPath(data, base, obj);
          save();
        });
        opts.appendChild(el('label', { class: 'opt', for: id }, [
          input, el('span', { class: 'mark', 'aria-hidden': 'true' }), el('span', { class: 'opt-txt', text: v[1] })
        ]));
      });
      item.appendChild(opts);

      var times = el('div', { class: 'holiday-times' });
      [['abre', 'Abre'], ['fecha', 'Fecha']].forEach(function (t) {
        var cell = el('div', {});
        cell.appendChild(el('label', { class: 'hr-label', for: f._id + '-' + hd.key + '-' + t[0], text: t[1] }));
        var inp = el('input', { type: 'time', id: f._id + '-' + hd.key + '-' + t[0], name: base + '.' + t[0] });
        inp.addEventListener('change', function () {
          var obj = getPath(data, base) || {};
          obj[t[0]] = inp.value;
          setPath(data, base, obj);
          save();
        });
        cell.appendChild(inp);
        times.appendChild(cell);
      });
      item.appendChild(times);

      var obsCell = el('div', { style: 'margin-top:12px' });
      obsCell.appendChild(el('label', { class: 'hr-label', for: f._id + '-' + hd.key + '-obs', text: 'Observação' }));
      var obs = el('input', { type: 'text', id: f._id + '-' + hd.key + '-obs', maxlength: '120', name: base + '.obs', placeholder: 'Ex.: atende até meio-dia' });
      obs.addEventListener('input', function () {
        var obj = getPath(data, base) || {};
        obj.obs = obs.value;
        setPath(data, base, obj);
        save();
      });
      obsCell.appendChild(obs);
      item.appendChild(obsCell);

      list.appendChild(item);
    });

    wrap.appendChild(list);
    return wrap;
  }

  /* ------------------------------------------------------------ ViaCEP */

  function wireCep(input) {
    var status = el('p', { class: 'hint tight', role: 'status', style: 'display:none' });
    input.parentNode.appendChild(status);

    input.addEventListener('blur', function () {
      var cep = onlyDigits(input.value);
      if (cep.length !== 8) return;

      status.style.display = 'block';
      status.textContent = 'Buscando endereço...';

      fetch('https://viacep.com.br/ws/' + cep + '/json/')
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j.erro) {
            status.textContent = 'Não encontrei esse CEP. Preencha o endereço à mão.';
            return;
          }
          var fills = [
            ['end_logradouro', j.logradouro],
            ['end_bairro', j.bairro],
            ['end_cidade', j.localidade],
            ['end_estado', j.uf]
          ];
          var filled = 0;
          fills.forEach(function (pair) {
            if (!pair[1]) return;
            var existing = getPath(data, pair[0]);
            if (existing && String(existing).trim()) return;
            var target = document.querySelector('[name="' + pair[0] + '"]');
            if (!target) return;
            target.value = pair[1];
            setPath(data, pair[0], pair[1]);
            filled++;
          });
          status.textContent = filled
            ? 'Endereço preenchido. Confira e ajuste se quiser.'
            : 'CEP encontrado, mas você já tinha preenchido o endereço, então não alterei nada.';
          save();
        })
        .catch(function () {
          status.textContent = 'Não consegui buscar o CEP agora. Preencha o endereço à mão.';
        });
    });
  }

  /* ------------------------------------------------------------ dispatcher */

  function buildAny(f) {
    var node;
    switch (f.type) {
      case 'notice': node = buildNotice(f); break;
      case 'textarea': node = buildTextarea(f); break;
      case 'select': node = buildSelect(f); break;
      case 'radio': node = buildChoices(f, 'radio'); break;
      case 'multi': node = buildChoices(f, 'multi'); break;
      case 'yesno': node = buildYesNo(f); break;
      case 'yesno-group': node = buildYesNoGroup(f); break;
      case 'checkbox': node = buildCheckbox(f); break;
      case 'colors': node = buildColors(f); break;
      case 'repeat': node = buildRepeat(f); break;
      case 'hours': node = buildHours(f); break;
      case 'holidays': node = buildHolidays(f); break;
      case 'group': node = buildGroup(f); break;
      default: node = buildInput(f); break;
    }

    if (f.showIf) registerVisibility(node, f.showIf);
    node._field = f;
    return node;
  }

  /* --------------------------------------------------------- validação */

  function clearFieldError(node) {
    if (!node) return;
    node.removeAttribute('aria-invalid');
    var wrap = node.closest ? node.closest('.field') : null;
    if (!wrap) return;
    var e = $('.err', wrap);
    if (e) e.classList.remove('show');
    var o = $('.opts', wrap);
    if (o) o.classList.remove('is-invalid');
  }

  function showFieldError(node, msg) {
    var wrap = node.closest ? node.closest('.field') : node.parentNode;
    if (!wrap) return;
    $$('input, select, textarea', wrap).forEach(function (i) { i.setAttribute('aria-invalid', 'true'); });
    var e = $('.err', wrap);
    if (e) {
      var span = e.querySelector('span:last-child');
      if (span && msg) span.textContent = msg;
      e.classList.add('show');
    }
    var o = $('.opts', wrap);
    if (o) o.classList.add('is-invalid');
  }

  function fieldHasValue(f) {
    var v = getPath(data, f.id);
    if (v === undefined || v === null) return false;
    if (Array.isArray(v)) {
      if (v.length === 0) return false;
      return v.some(function (item) {
        if (typeof item === 'string') return !!item.trim();
        if (item && typeof item === 'object') {
          return Object.keys(item).some(function (k) {
            var x = item[k];
            if (Array.isArray(x)) return x.length > 0;
            if (x && typeof x === 'object') return Object.keys(x).some(function (y) { return !!x[y]; });
            return x !== '' && x !== false && x !== null && x !== undefined;
          });
        }
        return !!item;
      });
    }
    if (typeof v === 'boolean') return v;
    return String(v).trim().length > 0;
  }

  function validateField(f, node) {
    var v = getPath(data, f.id);

    if (f.type === 'email' && v && !validEmail(v)) {
      showFieldError(node, 'Confira este e-mail.');
      return false;
    }
    if (f.type === 'url' && v && !validUrl(v)) {
      showFieldError(node, 'Confira este link. Ele deve começar com https://');
      return false;
    }

    if (!f.required) return true;

    if (!fieldHasValue(f)) {
      showFieldError(node, 'Este campo é obrigatório.');
      return false;
    }
    if (f.type === 'tel' && onlyDigits(v).length < 10) {
      showFieldError(node, 'Informe o telefone com DDD.');
      return false;
    }
    return true;
  }

  function validateStep(step) {
    var ok = true;
    var firstBad = null;

    (step._nodes || []).forEach(function (node) {
      var f = node._field;
      if (!f || !f.id || f.type === 'notice') return;
      if (node.classList.contains('hidden')) return;
      if (!validateField(f, node)) {
        ok = false;
        if (!firstBad) firstBad = node;
      }
    });

    if (!ok) {
      announce('Há campos obrigatórios para corrigir nesta etapa.');
      if (firstBad) {
        firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' });
        var focusable = $('input:not([type=hidden]), select, textarea', firstBad);
        if (focusable) setTimeout(function () { focusable.focus(); }, 320);
      }
    }
    return ok;
  }

  /* ---------------------------------------------------------- progresso */

  function renderProgress() {
    var vis = visibleSteps();
    var idx = vis.indexOf(STEPS[current]);
    if (idx < 0) idx = 0;
    var pct = Math.round(((idx + 1) / vis.length) * 100);

    var fill = $('#pFill');
    if (fill) fill.style.width = pct + '%';
    var p = $('#pPct');
    if (p) p.textContent = pct + '%';

    var c = $('#pCount');
    if (c) {
      c.textContent = '';
      c.appendChild(document.createTextNode('Etapa ' + (idx + 1) + ' de '));
      c.appendChild(el('b', { text: String(vis.length) }));
    }
    var n = $('#pName');
    if (n) {
      n.textContent = '';
      n.appendChild(el('span', { class: 'sn-label', text: STEPS[current].title }));
    }
    var bar = $('#bar');
    if (bar) bar.setAttribute('aria-valuenow', String(pct));
  }

  /* ------------------------------------------------------- render etapas */

  function buildActions(step) {
    var box = el('div', { class: 'actions' });

    var back = el('button', { type: 'button', class: 'btn btn-secondary', text: 'Voltar' });
    back.addEventListener('click', function () { goBack(); });

    var next = el('button', { type: 'button', class: 'btn btn-primary' });
    var isLast = visibleSteps().indexOf(step) === visibleSteps().length - 1;
    next.appendChild(el('span', { text: isLast ? 'Revisar tudo' : 'Continuar' }));
    next.addEventListener('click', function () {
      if (!validateStep(step)) return;
      goNext();
    });

    box.appendChild(back);
    box.appendChild(next);
    box._next = next;
    return box;
  }

  function buildSteps() {
    var main = $('#steps');
    STEPS.forEach(function (step, i) {
      var panel = el('section', {
        class: 'step-panel', id: 'step-' + step.id,
        role: 'region', 'aria-labelledby': 'h-' + step.id, tabindex: '-1'
      });

      var head = el('div', { class: 'step-head' });
      head.appendChild(el('span', { class: 'step-eyebrow' }, [
        el('span', { 'aria-hidden': 'true', text: '●' }),
        el('span', { text: 'Etapa ' + (i + 1) })
      ]));
      head.appendChild(el('h2', { id: 'h-' + step.id, text: step.title }));
      if (step.intro) head.appendChild(el('p', { class: 'step-intro', text: step.intro }));
      panel.appendChild(head);

      var bodyWrap = el('div', { class: 'step-body' });
      step._nodes = [];

      (step.fields || []).forEach(function (f) {
        if (!f._id) f._id = uid();
        var node = buildAny(f);
        step._nodes.push(node);
        bodyWrap.appendChild(node);
      });

      if (step.final) bodyWrap.appendChild(buildReview());

      var actions = buildActions(step);
      bodyWrap.appendChild(actions);
      panel.appendChild(bodyWrap);
      main.appendChild(panel);

      registerVisibility(panel, step.showIf);
    });
  }

  /* ------------------------------------------------------- navegação */

  /* `go` recebe a ETAPA (objeto), nunca um índice: índices mudam de
     significado conforme etapas condicionais aparecem/desaparecem. */
  function go(targetStep) {
    var vis = visibleSteps();
    if (!vis.length) return;
    if (vis.indexOf(targetStep) < 0) return;

    current = STEPS.indexOf(targetStep);
    var idx = vis.indexOf(targetStep);

    $$('.step-panel').forEach(function (p) { p.classList.remove('active'); });
    var panel = $('#step-' + targetStep.id);
    if (panel) {
      panel.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(function () { panel.focus({ preventScroll: true }); }, 60);
    }

    renderProgress();

    var backBtn = panel ? $('.actions .btn-secondary', panel) : null;
    if (backBtn) backBtn.style.visibility = idx === 0 ? 'hidden' : 'visible';

    if (targetStep.final) renderReview();

    save();
    announce('Etapa ' + (idx + 1) + ' de ' + vis.length + ': ' + targetStep.title);
  }

  function goNext() {
    var vis = visibleSteps();
    go(vis[Math.min(vis.indexOf(STEPS[current]) + 1, vis.length - 1)]);
  }

  function goBack() {
    var vis = visibleSteps();
    go(vis[Math.max(vis.indexOf(STEPS[current]) - 1, 0)]);
  }

  /* -------------------------------------------------------------- revisão */

  function fmtValue(f) {
    var v = getPath(data, f.id);
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) return '';

    if (f.type === 'radio') {
      var o = (f.options || []).filter(function (x) { return x.value === v; })[0];
      return o ? o.label : String(v);
    }

    if (f.type === 'multi') {
      var map = {};
      (f.options || []).forEach(function (x) { map[x.value] = x.label; });
      return (v || []).map(function (k) { return map[k] || k; }).join(' · ');
    }

    if (f.type === 'checkbox') return v === true ? 'Sim' : 'Não';

    if (f.type === 'yesno') return v === 'sim' ? 'Sim' : (v === 'nao' ? 'Não' : '');

    if (f.type === 'yesno-group') {
      var parts = [];
      (f.options || []).forEach(function (o) {
        if (v[o.id] === 'sim') parts.push(o.label + ': Sim');
        else if (v[o.id] === 'nao') parts.push(o.label + ': Não');
      });
      return parts.join(' · ');
    }

    if (f.type === 'colors') return (v || []).filter(Boolean).join(' · ');

    if (f.type === 'repeat') {
      return (v || []).map(function (item, i) {
        if (!item || typeof item !== 'object') return '';
        var bits = [];
        (f.itemFields || []).forEach(function (sub) {
          var x = item[sub.id];
          if (x === undefined || x === '' || x === null || x === false) return;
          if (Array.isArray(x)) {
            if (!x.length) return;
            var m = {};
            (sub.options || []).forEach(function (o) { m[o.value] = o.label; });
            bits.push(sub.label + ': ' + x.map(function (kk) { return m[kk] || kk; }).join(', '));
          } else if (x === true) {
            bits.push(sub.label);
          } else {
            bits.push(sub.label + ': ' + x);
          }
        });
        return bits.length ? (i + 1) + '. ' + bits.join(' — ') : '';
      }).filter(Boolean).join('\n');
    }

    if (f.type === 'hours') {
      return DAYS.map(function (d) {
        var o = (v || {})[d.key];
        if (!o || !o.atende) return '';
        var t = [];
        if (o.abre) t.push('abre ' + o.abre);
        if (o.fecha) t.push('fecha ' + o.fecha);
        if (o.pausa) t.push('pausa ' + o.pausa);
        if (o.obs) t.push(o.obs);
        return d.label + ': ' + (t.join(' · ') || 'atende');
      }).filter(Boolean).join('\n');
    }

    if (f.type === 'holidays') {
      return HOLIDAYS.map(function (hd) {
        var o = (v || {})[hd.key];
        if (!o || (!o.atende && !o.abre && !o.obs)) return '';
        if (o.atende === 'nao') return hd.label + ': não atende';
        var t = [];
        if (o.abre) t.push('abre ' + o.abre);
        if (o.fecha) t.push('fecha ' + o.fecha);
        if (o.obs) t.push(o.obs);
        return hd.label + ': ' + (t.join(' · ') || 'atende');
      }).filter(Boolean).join('\n');
    }

    return String(v);
  }

  function buildReview() {
    return el('div', { class: 'rev-list', id: 'revList' });
  }

  function renderReview() {
    var box = $('#revList');
    if (!box) return;
    box.innerHTML = '';

    visibleSteps().filter(function (s) { return !s.final; }).forEach(function (step) {
      var rows = [];

      (step._nodes || []).forEach(function (node) {
        var f = node._field;
        if (!f || !f.id || f.type === 'notice') return;
        if (node.classList.contains('hidden')) return;

        if (f.type === 'group') {
          (f.fields || []).forEach(function (sub) {
            var v = fmtValue(sub);
            if (v && v.trim()) rows.push({ k: sub.label, v: v });
          });
          return;
        }
        var v = fmtValue(f);
        if (v && v.trim()) rows.push({ k: labelText(f), v: v });
      });

      var group = el('div', { class: 'rev-group' });
      var head = el('div', { class: 'rev-head' });

      var title = el('div', { class: 'rev-title' });
      title.appendChild(el('span', { class: 'rt-n', text: 'Etapa ' + (STEPS.indexOf(step) + 1) }));
      title.appendChild(el('span', { class: 'rt-name', text: step.short || step.title }));
      head.appendChild(title);

      var edit = el('button', { type: 'button', class: 'btn-edit', text: 'Editar' });
      edit.addEventListener('click', function () { go(step); });
      head.appendChild(edit);
      group.appendChild(head);

      if (!rows.length) {
        group.appendChild(el('p', { class: 'rev-empty', text: 'Nada preenchido nesta etapa.' }));
      } else {
        var body = el('div', { class: 'rev-body' });
        rows.forEach(function (r) {
          var row = el('div', { class: 'rev-row' });
          row.appendChild(el('div', { class: 'rev-k', text: r.k }));
          row.appendChild(el('div', { class: 'rev-v', text: r.v }));
          body.appendChild(row);
        });
        group.appendChild(body);
      }
      box.appendChild(group);
    });
  }

  /* --------------------------------------------------------------- envio */

  function payload() {
    return {
      negocio: { nome: data.negocio_nome || '', gmn_existe: data.gmn_existe || '' },
      resumo_copy: {
        objetivo_site: data.objetivo_principal || '',
        objetivo_outro: data.objetivo_outro || '',
        forma_conversao: (data.conversao_canais || []).join(', '),
        publico_ideal: data.publico_ideal || '',
        dor_principal: data.dor_principal || '',
        resultado_buscado: data.resultado_buscado || '',
        diferenciais: [data.diferencial_1, data.diferencial_2, data.diferencial_3].filter(Boolean).join(' | '),
        provas_sociais: (data.provas_sociais || []).join(', '),
        tom_de_voz: (data.tom_voz || []).join(', '),
        servico_principal: data.servico_principal || '',
        servico_mais_vende: data.servico_mais_vende || ''
      },
      contato_dev: {
        nome: data.responsavel_nome || '',
        email: data.contato_email_dev || '',
        telefone: data.contato_telefone_cliente || ''
      },
      consentimento: {
        lgpd: !!data.consentimento_lgpd,
        enviar_copia: !!data.enviar_copia,
        email_copia: data.enviar_copia ? (data.contato_email_dev || '') : ''
      },
      respostas: data
    };
  }

  function slugify(s) {
    return (String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)) || 'negocio';
  }

  function downloadJson() {
    var blob = new Blob([JSON.stringify(payload(), null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = el('a', { href: url, download: 'briefing-' + slugify(data.negocio_nome) + '.json' });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function copyJson() {
    var body = JSON.stringify(payload(), null, 2);
    function legacy() {
      var ta = el('textarea', { style: 'position:fixed;opacity:0;top:0;left:0' });
      ta.value = body;
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      announce(ok ? 'Respostas copiadas.' : 'Não consegui copiar. Use "Baixar JSON".');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(body).then(function () {
        announce('Respostas copiadas para a área de transferência.');
      }).catch(legacy);
    } else legacy();
  }

  function showFallback(reason) {
    var fb = $('#fallback');
    if (!fb) return;
    var msg = $('#fallbackMsg');
    if (msg) msg.textContent = reason;
    fb.classList.add('show');
    fb.scrollIntoView({ behavior: 'smooth', block: 'center' });
    announce('Não foi possível enviar agora. Use as opções abaixo para não perder suas respostas.');
  }

  function successScreen() {
    var wiz = $('#wizard');
    if (wiz) wiz.style.display = 'none';
    var done = $('#done');
    if (done) {
      done.classList.add('active');
      done.focus();
    }
    var note = $('#copyNote');
    if (note) {
      note.textContent = data.enviar_copia
        ? 'Também enviei uma cópia para ' + (data.contato_email_dev || 'o seu e-mail') + '.'
        : 'Você optou por não receber uma cópia por e-mail.';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function submit() {
    if (submitting) return;

    var hp = $('#website');
    if (hp && hp.value) return;

    var finalStep = STEPS.filter(function (s) { return s.final; })[0];
    if (finalStep && !validateStep(finalStep)) return;

    if (!CONFIG.apiUrl) {
      showFallback('O envio automático ainda não foi ativado neste site. Nada se perdeu: baixe o arquivo abaixo e envie para mim por e-mail ou WhatsApp.');
      return;
    }

    submitting = true;
    var btn = $('#submitBtn');
    var lbl = $('#submitLabel');
    var spin = $('#submitSpin');
    if (btn) btn.disabled = true;
    if (spin) spin.style.display = 'inline-flex';
    if (lbl) lbl.textContent = 'Enviando...';
    announce('Enviando suas respostas.');

    function done() {
      submitting = false;
      if (btn) btn.disabled = false;
      if (spin) spin.style.display = 'none';
      if (lbl) lbl.textContent = 'Enviar briefing';
    }

    fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload())
    })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          return { status: r.status, body: j };
        });
      })
      .then(function (res) {
        if (res.status >= 200 && res.status < 300) {
          clearDraft();
          successScreen();
          return;
        }
        if (res.status === 429) {
          showFallback('Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo. Enquanto isso, baixe o arquivo abaixo para não perder nada.');
        } else {
          showFallback('Não consegui enviar agora. Seus dados continuam salvos neste navegador — baixe o arquivo abaixo ou copie e envie para mim por e-mail ou WhatsApp.');
        }
        done();
      })
      .catch(function () {
        showFallback('Não consegui me conectar ao servidor. Seus dados continuam salvos neste navegador — baixe o arquivo abaixo ou copie e envie para mim por e-mail ou WhatsApp.');
        done();
      });
  }

  /* ------------------------------------------------------ restauração */

  function applyDefaults() {
    STEPS.forEach(function (step) {
      (step._nodes || []).forEach(function (node) {
        var f = node._field;
        if (!f || f.default === undefined) return;
        if (getPath(data, f.id) === undefined) setPath(data, f.id, f.default);
        if (f.type === 'checkbox') {
          var c = $('input[type=checkbox]', node);
          if (c) c.checked = f.default === true;
        }
      });
    });
  }

  function restoreValues() {
    STEPS.forEach(function (step) {
      (step._nodes || []).forEach(function (node) {
        var f = node._field;
        if (!f || !f.id) return;
        if (['notice', 'group', 'hours', 'holidays', 'repeat'].indexOf(f.type) > -1) return;

        if (f.type === 'yesno-group') {
          var obj = getPath(data, f.id) || {};
          $$('input[type=radio]', node).forEach(function (i) {
            if (obj[i.name.split('.').pop()] === i.value) i.checked = true;
          });
          return;
        }

        if (f.type === 'radio') {
          var val = getPath(data, f.id);
          $$('input[type=radio]', node).forEach(function (i) { i.checked = i.value === val; });
          return;
        }

        if (f.type === 'multi') {
          var arr = getPath(data, f.id) || [];
          $$('input[type=checkbox]', node).forEach(function (i) { i.checked = arr.indexOf(i.value) > -1; });
          return;
        }

        if (f.type === 'checkbox') {
          var cb = $('input[type=checkbox]', node);
          if (cb) cb.checked = getPath(data, f.id) === true;
          return;
        }

        if (f.type === 'colors') {
          var cols = getPath(data, f.id) || [];
          var pickers = $$('input[type=color]', node);
          var texts = $$('input[type=text]', node);
          cols.forEach(function (c, i) {
            if (texts[i]) texts[i].value = c || '';
            if (c && /^#[0-9a-f]{6}$/i.test(c) && pickers[i]) pickers[i].value = c;
          });
          return;
        }

        var target = $('input, select, textarea', node);
        if (target) target.value = getPath(data, f.id) || '';
      });
    });

    STEPS.forEach(function (step) {
      (step._nodes || []).forEach(function (node) {
        var f = node._field;
        if (f && f.type === 'repeat' && node._sync) node._sync(getPath(data, f.id));
      });
    });

    applyHours();
    applyHolidays();
  }

  function applyHolidays() {
    var fs = getPath(data, 'feriados');
    if (!fs) return;
    HOLIDAYS.forEach(function (hd) {
      var o = fs[hd.key];
      if (!o) return;
      $$('[name="feriados.' + hd.key + '.atende"]').forEach(function (i) {
        i.checked = i.value === o.atende;
        var box = i.closest('.opts');
        if (box) box.classList.toggle('has-val', i.checked);
      });
      ['abre', 'fecha', 'obs'].forEach(function (k) {
        var input = document.querySelector('[name="feriados.' + hd.key + '.' + k + '"]');
        if (input) input.value = o[k] || '';
      });
    });
  }

  /* ------------------------------------------------------ inicialização */

  function init() {
    var saved = load();
    if (saved) {
      data = saved.data || {};
      hasDraft = true;
    }

    buildSteps();
    applyDefaults();
    restoreValues();
    applyVisibility();

    if (saved && typeof saved.step === 'number' && saved.step > 0) {
      current = Math.min(saved.step, STEPS.length - 1);
    }

    var finalStep = STEPS.filter(function (s) { return s.final; })[0];
    if (finalStep) {
      var panel = $('#step-' + finalStep.id);
      var actions = panel ? $('.actions', panel) : null;
      if (actions) {
        var btn = el('button', { type: 'button', class: 'btn btn-primary btn-block', id: 'submitBtn' }, [
          el('span', { id: 'submitSpin', class: 'spinner', style: 'display:none', 'aria-hidden': 'true' }),
          el('span', { id: 'submitLabel', text: 'Enviar briefing' })
        ]);
        btn.addEventListener('click', submit);
        actions.innerHTML = '';
        actions.appendChild(el('div', { class: 'submit-area', style: 'width:100%' }, [btn]));
      }
    }

    booting = false;

    if (hasDraft && Object.keys(data).length) {
      var pill = $('#draftNote');
      if (pill) pill.classList.remove('hidden');
    }

    /* Se um rascunho salvou uma etapa que agora está oculta (ex.: o cliente
     passou de "não" para "sim" no Perfil da Empresa), cai na 1ª visível. */
    var vis = visibleSteps();
    if (vis.indexOf(STEPS[current]) < 0) current = STEPS.indexOf(vis[0]);
    go(STEPS[current]);
  }

  /* -------------------------------------------------------------- wiring */

  document.addEventListener('DOMContentLoaded', function () {
    init();

    var clear = $('#btnClear');
    if (clear) {
      clear.addEventListener('click', function () {
        var ok = window.confirm(
          'Tem certeza que quer apagar TODAS as respostas?\n\n' +
          'Isso não pode ser desfeito. Se quiser guardar antes, volte à etapa final e use "Copiar respostas".'
        );
        if (!ok) return;
        clearDraft();
        window.location.reload();
      });
    }

    var dl = $('#btnDownload');
    if (dl) dl.addEventListener('click', downloadJson);
    var cp = $('#btnCopy');
    if (cp) cp.addEventListener('click', copyJson);
    var ddl = $('#doneDownload');
    if (ddl) ddl.addEventListener('click', downloadJson);
  });

  window.addEventListener('beforeunload', function () { save(); });
})();