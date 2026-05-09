(function () {
  // Адрес запущенного bot.py (поменяй на публичный URL при деплое)
  var BOT_ENDPOINT = 'http://localhost:8080/vote';

  var STORAGE_KEY = 'wed_alcohol_submitted';

  var chipLabels = {
    'champagne':  'Шампанское',
    'wine-red':   'Красное вино',
    'wine-white': 'Белое вино',
    'beer':       'Пиво',
    'whiskey':    'Виски',
    'vodka':      'Водка',
    'cognac':     'Коньяк',
    'soft':       'Безалкогольное'
  };

  var chips     = document.querySelectorAll('#alcohol-chips .chip');
  var submitBtn = document.getElementById('alcohol-submit');
  var statusEl  = document.getElementById('alcohol-status');

  // ── Если уже отправлено — блокируем форму сразу ────────────────────────
  if (localStorage.getItem(STORAGE_KEY)) {
    setSubmittedState();
  }

  // ── Переключение чипов ──────────────────────────────────────────────────
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      if (!this.disabled) {
        this.classList.toggle('selected');
        updateSubmitVisibility();
      }
    });
  });

  function updateSubmitVisibility() {
    var anySelected = false;
    chips.forEach(function (chip) {
      if (chip.classList.contains('selected')) anySelected = true;
    });
    submitBtn.classList.toggle('visible', anySelected);
  }

  // ── Отправка ────────────────────────────────────────────────────────────
  submitBtn.addEventListener('click', function () {
    var selected = [];
    chips.forEach(function (chip) {
      if (chip.classList.contains('selected')) {
        selected.push(chipLabels[chip.dataset.value] || chip.dataset.value);
      }
    });

    if (selected.length === 0) {
      showStatus('Выбери хотя бы один напиток', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Отправляем…';
    clearStatus();

    fetch(BOT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drinks: selected })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.ok) {
          localStorage.setItem(STORAGE_KEY, '1');
          setSubmittedState();
        } else {
          showStatus('Ошибка при отправке. Попробуй ещё раз.', 'error');
          resetButton();
        }
      })
      .catch(function () {
        showStatus('Нет соединения. Попробуй ещё раз.', 'error');
        resetButton();
      });
  });

  function setSubmittedState() {
    chips.forEach(function (chip) {
      chip.disabled = true;
      chip.classList.add('chip--disabled');
    });
    if (submitBtn) submitBtn.style.display = 'none';
    showStatus('✓ Спасибо, Ваш выбор учтен.', 'success');
  }

  function resetButton() {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Подтвердить';
  }

  function showStatus(text, type) {
    statusEl.textContent = text;
    statusEl.className = 'alcohol-status alcohol-status--' + type;
  }

  function clearStatus() {
    statusEl.textContent = '';
    statusEl.className = 'alcohol-status';
  }
}());
