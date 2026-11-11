/* Звуки генеруються WebAudio — без файлів і зовнішніх запитів.
   Браузер дозволяє звук лише після кліку у вкладці, тому на екрані є підказка. */
(function (ZT) {
  'use strict';
  var ctx = null;

  function ensure() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
    }
    return ctx;
  }
  function ready() { return ctx && ctx.state === 'running'; }

  function tone(freq, dur, o) {
    o = o || {};
    var t = ctx.currentTime + (o.at || 0);
    var osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    var v = o.vol || 0.1;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + Math.min(0.08, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  function rumble(dur, vol) {
    var len = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource(); src.buffer = buf;
    var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
    var g = ctx.createGain(), t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(ctx.destination);
    src.start(t); src.stop(t + dur);
  }

  var FX = {
    enter: function () { rumble(1.6, 0.25); tone(85, 1.3, { type: 'triangle', vol: 0.12 }); },
    step: function () { tone(620, 0.12, { vol: 0.08 }); tone(830, 0.16, { at: 0.1, vol: 0.08 }); },
    pop: function () { tone(500, 0.1, { type: 'triangle', vol: 0.1, to: 760 }); },
    tick: function () { tone(980, 0.12, { vol: 0.08 }); },
    inhale: function () { tone(300, 2.8, { vol: 0.06, to: 520 }); },
    sip: function () { tone(540, 0.8, { vol: 0.06, to: 640 }); },
    exhale: function () { tone(500, 5.6, { vol: 0.06, to: 210 }); },
    press: function () { tone(110, 0.5, { type: 'triangle', vol: 0.18 }); },
    release: function () { tone(440, 0.35, { vol: 0.06, to: 520 }); },
    calm: function () { [523, 659, 784].forEach(function (f, i) { tone(f, 1, { at: i * 0.16, vol: 0.08 }); }); },
    exit: function () { [659, 784, 988, 1319].forEach(function (f, i) { tone(f, 0.5, { at: i * 0.1, vol: 0.08 }); }); }
  };

  ZT.sound = {
    unlock: function () {
      var c = ensure();
      if (c && c.state !== 'running') { try { c.resume(); } catch (e) { /* ignore */ } }
    },
    locked: function () { return !ready(); },
    play: function (name) { if (ready() && FX[name]) { try { FX[name](); } catch (e) { /* ignore */ } } }
  };
})(window.ZT);
