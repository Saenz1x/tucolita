/* Panel de Tu Colita — edición de la carta y publicación al sitio. */
(function () {
  "use strict";

  var REPO = "Saenz1x/tucolita";
  var RAMA = "main";
  var API = "https://api.github.com";
  var INACTIVIDAD = 20 * 60 * 1000;

  var ARCHIVOS = {
    menu: "datos/menu.json",
    negocio: "datos/negocio.json",
    preapertura: "datos/preapertura.json"
  };

  var LS_TOKEN = "tc_conexion";
  var LS_INTENTOS = "tc_intentos";

  var token = "";
  var clave = "";
  var archivos = { menu: null, negocio: null, preapertura: null };
  var sucios = {};
  var pendientes = 0;
  var imagenesPendientes = [];
  var contactos = [];
  var editando = null;
  var imagenNueva = null;
  var filtroCategoria = "";
  var temporizadorInactividad = null;

  // El panel no se abre dentro de otra página: evita que alguien lo
  // esconda en un iframe para robar los toques.
  if (window.top !== window.self) {
    try { window.top.location = window.self.location; } catch (e) { document.documentElement.innerHTML = ""; }
    return;
  }

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  var numeroCOP = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
  function pesos(n) { return "$" + numeroCOP.format(n); }

  function esc(t) {
    var d = document.createElement("div");
    d.textContent = t == null ? "" : String(t);
    return d.innerHTML;
  }

  function slug(t) {
    return String(t).toLowerCase()
      .normalize("NFD").replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function sinTildes(t) {
    return String(t).toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  }

  var relojToast = null;
  function aviso(mensaje, esError, comoHtml) {
    var t = $("#toast");
    if (comoHtml) t.innerHTML = mensaje; else t.textContent = mensaje;
    t.classList.toggle("error", !!esError);
    t.classList.add("visible");
    clearTimeout(relojToast);
    relojToast = setTimeout(function () { t.classList.remove("visible"); }, esError ? 7000 : 4500);
  }

  /* ---------- base64 con tildes y eñes ---------- */

  function aBase64(texto) {
    var bytes = new TextEncoder().encode(texto);
    var bin = "";
    for (var i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }

  function deBase64(b64) {
    var bin = atob(b64.replace(/\n/g, ""));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  }

  /* ---------- cifrado del código de conexión ---------- */

  function hex(buf) {
    return Array.from(new Uint8Array(buf)).map(function (b) {
      return b.toString(16).padStart(2, "0");
    }).join("");
  }

  function deHex(s) {
    var a = new Uint8Array(s.length / 2);
    for (var i = 0; i < a.length; i++) a[i] = parseInt(s.substr(i * 2, 2), 16);
    return a;
  }

  function sha256(texto) {
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto)).then(hex);
  }

  function claveDerivada(secreto, sal) {
    return crypto.subtle.importKey("raw", new TextEncoder().encode(secreto), "PBKDF2", false, ["deriveKey"])
      .then(function (base) {
        return crypto.subtle.deriveKey(
          { name: "PBKDF2", salt: sal, iterations: 210000, hash: "SHA-256" },
          base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
      });
  }

  function cifrar(texto, secreto) {
    var sal = crypto.getRandomValues(new Uint8Array(16));
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return claveDerivada(secreto, sal).then(function (k) {
      return crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, k, new TextEncoder().encode(texto));
    }).then(function (c) {
      return { v: 2, sal: hex(sal), iv: hex(iv), datos: hex(c) };
    });
  }

  function descifrar(paquete, secreto) {
    return claveDerivada(secreto, deHex(paquete.sal)).then(function (k) {
      return crypto.subtle.decrypt({ name: "AES-GCM", iv: deHex(paquete.iv) }, k, deHex(paquete.datos));
    }).then(function (p) { return new TextDecoder().decode(p); });
  }

  function leerGuardado() {
    try { return JSON.parse(localStorage.getItem(LS_TOKEN) || "null"); } catch (e) { return null; }
  }

  function guardarToken(valor, secreto) {
    return cifrar(valor, secreto).then(function (p) {
      try { localStorage.setItem(LS_TOKEN, JSON.stringify(p)); } catch (e) { }
    });
  }

  function olvidarTodo() {
    try {
      localStorage.removeItem(LS_TOKEN);
      sessionStorage.clear();
    } catch (e) { }
  }

  /* ---------- intentos de clave ---------- */

  function intentosRecientes() {
    var lista = [];
    try { lista = JSON.parse(localStorage.getItem(LS_INTENTOS) || "[]"); } catch (e) { }
    var corte = Date.now() - 60000;
    return lista.filter(function (t) { return t > corte; });
  }

  function anotarIntento() {
    var lista = intentosRecientes();
    lista.push(Date.now());
    try { localStorage.setItem(LS_INTENTOS, JSON.stringify(lista)); } catch (e) { }
  }

  /* ---------- API de GitHub ---------- */

  function api(ruta, opciones) {
    opciones = opciones || {};
    opciones.headers = Object.assign({
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Authorization": "Bearer " + token
    }, opciones.headers || {});
    return fetch(API + ruta, opciones);
  }

  function leerArchivo(ruta) {
    return api("/repos/" + REPO + "/contents/" + ruta + "?ref=" + RAMA).then(function (r) {
      if (r.status === 404) return null;
      if (!r.ok) throw new Error("estado " + r.status);
      return r.json();
    });
  }

  function escribirArchivo(ruta, contenido, sha, mensaje) {
    var cuerpo = { message: mensaje, content: contenido, branch: RAMA };
    if (sha) cuerpo.sha = sha;
    return api("/repos/" + REPO + "/contents/" + ruta, { method: "PUT", body: JSON.stringify(cuerpo) });
  }

  function cargarTodo() {
    return Promise.all(Object.keys(ARCHIVOS).map(function (k) {
      return leerArchivo(ARCHIVOS[k]).then(function (res) {
        if (!res) throw new Error("Falta el archivo " + ARCHIVOS[k] + " en el sitio.");
        archivos[k] = { datos: JSON.parse(deBase64(res.content)), sha: res.sha };
      });
    }));
  }

  function conectar() {
    return api("/repos/" + REPO).then(function (r) {
      if (r.status === 401) throw new Error("El código de conexión no sirve o ya venció.");
      if (r.status === 403) throw new Error("El código de conexión no tiene permiso sobre el sitio.");
      if (r.status === 404) throw new Error("No encontramos el sitio. Revisa que el código tenga acceso.");
      if (!r.ok) throw new Error("GitHub no respondió. Intenta en un momento.");
      return cargarTodo();
    });
  }

  /* ---------- pendientes ---------- */

  function marcar(archivo) {
    sucios[archivo] = true;
    pendientes++;
    pintarBarra();
  }

  function pintarBarra() {
    var barra = $("#barra-publicar");
    var total = pendientes + imagenesPendientes.length;
    barra.hidden = total === 0;
    $("#texto-pendientes").textContent = total === 1 ? "1 cambio sin publicar" : total + " cambios sin publicar";
  }

  window.addEventListener("beforeunload", function (ev) {
    if (pendientes > 0 || imagenesPendientes.length) { ev.preventDefault(); ev.returnValue = ""; }
  });

  /* ---------- sesión ---------- */

  function reiniciarInactividad() {
    clearTimeout(temporizadorInactividad);
    temporizadorInactividad = setTimeout(function () {
      if (pendientes > 0 || imagenesPendientes.length) { reiniciarInactividad(); return; }
      salir(true);
    }, INACTIVIDAD);
  }

  function salir(porInactividad) {
    if (!porInactividad && (pendientes > 0 || imagenesPendientes.length) &&
        !confirm("Tienes cambios sin publicar. ¿Salir de todas formas?")) return;
    token = ""; clave = "";
    try { sessionStorage.clear(); } catch (e) { }
    if (porInactividad) {
      try { sessionStorage.setItem("tc_msg", "Se cerró la sesión por inactividad."); } catch (e) { }
    }
    location.reload();
  }

  ["pointerdown", "keydown"].forEach(function (ev) {
    document.addEventListener(ev, function () { if (token) reiniciarInactividad(); }, { passive: true });
  });

  function abrirPanel() {
    $("#pantalla-clave").hidden = true;
    $("#pantalla-conexion").hidden = true;
    $("#panel").hidden = false;
    $("#estado-conexion").textContent = "Carta de Tu Colita";
    sucios = {}; pendientes = 0; imagenesPendientes = [];
    pintarBarra();
    pintarProductos();
    pintarNegocio();
    pintarApertura();
    reiniciarInactividad();
  }

  /* ---------- entrada ---------- */

  $("#form-clave").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var error = $("#error-clave");
    error.textContent = "";

    var recientes = intentosRecientes();
    if (recientes.length >= 5) {
      var espera = Math.ceil((recientes[0] + 60000 - Date.now()) / 1000);
      error.textContent = "Muchos intentos. Espera " + Math.max(espera, 5) + " segundos.";
      return;
    }

    var escrita = $("#campo-clave").value.trim();
    if (!escrita) return;
    anotarIntento();

    var hashEsperado = (archivos.negocioPublico && archivos.negocioPublico.adminHash) || "";
    sha256(escrita).then(function (h) {
      if (hashEsperado && h !== hashEsperado) {
        error.textContent = "Esa clave no es.";
        $("#campo-clave").select();
        return;
      }
      clave = escrita;
      try { localStorage.removeItem(LS_INTENTOS); } catch (e) { }

      var guardado = leerGuardado();
      if (!guardado) {
        $("#pantalla-clave").hidden = true;
        $("#pantalla-conexion").hidden = false;
        $("#campo-codigo").focus();
        return;
      }
      descifrar(guardado, clave).then(function (t) {
        token = t;
        var boton = ev.target.querySelector("button[type=submit]");
        boton.disabled = true; boton.textContent = "Entrando…";
        return conectar().then(abrirPanel).catch(function (e) {
          boton.disabled = false; boton.textContent = "Entrar";
          error.textContent = e.message;
        });
      }).catch(function () {
        // El token quedó de una clave anterior: se pide de nuevo.
        olvidarTodo();
        $("#pantalla-clave").hidden = true;
        $("#pantalla-conexion").hidden = false;
      });
    });
  });

  $("#form-conexion").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var error = $("#error-conexion");
    error.textContent = "";
    var codigo = $("#campo-codigo").value.trim();
    if (!codigo) { error.textContent = "Pega el código."; return; }

    var boton = ev.target.querySelector("button[type=submit]");
    boton.disabled = true; boton.textContent = "Conectando…";
    token = codigo;
    conectar().then(function () {
      return guardarToken(codigo, clave);
    }).then(abrirPanel).catch(function (e) {
      boton.disabled = false; boton.textContent = "Conectar";
      error.textContent = e.message;
      token = "";
    });
  });

  $("#boton-salir").addEventListener("click", function () { salir(false); });

  /* ---------- pestañas ---------- */

  $$(".adm-pestana").forEach(function (b) {
    b.addEventListener("click", function () {
      $$(".adm-pestana").forEach(function (x) { x.classList.remove("activa"); });
      b.classList.add("activa");
      $$("[data-panel-de]").forEach(function (s) { s.hidden = s.dataset.panelDe !== b.dataset.pestana; });
      if (b.dataset.pestana === "contactos" && !contactos.length) cargarContactos();
    });
  });

  /* ---------- productos ---------- */

  function menu() { return archivos.menu.datos; }

  function categorias() {
    return (menu().categorias || []).slice().sort(function (a, b) { return (a.orden || 0) - (b.orden || 0); });
  }

  function productosOrdenados() {
    return (menu().productos || []).slice().sort(function (a, b) {
      var ca = categorias().findIndex(function (c) { return c.nombre === a.categoria; });
      var cb = categorias().findIndex(function (c) { return c.nombre === b.categoria; });
      if (ca !== cb) return ca - cb;
      return (a.orden || 0) - (b.orden || 0);
    });
  }

  function buscarProducto(id) {
    return (menu().productos || []).find(function (p) { return p.id === id; });
  }

  function pintarFiltros() {
    var caja = $("#filtros-categoria");
    var html = '<button class="adm-filtro' + (filtroCategoria ? "" : " activo") + '" data-cat="">Todo</button>';
    html += categorias().map(function (c) {
      var n = (menu().productos || []).filter(function (p) { return p.categoria === c.nombre; }).length;
      return '<button class="adm-filtro' + (filtroCategoria === c.nombre ? " activo" : "") +
        '" data-cat="' + esc(c.nombre) + '">' + esc(c.nombre) + " · " + n + "</button>";
    }).join("");
    caja.innerHTML = html;
  }

  function pintarProductos() {
    pintarFiltros();
    var busqueda = sinTildes($("#buscar-producto").value.trim());
    var lista = productosOrdenados().filter(function (p) {
      if (filtroCategoria && p.categoria !== filtroCategoria) return false;
      if (busqueda && sinTildes(p.nombre).indexOf(busqueda) < 0) return false;
      return true;
    });

    var total = (menu().productos || []).length;
    var agotados = (menu().productos || []).filter(function (p) { return p.agotado; }).length;
    $("#resumen-productos").textContent = total + " productos · " + agotados + " agotados" +
      (lista.length !== total ? " · mostrando " + lista.length : "");

    $("#sin-productos").hidden = lista.length > 0;
    $("#rejilla-productos").innerHTML = lista.map(function (p) {
      var foto = p.imagen
        ? '<img class="adm-tarjeta__foto" src="' + esc(p.imagen) + '" alt="" loading="lazy">'
        : '<div class="adm-tarjeta__sinfoto"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.7l1.1-2h5.4l1.1 2h1.7A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z"/><circle cx="12" cy="12.4" r="3.6"/></svg></div>';
      return '<article class="adm-tarjeta' + (p.agotado ? " agotado" : "") + '" data-id="' + esc(p.id) + '">' +
        '<button class="adm-tarjeta__editar" type="button" data-accion="editar" aria-label="Editar ' + esc(p.nombre) + '"></button>' +
        foto +
        '<div class="adm-tarjeta__cuerpo">' +
        '<span class="adm-tarjeta__nombre">' + esc(p.nombre) + "</span>" +
        '<span class="adm-tarjeta__precio">' + pesos(p.precio) + "</span>" +
        "</div>" +
        '<div class="adm-tarjeta__pie">' +
        '<span class="adm-tarjeta__rotulo">' + (p.agotado ? "Agotado" : "Disponible") + "</span>" +
        '<button class="interruptor interruptor--chico" type="button" role="switch" aria-checked="' +
        (p.agotado ? "false" : "true") + '" data-accion="disponible" aria-label="Disponibilidad de ' + esc(p.nombre) + '"></button>' +
        "</div></article>";
    }).join("");
  }

  $("#buscar-producto").addEventListener("input", pintarProductos);

  $("#filtros-categoria").addEventListener("click", function (ev) {
    var b = ev.target.closest(".adm-filtro");
    if (!b) return;
    filtroCategoria = b.dataset.cat;
    pintarProductos();
  });

  $("#rejilla-productos").addEventListener("click", function (ev) {
    var boton = ev.target.closest("[data-accion]");
    if (!boton) return;
    var tarjeta = ev.target.closest(".adm-tarjeta");
    var p = buscarProducto(tarjeta.dataset.id);
    if (!p) return;

    if (boton.dataset.accion === "disponible") {
      ev.stopPropagation();
      p.agotado = !p.agotado;
      marcar("menu");
      pintarProductos();
    } else {
      abrirEditor(p.id);
    }
  });

  /* ---------- editor ---------- */

  function llenarCategorias(sel) {
    $("#prod-categoria").innerHTML = categorias().map(function (c) {
      return '<option value="' + esc(c.nombre) + '"' + (c.nombre === sel ? " selected" : "") + ">" + esc(c.nombre) + "</option>";
    }).join("") + '<option value="__nueva__">+ Categoría nueva…</option>';
  }

  $("#prod-categoria").addEventListener("change", function () {
    $("#campo-categoria-nueva").hidden = this.value !== "__nueva__";
  });

  $("#prod-precio").addEventListener("input", function () {
    var n = parseInt(this.value, 10);
    $("#precio-formateado").textContent = isNaN(n) ? "" : "Se verá " + pesos(n);
  });

  $("#prod-agotado").addEventListener("click", function () {
    this.setAttribute("aria-checked", this.getAttribute("aria-checked") === "true" ? "false" : "true");
  });

  function abrirEditor(id) {
    editando = id || null;
    imagenNueva = null;
    var p = id ? buscarProducto(id) : null;

    $("#modal-titulo").textContent = p ? "Editar producto" : "Producto nuevo";
    $("#prod-nombre").value = p ? p.nombre : "";
    llenarCategorias(p ? p.categoria : (filtroCategoria || (categorias()[0] || {}).nombre));
    $("#campo-categoria-nueva").hidden = true;
    $("#prod-categoria-nueva").value = "";
    $("#prod-descripcion").value = p ? (p.descripcion || "") : "";
    $("#prod-precio").value = p ? p.precio : "";
    $("#precio-formateado").textContent = p ? "Se verá " + pesos(p.precio) : "";
    $("#prod-agotado").setAttribute("aria-checked", p && p.agotado ? "true" : "false");
    $$('#form-producto input[name="etiqueta"]').forEach(function (c) {
      c.checked = !!(p && (p.etiquetas || []).indexOf(c.value) >= 0);
    });
    var vista = $("#prod-imagen-preview");
    if (p && p.imagen) { vista.src = p.imagen; vista.classList.add("visible"); }
    else { vista.classList.remove("visible"); vista.removeAttribute("src"); }
    $("#prod-imagen").value = "";
    $("#error-producto").textContent = "";
    $("#borrar-producto").hidden = !p;
    $("#modal-producto").classList.add("visible");
    $("#prod-nombre").focus();
  }

  function cerrarEditor() {
    $("#modal-producto").classList.remove("visible");
    editando = null;
    imagenNueva = null;
  }

  $("#cerrar-modal").addEventListener("click", cerrarEditor);
  $("#boton-nuevo").addEventListener("click", function () { abrirEditor(null); });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && $("#modal-producto").classList.contains("visible")) cerrarEditor();
  });

  $("#borrar-producto").addEventListener("click", function () {
    var p = buscarProducto(editando);
    if (!p) return;
    if (!confirm("¿Eliminar \"" + p.nombre + "\" de la carta?")) return;
    menu().productos = menu().productos.filter(function (x) { return x.id !== editando; });
    marcar("menu");
    cerrarEditor();
    pintarProductos();
  });

  // La foto se reduce a 900px de lado mayor y se deja por debajo de 300 KB.
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
        var lienzo = document.createElement("canvas");
        lienzo.width = Math.round(img.width * escala);
        lienzo.height = Math.round(img.height * escala);
        lienzo.getContext("2d").drawImage(img, 0, 0, lienzo.width, lienzo.height);

        var calidad = 0.82;
        var dataUrl = lienzo.toDataURL("image/jpeg", calidad);
        while (dataUrl.length * 0.75 > 300 * 1024 && calidad > 0.5) {
          calidad -= 0.12;
          dataUrl = lienzo.toDataURL("image/jpeg", calidad);
        }
        if (dataUrl.length * 0.75 > 300 * 1024) {
          error.textContent = "Esa foto pesa demasiado. Intenta con otra.";
          return;
        }
        imagenNueva = { base64: dataUrl.split(",")[1], dataUrl: dataUrl };
        var vista = $("#prod-imagen-preview");
        vista.src = dataUrl;
        vista.classList.add("visible");
      };
      img.onerror = function () { error.textContent = "No pudimos leer esa imagen."; };
      img.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  });

  function idUnico(nombre) {
    var base = slug(nombre) || "producto";
    var id = base, n = 2;
    while (buscarProducto(id)) { id = base + "-" + n; n++; }
    return id;
  }

  $("#form-producto").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var error = $("#error-producto");
    error.textContent = "";

    var nombre = $("#prod-nombre").value.trim();
    var precio = parseInt($("#prod-precio").value, 10);
    if (!nombre) { error.textContent = "Ponle nombre al producto."; return; }
    if (isNaN(precio) || precio < 0) { error.textContent = "Revisa el precio."; return; }

    var categoria = $("#prod-categoria").value;
    if (categoria === "__nueva__") {
      var nueva = $("#prod-categoria-nueva").value.trim();
      if (!nueva) { error.textContent = "Escribe el nombre de la categoría."; return; }
      categoria = nueva;
      if (!menu().categorias.some(function (c) { return c.nombre === nueva; })) {
        var max = Math.max.apply(null, [0].concat(menu().categorias.map(function (c) { return c.orden || 0; })));
        menu().categorias.push({ id: slug(nueva), nombre: nueva, descripcion: "", orden: max + 1 });
      }
    }

    var etiquetas = $$('#form-producto input[name="etiqueta"]:checked').map(function (c) { return c.value; });
    var agotado = $("#prod-agotado").getAttribute("aria-checked") === "true";

    var p;
    if (editando) {
      p = buscarProducto(editando);
      if (!p) { cerrarEditor(); return; }
    } else {
      var cuantos = (menu().productos || []).filter(function (x) { return x.categoria === categoria; }).length;
      p = { id: idUnico(nombre), orden: cuantos + 1, imagen: "", agotado: false };
      menu().productos.push(p);
    }

    p.nombre = nombre;
    p.categoria = categoria;
    p.descripcion = $("#prod-descripcion").value.trim();
    p.precio = precio;
    p.etiquetas = etiquetas;
    p.agotado = agotado;

    if (imagenNueva) {
      var ruta = "imagenes/menu/" + p.id + ".jpg";
      p.imagen = ruta;
      imagenesPendientes = imagenesPendientes.filter(function (i) { return i.ruta !== ruta; });
      imagenesPendientes.push({ ruta: ruta, base64: imagenNueva.base64 });
    }

    marcar("menu");
    cerrarEditor();
    pintarProductos();
  });

  /* ---------- respaldo ---------- */

  function bajarArchivo(texto, nombre, tipo) {
    var blob = new Blob([texto], { type: tipo });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  $("#boton-respaldo").addEventListener("click", function () {
    var hoy = new Date().toISOString().slice(0, 10);
    bajarArchivo(JSON.stringify(menu(), null, 2), "carta-tucolita-" + hoy + ".json", "application/json");
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
        if (!confirm("Esto reemplaza la carta con la del archivo. ¿Seguir?")) return;
        archivos.menu.datos = datos;
        marcar("menu");
        pintarProductos();
        aviso("Respaldo cargado. Publica para que salga a la web.");
      } catch (e) {
        aviso("Ese archivo no parece un respaldo de la carta.", true);
      }
    };
    lector.readAsText(archivo, "utf-8");
    this.value = "";
  });

  /* ---------- negocio ---------- */

  var DIAS = [
    { k: "lun", r: "Lunes" }, { k: "mar", r: "Martes" }, { k: "mie", r: "Miércoles" },
    { k: "jue", r: "Jueves" }, { k: "vie", r: "Viernes" }, { k: "sab", r: "Sábado" },
    { k: "dom", r: "Domingo" }
  ];

  function pintarNegocio() {
    var n = archivos.negocio.datos;

    $("#editor-horarios").innerHTML = DIAS.map(function (d) {
      var h = n.horarios[d.k] || { abre: "13:00", cierra: "23:00", cerrado: false };
      return '<div class="adm-fila-switch" data-dia="' + d.k + '" style="margin:.5rem 0">' +
        "<strong style='min-width:84px'>" + d.r + "</strong>" +
        '<input type="time" data-h="abre" value="' + esc(h.abre) + '"' + (h.cerrado ? " disabled" : "") + ">" +
        '<input type="time" data-h="cierra" value="' + esc(h.cierra) + '"' + (h.cerrado ? " disabled" : "") + ">" +
        '<label style="display:inline-flex;align-items:center;gap:.35rem;font-size:.8rem;color:var(--tinta-suave)">' +
        '<input type="checkbox" data-h="cerrado"' + (h.cerrado ? " checked" : "") + ">Cerrado</label></div>";
    }).join("");

    $("#neg-telefono").value = n.telefono || "";
    $("#neg-direccion").value = n.direccion || "";
    $("#neg-instagram").value = n.enlaces.instagram || "";
    $("#neg-tiktok").value = n.enlaces.tiktok || "";
    $("#neg-facebook").value = n.enlaces.facebook || "";
    $("#neg-vigencia").value = n.vigenciaCarta || "";
    var t = n.textos || {};
    $("#neg-hero-titulo").value = t.heroTitulo || "";
    $("#neg-hero-bajada").value = t.heroBajada || "";
    $("#neg-hero-voz").value = t.heroVoz || "";
    $("#neg-concepto-titulo").value = t.conceptoTitulo || "";
    $("#neg-concepto-p1").value = t.conceptoParrafo1 || "";
    $("#neg-concepto-p2").value = t.conceptoParrafo2 || "";
    $("#neg-noche-titulo").value = t.nocheTitulo || "";
    $("#neg-noche-parrafo").value = t.nocheParrafo || "";
    $("#neg-noche-epigrafe").value = t.nocheEpigrafe || "";
    $("#neg-muro-parrafo").value = t.muroParrafo || "";
  }

  $("#editor-horarios").addEventListener("change", function (ev) {
    if (ev.target.dataset.h === "cerrado") {
      ev.target.closest("[data-dia]").querySelectorAll('input[type="time"]').forEach(function (i) {
        i.disabled = ev.target.checked;
      });
    }
  });

  $("#boton-guardar-negocio").addEventListener("click", function () {
    var n = archivos.negocio.datos;
    document.querySelectorAll("#editor-horarios [data-dia]").forEach(function (fila) {
      var abre = fila.querySelector('[data-h="abre"]').value || "13:00";
      var cierra = fila.querySelector('[data-h="cierra"]').value || "23:00";
      var cerrado = fila.querySelector('[data-h="cerrado"]').checked;
      n.horarios[fila.dataset.dia] = {
        abre: abre, cierra: cierra, cerrado: cerrado,
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
    n.textos.heroVoz = $("#neg-hero-voz").value.trim();
    n.textos.conceptoTitulo = $("#neg-concepto-titulo").value.trim();
    n.textos.conceptoParrafo1 = $("#neg-concepto-p1").value.trim();
    n.textos.conceptoParrafo2 = $("#neg-concepto-p2").value.trim();
    n.textos.nocheTitulo = $("#neg-noche-titulo").value.trim();
    n.textos.nocheParrafo = $("#neg-noche-parrafo").value.trim();
    n.textos.nocheEpigrafe = $("#neg-noche-epigrafe").value.trim();
    n.textos.muroParrafo = $("#neg-muro-parrafo").value.trim();
    marcar("negocio");
    aviso("Guardado. Publica para que salga a la web.");
  });

  /* ---------- apertura ---------- */

  function pintarApertura() {
    var p = archivos.preapertura.datos;
    $("#switch-preapertura").setAttribute("aria-checked", p.modo ? "true" : "false");
    $("#pre-fecha").value = (p.apertura || "").slice(0, 16);
    $("#pre-titulo").value = (p.textos && p.textos.titulo) || "";
    $("#pre-bajada").value = (p.textos && p.textos.bajada) || "";
    $("#pre-captacion").value = (p.textos && p.textos.captacion) || "";
    $("#pre-endpoint").value = p.endpointContactos || "";
    pintarCodigos();
  }

  $("#switch-preapertura").addEventListener("click", function () {
    this.setAttribute("aria-checked", this.getAttribute("aria-checked") === "true" ? "false" : "true");
  });

  $("#boton-guardar-apertura").addEventListener("click", function () {
    var p = archivos.preapertura.datos;
    p.modo = $("#switch-preapertura").getAttribute("aria-checked") === "true";
    var f = $("#pre-fecha").value;
    if (f) {
      p.apertura = f + (f.length === 16 ? ":00" : "") + "-05:00";
      p.aperturaEnPalabras = "";
    }
    p.textos = p.textos || {};
    p.textos.titulo = $("#pre-titulo").value.trim();
    p.textos.bajada = $("#pre-bajada").value.trim();
    p.textos.captacion = $("#pre-captacion").value.trim();
    p.endpointContactos = $("#pre-endpoint").value.trim();
    marcar("preapertura");
    aviso("Guardado. Publica para que salga a la web.");
  });

  function pintarCodigos() {
    var lista = archivos.preapertura.datos.codigos || [];
    $("#lista-codigos").innerHTML = lista.length ? lista.map(function (c, i) {
      return '<div class="adm-codigo"><span class="adm-codigo__etiqueta">' + esc(c.etiqueta) + "</span>" +
        '<button class="btn-icono peligro" type="button" data-revocar="' + i + '" aria-label="Revocar ' + esc(c.etiqueta) + '">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5h6v2m-8 0 1 13h8l1-13"/></svg></button></div>';
    }).join("") : '<p class="adm-vacio">Todavía no hay códigos.</p>';
  }

  $("#lista-codigos").addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-revocar]");
    if (!b) return;
    var lista = archivos.preapertura.datos.codigos;
    var i = parseInt(b.dataset.revocar, 10);
    if (!confirm("¿Revocar el código \"" + lista[i].etiqueta + "\"?")) return;
    lista.splice(i, 1);
    marcar("preapertura");
    pintarCodigos();
  });

  function generarCodigo() {
    var letras = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    var azar = crypto.getRandomValues(new Uint8Array(6));
    var s = "";
    for (var i = 0; i < 6; i++) s += letras[azar[i] % letras.length];
    return s;
  }

  $("#boton-crear-codigo").addEventListener("click", function () {
    var etiqueta = $("#etiqueta-codigo").value.trim().toUpperCase();
    if (!etiqueta) { aviso("Ponle una etiqueta: PRENSA, FAMILIA…", true); return; }
    var codigo = generarCodigo();
    sha256(codigo).then(function (h) {
      archivos.preapertura.datos.codigos = archivos.preapertura.datos.codigos || [];
      archivos.preapertura.datos.codigos.push({ etiqueta: etiqueta, hash: h });
      marcar("preapertura");
      pintarCodigos();
      $("#etiqueta-codigo").value = "";

      var mensaje = "Tienes un pase de preestreno para Tu Colita Lounge 🥂\n" +
        "Entra a https://tucolita.com , toca \"Tengo un código\" y escribe: " + codigo;
      $("#codigo-nuevo").innerHTML =
        '<div class="adm-codigo-nuevo"><p>Código de <strong>' + esc(etiqueta) +
        "</strong>. Cópialo ya: no se vuelve a mostrar.</p>" +
        '<strong class="codigo-grande">' + esc(codigo) + "</strong>" +
        '<button class="btn btn--vidrio" type="button" id="copiar-codigo">Copiar mensaje para WhatsApp</button></div>';
      $("#copiar-codigo").addEventListener("click", function () {
        navigator.clipboard.writeText(mensaje)
          .then(function () { aviso("Mensaje copiado."); })
          .catch(function () { aviso("El código es: " + codigo, true); });
      });
    });
  });

  /* ---------- contactos ---------- */

  function cargarContactos() {
    var endpoint = archivos.preapertura.datos.endpointContactos;
    var caja = $("#tabla-contactos");
    if (!endpoint) {
      caja.innerHTML = '<p class="adm-vacio">Todavía no hay dirección configurada. Se pone en la pestaña Apertura.</p>';
      return;
    }
    caja.innerHTML = '<p class="adm-vacio">Cargando…</p>';
    fetch(endpoint + (endpoint.indexOf("?") >= 0 ? "&" : "?") + "listar=1")
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (filas) {
        contactos = Array.isArray(filas) ? filas : [];
        pintarContactos();
        $("#boton-csv").disabled = contactos.length === 0;
      })
      .catch(function () {
        caja.innerHTML = '<p class="adm-vacio" style="color:var(--error)">No pudimos traer la lista. Toca "Actualizar" para reintentar.</p>';
      });
  }

  function pintarContactos() {
    var q = sinTildes($("#buscar-contacto").value.trim());
    var vis = contactos.filter(function (c) { return !q || sinTildes(JSON.stringify(c)).indexOf(q) >= 0; });
    $("#contador-contactos").textContent = vis.length + " de " + contactos.length + " contactos";
    if (!vis.length) {
      $("#tabla-contactos").innerHTML = '<p class="adm-vacio">Sin contactos' + (q ? " con esa búsqueda" : " todavía") + ".</p>";
      return;
    }
    $("#tabla-contactos").innerHTML =
      '<table class="adm-tabla"><thead><tr><th>Fecha</th><th>Contacto</th><th>Tipo</th><th>Origen</th></tr></thead><tbody>' +
      vis.map(function (c) {
        return "<tr><td>" + esc((c.fecha || "").slice(0, 16).replace("T", " ")) + "</td><td>" +
          esc(c.contacto || "") + "</td><td>" + esc(c.tipo || "") + "</td><td>" +
          esc(c.origen || c.utm_source || "") + "</td></tr>";
      }).join("") + "</tbody></table>";
  }

  $("#boton-cargar-contactos").addEventListener("click", cargarContactos);
  $("#buscar-contacto").addEventListener("input", pintarContactos);

  $("#boton-csv").addEventListener("click", function () {
    var cols = ["fecha", "contacto", "tipo", "origen", "utm_source", "utm_medium", "utm_campaign"];
    var q = function (v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; };
    var lineas = [cols.join(";")].concat(contactos.map(function (c) {
      return cols.map(function (k) { return q(c[k]); }).join(";");
    }));
    bajarArchivo("﻿" + lineas.join("\r\n"),
      "contactos-tucolita-" + new Date().toISOString().slice(0, 10) + ".csv",
      "text/csv;charset=utf-8");
  });

  /* ---------- cambiar clave ---------- */

  $("#boton-hash").addEventListener("click", function () {
    var nueva = $("#clave-nueva").value.trim();
    if (!nueva) return;
    sha256(nueva).then(function (h) {
      $("#resultado-hash").textContent = h;
      navigator.clipboard.writeText(h).then(function () { aviso("Copiado."); }).catch(function () { });
    });
  });

  /* ---------- publicar ---------- */

  $("#boton-preview").addEventListener("click", function () {
    try { sessionStorage.setItem("tucolita_preview_menu", JSON.stringify(menu())); } catch (e) { }
    window.open("menu.html?preview=1", "_blank");
  });

  function publicarArchivo(clave_) {
    var ruta = ARCHIVOS[clave_];
    var contenido = aBase64(JSON.stringify(archivos[clave_].datos, null, 2) + "\n");
    return escribirArchivo(ruta, contenido, archivos[clave_].sha, "Actualiza " + ruta)
      .then(function (r) {
        if (r.status === 409 || r.status === 422) {
          return r.json().catch(function () { return {}; }).then(function (cuerpo) {
            var conflicto = r.status === 409 || (cuerpo.message && cuerpo.message.indexOf("does not match") >= 0);
            if (!conflicto) throw new Error("GitHub rechazó el cambio de " + ruta + ".");
            var forzar = !confirm(
              "Alguien publicó desde otro dispositivo mientras editabas.\n\n" +
              "· Aceptar: traer lo último (se pierden tus cambios de ahora).\n" +
              "· Cancelar: publicar los tuyos encima.");
            if (!forzar) {
              return cargarTodo().then(function () { abrirPanel(); throw new Error("recargado"); });
            }
            return leerArchivo(ruta).then(function (remoto) {
              return escribirArchivo(ruta, contenido, remoto && remoto.sha, "Actualiza " + ruta);
            }).then(function (r2) {
              if (!r2.ok) throw new Error("No se pudo publicar " + ruta + ".");
              return r2.json();
            });
          });
        }
        if (!r.ok) throw new Error("No se pudo publicar " + ruta + ".");
        return r.json();
      })
      .then(function (res) {
        if (res && res.content && res.content.sha) archivos[clave_].sha = res.content.sha;
      });
  }

  function publicarImagen(img) {
    return leerArchivo(img.ruta).then(function (remoto) {
      return escribirArchivo(img.ruta, img.base64, remoto && remoto.sha, "Foto " + img.ruta);
    }).then(function (r) {
      if (!r.ok) throw new Error("No se pudo subir la foto.");
    });
  }

  $("#boton-publicar").addEventListener("click", function () {
    var boton = this;
    boton.disabled = true;
    boton.textContent = "Publicando…";

    var cadena = Promise.resolve();
    imagenesPendientes.forEach(function (img) {
      cadena = cadena.then(function () { return publicarImagen(img); });
    });
    Object.keys(sucios).forEach(function (k) {
      if (sucios[k]) cadena = cadena.then(function () { return publicarArchivo(k); });
    });

    cadena.then(function () {
      sucios = {}; pendientes = 0; imagenesPendientes = [];
      pintarBarra();
      boton.disabled = false; boton.textContent = "Publicar";
      aviso('Publicado. La web se actualiza en menos de un minuto. <a href="https://tucolita.com/menu.html" target="_blank" rel="noopener">Ver</a>', false, true);
    }).catch(function (e) {
      pintarBarra();
      boton.disabled = false; boton.textContent = "Publicar";
      if (e && e.message === "recargado") { aviso("Se trajo lo último publicado.", true); return; }
      aviso((e && e.message ? e.message : "Falló la conexión.") + " Toca Publicar para reintentar.", true);
    });
  });

  /* ---------- arranque ---------- */

  try {
    var msg = sessionStorage.getItem("tc_msg");
    if (msg) { sessionStorage.removeItem("tc_msg"); $("#error-clave").textContent = msg; }
  } catch (e) { }

  // La clave se compara contra el hash publicado en negocio.json.
  fetch("datos/negocio.json")
    .then(function (r) { return r.json(); })
    .then(function (n) { archivos.negocioPublico = n; })
    .catch(function () { archivos.negocioPublico = {}; });
})();
