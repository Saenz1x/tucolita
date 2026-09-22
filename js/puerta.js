/* ============================================================
   TU COLITA LOUNGE — puerta.js
   Modo preapertura: cuenta regresiva, captación de contactos y
   códigos de invitado. La decisión instantánea de tapar el sitio
   la toma el script inline del <head>; este archivo es el que
   manda una vez carga datos/preapertura.json.
   ============================================================ */
(function () {
  "use strict";

  var CLAVE_PASE = "tucolita_pase";
  var CLAVE_COLA = "tucolita_cola_contactos";
  var CLAVE_INTENTOS = "tucolita_intentos_codigo";
  var APERTURA_RESPALDO = "2026-10-05T13:00:00-05:00";

  var puerta = document.getElementById("puerta");
  var raiz = document.documentElement;
  var config = null;

  function leerLS(clave) {
    try { return localStorage.getItem(clave); } catch (e) { return null; }
  }
  function escribirLS(clave, valor) {
    try { localStorage.setItem(clave, valor); } catch (e) { }
  }

  function q(nombre) {
    return puerta ? puerta.querySelector('[data-puerta="' + nombre + '"]') : null;
  }

  /* ---------- abrir la puerta ---------- */

  function destapar(inmediato) {
    if (!raiz.classList.contains("cerrado")) return;
    if (inmediato || !puerta) {
      raiz.classList.remove("cerrado");
      if (puerta) puerta.remove();
      return;
    }
    var reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducido) {
      raiz.classList.remove("cerrado");
      puerta.remove();
      return;
    }
    puerta.classList.add("abriendo");
    setTimeout(function () {
      raiz.classList.remove("cerrado");
      puerta.remove();
    }, 850);
  }

  function guardarPase(via, etiqueta) {
    escribirLS(CLAVE_PASE, JSON.stringify({
      via: via, etiqueta: etiqueta || "", fecha: new Date().toISOString()
    }));
  }

  /* ---------- cuenta regresiva ---------- */

  var idIntervalo = null;

  function pintarCuenta(objetivo) {
    var resta = objetivo - Date.now();
    if (resta <= 0) {
      clearInterval(idIntervalo);
      llegoLaHora();
      return;
    }
    var seg = Math.floor(resta / 1000);
    var dias = Math.floor(seg / 86400);
    var horas = Math.floor((seg % 86400) / 3600);
    var minutos = Math.floor((seg % 3600) / 60);
    var segundos = seg % 60;

    var pon = function (nombre, valor) {
      var el = puerta.querySelector('[data-cuenta="' + nombre + '"]');
      if (el) el.textContent = String(valor);
    };
    pon("dias", dias);
    pon("horas", horas);
    pon("minutos", minutos);
    pon("segundos", segundos < 10 ? "0" + segundos : segundos);

    // A más de 30 días, ver minutos y segundos es ruido.
    var lejos = dias > 30;
    ["bloque-min", "bloque-seg", "sep-min", "sep-seg"].forEach(function (n) {
      var el = puerta.querySelector('[data-cuenta="' + n + '"]');
      if (el) el.style.display = lejos ? "none" : "";
    });
  }

  function iniciarCuenta(objetivo) {
    var tick = function () { pintarCuenta(objetivo); };
    tick();
    // Siempre contra Date.now(): no se desfasa si la pestaña duerme.
    idIntervalo = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) tick();
    });
  }

  function llegoLaHora() {
    var titulo = q("titulo");
    if (titulo) titulo.textContent = (config && config.textos && config.textos.yaAbrimos) || "Ya abrimos";
    var cuenta = q("cuenta");
    if (cuenta) cuenta.style.display = "none";
    guardarPase("apertura", "");
    setTimeout(function () { destapar(); }, 2000);
  }

  /* ---------- captación de contactos ---------- */

  var RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  // Detecta si lo escrito es un correo o un celular colombiano.
  // Teléfono: acepta 3001234567, +57 300 123 4567, 300-123-4567.
  function clasificarContacto(crudo) {
    var texto = crudo.trim();
    if (!texto) return null;
    if (texto.indexOf("@") >= 0) {
      return RE_CORREO.test(texto) ? { tipo: "correo", valor: texto.toLowerCase() } : null;
    }
    var digitos = texto.replace(/[\s\-().]/g, "").replace(/^\+/, "");
    if (digitos.indexOf("57") === 0 && digitos.length === 12) digitos = digitos.slice(2);
    if (/^3\d{9}$/.test(digitos)) return { tipo: "whatsapp", valor: "+57" + digitos };
    return null;
  }

  function parametrosUTM() {
    var salida = {};
    try {
      var params = new URLSearchParams(location.search);
      params.forEach(function (v, k) {
        if (k.indexOf("utm_") === 0) salida[k] = v;
      });
    } catch (e) { }
    return salida;
  }

  function armarEnvio(contacto) {
    var datos = {
      fecha: new Date().toISOString(),
      contacto: contacto.valor,
      tipo: contacto.tipo,
      origen: document.referrer || ""
    };
    var utm = parametrosUTM();
    Object.keys(utm).forEach(function (k) { datos[k] = utm[k]; });
    return datos;
  }

  function enviarContacto(datos) {
    var endpoint = config && config.endpointContactos;
    if (!endpoint) return Promise.resolve("sin-endpoint");
    var cuerpo = new URLSearchParams(datos).toString();
    return fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: cuerpo
    }).then(function (r) {
      if (!r.ok) throw new Error("respuesta " + r.status);
      return "ok";
    });
  }

  // Los envíos que fallaron esperan en una cola y se reintentan
  // en la siguiente visita. El visitante nunca paga el error.
  function encolar(datos) {
    var cola = [];
    try { cola = JSON.parse(leerLS(CLAVE_COLA) || "[]"); } catch (e) { }
    cola.push(datos);
    escribirLS(CLAVE_COLA, JSON.stringify(cola.slice(-20)));
  }

  function reintentarCola() {
    var cola = [];
    try { cola = JSON.parse(leerLS(CLAVE_COLA) || "[]"); } catch (e) { }
    if (!cola.length || !(config && config.endpointContactos)) return;
    var pendientes = cola.slice();
    escribirLS(CLAVE_COLA, "[]");
    pendientes.forEach(function (datos) {
      enviarContacto(datos).catch(function () { encolar(datos); });
    });
  }

  function prepararFormularioContacto() {
    var form = q("form");
    if (!form) return;
    var error = q("error");

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      error.textContent = "";

      // Honeypot: si el campo trampa viene lleno, es un bot. Silencio.
      if (form.elements.sitio_web && form.elements.sitio_web.value) return;

      var contacto = clasificarContacto(form.elements.contacto.value);
      if (!contacto) {
        error.textContent = "Eso no parece un correo ni un celular. Revísalo y vuelve a intentar.";
        return;
      }

      var datos = armarEnvio(contacto);
      guardarPase("contacto", contacto.tipo);

      var boton = form.querySelector("button[type=submit]");
      boton.disabled = true;
      boton.textContent = (config && config.textos && config.textos.gracias) ? "Listo" : "Listo";

      enviarContacto(datos)
        .catch(function () { encolar(datos); })
        .then(function () {
          var gracias = (config && config.textos && config.textos.gracias) ||
            "Listo. Cuando abramos, te avisamos primero a ti.";
          error.textContent = "";
          var caja = q("captacion");
          if (caja) caja.textContent = gracias;
          form.style.display = "none";
          setTimeout(function () { destapar(); }, 900);
        });
    });
  }

  /* ---------- códigos de invitado ---------- */

  function hashSHA256(texto) {
    var bytes = new TextEncoder().encode(texto);
    return crypto.subtle.digest("SHA-256", bytes).then(function (buf) {
      return Array.from(new Uint8Array(buf)).map(function (b) {
        return b.toString(16).padStart(2, "0");
      }).join("");
    });
  }

  // Máximo cinco intentos por minuto: corta el ensayo y error.
  function intentosRecientes() {
    var lista = [];
    try { lista = JSON.parse(leerLS(CLAVE_INTENTOS) || "[]"); } catch (e) { }
    var hace1min = Date.now() - 60000;
    return lista.filter(function (t) { return t > hace1min; });
  }

  function registrarIntento() {
    var lista = intentosRecientes();
    lista.push(Date.now());
    escribirLS(CLAVE_INTENTOS, JSON.stringify(lista));
  }

  function prepararCodigo() {
    var enlace = q("codigo-enlace");
    var form = q("codigo-form");
    var error = q("error");
    if (!enlace || !form) return;

    enlace.addEventListener("click", function () {
      form.classList.toggle("visible");
      if (form.classList.contains("visible")) form.elements.codigo.focus();
    });

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      error.textContent = "";

      var recientes = intentosRecientes();
      if (recientes.length >= 5) {
        var espera = Math.ceil((recientes[0] + 60000 - Date.now()) / 1000);
        error.textContent = "Muchos intentos seguidos. Espera " + Math.max(espera, 5) + " segundos y vuelve a probar.";
        return;
      }

      var codigo = form.elements.codigo.value.toUpperCase().replace(/\s/g, "");
      if (!codigo) return;
      registrarIntento();

      if (!(window.crypto && crypto.subtle)) {
        error.textContent = "Tu navegador no permite validar el código aquí. Escríbenos por WhatsApp y te ayudamos.";
        return;
      }

      hashSHA256(codigo).then(function (hash) {
        var lista = (config && config.codigos) || [];
        var acierto = null;
        lista.forEach(function (c) { if (c.hash === hash) acierto = c; });
        if (acierto) {
          guardarPase("codigo", acierto.etiqueta || "");
          destapar();
        } else {
          error.innerHTML = 'Ese código no nos suena. Revísalo o <a href="https://wa.me/573123037666?text=Hola%2C%20tengo%20un%20c%C3%B3digo%20que%20no%20me%20funciona" target="_blank" rel="noopener">escríbenos por WhatsApp</a>.';
        }
      });
    });
  }

  /* ---------- fecha de apertura en palabras ---------- */

  function fechaEnPalabras(iso) {
    try {
      var f = new Date(iso);
      var fecha = new Intl.DateTimeFormat("es-CO", {
        timeZone: "America/Bogota", weekday: "long", day: "numeric", month: "long"
      }).format(f);
      var hora = new Intl.DateTimeFormat("es-CO", {
        timeZone: "America/Bogota", hour: "numeric", minute: "2-digit", hour12: true
      }).format(f).replace("a. m.", "a.m.").replace("p. m.", "p.m.");
      return "Abrimos el " + fecha + ", " + hora;
    } catch (e) { return ""; }
  }

  /* ---------- arranque ---------- */

  function aplicarTextos() {
    if (!config || !config.textos) return;
    var t = config.textos;
    var pares = { titulo: t.titulo, bajada: t.bajada, captacion: t.captacion, boton: t.boton };
    Object.keys(pares).forEach(function (n) {
      var el = q(n);
      if (el && pares[n]) el.textContent = pares[n];
    });
    var fecha = q("fecha");
    if (fecha) {
      fecha.textContent = config.aperturaEnPalabras || fechaEnPalabras(config.apertura);
    }
  }

  fetch("datos/preapertura.json")
    .then(function (r) { if (!r.ok) throw 0; return r.json(); })
    .catch(function () { return null; })
    .then(function (datos) {
      config = datos;

      var apertura = Date.parse((config && config.apertura) || APERTURA_RESPALDO);
      var pase = leerLS(CLAVE_PASE);

      // El JSON manda: interruptor apagado o fecha pasada = sitio destapado.
      var debeCerrar = config ? (config.modo && Date.now() < apertura) : (Date.now() < Date.parse(APERTURA_RESPALDO));

      if (!debeCerrar || pase) {
        destapar(true);
      } else {
        // El inline pudo no cerrar (p. ej. cambió la fecha desde el panel).
        raiz.classList.add("cerrado");
        aplicarTextos();
        iniciarCuenta(apertura);
        prepararFormularioContacto();
        prepararCodigo();
      }

      reintentarCola();
    });
})();
