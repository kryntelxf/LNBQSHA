// LNBQSHA Orchestrator — Unified API Gateway
// Single entry point for all services

import { nkruntime } from "nakama-runtime";

// ============================================================
// TYPES
// ============================================================

interface GatewayRoute {
    path: string;
    service: string;
    method: string;
    auth: boolean;
    rateLimit: number;
    timeout: number;
}

interface GatewayRequest {
    id: string;
    path: string;
    method: string;
    headers: Record<string, string>;
    body: any;
    userId: string;
    timestamp: number;
}

interface GatewayResponse {
    id: string;
    status: number;
    body: any;
    headers: Record<string, string>;
    duration: number;
    timestamp: number;
}

interface GatewayStats {
    totalRequests: number;
    totalErrors: number;
    averageLatency: number;
    requestsByService: Record<string, number>;
    errorsByService: Record<string, number>;
    lastMinute: number;
}

// ============================================================
// CONSTANTS
// ============================================================

const COLLECTION_GATEWAY = "lnbqsha_gateway";

// Default routes
const DEFAULT_ROUTES: GatewayRoute[] = [
    // Core services
    { path: "/api/wallet", service: "economy", method: "getWallet", auth: true, rateLimit: 60, timeout: 5000 },
    { path: "/api/purchase", service: "economy", method: "purchase", auth: true, rateLimit: 30, timeout: 10000 },
    { path: "/api/inventory", service: "inventory", method: "getInventory", auth: true, rateLimit: 60, timeout: 5000 },
    { path: "/api/profile", service: "player", method: "getState", auth: true, rateLimit: 60, timeout: 5000 },
    { path: "/api/friends", service: "social", method: "getFriends", auth: true, rateLimit: 60, timeout: 5000 },
    { path: "/api/party", service: "party", method: "getUserParty", auth: true, rateLimit: 30, timeout: 5000 },
    { path: "/api/leaderboard", service: "leaderboard", method: "get", auth: false, rateLimit: 100, timeout: 5000 },
    { path: "/api/tournament", service: "tournament", method: "getActive", auth: false, rateLimit: 60, timeout: 5000 },
    { path: "/api/game/start", service: "game", method: "start", auth: true, rateLimit: 20, timeout: 10000 },
    { path: "/api/game/update", service: "game", method: "update", auth: true, rateLimit: 100, timeout: 5000 },
    { path: "/api/game/end", service: "game", method: "end", auth: true, rateLimit: 20, timeout: 10000 },
    { path: "/api/ai/chat", service: "ai", method: "chat", auth: true, rateLimit: 30, timeout: 15000 },
    { path: "/api/ai/play", service: "ai", method: "play", auth: true, rateLimit: 20, timeout: 10000 },
    { path: "/api/shop", service: "shop", method: "getCatalog", auth: false, rateLimit: 100, timeout: 5000 },
    { path: "/api/quest", service: "quest", method: "get", auth: true, rateLimit: 60, timeout: 5000 },
    { path: "/api/achievement", service: "achievement", method: "get", auth: true, rateLimit: 60, timeout: 5000 },
    { path: "/api/battlepass", service: "battlepass", method: "get", auth: true, rateLimit: 60, timeout: 5000 },
    { path: "/api/clan", service: "clan", method: "getUserClan", auth: true, rateLimit: 60, timeout: 5000 },
    { path: "/api/chat", service: "chat", method: "getMessages", auth: true, rateLimit: 60, timeout: 5000 },
    { path: "/api/globalchat", service: "globalChat", method: "getMessages", auth: true, rateLimit: 60, timeout: 5000 },
    { path: "/api/notification", service: "notification", method: "get", auth: true, rateLimit: 60, timeout: 5000 },
    { path: "/api/cms", service: "cms", method: "getItems", auth: false, rateLimit: 100, timeout: 5000 },
    { path: "/api/analytics", service: "analytics", method: "getUserAnalytics", auth: true, rateLimit: 30, timeout: 5000 },
    { path: "/api/health", service: "server", method: "health", auth: false, rateLimit: 1000, timeout: 2000 },
];

// ============================================================
// HELPERS
// ============================================================

function generateUUID(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === "x" ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function getGatewayState(nk: nkruntime.Nakama): GatewayStats {
    const result = nk.storageRead([
        { collection: COLLECTION_GATEWAY, key: "stats", userId: "system" }
    ]);

    if (result && result.length > 0 && result[0].value) {
        return result[0].value as GatewayStats;
    }

    const defaultState: GatewayStats = {
        totalRequests: 0,
        totalErrors: 0,
        averageLatency: 0,
        requestsByService: {},
        errorsByService: {},
        lastMinute: 0
    };

    nk.storageWrite([{
        collection: COLLECTION_GATEWAY,
        key: "stats",
        userId: "system",
        value: defaultState,
        permissionRead: 1,
        permissionWrite: 1
    }]);

    return defaultState;
}

function saveGatewayState(nk: nkruntime.Nakama, stats: GatewayStats): void {
    nk.storageWrite([{
        collection: COLLECTION_GATEWAY,
        key: "stats",
        userId: "system",
        value: stats,
        permissionRead: 1,
        permissionWrite: 1
    }]);
}

function getRoute(path: string): GatewayRoute | null {
    // Find exact match first
    const exact = DEFAULT_ROUTES.find(r => r.path === path);
    if (exact) return exact;

    // Find prefix match
    const prefix = DEFAULT_ROUTES.find(r => path.startsWith(r.path + "/"));
    if (prefix) return prefix;

    return null;
}

function getServiceRpc(service: string, method: string): string {
    // Map service names to RPC prefixes
    const serviceMap: Record<string, string> = {
        "economy": "economy",
        "inventory": "inventory",
        "player": "player",
        "social": "social",
        "party": "party",
        "leaderboard": "leaderboard",
        "tournament": "tournament",
        "game": "game",
        "ai": "ai",
        "shop": "shop",
        "quest": "quest",
        "achievement": "achievement",
        "battlepass": "battlepass",
        "clan": "clan",
        "chat": "chat",
        "globalChat": "globalChat",
        "notification": "notification",
        "cms": "cms",
        "analytics": "analytics",
        "server": "server"
    };

    const prefix = serviceMap[service] || service;
    return `${prefix}.${method}`;
}

// ============================================================
// RPC: Gateway route request
// ============================================================

export const rpcGatewayRequest: nkruntime.RpcFunction = (
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    payload: string
): string => {
    const startTime = Date.now();

    try {
        const userId = ctx.userId;
        if (!userId) {
            throw new Error("Unauthorized");
        }

        const data = JSON.parse(payload);
        const path: string = data.path;
        const method: string = data.method || "GET";
        const body: any = data.body || {};
        const headers: Record<string, string> = data.headers || {};

        if (!path) {
            throw new Error("path required");
        }

        // Find route
        const route = getRoute(path);
        if (!route) {
            throw new Error(`Route not found: ${path}`);
        }

        // Check auth
        if (route.auth && !userId) {
            throw new Error("Authentication required");
        }

        // Build RPC call
        const rpcMethod = getServiceRpc(route.service, route.method);
        const rpcPayload = JSON.stringify(body);

        // Call the service
        const result = nk.rpc(rpcMethod, rpcPayload);
        const response = JSON.parse(result);

        // Update stats
        const stats = getGatewayState(nk);
        stats.totalRequests += 1;
        stats.requestsByService[route.service] = (stats.requestsByService[route.service] || 0) + 1;
        stats.averageLatency = (stats.averageLatency * (stats.totalRequests - 1) + (Date.now() - startTime)) / stats.totalRequests;
        stats.lastMinute = Date.now();
        saveGatewayState(nk, stats);

        return JSON.stringify({
            success: true,
            data: response,
            meta: {
                path,
                service: route.service,
                method: route.method,
                duration: Date.now() - startTime
            }
        });
    } catch (e) {
        // Update error stats
        try {
            const stats = getGatewayState(nk);
            stats.totalErrors += 1;
            saveGatewayState(nk, stats);
        } catch (_) {
            // Ignore
        }

        return JSON.stringify({
            success: false,
            error: e.message,
            timestamp: Date.now()
        });
    }
};

// ============================================================
// RPC: Get gateway stats
// ============================================================

export const rpcGetGatewayStats: nkruntime.RpcFunction = (
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    payload: string
): string => {
    try {
        const userId = ctx.userId;
        if (!userId) {
            throw new Error("Unauthorized");
        }

        const stats = getGatewayState(nk);

        return JSON.stringify({
            stats,
            routes: DEFAULT_ROUTES.map(r => ({
                path: r.path,
                service: r.service,
                auth: r.auth
            }))
        });
    } catch (e) {
        throw new Error(`Failed to get gateway stats: ${e}`);
    }
};

// ============================================================
// RPC: Get route info
// ============================================================

export const rpcGetRouteInfo: nkruntime.RpcFunction = (
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    payload: string
): string => {
    try {
        const userId = ctx.userId;
        if (!userId) {
            throw new Error("Unauthorized");
        }

        const data = JSON.parse(payload || "{}");
        const path: string = data.path;

        if (!path) {
            return JSON.stringify({
                routes: DEFAULT_ROUTES
            });
        }

        const route = getRoute(path);
        if (!route) {
            throw new Error(`Route not found: ${path}`);
        }

        return JSON.stringify({
            route,
            services: [...new Set(DEFAULT_ROUTES.map(r => r.service))]
        });
    } catch (e) {
        throw new Error(`Failed to get route info: ${e}`);
    }
};

// ============================================================
// RPC: Health check (gateway)
// ============================================================

export const rpcGatewayHealth: nkruntime.RpcFunction = (
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    payload: string
): string => {
    try {
        const stats = getGatewayState(nk);
        const uptime = Date.now() - stats.lastMinute;

        return JSON.stringify({
            status: "online",
            uptime,
            requests: stats.totalRequests,
            errors: stats.totalErrors,
            errorRate: stats.totalRequests > 0 ? (stats.totalErrors / stats.totalRequests) * 100 : 0,
            averageLatency: stats.averageLatency,
            timestamp: Date.now()
        });
    } catch (e) {
        return JSON.stringify({
            status: "unhealthy",
            error: e.message,
            timestamp: Date.now()
        });
    }
};

// ============================================================
// INIT
// ============================================================

export function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama): void {
    nk.registerRpc("gateway.request", rpcGatewayRequest);
    nk.registerRpc("gateway.stats", rpcGetGatewayStats);
    nk.registerRpc("gateway.routes", rpcGetRouteInfo);
    nk.registerRpc("gateway.health", rpcGatewayHealth);

    logger.info("LNBQSHA Unified API Gateway initialized");
    logger.info(`Routes loaded: ${DEFAULT_ROUTES.length}`);
    logger.info(`Services mapped: ${[...new Set(DEFAULT_ROUTES.map(r => r.service))].length}`);
    logger.info("Registered RPCs: gateway.*");
     }
