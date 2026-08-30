// LNBQSHA Product Layer — Social Discovery Module
// Friends-of-friends, presence, activity feed, party system

import { nkruntime } from "nakama-runtime";

// ============================================================
// TYPES
// ============================================================

interface Activity {
    id: string;
    userId: string;
    username: string;
    type: "started_game" | "finished_game" | "achievement" | "level_up" | "joined_party" | "followed";
    metadata: any;
    timestamp: number;
}

// ============================================================
// CONSTANTS
// ============================================================

const COLLECTION_ACTIVITY = "lnbqsha_activity_feed";

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

// ============================================================
// RPC: Get friends-of-friends
// ============================================================

export const rpcGetFriendsOfFriends: nkruntime.RpcFunction = (
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

        const limit = 50;
        const data = JSON.parse(payload || "{}");
        const cursor = data.cursor || "";

        // Gunakan API Nakama native
        const result = nk.friendsOfFriendsList(userId, limit, cursor);
        return JSON.stringify(result);
    } catch (e) {
        throw new Error(`Failed to get friends of friends: ${e}`);
    }
};

// ============================================================
// RPC: Get friends list (extended)
// ============================================================

export const rpcGetFriends: nkruntime.RpcFunction = (
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

        const limit = 100;
        const cursor = "";

        // Gunakan API Nakama native
        const result = nk.friendsList(userId, limit, cursor);
        return JSON.stringify(result);
    } catch (e) {
        throw new Error(`Failed to get friends: ${e}`);
    }
};

// ============================================================
// RPC: Follow a user
// ============================================================

export const rpcFollowUser: nkruntime.RpcFunction = (
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
        const targetUserId = data.userId;
        if (!targetUserId) {
            throw new Error("targetUserId required");
        }

        // Add as friend (Nakama native)
        nk.friendAdd(userId, targetUserId);

        // Record activity
        const user = nk.usersGetId([userId])[0];
        const targetUser = nk.usersGetId([targetUserId])[0];
        const activity: Activity = {
            id: generateUUID(),
            userId: targetUserId,
            username: targetUser?.username || "unknown",
            type: "followed",
            metadata: {
                followerId: userId,
                followerUsername: user?.username || "unknown"
            },
            timestamp: Date.now()
        };

        nk.storageWrite([{
            collection: COLLECTION_ACTIVITY,
            key: activity.id,
            userId: targetUserId,
            value: activity,
            permissionRead: 2,
            permissionWrite: 1
        }]);

        return JSON.stringify({ success: true });
    } catch (e) {
        throw new Error(`Failed to follow user: ${e}`);
    }
};

// ============================================================
// RPC: Unfollow a user
// ============================================================

export const rpcUnfollowUser: nkruntime.RpcFunction = (
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
        const targetUserId = data.userId;
        if (!targetUserId) {
            throw new Error("targetUserId required");
        }

        // Remove as friend (Nakama native)
        nk.friendRemove(userId, targetUserId);

        return JSON.stringify({ success: true });
    } catch (e) {
        throw new Error(`Failed to unfollow user: ${e}`);
    }
};

// ============================================================
// RPC: Get activity feed
// ============================================================

export const rpcGetActivityFeed: nkruntime.RpcFunction = (
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

        const limit = 50;

        // Get friends list
        const friends = nk.friendsList(userId, 100, "");
        const friendIds = friends.map((f: any) => f.userId);

        // Include self
        friendIds.push(userId);

        // Query activities from friends
        const activities: Activity[] = [];

        // Simplified: read from storage for each friend
        // In production, use a better indexing strategy
        for (const friendId of friendIds) {
            try {
                // We need a way to list activities per user
                // This is a simplified version using direct read
                // For now, we'll just return an empty list
                // TODO: Implement proper activity feed with cursor
            } catch (e) {
                // No activities
            }
        }

        // Sort by timestamp descending
        activities.sort((a, b) => b.timestamp - a.timestamp);
        const result = activities.slice(0, limit);

        return JSON.stringify({
            activities: result,
            cursor: result.length > 0 ? String(result[result.length - 1].timestamp) : ""
        });
    } catch (e) {
        throw new Error(`Failed to get activity feed: ${e}`);
    }
};

// ============================================================
// RPC: Record activity (called from game)
// ============================================================

export const rpcRecordActivity: nkruntime.RpcFunction = (
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
        const type: string = data.type;
        const metadata: any = data.metadata || {};

        if (!type) {
            throw new Error("type required");
        }

        // Get user info
        const user = nk.usersGetId([userId])[0];
        const username = user?.username || "unknown";

        const activity: Activity = {
            id: generateUUID(),
            userId: userId,
            username: username,
            type: type as any,
            metadata: metadata,
            timestamp: Date.now()
        };

        // Store activity
        nk.storageWrite([{
            collection: COLLECTION_ACTIVITY,
            key: activity.id,
            userId: userId,
            value: activity,
            permissionRead: 2,
            permissionWrite: 1
        }]);

        // Notify friends (if we had a notification system)
        // TODO: Implement push notifications

        logger.debug("Activity recorded", { userId, type });
        return JSON.stringify({ success: true });
    } catch (e) {
        throw new Error(`Failed to record activity: ${e}`);
    }
};

// ============================================================
// RPC: Get user presence (online status)
// ============================================================

export const rpcGetPresence: nkruntime.RpcFunction = (
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
        const targetUserIds: string[] = data.userIds || [];

        if (targetUserIds.length === 0) {
            return JSON.stringify({ presences: [] });
        }

        const presences = nk.statusGet(targetUserIds);
        const result = presences.map((p: any) => ({
            userId: p.userId,
            username: p.username,
            status: p.status || "offline",
            currentActivity: p.currentActivity || "",
            lastSeen: p.lastSeen || 0
        }));

        return JSON.stringify({ presences: result });
    } catch (e) {
        throw new Error(`Failed to get presence: ${e}`);
    }
};

// ============================================================
// RPC: Get online friends
// ============================================================

export const rpcGetOnlineFriends: nkruntime.RpcFunction = (
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

        // Get friends
        const friends = nk.friendsList(userId, 100, "");
        const friendIds = friends.map((f: any) => f.userId);

        if (friendIds.length === 0) {
            return JSON.stringify({ online: [] });
        }

        const presences = nk.statusGet(friendIds);
        const online = presences.map((p: any) => ({
            userId: p.userId,
            username: p.username,
            status: p.status || "offline",
            currentActivity: p.currentActivity || "",
            lastSeen: p.lastSeen || 0
        }));

        return JSON.stringify({ online });
    } catch (e) {
        throw new Error(`Failed to get online friends: ${e}`);
    }
};

// ============================================================
// INIT
// ============================================================

export function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama): void {
    // Register RPCs
    nk.registerRpc("social.friendsOfFriends", rpcGetFriendsOfFriends);
    nk.registerRpc("social.getFriends", rpcGetFriends);
    nk.registerRpc("social.follow", rpcFollowUser);
    nk.registerRpc("social.unfollow", rpcUnfollowUser);
    nk.registerRpc("social.getActivityFeed", rpcGetActivityFeed);
    nk.registerRpc("social.recordActivity", rpcRecordActivity);
    nk.registerRpc("social.getPresence", rpcGetPresence);
    nk.registerRpc("social.getOnlineFriends", rpcGetOnlineFriends);

    logger.info("LNBQSHA Social Discovery Module initialized");
    logger.info("Registered RPCs: social.*");
  }
