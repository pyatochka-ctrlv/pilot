/* Завантаження даних і запуск потрібного режиму */
(function (ZT) {
  'use strict';
  function getJSON(path) {
    return fetch(path, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('Не вдалося завантажити ' + path + ' (' + r.status + ')');
      return r.text();
    }).then(function (t) {
      try { return JSON.parse(t); } catch (e) { throw new Error('Помилка у файлі ' + path + ': ' + e.message + '. Перевір коми й лапки.'); }
    });
  }

  function validate(clouds, buttons) {
    if (!Array.isArray(clouds) || !clouds.length) throw new Error('data/clouds.json має бути списком хмар [ … ].');
    if (!Array.isArray(buttons)) throw new Error('data/buttons.json має бути списком кнопок [ … ].');
    clouds.forEach(function (c, i) {
      var where = 'Хмара №' + (i + 1) + ' у data/clouds.json';
      if (typeof c.id !== 'number') throw new Error(where + ': поле "id" має бути числом.');
      ['title', 'case', 'sayAloud'].forEach(function (k) { if (typeof c[k] !== 'string') throw new Error(where + ': немає поля "' + k + '".'); });
      if (!Array.isArray(c.phrases) || c.phrases.length < 3) throw new Error(where + ': у "phrases" має бути 3 фрази.');
      if (!Array.isArray(c.buttons) || c.buttons.length < 2) throw new Error(where + ': у "buttons" має бути 2 кнопки.');
    });
  }

  function fail(err) {
    var local = location.protocol === 'file:';
    document.getElementById('app').innerHTML =
      '<div class="boot-err"><h1>Гра не запустилася</h1><p>' + ZT.esc(err.message) + '</p>' +
      (local ? '<p>Схоже, файл відкрито напряму з диска. Відкрий гру за адресою GitHub Pages або через локальний сервер (див. README).</p>' : '') +
      '</div>';
  }

  Promise.all([getJSON('data/clouds.json'), getJSON('data/buttons.json')]).then(function (r) {
    var clouds = r[0], buttons = r[1];
    validate(clouds, buttons);
    var data = { clouds: clouds, buttons: buttons, cloudById: {}, buttonById: {} };
    clouds.forEach(function (c) { data.cloudById[c.id] = c; });
    buttons.forEach(function (b) { data.buttonById[b.id] = b; });
    if (document.documentElement.dataset.mode === 'remote') ZT.remote.init(data);
    else ZT.screen.init(data);
  }).catch(fail);
})(window.ZT);
