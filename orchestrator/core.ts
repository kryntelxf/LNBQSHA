// LNBQSHA Orchestrator — Core
// Central coordination for all services

import { nkruntime } from "nakama-runtime";

// ============================================================
// TYPES
// ============================================================

interface ServiceStatus {
    name: string;
    status: "online" | "degraded" | "offline";
    version: string;
    uptime: number;
    lastCheck: number;
    metrics: Record<string, any>;
}

interface OrchestratorState {
    services: Record<string, ServiceStatus>;
    events: OrchestratorEvent[];
    config: OrchestratorConfig;
    health: {
        overall: "healthy" | "degraded" | "unhealthy";
        lastUpdated: number;
    };
}

interface OrchestratorEvent {
    id: string;
    type: "service_registered" | "service_updated" | "service_removed" | 
          "health_check" | "config_update" | "scale_request";
    source: string;
    data: any;
    timestamp: number;
}

interface OrchestratorConfig {
    version: string;
    environment: string;
    features: {
        ai: boolean;
        web3: boolean;
        metaverse: boolean;
        analytics: boolean;
        autoScale: boolean;
    };
    scaling: {
        minReplicas: number;
        maxReplicas: number;
        targetCPU: number;
    };
}

// ============================================================
// CONSTANTS
// ============================================================

const COLLECTION_ORCHESTRATOR = "lnbqsha_orchestrator";

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

function getOrchestratorState(nk: nkruntime.Nakama): OrchestratorState {
    const result = nk.storageRead([
        { collection: COLLECTION_ORCHESTRATOR, key: "state", userId: "system" }
    ]);

    if (result && result.length > 0 && result[0].value) {
        return result[0].value as OrchestratorState;
    }

    // Default state
    const defaultState: OrchestratorState = {
        services: {},
        events: [],
        config: {
            version: "1.0.0",
            environment: "production",
            features: {
                ai: true,
                web3: true,
                metaverse: true,
                analytics: true,
                autoScale: true
            },
            scaling: {
                minReplicas: 1,
                maxReplicas: 10,
                targetCPU: 70
            }
        },
        health: {
            overall: "healthy",
            lastUpdated: Date.now()
        }
    };

    nk.storageWrite([{
        collection: COLLECTION_ORCHESTRATOR,
        key: "state",
        userId: "system",
        value: defaultState,
        permissionRead: 1,
        permissionWrite: 1
    }]);

    return defaultState;
}

function saveOrchestratorState(nk: nkruntime.Nakama, state: OrchestratorState): void {
    state.health.lastUpdated = Date.now();
    nk.storageWrite([{
        collection: COLLECTION_ORCHESTRATOR,
        key: "state",
        userId: "system",
        value: state,
        permissionRead: 1,
        permissionWrite: 1
    }]);
}

function addEvent(state: OrchestratorState, type: OrchestratorEvent["type"], source: string, data: any): void {
    state.events.unshift({
        id: generateUUID(),
        type,
        source,
        data,
        timestamp: Date.now()
    });

    // Keep last 100 events
    if (state.events.length > 100) {
        state.events = state.events.slice(0, 100);
    }
}

function updateServiceStatus(
    state: OrchestratorState,
    name: string,
    status: ServiceStatus["status"],
    metrics?: Record<string, any>
): void {
    const existing = state.services[name];
    state.services[name] = {
        name,
        status,
        version: existing?.version || "1.0.0",
        uptime: existing?.uptime || 0,
        lastCheck: Date.now(),
        metrics: metrics || existing?.metrics || {}
    };
}

// ============================================================
// RPC: Register service
// ============================================================

export const rpcRegisterService: nkruntime.RpcFunction = (
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

        const data = JSON.parse(payload);
        const name: string = data.name;
        const version: string = data.version || "1.0.0";
        const metrics: Record<string, any> = data.metrics || {};

        if (!name) {
            throw new Error("Service name required");
        }

        const state = getOrchestratorState(nk);
        updateServiceStatus(state, name, "online", metrics);
        addEvent(state, "service_registered", name, { version, metrics });

        saveOrchestratorState(nk, state);

        return JSON.stringify({
            success: true,
            service: state.services[name],
            config: state.config
        });
    } catch (e) {
        throw new Error(`Failed to register service: ${e}`);
    }
};

// ============================================================
// RPC: Update service status
// ============================================================

export const rpcUpdateServiceStatus: nkruntime.RpcFunction = (
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

        const data = JSON.parse(payload);
        const name: string = data.name;
        const status: ServiceStatus["status"] = data.status || "online";
        const metrics: Record<string, any> = data.metrics || {};

        if (!name) {
            throw new Error("Service name required");
        }

        const state = getOrchestratorState(nk);
        updateServiceStatus(state, name, status, metrics);
        addEvent(state, "service_updated", name, { status, metrics });

        // Update overall health
        const onlineServices = Object.values(state.services).filter(s => s.status === "online");
        const offlineServices = Object.values(state.services).filter(s => s.status === "offline");

        if (offlineServices.length > 0) {
            state.health.overall = onlineServices.length > offlineServices.length ? "degraded" : "unhealthy";
        } else {
            state.health.overall = "healthy";
        }

        saveOrchestratorState(nk, state);

        return JSON.stringify({
            success: true,
            service: state.services[name],
            health: state.health
        });
    } catch (e) {
        throw new Error(`Failed to update service status: ${e}`);
    }
};

// ============================================================
// RPC: Get orchestrator state
// ============================================================

export const rpcGetOrchestratorState: nkruntime.RpcFunction = (
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

        const state = getOrchestratorState(nk);

        return JSON.stringify({
            services: state.services,
            events: state.events.slice(0, 20),
            config: state.config,
            health: state.health
        });
    } catch (e) {
        throw new Error(`Failed to get orchestrator state: ${e}`);
    }
};

// ============================================================
// RPC: Update configuration
// ============================================================

export const rpcUpdateOrchestratorConfig: nkruntime.RpcFunction = (
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

        const data = JSON.parse(payload);
        const config: Partial<OrchestratorConfig> = data.config || {};

        const state = getOrchestratorState(nk);
        state.config = { ...state.config, ...config };
        addEvent(state, "config_update", "orchestrator", { config: state.config });

        saveOrchestratorState(nk, state);

        return JSON.stringify({
            success: true,
            config: state.config
        });
    } catch (e) {
        throw new Error(`Failed to update orchestrator config: ${e}`);
    }
};

// ============================================================
// RPC: Health check (orchestrator)
// ============================================================

export const rpcOrchestratorHealth: nkruntime.RpcFunction = (
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    payload: string
): string => {
    try {
        const state = getOrchestratorState(nk);

        const serviceCount = Object.keys(state.services).length;
        const onlineCount = Object.values(state.services).filter(s => s.status === "online").length;

        return JSON.stringify({
            status: state.health.overall,
            services: {
                total: serviceCount,
                online: onlineCount,
                degraded: Object.values(state.services).filter(s => s.status === "degraded").length,
                offline: Object.values(state.services).filter(s => s.status === "offline").length
            },
            uptime: state.health.lastUpdated,
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
// RPC: Get service metrics
// ============================================================

export const rpcGetServiceMetrics: nkruntime.RpcFunction = (
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
        const serviceName = data.service || "";

        const state = getOrchestratorState(nk);

        if (serviceName) {
            const service = state.services[serviceName];
            if (!service) {
                throw new Error("Service not found");
            }
            return JSON.stringify({
                service: serviceName,
                status: service.status,
                metrics: service.metrics,
                lastCheck: service.lastCheck
            });
        }

        // Return all service metrics
        const allMetrics: Record<string, any> = {};
        for (const [name, service] of Object.entries(state.services)) {
            allMetrics[name] = {
                status: service.status,
                metrics: service.metrics,
                lastCheck: service.lastCheck
            };
        }

        return JSON.stringify({
            services: allMetrics,
            total: Object.keys(state.services).length
        });
    } catch (e) {
        throw new Error(`Failed to get service metrics: ${e}`);
    }
};

// ============================================================
// RPC: Trigger auto-scale
// ============================================================

export const rpcTriggerAutoScale: nkruntime.RpcFunction = (
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

        const state = getOrchestratorState(nk);

        // Simple auto-scaling logic
        const onlineCount = Object.values(state.services).filter(s => s.status === "online").length;
        const currentReplicas = Math.max(state.config.scaling.minReplicas, onlineCount);

        let targetReplicas = currentReplicas;

        // Scale up if load is high
        const totalRequests = Object.values(state.services).reduce((sum, s) => sum + (s.metrics?.requests || 0), 0);
        const avgRequests = totalRequests / Math.max(1, onlineCount);

        if (avgRequests > 1000) {
            targetReplicas = Math.min(state.config.scaling.maxReplicas, currentReplicas + 1);
        } else if (avgRequests < 100 && currentReplicas > state.config.scaling.minReplicas) {
            targetReplicas = Math.max(state.config.scaling.minReplicas, currentReplicas - 1);
        }

        addEvent(state, "scale_request", "orchestrator", {
            currentReplicas,
            targetReplicas,
            avgRequests,
            reason: targetReplicas > currentReplicas ? "high_load" : "low_load"
        });

        saveOrchestratorState(nk, state);

        return JSON.stringify({
            success: true,
            currentReplicas,
            targetReplicas,
            avgRequests,
            scaling: state.config.scaling
        });
    } catch (e) {
        throw new Error(`Failed to trigger auto-scale: ${e}`);
    }
};

// ============================================================
// INIT
// ============================================================

export function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama): void {
    // Initialize orchestrator state
    const state = getOrchestratorState(nk);
    state.health.lastUpdated = Date.now();
    saveOrchestratorState(nk, state);

    nk.registerRpc("orchestrator.register", rpcRegisterService);
    nk.registerRpc("orchestrator.update", rpcUpdateServiceStatus);
    nk.registerRpc("orchestrator.state", rpcGetOrchestratorState);
    nk.registerRpc("orchestrator.config", rpcUpdateOrchestratorConfig);
    nk.registerRpc("orchestrator.health", rpcOrchestratorHealth);
    nk.registerRpc("orchestrator.metrics", rpcGetServiceMetrics);
    nk.registerRpc("orchestrator.scale", rpcTriggerAutoScale);

    logger.info("LNBQSHA Orchestrator Core initialized");
    logger.info(`Environment: ${state.config.environment}`);
    logger.info(`Services registered: ${Object.keys(state.services).length}`);
    logger.info("Registered RPCs: orchestrator.*");
                              }
