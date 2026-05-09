$(document).ready(function() {
  var clock;

  var labelTranslations = {
    'Days':    'Дни',
    'Hours':   'Часы',
    'Minutes': 'Минуты',
    'Seconds': 'Секунды'
  };

  function translateLabels() {
    document.querySelectorAll('.flip-clock-label').forEach(function(el) {
      var key = el.textContent.trim();
      if (labelTranslations[key]) {
        el.textContent = labelTranslations[key];
      }
    });
  }

  function centerDaysLabel() {
    var wrapper = document.querySelector('.flip-clock-wrapper');
    if (!wrapper) return;

    var daysDivider = wrapper.querySelector('.flip-clock-divider.days');
    if (!daysDivider) return;

    var label = daysDivider.querySelector('.flip-clock-label');
    if (!label || label.offsetWidth === 0) return;

    // Collect day digit UL elements.
    // Try next siblings first (divider-before-digits structure),
    // then prev siblings (divider-after-digits structure).
    var dayDigits = [];
    var node = daysDivider.nextElementSibling;
    while (node && node.tagName === 'UL') {
      dayDigits.push(node);
      node = node.nextElementSibling;
    }
    if (dayDigits.length === 0) {
      node = daysDivider.previousElementSibling;
      while (node && node.tagName === 'UL') {
        dayDigits.unshift(node);
        node = node.previousElementSibling;
      }
    }
    if (dayDigits.length === 0) return;

    var firstRect = dayDigits[0].getBoundingClientRect();
    var lastRect  = dayDigits[dayDigits.length - 1].getBoundingClientRect();
    var centerX   = (firstRect.left + lastRect.right) / 2;

    // Walk up to find the CSS containing block for the label.
    var cb = label.parentElement;
    while (cb && window.getComputedStyle(cb).position === 'static') {
      cb = cb.parentElement;
    }
    var cbLeft = cb ? cb.getBoundingClientRect().left : 0;

    label.style.right = 'auto';
    label.style.left  = Math.round(centerX - label.offsetWidth / 2 - cbLeft) + 'px';
  }

  // Grab the current date
  var currentDate = new Date();

  // Target future date/24 hour time/Timezone
  var targetDate = moment.tz("2026-09-12 12:00", "Europe/Moscow");

  // Calculate the difference in seconds between the future and current date
  var diff = targetDate / 1000 - currentDate.getTime() / 1000;

  if (diff <= 0) {
    // If remaining countdown is 0
    clock = $(".clock").FlipClock(0, {
      clockFace: "DailyCounter",
      countdown: true,
      autostart: false
    });
    console.log("Date has already passed!");

  } else {
    // Run countdown timer
    clock = $(".clock").FlipClock(diff, {
      clockFace: "DailyCounter",
      countdown: true,
      callbacks: {
        stop: function() {
          console.log("Timer has ended!");
        }
      }
    });

    // Check when timer reaches 0, then stop at 0
    setTimeout(checktime, 1000);

    function checktime() {
      var t = clock.getTime();
      if (t <= 0) {
        clock.setTime(0);
      }
      setTimeout(checktime, 1000);
    }
  }

  // Translate labels and fix days-label alignment after FlipClock renders
  setTimeout(function() {
    translateLabels();
    centerDaysLabel();
  }, 200);

  // Re-center on resize and periodically (handles 3→2 digit transition at day 99)
  $(window).on('resize', centerDaysLabel);
  setInterval(centerDaysLabel, 5 * 60 * 1000);
});
