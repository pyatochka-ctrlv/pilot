/* ПУЛЬТ ПЕДАГОГА — керує грою. Діти його не бачать. */
(function (ZT) {
  'use strict';
  var esc = ZT.esc, icon = ZT.icon;
  var D, root, lastPong = 0;

  function cur(s) { return s.cloudId ? D.cloudById[s.cloudId] : null; }
  function ensure(s, id) { if (!s.clouds[id]) s.clouds[id] = ZT.blankCloud(); return s.clouds[id]; }
  function commit(fn) { ZT.store.commit(fn); }

  var ACT = {
    sound: function () { commit(function (s) { s.sound = !s.sound; }); ZT.sound.unlock(); },
    open: function (id) {
      id = Number(id);
      commit(function (s) { s.view = 'cloud'; s.cloudId = id; s.step = 0; ensure(s, id); });
    },
    map: function () { commit(function (s) { s.view = 'map'; }); },
    back: function () { commit(function (s) { if (s.cloudId) s.view = 'cloud'; }); },
    step: function (n) {
      n = Number(n);
      commit(function (s) { if (s.cloudId) { s.view = 'cloud'; s.step = n; } });
    },
    next: function () {
      var s = ZT.store.get();
      if (s.step >= 3) ACT.exit(); else ACT.step(s.step + 1);
    },
    exit: function () {
      commit(function (s) {
        if (!s.cloudId) return;
        if (s.done.indexOf(s.cloudId) < 0) s.done.push(s.cloudId);
        var c = s.clouds[s.cloudId]; if (c) c.trainer = null;
        s.view = 'map'; s.step = 0; s.cloudId = null;
      });
    },
    gauge: function (arg) {
      var p = arg.split(':'), i = Number(p[0]), d = Number(p[1]);
      commit(function (s) { var c = ensure(s, s.cloudId); c.gauge[i] = Math.max(0, Math.min(40, c.gauge[i] + d)); });
    },
    zone: function (i) { commit(function (s) { var c = ensure(s, s.cloudId); c.zones[i] = !c.zones[i]; }); },
    phrase: function (arg) {
      var p = arg.split(':'), i = Number(p[0]), d = Number(p[1]);
      commit(function (s) { var c = ensure(s, s.cloudId); c.phrases[i] = Math.max(0, c.phrases[i] + d); });
    },
    pick: function (id) {
      if (!ZT.isUnlocked(D, id)) return; // закриті кнопки не обираються
      commit(function (s) { var c = ensure(s, s.cloudId); c.pick = c.pick === id ? null : id; });
    },
    start: function () {
      var s = ZT.store.get(), cs = ZT.cloudState(s, s.cloudId);
      if (!cs.pick || !ZT.isUnlocked(D, cs.pick)) return; // закриті кнопки не запускаються
      commit(function (s2) { var c = ensure(s2, s2.cloudId); c.trainer = { btn: c.pick, startedAt: Date.now() }; s2.view = 'cloud'; s2.step = 3; });
    },
    stopT: function () { commit(function (s) { var c = ensure(s, s.cloudId); c.trainer = null; }); },
    resetCloud: function () {
      var s = ZT.store.get(); if (!s.cloudId) return;
      if (!window.confirm('Скинути хмару ' + s.cloudId + '? Голоси, зони й тренажер цієї хмари зітруться.')) return;
      commit(function (s2) {
        s2.clouds[s2.cloudId] = ZT.blankCloud(); s2.step = 0;
        var k = s2.done.indexOf(s2.cloudId); if (k >= 0) s2.done.splice(k, 1);
      });
    },
    newLesson: function () {
      if (!window.confirm('Почати новий урок? Усі хмари знову стануть непройденими, а голоси зітруться.')) return;
      commit(function (s) {
        var b = ZT.store.blank();
        b.sound = s.sound;
        for (var k in b) if (k !== 'rev') s[k] = b[k];
      });
    }
  };

  function syncHtml() {
    var ok = Date.now() - lastPong < 4500;
    return '<span class="sync ' + (ok ? 'ok' : 'bad') + '"><i></i>' + (ok ? 'Екран на зв’язку' : 'Екран не відповідає') + '</span>';
  }

  function stepControls(s, cloud, cs) {
    var h = '';
    if (s.step === 0) {
      h += '<div class="r-case"><p class="r-hint">Прочитай кейс уголос або дай дітям прочитати з екрана.</p><p>' + esc(cloud.case) + '</p></div>';
    }
    if (s.step === 1) {
      var total = cs.gauge.reduce(function (a, b) { return a + b; }, 0);
      h += '<h3>Датчик: скільки відповідей на кожну цифру <span class="r-count">усього ' + total + '</span></h3><div class="r-gauge">';
      for (var i = 0; i < 10; i++) {
        var z = ZT.zoneOf(i + 1);
        h += '<div class="r-g"><button class="rb r-plus" data-act="gauge" data-arg="' + i + ':1" style="--zc:' + z.color + ';--zf:' + z.fg + '"><span class="r-dig">' + (i + 1) + '</span><span class="r-num">' + cs.gauge[i] + '</span><span class="r-p1">+1</span></button>' +
          '<button class="rb r-minus" data-act="gauge" data-arg="' + i + ':-1" aria-label="мінус один для ' + (i + 1) + '">−1</button></div>';
      }
      h += '</div>';
    }
    if (s.step === 2) {
      h += '<h3>Сигнали: тапни зони, які назвали діти</h3><div class="r-zones">';
      ZT.ZONES.forEach(function (name, i) {
        h += '<button class="rb r-zone' + (cs.zones[i] ? ' on' : '') + '" data-act="zone" data-arg="' + i + '"><b>' + (i + 1) + '</b>' + esc(name) + '</button>';
      });
      h += '</div>';
    }
    if (s.step === 3) {
      h += '<h3>Фрази: голоси дітей</h3><div class="r-phr">';
      cloud.phrases.slice(0, 3).forEach(function (p, i) {
        h += '<div class="r-ph"><button class="rb r-phbtn" data-act="phrase" data-arg="' + i + ':1"><b>' + (i + 1) + '</b><span>' + esc(p) + '</span><span class="r-num">' + cs.phrases[i] + '</span></button>' +
          '<button class="rb r-minus" data-act="phrase" data-arg="' + i + ':-1">−1</button></div>';
      });
      h += '</div><h3>Кнопка пульта: обери за голосами</h3><div class="r-btns">';
      var mainIds = cloud.buttons.slice(0, 2);
      var all = mainIds.map(function (id) { return D.buttonById[id] || { id: id, title: id, unlocked: false }; })
        .concat(D.buttons.filter(function (b) { return mainIds.indexOf(b.id) < 0; }));
      all.forEach(function (b, i) {
        var locked = b.unlocked !== true;
        var letter = i < 2 ? '<b>' + ZT.LETTERS[i] + '</b>' : '';
        if (locked) {
          h += '<button class="rb r-bt locked" disabled aria-disabled="true">' + icon('lock') + '<span>' + esc(b.title) + '<small>відкриється в модулі «Пульт емоцій»</small></span></button>';
        } else {
          h += '<button class="rb r-bt' + (cs.pick === b.id ? ' on' : '') + '" data-act="pick" data-arg="' + esc(b.id) + '">' + letter + icon(ZT.hasIcon(b.id) ? b.id : 'lock') + '<span>' + esc(b.title) + (b.hint ? '<small>' + esc(b.hint) + '</small>' : '') + '</span></button>';
        }
      });
      h += '</div>';
      if (ZT.trainerRunning(cs)) {
        h += '<button class="rb r-big r-stop" data-act="stopT">' + icon('stop') + 'Зупинити тренажер <span id="tTimer" class="r-timer"></span></button>';
      } else {
        var can = cs.pick && ZT.isUnlocked(D, cs.pick);
        h += '<button class="rb r-big r-start" data-act="start"' + (can ? '' : ' disabled') + '>' + icon('play') + (ZT.isCalm(cs) ? 'Ще раз тренажер' : 'Старт тренажера') + '</button>';
        if (ZT.isCalm(cs)) h += '<p class="r-ok">' + icon('check', 'ico-s') + 'Датчик у робочій зоні. Хто прочитає фразу вголос?</p>';
      }
      h += '<div class="r-say"><span>Сказати вголос:</span> ' + esc(cloud.sayAloud) + '</div>';
    }
    return h;
  }

  function render() {
    var s = ZT.store.get(), cloud = cur(s), cs = cloud ? ZT.cloudState(s, cloud.id) : null;
    var clouds = D.clouds.map(function (c) {
      var done = s.done.indexOf(c.id) >= 0, now = s.cloudId === c.id;
      return '<button class="rb r-cl' + (done ? ' done' : '') + (now ? ' now' : '') + '" data-act="open" data-arg="' + c.id + '">' +
        '<b>' + c.id + '</b><span>' + esc(c.title) + '</span>' + (done ? '<em>' + icon('check', 'ico-s') + 'пройдено</em>' : '') + '</button>';
    }).join('');

    var h = '<header class="r-head">' +
      '<div class="r-brand"><span class="r-tag">Пульт</span> Зона <span class="hl">турбулентності</span></div>' +
      '<div class="r-row"><span id="syncBox">' + syncHtml() + '</span>' +
      '<button class="rb r-sound' + (s.sound ? ' on' : '') + '" data-act="sound">' + icon(s.sound ? 'soundOn' : 'soundOff') + (s.sound ? 'Звук увімк.' : 'Звук вимк.') + '</button></div>' +
      '<a class="r-link" href="./" target="zt-screen">Відкрити екран гри в новій вкладці ↗</a>' +
      '</header>';

    h += '<section class="r-sec"><h3>Хмари <span class="r-count">пройдено ' + s.done.length + ' / ' + D.clouds.length + '</span></h3><div class="r-clouds">' + clouds + '</div>' +
      (s.view === 'cloud' ? '<button class="rb r-wide" data-act="map">' + icon('map') + 'Показати карту</button>'
        : (cloud ? '<button class="rb r-wide" data-act="back">' + icon('arrow') + 'Повернутися в хмару ' + cloud.id + '</button>' : '<p class="r-hint">На екрані карта. Обери хмару, щоб почати.</p>')) +
      '</section>';

    if (cloud) {
      var steps = ZT.STEPS.map(function (n, i) {
        return '<button class="rb r-step' + (s.view === 'cloud' && s.step === i ? ' now' : '') + '" data-act="step" data-arg="' + i + '"><b>' + (i + 1) + '</b>' + esc(n) + '</button>';
      }).join('') + '<button class="rb r-step r-exit" data-act="exit">' + icon('exit', 'ico-s') + 'Вихід</button>';
      h += '<section class="r-sec r-cur"><h2>Хмара ' + cloud.id + ' · ' + esc(cloud.title) + '</h2>' +
        '<div class="r-steps">' + steps + '</div>' +
        (s.view === 'cloud' ? stepControls(s, cloud, cs) : '<p class="r-hint">Зараз на екрані карта.</p>') +
        (s.view === 'cloud' ? '<button class="rb r-big r-next" data-act="next">' + (s.step >= 3 ? icon('exit') + 'Вихід із хмари' : icon('arrow') + 'Далі: ' + esc(ZT.STEPS[s.step + 1])) + '</button>' : '') +
        '</section>';
    }

    h += '<footer class="r-sec r-foot">' +
      (cloud ? '<button class="rb" data-act="resetCloud">Скинути хмару</button>' : '') +
      '<button class="rb r-danger" data-act="newLesson">Новий урок</button>' +
      '<p class="r-hint">Демонструй у Meet вкладку «Екран · Зона турбулентності», а не цей пульт.</p>' +
      '</footer>';
    root.innerHTML = h;
    tickTimer();
  }

  function tickTimer() {
    var el = document.getElementById('tTimer');
    if (el) {
      var s = ZT.store.get(), cs = ZT.cloudState(s, s.cloudId);
      if (!ZT.trainerRunning(cs)) { render(); return; }
      var total = ZT.trainerDef(cs.trainer.btn).total;
      el.textContent = Math.floor(ZT.trainerElapsed(cs)) + ' / ' + total + ' с';
    }
    var sb = document.getElementById('syncBox');
    if (sb) sb.innerHTML = syncHtml();
  }

  ZT.remote = {
    init: function (data) {
      D = data;
      document.title = 'Пульт · Зона турбулентності';
      root = document.getElementById('app');
      root.className = 'r';
      root.addEventListener('click', function (e) {
        var b = e.target.closest('[data-act]');
        if (!b || b.disabled) return;
        var fn = ACT[b.getAttribute('data-act')];
        if (fn) fn(b.getAttribute('data-arg'));
      });
      ZT.store.on(render);
      ZT.store.onMsg(function (m) { if (m.kind === 'pong') { lastPong = Date.now(); } });
      var ping = function () { ZT.store.send({ kind: 'ping', t: Date.now() }); };
      ping();
      setInterval(ping, 1500);
      setInterval(tickTimer, 500);
      render();
    }
  };
})(window.ZT);
