// LNBQSHA Product Layer — Friend Activity Feed
// Real-time friend activity tracking and feed

import { nkruntime } from "nakama-runtime";

// ============================================================
// TYPES
// ============================================================

interface FriendActivity {
    id: string;
    userId: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    type: "started_game" | "finished_game" | "achievement" | "level_up" | 
           "joined_clan" | "purchased_item" | "daily_login" | 
           "claimed_reward" | "followed" | "joined_party";
    message: string;
    metadata: any;
    timestamp: number;
    read: boolean;
}

// ============================================================
// CONSTANTS
// ============================================================

const COLLECTION_FRIEND_ACTIVITY = "lnbqsha_friend_activity";
const MAX_ACTIVITIES_PER_USER = 100;
const ACTIVITY_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

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

function getFriendActivities(nk: nkruntime.Nakama, userId: string): FriendActivity[] {
    const result = nk.storageRead([
        { collection: COLLECTION_FRIEND_ACTIVITY, key: userId, userId }
    ]);

    if (result && result.length > 0 && result[0].value) {
        return result[0].value as FriendActivity[];
    }
    return [];
}

function saveFriendActivities(nk: nkruntime.Nakama, userId: string, activities: FriendActivity[]): void {
    // Sort by timestamp descending
    activities.sort((a, b) => b.timestamp - a.timestamp);
    
    // Limit to MAX_ACTIVITIES_PER_USER
    if (activities.length > MAX_ACTIVITIES_PER_USER) {
        activities = activities.slice(0, MAX_ACTIVITIES_PER_USER);
    }

    nk.storageWrite([{
        collection: COLLECTION_FRIEND_ACTIVITY,
        key: userId,
        userId,
        value: activities,
        permissionRead: 1,
        permissionWrite: 1
    }]);
}

function addFriendActivity(
    nk: nkruntime.Nakama,
    userId: string,
    type: FriendActivity["type"],
    message: string,
    metadata: any
): void {
    const user = nk.usersGetId([userId])[0];
    const username = user?.username || "unknown";
    const state = nk.storageRead([
        { collection: "lnbqsha_player_state", key: "state", userId }
    ]);
    let displayName = username;
    let avatarUrl = "";
    if (state && state.length > 0 && state[0].value) {
        const playerState = state[0].value;
        displayName = playerState.displayName || username;
        avatarUrl = playerState.avatarUrl || "";
    }

    const activity: FriendActivity = {
        id: generateUUID(),
        userId,
        username,
        displayName,
        avatarUrl,
        type,
        message,
        metadata: metadata || {},
        timestamp: Date.now(),
        read: false
    };

    // Get all friends of this user
    const friendsResult = nk.rpc("social.getFriends", JSON.stringify({}));
    const friends = JSON.parse(friendsResult);

    // Add activity to each friend's feed
    for (const friend of friends) {
        const friendId = friend.userId;
        const activities = getFriendActivities(nk, friendId);
        activities.unshift(activity);
        saveFriendActivities(nk, friendId, activities);

        // Send notification to friend
        try {
            const notifyPayload = JSON.stringify({
                type: "friend_activity",
                title: `${displayName} is active!`,
                message: message,
                data: { userId, activity }
            });
            nk.rpc("notification.send", notifyPayload);
        } catch (e) {
            // Ignore
        }
    }
}

// ============================================================
// RPC: Get friend activity feed
// ============================================================

export const rpcGetFriendActivity: nkruntime.RpcFunction = (
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

        const activities = getFriendActivities(nk, userId);
        const paginated = activities.slice(offset, offset + limit);

        // Mark as read
        activities.forEach(a => a.read = true);
        saveFriendActivities(nk, userId, activities);

        return JSON.stringify({
            activities: paginated,
            total: activities.length,
            offset,
            limit
        });
    } catch (e) {
        throw new Error(`Failed to get friend activity: ${e}`);
    }
};

// ============================================================
// RPC: Record friend activity (called from other modules)
// ============================================================

export const rpcRecordFriendActivity: nkruntime.RpcFunction = (
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
        const type: FriendActivity["type"] = data.type;
        const message: string = data.message || "";
        const metadata: any = data.metadata || {};

        if (!type) {
            throw new Error("type required");
        }

        addFriendActivity(nk, userId, type, message, metadata);

        return JSON.stringify({ success: true });
    } catch (e) {
        throw new Error(`Failed to record friend activity: ${e}`);
    }
};

// ============================================================
// RPC: Get unread activity count
// ============================================================

export const rpcGetUnreadActivityCount: nkruntime.RpcFunction = (
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

        const activities = getFriendActivities(nk, userId);
        const unreadCount = activities.filter(a => !a.read).length;

        return JSON.stringify({ unreadCount });
    } catch (e) {
        throw new Error(`Failed to get unread activity count: ${e}`);
    }
};

// ============================================================
// RPC: Mark activity as read
// ============================================================

export const rpcMarkActivityRead: nkruntime.RpcFunction = (
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
        const activityId: string = data.activityId;

        if (!activityId) {
            throw new Error("activityId required");
        }

        const activities = getFriendActivities(nk, userId);
        const activity = activities.find(a => a.id === activityId);
        if (activity) {
            activity.read = true;
            saveFriendActivities(nk, userId, activities);
        }

        return JSON.stringify({ success: true });
    } catch (e) {
        throw new Error(`Failed to mark activity as read: ${e}`);
    }
};

// ============================================================
// RPC: Mark all activities as read
// ============================================================

export const rpcMarkAllActivityRead: nkruntime.RpcFunction = (
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

        const activities = getFriendActivities(nk, userId);
        activities.forEach(a => a.read = true);
        saveFriendActivities(nk, userId, activities);

        return JSON.stringify({ success: true });
    } catch (e) {
        throw new Error(`Failed to mark all activities as read: ${e}`);
    }
};

// ============================================================
// RPC: Delete activity
// ============================================================

export const rpcDeleteActivity: nkruntime.RpcFunction = (
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
        const activityId: string = data.activityId;

        if (!activityId) {
            throw new Error("activityId required");
        }

        const activities = getFriendActivities(nk, userId);
        const filtered = activities.filter(a => a.id !== activityId);
        saveFriendActivities(nk, userId, filtered);

        return JSON.stringify({ success: true });
    } catch (e) {
        throw new Error(`Failed to delete activity: ${e}`);
    }
};

// ============================================================
// RPC: Get activity stats
// ============================================================

export const rpcGetActivityStats: nkruntime.RpcFunction = (
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

        const activities = getFriendActivities(nk, userId);
        const now = Date.now();
        const today = new Date().setHours(0, 0, 0, 0);

        const todayActivities = activities.filter(a => a.timestamp >= today);
        const weekActivities = activities.filter(a => a.timestamp >= now - 7 * 24 * 60 * 60 * 1000);

        // Count by type
        const typeCounts: Record<string, number> = {};
        activities.forEach(a => {
            typeCounts[a.type] = (typeCounts[a.type] || 0) + 1;
        });

        return JSON.stringify({
            total: activities.length,
            today: todayActivities.length,
            week: weekActivities.length,
            unread: activities.filter(a => !a.read).length,
            byType: typeCounts
        });
    } catch (e) {
        throw new Error(`Failed to get activity stats: ${e}`);
    }
};

// ============================================================
// INIT
// ============================================================

export function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama): void {
    nk.registerRpc("friendActivity.get", rpcGetFriendActivity);
    nk.registerRpc("friendActivity.record", rpcRecordFriendActivity);
    nk.registerRpc("friendActivity.unreadCount", rpcGetUnreadActivityCount);
    nk.registerRpc("friendActivity.markRead", rpcMarkActivityRead);
    nk.registerRpc("friendActivity.markAllRead", rpcMarkAllActivityRead);
    nk.registerRpc("friendActivity.delete", rpcDeleteActivity);
    nk.registerRpc("friendActivity.stats", rpcGetActivityStats);

    logger.info("LNBQSHA Friend Activity Feed initialized");
    logger.info("Registered RPCs: friendActivity.*");
      }
