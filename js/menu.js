/* ============================================================
   TU COLITA LOUNGE — menu.js
   Carga datos/menu.json y datos/negocio.json, arma la carta,
   el buscador, los chips, las pastillas de categoría y el
   indicador de horario. Modo vista previa con ?preview=1.
   ============================================================ */
(function () {
  "use strict";

  var WHATSAPP = "573123037666";
  var $ = function (sel) { return document.querySelector(sel); };

  var contenido = $("#contenido-menu");
  var pastillasFila = $("#pastillas-fila");
  var chipsCaja = $("#chips");
  var campoBusqueda = $("#campo-busqueda");
  var cajaBuscador = $("#buscador");
  var sinResultados = $("#sin-resultados");
  var avisoCarga = $("#aviso-carga");

  var datosMenu = null;
  var datosNegocio = null;
  var chipActivo = null;
  var esPreview = false;

  /* ---------- utilidades ---------- */

  // Normaliza para búsqueda: sin tildes, sin mayúsculas, y "sanduche"
  // y "sándwich" cuentan como la misma palabra.
  function normalizar(texto) {
    return String(texto)
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/sandwich(es)?|sanduch(es|e)?/g, "sandwich");
  }

  var formatoCOP = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
  function precio(n) { return "$" + formatoCOP.format(n); }

  function claseEtiqueta(etq) {
    var e = normalizar(etq).replace(/\s/g, "");
    if (e.indexOf("promo") === 0) return "etiqueta--promocion";
    if (e.indexOf("favorito") === 0) return "etiqueta--favorito";
    if (e.indexOf("paracompartir") === 0 || e.indexOf("compartir") >= 0) return "etiqueta--compartir";
    if (e.indexOf("sinlicor") === 0) return "etiqueta--sinlicor";
    return "etiqueta--sinlicor";
  }

  function esc(t) {
    var d = document.createElement("div");
    d.textContent = t == null ? "" : String(t);
    return d.innerHTML;
  }

  /* ---------- horario: abierto / cerrado (lógica en js/horario.js) ---------- */

  function pintarEstado(preapertura) {
    var caja = $("#estado-negocio");
    if (!caja || !datosNegocio) return;
    var texto = caja.querySelector(".estado__texto");
    if (preapertura) {
      caja.classList.remove("estado--abierto");
      texto.textContent = "Abrimos pronto";
      return;
    }
    var e = TuColitaHorario.estado(datosNegocio.horarios);
    caja.classList.toggle("estado--abierto", e.abierto);
    texto.textContent = e.texto;
  }

  /* ---------- render de la carta ---------- */

  function tarjetaProducto(p) {
    var etiquetas = (p.etiquetas || []).map(function (e) {
      return '<span class="etiqueta ' + claseEtiqueta(e) + '">' + esc(e) + "</span>";
    });
    if (p.agotado) etiquetas.push('<span class="etiqueta etiqueta--agotado">Agotado</span>');

    var mensaje = "Hola, quiero pedir: " + p.nombre + " (" + precio(p.precio) + ")";
    var enlacePedir = p.agotado ? "" :
      '<a class="producto__pedir" target="_blank" rel="noopener" href="https://wa.me/' + WHATSAPP +
      "?text=" + encodeURIComponent(mensaje) + '">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.7-1.2A9 9 0 1 0 12 3z"/></svg>' +
      "Pedir por WhatsApp</a>";
    var pedirAgotado = p.agotado ?
      '<span class="producto__pedir" aria-disabled="true">No disponible</span>' : enlacePedir;

    var foto = p.imagen ?
      '<img class="producto__foto" src="' + esc(p.imagen) + '" alt="' + esc(p.nombre) + '" loading="lazy" width="86" height="86">' : "";

    return '<article class="producto' + (p.agotado ? " agotado" : "") + '" data-buscar="' +
      esc(normalizar(p.nombre + " " + (p.descripcion || "") + " " + p.categoria)) +
      '" data-etiquetas="' + esc(normalizar((p.etiquetas || []).join("|"))) + '">' +
      '<div class="producto__cuerpo">' +
      '<h3 class="producto__nombre">' + esc(p.nombre) + "</h3>" +
      (p.descripcion ? '<p class="producto__desc">' + esc(p.descripcion) + "</p>" : "") +
      (etiquetas.length ? '<div class="etiquetas">' + etiquetas.join("") + "</div>" : "") +
      '<div class="producto__pie"><span class="producto__precio">' + precio(p.precio) + "</span>" +
      pedirAgotado + "</div></div>" + foto + "</article>";
  }

  function pintarCarta() {
    var categorias = (datosMenu.categorias || []).slice()
      .sort(function (a, b) { return (a.orden || 0) - (b.orden || 0); });
    var productos = datosMenu.productos || [];

    var html = categorias.map(function (cat, i) {
      var deCat = productos
        .filter(function (p) { return p.categoria === cat.nombre; })
        .sort(function (a, b) { return (a.orden || 0) - (b.orden || 0); });
      if (!deCat.length) return "";

      var numero = (i + 1 < 10 ? "0" : "") + (i + 1);
      return '<section class="categoria" id="cat-' + esc(cat.id) + '" data-categoria>' +
        '<header class="categoria__cab">' +
        '<span class="kicker">' + numero + " / " + esc(cat.nombre) + "</span>" +
        "<h2>" + esc(cat.nombre) + "</h2>" +
        (cat.descripcion ? "<p>" + esc(cat.descripcion) + "</p>" : "") +
        '<div class="filete filete--izq" role="presentation"></div>' +
        "</header>" +
        '<div class="productos">' + deCat.map(tarjetaProducto).join("") + "</div>" +
        "</section>";
    }).join("");

    contenido.innerHTML = html;
    contenido.querySelectorAll(".categoria").forEach(function (s) {
      s.style.scrollMarginTop = "150px";
    });
    pintarPastillas(categorias);
    pintarChips(productos);
    observarCategorias();
  }

  /* ---------- pastillas de categoría ---------- */

  function pintarPastillas(categorias) {
    pastillasFila.innerHTML = categorias.map(function (cat) {
      return '<button class="pastilla" type="button" data-destino="cat-' + esc(cat.id) + '">' +
        esc(cat.nombre) + "</button>";
    }).join("");

    pastillasFila.addEventListener("click", function (ev) {
      var b = ev.target.closest(".pastilla");
      if (!b) return;
      var destino = document.getElementById(b.dataset.destino);
      if (destino) destino.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function marcarPastilla(idCategoria) {
    pastillasFila.querySelectorAll(".pastilla").forEach(function (b) {
      var activa = b.dataset.destino === idCategoria;
      b.classList.toggle("activa", activa);
      if (activa) b.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    });
  }

  function observarCategorias() {
    if (!("IntersectionObserver" in window)) return;
    var visibles = new Map();
    var io = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (e.isIntersecting) visibles.set(e.target.id, e.intersectionRatio);
        else visibles.delete(e.target.id);
      });
      var mejor = null, ratio = -1;
      visibles.forEach(function (r, id) { if (r > ratio) { ratio = r; mejor = id; } });
      if (mejor) marcarPastilla(mejor);
    }, { rootMargin: "-140px 0px -55% 0px", threshold: [0, .2, .5, .8] });
    contenido.querySelectorAll(".categoria").forEach(function (s) { io.observe(s); });
  }

  /* ---------- chips de filtro rápido ---------- */

  var ROTULOS_CHIP = [
    { clave: "promocion", rotulo: "Promoción" },
    { clave: "favorito", rotulo: "Favoritos" },
    { clave: "para compartir", rotulo: "Para compartir" },
    { clave: "sin licor", rotulo: "Sin licor" }
  ];

  function pintarChips(productos) {
    var presentes = new Set();
    productos.forEach(function (p) {
      (p.etiquetas || []).forEach(function (e) { presentes.add(normalizar(e)); });
    });
    var html = ROTULOS_CHIP.filter(function (c) {
      return presentes.has(normalizar(c.clave));
    }).map(function (c) {
      return '<button class="chip" type="button" data-chip="' + esc(normalizar(c.clave)) + '">' + c.rotulo + "</button>";
    }).join("");
    chipsCaja.innerHTML = html;

    chipsCaja.addEventListener("click", function (ev) {
      var b = ev.target.closest(".chip");
      if (!b) return;
      chipActivo = (chipActivo === b.dataset.chip) ? null : b.dataset.chip;
      chipsCaja.querySelectorAll(".chip").forEach(function (c) {
        c.classList.toggle("activo", c.dataset.chip === chipActivo);
      });
      filtrar();
    });
  }

  /* ---------- búsqueda y filtro ---------- */

  function filtrar() {
    var consulta = normalizar(campoBusqueda.value.trim());
    var hayAlgo = false;

    contenido.querySelectorAll("[data-categoria]").forEach(function (seccion) {
      var visiblesEnCategoria = 0;
      seccion.querySelectorAll(".producto").forEach(function (tarjeta) {
        var pasaTexto = !consulta || tarjeta.dataset.buscar.indexOf(consulta) >= 0;
        var pasaChip = !chipActivo || tarjeta.dataset.etiquetas.split("|").indexOf(chipActivo) >= 0;
        var visible = pasaTexto && pasaChip;
        tarjeta.style.display = visible ? "" : "none";
        if (visible) visiblesEnCategoria++;
      });
      seccion.style.display = visiblesEnCategoria ? "" : "none";
      if (visiblesEnCategoria) hayAlgo = true;
    });

    sinResultados.classList.toggle("visible", !hayAlgo);
    cajaBuscador.classList.toggle("con-texto", campoBusqueda.value.length > 0);
  }

  function limpiarTodo() {
    campoBusqueda.value = "";
    chipActivo = null;
    chipsCaja.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("activo"); });
    filtrar();
    campoBusqueda.focus();
  }

  /* ---------- "Elegí por mí": la casa escoge un plato ---------- */

  // Solo cocina y barra con gracia: nada de adiciones sueltas ni agua.
  var CATEGORIAS_AZAR = ["Picadas", "A la Parrilla", "Alitas", "Hamburguesas",
                         "Perros", "Sánduches", "Salchipapas", "Cócteles"];
  var ultimoAzar = null;

  function candidatosAzar() {
    return (datosMenu.productos || []).filter(function (p) {
      return !p.agotado && CATEGORIAS_AZAR.indexOf(p.categoria) >= 0;
    });
  }

  function sortear() {
    var lista = candidatosAzar();
    if (!lista.length) return null;
    var elegido;
    // No repetir el de la tirada anterior, si hay de dónde escoger.
    do { elegido = lista[Math.floor(Math.random() * lista.length)]; }
    while (lista.length > 1 && ultimoAzar && elegido.id === ultimoAzar.id);
    ultimoAzar = elegido;
    return elegido;
  }

  function pintarAzar() {
    var p = sortear();
    var caja = $("#azar-resultado");
    var pedir = $("#azar-pedir");
    if (!p) {
      caja.innerHTML = '<p class="azar__desc">Ahora mismo no hay nada disponible para sortear.</p>';
      pedir.style.display = "none";
      return;
    }
    pedir.style.display = "";
    caja.innerHTML =
      '<span class="azar__categoria">' + esc(p.categoria) + "</span>" +
      '<h3 class="azar__nombre">' + esc(p.nombre) + "</h3>" +
      (p.descripcion ? '<p class="azar__desc">' + esc(p.descripcion) + "</p>" : "") +
      '<span class="azar__precio">' + precio(p.precio) + "</span>";
    pedir.href = "https://wa.me/" + WHATSAPP + "?text=" +
      encodeURIComponent("Hola, quiero pedir: " + p.nombre + " (" + precio(p.precio) + ")");
  }

  function prepararAzar() {
    var boton = $("#boton-azar");
    var modal = $("#modal-azar");
    if (!boton || !modal) return;

    var girar = function (elDado) {
      if (elDado && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        elDado.classList.remove("girando");
        void elDado.offsetWidth;          // reinicia la animación
        elDado.classList.add("girando");
      }
      pintarAzar();
    };

    boton.addEventListener("click", function () {
      modal.classList.add("visible");
      girar(boton.querySelector("svg"));
    });
    $("#otra-vez").addEventListener("click", function () {
      girar($("#boton-azar").querySelector("svg"));
    });

    var cerrar = function () { modal.classList.remove("visible"); };
    $("#cerrar-azar").addEventListener("click", cerrar);
    modal.addEventListener("click", function (ev) { if (ev.target === modal) cerrar(); });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && modal.classList.contains("visible")) cerrar();
    });
  }

  /* ---------- botón volver arriba ---------- */

  var botonSubir = $("#boton-subir");
  window.addEventListener("scroll", function () {
    botonSubir.classList.toggle("visible", window.scrollY > 600);
  }, { passive: true });
  botonSubir.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  /* ---------- toggle Noche / Tarde ---------- */

  $("#toggle-tema").addEventListener("click", function () {
    var raiz = document.documentElement;
    var actual = raiz.getAttribute("data-tema");
    if (!actual) {
      actual = window.matchMedia("(prefers-color-scheme: light)").matches ? "dia" : "noche";
    }
    var nuevo = actual === "dia" ? "noche" : "dia";
    raiz.setAttribute("data-tema", nuevo);
    try { localStorage.setItem("tucolita_tema", nuevo); } catch (e) { }
  });

  /* ---------- carga de datos ---------- */

  function mostrarErrorCarga() {
    contenido.innerHTML = "";
    avisoCarga.classList.add("visible");
    if (location.protocol === "file:") {
      avisoCarga.innerHTML = "La carta no puede cargarse abriendo el archivo directamente: " +
        "hay que servir el sitio por HTTP (en línea funciona solo). " +
        "Mientras tanto, escríbenos por WhatsApp al <a href=\"https://wa.me/" + WHATSAPP + "\">+57 312 303 7666</a>.";
    } else {
      avisoCarga.innerHTML = "No pudimos cargar la carta en este momento. Revisa tu conexión e intenta de nuevo, " +
        "o pídela por WhatsApp al <a href=\"https://wa.me/" + WHATSAPP + "\">+57 312 303 7666</a>.";
    }
  }

  function ponerCintaPreview() {
    var cinta = document.createElement("div");
    cinta.className = "cinta-preview";
    cinta.textContent = "Vista previa — sin publicar";
    document.body.prepend(cinta);
  }

  function iniciar() {
    // Modo vista previa desde el panel: datos editados en sessionStorage.
    var params = new URLSearchParams(location.search);
    if (params.get("preview") === "1") {
      try {
        var crudo = sessionStorage.getItem("tucolita_preview_menu");
        if (crudo) {
          datosMenu = JSON.parse(crudo);
          esPreview = true;
        }
      } catch (e) { }
    }

    var pedidos = [
      fetch("datos/negocio.json").then(function (r) { if (!r.ok) throw 0; return r.json(); }),
      datosMenu ? Promise.resolve(datosMenu)
        : fetch("datos/menu.json").then(function (r) { if (!r.ok) throw 0; return r.json(); }),
      fetch("datos/preapertura.json").then(function (r) { if (!r.ok) throw 0; return r.json(); })
        .catch(function () { return null; })
    ];

    Promise.all(pedidos).then(function (res) {
      datosNegocio = res[0];
      datosMenu = res[1];
      var pre = res[2];

      if (esPreview) ponerCintaPreview();
      pintarCarta();
      filtrar();
      prepararAzar();

      var apertura = pre ? Date.parse(pre.apertura) : 0;
      var enPreapertura = function () { return !!(pre && pre.modo && Date.now() < apertura); };
      pintarEstado(enPreapertura());
      setInterval(function () { pintarEstado(enPreapertura()); }, 30000);
      document.addEventListener("tucolita:abierto", function () { pintarEstado(false); });

      var pie = $("#pie-vigencia");
      var vigencia = datosMenu.vigencia || "";
      if (vigencia && vigencia.indexOf("PROVISIONAL") < 0 && vigencia.indexOf("confirmar") < 0) {
        pie.textContent = vigencia;
      } else {
        pie.textContent = "Carta vigente desde la apertura.";
      }
    }).catch(mostrarErrorCarga);
  }

  campoBusqueda.addEventListener("input", filtrar);
  $("#limpiar-busqueda").addEventListener("click", limpiarTodo);
  $("#boton-limpiar-todo").addEventListener("click", limpiarTodo);

  iniciar();
})();
