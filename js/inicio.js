/* ============================================================
   TU COLITA LOUNGE — inicio.js
   Página central: estado abierto/cerrado, tabla de horarios,
   textos editables desde negocio.json, nav con fondo al hacer
   scroll, muro perezoso y revelado sutil.
   ============================================================ */
(function () {
  "use strict";

  var $ = function (sel) { return document.querySelector(sel); };

  /* ---------- horario (la lógica vive en js/horario.js) ---------- */

  var CLAVES_DIA = TuColitaHorario.CLAVES_DIA;
  var ROTULOS_TABLA = [
    { clave: "lun", rotulo: "Lunes" }, { clave: "mar", rotulo: "Martes" },
    { clave: "mie", rotulo: "Miércoles" }, { clave: "jue", rotulo: "Jueves" },
    { clave: "vie", rotulo: "Viernes" }, { clave: "sab", rotulo: "Sábado" },
    { clave: "dom", rotulo: "Domingo" }
  ];

  var horariosNegocio = null;

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

  /* ---------- nav: gana fondo al hacer scroll ---------- */

  var nav = $("#nav");
  function ajustarNav() { nav.classList.toggle("con-fondo", window.scrollY > 24); }
  window.addEventListener("scroll", ajustarNav, { passive: true });
  ajustarNav();

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

  /* ---------- revelado sutil, una sola vez ---------- */

  function prepararRevelado() {
    var reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var elementos = document.querySelectorAll(".revelar");
    if (reducido || !("IntersectionObserver" in window)) {
      elementos.forEach(function (el) { el.classList.add("visto"); });
      return;
    }
    var io = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("visto"); io.unobserve(e.target); }
      });
    }, { rootMargin: "-40px" });
    elementos.forEach(function (el) { io.observe(el); });
  }

  /* ---------- arranque ---------- */

  Promise.all([
    fetch("datos/negocio.json").then(function (r) { if (!r.ok) throw 0; return r.json(); }),
    fetch("datos/preapertura.json").then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .catch(function () { return null; })
  ]).then(function (res) {
    var negocio = res[0], pre = res[1];
    horariosNegocio = negocio.horarios;
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

  prepararMuro();
  prepararRevelado();
})();
