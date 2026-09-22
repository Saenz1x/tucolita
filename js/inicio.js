/* ============================================================
   TU COLITA LOUNGE — inicio.js
   Página central: estado abierto/cerrado, tabla de horarios,
   textos editables, nav de vidrio, muro perezoso, revelado
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
  var hashAdmin = "";
  var pocoMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- estado abierto / cerrado ---------- */

  function pintarEstado(preapertura) {
    var caja = $("#estado-negocio");
    if (!caja || !horariosNegocio) return;
    var texto = caja.querySelector(".estado__texto");
    if (preapertura) {
      caja.classList.remove("estado--abierto");
      texto.textContent = "Abrimos pronto";
      return;
    }
    var e = TuColitaHorario.estado(horariosNegocio);
    caja.classList.toggle("estado--abierto", e.abierto);
    texto.textContent = e.texto;
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

  /* ---------- textos editables desde negocio.json ---------- */

  function pintarTextos(t) {
    if (!t) return;
    var mapa = {
      "hero-titulo": t.heroTitulo, "hero-bajada": t.heroBajada,
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

  function prepararEmblema() {
    var emblema = $("#hero-emblema");
    if (!emblema || pocoMovimiento) return;
    if (!window.matchMedia("(hover: hover)").matches) return;   // en táctil, quieto

    var hero = emblema.closest(".hero");
    var pendiente = false, x = 0, y = 0;

    hero.addEventListener("pointermove", function (ev) {
      var caja = hero.getBoundingClientRect();
      x = ((ev.clientX - caja.left) / caja.width - .5) * 2;
      y = ((ev.clientY - caja.top) / caja.height - .5) * 2;
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(function () {
        pendiente = false;
        emblema.style.transform =
          "perspective(900px) rotateY(" + (x * 7).toFixed(2) + "deg) rotateX(" +
          (-y * 7).toFixed(2) + "deg) translateZ(0)";
      });
    });
    hero.addEventListener("pointerleave", function () {
      emblema.style.transform = "";
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

  function sha256(texto) {
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto))
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
    var campo = $("#clave-admin");
    var error = $("#error-admin");
    if (!boton || !modal) return;

    var abrir = function () {
      modal.classList.add("visible");
      error.textContent = "";
      campo.value = "";
      setTimeout(function () { campo.focus(); }, 60);
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
      var clave = campo.value.trim();
      if (!clave) return;
      if (!hashAdmin) {
        // Sin clave configurada no se bloquea el paso: el panel pide el token igual.
        location.href = "admin.html";
        return;
      }
      if (!(window.crypto && crypto.subtle)) {
        error.textContent = "Este navegador no permite validar la clave aquí. Entra a tucolita.com/admin.html directamente.";
        return;
      }
      sha256(clave).then(function (hash) {
        if (hash === hashAdmin) location.href = "admin.html";
        else { error.textContent = "Esa clave no es."; campo.select(); }
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
    hashAdmin = negocio.adminHash || "";
    pintarTextos(negocio.textos);
    pintarTablaHorarios();

    var enPreapertura = !!(pre && pre.modo && Date.now() < Date.parse(pre.apertura));
    pintarEstado(enPreapertura);
    if (!enPreapertura) setInterval(function () { pintarEstado(false); }, 60000);
  }).catch(function () {
    // Sin datos no hay indicador en vivo; la página sigue siendo usable.
    var caja = $("#estado-negocio");
    if (caja) caja.querySelector(".estado__texto").textContent = "Lunes a domingo desde la 1:00 p.m.";
    var tabla = $("#tabla-horarios tbody");
    if (tabla) tabla.innerHTML = "<tr><td>Lunes a jueves y domingo</td><td>1:00 p.m. – 11:00 p.m.</td></tr>" +
      "<tr><td>Viernes y sábado</td><td>1:00 p.m. – 3:00 a.m.</td></tr>";
  });

  prepararEmblema();
  prepararMuro();
  prepararRevelado();
  prepararAdmin();
})();
