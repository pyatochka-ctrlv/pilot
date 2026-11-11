/* Таймлайни тренажерів. Усе рахується від часу старту — тому стан однаковий
   у всіх вкладках і після перезавантаження. t — секунди від старту. */
(function (ZT) {
  'use strict';
  function ease(x) { x = Math.max(0, Math.min(1, x)); return 0.5 - 0.5 * Math.cos(Math.PI * x); }

  var DEFS = {
    reset: {
      cycles: 3,
      total: 3 + 3 * 10 + 4,
      frame: function (t) {
        if (t < 3) return { phase: 'intro', label: 'Сядь зручно', sub: 'Зараз робимо перезавантаження', count: Math.ceil(3 - t), k: 0 };
        if (t < 33) {
          var c = Math.floor((t - 3) / 10), u = (t - 3) - c * 10;
          if (u < 3) return { phase: 'in', label: 'Вдих носом', sub: 'Коло росте', count: Math.ceil(3 - u), k: 0.82 * ease(u / 3), cycle: c + 1 };
          if (u < 4) return { phase: 'sip', label: 'Ще маленький довдих', sub: 'Трішки носом', count: 1, k: 0.82 + 0.18 * ease(u - 3), cycle: c + 1 };
          return { phase: 'out', label: 'Довгий видих ротом', sub: 'Коло зменшується', count: Math.ceil(6 - (u - 4)), k: 1 - ease((u - 4) / 6), cycle: c + 1 };
        }
        return { phase: 'done', label: 'Готово!', sub: 'Датчик опускається в робочу зону', count: null, k: 0 };
      }
    },
    feet: {
      cycles: 3,
      total: 3 + 3 * 5 + 4,
      frame: function (t) {
        if (t < 3) return { phase: 'intro', label: 'Постав стопи на підлогу', sub: 'Зараз — стопи-магніти', count: Math.ceil(3 - t), k: 0 };
        if (t < 18) {
          var r = Math.floor((t - 3) / 5), u = (t - 3) - r * 5;
          if (u < 3) return { phase: 'press', label: 'Втисни стопи', sub: 'Сильно, як магніти до підлоги', count: Math.ceil(3 - u), k: 1, cycle: r + 1 };
          return { phase: 'release', label: 'Відпусти', sub: 'Стопи м’які', count: null, k: 0, cycle: r + 1 };
        }
        return { phase: 'done', label: 'Готово!', sub: 'Датчик опускається в робочу зону', count: null, k: 0 };
      }
    },
    /* Для кнопок, які методист відкриє, але для яких ще немає анімації */
    generic: {
      cycles: 0,
      total: 16,
      frame: function (t) {
        if (t < 12) return { phase: 'do', label: '', sub: '', count: Math.ceil(12 - t), k: 0 };
        return { phase: 'done', label: 'Готово!', sub: 'Датчик опускається в робочу зону', count: null, k: 0 };
      }
    }
  };

  ZT.trainerDef = function (btnId) { return DEFS[btnId] || DEFS.generic; };
  ZT.hasTrainer = function (btnId) { return !!DEFS[btnId] && btnId !== 'generic'; };
})(window.ZT);
