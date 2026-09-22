# TU COLITA LOUNGE — Manual del sitio

Manual de **tucolita.com**, escrito para el dueño del negocio. Guárdalo donde lo encuentres.

**Soporte:** Saenz Deluxe.

---

## 1. Qué tienes

- **tucolita.com** — la portada del negocio.
- **tucolita.com/menu.html** — la carta completa, con buscador, filtros, modo noche/tarde y pedidos por WhatsApp. Trae el botón **"Elegí por mí"**, que le saca un plato al azar al que no se decide: solo cocina y cocteles, nunca una gaseosa ni algo marcado como agotado.
- **El panel** — desde el celular editas la carta, los precios, las fotos y los textos, y los cambios salen a la web real en menos de un minuto. No hay hosting que pagar ni mensualidad.

Mientras el local no abra, la gente ve una **cortina de preapertura**: cuenta regresiva, un campo para dejar el contacto y una entrada con código para invitados.

**La apertura está puesta para el lunes 5 de octubre de 2026 a la 1:00 p.m.** Ese día y a esa hora la cortina se quita sola y la portada pasa a modo normal, sin que nadie toque nada.

---

## 2. Entrar al panel

Al final de la portada, abajo del todo, hay un botón que dice **"Admin"**. Pide una clave.

**Clave:** `colita2026`

Cámbiala apenas puedas (sección 8).

La primera vez que entres desde un celular nuevo, el panel te pide una sola vez un **código de conexión**. Es lo que le da permiso para escribir en el sitio. Se saca así:

1. Entra a **github.com/settings/personal-access-tokens** con la cuenta dueña del sitio.
2. Botón **"Generate new token"** → **"Fine-grained token"**.
3. Nombre: `Panel Tu Colita`. Vencimiento: **1 año**. Anota la fecha en el calendario.
4. **Repository access** → **Only select repositories** → elige el repositorio del sitio.
5. **Permissions → Repository permissions → Contents** → **Read and write**. Nada más.
6. **Generate token**, copia el código (solo se ve una vez) y pégalo en el panel.

Ese código queda guardado y **cifrado con tu clave** en ese celular. De ahí en adelante entras solo con la clave. Si alguien roba el celular, sin la clave no puede sacarlo.

El panel se cierra solo si lo dejas quieto veinte minutos.

### Qué protege qué

- La **clave** esconde el enlace para que nadie entre por curiosidad. Es una cortina, no una cerradura: alguien con conocimientos técnicos puede llegar a la dirección del panel sin ella.
- El **código de conexión** es lo que de verdad protege el sitio. Sin él no se puede cambiar ni una coma, aunque alguien llegue al panel. Cuídalo como cuidas la clave del banco.
- Si pierdes el celular: entra a GitHub → Settings → Personal access tokens → borra el token `Panel Tu Colita`. Ese celular queda inútil al instante.

---

## 3. El uso de todos los días

El panel abre en **Productos**: todos los productos en cuadritos, como en una caja registradora.

**Marcar algo agotado** (lo que más vas a usar): busca el producto y toca el interruptor de su cuadrito. Queda en "Agotado". Luego **"Publicar"** en la barra de abajo.

**Cambiar precio, nombre, descripción o foto:** toca el cuadrito del producto, corrige y **"Guardar"**. Después **"Publicar"**.

**Producto nuevo:** botón **"Agregar"** arriba a la derecha.

**Eliminar:** entra al producto y toca **"Eliminar"**.

**Foto:** dentro del producto, toca "Foto". Puedes tomarla ahí mismo con la cámara; el panel la comprime solo.

**Filtrar:** las pastillas de arriba filtran por categoría. El buscador encuentra sin importar tildes.

**Importante:** lo que editas queda guardado en el celular hasta que tocas **"Publicar"**. La barra de abajo te dice cuántos cambios llevas sin publicar. Si cierras sin publicar, el panel te avisa.

**Vista previa:** el botón te abre la carta tal como quedaría, con una cinta que dice "sin publicar".

**Respaldo:** de vez en cuando, y siempre antes de un cambio grande, toca **"Descargar respaldo"**. Si un día algo se daña, **"Restaurar respaldo"** con ese archivo lo devuelve todo.

---

## 4. La cortina de preapertura

En la pestaña **Apertura** del panel están el interruptor de la cortina, la fecha y hora de apertura, los textos y los códigos de invitado.

### Códigos de invitado

Ya hay dos creados:

| Código | Para quién |
|---|---|
| `TUCOLITA` | Invitados en general |
| `PRENSA26` | Prensa |

Quien lo tenga entra a tucolita.com, toca **"Tengo un código"** y lo escribe. No importa si lo escribe en minúsculas o con espacios.

Para crear más: pestaña Apertura → escribe una etiqueta (FAMILIA, PROVEEDORES…) → **"Crear"**. El código aparece **una sola vez**; cópialo de una con el botón que arma el mensaje de WhatsApp. Para quitarle la entrada a alguien, toca la basura junto a su etiqueta y publica.

### Una advertencia honesta

Esta cortina es **una cortina, no una cerradura**. El sitio es público: alguien con conocimientos técnicos puede ver el contenido en el código fuente sin pasar. Sirve para que un visitante normal no vea el sitio a medio terminar y para dar sensación de preestreno. **No sirve para guardar nada confidencial.**

### Nota técnica

La fecha de apertura vive en `datos/preapertura.json` (la que manda) y como respaldo dentro de `index.html` y `menu.html`, para que la cortina aparezca sin parpadeo. Si cambias la fecha desde el panel, en el peor caso la cortina se asoma medio segundo y se quita sola. Si la apertura se aplaza mucho, pide que actualicen también esa fecha de respaldo.

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
6. Panel → pestaña **Apertura** → pégala en "Dirección para recibir contactos" → **Guardar** → **Publicar**.

Desde ahí, cada contacto cae en tu hoja y la pestaña **Contactos** del panel los muestra y te deja **descargar el CSV**.

Si el visitante deja el dato y no hay internet, entra igual y el dato queda en cola: se manda solo en su próxima visita.

**Cumple lo prometido:** debajo del campo dice *"Solo lo usamos para avisarte de la apertura."*

---

## 7. El día de la apertura

Casi todo pasa solo:

1. Verificar que la cortina ya no aparece (ábrelo en una pestaña de incógnito).
2. Quitar el `noindex` de `menu.html` para que Google empiece a mostrar la carta. Eso lo hace Saenz Deluxe en un minuto.
3. Apagar el interruptor de la cortina en el panel y publicar.
4. Descargar el CSV de contactos y mandar el mensaje de apertura.

---

## 8. Cambiar la clave

Panel → pestaña **Ayuda** → **"Cambiar la clave"**. Escribe la clave nueva y toca **Generar**: te da un texto largo y lo copia solo.

Ese texto hay que pegarlo en el archivo `datos/negocio.json`, en el campo `adminHash`, reemplazando lo que haya. Si no quieres tocar archivos, pásaselo a Saenz Deluxe y lo cambia.

La clave no se guarda escrita en ninguna parte: lo que se guarda es esa huella, que no se puede devolver a la clave original.

---

## 9. Cómo se publica el sitio (referencia técnica)

- Repositorio de GitHub, rama `main`, **GitHub Pages** sirviendo desde la raíz.
- El archivo `CNAME` contiene una sola línea: `tucolita.com`.
- DNS de **tucolita.com**:
  - Registros **A** de la raíz: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
  - Registros **AAAA** (opcional): `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`.
  - **CNAME** de `www` → `usuario.github.io`.
- GitHub → **Settings → Pages**: escribir el dominio, esperar la verificación y activar **Enforce HTTPS**.

**¿Hosting de pago?** No hace falta. Solo lo sería si algún día se quiere un backend real: pedidos en línea con pago, reservas con base de datos, cuentas de usuario. Ese día se conversa.

---

## 10. Pendientes por confirmar

- **Cobertura de domicilios** — si se limita a ciertos barrios, hay que decirlo en la página.
- **Vigencia de la carta nueva** — la línea del pie del menú se edita en la pestaña Negocio.
- **Precio de la Coca-Cola 1,5 L** y de las bebidas que no estaban en la carta vieja: quedaron con el precio sugerido del inventario. Se corrigen en dos toques desde el panel.

---

## 11. Si algo sale mal

| Qué pasa | Qué hacer |
|---|---|
| "El código de conexión no sirve" | Se venció. Genera uno nuevo con los pasos de la sección 2. |
| "Alguien publicó desde otro dispositivo" | Otro celular publicó mientras editabas. Elige traer lo último y repite tus cambios. Solo publica los tuyos encima si estás seguro. |
| Se dañó la carta | Pestaña Productos → "Restaurar respaldo" con el último archivo descargado. |
| La web no se actualiza | Espera dos minutos y abre en una pestaña de incógnito. |
| Se cerró el panel solo | Pasaron veinte minutos sin tocarlo. Entra otra vez con la clave. |
| Perdiste el celular | GitHub → Settings → Personal access tokens → borra `Panel Tu Colita`. |
