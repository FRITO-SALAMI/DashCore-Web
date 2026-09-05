(function () {
  "use strict";

  var reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  var canHover = window.matchMedia("(hover: hover)").matches;

  /* =====================================================
     SCROLL STATE — topbar + barra de progreso
  ===================================================== */

  var body = document.body;
  var progressBar = document.getElementById("scroll-progress");

  function onScroll() {
    var y = window.scrollY || window.pageYOffset;

    body.classList.toggle("scrolled", y > 40);

    if (progressBar) {
      var doc = document.documentElement;
      var max = doc.scrollHeight - doc.clientHeight;
      var pct = max > 0 ? (y / max) * 100 : 0;
      progressBar.style.width = pct + "%";
    }
  }

  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

  /* =====================================================
     NAVEGACIÓN CON URLS LIMPIAS (sin #anclas)
     /  /dashboard  /disenos  /interior  /conexion  /descargar
  ===================================================== */

  var ROUTES = [
    { path: "/", target: "#inicio" },
    { path: "/dashboard", target: "#laboratorio" },
    { path: "/disenos", target: "#tableros" },
    { path: "/interior", target: "#interior" },
    { path: "/conexion", target: "#conexion" },
    { path: "/descargar", target: "#descargar" },
  ];

  var routeLinks = document.querySelectorAll("[data-route]");
  var sectionEls = {};

  ROUTES.forEach(function (r) {
    var el = document.querySelector(r.target);
    if (el) sectionEls[r.target] = el;
  });

  function activeLinkPath(path) {
    routeLinks.forEach(function (link) {
      var linkPath = link.getAttribute("href");
      link.classList.toggle("is-active", linkPath === path);
    });
  }

  // Marca visualmente en la barra de progreso/nav qué sección está activa
  var sectionObserver = null;

  function setupSectionObserver() {
    if (!("IntersectionObserver" in window)) return;

    var targets = ROUTES.map(function (r) {
      return sectionEls[r.target];
    }).filter(Boolean);

    if (!targets.length) return;

    sectionObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;

          var route = ROUTES.find(function (r) {
            return sectionEls[r.target] === entry.target;
          });

          if (route) {
            activeLinkPath(route.path);
            // Actualiza la URL sin recargar ni saltar el scroll
            if (location.pathname !== route.path) {
              history.replaceState(
                { path: route.path },
                "",
                route.path
              );
            }
          }
        });
      },
      { threshold: 0.5, rootMargin: "-10% 0px -45% 0px" }
    );

    targets.forEach(function (t) {
      sectionObserver.observe(t);
    });
  }

  function scrollToTarget(targetSelector, smooth) {
    var el = document.querySelector(targetSelector);
    if (!el) return;

    el.scrollIntoView({
      behavior: smooth && !reduceMotion ? "smooth" : "auto",
      block: "start",
    });
  }

  function navigateTo(path, options) {
    options = options || {};
    var route =
      ROUTES.find(function (r) {
        return r.path === path;
      }) || ROUTES[0];

    scrollToTarget(route.target, options.smooth !== false);
    activeLinkPath(route.path);

    if (options.pushState !== false) {
      history.pushState({ path: route.path }, "", route.path);
    }
  }

  routeLinks.forEach(function (link) {
    link.addEventListener("click", function (e) {
      var path = link.getAttribute("href");
      var isRoute = ROUTES.some(function (r) {
        return r.path === path;
      });

      if (!isRoute) return;

      e.preventDefault();
      navigateTo(path, { smooth: true, pushState: true });
    });
  });

  window.addEventListener("popstate", function () {
    navigateTo(location.pathname, { smooth: true, pushState: false });
  });

  // Al cargar: si la URL ya apunta a una ruta limpia (/descargar, etc.)
  // saltamos directo a esa sección sin animación.
  (function initialRoute() {
    var initialPath = location.pathname.replace(/\/$/, "") || "/";
    var match = ROUTES.find(function (r) {
      return r.path === initialPath;
    });

    if (match && match.path !== "/") {
      // Espera a que el layout esté listo para medir posiciones correctas
      window.requestAnimationFrame(function () {
        navigateTo(match.path, { smooth: false, pushState: false });
        setupSectionObserver();
      });
    } else {
      activeLinkPath("/");
      setupSectionObserver();
    }
  })();

  /* =====================================================
     RELOJ EN VIVO
  ===================================================== */

  function pad(n) {
    return n < 10 ? "0" + n : "" + n;
  }

  var dashTime = document.getElementById("dash-time");
  var liveClock = document.getElementById("live-clock");

  function updateClocks() {
    var now = new Date();
    var hh = pad(now.getHours());
    var mm = pad(now.getMinutes());
    var ss = pad(now.getSeconds());

    if (dashTime) dashTime.textContent = hh + ":" + mm;
    if (liveClock) liveClock.textContent = hh + ":" + mm + ":" + ss;
  }

  updateClocks();
  setInterval(updateClocks, 1000);

  /* =====================================================
     UTILIDADES
  ===================================================== */

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function walk(value, min, max, step) {
    return clamp(value + (Math.random() - 0.5) * step, min, max);
  }

  /* =====================================================
     ESTADO DEL VEHÍCULO
  ===================================================== */

  var IDLE_RPM = 800;
  var MAX_RPM = 6800;
  var REDLINE = 6500;
  var MAX_SPEED = 220;

  var state = {
    throttle: 0, // 0..1 valor suavizado que realmente mueve el motor
    throttleTarget: 0, // 0..1 hacia donde va (pedal presionado o no)
    braking: false,

    rpm: IDLE_RPM,
    speed: 0,
    temp: 84,
    battery: 14.2,
    fuel: 78,
  };

  var els = {
    rpmNeedle: document.getElementById("rpm-needle"),
    rpmValue: document.getElementById("rpm-value"),
    liveRpmNeedle: document.getElementById("live-rpm-needle"),
    liveRpm: document.getElementById("live-rpm"),

    speedValue: document.getElementById("speed-value"),
    liveSpeed: document.getElementById("live-speed"),
    speedProgress: document.getElementById("speed-progress"),

    tempProgress: document.getElementById("temp-progress"),
    tempValue: document.getElementById("temp-value"),
    liveTempRing: document.getElementById("live-temp-ring"),
    liveTemp: document.getElementById("live-temp"),

    battery: document.getElementById("battery"),
    liveBattery: document.getElementById("live-battery"),

    fuel: document.getElementById("fuel"),
    fuelBar: document.getElementById("fuel-bar"),
    liveFuel: document.getElementById("live-fuel"),
    liveFuelBar: document.getElementById("live-fuel-bar"),

    throttlePercent: document.getElementById("throttle-percent"),
    throttleState: document.getElementById("throttle-state"),

    pedalGas: document.getElementById("pedal-gas"),
    pedalBrake: document.getElementById("pedal-brake"),
    pedalFill: document.getElementById("pedal-fill"),
  };

  function rpmAngle(rpmThousands) {
    var t = clamp(rpmThousands / 7, 0, 1);
    return -108 + t * 216;
  }

  /* =====================================================
     LOOP PRINCIPAL — física simple con inercia
  ===================================================== */

  var lastFrame = null;

  function frame(now) {
    if (lastFrame === null) lastFrame = now;
    var dt = Math.min((now - lastFrame) / 1000, 0.1); // segundos, con tope
    lastFrame = now;

    step(dt);
    render();

    requestAnimationFrame(frame);
  }

  function step(dt) {
    /* --- suavizado del acelerador (attack rápido, release con inercia) --- */
    var throttleRate = state.throttleTarget > state.throttle ? 3.2 : 1.6;
    state.throttle = lerp(
      state.throttle,
      state.throttleTarget,
      clamp(throttleRate * dt, 0, 1)
    );

    if (state.braking) {
      // el freno corta el acelerador de golpe
      state.throttle = lerp(state.throttle, 0, clamp(6 * dt, 0, 1));
    }

    if (state.throttle < 0.003) state.throttle = 0;

    /* --- RPM: sigue al acelerador, con caída más lenta que la subida --- */
    var rpmTarget = IDLE_RPM + state.throttle * (MAX_RPM - IDLE_RPM);
    var rpmRate = rpmTarget > state.rpm ? 5.5 : 2.2;
    state.rpm = lerp(state.rpm, rpmTarget, clamp(rpmRate * dt, 0, 1));

    if (state.braking) {
      // al frenar el motor vuelve a ralentí más rápido (freno motor)
      state.rpm = lerp(state.rpm, IDLE_RPM, clamp(3 * dt, 0, 1));
    }

    // pequeña respiración al ralentí para que no se vea muerto
    if (state.throttle < 0.02 && !state.braking) {
      state.rpm = walk(state.rpm, IDLE_RPM - 40, IDLE_RPM + 60, 30 * dt);
    }

    state.rpm = clamp(state.rpm, IDLE_RPM - 40, MAX_RPM);

    /* --- Velocidad: motor simple con arrastre aerodinámico --- */
    var driveForce = state.throttle * 42; // aceleración máxima aprox (km/h por segundo)
    var drag = 0.05 * state.speed; // resistencia proporcional a la velocidad
    var brakeForce = state.braking ? 70 : 0;

    var accel = driveForce - drag - brakeForce;
    state.speed = clamp(state.speed + accel * dt, 0, MAX_SPEED);

    if (state.speed < 0.4 && state.throttle === 0) state.speed = 0;

    /* --- Temperatura: sube con carga sostenida, baja despacio en ralentí --- */
    var tempTarget = 84 + (state.rpm / MAX_RPM) * 30;
    state.temp = lerp(state.temp, tempTarget, clamp(0.35 * dt, 0, 1));
    state.temp = clamp(state.temp, 80, 118);

    /* --- Batería/alternador: leve subida bajo carga, ruido de fondo --- */
    var battTarget = 13.9 + (state.rpm / MAX_RPM) * 0.7;
    state.battery = lerp(state.battery, battTarget, clamp(0.5 * dt, 0, 1));
    state.battery = walk(state.battery, 13.4, 14.7, 0.03);

    /* --- Combustible: baja más rápido con más acelerador --- */
    var consumption = (0.003 + state.throttle * 0.02) * dt * 10;
    state.fuel = Math.max(6, state.fuel - consumption);
  }

  function render() {
    var rpmK = state.rpm / 1000;
    var angle = rpmAngle(rpmK);

    if (els.rpmValue) els.rpmValue.textContent = rpmK.toFixed(2);
    if (els.liveRpm) els.liveRpm.textContent = Math.round(state.rpm);
    if (els.rpmNeedle) els.rpmNeedle.style.transform = "rotate(" + angle + "deg)";
    if (els.liveRpmNeedle)
      els.liveRpmNeedle.style.transform = "rotate(" + angle + "deg)";

    var spd = Math.round(state.speed);
    if (els.speedValue) els.speedValue.textContent = spd;
    if (els.liveSpeed) els.liveSpeed.textContent = spd;
    if (els.speedProgress)
      els.speedProgress.style.width = clamp((spd / MAX_SPEED) * 100, 0, 100) + "%";

    var temp = Math.round(state.temp);
    var tempPct = clamp(((temp - 70) / (120 - 70)) * 100, 0, 100);
    var tempColor =
      temp > 108 ? "var(--red)" : temp > 98 ? "var(--orange)" : "var(--green)";
    var tempGrad =
      "conic-gradient(" +
      tempColor +
      " 0 " +
      tempPct +
      "%, rgba(255,255,255,.05) " +
      tempPct +
      "%)";

    if (els.tempValue) els.tempValue.textContent = temp + "°";
    if (els.liveTemp) els.liveTemp.textContent = temp + "°";
    if (els.tempProgress) els.tempProgress.style.background = tempGrad;
    if (els.liveTempRing) els.liveTempRing.style.background = tempGrad;

    var batt = state.battery.toFixed(1);
    if (els.battery) els.battery.textContent = batt + " V";
    if (els.liveBattery) els.liveBattery.textContent = batt + " V";

    var fuelPct = Math.round(state.fuel);
    if (els.fuel) els.fuel.textContent = fuelPct;
    if (els.liveFuel) els.liveFuel.textContent = fuelPct;
    if (els.fuelBar) els.fuelBar.style.width = fuelPct + "%";
    if (els.liveFuelBar) els.liveFuelBar.style.width = fuelPct + "%";

    var throttlePct = Math.round(state.throttle * 100);
    if (els.throttlePercent) els.throttlePercent.textContent = throttlePct + "%";

    if (els.pedalFill) els.pedalFill.style.height = throttlePct + "%";

    if (els.throttleState) {
      if (state.braking) {
        els.throttleState.textContent = "FRENANDO";
        els.throttleState.classList.remove("active");
      } else if (throttlePct > 3) {
        els.throttleState.textContent = "ACELERANDO";
        els.throttleState.classList.add("active");
      } else {
        els.throttleState.textContent = "RALENTÍ";
        els.throttleState.classList.remove("active");
      }
    }
  }

  requestAnimationFrame(frame);

  /* =====================================================
     PEDALES — GAS Y FRENO
  ===================================================== */

  function bindPedal(el, onDown, onUp) {
    if (!el) return;

    el.addEventListener(
      "pointerdown",
      function (e) {
        e.preventDefault();
        try {
          el.setPointerCapture(e.pointerId);
        } catch (err) {}
        onDown();
      },
      { passive: false }
    );

    ["pointerup", "pointercancel", "pointerleave", "lostpointercapture"].forEach(
      function (evt) {
        el.addEventListener(evt, function () {
          onUp();
        });
      }
    );

    // evita que un click "fantasma" quede pegado tras soltar fuera del pedal
    el.addEventListener("contextmenu", function (e) {
      e.preventDefault();
    });
  }

  bindPedal(
    els.pedalGas,
    function () {
      state.braking = false;
      state.throttleTarget = 1;
      if (els.pedalGas) els.pedalGas.classList.add("pressed");
      if (els.pedalBrake) els.pedalBrake.classList.remove("pressed");
    },
    function () {
      state.throttleTarget = 0;
      if (els.pedalGas) els.pedalGas.classList.remove("pressed");
    }
  );

  bindPedal(
    els.pedalBrake,
    function () {
      state.braking = true;
      state.throttleTarget = 0;
      if (els.pedalBrake) els.pedalBrake.classList.add("pressed");
      if (els.pedalGas) els.pedalGas.classList.remove("pressed");
    },
    function () {
      state.braking = false;
      if (els.pedalBrake) els.pedalBrake.classList.remove("pressed");
    }
  );

  // seguridad: si el usuario suelta en cualquier parte de la ventana
  window.addEventListener("pointerup", function () {
    state.throttleTarget = 0;
    state.braking = false;
    if (els.pedalGas) els.pedalGas.classList.remove("pressed");
    if (els.pedalBrake) els.pedalBrake.classList.remove("pressed");
  });

  /* =====================================================
     PARALLAX SUAVE DEL CLÚSTER EN EL HERO
  ===================================================== */

  var cluster = document.querySelector(".hero-cluster");
  var heroSection = document.querySelector(".hero");

  if (cluster && heroSection && !reduceMotion && canHover) {
    heroSection.addEventListener("pointermove", function (e) {
      var r = heroSection.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - 0.5;
      var py = (e.clientY - r.top) / r.height - 0.5;

      cluster.style.transform =
        "translateY(-50%) perspective(900px) rotateY(" +
        (-4 - px * 6).toFixed(2) +
        "deg) rotateX(" +
        (py * 4).toFixed(2) +
        "deg)";
    });

    heroSection.addEventListener("pointerleave", function () {
      cluster.style.transform = "";
    });
  }

  /* =====================================================
     SCROLL REVEAL
  ===================================================== */

  var revealEls = document.querySelectorAll("[data-reveal]");

  if ("IntersectionObserver" in window && revealEls.length) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16, rootMargin: "0px 0px -60px 0px" }
    );

    revealEls.forEach(function (el) {
      io.observe(el);
    });
  } else {
    revealEls.forEach(function (el) {
      el.classList.add("is-visible");
    });
  }

  /* =====================================================
     WIDGETS ARRASTRABLES DEL DASHBOARD
  ===================================================== */

  var stage = document.getElementById("dashboard-stage");

  if (stage) {
    var items = stage.querySelectorAll(".draggable");

    items.forEach(function (item) {
      var dragging = false;
      var startX = 0;
      var startY = 0;
      var origLeft = 0;
      var origTop = 0;

      item.addEventListener("pointerdown", function (e) {
        dragging = true;
        item.classList.add("is-dragging");

        try {
          item.setPointerCapture(e.pointerId);
        } catch (err) {}

        startX = e.clientX;
        startY = e.clientY;
        origLeft = item.offsetLeft;
        origTop = item.offsetTop;
        item.style.zIndex = 50;
      });

      item.addEventListener("pointermove", function (e) {
        if (!dragging) return;

        var stageRect = stage.getBoundingClientRect();
        var dx = e.clientX - startX;
        var dy = e.clientY - startY;

        var newLeft = clamp(
          origLeft + dx,
          0,
          stageRect.width - item.offsetWidth
        );
        var newTop = clamp(
          origTop + dy,
          0,
          stageRect.height - item.offsetHeight
        );

        item.style.left = (newLeft / stageRect.width) * 100 + "%";
        item.style.top = (newTop / stageRect.height) * 100 + "%";
      });

      function release() {
        dragging = false;
        item.classList.remove("is-dragging");
        item.style.zIndex = "";
      }

      item.addEventListener("pointerup", release);
      item.addEventListener("pointercancel", release);
    });
  }

  /* =====================================================
     SPOTLIGHT QUE SIGUE EL CURSOR EN LAS TARJETAS DE DESCARGA
  ===================================================== */

  if (canHover) {
    document.querySelectorAll(".download-card").forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty("--mx", e.clientX - r.left + "px");
        el.style.setProperty("--my", e.clientY - r.top + "px");
      });
    });
  }
})();

/* =========================================================
   DASHCORE — RPM TACHOMETER CURSOR
   ========================================================= */

(function () {

    "use strict";

    const cursor = document.getElementById("dcSportCursor");

    if (!cursor) return;

    const wheel = cursor.querySelector(".dc-wheel");

    const needle = cursor.querySelector(".dc-needle");

    if (!wheel || !needle) return;

    /* No ejecutar en dispositivos táctiles */
    if (window.matchMedia("(pointer: coarse)").matches) {
        return;
    }

    let mouseX = 0;
    let mouseY = 0;

    let visible = false;

    let hoverTarget = false;

    /*
     * Movimiento directo.
     * Sin interpolación para que no se sienta pesado.
     */
    document.addEventListener(
        "mousemove",
        function (event) {

            mouseX = event.clientX;
            mouseY = event.clientY;

            cursor.style.transform =
                "translate3d(" +
                mouseX +
                "px," +
                mouseY +
                "px,0) translate(-50%,-50%)";

            if (!visible) {

                visible = true;

                cursor.style.opacity = "1";

            }

        },
        {
            passive: true
        }
    );

    /*
     * Detectar elementos interactivos.
     */
    document.addEventListener(
        "mouseover",
        function (event) {

            const target = event.target.closest(
                "a, button, input, textarea, select, " +
                "[role='button'], [onclick], .clickable"
            );

            if (!target) return;

            if (!hoverTarget) {

                hoverTarget = true;

                cursor.classList.add("dc-hover");

            }

        },
        {
            passive: true
        }
    );

    document.addEventListener(
        "mouseout",
        function (event) {

            const target = event.target.closest(
                "a, button, input, textarea, select, " +
                "[role='button'], [onclick], .clickable"
            );

            if (!target) return;

            /*
             * Solo quitar hover si realmente salimos
             * del elemento.
             */
            if (!target.contains(event.relatedTarget)) {

                hoverTarget = false;

                cursor.classList.remove("dc-hover");

            }

        },
        {
            passive: true
        }
    );

    /*
     * Click = pequeño aumento de RPM.
     */
    document.addEventListener(
        "mousedown",
        function () {

            cursor.classList.add("dc-click");

        },
        {
            passive: true
        }
    );

    document.addEventListener(
        "mouseup",
        function () {

            cursor.classList.remove("dc-click");

        },
        {
            passive: true
        }
    );

    /*
     * Salir de la página.
     */
    document.addEventListener(
        "mouseleave",
        function () {

            cursor.style.opacity = "0";

        },
        {
            passive: true
        }
    );

    document.addEventListener(
        "mouseenter",
        function () {

            if (visible) {
                cursor.style.opacity = "1";
            }

        },
        {
            passive: true
        }
    );

})();