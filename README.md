# NexNord — Sistema de entrega automática

Automatiza por completo lo que hoy haces a mano: el jugador paga en PayPal
escribiendo su nick de Minecraft, y su rango o sus coins se entregan solos
en el servidor, sin pasar por un ticket de Discord.

## Cómo fluye una compra

```
 Jugador paga en tu           PayPal envía un          Este servicio de Node
 Payment Link y escribe   →   webhook firmado      →   verifica la firma,
 su nick en la nota           a tu dominio              identifica el producto
                                                          y el nick
                                                               │
                                                               ▼
                                                     Llama al plugin de
                                                     Minecraft por HTTP
                                                     interno (con token
                                                     secreto)
                                                               │
                                                               ▼
                                                     El plugin ejecuta
                                                     "lp user X parent add
                                                     knight" / "eco give
                                                     X 500" y anuncia la
                                                     compra en el chat
```

## Las dos piezas

1. **`webhook-service/`** — un pequeño servidor Node.js que vive en un VPS con
   dominio y HTTPS. Escucha a PayPal, verifica que el webhook sea legítimo
   (nunca confía en una llamada sin verificar — así nadie puede fingir una
   compra), identifica qué se compró y quién lo compró, y evita procesar
   la misma compra dos veces.

2. **`minecraft-plugin/`** — un plugin de Paper/Spigot que corre dentro de tu
   servidor. Expone un endpoint interno protegido por un token secreto;
   cuando el webhook le avisa, ejecuta los comandos de LuckPerms/economía
   correspondientes y anuncia la compra en el chat.

## Orden recomendado para ponerlo en marcha

1. Compila e instala el plugin (`minecraft-plugin/README.md`).
2. Sube y configura el servicio webhook en tu VPS con HTTPS (`webhook-service/README.md`).
3. Activa la nota del comprador en tus 6 Payment Links de PayPal y crea el webhook en el Developer Dashboard.
4. Haz una compra de prueba (o usa el simulador de webhooks de PayPal) antes de anunciarlo a los jugadores.
5. Una vez confirmado que funciona, puedes simplificar el paso del ticket de Discord a solo un canal de "logs de compras" (ya lo dejé conectado opcionalmente vía `DISCORD_LOG_WEBHOOK_URL`), en vez de que el staff tenga que entregar nada a mano.

## Qué NO cambia

Tu web (`nexnord.html`) sigue funcionando exactamente igual — los mismos
6 botones de PayPal. Lo único que cambia es que, en vez de que el
jugador tenga que abrir un ticket con una captura, el sistema detecta el
pago solo. Aun así, te recomiendo dejar el canal de tickets como
respaldo por si algún pago llega sin nick legible (el sistema te avisa
por Discord cuando eso pasa, para que lo resuelvas a mano ese caso puntual).
