# NexNord Webhook Service

Recibe la confirmación de pago de PayPal y le ordena al plugin de Minecraft
que entregue el rango o los coins automáticamente.

## 1. Requisitos

- Un VPS (puede ser el mismo donde corre tu servidor de Minecraft) con Node.js 18+.
- Un dominio o subdominio con HTTPS apuntando a este servicio (ej. `https://pagos.tudominio.com`),
  usando Nginx/Caddy como proxy inverso. **PayPal exige HTTPS válido para los webhooks.**

## 2. Instalación

```bash
npm install
cp .env.example .env
```

Edita `.env` con tus datos (ver pasos 3 y 4 abajo).

## 3. Crear tu App REST de PayPal

1. Entra a https://developer.paypal.com/dashboard/applications y crea una app **Live** (o Sandbox para probar).
2. Copia el **Client ID** y **Secret** a `PAYPAL_CLIENT_ID` y `PAYPAL_CLIENT_SECRET` en tu `.env`.

## 4. Crear el Webhook

1. En esa misma app, ve a la sección **Webhooks** → **Add Webhook**.
2. URL del webhook: `https://TU-DOMINIO/webhooks/paypal`
3. Eventos a marcar: como mínimo `Payment capture completed` (`PAYMENT.CAPTURE.COMPLETED`).
   También puedes marcar `Checkout order approved` por si acaso.
4. Guarda y copia el **Webhook ID** generado → pégalo en `PAYPAL_WEBHOOK_ID`.

## 5. Cómo se identifica al comprador (sin depender de una nota de PayPal)

PayPal quitó el campo de "nota del comprador" en su checkout nuevo, así que en vez de
depender de eso, la propia web (`nexnord.html`) le pide al jugador su **nick de
Minecraft y el correo con el que va a pagar** en un formulario, ANTES de mandarlo
a PayPal. Ese dato se guarda temporalmente aquí (`POST /claim/start`), y cuando
llega el webhook de pago completado, se busca ese mismo correo para saber a
quién entregarle la compra.

Solo dos cosas que revisar de tu lado:

1. En `nexnord.html`, la constante `WEBHOOK_BASE` debe apuntar a la URL pública
   de este servicio una vez desplegado (ej. `https://plugin-web.onrender.com`).
2. El **nombre del producto** en cada Payment Link de PayPal debe contener la
   palabra clave del rango (ej. el link de Knight debe llamarse algo como
   "Rango Knight — NexNord"), porque así es como este servicio identifica qué
   se compró. Revisa/edita `products.json` si cambias los nombres.

> ⚠️ El campo exacto donde PayPal pone el correo del comprador puede variar
> según el tipo de evento. La primera vez que llegue una compra (real o de
> prueba), el servicio guarda el payload completo en `data/raw-events/`. Si
> ves en los logs "no se encontró el nick", abre ese archivo, busca el correo
> del comprador dentro del JSON, y ajusta `extractPayerEmail()` en
> `src/index.js` con la ruta correcta.
>
> Si un pago llega sin que hubiera un claim previo (por ejemplo alguien pagó
> directo con un link viejo guardado), el sistema no inventa nada: manda un
> aviso a Discord con el correo del pagador para que el staff lo resuelva a
> mano ese caso puntual — el ticket de Discord sigue siendo un buen respaldo.

## 6. Configurar la conexión al plugin de Minecraft

- `MC_DELIVERY_URL`: por defecto `http://127.0.0.1:8099/deliver` si este servicio corre en la misma máquina que el servidor de Minecraft.
- `MC_DELIVERY_SECRET`: debe ser **idéntico** al `secret-token` del `config.yml` del plugin (carpeta `minecraft-plugin/`).

## 7. Ejecutar

```bash
npm start
```

Para producción, usa un gestor de procesos como PM2 para que se reinicie solo:

```bash
npm install -g pm2
pm2 start src/index.js --name nexnord-webhook
pm2 save
```

## 8. Probar sin gastar dinero real

Usa el **Webhooks Simulator** de PayPal Developer Dashboard (dentro de tu app → pestaña Webhooks → "Simulate Webhook Event") para enviar un evento de prueba `PAYMENT.CAPTURE.COMPLETED` a tu URL y verificar que todo el flujo responde bien antes de anunciar la tienda.

## Estructura

```
src/index.js      → servidor Express, recibe y procesa los webhooks
src/paypal.js      → verificación de firma + token OAuth de PayPal
src/ledger.js      → evita procesar dos veces la misma transacción
src/mcClient.js    → llama al plugin de Minecraft para entregar
src/discordLog.js  → (opcional) manda un log de cada compra a un canal de Discord
products.json      → mapa de qué palabra clave = qué producto
```
