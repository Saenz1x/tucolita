/* ============================================================
   TU COLITA LOUNGE — admin.js
   Panel de administración. Lee y escribe los archivos del sitio
   directamente en el repositorio de GitHub vía su API REST:
   cada "Publicar cambios" es un commit y GitHub Pages redespliega
   solo. Sin servidor, sin base de datos.
   ============================================================ */
(function () {
  "use strict";

  /* ---------- configuración ---------- */

  // Repositorio por defecto que aparece en la pantalla de entrada.
  var REPO_POR_DEFECTO = "Saenz1x/tucolita";
  var RAMA_POR_DEFECTO = "main";
  var API = "https://api.github.com";

  var ARCHIVOS = {
    menu: "datos/menu.json",
    negocio: "datos/negocio.json",
    preapertura: "datos/preapertura.json"
  };

  /* ---------- estado ---------- */

  var sesion = { repo: "", rama: "", token: "" };
  // Por archivo: { datos, sha }. Los cambios viven en memoria hasta publicar.
  var archivos = { menu: null, negocio: null, preapertura: null };
  var sucios = {};            // { menu: true, ... }
  var contadorCambios = 0;
  var imagenesPendientes = []; // [{ ruta, base64 }]
  var contactos = [];
  var productoEditando = null; // id del producto en el modal, o null si es nuevo
  var imagenNuevaProducto = null; // { base64, dataUrl } esperando guardado

  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  /* ---------- utilidades ---------- */

  var numeroCOP = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
  var formatoCOP = { format: function (n) { return "$" + numeroCOP.format(n); } };

  function esc(t) {
    var d = document.createElement("div");
    d.textContent = t == null ? "" : String(t);
    return d.innerHTML;
  }

  function slug(texto) {
    return String(texto).toLowerCase()
      .normalize("NFD").replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  var toastTimer = null;
  function toast(mensaje, esError, html) {
    var t = $("#toast");
    if (html) t.innerHTML = mensaje; else t.textContent = mensaje;
    t.classList.toggle("error", !!esError);
    t.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("visible"); }, esError ? 7000 : 5000);
  }

  // Base64 seguro con tildes y eñes: nunca atob/btoa a secas sobre texto.
  function aBase64(texto) {
    var bytes = new TextEncoder().encode(texto);
    var binario = "";
    for (var i = 0; i < bytes.length; i += 0x8000) {
      binario += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(binario);
  }

  function desdeBase64(b64) {
    var binario = atob(b64.replace(/\n/g, ""));
    var bytes = new Uint8Array(binario.length);
    for (var i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  }

  /* ---------- API de GitHub ---------- */

  function llamarGitHub(ruta, opciones) {
    opciones = opciones || {};
    opciones.headers = Object.assign({
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Authorization": "Bearer " + sesion.token
    }, opciones.headers || {});
    return fetch(API + ruta, opciones);
  }

  function leerArchivoRepo(ruta) {
    return llamarGitHub("/repos/" + sesion.repo + "/contents/" + ruta + "?ref=" + sesion.rama)
      .then(function (r) {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error("estado " + r.status);
        return r.json();
      });
  }

  function escribirArchivoRepo(ruta, contenidoBase64, sha, mensaje) {
    var cuerpo = { message: mensaje, content: contenidoBase64, branch: sesion.rama };
    if (sha) cuerpo.sha = sha;
    return llamarGitHub("/repos/" + sesion.repo + "/contents/" + ruta, {
      method: "PUT",
      body: JSON.stringify(cuerpo)
    });
  }

  /* ---------- guardado del token (con PIN opcional) ---------- */

  var CLAVE_SESION = "tucolita_admin";
  var CLAVE_CIFRADA = "tucolita_admin_cifrado";

  function guardarSesion(recordar, pin) {
    var datos = JSON.stringify(sesion);
    try {
      sessionStorage.setItem(CLAVE_SESION, datos);
      if (!recordar) return Promise.resolve();
      if (!pin) {
        localStorage.setItem(CLAVE_SESION, datos);
        localStorage.removeItem(CLAVE_CIFRADA);
        return Promise.resolve();
      }
      // PIN: el token queda cifrado con AES-GCM, clave derivada del PIN.
      return cifrarConPin(datos, pin).then(function (paquete) {
        localStorage.setItem(CLAVE_CIFRADA, JSON.stringify(paquete));
        localStorage.removeItem(CLAVE_SESION);
      });
    } catch (e) { return Promise.resolve(); }
  }

  function derivarClave(pin, salt) {
    return crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"])
      .then(function (base) {
        return crypto.subtle.deriveKey(
          { name: "PBKDF2", salt: salt, iterations: 150000, hash: "SHA-256" },
          base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
        );
      });
  }

  function cifrarConPin(texto, pin) {
    var salt = crypto.getRandomValues(new Uint8Array(16));
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return derivarClave(pin, salt).then(function (clave) {
      return crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, clave, new TextEncoder().encode(texto));
    }).then(function (cifrado) {
      var aHex = function (arr) {
        return Array.from(new Uint8Array(arr)).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
      };
      return { v: 1, salt: aHex(salt), iv: aHex(iv), datos: aHex(cifrado) };
    });
  }

  function descifrarConPin(paquete, pin) {
    var deHex = function (hex) {
      var arr = new Uint8Array(hex.length / 2);
      for (var i = 0; i < arr.length; i++) arr[i] = parseInt(hex.substr(i * 2, 2), 16);
      return arr;
    };
    return derivarClave(pin, deHex(paquete.salt)).then(function (clave) {
      return crypto.subtle.decrypt({ name: "AES-GCM", iv: deHex(paquete.iv) }, clave, deHex(paquete.datos));
    }).then(function (plano) {
      return new TextDecoder().decode(plano);
    });
  }

  function borrarSesion() {
    try {
      sessionStorage.removeItem(CLAVE_SESION);
      localStorage.removeItem(CLAVE_SESION);
      localStorage.removeItem(CLAVE_CIFRADA);
    } catch (e) { }
  }

  /* ---------- cambios pendientes ---------- */

  function marcarCambio(archivo) {
    sucios[archivo] = true;
    contadorCambios++;
    pintarBotonPublicar();
  }

  function pintarBotonPublicar() {
    var boton = $("#boton-publicar");
    var pendientes = contadorCambios > 0 || imagenesPendientes.length > 0;
    boton.disabled = !pendientes;
    boton.textContent = pendientes
      ? "Publicar cambios (" + (contadorCambios + imagenesPendientes.length) + ")"
      : "Publicar cambios";
  }

  window.addEventListener("beforeunload", function (ev) {
    if (contadorCambios > 0 || imagenesPendientes.length > 0) {
      ev.preventDefault();
      ev.returnValue = "";
    }
  });

  /* ---------- entrada ---------- */

  function entrar(repo, rama, token, alTerminar, alFallar) {
    sesion = { repo: repo, rama: rama, token: token };
    llamarGitHub("/repos/" + repo).then(function (r) {
      if (r.status === 401) throw new Error("El token no sirve o ya venció. Genera uno nuevo con los pasos de \"¿Cómo consigo el token?\".");
      if (r.status === 403) throw new Error("El token no tiene permiso sobre ese repositorio. Revisa que tenga acceso al repositorio y el permiso \"Contents: Read and write\".");
      if (r.status === 404) throw new Error("No encontramos ese repositorio. Revisa que esté bien escrito (usuario/repositorio) y que el token tenga acceso a él.");
      if (!r.ok) throw new Error("GitHub no respondió bien. Intenta de nuevo en un momento.");
      return cargarArchivos();
    }).then(alTerminar).catch(function (e) {
      alFallar(e && e.message ? e.message : "No hubo conexión. Revisa tu internet e intenta de nuevo.");
    });
  }

  function cargarArchivos() {
    return Promise.all(Object.keys(ARCHIVOS).map(function (clave) {
      return leerArchivoRepo(ARCHIVOS[clave]).then(function (respuesta) {
        if (!respuesta) throw new Error("No encontramos el archivo " + ARCHIVOS[clave] + " en el repositorio.");
        archivos[clave] = {
          datos: JSON.parse(desdeBase64(respuesta.content)),
          sha: respuesta.sha
        };
      });
    }));
  }

  function abrirPanel() {
    $("#pantalla-entrada").style.display = "none";
    $("#panel").style.display = "";
    $("#estado-conexion").innerHTML = "Conectado a <strong>" + esc(sesion.repo) + "</strong> · rama " + esc(sesion.rama);
    sucios = {};
    contadorCambios = 0;
    imagenesPendientes = [];
    pintarBotonPublicar();
    pintarPestanaMenu();
    pintarPestanaNegocio();
    pintarPestanaPreapertura();
  }

  $("#form-entrada").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var error = $("#error-entrada");
    error.textContent = "";
    var repo = $("#campo-repo").value.trim();
    var rama = $("#campo-rama").value.trim() || RAMA_POR_DEFECTO;
    var token = $("#campo-token").value.trim();
    var pin = $("#campo-pin").value.trim();
    if (!repo || repo.indexOf("/") < 1) { error.textContent = "Escribe el repositorio como usuario/repositorio."; return; }
    if (!token) { error.textContent = "Falta pegar el token."; return; }
    if (pin && !/^\d{4,6}$/.test(pin)) { error.textContent = "El PIN debe ser de 4 a 6 dígitos."; return; }

    var boton = $("#boton-entrar");
    boton.disabled = true;
    boton.textContent = "Entrando…";
    entrar(repo, rama, token, function () {
      guardarSesion($("#campo-recordar").checked, pin).then(abrirPanel);
    }, function (mensaje) {
      boton.disabled = false;
      boton.textContent = "Entrar";
      error.textContent = mensaje;
    });
  });

  /* Reingreso automático: sesión guardada en claro o cifrada con PIN */

  function intentarReingreso() {
    $("#campo-repo").value = REPO_POR_DEFECTO;
    var guardada = null;
    try {
      guardada = sessionStorage.getItem(CLAVE_SESION) || localStorage.getItem(CLAVE_SESION);
    } catch (e) { }
    if (guardada) {
      try {
        var s = JSON.parse(guardada);
        entrar(s.repo, s.rama, s.token, abrirPanel, function () { /* pide entrar a mano */ });
        return;
      } catch (e) { }
    }
    var cifrada = null;
    try { cifrada = localStorage.getItem(CLAVE_CIFRADA); } catch (e) { }
    if (cifrada) {
      $("#form-pin").style.display = "";
      $("#form-entrada").style.display = "none";
    }
  }

  $("#form-pin").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var errorPin = $("#error-pin");
    errorPin.textContent = "";
    var pin = $("#pin-desbloqueo").value.trim();
    var paquete;
    try { paquete = JSON.parse(localStorage.getItem(CLAVE_CIFRADA)); } catch (e) { }
    if (!paquete) { errorPin.textContent = "No hay token guardado. Entra con el token."; return; }
    descifrarConPin(paquete, pin).then(function (texto) {
      var s = JSON.parse(texto);
      try { sessionStorage.setItem(CLAVE_SESION, texto); } catch (e) { }
      entrar(s.repo, s.rama, s.token, abrirPanel, function (m) { errorPin.textContent = m; });
    }).catch(function () {
      errorPin.textContent = "Ese PIN no es. Vuelve a intentar.";
    });
  });

  $("#olvidar-pin").addEventListener("click", function () {
    borrarSesion();
    $("#form-pin").style.display = "none";
    $("#form-entrada").style.display = "";
  });

  $("#boton-salir").addEventListener("click", function () {
    if ((contadorCambios > 0 || imagenesPendientes.length > 0) &&
      !confirm("Tienes cambios sin publicar. ¿Salir de todas formas? Se perderán.")) return;
    borrarSesion();
    location.reload();
  });

  /* ---------- pestañas ---------- */

  $$(".adm-pestana").forEach(function (b) {
    b.addEventListener("click", function () {
      $$(".adm-pestana").forEach(function (x) { x.classList.remove("activa"); });
      b.classList.add("activa");
      $$("[data-panel-de]").forEach(function (s) {
        s.style.display = s.dataset.panelDe === b.dataset.pestana ? "" : "none";
      });
    });
  });

  /* ============================================================
     PESTAÑA MENÚ
     ============================================================ */

  function menuDatos() { return archivos.menu.datos; }

  function categoriasOrdenadas() {
    return (menuDatos().categorias || []).slice().sort(function (a, b) { return (a.orden || 0) - (b.orden || 0); });
  }

  function productosDe(nombreCategoria) {
    return (menuDatos().productos || [])
      .filter(function (p) { return p.categoria === nombreCategoria; })
      .sort(function (a, b) { return (a.orden || 0) - (b.orden || 0); });
  }

  function iconoSVG(nombre) {
    var iconos = {
      subir: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 14 12 8 18 14"/></svg>',
      bajar: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 10 12 16 18 10"/></svg>',
      editar: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20l4-.8L19.6 7.6a2 2 0 0 0-2.8-2.8L5.2 16.4z"/></svg>',
      duplicar: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 4H6a2 2 0 0 0-2 2v10"/></svg>',
      borrar: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V5h6v2m-8 0 1 13h8l1-13"/></svg>',
      flecha: '<svg class="adm-categoria__flecha" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 10 12 16 18 10"/></svg>'
    };
    return iconos[nombre] || "";
  }

  function pintarPestanaMenu() {
    var caja = $("#lista-categorias");
    var busqueda = $("#buscar-producto-admin").value.trim().toLowerCase();
    var abiertas = {};
    caja.querySelectorAll(".adm-categoria.abierta").forEach(function (c) { abiertas[c.dataset.cat] = true; });

    var cats = categoriasOrdenadas();
    caja.innerHTML = cats.map(function (cat, indice) {
      var productos = productosDe(cat.nombre).filter(function (p) {
        return !busqueda || p.nombre.toLowerCase().indexOf(busqueda) >= 0;
      });
      var abierta = busqueda ? productos.length > 0 : abiertas[cat.id];

      var filas = productos.map(function (p, i) {
        return '<div class="adm-producto' + (p.agotado ? " agotado" : "") + '" data-id="' + esc(p.id) + '">' +
          '<button class="btn-icono" type="button" data-accion="subir-prod" aria-label="Subir ' + esc(p.nombre) + '"' + (i === 0 ? " disabled" : "") + ">" + iconoSVG("subir") + "</button>" +
          '<button class="btn-icono" type="button" data-accion="bajar-prod" aria-label="Bajar ' + esc(p.nombre) + '"' + (i === productos.length - 1 ? " disabled" : "") + ">" + iconoSVG("bajar") + "</button>" +
          '<div class="adm-producto__info"><div class="adm-producto__nombre">' + esc(p.nombre) + '</div>' +
          '<div class="adm-producto__precio">' + formatoCOP.format(p.precio) + (p.agotado ? " · agotado" : "") + "</div></div>" +
          '<button class="interruptor" type="button" role="switch" aria-checked="' + (p.agotado ? "true" : "false") + '" data-accion="agotado" aria-label="Agotado: ' + esc(p.nombre) + '"></button>' +
          '<button class="btn-icono" type="button" data-accion="editar" aria-label="Editar ' + esc(p.nombre) + '">' + iconoSVG("editar") + "</button>" +
          '<button class="btn-icono" type="button" data-accion="duplicar" aria-label="Duplicar ' + esc(p.nombre) + '">' + iconoSVG("duplicar") + "</button>" +
          '<button class="btn-icono peligro" type="button" data-accion="eliminar" aria-label="Eliminar ' + esc(p.nombre) + '">' + iconoSVG("borrar") + "</button>" +
          "</div>";
      }).join("");

      return '<div class="adm-categoria' + (abierta ? " abierta" : "") + '" data-cat="' + esc(cat.id) + '">' +
        '<div class="adm-categoria__cab">' +
        '<button class="btn-icono" type="button" data-accion="subir-cat" aria-label="Subir categoría ' + esc(cat.nombre) + '"' + (indice === 0 ? " disabled" : "") + ">" + iconoSVG("subir") + "</button>" +
        '<button class="btn-icono" type="button" data-accion="bajar-cat" aria-label="Bajar categoría ' + esc(cat.nombre) + '"' + (indice === cats.length - 1 ? " disabled" : "") + ">" + iconoSVG("bajar") + "</button>" +
        "<h3>" + esc(cat.nombre) + "</h3>" +
        '<span class="adm-categoria__contador">' + productosDe(cat.nombre).length + "</span>" +
        iconoSVG("flecha") +
        "</div>" +
        '<div class="adm-categoria__cuerpo">' + (filas || '<p style="padding:1rem;color:var(--tinta-tenue);font-size:.85rem">Sin productos aquí todavía.</p>') + "</div>" +
        "</div>";
    }).join("");
  }

  $("#buscar-producto-admin").addEventListener("input", pintarPestanaMenu);

  // Un solo escuchador para toda la lista: categorías y productos.
  $("#lista-categorias").addEventListener("click", function (ev) {
    var botonAccion = ev.target.closest("[data-accion]");
    var cajaCategoria = ev.target.closest(".adm-categoria");

    if (!botonAccion) {
      // Tocar la cabecera pliega o despliega la categoría.
      var cab = ev.target.closest(".adm-categoria__cab");
      if (cab && cajaCategoria) cajaCategoria.classList.toggle("abierta");
      return;
    }

    var accion = botonAccion.dataset.accion;
    var idCat = cajaCategoria ? cajaCategoria.dataset.cat : null;
    var filaProducto = ev.target.closest(".adm-producto");
    var idProd = filaProducto ? filaProducto.dataset.id : null;

    if (accion === "subir-cat" || accion === "bajar-cat") moverCategoria(idCat, accion === "subir-cat" ? -1 : 1);
    if (accion === "subir-prod" || accion === "bajar-prod") moverProducto(idProd, accion === "subir-prod" ? -1 : 1);
    if (accion === "agotado") alternarAgotado(idProd, botonAccion);
    if (accion === "editar") abrirModalProducto(idProd);
    if (accion === "duplicar") duplicarProducto(idProd);
    if (accion === "eliminar") eliminarProducto(idProd);
  });

  function buscarProducto(id) {
    return (menuDatos().productos || []).find(function (p) { return p.id === id; });
  }

  function moverCategoria(idCat, direccion) {
    var cats = categoriasOrdenadas();
    var indice = cats.findIndex(function (c) { return c.id === idCat; });
    var vecino = cats[indice + direccion];
    if (indice < 0 || !vecino) return;
    var mio = cats[indice].orden;
    cats[indice].orden = vecino.orden;
    vecino.orden = mio;
    marcarCambio("menu");
    pintarPestanaMenu();
  }

  function moverProducto(idProd, direccion) {
    var producto = buscarProducto(idProd);
    if (!producto) return;
    var hermanos = productosDe(producto.categoria);
    var indice = hermanos.findIndex(function (p) { return p.id === idProd; });
    var vecino = hermanos[indice + direccion];
    if (!vecino) return;
    var mio = producto.orden;
    producto.orden = vecino.orden;
    vecino.orden = mio;
    marcarCambio("menu");
    pintarPestanaMenu();
  }

  function alternarAgotado(idProd, interruptor) {
    var producto = buscarProducto(idProd);
    if (!producto) return;
    producto.agotado = !producto.agotado;
    interruptor.setAttribute("aria-checked", producto.agotado ? "true" : "false");
    marcarCambio("menu");
    pintarPestanaMenu();
  }

  function duplicarProducto(idProd) {
    var producto = buscarProducto(idProd);
    if (!producto) return;
    var copia = JSON.parse(JSON.stringify(producto));
    copia.nombre = producto.nombre + " (copia)";
    copia.id = idUnico(copia.nombre);
    copia.orden = producto.orden + 1;
    productosDe(producto.categoria).forEach(function (p) {
      if (p.orden > producto.orden) p.orden++;
    });
    menuDatos().productos.push(copia);
    marcarCambio("menu");
    pintarPestanaMenu();
  }

  function eliminarProducto(idProd) {
    var producto = buscarProducto(idProd);
    if (!producto) return;
    if (!confirm("¿Eliminar \"" + producto.nombre + "\" del menú? Esto no se puede deshacer después de publicar.")) return;
    menuDatos().productos = menuDatos().productos.filter(function (p) { return p.id !== idProd; });
    marcarCambio("menu");
    pintarPestanaMenu();
  }

  function idUnico(nombre) {
    var base = slug(nombre) || "producto";
    var id = base, n = 2;
    while (buscarProducto(id)) { id = base + "-" + n; n++; }
    return id;
  }

  /* ---------- modal de producto ---------- */

  function llenarSelectCategorias(seleccionada) {
    var select = $("#prod-categoria");
    select.innerHTML = categoriasOrdenadas().map(function (c) {
      return '<option value="' + esc(c.nombre) + '"' + (c.nombre === seleccionada ? " selected" : "") + ">" + esc(c.nombre) + "</option>";
    }).join("") + '<option value="__nueva__">+ Nueva categoría…</option>';
  }

  $("#prod-categoria").addEventListener("change", function () {
    $("#campo-categoria-nueva").style.display = this.value === "__nueva__" ? "" : "none";
  });

  $("#prod-precio").addEventListener("input", function () {
    var n = parseInt(this.value, 10);
    $("#precio-formateado").textContent = isNaN(n) ? "" : "Se verá como " + formatoCOP.format(n);
  });

  $("#prod-agotado").addEventListener("click", function () {
    this.setAttribute("aria-checked", this.getAttribute("aria-checked") === "true" ? "false" : "true");
  });

  function abrirModalProducto(idProd) {
    productoEditando = idProd || null;
    imagenNuevaProducto = null;
    var p = idProd ? buscarProducto(idProd) : null;

    $("#modal-titulo").textContent = p ? "Editar producto" : "Nuevo producto";
    $("#prod-nombre").value = p ? p.nombre : "";
    llenarSelectCategorias(p ? p.categoria : (categoriasOrdenadas()[0] || {}).nombre);
    $("#campo-categoria-nueva").style.display = "none";
    $("#prod-categoria-nueva").value = "";
    $("#prod-descripcion").value = p ? (p.descripcion || "") : "";
    $("#prod-precio").value = p ? p.precio : "";
    $("#precio-formateado").textContent = p ? "Se verá como " + formatoCOP.format(p.precio) : "";
    $("#prod-agotado").setAttribute("aria-checked", p && p.agotado ? "true" : "false");
    $$('#form-producto input[name="etiqueta"]').forEach(function (c) {
      c.checked = !!(p && (p.etiquetas || []).indexOf(c.value) >= 0);
    });
    var preview = $("#prod-imagen-preview");
    if (p && p.imagen) {
      preview.src = p.imagen;
      preview.classList.add("visible");
    } else {
      preview.classList.remove("visible");
      preview.removeAttribute("src");
    }
    $("#prod-imagen").value = "";
    $("#error-producto").textContent = "";
    $("#modal-producto").classList.add("visible");
    $("#prod-nombre").focus();
  }

  function cerrarModalProducto() {
    $("#modal-producto").classList.remove("visible");
    productoEditando = null;
    imagenNuevaProducto = null;
  }

  $("#cerrar-modal").addEventListener("click", cerrarModalProducto);
  $("#cancelar-producto").addEventListener("click", cerrarModalProducto);
  $("#boton-nuevo-producto").addEventListener("click", function () { abrirModalProducto(null); });

  // Foto: se redimensiona en un canvas a 900 px de lado mayor,
  // JPEG calidad 0.82, y debe quedar por debajo de 300 KB.
  $("#prod-imagen").addEventListener("change", function () {
    var archivo = this.files && this.files[0];
    if (!archivo) return;
    var error = $("#error-producto");
    error.textContent = "";

    var lector = new FileReader();
    lector.onload = function () {
      var img = new Image();
      img.onload = function () {
        var mayor = Math.max(img.width, img.height);
        var escala = mayor > 900 ? 900 / mayor : 1;
        var canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * escala);
        canvas.height = Math.round(img.height * escala);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);

        var calidad = 0.82;
        var dataUrl = canvas.toDataURL("image/jpeg", calidad);
        // Si aún pesa mucho, se baja la calidad una vez más.
        while (dataUrl.length * 0.75 > 300 * 1024 && calidad > 0.5) {
          calidad -= 0.12;
          dataUrl = canvas.toDataURL("image/jpeg", calidad);
        }
        if (dataUrl.length * 0.75 > 300 * 1024) {
          error.textContent = "Esa foto no logra comprimirse por debajo de 300 KB. Intenta con otra.";
          return;
        }
        imagenNuevaProducto = {
          base64: dataUrl.split(",")[1],
          dataUrl: dataUrl
        };
        var preview = $("#prod-imagen-preview");
        preview.src = dataUrl;
        preview.classList.add("visible");
      };
      img.onerror = function () { error.textContent = "No pudimos leer esa imagen. Intenta con otra."; };
      img.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  });

  $("#form-producto").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var error = $("#error-producto");
    error.textContent = "";

    var nombre = $("#prod-nombre").value.trim();
    var precio = parseInt($("#prod-precio").value, 10);
    if (!nombre) { error.textContent = "El producto necesita un nombre."; return; }
    if (isNaN(precio) || precio < 0) { error.textContent = "Revisa el precio: debe ser un número."; return; }

    var categoria = $("#prod-categoria").value;
    if (categoria === "__nueva__") {
      var nueva = $("#prod-categoria-nueva").value.trim();
      if (!nueva) { error.textContent = "Escribe el nombre de la categoría nueva."; return; }
      categoria = nueva;
      if (!menuDatos().categorias.some(function (c) { return c.nombre === nueva; })) {
        var maxOrden = Math.max.apply(null, [0].concat(menuDatos().categorias.map(function (c) { return c.orden || 0; })));
        menuDatos().categorias.push({ id: slug(nueva), nombre: nueva, descripcion: "", orden: maxOrden + 1 });
      }
    }

    var etiquetas = $$('#form-producto input[name="etiqueta"]:checked').map(function (c) { return c.value; });
    var agotado = $("#prod-agotado").getAttribute("aria-checked") === "true";

    var producto;
    if (productoEditando) {
      producto = buscarProducto(productoEditando);
      if (!producto) { cerrarModalProducto(); return; }
    } else {
      producto = { id: idUnico(nombre), orden: productosDe(categoria).length + 1, imagen: "", agotado: false };
      menuDatos().productos.push(producto);
    }

    producto.nombre = nombre;
    producto.categoria = categoria;
    producto.descripcion = $("#prod-descripcion").value.trim();
    producto.precio = precio;
    producto.etiquetas = etiquetas;
    producto.agotado = agotado;

    if (imagenNuevaProducto) {
      var ruta = "imagenes/menu/" + producto.id + ".jpg";
      producto.imagen = ruta;
      // Se sube al publicar, junto con el JSON.
      imagenesPendientes = imagenesPendientes.filter(function (i) { return i.ruta !== ruta; });
      imagenesPendientes.push({ ruta: ruta, base64: imagenNuevaProducto.base64 });
    }

    marcarCambio("menu");
    cerrarModalProducto();
    pintarPestanaMenu();
  });

  /* ---------- respaldo y restauración ---------- */

  $("#boton-respaldo").addEventListener("click", function () {
    var texto = JSON.stringify(menuDatos(), null, 2);
    var blob = new Blob([texto], { type: "application/json" });
    var enlace = document.createElement("a");
    var hoy = new Date().toISOString().slice(0, 10);
    enlace.href = URL.createObjectURL(blob);
    enlace.download = "respaldo-menu-tucolita-" + hoy + ".json";
    enlace.click();
    URL.revokeObjectURL(enlace.href);
  });

  $("#boton-restaurar").addEventListener("click", function () { $("#archivo-restaurar").click(); });

  $("#archivo-restaurar").addEventListener("change", function () {
    var archivo = this.files && this.files[0];
    if (!archivo) return;
    var lector = new FileReader();
    lector.onload = function () {
      try {
        var datos = JSON.parse(lector.result);
        if (!datos.productos || !datos.categorias) throw 0;
        if (!confirm("Esto reemplaza el menú en memoria con el del archivo. ¿Continuar?")) return;
        archivos.menu.datos = datos;
        marcarCambio("menu");
        pintarPestanaMenu();
        toast("Respaldo cargado. Recuerda publicar para que salga a la web.");
      } catch (e) {
        toast("Ese archivo no parece un respaldo del menú.", true);
      }
    };
    lector.readAsText(archivo, "utf-8");
    this.value = "";
  });

  /* ============================================================
     PESTAÑA NEGOCIO
     ============================================================ */

  var DIAS_PANEL = [
    { clave: "lun", rotulo: "Lunes" }, { clave: "mar", rotulo: "Martes" },
    { clave: "mie", rotulo: "Miércoles" }, { clave: "jue", rotulo: "Jueves" },
    { clave: "vie", rotulo: "Viernes" }, { clave: "sab", rotulo: "Sábado" },
    { clave: "dom", rotulo: "Domingo" }
  ];

  function pintarPestanaNegocio() {
    var n = archivos.negocio.datos;

    $("#editor-horarios").innerHTML = DIAS_PANEL.map(function (d) {
      var h = n.horarios[d.clave] || { abre: "13:00", cierra: "23:00", cerrado: false };
      return '<div class="adm-codigo" data-dia="' + d.clave + '">' +
        '<span class="adm-codigo__etiqueta" style="min-width:86px">' + d.rotulo + "</span>" +
        '<input type="time" data-h="abre" value="' + esc(h.abre) + '" style="background:var(--fondo-2);border:1px solid var(--linea-suave);border-radius:8px;color:var(--tinta);padding:.4rem;min-height:44px"' + (h.cerrado ? " disabled" : "") + ">" +
        '<input type="time" data-h="cierra" value="' + esc(h.cierra) + '" style="background:var(--fondo-2);border:1px solid var(--linea-suave);border-radius:8px;color:var(--tinta);padding:.4rem;min-height:44px"' + (h.cerrado ? " disabled" : "") + ">" +
        '<label style="display:inline-flex;align-items:center;gap:.35rem;font-size:.8rem;color:var(--tinta-suave)"><input type="checkbox" data-h="cerrado"' + (h.cerrado ? " checked" : "") + ' style="accent-color:var(--oro);width:18px;height:18px">Cerrado</label>' +
        "</div>";
    }).join("");

    $("#editor-horarios").addEventListener("change", function (ev) {
      if (ev.target.dataset.h === "cerrado") {
        var fila = ev.target.closest("[data-dia]");
        fila.querySelectorAll('input[type="time"]').forEach(function (i) { i.disabled = ev.target.checked; });
      }
    });

    $("#neg-telefono").value = n.telefono || "";
    $("#neg-direccion").value = n.direccion || "";
    $("#neg-instagram").value = n.enlaces.instagram || "";
    $("#neg-tiktok").value = n.enlaces.tiktok || "";
    $("#neg-facebook").value = n.enlaces.facebook || "";
    $("#neg-vigencia").value = n.vigenciaCarta || "";
    var t = n.textos || {};
    $("#neg-hero-titulo").value = t.heroTitulo || "";
    $("#neg-hero-bajada").value = t.heroBajada || "";
    $("#neg-concepto-titulo").value = t.conceptoTitulo || "";
    $("#neg-concepto-p1").value = t.conceptoParrafo1 || "";
    $("#neg-concepto-p2").value = t.conceptoParrafo2 || "";
    $("#neg-noche-titulo").value = t.nocheTitulo || "";
    $("#neg-noche-parrafo").value = t.nocheParrafo || "";
    $("#neg-noche-epigrafe").value = t.nocheEpigrafe || "";
    $("#neg-muro-parrafo").value = t.muroParrafo || "";
  }

  $("#boton-guardar-negocio").addEventListener("click", function () {
    var n = archivos.negocio.datos;

    document.querySelectorAll("#editor-horarios [data-dia]").forEach(function (fila) {
      var clave = fila.dataset.dia;
      var abre = fila.querySelector('[data-h="abre"]').value || "13:00";
      var cierra = fila.querySelector('[data-h="cierra"]').value || "23:00";
      var cerrado = fila.querySelector('[data-h="cerrado"]').checked;
      n.horarios[clave] = {
        abre: abre, cierra: cierra, cerrado: cerrado,
        // Si el cierre es "menor" que la apertura, cruza la medianoche.
        cruzaMedianoche: !cerrado && cierra < abre
      };
    });

    n.telefono = $("#neg-telefono").value.trim();
    n.direccion = $("#neg-direccion").value.trim();
    n.enlaces.instagram = $("#neg-instagram").value.trim();
    n.enlaces.tiktok = $("#neg-tiktok").value.trim();
    n.enlaces.facebook = $("#neg-facebook").value.trim();
    n.vigenciaCarta = $("#neg-vigencia").value.trim();
    n.textos = n.textos || {};
    n.textos.heroTitulo = $("#neg-hero-titulo").value.trim();
    n.textos.heroBajada = $("#neg-hero-bajada").value.trim();
    n.textos.conceptoTitulo = $("#neg-concepto-titulo").value.trim();
    n.textos.conceptoParrafo1 = $("#neg-concepto-p1").value.trim();
    n.textos.conceptoParrafo2 = $("#neg-concepto-p2").value.trim();
    n.textos.nocheTitulo = $("#neg-noche-titulo").value.trim();
    n.textos.nocheParrafo = $("#neg-noche-parrafo").value.trim();
    n.textos.nocheEpigrafe = $("#neg-noche-epigrafe").value.trim();
    n.textos.muroParrafo = $("#neg-muro-parrafo").value.trim();

    marcarCambio("negocio");
    toast("Guardado en memoria. Toca \"Publicar cambios\" para que salga a la web.");
  });

  /* ============================================================
     PESTAÑA PREAPERTURA
     ============================================================ */

  function pintarPestanaPreapertura() {
    var p = archivos.preapertura.datos;
    $("#interruptor-preapertura").setAttribute("aria-checked", p.modo ? "true" : "false");
    // La fecha se edita como hora de Colombia (el ISO lleva -05:00 fijo).
    $("#pre-fecha").value = (p.apertura || "").slice(0, 16);
    $("#pre-titulo").value = (p.textos && p.textos.titulo) || "";
    $("#pre-bajada").value = (p.textos && p.textos.bajada) || "";
    $("#pre-captacion").value = (p.textos && p.textos.captacion) || "";
    $("#pre-endpoint").value = p.endpointContactos || "";
    pintarCodigos();
  }

  $("#interruptor-preapertura").addEventListener("click", function () {
    var activo = this.getAttribute("aria-checked") === "true";
    this.setAttribute("aria-checked", activo ? "false" : "true");
  });

  $("#boton-guardar-preapertura").addEventListener("click", function () {
    var p = archivos.preapertura.datos;
    p.modo = $("#interruptor-preapertura").getAttribute("aria-checked") === "true";
    var fecha = $("#pre-fecha").value;
    if (fecha) {
      p.apertura = fecha + (fecha.length === 16 ? ":00" : "") + "-05:00";
      p.aperturaEnPalabras = "";
    }
    p.textos = p.textos || {};
    p.textos.titulo = $("#pre-titulo").value.trim();
    p.textos.bajada = $("#pre-bajada").value.trim();
    p.textos.captacion = $("#pre-captacion").value.trim();
    p.endpointContactos = $("#pre-endpoint").value.trim();
    marcarCambio("preapertura");
    toast("Guardado en memoria. Toca \"Publicar cambios\" para que salga a la web.");
  });

  /* ---------- códigos de invitado ---------- */

  function hashSHA256(texto) {
    var bytes = new TextEncoder().encode(texto);
    return crypto.subtle.digest("SHA-256", bytes).then(function (buf) {
      return Array.from(new Uint8Array(buf)).map(function (b) {
        return b.toString(16).padStart(2, "0");
      }).join("");
    });
  }

  function pintarCodigos() {
    var lista = archivos.preapertura.datos.codigos || [];
    $("#lista-codigos").innerHTML = lista.length ? lista.map(function (c, i) {
      return '<div class="adm-codigo">' +
        '<span class="adm-codigo__etiqueta">' + esc(c.etiqueta) + "</span>" +
        '<span class="adm-codigo__hash">' + esc((c.hash || "").slice(0, 10)) + "…</span>" +
        '<button class="btn-icono peligro" type="button" data-revocar="' + i + '" aria-label="Revocar el código ' + esc(c.etiqueta) + '">' + iconoSVG("borrar") + "</button>" +
        "</div>";
    }).join("") : '<p style="color:var(--tinta-tenue);font-size:.85rem">No hay códigos activos. Crea el primero arriba.</p>';
  }

  $("#lista-codigos").addEventListener("click", function (ev) {
    var boton = ev.target.closest("[data-revocar]");
    if (!boton) return;
    var lista = archivos.preapertura.datos.codigos;
    var codigo = lista[parseInt(boton.dataset.revocar, 10)];
    if (!confirm("¿Revocar el código \"" + codigo.etiqueta + "\"? Quien lo tenga ya no podrá entrar con él.")) return;
    lista.splice(parseInt(boton.dataset.revocar, 10), 1);
    marcarCambio("preapertura");
    pintarCodigos();
  });

  // Genera un código legible (sin 0/O ni 1/I) y guarda SOLO su hash.
  function generarCodigo() {
    var letras = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    var codigo = "";
    var azar = crypto.getRandomValues(new Uint8Array(6));
    for (var i = 0; i < 6; i++) codigo += letras[azar[i] % letras.length];
    return codigo;
  }

  $("#boton-crear-codigo").addEventListener("click", function () {
    var etiqueta = $("#etiqueta-codigo").value.trim().toUpperCase();
    if (!etiqueta) { toast("Ponle una etiqueta al código: PRENSA, FAMILIA…", true); return; }
    var codigo = generarCodigo();
    hashSHA256(codigo).then(function (hash) {
      archivos.preapertura.datos.codigos = archivos.preapertura.datos.codigos || [];
      archivos.preapertura.datos.codigos.push({ etiqueta: etiqueta, hash: hash });
      marcarCambio("preapertura");
      pintarCodigos();
      $("#etiqueta-codigo").value = "";

      var mensajeWhatsApp = "Tienes un pase de preestreno para Tu Colita Lounge 🥂\n" +
        "Entra a https://tucolita.com , toca \"Tengo un código\" y escribe: " + codigo;
      // El código en claro se muestra UNA sola vez. Solo el hash queda guardado.
      $("#codigo-recien-creado").innerHTML =
        '<div class="adm-codigo-nuevo">' +
        "<p>Código para <strong>" + esc(etiqueta) + "</strong> — cópialo ya: no se vuelve a mostrar.</p>" +
        '<strong class="codigo-grande">' + esc(codigo) + "</strong>" +
        '<button class="btn btn--borde" type="button" id="copiar-mensaje-codigo">Copiar mensaje para WhatsApp</button>' +
        "</div>";
      $("#copiar-mensaje-codigo").addEventListener("click", function () {
        navigator.clipboard.writeText(mensajeWhatsApp).then(function () {
          toast("Mensaje copiado. Pégalo en WhatsApp.");
        }).catch(function () {
          toast("No se pudo copiar solo. El código es: " + codigo, true);
        });
      });
    });
  });

  /* ============================================================
     PESTAÑA CONTACTOS
     ============================================================ */

  function cargarContactos() {
    var endpoint = archivos.preapertura.datos.endpointContactos;
    var caja = $("#tabla-contactos");
    if (!endpoint) {
      caja.innerHTML = '<p style="color:var(--tinta-tenue)">Todavía no hay una dirección de captación configurada. Se configura en la pestaña Preapertura, con los pasos del archivo LEEME.</p>';
      return;
    }
    caja.innerHTML = '<p style="color:var(--tinta-tenue)">Cargando…</p>';
    fetch(endpoint + (endpoint.indexOf("?") >= 0 ? "&" : "?") + "listar=1")
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (filas) {
        contactos = Array.isArray(filas) ? filas : [];
        pintarContactos();
        $("#boton-csv").disabled = contactos.length === 0;
      })
      .catch(function () {
        caja.innerHTML = '<p style="color:var(--error)">No pudimos traer la lista. Revisa la conexión o que la dirección de captación siga activa, y toca "Actualizar lista" para reintentar.</p>';
      });
  }

  function pintarContactos() {
    var busqueda = $("#buscar-contacto").value.trim().toLowerCase();
    var visibles = contactos.filter(function (c) {
      return !busqueda || JSON.stringify(c).toLowerCase().indexOf(busqueda) >= 0;
    });
    $("#contador-contactos").textContent = visibles.length + " de " + contactos.length + " contactos";
    if (!visibles.length) {
      $("#tabla-contactos").innerHTML = '<p style="color:var(--tinta-tenue)">Sin contactos' + (busqueda ? " con esa búsqueda" : " todavía") + ".</p>";
      return;
    }
    $("#tabla-contactos").innerHTML = '<table class="adm-tabla"><thead><tr><th>Fecha</th><th>Contacto</th><th>Tipo</th><th>Origen</th></tr></thead><tbody>' +
      visibles.map(function (c) {
        return "<tr><td>" + esc((c.fecha || "").slice(0, 16).replace("T", " ")) + "</td><td>" + esc(c.contacto || "") +
          "</td><td>" + esc(c.tipo || "") + "</td><td>" + esc(c.origen || c.utm_source || "") + "</td></tr>";
      }).join("") + "</tbody></table>";
  }

  $("#boton-cargar-contactos").addEventListener("click", cargarContactos);
  $("#buscar-contacto").addEventListener("input", pintarContactos);
  $$('.adm-pestana[data-pestana="contactos"]').forEach(function (b) {
    b.addEventListener("click", function () { if (!contactos.length) cargarContactos(); });
  });

  $("#boton-csv").addEventListener("click", function () {
    var columnas = ["fecha", "contacto", "tipo", "origen", "utm_source", "utm_medium", "utm_campaign"];
    var escapar = function (v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; };
    var lineas = [columnas.join(";")].concat(contactos.map(function (c) {
      return columnas.map(function (col) { return escapar(c[col]); }).join(";");
    }));
    // BOM para que Excel abra bien las tildes.
    var blob = new Blob(["﻿" + lineas.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(blob);
    enlace.download = "contactos-tucolita-" + new Date().toISOString().slice(0, 10) + ".csv";
    enlace.click();
    URL.revokeObjectURL(enlace.href);
  });

  /* ============================================================
     VISTA PREVIA Y PUBLICACIÓN
     ============================================================ */

  $("#boton-preview").addEventListener("click", function () {
    try {
      sessionStorage.setItem("tucolita_preview_menu", JSON.stringify(menuDatos()));
    } catch (e) { }
    window.open("menu.html?preview=1", "_blank");
  });

  function publicarArchivo(clave) {
    var ruta = ARCHIVOS[clave];
    var contenido = aBase64(JSON.stringify(archivos[clave].datos, null, 2) + "\n");
    return escribirArchivoRepo(ruta, contenido, archivos[clave].sha, "Panel: actualiza " + ruta)
      .then(function (r) {
        if (r.status === 409 || r.status === 422) {
          return r.json().catch(function () { return {}; }).then(function (cuerpo) {
            var esConflicto = r.status === 409 ||
              (cuerpo.message && cuerpo.message.indexOf("does not match") >= 0);
            if (!esConflicto) throw new Error("GitHub rechazó el cambio de " + ruta + ".");
            var forzar = !confirm(
              "Alguien publicó cambios desde otro dispositivo mientras editabas.\n\n" +
              "· Aceptar: RECARGAR lo último publicado (tus cambios en memoria se pierden).\n" +
              "· Cancelar: FORZAR tus cambios encima de los del otro dispositivo."
            );
            if (!forzar) {
              return cargarArchivos().then(function () {
                abrirPanel();
                throw new Error("recargado");
              });
            }
            // Forzar: se toma el sha remoto más nuevo y se vuelve a escribir.
            return leerArchivoRepo(ruta).then(function (remoto) {
              return escribirArchivoRepo(ruta, contenido, remoto && remoto.sha, "Panel: actualiza " + ruta + " (forzado)");
            }).then(function (r2) {
              if (!r2.ok) throw new Error("No se pudo forzar el cambio de " + ruta + ".");
              return r2.json();
            });
          });
        }
        if (!r.ok) throw new Error("No se pudo publicar " + ruta + " (estado " + r.status + ").");
        return r.json();
      })
      .then(function (respuesta) {
        if (respuesta && respuesta.content && respuesta.content.sha) {
          archivos[clave].sha = respuesta.content.sha;
        }
      });
  }

  function publicarImagen(pendiente) {
    // Si la imagen ya existe se necesita su sha para reemplazarla.
    return leerArchivoRepo(pendiente.ruta).then(function (remoto) {
      return escribirArchivoRepo(pendiente.ruta, pendiente.base64, remoto && remoto.sha, "Panel: foto " + pendiente.ruta);
    }).then(function (r) {
      if (!r.ok) throw new Error("No se pudo subir la foto " + pendiente.ruta + ".");
    });
  }

  $("#boton-publicar").addEventListener("click", function () {
    var boton = this;
    boton.disabled = true;
    boton.textContent = "Publicando…";

    // Primero las fotos (para que existan cuando el menú las nombre), luego los JSON.
    var cadena = Promise.resolve();
    imagenesPendientes.forEach(function (img) {
      cadena = cadena.then(function () { return publicarImagen(img); });
    });
    Object.keys(sucios).forEach(function (clave) {
      if (sucios[clave]) cadena = cadena.then(function () { return publicarArchivo(clave); });
    });

    cadena.then(function () {
      sucios = {};
      contadorCambios = 0;
      imagenesPendientes = [];
      pintarBotonPublicar();
      toast('Publicado. La web se actualiza en menos de un minuto. <a href="https://tucolita.com/menu.html" target="_blank" rel="noopener">Ver la carta</a>', false, true);
    }).catch(function (e) {
      pintarBotonPublicar();
      if (e && e.message === "recargado") {
        toast("Se recargó lo último publicado. Vuelve a hacer tus cambios.", true);
        return;
      }
      toast((e && e.message ? e.message : "Falló la conexión.") + " Toca \"Publicar cambios\" para reintentar.", true);
    });
  });

  /* ---------- arranque ---------- */

  intentarReingreso();
})();
