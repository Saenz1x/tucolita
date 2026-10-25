/* ============================================================
   TU COLITA LOUNGE — inicio.js
   Página central: estado abierto/cerrado, tabla de horarios,
   textos editables, nav de vidrio, muro perezoso, video de la noche, revelado
   escalonado, emblema que responde al puntero y acceso al panel.
   ============================================================ */
(function () {
  "use strict";

  var $ = function (sel) { return document.querySelector(sel); };
  var CLAVES_DIA = TuColitaHorario.CLAVES_DIA;
  var ROTULOS_TABLA = [
    { clave: "lun", rotulo: "Lunes" }, { clave: "mar", rotulo: "Martes" },
    { clave: "mie", rotulo: "Miércoles" }, { clave: "jue", rotulo: "Jueves" },
    { clave: "vie", rotulo: "Viernes" }, { clave: "sab", rotulo: "Sábado" },
    { clave: "dom", rotulo: "Domingo" }
  ];

  var horariosNegocio = null;
  var cuentaAdmin = null;
  var pocoMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- estado abierto / cerrado ---------- */

  function pintarEstado(preapertura) {
    var caja = $("#estado-negocio");
    var kicker = $("#hero-kicker");
    if (!caja || !horariosNegocio) return;
    var texto = caja.querySelector(".estado__texto");

    if (preapertura) {
      caja.classList.remove("estado--abierto");
      texto.textContent = "Abrimos pronto";
      if (kicker) kicker.textContent = "Café · Cocina · Lounge — El Centro de Buenaventura";
      return;
    }
    var e = TuColitaHorario.estado(horariosNegocio);
    caja.classList.toggle("estado--abierto", e.abierto);
    texto.textContent = e.texto;
    // El encabezado saluda según la hora de Buenaventura.
    if (kicker) kicker.textContent = TuColitaHorario.saludo(horariosNegocio);
  }

  function pintarTablaHorarios() {
    var tabla = $("#tabla-horarios tbody");
    if (!tabla || !horariosNegocio) return;
    var hoy = CLAVES_DIA[TuColitaHorario.ahoraEnColombia().dia];
    tabla.innerHTML = ROTULOS_TABLA.map(function (d) {
      var h = horariosNegocio[d.clave];
      var valor = (!h || h.cerrado) ? "Cerrado"
        : TuColitaHorario.horaBonita(h.abre) + " – " + TuColitaHorario.horaBonita(h.cierra);
      return "<tr" + (d.clave === hoy ? ' class="hoy"' : "") + "><td>" + d.rotulo + "</td><td>" + valor + "</td></tr>";
    }).join("");
  }

  /* ---------- horarios del pie, agrupados ---------- */

  // "Lunes a jueves y domingo", "Viernes y sábado": junta los días con el
  // mismo horario y los nombra por tramos seguidos.
  function nombrarDias(claves) {
    var orden = ROTULOS_TABLA.map(function (d) { return d.clave; });
    var nombre = {};
    ROTULOS_TABLA.forEach(function (d) { nombre[d.clave] = d.rotulo.toLowerCase(); });
    var idx = claves.map(function (k) { return orden.indexOf(k); }).sort(function (a, b) { return a - b; });

    var tramos = [], actual = [idx[0]];
    for (var i = 1; i < idx.length; i++) {
      if (idx[i] === idx[i - 1] + 1) actual.push(idx[i]);
      else { tramos.push(actual); actual = [idx[i]]; }
    }
    tramos.push(actual);

    var partes = tramos.map(function (t) {
      var a = nombre[orden[t[0]]], b = nombre[orden[t[t.length - 1]]];
      if (t.length === 1) return a;
      if (t.length === 2) return a + " y " + b;
      return a + " a " + b;
    });
    var texto = partes.length > 1
      ? partes.slice(0, -1).join(", ") + " y " + partes[partes.length - 1]
      : partes[0];
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  function pintarHorariosPie() {
    var caja = $("#footer-horarios");
    if (!caja || !horariosNegocio) return;
    var grupos = {};
    ROTULOS_TABLA.forEach(function (d) {
      var h = horariosNegocio[d.clave];
      if (!h || h.cerrado) return;
      var llave = h.abre + "-" + h.cierra;
      (grupos[llave] = grupos[llave] || { h: h, dias: [] }).dias.push(d.clave);
    });
    var html = Object.keys(grupos).map(function (k) {
      var g = grupos[k];
      return '<div class="footer__horario"><p class="footer__dias">' + nombrarDias(g.dias) +
        "</p><p>De " + TuColitaHorario.horaBonita(g.h.abre) + " a " +
        TuColitaHorario.horaBonita(g.h.cierra) + "</p></div>";
    }).join("");
    if (html) caja.innerHTML = html;
  }

  /* ---------- textos editables desde negocio.json ---------- */

  function pintarTextos(t) {
    if (!t) return;
    var mapa = {
      "hero-titulo": t.heroTitulo, "hero-bajada": t.heroBajada, "hero-voz": t.heroVoz,
      "concepto-titulo": t.conceptoTitulo, "concepto-p1": t.conceptoParrafo1,
      "concepto-p2": t.conceptoParrafo2, "noche-titulo": t.nocheTitulo,
      "noche-parrafo": t.nocheParrafo, "noche-epigrafe": t.nocheEpigrafe,
      "muro-parrafo": t.muroParrafo, "carta-titulo": t.cartaTitulo
    };
    Object.keys(mapa).forEach(function (id) {
      var el = document.getElementById(id);
      if (el && mapa[id]) el.textContent = mapa[id];
    });
  }

  /* ---------- nav: gana vidrio al hacer scroll ---------- */

  var nav = $("#nav");
  function ajustarNav() { nav.classList.toggle("con-fondo", window.scrollY > 28); }
  window.addEventListener("scroll", ajustarNav, { passive: true });
  ajustarNav();

  /* ---------- el emblema sigue al puntero, muy poquito ---------- */

  /* ---------- conmutador Día / Noche ---------- */

  function temaActual() {
    var guardado = document.documentElement.getAttribute("data-tema");
    if (guardado) return guardado;
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "dia" : "noche";
  }

  function prepararTema() {
    var caja = $("#conmutador-tema");
    if (!caja) return;
    var marcar = function (tema) {
      caja.querySelectorAll("button").forEach(function (b) {
        b.setAttribute("aria-pressed", b.dataset.tema === tema ? "true" : "false");
      });
    };
    marcar(temaActual());
    caja.addEventListener("click", function (ev) {
      var b = ev.target.closest("button[data-tema]");
      if (!b) return;
      document.documentElement.setAttribute("data-tema", b.dataset.tema);
      try { localStorage.setItem("tucolita_tema", b.dataset.tema); } catch (e) { }
      marcar(b.dataset.tema);
    });
  }

  function prepararEmblema() {
    // Hay dos marcas (noche y día); se inclinan las dos, porque la
    // visible depende del tema y puede cambiar sin recargar.
    var emblemas = document.querySelectorAll(".hero__marca");
    if (!emblemas.length || pocoMovimiento) return;
    if (!window.matchMedia("(hover: hover)").matches) return;   // en táctil, quieto

    var hero = emblemas[0].closest(".hero");
    var pendiente = false, x = 0, y = 0;

    hero.addEventListener("pointermove", function (ev) {
      var caja = hero.getBoundingClientRect();
      x = ((ev.clientX - caja.left) / caja.width - .5) * 2;
      y = ((ev.clientY - caja.top) / caja.height - .5) * 2;
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(function () {
        pendiente = false;
        var t = "perspective(900px) rotateY(" + (x * 7).toFixed(2) + "deg) rotateX(" +
                (-y * 7).toFixed(2) + "deg) translateZ(0)";
        emblemas.forEach(function (el) { el.style.transform = t; });
      });
    });
    hero.addEventListener("pointerleave", function () {
      emblemas.forEach(function (el) { el.style.transform = ""; });
    });
  }

  /* ---------- muro: el iframe entra solo cuando se ve ---------- */

  function prepararMuro() {
    var marco = $("#muro-marco");
    if (!marco) return;
    var cargar = function () {
      if (marco.dataset.cargado) return;
      marco.dataset.cargado = "1";
      var iframe = document.createElement("iframe");
      iframe.src = marco.dataset.muro;
      iframe.loading = "lazy";
      iframe.title = "Muro de la comunidad de Tu Colita en Padlet";
      iframe.allow = "camera;microphone;geolocation";
      marco.innerHTML = "";
      marco.appendChild(iframe);
    };
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entradas) {
        entradas.forEach(function (e) {
          if (e.isIntersecting) { cargar(); io.disconnect(); }
        });
      }, { rootMargin: "300px" });
      io.observe(marco);
    } else {
      cargar();
    }
  }

  /* ---------- video de la noche: siempre en bucle, sin sonido ---------- */

  function prepararVideo() {
    var video = $("#video-noche");
    if (!video) return;
    var reproducir = function () {
      var intento = video.play();
      if (intento && intento.catch) intento.catch(function () {});
    };
    // Algunos celulares (ahorro de batería) frenan el autoplay: se reintenta
    // al primer toque o scroll, y se pausa fuera de pantalla para no gastar.
    ["touchstart", "scroll", "click"].forEach(function (ev) {
      window.addEventListener(ev, function () { if (video.paused) reproducir(); }, { once: true, passive: true });
    });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entradas) {
        entradas.forEach(function (e) {
          if (e.isIntersecting) reproducir(); else video.pause();
        });
      }, { threshold: .2 }).observe(video);
    } else {
      reproducir();
    }
  }

  /* ---------- revelado al hacer scroll, escalonado por grupo ---------- */

  function prepararRevelado() {
    var elementos = document.querySelectorAll(".revelar");
    if (pocoMovimiento || !("IntersectionObserver" in window)) {
      elementos.forEach(function (el) { el.classList.add("visto"); });
      return;
    }
    var io = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("visto");
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: .12 });
    elementos.forEach(function (el) { io.observe(el); });

    // Las fichas entran una tras otra, no todas de golpe.
    document.querySelectorAll(".fichas .ficha").forEach(function (f, i) {
      f.classList.add("revelar");
      f.style.setProperty("--retraso", (i * 90) + "ms");
      io.observe(f);
    });
  }

  /* ---------- acceso al panel ---------- */

  function huellaContrasena(contrasena, salHex, iteraciones) {
    var sal = new Uint8Array(salHex.length / 2);
    for (var i = 0; i < sal.length; i++) sal[i] = parseInt(salHex.substr(i * 2, 2), 16);
    return crypto.subtle.importKey("raw", new TextEncoder().encode(contrasena), "PBKDF2", false, ["deriveBits"])
      .then(function (base) {
        return crypto.subtle.deriveBits(
          { name: "PBKDF2", salt: sal, iterations: iteraciones, hash: "SHA-256" }, base, 256);
      })
      .then(function (buf) {
        return Array.from(new Uint8Array(buf)).map(function (b) {
          return b.toString(16).padStart(2, "0");
        }).join("");
      });
  }

  function prepararAdmin() {
    var boton = $("#boton-admin");
    var modal = $("#modal-admin");
    var form = $("#form-admin");
    var usuario = $("#usuario-admin");
    var campo = $("#clave-admin");
    var error = $("#error-admin");
    if (!boton || !modal) return;

    var abrir = function () {
      modal.classList.add("visible");
      error.textContent = "";
      usuario.value = "";
      campo.value = "";
      setTimeout(function () { usuario.focus(); }, 60);
    };
    var cerrar = function () { modal.classList.remove("visible"); };

    boton.addEventListener("click", abrir);
    $("#cerrar-admin").addEventListener("click", cerrar);
    $("#cancelar-admin").addEventListener("click", cerrar);
    modal.addEventListener("click", function (ev) { if (ev.target === modal) cerrar(); });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && modal.classList.contains("visible")) cerrar();
    });

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      error.textContent = "";
      var correo = usuario.value.trim().toLowerCase();
      var clave = campo.value;
      if (!correo || !clave) { error.textContent = "Faltan datos."; return; }
      if (!cuentaAdmin) {
        // Sin cuenta leída no se bloquea el paso: el panel pide el ingreso igual.
        location.href = "admin.html";
        return;
      }
      if (!(window.crypto && crypto.subtle)) {
        error.textContent = "Este navegador no permite validar aquí. Entra a tucolita.com/admin.html directamente.";
        return;
      }
      var boton = form.querySelector("button[type=submit]");
      boton.disabled = true;
      huellaContrasena(clave, cuentaAdmin.sal, cuentaAdmin.iteraciones).then(function (h) {
        boton.disabled = false;
        if (correo === String(cuentaAdmin.usuario).toLowerCase() && h === cuentaAdmin.hash) {
          location.href = "admin.html";
        } else {
          error.textContent = "Usuario o contraseña incorrectos.";
          campo.value = "";
          campo.focus();
        }
      });
    });
  }

  /* ---------- arranque ---------- */

  Promise.all([
    fetch("datos/negocio.json").then(function (r) { if (!r.ok) throw 0; return r.json(); }),
    fetch("datos/preapertura.json").then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .catch(function () { return null; })
  ]).then(function (res) {
    var negocio = res[0], pre = res[1];
    horariosNegocio = negocio.horarios;
    cuentaAdmin = negocio.acceso || null;
    pintarTextos(negocio.textos);
    pintarTablaHorarios();
    pintarHorariosPie();

    // El estado se recalcula cada medio minuto, así que cuando el
    // contador llega a cero la página pasa a modo en vivo sola.
    var apertura = pre ? Date.parse(pre.apertura) : 0;
    var enPreapertura = function () { return !!(pre && pre.modo && Date.now() < apertura); };
    pintarEstado(enPreapertura());
    setInterval(function () { pintarEstado(enPreapertura()); }, 30000);
    document.addEventListener("tucolita:abierto", function () { pintarEstado(false); });
  }).catch(function () {
    // Sin datos no hay indicador en vivo; la página sigue siendo usable.
    var caja = $("#estado-negocio");
    if (caja) caja.querySelector(".estado__texto").textContent = "Lunes a domingo desde la 1:00 p.m.";
    var tabla = $("#tabla-horarios tbody");
    if (tabla) tabla.innerHTML = "<tr><td>Lunes a jueves y domingo</td><td>1:00 p.m. – 11:00 p.m.</td></tr>" +
      "<tr><td>Viernes y sábado</td><td>1:00 p.m. – 3:00 a.m.</td></tr>";
  });

  prepararTema();
  prepararEmblema();
  prepararMuro();
  prepararVideo();
  prepararRevelado();
  prepararAdmin();
})();
