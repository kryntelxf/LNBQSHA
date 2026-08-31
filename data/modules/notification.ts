// LNBQSHA Product Layer — Notification System
// Real-time notifications, in-app alerts

import { nkruntime } from "nakama-runtime";

// ============================================================
// TYPES
// ============================================================

interface Notification {
    id: string;
    userId: string;
    type: "follow" | "friend_request" | "party_invite" | "clan_invite" | 
           "game_start" | "tournament_start" | "achievement" | "level_up" |
           "reward" | "clan_message" | "party_message";
    title: string;
    message: string;
    data?: any;
    read: boolean;
    createdAt: number;
    expiresAt?: number;
}

interface NotificationPreferences {
    userId: string;
    follow: boolean;
    friendRequest: boolean;
    partyInvite: boolean;
    clanInvite: boolean;
    gameStart: boolean;
    tournamentStart: boolean;
    achievement: boolean;
    levelUp: boolean;
    reward: boolean;
    clanMessage: boolean;
    partyMessage: boolean;
}

// ============================================================
// CONSTANTS
// ============================================================

const COLLECTION_NOTIFICATION = "lnbqsha_notification";
const COLLECTION_NOTIFICATION_PREF = "lnbqsha_notification_pref";
const NOTIFICATION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_NOTIFICATIONS = 100;

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

function getNotifications(nk: nkruntime.Nakama, userId: string): Notification[] {
    const result = nk.storageRead([
        { collection: COLLECTION_NOTIFICATION, key: userId, userId }
    ]);

    if (result && result.length > 0 && result[0].value) {
        return result[0].value as Notification[];
    }
    return [];
}

function saveNotifications(nk: nkruntime.Nakama, userId: string, notifications: Notification[]): void {
    // Sort by newest first
    notifications.sort((a, b) => b.createdAt - a.createdAt);
    
    // Limit to MAX_NOTIFICATIONS
    if (notifications.length > MAX_NOTIFICATIONS) {
        notifications = notifications.slice(0, MAX_NOTIFICATIONS);
    }

    nk.storageWrite([{
        collection: COLLECTION_NOTIFICATION,
        key: userId,
        userId,
        value: notifications,
        permissionRead: 1,
        permissionWrite: 1
    }]);
}

function getNotificationPreferences(nk: nkruntime.Nakama, userId: string): NotificationPreferences {
    const result = nk.storageRead([
        { collection: COLLECTION_NOTIFICATION_PREF, key: userId, userId }
    ]);

    if (result && result.length > 0 && result[0].value) {
        return result[0].value as NotificationPreferences;
    }

    // Default preferences (all enabled)
    const defaultPrefs: NotificationPreferences = {
        userId,
        follow: true,
        friendRequest: true,
        partyInvite: true,
        clanInvite: true,
        gameStart: true,
        tournamentStart: true,
        achievement: true,
        levelUp: true,
        reward: true,
        clanMessage: true,
        partyMessage: true
    };

    nk.storageWrite([{
        collection: COLLECTION_NOTIFICATION_PREF,
        key: userId,
        userId,
        value: defaultPrefs,
        permissionRead: 1,
        permissionWrite: 1
    }]);

    return defaultPrefs;
}

function shouldSendNotification(
    prefs: NotificationPreferences,
    type: Notification["type"]
): boolean {
    switch (type) {
        case "follow": return prefs.follow;
        case "friend_request": return prefs.friendRequest;
        case "party_invite": return prefs.partyInvite;
        case "clan_invite": return prefs.clanInvite;
        case "game_start": return prefs.gameStart;
        case "tournament_start": return prefs.tournamentStart;
        case "achievement": return prefs.achievement;
        case "level_up": return prefs.levelUp;
        case "reward": return prefs.reward;
        case "clan_message": return prefs.clanMessage;
        case "party_message": return prefs.partyMessage;
        default: return true;
    }
}

function sendNotification(
    nk: nkruntime.Nakama,
    userId: string,
    type: Notification["type"],
    title: string,
    message: string,
    data?: any,
    expiresAt?: number
): void {
    // Check preferences
    const prefs = getNotificationPreferences(nk, userId);
    if (!shouldSendNotification(prefs, type)) {
        return;
    }

    const notifications = getNotifications(nk, userId);
    
    const notification: Notification = {
        id: generateUUID(),
        userId,
        type,
        title,
        message,
        data: data || {},
        read: false,
        createdAt: Date.now(),
        expiresAt: expiresAt || Date.now() + NOTIFICATION_TTL
    };

    notifications.unshift(notification);
    saveNotifications(nk, userId, notifications);

    // Send push notification (if configured)
    // This would integrate with Firebase Cloud Messaging, etc.
    // For now, we just store the notification
}

// ============================================================
// RPC: Get notifications
// ============================================================

export const rpcGetNotifications: nkruntime.RpcFunction = (
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

        const notifications = getNotifications(nk, userId);
        const unreadCount = notifications.filter(n => !n.read).length;
        const paginated = notifications.slice(offset, offset + limit);

        return JSON.stringify({
            notifications: paginated,
            unreadCount,
            total: notifications.length,
            offset,
            limit
        });
    } catch (e) {
        throw new Error(`Failed to get notifications: ${e}`);
    }
};

// ============================================================
// RPC: Mark notification as read
// ============================================================

export const rpcMarkNotificationRead: nkruntime.RpcFunction = (
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
        const notificationId: string = data.notificationId;

        if (!notificationId) {
            throw new Error("notificationId required");
        }

        const notifications = getNotifications(nk, userId);
        const notification = notifications.find(n => n.id === notificationId);
        if (!notification) {
            throw new Error("Notification not found");
        }

        notification.read = true;
        saveNotifications(nk, userId, notifications);

        return JSON.stringify({ success: true });
    } catch (e) {
        throw new Error(`Failed to mark notification as read: ${e}`);
    }
};

// ============================================================
// RPC: Mark all notifications as read
// ============================================================

export const rpcMarkAllNotificationsRead: nkruntime.RpcFunction = (
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

        const notifications = getNotifications(nk, userId);
        notifications.forEach(n => n.read = true);
        saveNotifications(nk, userId, notifications);

        return JSON.stringify({ success: true });
    } catch (e) {
        throw new Error(`Failed to mark all notifications as read: ${e}`);
    }
};

// ============================================================
// RPC: Delete notification
// ============================================================

export const rpcDeleteNotification: nkruntime.RpcFunction = (
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
        const notificationId: string = data.notificationId;

        if (!notificationId) {
            throw new Error("notificationId required");
        }

        const notifications = getNotifications(nk, userId);
        const filtered = notifications.filter(n => n.id !== notificationId);
        saveNotifications(nk, userId, filtered);

        return JSON.stringify({ success: true });
    } catch (e) {
        throw new Error(`Failed to delete notification: ${e}`);
    }
};

// ============================================================
// RPC: Update notification preferences
// ============================================================

export const rpcUpdateNotificationPreferences: nkruntime.RpcFunction = (
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
        const prefs = getNotificationPreferences(nk, userId);

        if (data.follow !== undefined) prefs.follow = data.follow;
        if (data.friendRequest !== undefined) prefs.friendRequest = data.friendRequest;
        if (data.partyInvite !== undefined) prefs.partyInvite = data.partyInvite;
        if (data.clanInvite !== undefined) prefs.clanInvite = data.clanInvite;
        if (data.gameStart !== undefined) prefs.gameStart = data.gameStart;
        if (data.tournamentStart !== undefined) prefs.tournamentStart = data.tournamentStart;
        if (data.achievement !== undefined) prefs.achievement = data.achievement;
        if (data.levelUp !== undefined) prefs.levelUp = data.levelUp;
        if (data.reward !== undefined) prefs.reward = data.reward;
        if (data.clanMessage !== undefined) prefs.clanMessage = data.clanMessage;
        if (data.partyMessage !== undefined) prefs.partyMessage = data.partyMessage;

        nk.storageWrite([{
            collection: COLLECTION_NOTIFICATION_PREF,
            key: userId,
            userId,
            value: prefs,
            permissionRead: 1,
            permissionWrite: 1
        }]);

        return JSON.stringify(prefs);
    } catch (e) {
        throw new Error(`Failed to update notification preferences: ${e}`);
    }
};

// ============================================================
// RPC: Get notification preferences
// ============================================================

export const rpcGetNotificationPreferences: nkruntime.RpcFunction = (
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

        const prefs = getNotificationPreferences(nk, userId);
        return JSON.stringify(prefs);
    } catch (e) {
        throw new Error(`Failed to get notification preferences: ${e}`);
    }
};

// ============================================================
// INTERNAL FUNCTIONS (for other modules to use)
// ============================================================

export function sendNotificationToUser(
    nk: nkruntime.Nakama,
    userId: string,
    type: Notification["type"],
    title: string,
    message: string,
    data?: any
): void {
    sendNotification(nk, userId, type, title, message, data);
}

export function sendNotificationToMultipleUsers(
    nk: nkruntime.Nakama,
    userIds: string[],
    type: Notification["type"],
    title: string,
    message: string,
    data?: any
): void {
    for (const userId of userIds) {
        sendNotification(nk, userId, type, title, message, data);
    }
}

// ============================================================
// INIT
// ============================================================

export function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama): void {
    nk.registerRpc("notification.get", rpcGetNotifications);
    nk.registerRpc("notification.markRead", rpcMarkNotificationRead);
    nk.registerRpc("notification.markAllRead", rpcMarkAllNotificationsRead);
    nk.registerRpc("notification.delete", rpcDeleteNotification);
    nk.registerRpc("notification.getPrefs", rpcGetNotificationPreferences);
    nk.registerRpc("notification.updatePrefs", rpcUpdateNotificationPreferences);

    logger.info("LNBQSHA Notification Module initialized");
    logger.info("Registered RPCs: notification.*");
  }
