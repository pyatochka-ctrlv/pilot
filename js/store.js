/* Стан гри: один JSON-об'єкт у localStorage + синхронізація вкладок */
(function (ZT) {
  'use strict';
  var KEY = 'zt-state-v1';
  var MSG_KEY = 'zt-msg-v1';
  var CHANNEL = 'zt-channel-v1';

  function blank() {
    return { v: 1, rev: 0, lesson: Date.now(), view: 'map', cloudId: null, step: 0, done: [], sound: false, clouds: {} };
  }
  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function write(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function parse(raw) {
    if (!raw) return null;
    try { var s = JSON.parse(raw); return s && s.v === 1 ? s : null; } catch (e) { return null; }
  }
  function normalize(s) {
    var b = blank();
    for (var k in b) if (!(k in s)) s[k] = b[k];
    return s;
  }

  var state = normalize(parse(read(KEY)) || blank());
  var stateFns = [], msgFns = [];
  var bc = null;
  try { if ('BroadcastChannel' in window) bc = new BroadcastChannel(CHANNEL); } catch (e) { bc = null; }

  function emit() { stateFns.forEach(function (f) { f(state); }); }

  function adopt(s) {
    if (!s || s.v !== 1 || s.rev <= state.rev) return;
    state = normalize(s);
    emit();
  }

  function handleMsg(m) {
    if (!m) return;
    if (m.kind === 'state') adopt(m.state);
    else msgFns.forEach(function (f) { f(m); });
  }

  if (bc) bc.onmessage = function (e) { handleMsg(e.data); };

  // Fallback і другий канал: подія storage приходить в інші вкладки
  window.addEventListener('storage', function (e) {
    if (e.key === KEY && e.newValue) adopt(parse(e.newValue));
    else if (e.key === MSG_KEY && e.newValue && !bc) {
      try { handleMsg(JSON.parse(e.newValue)); } catch (err) { /* ignore */ }
    }
  });

  ZT.store = {
    get: function () { return state; },
    /* mutator змінює копію стану; rev завжди росте */
    commit: function (mutator) {
      var s = JSON.parse(JSON.stringify(state));
      mutator(s);
      s.rev = state.rev + 1;
      s.updatedAt = Date.now();
      state = s;
      write(KEY, JSON.stringify(s));
      if (bc) { try { bc.postMessage({ kind: 'state', state: s }); } catch (e) { /* ignore */ } }
      emit();
    },
    on: function (f) { stateFns.push(f); },
    onMsg: function (f) { msgFns.push(f); },
    send: function (m) {
      if (bc) { try { bc.postMessage(m); return; } catch (e) { /* fallthrough */ } }
      m.nonce = Math.random();
      write(MSG_KEY, JSON.stringify(m));
    },
    blank: blank,
    hasChannel: !!bc
  };
})(window.ZT);
