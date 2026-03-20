(function() {
  var cfg = window.ARTSVP_CHANGELOG || {};
  var selector = cfg.selector || '.changelog-badge';
  var feedUrl = cfg.url || 'https://changelog.artsvp.com/feed.json';
  var storageKey = 'artsvp_changelog_last_seen';

  function injectBadge(el, count) {
    var existing = el.querySelector('.artsvp-badge');
    if (existing) existing.parentNode.removeChild(existing);

    var badge = document.createElement('span');
    badge.className = 'artsvp-badge';
    badge.textContent = count > 9 ? '9+' : String(count);
    badge.style.cssText = [
      'position:absolute',
      'top:-6px',
      'right:-6px',
      'min-width:18px',
      'height:18px',
      'padding:0 4px',
      'border-radius:9px',
      'background:#e53e3e',
      'color:#fff',
      'font-size:11px',
      'font-weight:700',
      'line-height:18px',
      'text-align:center',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'pointer-events:none',
      'z-index:9999',
      'box-sizing:border-box'
    ].join(';');

    var pos = getComputedStyle(el).position;
    if (pos === 'static') el.style.position = 'relative';
    el.appendChild(badge);
  }

  function clearBadge(el) {
    var existing = el.querySelector('.artsvp-badge');
    if (existing) existing.parentNode.removeChild(existing);
  }

  function run(entries) {
    var lastSeen = localStorage.getItem(storageKey) || '';
    var latestDate = entries.length ? entries[0].date : '';

    var count = 0;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].date > lastSeen) count++;
      else break;
    }

    var els = document.querySelectorAll(selector);
    for (var j = 0; j < els.length; j++) {
      (function(el) {
        if (count > 0) {
          injectBadge(el, count);
          el.addEventListener('click', function() {
            localStorage.setItem(storageKey, latestDate);
            clearBadge(el);
          }, { once: true });
        }
      })(els[j]);
    }
  }

  function init() {
    fetch(feedUrl)
      .then(function(r) { return r.json(); })
      .then(function(data) { run(data.entries || []); })
      .catch(function() {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
