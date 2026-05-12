package com.devsforge.runner;

import com.devsforge.runner.modeling.Atomic;
import com.devsforge.runner.modeling.Port;
import com.devsforge.runner.modeling.RunnableModel;
import com.devsforge.runner.modeling.RunnableModelParameter;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

public class Manufacturer extends Atomic {
    private static final long MINUTES_PER_DAY = 24L * 60L;

    private final Map<String, Object> parameters = new HashMap<>();
    private long currentTime = 0L;
    private double currentInventory = 0.0;
    private double dailyProduction = 0.0;
    private double inventoryCost = 0.0;
    private int manufacturerId = 0;
    private int openingHour = 6;
    private long reportMinute = 1439L;
    private long nextReportAt = 1439L;
    private final Map<Long, List<Map<String, Object>>> routeEvents = new HashMap<>();

    public Manufacturer(RunnableModel cfg) {
        super(cfg);
        if (cfg.getParameters() != null) {
            for (RunnableModelParameter parameter : cfg.getParameters()) {
                parameters.put(parameter.getName(), parameter.getValue());
            }
        }
    }

    @Override
    public void initialize() {
        currentTime = 0L;
        currentInventory = asDouble(parameters.get("starting_inventory"), 0.0);
        dailyProduction = asDouble(parameters.get("daily_production"), 0.0);
        inventoryCost = asDouble(parameters.get("inventory_cost"), 0.0);
        manufacturerId = asInt(parameters.get("manufacturer_id"), 0);
        openingHour = asInt(parameters.get("opening_hour"), 6);
        reportMinute = asLong(parameters.get("manufacturer_report_minute"), 1439L);
        if (reportMinute < 0) {
            reportMinute = 1439L;
        }
        nextReportAt = reportMinute;
        routeEvents.clear();
    }

    @Override
    public void exit() {
        // no-op
    }

    @Override
    public double ta() {
        long nextTime = nextInternalTime();
        double delta = (double) (nextTime - currentTime);
        return Math.max(delta, 0.0);
    }

    @Override
    public void deltInt() {
        long nextTime = nextInternalTime();
        currentTime = nextTime;

        if (nextReportAt == nextTime) {
            currentInventory += dailyProduction;
            nextReportAt += MINUTES_PER_DAY;
        }

        List<Map<String, Object>> routes = routeEvents.remove(nextTime);
        if (routes != null) {
            for (Map<String, Object> route : routes) {
                currentInventory -= routeLoad(route);
            }
        }
    }

    @Override
    public void deltExt(double e) {
        currentTime += Math.round(e);

        consumeInputPort("acceptDeliverySchedule", this::handleAcceptDeliverySchedule);
        consumeInputPort("acceptDelivery", this::handleAcceptDelivery);
    }

    @Override
    public void deltCon(double e) {
        deltInt();
        deltExt(0.0);
    }

    @Override
    public void lambda() {
        long nextTime = nextInternalTime();

        if (nextReportAt == nextTime) {
            double predictedInventory = currentInventory + dailyProduction;
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("day", dayFromMinute(nextTime));
            payload.put("retailerId", manufacturerId);
            payload.put("cost", predictedInventory * inventoryCost);
            emit("dailyInventoryCost", payload);
        }

        List<Map<String, Object>> routes = routeEvents.get(nextTime);
        if (routes == null) {
            return;
        }

        for (Map<String, Object> route : routes) {
            emit("postDeliveryRoute", route);
        }
    }

    private void consumeInputPort(String portName, Consumer<Object> handler) {
        try {
            Port port = getPortByName(portName);
            Object rawValues = port.getValues();
            if (rawValues instanceof List<?>) {
                List<?> values = (List<?>) rawValues;
                for (Object value : values) {
                    handler.accept(value);
                }
            }
            port.clear();
        } catch (Exception ignored) {
            // missing port
        }
    }

    private void handleAcceptDeliverySchedule(Object raw) {
        Map<String, Object> root = asMap(raw);
        Map<String, Object> byDay = asMap(root.get("deliveriesByDayByVehicle"));

        for (Map.Entry<String, Object> dayEntry : byDay.entrySet()) {
            int day = asInt(dayEntry.getKey(), -1);
            if (day < 1) {
                continue;
            }

            long loadTime = (long) (day - 1) * MINUTES_PER_DAY + (long) openingHour * 60L;
            Map<String, Object> routesByVehicle = asMap(dayEntry.getValue());
            for (Object route : routesByVehicle.values()) {
                Map<String, Object> routeMap = asMap(route);
                routeEvents.computeIfAbsent(loadTime, ignored -> new ArrayList<>()).add(routeMap);
            }
        }
    }

    private void handleAcceptDelivery(Object raw) {
        Map<String, Object> delivery = asMap(raw);
        currentInventory += asDouble(delivery.get("productAmount"), 0.0);
    }

    private long nextInternalTime() {
        long next = Math.max(nextReportAt, currentTime);
        if (!routeEvents.isEmpty()) {
            long routeMin = Long.MAX_VALUE;
            for (Long routeTime : routeEvents.keySet()) {
                if (routeTime < routeMin) {
                    routeMin = routeTime;
                }
            }
            next = Math.min(next, Math.max(routeMin, currentTime));
        }
        return next;
    }

    private void emit(String portName, Object payload) {
        try {
            Port outPort = getPortByName(portName);
            outPort.addValue(payload);
        } catch (Exception ignored) {
            // missing port
        }
    }

    private static int dayFromMinute(long minute) {
        if (minute < 0) {
            return 1;
        }
        return (int) (minute / MINUTES_PER_DAY) + 1;
    }

    private static double routeLoad(Map<String, Object> route) {
        Object deliveriesRaw = route.get("deliveries");
        if (!(deliveriesRaw instanceof List<?>)) {
            return 0.0;
        }
        List<?> deliveries = (List<?>) deliveriesRaw;
        double total = 0.0;
        for (Object item : deliveries) {
            Map<String, Object> delivery = asMap(item);
            total += asDouble(delivery.get("productAmount"), 0.0);
        }
        return total;
    }

    private static Map<String, Object> asMap(Object value) {
        if (value instanceof Map<?, ?>) {
            Map<?, ?> map = (Map<?, ?>) value;
            Map<String, Object> result = new HashMap<>();
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                result.put(String.valueOf(entry.getKey()), entry.getValue());
            }
            return result;
        }
        return new HashMap<>();
    }

    private static int asInt(Object value, int fallback) {
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        if (value instanceof String) {
            try {
                return Integer.parseInt((String) value);
            } catch (NumberFormatException ignored) {
                return fallback;
            }
        }
        return fallback;
    }

    private static long asLong(Object value, long fallback) {
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        if (value instanceof String) {
            try {
                return Long.parseLong((String) value);
            } catch (NumberFormatException ignored) {
                return fallback;
            }
        }
        return fallback;
    }

    private static double asDouble(Object value, double fallback) {
        if (value instanceof Number) {
            return ((Number) value).doubleValue();
        }
        if (value instanceof String) {
            try {
                return Double.parseDouble((String) value);
            } catch (NumberFormatException ignored) {
                return fallback;
            }
        }
        return fallback;
    }
}
