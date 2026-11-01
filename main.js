(function () {
  "use strict";

  var brand = window.__BRAND__ || {};
  var root = document.documentElement;
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var canHover = matchMedia("(hover: hover) and (pointer: fine)").matches;

  function safe(fn, name) { try { fn(); } catch (e) { console.warn("[" + name + "]", e); } }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  /* ---------- Splash ---------- */
  function initSplash() {
    var splash = $("[data-splash]");
    var done = false;
    function hide() {
      if (done) return;
      done = true;
      if (splash) splash.classList.add("is-out");
      root.classList.add("is-loaded");
    }
    if (document.readyState === "complete") setTimeout(hide, 500);
    else window.addEventListener("load", function () { setTimeout(hide, 350); });
    setTimeout(hide, 3200);
  }

  /* ---------- Nav ---------- */
  function initNav() {
    var nav = $("[data-nav]");
    var burger = $("[data-burger]");
    if (!nav) return;
    var lastY = 0;
    function onScroll() {
      var y = window.scrollY;
      nav.classList.toggle("is-solid", y > 40);
      var goingDown = y > lastY && y > 400;
      nav.classList.toggle("is-hidden", goingDown && !nav.classList.contains("is-open"));
      lastY = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    if (burger) {
      burger.addEventListener("click", function () {
        var open = nav.classList.toggle("is-open");
        burger.setAttribute("aria-expanded", open ? "true" : "false");
        burger.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
      });
      $$("[data-mobile-menu] a").forEach(function (a) {
        a.addEventListener("click", function () {
          nav.classList.remove("is-open");
          burger.setAttribute("aria-expanded", "false");
        });
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && nav.classList.contains("is-open")) { nav.classList.remove("is-open"); burger.setAttribute("aria-expanded", "false"); burger.focus(); }
      });
    }

    // Current section highlight
    var links = $$(".nav-links a");
    var map = {};
    links.forEach(function (a) { map[a.getAttribute("href").slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var a = map[e.target.id];
        if (a && e.isIntersecting) { links.forEach(function (l) { l.classList.remove("is-current"); }); a.classList.add("is-current"); }
      });
    }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
    Object.keys(map).forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
  }

  /* ---------- Smooth anchors (native) ---------- */
  function initAnchors() {
    document.addEventListener("click", function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute("href");
      if (!id || id === "#") return;
      var el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      var offset = id === "#inicio" ? 0 : 70;
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: reduced ? "auto" : "smooth" });
    });
  }

  /* ---------- Cursor ---------- */
  function initCursor() {
    if (!canHover) return;
    var c = $(".cursor"); if (!c) return;
    var dot = $(".cursor-dot", c), ring = $(".cursor-ring", c);
    var mx = 0, my = 0, rx = 0, ry = 0, first = false;
    window.addEventListener("mousemove", function (e) {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = "translate3d(" + mx + "px," + my + "px,0)";
      if (!first) { first = true; rx = mx; ry = my; c.classList.add("is-ready"); requestAnimationFrame(loop); }
    }, { passive: true });
    function loop() {
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
      ring.style.transform = "translate3d(" + rx + "px," + ry + "px,0)";
      requestAnimationFrame(loop);
    }
    document.addEventListener("mouseover", function (e) {
      c.classList.toggle("is-hover", !!e.target.closest("a, button, input, textarea, label, [data-tilt]"));
    });
    document.addEventListener("mouseleave", function () { c.classList.remove("is-ready"); });
    document.addEventListener("mouseenter", function () { if (first) c.classList.add("is-ready"); });
  }

  /* ---------- Magnetic CTA ---------- */
  function initMagnetic() {
    if (!canHover) return;
    $$("[data-magnetic]").forEach(function (el) {
      el.addEventListener("mousemove", function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty("--bx", ((e.clientX - r.left - r.width / 2) * 0.22) + "px");
        el.style.setProperty("--by", ((e.clientY - r.top - r.height / 2) * 0.3) + "px");
      });
      el.addEventListener("mouseout", function (e) {
        if (el.contains(e.relatedTarget)) return;
        el.style.setProperty("--bx", "0px"); el.style.setProperty("--by", "0px");
      });
    });
  }

  /* ---------- Hero: mouse glow + fiber strands (signature) ---------- */
  var pointer = { x: -9999, y: -9999, active: false };

  function initHeroGlow() {
    var hero = $(".hero"), glow = $("[data-glow]");
    if (!hero || !glow) return;
    hero.addEventListener("pointermove", function (e) {
      var r = hero.getBoundingClientRect();
      pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top; pointer.active = true;
      glow.style.setProperty("--mx", (pointer.x / r.width * 100) + "%");
      glow.style.setProperty("--my", (pointer.y / r.height * 100) + "%");
    });
    hero.addEventListener("pointerleave", function () { pointer.active = false; });
  }

  function initFiber() {
    var canvas = $("[data-fiber]");
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext("2d");
    var cfg = brand.fiber || {};
    var W = 0, H = 0, dpr = 1;
    var strands = [], pulses = [];
    var running = true, visible = true;
    var SEG = 70;
    var influence = { x: -9999, y: -9999, k: 0 };

    // Pre-rendered glow sprite
    var sprite = document.createElement("canvas");
    sprite.width = sprite.height = 64;
    (function () {
      var g = sprite.getContext("2d");
      var grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, "rgba(220,248,255,1)");
      grd.addColorStop(0.18, "rgba(0,176,240,.9)");
      grd.addColorStop(0.5, "rgba(0,112,192,.25)");
      grd.addColorStop(1, "rgba(0,112,192,0)");
      g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    })();

    function rand(a, b) { return a + Math.random() * (b - a); }

    function build() {
      var n = cfg.strands || 9;
      if (W < 700) n = Math.max(5, Math.round(n * 0.65));
      strands = [];
      for (var i = 0; i < n; i++) {
        var t = n === 1 ? 0.5 : i / (n - 1);
        strands.push({
          y0: 0.18 + t * 0.7 + rand(-0.03, 0.03),
          y1: 0.1 + (1 - t) * 0.5 + t * 0.45 + rand(-0.06, 0.06),
          amp: rand(18, 60),
          freq: rand(0.6, 1.4),
          phase: rand(0, Math.PI * 2),
          speed: rand(0.00008, 0.00018),
          alpha: rand(0.10, 0.24),
          pts: new Float32Array((SEG + 1) * 2)
        });
      }
      pulses = [];
      var per = cfg.pulsesPerStrand || 2;
      strands.forEach(function (s, idx) {
        for (var p = 0; p < per; p++) pulses.push({ s: idx, t: Math.random(), v: rand(0.0009, 0.0022) * (reduced ? 0.45 : 1), len: rand(0.06, 0.14), size: rand(10, 18) });
      });
    }

    function resize() {
      var r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    }

    function compute(s, time) {
      var sigma2 = 2 * 140 * 140;
      for (var i = 0; i <= SEG; i++) {
        var t = i / SEG;
        var x = -0.05 * W + t * W * 1.1;
        var base = (s.y0 + (s.y1 - s.y0) * (t * t * (3 - 2 * t))) * H;
        var y = base + Math.sin(t * s.freq * Math.PI * 2 + s.phase + time * s.speed * 6) * s.amp;
        if (influence.k > 0.001) {
          var dx = x - influence.x;
          var w = Math.exp(-(dx * dx) / sigma2);
          var dy = influence.y - y;
          var pull = Math.max(-90, Math.min(90, dy)) * 0.55 * w * influence.k;
          y += pull;
        }
        s.pts[i * 2] = x; s.pts[i * 2 + 1] = y;
      }
    }

    function pointAt(s, t) {
      var f = Math.max(0, Math.min(1, t)) * SEG;
      var i = Math.floor(f), k = f - i;
      if (i >= SEG) { i = SEG - 1; k = 1; }
      return [s.pts[i * 2] + (s.pts[i * 2 + 2] - s.pts[i * 2]) * k, s.pts[i * 2 + 1] + (s.pts[i * 2 + 3] - s.pts[i * 2 + 1]) * k];
    }

    function frame(time) {
      if (!running) return;
      requestAnimationFrame(frame);
      if (!visible) return;

      // ease the mouse influence
      var target = pointer.active ? 1 : 0;
      influence.k += (target - influence.k) * 0.06;
      if (pointer.active) {
        influence.x += (pointer.x - influence.x) * (influence.x < -999 ? 1 : 0.12);
        influence.y += (pointer.y - influence.y) * (influence.y < -999 ? 1 : 0.12);
      }

      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
      ctx.lineWidth = 1;
      for (var i = 0; i < strands.length; i++) {
        var s = strands[i];
        compute(s, time);
        ctx.beginPath();
        ctx.moveTo(s.pts[0], s.pts[1]);
        for (var j = 1; j <= SEG; j++) ctx.lineTo(s.pts[j * 2], s.pts[j * 2 + 1]);
        ctx.strokeStyle = "rgba(0,176,240," + (s.alpha + influence.k * 0.08) + ")";
        ctx.stroke();
      }

      ctx.globalCompositeOperation = "lighter";
      for (var p = 0; p < pulses.length; p++) {
        var u = pulses[p];
        u.t += u.v * (1 + influence.k * 0.6);
        if (u.t - u.len > 1) { u.t = -rand(0, 0.4); u.v = rand(0.0009, 0.0022) * (reduced ? 0.45 : 1); }
        var st = strands[u.s];
        // trail
        var steps = 14;
        for (var q = 0; q < steps; q++) {
          var tt = u.t - (q / steps) * u.len;
          if (tt < 0 || tt > 1) continue;
          var pt = pointAt(st, tt);
          var a = 1 - q / steps;
          var size = u.size * (0.35 + 0.65 * a);
          ctx.globalAlpha = a * 0.9;
          ctx.drawImage(sprite, pt[0] - size / 2, pt[1] - size / 2, size, size);
        }
      }
      ctx.globalAlpha = 1;
    }

    resize();
    var rt;
    window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(resize, 150); });
    var io = new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }, { threshold: 0 });
    io.observe(canvas);
    document.addEventListener("visibilitychange", function () { visible = !document.hidden; });
    requestAnimationFrame(frame);
  }

  /* ---------- Hero readout: live-looking measurement ---------- */
  function initReadout() {
    var db = $('[data-readout="db"]');
    if (!db) return;
    setInterval(function () {
      var v = (0.22 + Math.random() * 0.05).toFixed(2).replace(".", ",");
      db.textContent = v + " dB/km";
    }, 1800);
  }

  /* ---------- Reveals ---------- */
  function initReveals() {
    var items = $$(".reveal");
    // stagger siblings in grids
    $$(".values-grid, .stats-grid, .process-steps, .about-cards").forEach(function (g) {
      $$(".reveal", g).forEach(function (el, i) { el.style.setProperty("--rd", (i * 80) + "ms"); });
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); } });
    }, { threshold: 0.01, rootMargin: "0px 0px -6% 0px" });
    items.forEach(function (el) { io.observe(el); });
    setTimeout(function () {
      $$(".reveal:not(.is-visible)").forEach(function (el) {
        if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add("is-visible");
      });
    }, 6000);
  }

  /* ---------- Count-up ---------- */
  function initCounters() {
    var els = $$("[data-count]");
    function fmt(n, sep) {
      var s = String(Math.round(n));
      return sep ? s.replace(/\B(?=(\d{3})+(?!\d))/g, sep) : s;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        var el = e.target, end = parseFloat(el.dataset.count), sep = el.dataset.sep || "";
        var dur = reduced ? 900 : 1800, t0 = null;
        function step(t) {
          if (!t0) t0 = t;
          var p = Math.min(1, (t - t0) / dur);
          var eased = 1 - Math.pow(1 - p, 4);
          el.textContent = fmt(end * eased, sep);
          if (p < 1) requestAnimationFrame(step); else el.textContent = fmt(end, sep);
        }
        requestAnimationFrame(step);
      });
    }, { threshold: 0.01 });
    els.forEach(function (el) { el.textContent = "0"; io.observe(el); });
  }

  /* ---------- Services accordion + filter ---------- */
  function initServices() {
    var list = $("[data-svc-list]");
    if (!list) return;
    $$(".svc", list).forEach(function (item) {
      var head = $(".svc-head", item);
      if (head.dataset.bound) return;
      head.dataset.bound = "1";
      head.addEventListener("click", function () {
        var open = !item.classList.contains("is-open");
        $$(".svc.is-open", list).forEach(function (o) { if (o !== item) { o.classList.remove("is-open"); $(".svc-head", o).setAttribute("aria-expanded", "false"); } });
        item.classList.toggle("is-open", open);
        head.setAttribute("aria-expanded", open ? "true" : "false");
      });
    });
    // first item open as a hint
    var first = $(".svc", list);
    if (first) { first.classList.add("is-open"); $(".svc-head", first).setAttribute("aria-expanded", "true"); }

    var chips = $$("[data-filter]");
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        var f = chip.dataset.filter;
        chips.forEach(function (c) { var on = c === chip; c.classList.toggle("is-active", on); c.setAttribute("aria-selected", on ? "true" : "false"); });
        $$(".svc", list).forEach(function (item) {
          item.classList.toggle("is-dim", f !== "all" && item.dataset.cat !== f);
        });
      });
    });
  }

  /* ---------- Process line driven by scroll ---------- */
  function initProcess() {
    var track = $("[data-process]");
    if (!track) return;
    var steps = $$(".step", track);
    var ticking = false;
    function update() {
      ticking = false;
      var r = track.getBoundingClientRect();
      var vh = window.innerHeight;
      var p = (vh * 0.75 - r.top) / (r.height + vh * 0.25);
      p = Math.max(0, Math.min(1, p));
      track.style.setProperty("--p", p.toFixed(3));
      steps.forEach(function (s, i) { s.classList.toggle("is-lit", p >= (i / (steps.length - 1)) * 0.98 - 0.001 && p > 0.02); });
    }
    window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  /* ---------- Tilt ---------- */
  function initTilt() {
    if (!canHover) return;
    $$("[data-tilt]").forEach(function (el) {
      var max = el.classList.contains("iso-badge") ? 10 : 6;
      el.addEventListener("mousemove", function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        el.style.setProperty("--ry", ((x - 0.5) * max * 2) + "deg");
        el.style.setProperty("--rx", ((0.5 - y) * max * 2) + "deg");
        el.style.setProperty("--gx", (x * 100) + "%");
        el.style.setProperty("--gy", (y * 100) + "%");
      });
      el.addEventListener("mouseout", function (e) {
        if (el.contains(e.relatedTarget)) return;
        el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg");
      });
    });
  }

  /* ---------- Form → opens mail client with the request ---------- */
  function initForm() {
    var form = $("[data-form]");
    if (!form) return;
    var note = $("[data-form-note]");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var ok = true;
      $$("input[required], textarea[required]", form).forEach(function (f) {
        var valid = f.value.trim() !== "" && (f.type !== "email" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.value.trim()));
        f.closest(".field").classList.toggle("is-error", !valid);
        if (!valid) ok = false;
      });
      if (!ok) {
        note.textContent = "Revisa los campos marcados para continuar.";
        note.classList.add("is-warn");
        return;
      }
      note.classList.remove("is-warn");
      var d = new FormData(form);
      var subject = "Solicitud de propuesta — " + d.get("empresa");
      var body =
        "Nombre y cargo: " + d.get("nombre") + "\n" +
        "Empresa: " + d.get("empresa") + "\n" +
        "Correo: " + d.get("email") + "\n" +
        "Tipo de proyecto: " + d.get("tipo") + "\n\n" +
        "Alcance:\n" + d.get("mensaje");
      form.classList.add("is-sent");
      note.textContent = "Listo. Abrimos tu correo con la solicitud preparada.";
      setTimeout(function () {
        window.location.href = "mailto:" + (brand.email || "coordinador@optitek.biz") + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
      }, 700);
      setTimeout(function () { form.classList.remove("is-sent"); }, 4000);
    });
    $$("input, textarea", form).forEach(function (f) {
      f.addEventListener("input", function () { f.closest(".field").classList.remove("is-error"); });
    });
  }

  function initYear() { var y = $("[data-year]"); if (y) y.textContent = new Date().getFullYear(); }

  function boot() {
    safe(initSplash, "initSplash");
    safe(initNav, "initNav");
    safe(initAnchors, "initAnchors");
    safe(initCursor, "initCursor");
    safe(initMagnetic, "initMagnetic");
    safe(initHeroGlow, "initHeroGlow");
    safe(initFiber, "initFiber");
    safe(initReadout, "initReadout");
    safe(initReveals, "initReveals");
    safe(initCounters, "initCounters");
    safe(initServices, "initServices");
    safe(initProcess, "initProcess");
    safe(initTilt, "initTilt");
    safe(initForm, "initForm");
    safe(initYear, "initYear");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
