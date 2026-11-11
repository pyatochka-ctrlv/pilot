/* ЕКРАН — те, що бачать діти. Лише показує стан; змінює стан тільки пульт. */
(function (ZT) {
  'use strict';
  var esc = ZT.esc, icon = ZT.icon, C = ZT.C;
  var D, stage, view, overlay, hint;
  var lastKey = null, prev = null;
  var ship = { done: null, len: 0, anim: null, el: null, icon: null, path: null, slots: null };
  var needle = null;       // міні-датчик у кроці 4
  var trainerUI = null;    // поточний оверлей тренажера
  var calmPrev = null;

  /* ---------- геометрія датчика ---------- */
  function pt(cx, cy, r, deg) { var a = deg * Math.PI / 180; return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; }
  function f(n) { return n.toFixed(1); }
  function wedge(cx, cy, r0, r1, d0, d1) {
    var a = pt(cx, cy, r1, d0), b = pt(cx, cy, r1, d1), c = pt(cx, cy, r0, d1), d = pt(cx, cy, r0, d0);
    return 'M' + f(a[0]) + ' ' + f(a[1]) + 'A' + r1 + ' ' + r1 + ' 0 0 1 ' + f(b[0]) + ' ' + f(b[1]) +
      'L' + f(c[0]) + ' ' + f(c[1]) + 'A' + r0 + ' ' + r0 + ' 0 0 0 ' + f(d[0]) + ' ' + f(d[1]) + 'Z';
  }
  function gaugeArc(cx, cy, r0, r1, nums, numSize) {
    var out = '';
    for (var i = 1; i <= 10; i++) {
      var z = ZT.zoneOf(i), d0 = 180 - 18 * (i - 1) - 0.9, d1 = 180 - 18 * i + 0.9;
      out += '<path d="' + wedge(cx, cy, r0, r1, d0, d1) + '" fill="' + z.color + '" stroke="' + C.ink + '" stroke-width="3" stroke-linejoin="round"/>';
      if (nums) {
        var p = pt(cx, cy, (r0 + r1) / 2, 180 - 18 * (i - 0.5));
        out += '<text x="' + f(p[0]) + '" y="' + f(p[1]) + '" fill="' + z.fg + '" class="g-num" font-size="' + numSize + '" text-anchor="middle" dominant-baseline="central">' + i + '</text>';
      }
    }
    return out;
  }

  /* ---------- каркас ---------- */
  function scale() {
    var k = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    stage.style.transform = 'translate(-50%,-50%) scale(' + k + ')';
  }

  function render(s) {
    var cloud = s.cloudId ? D.cloudById[s.cloudId] : null;
    var key = (s.view === 'cloud' && cloud) ? ('c' + cloud.id + '-' + s.step) : 'map';
    if (key !== lastKey) {
      lastKey = key;
      needle = null;
      if (key === 'map') buildMap(s); else buildCloud(s, cloud);
    }
    if (key === 'map') updateMap(s); else updateCloud(s, cloud);
    updateTrainer(s, true);
    updateHint(s);
    playDiff(prev, s);
    prev = s;
  }

  function playDiff(a, b) {
    if (!a || !b.sound) return;
    if (b.lesson !== a.lesson) return;
    if (b.done.length > a.done.length) { ZT.sound.play('exit'); return; }
    if (b.view === 'cloud' && (a.view !== 'cloud' || a.cloudId !== b.cloudId)) { ZT.sound.play('enter'); return; }
    if (b.view === 'cloud' && a.step !== b.step) { ZT.sound.play('step'); return; }
    if (b.cloudId && a.cloudId === b.cloudId) {
      var x = ZT.cloudState(a, b.cloudId), y = ZT.cloudState(b, b.cloudId);
      var sum = function (arr) { return arr.reduce(function (p, q) { return p + q; }, 0); };
      if (y.zones.some(function (z, i) { return z && !x.zones[i]; })) ZT.sound.play('tick');
      else if (sum(y.gauge) > sum(x.gauge) || sum(y.phrases) > sum(x.phrases)) ZT.sound.play('pop');
      else if (y.pick !== x.pick) ZT.sound.play('step');
    }
  }

  function updateHint(s) {
    hint.hidden = !(s.sound && ZT.sound.locked());
  }

  /* ---------- КАРТА ---------- */
  var PTS = [[86, 262], [250, 268], [500, 232], [760, 272], [1050, 250], [1060, 456], [770, 476], [480, 440], [196, 548], [520, 628], [1150, 612]];
  var CLOUD_D = 'M-58 40H58C80 40 92 14 75-3 77-29 52-44 30-33 20-57-18-61-33-35-57-41-79-21-71 3-90 11-84 40-58 40Z';

  function catmull(pts) {
    var segs = [];
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      var c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      var c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      segs.push('C' + f(c1[0]) + ' ' + f(c1[1]) + ' ' + f(c2[0]) + ' ' + f(c2[1]) + ' ' + p2[0] + ' ' + p2[1]);
    }
    return { full: 'M' + pts[0][0] + ' ' + pts[0][1] + segs.join(''), segs: segs };
  }

  function buildMap(s) {
    var n = D.clouds.length;
    var pts = PTS.slice(0, n + 1).concat([PTS[PTS.length - 1]]);
    var route = catmull(pts);
    var clouds = D.clouds.map(function (c, i) {
      var p = pts[i + 1];
      return '<g class="m-cloud" data-id="' + c.id + '" transform="translate(' + p[0] + ' ' + p[1] + ')">' +
        '<path class="m-ring" d="' + CLOUD_D + '"/>' +
        '<path class="m-shape" d="' + CLOUD_D + '"/>' +
        '<text class="m-num" y="10" text-anchor="middle" dominant-baseline="middle">' + c.id + '</text>' +
        '<g class="m-done" transform="translate(62 -34)"><circle r="21"/><path d="M-9 1l6 6 12-13"/></g>' +
        '</g>';
    }).join('');
    var st = pts[0], fin = pts[pts.length - 1];
    view.className = 'view view-map';
    view.innerHTML =
      ZT.tube('M60 -40C150 90 330 40 420 150', C.cobalt, 46, '0 0 460 200', 'tube-map-a') +
      ZT.tube('M20 120C80 40 160 60 200 10', C.sun, 34, '0 0 220 140', 'tube-map-b') +
      '<header class="map-head">' +
        '<h1 class="map-title">Увага, <span class="hl">турбулентність</span>!</h1>' +
        '<p class="map-sub"><span class="pill" id="mapProgress"></span><span id="mapSubText"></span></p>' +
      '</header>' +
      '<svg class="map-svg" viewBox="0 0 1280 720" aria-hidden="true">' +
        '<path class="m-route" d="' + route.full + '"/>' +
        '<path id="mRoute" d="' + route.full + '" fill="none" stroke="none"/>' +
        '<circle cx="' + st[0] + '" cy="' + st[1] + '" r="10" class="m-start"/>' +
        '<text x="' + st[0] + '" y="' + (st[1] + 70) + '" class="m-label" text-anchor="middle">СТАРТ</text>' +
        '<g transform="translate(' + fin[0] + ' ' + fin[1] + ')" class="m-finish"><circle r="32"/><g transform="translate(-20 -22) scale(.85)" class="m-flag">' + flagPaths() + '</g></g>' +
        '<text x="' + fin[0] + '" y="' + (fin[1] + 72) + '" class="m-label" text-anchor="middle">ЧИСТЕ НЕБО</text>' +
        clouds +
        '<g id="mShip" class="m-ship"><circle r="36"/><g class="m-ship-ico"><g transform="translate(-24 -24)">' + shipPaths() + '</g></g></g>' +
      '</svg>';

    // довжини сегментів — щоб ставити корабель між хмарами
    var svg = view.querySelector('.map-svg');
    ship.path = svg.querySelector('#mRoute');
    ship.el = svg.querySelector('#mShip');
    ship.icon = svg.querySelector('.m-ship-ico');
    var cum = [0], acc = 0, tmp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    svg.appendChild(tmp);
    for (var i = 0; i < route.segs.length; i++) {
      tmp.setAttribute('d', 'M' + pts[i][0] + ' ' + pts[i][1] + route.segs[i]);
      var l = tmp.getTotalLength();
      acc += l; cum.push(acc);
    }
    svg.removeChild(tmp);
    // позиція для k пройдених хмар: 0 — старт, n — фініш, інакше між хмарою k і k+1
    ship.slots = [];
    for (var k = 0; k <= n; k++) {
      if (k === 0) ship.slots.push(0);
      else if (k === n) ship.slots.push(cum[cum.length - 1]);
      else ship.slots.push((cum[k] + cum[k + 1]) / 2);
    }
    ship.anim = null;
    placeShip(ship.done == null ? 0 : ship.slots[Math.min(ship.done, n)]);
  }
  function shipPaths() {
    return '<path d="M5 27.5C5 25 7 23 10 23h23c5.5 0 10 2 10 4.5S38.5 32 33 32H10c-3 0-5-2-5-4.5z"/><path d="M19 32l-4.5 9h5.5l8.5-9"/><path d="M19 23l-4-8h5l8 8"/><path d="M10 23L7 15h4l6 8"/><path d="M31 27.5h.2M36 27.5h.2"/>';
  }
  function flagPaths() { return '<path d="M13 43V6"/><path d="M13 8h22l-5 7.5 5 7.5H13"/>'; }

  function placeShip(len) {
    if (!ship.path) return;
    ship.len = len;
    var total = ship.path.getTotalLength();
    var p = ship.path.getPointAtLength(Math.max(0, Math.min(total, len)));
    var q = ship.path.getPointAtLength(Math.max(0, Math.min(total, len + 2)));
    var r = ship.path.getPointAtLength(Math.max(0, Math.min(total, len - 2)));
    var ang = Math.atan2(q.y - r.y, q.x - r.x) * 180 / Math.PI;
    ship.el.setAttribute('transform', 'translate(' + f(p.x) + ' ' + f(p.y) + ')');
    ship.icon.setAttribute('transform', 'rotate(' + f(ang) + ')');
  }

  function updateMap(s) {
    var n = D.clouds.length, k = Math.min(s.done.length, n);
    view.querySelectorAll('.m-cloud').forEach(function (g) {
      var id = Number(g.getAttribute('data-id'));
      g.classList.toggle('is-done', s.done.indexOf(id) >= 0);
      g.classList.toggle('is-current', s.cloudId === id && s.done.indexOf(id) < 0);
    });
    document.getElementById('mapProgress').textContent = 'ПРОЙДЕНО ' + k + ' / ' + n;
    document.getElementById('mapSubText').textContent = k >= n
      ? 'Ура! Екіпаж провів корабель крізь усю зону.'
      : 'Кожна хмара — ситуація, де треба заговорити.';
    var target = ship.slots[k];
    if (ship.done == null || k < ship.done) placeShip(target);
    else if (k > ship.done) ship.anim = { from: ship.len, to: target, t0: performance.now(), dur: 2200 };
    ship.done = k;
  }

  /* ---------- ХМАРА ---------- */
  function header(cloud, step) {
    var tr = ZT.STEPS.map(function (name, i) {
      var cls = i < step ? 'is-past' : (i === step ? 'is-now' : '');
      return '<li class="' + cls + '"><span class="tr-n">' + (i + 1) + '</span>' + (i === step ? '<span class="tr-l">' + esc(name) + '</span>' : '') + '</li>';
    }).join('');
    return '<header class="c-head">' +
      '<span class="ship-badge js-shake">' + icon('ship') + '</span>' +
      '<span class="pill">ХМАРА ' + cloud.id + '</span>' +
      '<h2 class="c-title js-fit-title">' + esc(cloud.title) + '</h2>' +
      '<ol class="tracker">' + tr + '</ol>' +
      '</header>';
  }

  function buildCloud(s, cloud) {
    var step = s.step;
    view.className = 'view view-cloud step-' + step;
    if (step === 0) {
      view.innerHTML =
        '<section class="case-card enter-shake">' +
          ZT.tube('M30 170C80 60 200 120 260 30', C.sun, 40, '0 0 300 200', 'tube-case') +
          '<div class="case-top"><span class="ship-badge light js-shake">' + icon('ship') + '</span><span class="pill pill-sun">ХМАРА ' + cloud.id + ' / ' + D.clouds.length + '</span><span class="case-step mono">Крок 1 · Кейс</span></div>' +
          '<h1 class="case-title js-fit-ctitle">' + esc(cloud.title) + '</h1>' +
          '<p class="case-text js-fit-case">' + esc(cloud.case) + '</p>' +
        '</section>';
      ZT.fit(view.querySelector('.js-fit-ctitle'), 64, 40);
      ZT.fit(view.querySelector('.js-fit-case'), 40, 28);
      return;
    }
    var body = '';
    if (step === 1) body = gaugeBody();
    if (step === 2) body = signalsBody();
    if (step === 3) body = phraseBody(cloud);
    view.innerHTML = header(cloud, step) + '<div class="c-body">' + body + '</div>';
    ZT.fit(view.querySelector('.js-fit-title'), 32, 28);
    if (step === 3) {
      view.querySelectorAll('.ph-t').forEach(function (el) { ZT.fit(el, 30, 28); });
      ZT.fit(view.querySelector('.say-t'), 32, 28);
      var cs = ZT.cloudState(s, cloud.id);
      var v = ZT.isCalm(cs) ? 5 : 8;
      needle = { val: v, target: v, g: view.querySelector('#mNeedle'), num: view.querySelector('#mNum'), lbl: view.querySelector('#mLbl'), box: view.querySelector('#mBox'), shown: null };
      drawNeedle(performance.now());
    }
  }

  function gaugeBody() {
    var cx = 380, cy = 404, r0 = 196, r1 = 286;
    var legend = ZT.GAUGE_ZONES.map(function (z) {
      return '<li><span class="sw" style="background:' + z.color + '"></span><span class="mono lg-r">' + z.range + '</span><span class="lg-l">' + z.label + '</span></li>';
    }).join('');
    return '<div class="g-wrap">' +
      '<div class="g-left">' +
        '<svg class="big-gauge" viewBox="0 0 760 420" aria-hidden="true">' +
          gaugeArc(cx, cy, r0, r1, true, 34) +
          '<g id="gDots"></g>' +
          '<text x="' + cx + '" y="' + (cy - 96) + '" class="g-cap" text-anchor="middle">ВІДПОВІЛИ</text>' +
          '<text x="' + cx + '" y="' + (cy - 20) + '" class="g-total" id="gTotal" text-anchor="middle">0</text>' +
        '</svg>' +
        '<p class="rule"><span class="hl hl-rule">4–6 — говорю. 7+ — спершу кнопка, потім говорю</span></p>' +
      '</div>' +
      '<div class="g-right card-cobalt">' +
        '<h3 class="q">Якби це був ти — скільки на датчику?</h3>' +
        '<p class="q-sub">Цифра в чат або подумки</p>' +
        '<ul class="legend">' + legend + '</ul>' +
        '<p class="own">У кожного <span class="hl">свій</span> датчик</p>' +
      '</div>' +
    '</div>';
  }

  function drawDots(counts) {
    var g = document.getElementById('gDots');
    if (!g) return;
    var cx = 380, cy = 404, out = '', MAXD = 6;
    for (var i = 0; i < 10; i++) {
      var c = counts[i], shown = Math.min(c, MAXD), ang = 180 - 18 * (i + 0.5);
      for (var j = 0; j < shown; j++) {
        var p = pt(cx, cy, 304 + j * 15, ang);
        out += '<circle class="g-dot" cx="' + f(p[0]) + '" cy="' + f(p[1]) + '" r="7.5"/>';
      }
      if (c > MAXD) {
        var q = pt(cx, cy, 304 + MAXD * 15 + 14, ang);
        out += '<text class="g-more" x="' + f(q[0]) + '" y="' + f(q[1]) + '" text-anchor="middle" dominant-baseline="central">+' + (c - MAXD) + '</text>';
      }
    }
    g.innerHTML = out;
    var tot = counts.reduce(function (a, b) { return a + b; }, 0);
    document.getElementById('gTotal').textContent = tot;
  }

  function signalsBody() {
    var Z = [
      '<path d="M101.3 80A62 62 0 0 1 218.7 80Q160 94 101.3 80Z"/><circle cx="244" cy="44" r="11"/><circle cx="266" cy="20" r="7"/>',
      '<path d="M101.3 80Q160 94 218.7 80A62 62 0 1 1 101.3 80Z"/>',
      '<rect x="138" y="156" width="44" height="38" rx="10"/>',
      '<path d="M92 226Q92 194 124 194H196Q228 194 228 226V288H92Z"/>',
      '<path d="M92 288H228V352Q228 384 196 384H124Q92 384 92 352Z"/>',
      '<path d="M86 202Q60 206 56 238L44 320Q42 332 54 334 64 335 66 322L78 248Q80 234 88 234Z"/><circle cx="50" cy="350" r="18"/><path d="M234 202Q260 206 264 238L276 320Q278 332 266 334 256 335 254 322L242 248Q240 234 232 234Z"/><circle cx="270" cy="350" r="18"/>',
      '<rect x="108" y="388" width="46" height="128" rx="16"/><rect x="166" y="388" width="46" height="128" rx="16"/>'
    ];
    var order = [2, 6, 3, 4, 0, 1, 5]; // шия під головою, руки під тулубом
    var badges = [[160, 58], [160, 126], [160, 178], [160, 242], [160, 334], [50, 350], [131, 462]];
    var zones = order.map(function (i) { return '<g class="s-zone" data-z="' + i + '">' + Z[i] + '</g>'; }).join('');
    var bd = badges.map(function (b, i) {
      return '<g class="s-badge" data-z="' + i + '" transform="translate(' + b[0] + ' ' + b[1] + ')"><circle r="21"/><text text-anchor="middle" dominant-baseline="central">' + (i + 1) + '</text></g>';
    }).join('');
    var list = ZT.ZONES.map(function (name, i) {
      return '<li data-z="' + i + '"><span class="z-n">' + (i + 1) + '</span><span class="z-l">' + esc(name) + '</span></li>';
    }).join('');
    return '<div class="s-wrap">' +
      '<div class="s-fig card-cobalt">' +
        ZT.tube('M10 60C60 10 120 70 170 20', C.sun, 26, '0 0 190 80', 'tube-sig') +
        '<svg class="s-body" viewBox="0 0 320 530" aria-hidden="true">' + zones + bd + '</svg></div>' +
      '<div class="s-right">' +
        '<h3 class="q">Де вмикається сигналізація?</h3>' +
        '<p class="q-sub">Напиши в чат номер зони, де відчуваєш хвилювання</p>' +
        '<ol class="z-list">' + list + '</ol>' +
      '</div>' +
    '</div>';
  }

  function phraseBody(cloud) {
    var ph = cloud.phrases.slice(0, 3).map(function (p, i) {
      return '<div class="ph" data-i="' + i + '"><span class="ph-n">' + (i + 1) + '</span><p class="ph-t">' + esc(p) + '</p></div>';
    }).join('');
    var mainIds = cloud.buttons.slice(0, 2);
    var main = mainIds.map(function (id, i) {
      var b = D.buttonById[id] || { id: id, title: id };
      var locked = !ZT.isUnlocked(D, id);
      return '<div class="b-open' + (locked ? ' is-locked' : '') + '" data-btn="' + esc(id) + '"><span class="b-letter">' + ZT.LETTERS[i] + '</span>' +
        icon(ZT.hasIcon(id) ? id : 'lock') + '<span class="b-title">' + esc(b.title) + '</span>' + (locked ? icon('lock', 'b-lockico') : '') + '</div>';
    }).join('');
    var rest = D.buttons.filter(function (b) { return mainIds.indexOf(b.id) < 0; });
    var anyLocked = rest.some(function (b) { return !b.unlocked; });
    var small = rest.map(function (b) {
      var locked = b.unlocked !== true;
      return '<div class="b-small' + (locked ? ' is-locked' : '') + '" data-btn="' + esc(b.id) + '">' +
        '<span class="b-sico">' + icon(ZT.hasIcon(b.id) ? b.id : 'lock') + (locked ? '<span class="b-lockbadge">' + icon('lock') + '</span>' : '') + '</span>' +
        '<span class="b-stitle">' + esc(b.title) + '</span></div>';
    }).join('');
    var miniCx = 100, miniCy = 98;
    return '<div class="p-grid">' +
      '<div class="p-left">' +
        '<p class="p-label mono">Фраза в моменті · голосуй 1, 2 або 3</p>' +
        '<div class="ph-list">' + ph + '</div>' +
      '</div>' +
      '<div class="p-right">' +
        '<p class="p-label mono">Кнопка пульта · А або Б</p>' +
        '<div class="b-main">' + main + '</div>' +
        (rest.length ? '<div class="b-rest">' + small + '</div>' : '') +
        (anyLocked ? '<p class="b-note">' + icon('lock', 'ico-inline') + 'відкриються в модулі «Пульт емоцій»</p>' : '') +
      '</div>' +
      '<div class="say card-cobalt"><p class="say-t"><span class="hl">Сказати вголос:</span> ' + esc(cloud.sayAloud) + '</p></div>' +
      '<div class="mini">' +
        '<svg viewBox="0 0 200 108" class="mini-g" aria-hidden="true">' + gaugeArc(miniCx, miniCy, 62, 90, false) +
          '<g id="mNeedle"><path d="M' + miniCx + ' ' + miniCy + 'H' + (miniCx - 74) + '" stroke="' + C.ink + '" stroke-width="7" stroke-linecap="round"/></g>' +
          '<circle cx="' + miniCx + '" cy="' + miniCy + '" r="11" fill="' + C.ink + '"/></svg>' +
        '<div class="mini-read"><span class="mini-box" id="mBox"><span id="mNum">8</span></span><span class="mono mini-lbl" id="mLbl"></span></div>' +
      '</div>' +
    '</div>';
  }

  function updateCloud(s, cloud) {
    var cs = ZT.cloudState(s, cloud.id);
    if (s.step === 1) drawDots(cs.gauge);
    if (s.step === 2) {
      view.querySelectorAll('[data-z]').forEach(function (el) {
        el.classList.toggle('is-on', !!cs.zones[Number(el.getAttribute('data-z'))]);
      });
    }
    if (s.step === 3) {
      var max = Math.max.apply(null, cs.phrases);
      view.querySelectorAll('.ph').forEach(function (el) {
        var i = Number(el.getAttribute('data-i'));
        el.classList.toggle('is-lead', max > 0 && cs.phrases[i] === max);
      });
      view.querySelectorAll('[data-btn]').forEach(function (el) {
        el.classList.toggle('is-pick', el.getAttribute('data-btn') === cs.pick && ZT.isUnlocked(D, cs.pick));
      });
    }
  }

  /* ---------- тренажери ---------- */
  function buildTrainer(btnId) {
    var b = D.buttonById[btnId] || { title: btnId, hint: '' };
    var visual = '';
    if (btnId === 'reset') {
      visual = '<svg viewBox="0 0 560 560" class="t-vis" aria-hidden="true">' +
        '<circle cx="280" cy="280" r="262" class="t-ring"/>' +
        '<circle cx="280" cy="280" r="90" class="t-ball" id="tBall"/>' +
        '<text x="280" y="284" class="t-count" id="tCount" text-anchor="middle" dominant-baseline="central"></text></svg>';
    } else if (btnId === 'feet') {
      var lines = '';
      [[150, 300], [330, 480]].forEach(function (xs) {
        for (var k = 0; k < 3; k++) {
          var d = 34 + k * 30;
          lines += '<path class="t-field" d="M' + (xs[0] + 12 + k * 16) + ' 348C' + (xs[0] + 12 + k * 16) + ' ' + (348 + d * 1.3) + ' ' + (xs[1] - 12 - k * 16) + ' ' + (348 + d * 1.3) + ' ' + (xs[1] - 12 - k * 16) + ' 348"/>';
        }
      });
      visual = '<svg viewBox="0 0 560 500" class="t-vis t-feet" aria-hidden="true" id="tFeet">' +
        '<g class="t-arrows"><path d="M200 40v60M182 84l18 18 18-18"/><path d="M380 40v60M362 84l18 18 18-18"/></g>' +
        '<g class="t-soles" id="tSoles">' +
          '<path d="M160 130h50v150q0 16 16 20l56 10q14 4 14 18v8H160q-12 0-12-12V130z" class="t-foot"/>' +
          '<path d="M340 130h50v150q0 16 16 20l56 10q14 4 14 18v8H340q-12 0-12-12V130z" class="t-foot"/>' +
        '</g>' +
        '<path d="M60 340H540" class="t-floor"/>' + lines + '</svg>';
    } else {
      visual = '<div class="t-generic"><p class="t-hint">' + esc(b.hint || '') + '</p><p class="t-count-g" id="tCount"></p></div>';
    }
    overlay.innerHTML =
      '<div class="t-wrap t-' + esc(btnId) + '">' +
        ZT.tube('M20 40C120 120 220 0 340 60', C.cobalt, 38, '0 0 360 120', 'tube-tr') +
        '<div class="t-left">' + visual + '</div>' +
        '<div class="t-right">' +
          '<p class="pill">Кнопка пульта</p>' +
          '<h2 class="t-title">' + esc(b.title) + '</h2>' +
          '<p class="t-label" id="tLabel"></p>' +
          '<p class="t-sub" id="tSub"></p>' +
          (btnId === 'feet' ? '<p class="t-bignum" id="tCount"></p>' : '') +
          '<p class="pill pill-sun t-cycle" id="tCycle"></p>' +
        '</div>' +
      '</div>';
    overlay.hidden = false;
  }

  function updateTrainer(s, fromState) {
    var cloud = s.view === 'cloud' && s.cloudId ? D.cloudById[s.cloudId] : null;
    var cs = cloud ? ZT.cloudState(s, cloud.id) : null;
    // закриту кнопку екран ніколи не запускає, навіть якщо вона потрапила в стан
    var run = cs && cs.trainer && ZT.isUnlocked(D, cs.trainer.btn) && ZT.trainerRunning(cs);
    if (!run) {
      if (trainerUI) { trainerUI = null; overlay.hidden = true; overlay.innerHTML = ''; }
      return;
    }
    var key = cs.trainer.btn + '@' + cs.trainer.startedAt;
    if (!trainerUI || trainerUI.key !== key) {
      buildTrainer(cs.trainer.btn);
      trainerUI = { key: key, def: ZT.trainerDef(cs.trainer.btn), phase: null, count: null, btn: cs.trainer.btn,
        ball: overlay.querySelector('#tBall'), count_el: overlay.querySelector('#tCount'), label: overlay.querySelector('#tLabel'),
        sub: overlay.querySelector('#tSub'), cycle: overlay.querySelector('#tCycle'), feet: overlay.querySelector('#tFeet') };
    }
    if (fromState) return;
    var t = ZT.trainerElapsed(cs), fr = trainerUI.def.frame(t);
    if (trainerUI.ball) trainerUI.ball.setAttribute('r', f(90 + fr.k * 168));
    if (trainerUI.feet) trainerUI.feet.classList.toggle('is-press', fr.phase === 'press');
    if (fr.count !== trainerUI.count) { trainerUI.count_el.textContent = fr.count == null ? '' : fr.count; trainerUI.count = fr.count; }
    if (fr.phase !== trainerUI.phase) {
      trainerUI.label.textContent = fr.label;
      trainerUI.sub.textContent = fr.sub;
      overlay.firstChild.classList.toggle('is-done', fr.phase === 'done');
      if (s.sound) {
        var map = { 'in': 'inhale', sip: 'sip', out: 'exhale', press: 'press', release: 'release' };
        if (map[fr.phase]) ZT.sound.play(map[fr.phase]);
      }
      trainerUI.phase = fr.phase;
    }
    var cyc = trainerUI.def.cycles && fr.cycle ? ((trainerUI.btn === 'feet' ? 'ПОВТОР ' : 'ЦИКЛ ') + fr.cycle + ' / ' + trainerUI.def.cycles) : '';
    trainerUI.cycle.textContent = cyc;
    trainerUI.cycle.hidden = !cyc;
  }

  /* ---------- міні-датчик ---------- */
  function drawNeedle(now) {
    if (!needle || !needle.g) return;
    var calm = needle.target <= 5.01;
    var jitter = calm ? 0 : Math.sin(now / 55) * 1.6 + Math.sin(now / 23) * 0.8;
    var deg = 18 * (needle.val - 0.5) + jitter;
    needle.g.setAttribute('transform', 'rotate(' + f(deg) + ' 100 98)');
    var v = Math.max(1, Math.min(10, Math.round(needle.val)));
    if (v !== needle.shown) {
      var z = ZT.zoneOf(v);
      needle.num.textContent = v;
      needle.box.style.background = z.color;
      needle.box.style.color = z.fg;
      needle.lbl.textContent = z.label.toUpperCase();
      needle.shown = v;
    }
  }

  var lastT = performance.now();
  function tick(now) {
    var dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
    var s = ZT.store.get();
    // корабель на карті
    if (ship.anim && lastKey === 'map') {
      var u = Math.min(1, (now - ship.anim.t0) / ship.anim.dur), e = 0.5 - 0.5 * Math.cos(Math.PI * u);
      placeShip(ship.anim.from + (ship.anim.to - ship.anim.from) * e);
      if (u >= 1) ship.anim = null;
    }
    updateTrainer(s, false);
    if (s.view === 'cloud' && s.cloudId && D.cloudById[s.cloudId]) {
      var cs = ZT.cloudState(s, s.cloudId);
      var calm = ZT.isCalm(cs) && ZT.isUnlocked(D, cs.trainer.btn);
      if (calmPrev === false && calm && s.sound) ZT.sound.play('calm');
      calmPrev = calm;
      view.querySelectorAll('.js-shake').forEach(function (el) { el.classList.toggle('shaking', !calm); });
      if (needle) {
        needle.target = calm ? 5 : 8;
        needle.val += (needle.target - needle.val) * Math.min(1, dt * 1.1);
        if (Math.abs(needle.val - needle.target) < 0.01) needle.val = needle.target;
        drawNeedle(now);
      }
      view.classList.toggle('is-calm', calm);
    } else {
      calmPrev = null;
    }
    requestAnimationFrame(tick);
  }

  ZT.screen = {
    init: function (data) {
      D = data;
      document.title = 'Екран · Зона турбулентності';
      document.getElementById('app').innerHTML =
        '<div id="viewport"><div id="stage">' +
          '<div id="view" class="view"></div>' +
          '<div id="overlay" class="overlay" hidden></div>' +
          '<button id="soundHint" class="sound-hint" hidden>' + icon('soundOn') + 'Клацни тут, щоб увімкнути звук</button>' +
        '</div></div>';
      stage = document.getElementById('stage');
      view = document.getElementById('view');
      overlay = document.getElementById('overlay');
      hint = document.getElementById('soundHint');
      scale();
      window.addEventListener('resize', scale);
      document.addEventListener('pointerdown', function () {
        if (ZT.store.get().sound) { ZT.sound.unlock(); setTimeout(function () { updateHint(ZT.store.get()); }, 120); }
      });
      ZT.store.on(render);
      ZT.store.onMsg(function (m) { if (m.kind === 'ping') ZT.store.send({ kind: 'pong', t: Date.now() }); });
      ZT.store.send({ kind: 'pong', t: Date.now() });
      render(ZT.store.get());
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () { lastKey = null; render(ZT.store.get()); });
      }
      requestAnimationFrame(tick);
    }
  };
})(window.ZT);
