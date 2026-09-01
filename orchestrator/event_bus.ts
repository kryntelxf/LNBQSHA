// LNBQSHA Orchestrator — Event Bus
// Real-time event system connecting all services

import { nkruntime } from "nakama-runtime";

// ============================================================
// TYPES
// ============================================================

interface EventBusMessage {
    id: string;
    topic: string;
    event: string;
    source: string;
    data: any;
    timestamp: number;
    priority: "low" | "normal" | "high" | "critical";
    ttl: number;
}

interface EventBusSubscription {
    id: string;
    topic: string;
    callback: (message: EventBusMessage) => void;
    filter?: (message: EventBusMessage) => boolean;
    createdAt: number;
}

interface EventBusState {
    messages: EventBusMessage[];
    subscribers: Record<string, string[]>;
    stats: {
        totalMessages: number;
        messagesPerTopic: Record<string, number>;
        lastMessage: number;
    };
}

// ============================================================
// CONSTANTS
// ============================================================

const COLLECTION_EVENT_BUS = "lnbqsha_event_bus";
const MAX_MESSAGES = 1000;

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

function getEventBusState(nk: nkruntime.Nakama): EventBusState {
    const result = nk.storageRead([
        { collection: COLLECTION_EVENT_BUS, key: "state", userId: "system" }
    ]);

    if (result && result.length > 0 && result[0].value) {
        return result[0].value as EventBusState;
    }

    const defaultState: EventBusState = {
        messages: [],
        subscribers: {},
        stats: {
            totalMessages: 0,
            messagesPerTopic: {},
            lastMessage: 0
        }
    };

    nk.storageWrite([{
        collection: COLLECTION_EVENT_BUS,
        key: "state",
        userId: "system",
        value: defaultState,
        permissionRead: 1,
        permissionWrite: 1
    }]);

    return defaultState;
}

function saveEventBusState(nk: nkruntime.Nakama, state: EventBusState): void {
    nk.storageWrite([{
        collection: COLLECTION_EVENT_BUS,
        key: "state",
        userId: "system",
        value: state,
        permissionRead: 1,
        permissionWrite: 1
    }]);
}

function publishEvent(
    nk: nkruntime.Nakama,
    topic: string,
    event: string,
    source: string,
    data: any,
    priority: EventBusMessage["priority"] = "normal"
): EventBusMessage {
    const state = getEventBusState(nk);

    const message: EventBusMessage = {
        id: generateUUID(),
        topic,
        event,
        source,
        data,
        timestamp: Date.now(),
        priority,
        ttl: 3600000 // 1 hour
    };

    state.messages.unshift(message);

    // Limit messages
    if (state.messages.length > MAX_MESSAGES) {
        state.messages = state.messages.slice(0, MAX_MESSAGES);
    }

    // Update stats
    state.stats.totalMessages += 1;
    state.stats.messagesPerTopic[topic] = (state.stats.messagesPerTopic[topic] || 0) + 1;
    state.stats.lastMessage = Date.now();

    saveEventBusState(nk, state);

    // Log event
    console.log(`[EventBus] ${topic}:${event} from ${source}`);

    return message;
}

function getEventsByTopic(
    nk: nkruntime.Nakama,
    topic: string,
    limit: number = 50,
    offset: number = 0
): EventBusMessage[] {
    const state = getEventBusState(nk);
    const filtered = state.messages.filter(m => m.topic === topic);
    return filtered.slice(offset, offset + limit);
}

function getEventsBySource(
    nk: nkruntime.Nakama,
    source: string,
    limit: number = 50,
    offset: number = 0
): EventBusMessage[] {
    const state = getEventBusState(nk);
    const filtered = state.messages.filter(m => m.source === source);
    return filtered.slice(offset, offset + limit);
}

// ============================================================
// RPC: Publish event
// ============================================================

export const rpcPublishEvent: nkruntime.RpcFunction = (
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
        const topic: string = data.topic;
        const event: string = data.event;
        const eventData: any = data.data || {};
        const priority: EventBusMessage["priority"] = data.priority || "normal";

        if (!topic) {
            throw new Error("topic required");
        }
        if (!event) {
            throw new Error("event required");
        }

        const message = publishEvent(nk, topic, event, userId, eventData, priority);

        return JSON.stringify({
            success: true,
            message
        });
    } catch (e) {
        throw new Error(`Failed to publish event: ${e}`);
    }
};

// ============================================================
// RPC: Get events by topic
// ============================================================

export const rpcGetEventsByTopic: nkruntime.RpcFunction = (
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
        const topic: string = data.topic;
        const limit: number = data.limit || 50;
        const offset: number = data.offset || 0;

        if (!topic) {
            throw new Error("topic required");
        }

        const events = getEventsByTopic(nk, topic, limit, offset);
        const state = getEventBusState(nk);

        return JSON.stringify({
            events,
            total: state.messages.filter(m => m.topic === topic).length,
            limit,
            offset
        });
    } catch (e) {
        throw new Error(`Failed to get events by topic: ${e}`);
    }
};

// ============================================================
// RPC: Get events by source
// ============================================================

export const rpcGetEventsBySource: nkruntime.RpcFunction = (
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
        const source: string = data.source;
        const limit: number = data.limit || 50;
        const offset: number = data.offset || 0;

        if (!source) {
            throw new Error("source required");
        }

        const events = getEventsBySource(nk, source, limit, offset);
        const state = getEventBusState(nk);

        return JSON.stringify({
            events,
            total: state.messages.filter(m => m.source === source).length,
            limit,
            offset
        });
    } catch (e) {
        throw new Error(`Failed to get events by source: ${e}`);
    }
};

// ============================================================
// RPC: Get event bus stats
// ============================================================

export const rpcGetEventBusStats: nkruntime.RpcFunction = (
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

        const state = getEventBusState(nk);

        // Get topic breakdown
        const topics = Object.keys(state.stats.messagesPerTopic);
        const topicStats = topics.map(topic => ({
            topic,
            count: state.stats.messagesPerTopic[topic]
        }));

        return JSON.stringify({
            totalMessages: state.stats.totalMessages,
            lastMessage: state.stats.lastMessage,
            messageCount: state.messages.length,
            topics: topicStats,
            topTopics: topicStats.sort((a, b) => b.count - a.count).slice(0, 5)
        });
    } catch (e) {
        throw new Error(`Failed to get event bus stats: ${e}`);
    }
};

// ============================================================
// RPC: Clear events
// ============================================================

export const rpcClearEvents: nkruntime.RpcFunction = (
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
        const topic: string = data.topic || "";

        const state = getEventBusState(nk);

        if (topic) {
            state.messages = state.messages.filter(m => m.topic !== topic);
            state.stats.messagesPerTopic[topic] = 0;
        } else {
            state.messages = [];
            state.stats.messagesPerTopic = {};
            state.stats.totalMessages = 0;
        }

        saveEventBusState(nk, state);

        return JSON.stringify({
            success: true,
            remaining: state.messages.length
        });
    } catch (e) {
        throw new Error(`Failed to clear events: ${e}`);
    }
};

// ============================================================
// RPC: Emit system event (internal)
// ============================================================

export function emitSystemEvent(
    nk: nkruntime.Nakama,
    event: string,
    data: any
): EventBusMessage {
    return publishEvent(nk, "system", event, "orchestrator", data, "critical");
}

// ============================================================
// INIT
// ============================================================

export function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama): void {
    nk.registerRpc("eventbus.publish", rpcPublishEvent);
    nk.registerRpc("eventbus.getByTopic", rpcGetEventsByTopic);
    nk.registerRpc("eventbus.getBySource", rpcGetEventsBySource);
    nk.registerRpc("eventbus.stats", rpcGetEventBusStats);
    nk.registerRpc("eventbus.clear", rpcClearEvents);

    // Emit system startup event
    emitSystemEvent(nk, "system_startup", {
        version: "1.0.0",
        timestamp: Date.now()
    });

    logger.info("LNBQSHA Event Bus initialized");
    logger.info("Registered RPCs: eventbus.*");
  }
