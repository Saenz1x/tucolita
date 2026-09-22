/* ============================================================
   TU COLITA LOUNGE — horario.js
   Resuelve "Abierto ahora / Cerrado" contra los horarios de
   negocio.json, siempre en hora de Colombia (no en la del
   dispositivo, que el visitante puede tener mal puesta).
   Lo usan index.html y menu.html por igual.
   ============================================================ */
(function (global) {
  "use strict";

  var CLAVES_DIA = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"];
  var NOMBRES_DIA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

  // Día de la semana y minutos transcurridos, leídos en zona de Bogotá.
  // `cuando` permite inyectar una fecha para poder probar esto.
  function ahoraEnColombia(cuando) {
    var partes = new Intl.DateTimeFormat("es-CO", {
      timeZone: "America/Bogota", hour: "numeric", minute: "numeric",
      hour12: false, weekday: "short"
    }).formatToParts(cuando || new Date());
    var mapa = {};
    partes.forEach(function (p) { mapa[p.type] = p.value; });
    var abrev = mapa.weekday.toLowerCase().replace(".", "").slice(0, 3);
    var indice = { dom: 0, lun: 1, mar: 2, mié: 3, mie: 3, jue: 4, vie: 5, sáb: 6, sab: 6 }[abrev];
    if (indice === undefined) indice = (cuando || new Date()).getDay();
    var hora = parseInt(mapa.hour, 10);
    if (hora === 24) hora = 0;   // algunas plataformas devuelven 24 a medianoche
    return { dia: indice, minutos: hora * 60 + parseInt(mapa.minute, 10) };
  }

  function aMinutos(hhmm) {
    var t = String(hhmm).split(":");
    return parseInt(t[0], 10) * 60 + parseInt(t[1], 10);
  }

  function horaBonita(hhmm) {
    var m = aMinutos(hhmm);
    var h = Math.floor(m / 60), min = m % 60;
    var sufijo = h >= 12 ? "p.m." : "a.m.";
    var h12 = h % 12; if (h12 === 0) h12 = 12;
    return h12 + ":" + (min < 10 ? "0" : "") + min + " " + sufijo;
  }

  // "a la 1:00 p.m." pero "a las 2:00 p.m."
  function articuloHora(hhmm) {
    return (Math.floor(aMinutos(hhmm) / 60) % 12) === 1 ? "a la" : "a las";
  }

  // Devuelve { abierto, texto }. Resuelve el cierre pasada la medianoche:
  // a la 1:30 a.m. de un sábado manda el horario del viernes.
  function estado(horarios, cuando) {
    if (!horarios) return { abierto: false, texto: "Cerrado" };
    var ahora = ahoraEnColombia(cuando);
    var hoy = horarios[CLAVES_DIA[ahora.dia]];
    var ayer = horarios[CLAVES_DIA[(ahora.dia + 6) % 7]];

    if (ayer && !ayer.cerrado && ayer.cruzaMedianoche && ahora.minutos < aMinutos(ayer.cierra)) {
      return { abierto: true, texto: "Abierto ahora · cierra a las " + horaBonita(ayer.cierra) };
    }
    if (hoy && !hoy.cerrado) {
      var abre = aMinutos(hoy.abre);
      var cierra = hoy.cruzaMedianoche ? 24 * 60 : aMinutos(hoy.cierra);
      if (ahora.minutos >= abre && ahora.minutos < cierra) {
        return { abierto: true, texto: "Abierto ahora · cierra a las " + horaBonita(hoy.cierra) };
      }
      if (ahora.minutos < abre) {
        return { abierto: false, texto: "Cerrado · abre hoy " + articuloHora(hoy.abre) + " " + horaBonita(hoy.abre) };
      }
    }
    // Ya cerró por hoy: se busca el próximo día que abra.
    for (var i = 1; i <= 7; i++) {
      var d = (ahora.dia + i) % 7;
      var h = horarios[CLAVES_DIA[d]];
      if (h && !h.cerrado) {
        var cuandoAbre = i === 1 ? "mañana" : "el " + NOMBRES_DIA[d];
        return { abierto: false, texto: "Cerrado · abre " + cuandoAbre + " " + articuloHora(h.abre) + " " + horaBonita(h.abre) };
      }
    }
    return { abierto: false, texto: "Cerrado" };
  }

  global.TuColitaHorario = {
    estado: estado,
    horaBonita: horaBonita,
    ahoraEnColombia: ahoraEnColombia,
    CLAVES_DIA: CLAVES_DIA
  };
})(typeof window !== "undefined" ? window : globalThis);

if (typeof module !== "undefined" && module.exports) {
  module.exports = (typeof window !== "undefined" ? window : globalThis).TuColitaHorario;
}
