// ============================================================
//  LANDING PAGE — animação do hero e scroll reveal
// ============================================================

// ── HERO CANVAS ─────────────────────────────────────────────
(function () {
  var cv = document.getElementById('heroCanvas');
  var hero = document.getElementById('hero');
  if (!cv || !hero) return;

  var ctx = cv.getContext('2d');
  var N_PTS = 58;
  var DIST = 135;
  var DIST2 = DIST * DIST;
  var W = 0, H = 0, pts = [], animFrameId = 0;
  var isHeroVisible = true;
  var resizePending = false;

  function resize() {
    W = cv.width = window.innerWidth;
    H = cv.height = cv.parentElement.offsetHeight;
  }

  function mkPts(n) {
    pts = [];
    for (var i = 0; i < n; i++) {
      pts.push({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.38, vy: (Math.random() - 0.5) * 0.38,
        r: Math.random() * 2.4 + 0.9, pulse: Math.random() * Math.PI * 2,
      });
    }
  }

  function draw() {
    if (!isHeroVisible) return;

    ctx.clearRect(0, 0, W, H);
    var n = pts.length, i, j, p, q;

    for (i = 0; i < n; i++) {
      p = pts[i];
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
      p.pulse += 0.018;
    }

    // Linhas entre pontos próximos: compara a distância ao quadrado
    // e só calcula a raiz quando a linha será de fato desenhada.
    ctx.lineWidth = 1;
    for (i = 0; i < n; i++) {
      p = pts[i];
      for (j = i + 1; j < n; j++) {
        q = pts[j];
        var dx = p.x - q.x, dy = p.y - q.y, d2 = dx * dx + dy * dy;
        if (d2 < DIST2) {
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
          ctx.strokeStyle = 'rgba(255,255,255,' + (1 - Math.sqrt(d2) / DIST) * 0.22 + ')';
          ctx.stroke();
        }
      }
    }

    for (i = 0; i < n; i++) {
      p = pts[i];
      var pulse = 0.7 + 0.3 * Math.sin(p.pulse);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * pulse, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fill();
      if (p.r > 2.5) {
        ctx.strokeStyle = 'rgba(200,16,46,.65)'; ctx.lineWidth = 1.4;
        var s = 4.5;
        ctx.beginPath(); ctx.moveTo(p.x - s, p.y); ctx.lineTo(p.x + s, p.y);
        ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x, p.y + s); ctx.stroke();
        ctx.lineWidth = 1;
      }
    }

    animFrameId = requestAnimationFrame(draw);
  }

  // Agrupa vários eventos de resize em um por frame. Os pontos só são
  // recriados quando a largura muda (no celular, a barra de endereço
  // dispara resize só de altura ao rolar a página).
  window.addEventListener('resize', function () {
    if (resizePending) return;
    resizePending = true;
    requestAnimationFrame(function () {
      resizePending = false;
      var oldW = W;
      resize();
      if (W !== oldW) mkPts(N_PTS);
    });
  }, { passive: true });

  resize(); mkPts(N_PTS); draw();

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          if (!isHeroVisible) {
            isHeroVisible = true;
            draw();
          }
        } else {
          isHeroVisible = false;
          cancelAnimationFrame(animFrameId);
        }
      });
    }, { threshold: 0 }).observe(hero);
  }
})();

// ── SCROLL REVEAL ───────────────────────────────────────────
(function () {
  var els = document.querySelectorAll('.rv');
  if (!('IntersectionObserver' in window)) {
    els.forEach(function (el) { el.classList.add('vis'); });
    return;
  }

  var obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e, i) {
      if (e.isIntersecting) {
        setTimeout(function () { e.target.classList.add('vis'); }, i * 75);
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -28px 0px' });

  els.forEach(function (el) { obs.observe(el); });
})();
