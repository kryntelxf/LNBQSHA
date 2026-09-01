// LNBQSHA Product Layer — Server Status & Health Check
// Server monitoring, health check, system status

import { nkruntime } from "nakama-runtime";

// ============================================================
// TYPES
// ============================================================

interface ServerStatus {
    status: "online" | "degraded" | "offline";
    uptime: number;
    startTime: number;
    version: string;
    region: string;
    environment: string;
    metrics: {
        totalPlayers: number;
        onlinePlayers: number;
        activeMatches: number;
        activeParties: number;
        activeClans: number;
        totalRpcCalls: number;
        averageLatency: number;
    };
    services: {
        database: "online" | "degraded" | "offline";
        storage: "online" | "degraded" | "offline";
        realtime: "online" | "degraded" | "offline";
        api: "online" | "degraded" | "offline";
    };
    timestamp: number;
}

// ============================================================
// CONSTANTS
// ============================================================

const COLLECTION_SERVER_STATUS = "lnbqsha_server_status";
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

let serverStartTime = Date.now();
let totalRpcCalls = 0;

// ============================================================
// RPC: Get server status
// ============================================================

export const rpcGetServerStatus: nkruntime.RpcFunction = (
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

        // Check if user is admin
        // This would be implemented with proper roles

        // Get current metrics
        const status = getCurrentStatus(nk, logger);

        return JSON.stringify(status);
    } catch (e) {
        throw new Error(`Failed to get server status: ${e}`);
    }
};

// ============================================================
// RPC: Health check (public)
// ============================================================

export const rpcHealthCheck: nkruntime.RpcFunction = (
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    payload: string
): string => {
    try {
        // Check database connection
        const dbStatus = checkDatabaseHealth(nk);
        
        // Check storage
        const storageStatus = checkStorageHealth(nk);

        // Check realtime
        const realtimeStatus = checkRealtimeHealth(nk);

        const healthy = dbStatus === "online" && storageStatus === "online" && realtimeStatus === "online";

        return JSON.stringify({
            status: healthy ? "healthy" : "unhealthy",
            timestamp: Date.now(),
            services: {
                database: dbStatus,
                storage: storageStatus,
                realtime: realtimeStatus,
                api: "online"
            }
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
// RPC: Record RPC call (called by all RPCs)
// ============================================================

export const rpcRecordRpcCall: nkruntime.RpcFunction = (
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    payload: string
): string => {
    try {
        totalRpcCalls++;
        return JSON.stringify({ success: true });
    } catch (e) {
        return JSON.stringify({ success: false });
    }
};

// ============================================================
// RPC: Get server metrics
// ============================================================

export const rpcGetServerMetrics: nkruntime.RpcFunction = (
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

        // Get all users count
        // This would use Nakama's API
        const users = nk.usersGetId([userId]);

        // Get online players (simplified)
        // In production, we'd query presence

        const metrics = {
            totalPlayers: 0, // Placeholder
            onlinePlayers: 0, // Placeholder
            activeMatches: 0, // Placeholder
            activeParties: 0, // Placeholder
            activeClans: 0, // Placeholder
            totalRpcCalls,
            averageLatency: 0, // Placeholder
            timestamp: Date.now()
        };

        return JSON.stringify(metrics);
    } catch (e) {
        throw new Error(`Failed to get server metrics: ${e}`);
    }
};

// ============================================================
// RPC: Server info (public)
// ============================================================

export const rpcGetServerInfo: nkruntime.RpcFunction = (
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    payload: string
): string => {
    try {
        return JSON.stringify({
            name: "LNBQSHA",
            version: "1.0.0",
            region: process.env.REGION || "unknown",
            environment: process.env.ENVIRONMENT || "development",
            uptime: Date.now() - serverStartTime,
            timestamp: Date.now()
        });
    } catch (e) {
        throw new Error(`Failed to get server info: ${e}`);
    }
};

// ============================================================
// HELPERS
// ============================================================

function getCurrentStatus(nk: nkruntime.Nakama, logger: nkruntime.Logger): ServerStatus {
    const dbStatus = checkDatabaseHealth(nk);
    const storageStatus = checkStorageHealth(nk);
    const realtimeStatus = checkRealtimeHealth(nk);

    // Determine overall status
    let overallStatus: ServerStatus["status"] = "online";
    if (dbStatus === "offline" || storageStatus === "offline" || realtimeStatus === "offline") {
        overallStatus = "offline";
    } else if (dbStatus === "degraded" || storageStatus === "degraded" || realtimeStatus === "degraded") {
        overallStatus = "degraded";
    }

    return {
        status: overallStatus,
        uptime: Date.now() - serverStartTime,
        startTime: serverStartTime,
        version: "1.0.0",
        region: process.env.REGION || "unknown",
        environment: process.env.ENVIRONMENT || "development",
        metrics: {
            totalPlayers: 0,
            onlinePlayers: 0,
            activeMatches: 0,
            activeParties: 0,
            activeClans: 0,
            totalRpcCalls,
            averageLatency: 0
        },
        services: {
            database: dbStatus,
            storage: storageStatus,
            realtime: realtimeStatus,
            api: "online"
        },
        timestamp: Date.now()
    };
}

function checkDatabaseHealth(nk: nkruntime.Nakama): "online" | "degraded" | "offline" {
    try {
        // Try to read from database
        const result = nk.storageRead([
            { collection: "lnbqsha_health_check", key: "health", userId: "system" }
        ]);
        return "online";
    } catch (e) {
        return "offline";
    }
}

function checkStorageHealth(nk: nkruntime.Nakama): "online" | "degraded" | "offline" {
    try {
        // Try to write to storage
        nk.storageWrite([{
            collection: "lnbqsha_health_check",
            key: "health",
            userId: "system",
            value: { status: "ok", timestamp: Date.now() },
            permissionRead: 1,
            permissionWrite: 1
        }]);
        return "online";
    } catch (e) {
        return "offline";
    }
}

function checkRealtimeHealth(nk: nkruntime.Nakama): "online" | "degraded" | "offline" {
    try {
        // Check realtime status
        // This would use Nakama's realtime API
        return "online";
    } catch (e) {
        return "offline";
    }
}

// ============================================================
// INIT
// ============================================================

export function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama): void {
    nk.registerRpc("server.status", rpcGetServerStatus);
    nk.registerRpc("server.health", rpcHealthCheck);
    nk.registerRpc("server.metrics", rpcGetServerMetrics);
    nk.registerRpc("server.info", rpcGetServerInfo);
    nk.registerRpc("server.recordRpc", rpcRecordRpcCall);

    logger.info("LNBQSHA Server Status & Health Check initialized");
    logger.info("Registered RPCs: server.*");
  }
