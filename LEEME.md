# TU COLITA LOUNGE — Manual del sitio

Manual de **tucolita.com**, escrito para el dueño del negocio. Guárdalo donde lo encuentres.

**Soporte:** Saenz Deluxe.

---

## 1. Qué tienes

- **tucolita.com** — la portada del negocio.
- **tucolita.com/menu.html** — la carta completa, con buscador, filtros, modo noche/tarde y pedidos por WhatsApp. Trae el botón **"Elegí por mí"**, que le saca un plato al azar al que no se decide: solo cocina y cocteles, nunca una gaseosa ni algo marcado como agotado.
- **El panel** — con usuario y contraseña, desde cualquier celular, editas la carta, los precios, las fotos y los agotados, y los cambios salen en la web en segundos.

Mientras el local no abra, la gente ve una **cortina de preapertura**: cuenta regresiva, un campo para dejar el contacto y una entrada con código para invitados.

**La apertura está puesta para el lunes 5 de octubre de 2026 a la 1:00 p.m.** Ese día y a esa hora la cortina se quita sola y la portada pasa a modo normal, sin que nadie toque nada.

---

## 2. Entrar al panel

La carta se edita en el **panel de Saenz Deluxe**: **https://panel.saenzdeluxe.site** (también desde el botón **"Admin"** al final de la portada).

- Entras con tu **correo y contraseña**. Para tenerlo a mano en el celular: ábrelo en el navegador → menú → **"Agregar a pantalla de inicio"**.
- Si olvidas la contraseña, pídele a Saenz Deluxe que te la cambie (o cámbiala tú en **Más → Mi cuenta**).
- Puedes darle acceso a tu equipo en **Más → Equipo**: el **Editor** solo cambia productos, precios y agotados; el **Administrador** maneja todo.
- Todo lo que cambias queda en **Más → Historial**: quién cambió qué y cuándo.

---

## 3. El uso de todos los días

**Marcar algo agotado** (lo que más vas a usar): en **Productos**, toca el interruptor del producto. Sale como "Agotado" en la web **en segundos**. No hay botón de publicar.

**Cambiar precio, nombre, descripción o foto:** toca el producto, corrige y **"Guardar"**.

**Foto:** dentro del producto, **"Tomar foto"** o **"Galería"**. El panel la comprime sola.

**Producto nuevo:** botón **"+ Producto"** abajo a la derecha.

**Categorías y orden:** en **Categorías**, arrastra ⋮⋮ para ordenar y usa el interruptor para ocultar una categoría completa.

**Etiquetas** ("favorito", "para compartir"…): **Más → Etiquetas**.

**Respaldo:** el servidor guarda una copia completa todos los días.

---

## 4. La cortina de preapertura

La apertura ya pasó (5 de octubre de 2026) y la cortina se quitó sola. Si algún día se necesita otra vez (por ejemplo, una remodelación), pídesela a Saenz Deluxe: la fecha y los textos viven en `datos/preapertura.json`.

### Códigos de invitado

Ya hay dos creados, uno para invitados y otro para prensa. Los códigos se entregan en privado: aquí solo se guarda una huella de cada uno, nunca el código.

Quien lo tenga entra a tucolita.com, toca **"Tengo un código"** y lo escribe. No importa si lo escribe en minúsculas o con espacios.

Para crear o quitar códigos, pídeselo a Saenz Deluxe.

### Una advertencia honesta

Esta cortina es **una cortina, no una cerradura**. El sitio es público: alguien con conocimientos técnicos puede ver el contenido en el código fuente sin pasar. Sirve para que un visitante normal no vea el sitio a medio terminar y para dar sensación de preestreno. **No sirve para guardar nada confidencial.**

### Nota técnica

La fecha de apertura vive en `datos/preapertura.json` (la que manda) y como respaldo dentro de `index.html` y `menu.html`, para que la cortina aparezca sin parpadeo. 
---

## 5. El muro de fotos (Padlet)

El muro va embebido en la portada y funciona solo. Un detalle: por defecto el Padlet viene con fondo amarillo y desentona con el negro y dorado.

Para que combine: entra a tu Padlet → ícono de **engranaje** → **"Fondo de pantalla"** → elige uno oscuro. No es obligatorio.

---

## 6. Los contactos que deja la gente

La cortina invita a dejar correo o WhatsApp a cambio de ver la carta. Para que esos datos caigan en una hoja tuya, hay que hacer esto **una sola vez**:

1. Entra a **sheets.google.com** y crea una hoja llamada `Contactos Tu Colita`.
2. En la primera fila escribe estos títulos, uno por columna: `fecha`, `contacto`, `tipo`, `origen`, `utm_source`, `utm_medium`, `utm_campaign`.
3. Menú **Extensiones → Apps Script**. Borra lo que haya y pega esto:

```javascript
function doPost(e) {
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var p = e.parameter;
  hoja.appendRow([
    p.fecha || new Date().toISOString(), p.contacto || "", p.tipo || "",
    p.origen || "", p.utm_source || "", p.utm_medium || "", p.utm_campaign || ""
  ]);
  return ContentService.createTextOutput("ok");
}

function doGet(e) {
  if (!e.parameter || e.parameter.listar !== "1") {
    return ContentService.createTextOutput("Tu Colita");
  }
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var filas = hoja.getDataRange().getValues();
  var salida = filas.slice(1).map(function (f) {
    return { fecha: f[0], contacto: f[1], tipo: f[2], origen: f[3],
             utm_source: f[4], utm_medium: f[5], utm_campaign: f[6] };
  });
  return ContentService.createTextOutput(JSON.stringify(salida))
    .setMimeType(ContentService.MimeType.JSON);
}
```

4. **"Implementar" → "Nueva implementación"**. En el engranaje elige **"Aplicación web"**. En **"Quién tiene acceso"** elige **"Cualquier persona"**. Implementa y autoriza.
5. Copia la **URL** (termina en `/exec`).
6. Pásale esa URL a Saenz Deluxe para conectarla.

Desde ahí, cada contacto cae en tu hoja de Google: ábrela para verlos o descárgala como CSV (**Archivo → Descargar**).

Si el visitante deja el dato y no hay internet, entra igual y el dato queda en cola: se manda solo en su próxima visita.

**Cumple lo prometido:** debajo del campo dice *"Solo lo usamos para avisarte de la apertura."*

---

## 7. El día de la apertura

Casi todo pasa solo:

1. Verificar que la cortina ya no aparece (ábrelo en una pestaña de incógnito).
2. Quitar el `noindex` de `menu.html` para que Google empiece a mostrar la carta. Eso lo hace Saenz Deluxe en un minuto.
3. Descargar la hoja de contactos y mandar el mensaje de apertura.

---

## 8. Cambiar usuario o contraseña

En el panel: **Más → Mi cuenta → Cambiar contraseña**. Para cambiar el correo de acceso, pídeselo a Saenz Deluxe.

---

## 9. Cómo se publica el sitio (referencia técnica)

- El código vive en GitHub (rama `main`). La VPS de Saenz Deluxe (Hostinger, Docker + Traefik) lo descarga y lo sirve en **tucolita.com** con HTTPS.
- La **carta** no está en el código: `js/menu.js` la lee del panel (`menu_publico` de Supabase, vía `https://panel.saenzdeluxe.site/menu.js`) y se actualiza sola. `datos/menu.json` queda solo como **respaldo** si el panel no responde.
- Horarios y textos de la portada siguen en `datos/negocio.json`.

---

## 10. Pendientes por confirmar

- **Cobertura de domicilios** — si se limita a ciertos barrios, hay que decirlo en la página.
- **Vigencia de la carta nueva** — la línea del pie del menú está en `datos/menu.json`; pídele el cambio a Saenz Deluxe.
- **Precio de la Coca-Cola 1,5 L** y de las bebidas que no estaban en la carta vieja: quedaron con el precio sugerido del inventario. Se corrigen en dos toques desde el panel.

---

## 11. Si algo sale mal

| Qué pasa | Qué hacer |
|---|---|
| Un cambio no aparece en la web | Recarga la página. Si sigue igual, revisa en el panel que el producto y su categoría estén visibles. |
| No puedo entrar al panel | Pide a Saenz Deluxe que te cambie la contraseña. |
| Se dañó la carta | Pestaña Productos → "Restaurar respaldo" con el último archivo descargado. |
| La web no se actualiza | Espera dos minutos y abre en una pestaña de incógnito. |
| Crees que alguien sabe la contraseña | Cámbiala (sección 8). Si además sospechas que entró, borra el permiso en GitHub (sección 2). |
