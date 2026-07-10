# NexNordDelivery (plugin de Paper/Spigot)

Recibe una orden interna del servicio webhook y entrega el rango o los coins
en el juego, sin que nadie tenga que escribir un comando a mano.

## 1. Compilar

Necesitas Java 17+ y Maven instalados en **tu propia máquina** (no en este chat,
ya que aquí no tengo acceso al repositorio de PaperMC para descargar dependencias).

```bash
cd minecraft-plugin
mvn clean package
```

Esto genera `target/NexNordDelivery-1.0.0.jar`.

> Si tu servidor no es 1.20.4, cambia la versión de `paper-api` en `pom.xml` a la de tu versión (ej. `1.21.1-R0.1-SNAPSHOT`). El código no usa nada específico de una versión, así que funciona igual en la mayoría de versiones recientes.

## 2. Instalar

1. Copia el `.jar` a la carpeta `plugins/` de tu servidor.
2. Asegúrate de tener **LuckPerms** instalado (para los rangos) y un plugin de economía compatible con **Vault** (Essentials, CMI, etc.) para los coins — ya los tienes, según nos comentaste.
3. Inicia el servidor una vez para que se genere `plugins/NexNordDelivery/config.yml`.
4. Edita ese `config.yml`:
   - `secret-token`: pon un texto largo y aleatorio (ej. genera uno en https://www.random.org/strings/). Debe ser **idéntico** al `MC_DELIVERY_SECRET` del `.env` del servicio webhook.
   - `bind-address`: déjalo en `127.0.0.1` si el servicio webhook corre en la misma máquina (recomendado). Si corre en otra máquina, ver nota de seguridad abajo.
   - Revisa que los comandos de `products` coincidan con los nombres reales de tus grupos en LuckPerms (`lp listgroups` para verlos) y el comando de tu plugin de economía para dar dinero (el ejemplo usa `eco give {player} 500`, típico de Essentials/Vault; ajústalo si tu plugin usa otra sintaxis).
5. `/nexnorddelivery reload` para recargar sin reiniciar el servidor.

## 3. Seguridad si el webhook corre en OTRA máquina

Si el servicio de Node.js no está en el mismo servidor que Minecraft:

- Cambia `bind-address` a `0.0.0.0`.
- **Obligatorio:** configura el firewall (ej. `ufw`) para que el puerto 8099 solo acepte conexiones desde la IP fija de tu VPS del webhook, nunca abierto al público.
- Considera además un túnel SSH o una VPN entre ambas máquinas en vez de exponer el puerto directamente.

## 4. Cómo funciona por dentro

- Levanta un mini servidor HTTP (usa una librería incluida en el propio Java, no añade dependencias raras) que escucha `POST /deliver`.
- Verifica un token secreto en el header `Authorization` — si no coincide, rechaza la petición.
- Valida que el nick recibido tenga el formato válido de Minecraft antes de usarlo en cualquier comando.
- Ejecuta los comandos configurados como si los escribiera la consola del servidor.
- Guarda cada entrega en `delivered.yml` para no repetir la misma compra dos veces, incluso si el webhook llega duplicado.
- Manda un anuncio público configurable (`&6¡Jugador ha comprado King!`) — puedes dejarlo vacío si no quieres el anuncio.

## 5. Probar sin comprar nada

Con el servidor encendido y el plugin cargado, prueba desde tu propia máquina:

```bash
curl -X POST http://127.0.0.1:8099/deliver \
  -H "Authorization: Bearer TU_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"player":"TuNickDePrueba","productId":"knight","transactionId":"test-123"}'
```

Deberías ver el rango aplicado y el anuncio en el chat del servidor.
