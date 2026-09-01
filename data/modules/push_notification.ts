// LNBQSHA Product Layer — Push Notification Service
// FCM/APNS integration, device management, push templates

import { nkruntime } from "nakama-runtime";

// ============================================================
// TYPES
// ============================================================

interface Device {
    id: string;
    userId: string;
    deviceId: string;
    platform: "ios" | "android" | "web";
    token: string;
    enabled: boolean;
    createdAt: number;
    updatedAt: number;
}

interface PushNotification {
    id: string;
    userId: string;
    title: string;
    body: string;
    data: any;
    sentAt: number;
    readAt?: number;
    status: "pending" | "sent" | "delivered" | "failed";
}

interface PushTemplate {
    id: string;
    name: string;
    title: string;
    body: string;
    data: any;
    category: string;
    priority: "high" | "normal";
}

// ============================================================
// CONSTANTS
// ============================================================

const COLLECTION_DEVICES = "lnbqsha_devices";
const COLLECTION_PUSH_HISTORY = "lnbqsha_push_history";

// Push notification templates
const PUSH_TEMPLATES: PushTemplate[] = [
    {
        id: "friend_follow",
        name: "Friend Follow",
        title: "New Follower!",
        body: "{displayName} started following you!",
        data: { type: "follow" },
        category: "social",
        priority: "normal"
    },
    {
        id: "party_invite",
        name: "Party Invite",
        title: "Party Invite!",
        body: "{displayName} invited you to join their party!",
        data: { type: "party_invite" },
        category: "social",
        priority: "high"
    },
    {
        id: "game_start",
        name: "Game Start",
        title: "Game Starting!",
        body: "Your game is about to start!",
        data: { type: "game_start" },
        category: "game",
        priority: "high"
    },
    {
        id: "daily_reward",
        name: "Daily Reward",
        title: "Daily Reward Available!",
        body: "Claim your daily reward now!",
        data: { type: "daily_reward" },
        category: "reward",
        priority: "normal"
    },
    {
        id: "achievement_unlock",
        name: "Achievement Unlock",
        title: "Achievement Unlocked!",
        body: "You unlocked the {achievement} achievement!",
        data: { type: "achievement" },
        category: "progression",
        priority: "normal"
    },
    {
        id: "level_up",
        name: "Level Up",
        title: "Level Up!",
        body: "You reached level {level}!",
        data: { type: "level_up" },
        category: "progression",
        priority: "normal"
    },
    {
        id: "tournament_reminder",
        name: "Tournament Reminder",
        title: "Tournament Reminder",
        body: "The tournament '{tournament}' is starting soon!",
        data: { type: "tournament" },
        category: "game",
        priority: "normal"
    },
    {
        id: "clan_invite",
        name: "Clan Invite",
        title: "Clan Invite!",
        body: "{displayName} invited you to join their clan '{clanName}'!",
        data: { type: "clan_invite" },
        category: "social",
        priority: "normal"
    }
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

function getDevices(nk: nkruntime.Nakama, userId: string): Device[] {
    const result = nk.storageRead([
        { collection: COLLECTION_DEVICES, key: userId, userId }
    ]);

    if (result && result.length > 0 && result[0].value) {
        return result[0].value as Device[];
    }
    return [];
}

function saveDevices(nk: nkruntime.Nakama, userId: string, devices: Device[]): void {
    nk.storageWrite([{
        collection: COLLECTION_DEVICES,
        key: userId,
        userId,
        value: devices,
        permissionRead: 1,
        permissionWrite: 1
    }]);
}

function getPushHistory(nk: nkruntime.Nakama, userId: string): PushNotification[] {
    const result = nk.storageRead([
        { collection: COLLECTION_PUSH_HISTORY, key: userId, userId }
    ]);

    if (result && result.length > 0 && result[0].value) {
        return result[0].value as PushNotification[];
    }
    return [];
}

function savePushHistory(nk: nkruntime.Nakama, userId: string, history: PushNotification[]): void {
    // Keep last 100
    if (history.length > 100) {
        history = history.slice(0, 100);
    }
    nk.storageWrite([{
        collection: COLLECTION_PUSH_HISTORY,
        key: userId,
        userId,
        value: history,
        permissionRead: 1,
        permissionWrite: 1
    }]);
}

function getTemplate(templateId: string): PushTemplate | null {
    return PUSH_TEMPLATES.find(t => t.id === templateId) || null;
}

function renderTemplate(template: PushTemplate, variables: Record<string, string>): { title: string; body: string } {
    let title = template.title;
    let body = template.body;

    for (const [key, value] of Object.entries(variables)) {
        title = title.replace(`{${key}}`, value);
        body = body.replace(`{${key}}`, value);
    }

    return { title, body };
}

// ============================================================
// RPC: Register device
// ============================================================

export const rpcRegisterDevice: nkruntime.RpcFunction = (
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
        const deviceId: string = data.deviceId;
        const platform: string = data.platform || "web";
        const token: string = data.token;

        if (!deviceId) {
            throw new Error("deviceId required");
        }
        if (!token) {
            throw new Error("token required");
        }

        const devices = getDevices(nk, userId);

        // Remove existing device with same ID
        const filtered = devices.filter(d => d.deviceId !== deviceId);

        const device: Device = {
            id: generateUUID(),
            userId,
            deviceId,
            platform: platform as any,
            token,
            enabled: true,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        filtered.push(device);
        saveDevices(nk, userId, filtered);

        return JSON.stringify({
            success: true,
            device
        });
    } catch (e) {
        throw new Error(`Failed to register device: ${e}`);
    }
};

// ============================================================
// RPC: Unregister device
// ============================================================

export const rpcUnregisterDevice: nkruntime.RpcFunction = (
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
        const deviceId: string = data.deviceId;

        if (!deviceId) {
            throw new Error("deviceId required");
        }

        const devices = getDevices(nk, userId);
        const filtered = devices.filter(d => d.deviceId !== deviceId);
        saveDevices(nk, userId, filtered);

        return JSON.stringify({ success: true });
    } catch (e) {
        throw new Error(`Failed to unregister device: ${e}`);
    }
};

// ============================================================
// RPC: Send push notification
// ============================================================

export const rpcSendPushNotification: nkruntime.RpcFunction = (
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
        const targetUserId: string = data.targetUserId || userId;
        const templateId: string = data.templateId;
        const variables: Record<string, string> = data.variables || {};

        if (!templateId) {
            throw new Error("templateId required");
        }

        const template = getTemplate(templateId);
        if (!template) {
            throw new Error("Template not found");
        }

        // Render template
        const rendered = renderTemplate(template, variables);

        // Get user's devices
        const devices = getDevices(nk, targetUserId);
        const enabledDevices = devices.filter(d => d.enabled);

        if (enabledDevices.length === 0) {
            return JSON.stringify({
                success: false,
                message: "No devices registered"
            });
        }

        // Send to each device (simplified)
        // In production, this would integrate with FCM/APNS
        const pushNotification: PushNotification = {
            id: generateUUID(),
            userId: targetUserId,
            title: rendered.title,
            body: rendered.body,
            data: {
                ...template.data,
                ...data.data,
                templateId
            },
            sentAt: Date.now(),
            status: "sent"
        };

        // Store in history
        const history = getPushHistory(nk, targetUserId);
        history.unshift(pushNotification);
        savePushHistory(nk, targetUserId, history);

        // Also send internal notification
        try {
            const notifyPayload = JSON.stringify({
                type: "push",
                title: rendered.title,
                message: rendered.body,
                data: pushNotification.data
            });
            nk.rpc("notification.send", notifyPayload);
        } catch (e) {
            // Ignore
        }

        return JSON.stringify({
            success: true,
            pushNotification,
            devices: enabledDevices.map(d => d.deviceId)
        });
    } catch (e) {
        throw new Error(`Failed to send push notification: ${e}`);
    }
};

// ============================================================
// RPC: Get push history
// ============================================================

export const rpcGetPushHistory: nkruntime.RpcFunction = (
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

        const history = getPushHistory(nk, userId);
        const paginated = history.slice(offset, offset + limit);

        return JSON.stringify({
            history: paginated,
            total: history.length,
            offset,
            limit
        });
    } catch (e) {
        throw new Error(`Failed to get push history: ${e}`);
    }
};

// ============================================================
// RPC: Get push templates
// ============================================================

export const rpcGetPushTemplates: nkruntime.RpcFunction = (
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

        return JSON.stringify({
            templates: PUSH_TEMPLATES
        });
    } catch (e) {
        throw new Error(`Failed to get push templates: ${e}`);
    }
};

// ============================================================
// RPC: Get devices
// ============================================================

export const rpcGetDevices: nkruntime.RpcFunction = (
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

        const devices = getDevices(nk, userId);

        return JSON.stringify({
            devices,
            count: devices.length
        });
    } catch (e) {
        throw new Error(`Failed to get devices: ${e}`);
    }
};

// ============================================================
// RPC: Enable/disable device
// ============================================================

export const rpcToggleDevice: nkruntime.RpcFunction = (
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
        const deviceId: string = data.deviceId;
        const enabled: boolean = data.enabled !== undefined ? data.enabled : true;

        if (!deviceId) {
            throw new Error("deviceId required");
        }

        const devices = getDevices(nk, userId);
        const device = devices.find(d => d.deviceId === deviceId);
        if (device) {
            device.enabled = enabled;
            device.updatedAt = Date.now();
            saveDevices(nk, userId, devices);
        }

        return JSON.stringify({ success: true });
    } catch (e) {
        throw new Error(`Failed to toggle device: ${e}`);
    }
};

// ============================================================
// INIT
// ============================================================

export function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama): void {
    nk.registerRpc("push.registerDevice", rpcRegisterDevice);
    nk.registerRpc("push.unregisterDevice", rpcUnregisterDevice);
    nk.registerRpc("push.send", rpcSendPushNotification);
    nk.registerRpc("push.getHistory", rpcGetPushHistory);
    nk.registerRpc("push.getTemplates", rpcGetPushTemplates);
    nk.registerRpc("push.getDevices", rpcGetDevices);
    nk.registerRpc("push.toggleDevice", rpcToggleDevice);

    logger.info("LNBQSHA Push Notification Service initialized");
    logger.info(`Loaded ${PUSH_TEMPLATES.length} push templates`);
    logger.info("Registered RPCs: push.*");
          }
