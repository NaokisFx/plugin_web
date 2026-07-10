package com.nexnord.delivery;

import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.File;
import java.io.IOException;
import java.util.logging.Level;

/**
 * Guarda en un archivo delivered.yml el historial de transacciones ya
 * entregadas. Es una segunda capa de proteccion ademas del ledger del
 * servicio de Node: si por lo que sea el webhook llega dos veces (PayPal
 * reintenta si tarda en responder), aqui tambien se evita entregar doble.
 */
public class DeliveryLedger {

    private final File file;
    private final YamlConfiguration data;

    public DeliveryLedger(JavaPlugin plugin) {
        this.file = new File(plugin.getDataFolder(), "delivered.yml");
        if (!file.exists()) {
            plugin.getDataFolder().mkdirs();
            try {
                file.createNewFile();
            } catch (IOException e) {
                plugin.getLogger().log(Level.SEVERE, "No se pudo crear delivered.yml", e);
            }
        }
        this.data = YamlConfiguration.loadConfiguration(file);
    }

    public boolean alreadyDelivered(String transactionId) {
        return data.contains(sanitizeKey(transactionId));
    }

    public void markDelivered(String transactionId, String player, String productId) {
        String key = sanitizeKey(transactionId);
        data.set(key + ".player", player);
        data.set(key + ".productId", productId);
        data.set(key + ".timestamp", System.currentTimeMillis());
        try {
            data.save(file);
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    // YamlConfiguration no acepta puntos "." dentro de las claves como texto literal
    private String sanitizeKey(String key) {
        return key.replace(".", "_");
    }
}
