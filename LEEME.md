# TU COLITA LOUNGE — Manual del sitio web

Este es el manual de tu página **tucolita.com**. Está escrito para ti, no para un programador. Guárdalo donde lo encuentres.

**Soporte:** Saenz Deluxe (quien te entregó este sitio).

---

## 1. Qué tienes

- **tucolita.com** — la página principal del negocio.
- **tucolita.com/menu.html** — la carta completa, con buscador y pedidos por WhatsApp.
- **tucolita.com/admin.html** — tu panel privado. Desde el celular editas la carta, los precios, las fotos y los textos, y los cambios salen a la web real en menos de un minuto. No hay que pagar hosting ni mensualidad: el sitio vive gratis en GitHub Pages.

Mientras el local no abra, la página muestra una **cortina de preapertura**: cuenta regresiva, un campo para que la gente deje su contacto, y una entrada con código para invitados.

**La apertura está puesta para el lunes 5 de octubre de 2026 a la 1:00 p.m.** Ese día y a esa hora la cortina **se quita sola**, sin que nadie toque nada.

---

## 2. Entrar al panel por primera vez

Necesitas un **token**: una clave larga que le da permiso al panel para editar el sitio. Se saca una vez al año.

1. Entra a **github.com/settings/personal-access-tokens** e inicia sesión con la cuenta dueña del sitio.
2. Toca el botón verde **"Generate new token"** y elige **"Fine-grained token"**.
3. En **"Token name"** escribe: `Panel Tu Colita`. En **"Expiration"** elige **1 año** y anota la fecha de vencimiento en el calendario del celular.
4. En **"Repository access"** marca **"Only select repositories"** y elige únicamente el repositorio del sitio.
5. Baja a **"Permissions"**, abre **"Repository permissions"**, busca **"Contents"** y ponlo en **"Read and write"**. No toques nada más.
6. Toca **"Generate token"** y copia el código que aparece. **Solo se muestra una vez.**
7. Abre **tucolita.com/admin.html**, pega el token, revisa que el repositorio esté bien escrito y toca **"Entrar"**.

Si marcas **"Recordar en este dispositivo"**, no tendrás que pegarlo de nuevo en ese celular. Si además pones un **PIN**, el token queda cifrado: es una barrera para que alguien con tu celular desbloqueado en la mano no entre al panel de una. **No es una caja fuerte** — si pierdes el celular, genera un token nuevo en GitHub y el viejo déjalo vencer o bórralo.

Cuando el token venza (al año), repites los pasos 1 a 7. Ya está.

---

## 3. El uso de todos los días

**Marcar algo como agotado** (lo que más vas a usar): pestaña **"Menú"** → busca el producto → toca el **interruptor** de su fila. Luego **"Publicar cambios"** arriba. En un minuto la carta lo muestra tachado y sin botón de pedir.

**Cambiar un precio o un texto:** pestaña "Menú" → botón del **lápiz** en el producto → corrige → **"Guardar en memoria"** → **"Publicar cambios"**.

**Producto nuevo:** botón **"+ Nuevo producto"**. Nombre, categoría, precio y listo. La descripción es opcional pero ayuda a vender: di qué trae, sin adornos.

**Foto de un producto:** al editar el producto, toca **"Foto"** — puedes tomarla ahí mismo con la cámara. El panel la comprime solo para que la página no se ponga pesada. Se sube cuando toques "Publicar cambios".

**Orden de productos y categorías:** con las flechas **↑ ↓** de cada fila.

**Importante:** todo lo que hagas queda primero **"en memoria"** (verás el contador en el botón de arriba: *"Publicar cambios (3)"*). **Nada sale a la web hasta que toques "Publicar cambios".** Si cierras sin publicar, el panel te avisa.

**Vista previa:** el botón **"Vista previa"** te abre la carta exactamente como quedaría, con una cinta roja de "sin publicar". Ideal para revisar antes de soltar los cambios.

**Respaldo:** de vez en cuando (y siempre antes de un cambio grande) toca **"Descargar respaldo"** en la pestaña Menú. Baja un archivo con toda la carta. Si un día algo se daña, **"Restaurar desde archivo"** con ese respaldo lo devuelve todo.

---

## 4. La cortina de preapertura

En la pestaña **"Preapertura"** del panel están:

- El interruptor **"Modo preapertura"** (encendido = cortina puesta).
- La **fecha y hora de apertura**. Al llegar ese momento la cortina se quita sola, sin que nadie toque nada.
- Los **textos** de la cortina.
- Los **códigos de invitado**.

### Una advertencia honesta

Esta cortina es **una cortina, no una cerradura**. El sitio se sirve desde GitHub Pages, que es público: alguien con conocimientos técnicos puede ver el contenido en el código fuente sin pasar la cortina. Sirve perfectamente para que un visitante normal no vea el sitio a medio terminar y para dar sensación de preestreno. **No sirve para guardar nada confidencial.** Eso fue lo que se compró y eso es lo que hace.

Lo mismo con el panel: `admin.html` está oculto de Google, pero **oculto no es protegido**. La protección real es el token, que solo tienes tú.

### Códigos de invitado

1. Pestaña Preapertura → escribe una etiqueta (`PRENSA`, `FAMILIA`, `PROVEEDORES`…) → **"Crear código"**.
2. El código aparece **una sola vez**. Tócale **"Copiar mensaje para WhatsApp"** y mándalo de una — no se vuelve a mostrar (solo se guarda una versión cifrada).
3. Para quitarle la entrada a alguien: botón de basura junto a su etiqueta → **"Publicar cambios"**.

### Nota técnica (por si un programador pregunta)

La fecha de apertura vive en dos lugares: en `datos/preapertura.json` (la que manda) y como respaldo dentro de `index.html` y `menu.html` para que la cortina aparezca sin parpadeo. Si cambias la fecha desde el panel, solo se actualiza el JSON: en el peor caso la cortina aparece medio segundo y se destapa sola. Si la apertura se aplaza mucho, pídele a Saenz Deluxe actualizar también la fecha de respaldo.

---

## 4-bis. El muro de fotos (Padlet)

El muro va embebido en la página de inicio y funciona solo. Un detalle de presentación: por defecto el Padlet viene con fondo amarillo y desentona con el negro y dorado del sitio.

Para que combine, entra a tu Padlet, toca el ícono de **engranaje** (Configuración) → **"Fondo de pantalla"** (Wallpaper) y elige uno oscuro o un color liso negro. El sitio se ve mucho mejor así. No es obligatorio: el muro funciona igual.

---

## 5. Los contactos que deja la gente

La cortina invita a dejar **correo o WhatsApp** a cambio de ver la carta. Esos datos caen en una hoja de cálculo tuya (Google Sheets). Para activarlo hay que hacer esto **una sola vez** (pídele ayuda a Saenz Deluxe si prefieres):

### Opción A — Google Apps Script (gratis, recomendada)

1. Entra a **sheets.google.com** con tu cuenta de Google y crea una hoja nueva llamada `Contactos Tu Colita`.
2. En la primera fila escribe estos títulos, uno por columna: `fecha`, `contacto`, `tipo`, `origen`, `utm_source`, `utm_medium`, `utm_campaign`.
3. En el menú de la hoja: **Extensiones → Apps Script**. Borra lo que aparezca y pega esto:

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

4. Toca **"Implementar" → "Nueva implementación"**. En el engranaje elige **"Aplicación web"**. En **"Quién tiene acceso"** elige **"Cualquier persona"**. Toca **"Implementar"** y autoriza con tu cuenta.
5. Copia la **URL de la aplicación web** (termina en `/exec`).
6. En el panel → pestaña **"Preapertura"** → pégala en **"Dirección de captación de contactos"** → **"Guardar en memoria"** → **"Publicar cambios"**.

Desde ese momento, cada contacto cae en tu hoja, y la pestaña **"Contactos"** del panel los muestra y te deja **descargar el CSV** para la campaña de lanzamiento.

### Opción B — Formspree (si no quieres tocar Apps Script)

1. Crea una cuenta gratis en **formspree.io** y crea un formulario nuevo.
2. Copia la dirección que te da (algo como `https://formspree.io/f/abcdwxyz`).
3. Pégala en el mismo campo del panel y publica.

Con Formspree los contactos llegan a esa plataforma y a tu correo; la pestaña "Contactos" del panel no podrá listarlos (eso solo funciona con la Opción A).

**Cumple lo prometido:** bajo el campo dice *"Solo lo usamos para avisarte de la apertura."* Usa la lista para avisar de la apertura, no la revendas ni la satures.

---

## 6. El día de la apertura

Casi todo pasa solo. La lista completa:

1. **Verificar que la cortina ya no aparece** (ábrelo en modo incógnito del navegador).
2. **Quitar el `noindex` del menú:** pídele a Saenz Deluxe borrar la línea `<meta name="robots" content="noindex">` de `menu.html`, para que Google empiece a mostrar la carta.
3. **Apagar el interruptor "Modo preapertura"** en el panel y publicar.
4. **Descargar el CSV de contactos** y mandar el mensaje de apertura a todos los que dejaron su dato.

---

## 7. Cómo se publica el sitio (referencia técnica)

Esto ya debería estar hecho; queda anotado por si hay que rehacerlo.

- El sitio vive en un repositorio de GitHub, rama `main`, con **GitHub Pages** sirviendo desde la raíz.
- El archivo `CNAME` contiene una sola línea: `tucolita.com`.
- En el registrador del dominio **tucolita.com**:
  - Registros **A** de la raíz: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
  - Registros **AAAA** (opcional): `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`.
  - Registro **CNAME** de `www` apuntando a `usuario.github.io` (el usuario dueño del repositorio).
- En GitHub → **Settings → Pages**: escribir el dominio `tucolita.com`, esperar la verificación y activar **"Enforce HTTPS"**.

**¿Hosting de pago?** No hace falta. Un hosting tipo Hostinger solo sería necesario si algún día se quiere un backend real: pedidos en línea con pago, reservas con base de datos, cuentas de usuarios. Ese día se conversa; hoy no aplica.

---

## 8. Pendientes por confirmar (están provisionales)

- **Cobertura de domicilios** — si se limita a ciertos barrios, hay que decirlo en la página.
- **Vigencia de la carta nueva** — la línea "precios vigentes desde…" del pie del menú se edita en la pestaña Negocio.
- **Precio de la Coca-Cola 1,5 L y bebidas sin precio confirmado** — quedaron con el precio sugerido del inventario; se corrigen en dos toques desde el panel.

---

## 9. Si algo sale mal

| Qué pasa | Qué hacer |
|---|---|
| "El token no sirve" | Casi siempre está vencido. Genera uno nuevo (sección 2). |
| "Alguien publicó cambios desde otro dispositivo" | Otro celular publicó mientras editabas. Elige **recargar** para ver lo último; tus cambios en memoria se repiten después. Solo **fuerza** tus cambios si estás seguro de que lo tuyo es lo bueno. |
| Se dañó el menú | Pestaña Menú → **"Restaurar desde archivo"** con el último respaldo. |
| La web no se actualiza | Espera dos minutos, abre en modo incógnito. Si sigue igual, escribe a Saenz Deluxe. |
| Perdiste el celular con el panel recordado | Entra a GitHub → Settings → Personal access tokens → borra el token `Panel Tu Colita`. El panel de ese celular queda muerto al instante. |
