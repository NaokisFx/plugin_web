package com.nexnord.delivery;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.bukkit.Bukkit;
import org.bukkit.ChatColor;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.regex.Pattern;

public class NexNordDelivery extends JavaPlugin {

    // Nick de Minecraft valido: 3-16 caracteres, letras/numeros/guion bajo.
    // Cualquier otra cosa se rechaza ANTES de tocar un comando de consola.
    private static final Pattern NICK_PATTERN = Pattern.compile("^[A-Za-z0-9_]{3,16}$");

    private HttpServer httpServer;
    private DeliveryLedger ledger;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        ledger = new DeliveryLedger(this);

        try {
            startHttpServer();
            getLogger().info("Servidor de entregas escuchando en " +
                    getConfig().getString("bind-address") + ":" + getConfig().getInt("port"));
        } catch (IOException e) {
            getLogger().severe("No se pudo iniciar el servidor HTTP de entregas: " + e.getMessage());
        }
    }

    @Override
    public void onDisable() {
        if (httpServer != null) {
            httpServer.stop(0);
        }
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (args.length > 0 && args[0].equalsIgnoreCase("reload")) {
            reloadConfig();
            sender.sendMessage(ChatColor.AQUA + "[NexNordDelivery] Configuracion recargada.");
            return true;
        }
        sender.sendMessage(ChatColor.AQUA + "[NexNordDelivery] Uso: /nexnorddelivery reload");
        return true;
    }

    private void startHttpServer() throws IOException {
        String bind = getConfig().getString("bind-address", "127.0.0.1");
        int port = getConfig().getInt("port", 8099);

        httpServer = HttpServer.create(new InetSocketAddress(bind, port), 0);
        httpServer.createContext("/deliver", this::handleDeliver);
        httpServer.createContext("/health", exchange -> respond(exchange, 200, "{\"status\":\"ok\"}"));
        httpServer.setExecutor(null); // executor por defecto, suficiente para este volumen
        httpServer.start();
    }

    private void handleDeliver(HttpExchange exchange) throws IOException {
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            respond(exchange, 405, "{\"error\":\"method not allowed\"}");
            return;
        }

        String auth = exchange.getRequestHeaders().getFirst("Authorization");
        String expected = "Bearer " + getConfig().getString("secret-token", "");
        if (auth == null || !auth.equals(expected)) {
            getLogger().warning("Intento de entrega con token invalido desde " + exchange.getRemoteAddress());
            respond(exchange, 401, "{\"error\":\"unauthorized\"}");
            return;
        }

        JsonObject body;
        try (InputStream is = exchange.getRequestBody()) {
            String raw = new String(is.readAllBytes(), StandardCharsets.UTF_8);
            body = new Gson().fromJson(raw, JsonObject.class);
        } catch (Exception e) {
            respond(exchange, 400, "{\"error\":\"invalid json\"}");
            return;
        }

        if (body == null || !body.has("player") || !body.has("productId")) {
            respond(exchange, 400, "{\"error\":\"missing player or productId\"}");
            return;
        }

        String player = body.get("player").getAsString();
        String productId = body.get("productId").getAsString();
        String transactionId = body.has("transactionId") ? body.get("transactionId").getAsString() : null;

        if (!NICK_PATTERN.matcher(player).matches()) {
            respond(exchange, 400, "{\"error\":\"invalid minecraft nickname\"}");
            return;
        }

        if (transactionId != null && ledger.alreadyDelivered(transactionId)) {
            getLogger().info("Transaccion " + transactionId + " ya fue entregada antes, se ignora.");
            respond(exchange, 200, "{\"status\":\"already_delivered\"}");
            return;
        }

        ConfigurationSection productsSection = getConfig().getConfigurationSection("products");
        ConfigurationSection product = productsSection != null ? productsSection.getConfigurationSection(productId) : null;

        if (product == null) {
            getLogger().warning("productId desconocido recibido: " + productId);
            respond(exchange, 404, "{\"error\":\"unknown productId\"}");
            return;
        }

        List<String> commands = product.getStringList("commands");
        String broadcast = product.getString("broadcast", "");

        // Los comandos deben correr en el hilo principal del servidor.
        Bukkit.getScheduler().runTask(this, () -> {
            for (String rawCommand : commands) {
                String finalCommand = rawCommand.replace("{player}", player);
                Bukkit.dispatchCommand(Bukkit.getConsoleSender(), finalCommand);
            }
            if (broadcast != null && !broadcast.isEmpty()) {
                Bukkit.broadcastMessage(ChatColor.translateAlternateColorCodes('&',
                        broadcast.replace("{player}", player)));
            }
            if (transactionId != null) {
                ledger.markDelivered(transactionId, player, productId);
            }
            getLogger().info("Entregado '" + productId + "' a " + player);
        });

        respond(exchange, 200, "{\"status\":\"delivered\"}");
    }

    private void respond(HttpExchange exchange, int status, String jsonBody) throws IOException {
        byte[] bytes = jsonBody.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }
}
