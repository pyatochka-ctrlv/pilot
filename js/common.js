/* Спільні константи й утиліти для екрана та пульта */
window.ZT = window.ZT || {};
(function (ZT) {
  'use strict';

  ZT.C = {
    cobalt: '#2B4BF2', sun: '#FFC629', ink: '#14161F', paper: '#F3F4F7', white: '#FFFFFF',
    teal: '#14998F', tomato: '#F0432E', tomatoL: '#F47B6D'
  };

  ZT.STEPS = ['Кейс', 'Датчик', 'Сигнали', 'Фраза і кнопка'];
  ZT.ZONES = ['Голова й думки', 'Обличчя', 'Горло й голос', 'Серце', 'Живіт', 'Руки', 'Ноги'];
  ZT.LETTERS = ['А', 'Б'];

  // Зони датчика: колір + текст поверх кольору (лише Ink або білий)
  ZT.zoneOf = function (v) {
    if (v <= 3) return { key: 'teal', color: ZT.C.teal, fg: ZT.C.white, label: 'легке', range: '1–3' };
    if (v <= 6) return { key: 'sun', color: ZT.C.sun, fg: ZT.C.ink, label: 'робоча зона', range: '4–6' };
    if (v <= 8) return { key: 'tomL', color: ZT.C.tomatoL, fg: ZT.C.ink, label: 'сильне', range: '7–8' };
    return { key: 'tomato', color: ZT.C.tomato, fg: ZT.C.white, label: 'дуже сильне', range: '9–10' };
  };
  ZT.GAUGE_ZONES = [1, 4, 7, 9].map(ZT.zoneOf);

  ZT.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  ZT.blankCloud = function () {
    return { gauge: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], zones: [false, false, false, false, false, false, false], phrases: [0, 0, 0], pick: null, trainer: null };
  };
  ZT.cloudState = function (s, id) {
    var c = s.clouds && s.clouds[id];
    return c ? c : ZT.blankCloud();
  };

  /* Чи можна запустити кнопку: вона є в buttons.json і має unlocked: true */
  ZT.isUnlocked = function (data, btnId) {
    var b = data.buttonById[btnId];
    return !!(b && b.unlocked === true);
  };

  ZT.trainerElapsed = function (cs) {
    return cs && cs.trainer ? (Date.now() - cs.trainer.startedAt) / 1000 : -1;
  };
  ZT.trainerRunning = function (cs) {
    if (!cs || !cs.trainer) return false;
    var t = ZT.trainerElapsed(cs);
    return t >= 0 && t < ZT.trainerDef(cs.trainer.btn).total;
  };
  ZT.isCalm = function (cs) {
    if (!cs || !cs.trainer) return false;
    return ZT.trainerElapsed(cs) >= ZT.trainerDef(cs.trainer.btn).total;
  };

  /* Лінійні іконки: сітка 48, лінія 3.5, круглі кінці */
  var P = {
    reset: '<path d="M38.5 26A14.5 14.5 0 1 1 33.8 13.2"/><path d="M35 5.5v8.5h-8.5"/><path d="M17 24h4M24 24h0M27 24h4"/>',
    feet: '<path d="M14.5 43C10 43 7.5 39 7.5 33.5 7.5 26 10.5 19 15 19s7.5 6.5 7.5 13.5c0 6-3 10.5-8 10.5z"/><path d="M33.5 35C29 35 26.5 31 26.5 25.5 26.5 18 29.5 11 34 11s7.5 6.5 7.5 13.5c0 6-3 10.5-8 10.5z"/>',
    square: '<rect x="10" y="10" width="28" height="28" rx="4"/><path d="M21 6l4 4-4 4"/><path d="M42 21l-4 4-4-4"/>',
    lemons: '<path d="M8.5 30c-1-9 7-17 16-17 8 0 14 6 14 13 0 9-8 14-16 14-6 0-13-3-14-10z"/><path d="M36 15c1.5-4 5-6 8-5.5-.5 3.5-3.5 6-7.5 6.5"/><path d="M17 27c1-3 3-5 6-6"/>',
    radar: '<path d="M4 24s7.5-12 20-12 20 12 20 12-7.5 12-20 12S4 24 4 24z"/><circle cx="24" cy="24" r="5.5"/>',
    switch: '<path d="M8 16h30"/><path d="M31 9l7 7-7 7"/><path d="M40 32H10"/><path d="M17 25l-7 7 7 7"/>',
    lock: '<rect x="11" y="21" width="26" height="19" rx="5"/><path d="M17 21v-5a7 7 0 0 1 14 0v5"/><path d="M24 29v4"/>',
    check: '<path d="M11 25l8.5 8.5L37 15"/>',
    soundOn: '<path d="M7 19h7l10-8v26l-10-8H7z"/><path d="M31 18c1.8 1.8 3 3.8 3 6s-1.2 4.2-3 6"/><path d="M36.5 12.5c3.3 3 5 7 5 11.5s-1.7 8.5-5 11.5"/>',
    soundOff: '<path d="M7 19h7l10-8v26l-10-8H7z"/><path d="M32 19l10 10M42 19L32 29"/>',
    ship: '<path d="M5 27.5C5 25 7 23 10 23h23c5.5 0 10 2 10 4.5S38.5 32 33 32H10c-3 0-5-2-5-4.5z"/><path d="M19 32l-4.5 9h5.5l8.5-9"/><path d="M19 23l-4-8h5l8 8"/><path d="M10 23L7 15h4l6 8"/><path d="M31 27.5h.2M36 27.5h.2"/>',
    map: '<path d="M6 12l12-5 12 5 12-5v29l-12 5-12-5-12 5z"/><path d="M18 7v29M30 12v29"/>',
    arrow: '<path d="M8 24h31"/><path d="M28 13l11 11-11 11"/>',
    play: '<path d="M15 9.5v29l24-14.5z"/>',
    stop: '<rect x="12" y="12" width="24" height="24" rx="4"/>',
    flag: '<path d="M13 43V6"/><path d="M13 8h22l-5 7.5 5 7.5H13"/>',
    exit: '<path d="M20 8H11a3 3 0 0 0-3 3v26a3 3 0 0 0 3 3h9"/><path d="M20 24h21"/><path d="M33 16l8 8-8 8"/>'
  };
  ZT.icon = function (name, cls) {
    return '<svg class="ico ' + (cls || '') + '" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || P.lock) + '</svg>';
  };
  ZT.hasIcon = function (name) { return !!P[name]; };

  /* М'яка «трубка» — об'ємна округла лінія (декор) */
  ZT.tube = function (d, color, w, viewBox, cls) {
    var o = (w * 0.17).toFixed(1);
    return '<svg class="tube ' + (cls || '') + '" viewBox="' + viewBox + '" aria-hidden="true" fill="none" stroke-linecap="round">' +
      '<path d="' + d + '" stroke="' + color + '" stroke-width="' + w + '"/>' +
      '<path d="' + d + '" stroke="#FFFFFF" stroke-opacity=".3" stroke-width="' + (w * 0.22).toFixed(1) + '" transform="translate(-' + o + ' -' + o + ')"/>' +
      '</svg>';
  };

  /* Вписати текст у блок: зменшує шрифт від max до min */
  ZT.fit = function (el, max, min) {
    if (!el) return;
    var s = max;
    el.style.fontSize = s + 'px';
    while (s > min && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)) {
      s -= 1;
      el.style.fontSize = s + 'px';
    }
  };
})(window.ZT);
