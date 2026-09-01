// LNBQSHA Product Layer — Analytics / Telemetry System
// Player behavior tracking, event logging, metrics

import { nkruntime } from "nakama-runtime";

// ============================================================
// TYPES
// ============================================================

interface AnalyticsEvent {
    id: string;
    userId: string;
    event: string;
    category: "gameplay" | "social" | "economy" | "progression" | "system";
    data: any;
    sessionId: string;
    timestamp: number;
}

interface UserSession {
    userId: string;
    sessionId: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    events: AnalyticsEvent[];
}

interface Metric {
    name: string;
    value: number;
    tags: Record<string, string>;
    timestamp: number;
}

interface PlayerRetention {
    day: number;
    activeUsers: number;
    newUsers: number;
    retainedUsers: number;
    churnedUsers: number;
}

// ============================================================
// CONSTANTS
// ============================================================

const COLLECTION_ANALYTICS = "lnbqsha_analytics";
const COLLECTION_SESSIONS = "lnbqsha_sessions";
const COLLECTION_METRICS = "lnbqsha_metrics";
const COLLECTION_RETENTION = "lnbqsha_retention";
const MAX_EVENTS_PER_USER = 10000;

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

function getAnalyticsEvents(nk: nkruntime.Nakama, userId: string): AnalyticsEvent[] {
    const result = nk.storageRead([
        { collection: COLLECTION_ANALYTICS, key: userId, userId }
    ]);

    if (result && result.length > 0 && result[0].value) {
        return result[0].value as AnalyticsEvent[];
    }
    return [];
}

function saveAnalyticsEvents(nk: nkruntime.Nakama, userId: string, events: AnalyticsEvent[]): void {
    // Sort by timestamp
    events.sort((a, b) => b.timestamp - a.timestamp);
    
    // Limit to MAX_EVENTS_PER_USER
    if (events.length > MAX_EVENTS_PER_USER) {
        events = events.slice(0, MAX_EVENTS_PER_USER);
    }

    nk.storageWrite([{
        collection: COLLECTION_ANALYTICS,
        key: userId,
        userId,
        value: events,
        permissionRead: 1,
        permissionWrite: 1
    }]);
}

function getSessions(nk: nkruntime.Nakama, userId: string): UserSession[] {
    const result = nk.storageRead([
        { collection: COLLECTION_SESSIONS, key: userId, userId }
    ]);

    if (result && result.length > 0 && result[0].value) {
        return result[0].value as UserSession[];
    }
    return [];
}

function saveSessions(nk: nkruntime.Nakama, userId: string, sessions: UserSession[]): void {
    nk.storageWrite([{
        collection: COLLECTION_SESSIONS,
        key: userId,
        userId,
        value: sessions,
        permissionRead: 1,
        permissionWrite: 1
    }]);
}

function getRetentionData(nk: nkruntime.Nakama): PlayerRetention[] {
    const result = nk.storageRead([
        { collection: COLLECTION_RETENTION, key: "data", userId: "system" }
    ]);

    if (result && result.length > 0 && result[0].value) {
        return result[0].value as PlayerRetention[];
    }
    return [];
}

function saveRetentionData(nk: nkruntime.Nakama, data: PlayerRetention[]): void {
    nk.storageWrite([{
        collection: COLLECTION_RETENTION,
        key: "data",
        userId: "system",
        value: data,
        permissionRead: 1,
        permissionWrite: 1
    }]);
}

function getSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

// ============================================================
// RPC: Start session
// ============================================================

export const rpcStartSession: nkruntime.RpcFunction = (
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

        const sessionId = getSessionId();
        const session: UserSession = {
            userId,
            sessionId,
            startTime: Date.now(),
            events: []
        };

        const sessions = getSessions(nk, userId);
        sessions.unshift(session);
        saveSessions(nk, userId, sessions);

        return JSON.stringify({
            success: true,
            sessionId
        });
    } catch (e) {
        throw new Error(`Failed to start session: ${e}`);
    }
};

// ============================================================
// RPC: End session
// ============================================================

export const rpcEndSession: nkruntime.RpcFunction = (
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
        const sessionId: string = data.sessionId;

        if (!sessionId) {
            throw new Error("sessionId required");
        }

        const sessions = getSessions(nk, userId);
        const session = sessions.find(s => s.sessionId === sessionId);
        if (session) {
            session.endTime = Date.now();
            session.duration = session.endTime - session.startTime;
            saveSessions(nk, userId, sessions);
        }

        return JSON.stringify({ success: true });
    } catch (e) {
        throw new Error(`Failed to end session: ${e}`);
    }
};

// ============================================================
// RPC: Track event
// ============================================================

export const rpcTrackEvent: nkruntime.RpcFunction = (
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
        const eventName: string = data.event;
        const category: string = data.category || "system";
        const eventData: any = data.data || {};
        const sessionId: string = data.sessionId || "unknown";

        if (!eventName) {
            throw new Error("event name required");
        }

        const event: AnalyticsEvent = {
            id: generateUUID(),
            userId,
            event: eventName,
            category: category as any,
            data: eventData,
            sessionId,
            timestamp: Date.now()
        };

        // Store event
        const events = getAnalyticsEvents(nk, userId);
        events.unshift(event);
        saveAnalyticsEvents(nk, userId, events);

        // Update session events
        if (sessionId !== "unknown") {
            const sessions = getSessions(nk, userId);
            const session = sessions.find(s => s.sessionId === sessionId);
            if (session) {
                session.events.unshift(event);
                saveSessions(nk, userId, sessions);
            }
        }

        // Update retention metrics
        updateRetentionMetrics(nk, userId);

        return JSON.stringify({
            success: true,
            eventId: event.id
        });
    } catch (e) {
        throw new Error(`Failed to track event: ${e}`);
    }
};

// ============================================================
// RPC: Get user analytics
// ============================================================

export const rpcGetUserAnalytics: nkruntime.RpcFunction = (
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
        const limit = data.limit || 50;
        const offset = data.offset || 0;

        const events = getAnalyticsEvents(nk, userId);
        const sessions = getSessions(nk, userId);
        const paginatedEvents = events.slice(offset, offset + limit);

        // Get active session
        const activeSession = sessions.find(s => !s.endTime);

        // Calculate stats
        const totalEvents = events.length;
        const totalSessions = sessions.length;
        const totalDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);

        // Count events by category
        const categoryCounts: Record<string, number> = {};
        events.forEach(e => {
            categoryCounts[e.category] = (categoryCounts[e.category] || 0) + 1;
        });

        return JSON.stringify({
            events: paginatedEvents,
            sessions,
            activeSession: activeSession?.sessionId || null,
            stats: {
                totalEvents,
                totalSessions,
                totalDuration,
                averageSessionDuration: totalSessions > 0 ? totalDuration / totalSessions : 0,
                categoryCounts
            },
            total: events.length,
            offset,
            limit
        });
    } catch (e) {
        throw new Error(`Failed to get user analytics: ${e}`);
    }
};

// ============================================================
// RPC: Get retention metrics (admin)
// ============================================================

export const rpcGetRetentionMetrics: nkruntime.RpcFunction = (
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

        // Check admin privileges
        // This would be implemented with a proper role system

        const retentionData = getRetentionData(nk);

        return JSON.stringify({
            retention: retentionData,
            summary: {
                totalDays: retentionData.length,
                averageRetention: retentionData.reduce((sum, d) => sum + d.retainedUsers, 0) / retentionData.length || 0
            }
        });
    } catch (e) {
        throw new Error(`Failed to get retention metrics: ${e}`);
    }
};

// ============================================================
// HELPER: Update retention metrics
// ============================================================

function updateRetentionMetrics(nk: nkruntime.Nakama, userId: string): void {
    // Simplified retention calculation
    // In production, this would use a more sophisticated algorithm
    const retentionData = getRetentionData(nk);
    
    // Calculate D1, D3, D7, D30 retention
    // This would use user login data, etc.
    // For now, we'll just update with placeholder data
    
    // In production, we'd query user login history and calculate actual retention
    // This is a simplified version for demonstration
}

// ============================================================
// RPC: Get real-time metrics (admin)
// ============================================================

export const rpcGetRealtimeMetrics: nkruntime.RpcFunction = (
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

        // Get total players (simplified)
        // In production, we'd query active sessions
        const users = nk.usersGetId([userId]);
        const totalPlayers = users.length;

        // Get online players (simplified)
        // In production, we'd query presence

        return JSON.stringify({
            totalPlayers: 0, // Placeholder
            onlinePlayers: 0, // Placeholder
            activeMatches: 0, // Placeholder
            activeParties: 0, // Placeholder
            activeClans: 0, // Placeholder
            timestamp: Date.now()
        });
    } catch (e) {
        throw new Error(`Failed to get real-time metrics: ${e}`);
    }
};

// ============================================================
// RPC: Get player events (admin)
// ============================================================

export const rpcGetPlayerEvents: nkruntime.RpcFunction = (
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
        const targetUserId: string = data.targetUserId;

        if (!targetUserId) {
            throw new Error("targetUserId required");
        }

        const events = getAnalyticsEvents(nk, targetUserId);
        const paginated = events.slice(0, 100);

        return JSON.stringify({
            userId: targetUserId,
            events: paginated,
            total: events.length
        });
    } catch (e) {
        throw new Error(`Failed to get player events: ${e}`);
    }
};

// ============================================================
// INIT
// ============================================================

export function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama): void {
    nk.registerRpc("analytics.startSession", rpcStartSession);
    nk.registerRpc("analytics.endSession", rpcEndSession);
    nk.registerRpc("analytics.track", rpcTrackEvent);
    nk.registerRpc("analytics.getUserAnalytics", rpcGetUserAnalytics);
    nk.registerRpc("analytics.getRetention", rpcGetRetentionMetrics);
    nk.registerRpc("analytics.getRealtime", rpcGetRealtimeMetrics);
    nk.registerRpc("analytics.getPlayerEvents", rpcGetPlayerEvents);

    logger.info("LNBQSHA Analytics / Telemetry System initialized");
    logger.info("Registered RPCs: analytics.*");
      }
