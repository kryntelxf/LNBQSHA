// LNBQSHA Product Layer — Player State Module
// Profile, display name, avatar, bio, status

import { nkruntime } from "nakama-runtime";

// ============================================================
// TYPES
// ============================================================

interface PlayerState {
    userId: string;
    displayName: string;
    avatarUrl: string;
    bio: string;
    status: "online" | "offline" | "playing";
    currentActivity: string;
    lastSeen: number;
    createdAt: number;
    updatedAt: number;
}

// ============================================================
// CONSTANTS
// ============================================================

const COLLECTION_PLAYER_STATE = "lnbqsha_player_state";

// ============================================================
// HELPERS
// ============================================================

function getPlayerState(nk: nkruntime.Nakama, userId: string): PlayerState {
    const result = nk.storageRead([
        { collection: COLLECTION_PLAYER_STATE, key: "state", userId }
    ]);

    if (result && result.length > 0 && result[0].value) {
        return result[0].value as PlayerState;
    }

    // Default state
    const defaultState: PlayerState = {
        userId,
        displayName: "",
        avatarUrl: "",
        bio: "",
        status: "offline",
        currentActivity: "",
        lastSeen: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    // Save default
    nk.storageWrite([{
        collection: COLLECTION_PLAYER_STATE,
        key: "state",
        userId,
        value: defaultState,
        permissionRead: 2,
        permissionWrite: 1
    }]);

    return defaultState;
}

function savePlayerState(nk: nkruntime.Nakama, userId: string, state: PlayerState): void {
    state.updatedAt = Date.now();
    nk.storageWrite([{
        collection: COLLECTION_PLAYER_STATE,
        key: "state",
        userId,
        value: state,
        permissionRead: 2,
        permissionWrite: 1
    }]);
}

// ============================================================
// RPC: Get player state
// ============================================================

export const rpcGetPlayerState: nkruntime.RpcFunction = (
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

        const state = getPlayerState(nk, userId);
        return JSON.stringify(state);
    } catch (e) {
        throw new Error(`Failed to get player state: ${e}`);
    }
};

// ============================================================
// RPC: Get player state by user ID (for viewing others)
// ============================================================

export const rpcGetPlayerStateByUserId: nkruntime.RpcFunction = (
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
            throw new Error("userId required");
        }

        const state = getPlayerState(nk, targetUserId);
        // Don't expose internal timestamps to others
        const publicState = {
            userId: state.userId,
            displayName: state.displayName,
            avatarUrl: state.avatarUrl,
            bio: state.bio,
            status: state.status,
            currentActivity: state.currentActivity
        };
        return JSON.stringify(publicState);
    } catch (e) {
        throw new Error(`Failed to get player state: ${e}`);
    }
};

// ============================================================
// RPC: Update player state
// ============================================================

export const rpcUpdatePlayerState: nkruntime.RpcFunction = (
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
        const state = getPlayerState(nk, userId);

        if (data.displayName !== undefined) {
            state.displayName = data.displayName.substring(0, 50);
        }
        if (data.avatarUrl !== undefined) {
            state.avatarUrl = data.avatarUrl;
        }
        if (data.bio !== undefined) {
            state.bio = data.bio.substring(0, 200);
        }
        if (data.status !== undefined) {
            const validStatuses = ["online", "offline", "playing"];
            if (validStatuses.includes(data.status)) {
                state.status = data.status;
            }
        }
        if (data.currentActivity !== undefined) {
            state.currentActivity = data.currentActivity.substring(0, 100);
        }

        state.lastSeen = Date.now();
        savePlayerState(nk, userId, state);

        return JSON.stringify(state);
    } catch (e) {
        throw new Error(`Failed to update player state: ${e}`);
    }
};

// ============================================================
// RPC: Set online status
// ============================================================

export const rpcSetOnline: nkruntime.RpcFunction = (
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

        const state = getPlayerState(nk, userId);
        state.status = "online";
        state.lastSeen = Date.now();

        // Also update Nakama presence
        nk.statusUpdate("online", "");

        savePlayerState(nk, userId, state);
        return JSON.stringify({ success: true });
    } catch (e) {
        throw new Error(`Failed to set online status: ${e}`);
    }
};

// ============================================================
// RPC: Set offline status
// ============================================================

export const rpcSetOffline: nkruntime.RpcFunction = (
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

        const state = getPlayerState(nk, userId);
        state.status = "offline";
        state.lastSeen = Date.now();

        savePlayerState(nk, userId, state);
        return JSON.stringify({ success: true });
    } catch (e) {
        throw new Error(`Failed to set offline status: ${e}`);
    }
};

// ============================================================
// RPC: Set playing status
// ============================================================

export const rpcSetPlaying: nkruntime.RpcFunction = (
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
        const activity: string = data.activity || "Playing";

        const state = getPlayerState(nk, userId);
        state.status = "playing";
        state.currentActivity = activity.substring(0, 100);
        state.lastSeen = Date.now();

        // Also update Nakama presence
        nk.statusUpdate("playing", activity);

        savePlayerState(nk, userId, state);
        return JSON.stringify({ success: true });
    } catch (e) {
        throw new Error(`Failed to set playing status: ${e}`);
    }
};

// ============================================================
// INIT
// ============================================================

export function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama): void {
    // Register RPCs
    nk.registerRpc("player.getState", rpcGetPlayerState);
    nk.registerRpc("player.getStateByUserId", rpcGetPlayerStateByUserId);
    nk.registerRpc("player.updateState", rpcUpdatePlayerState);
    nk.registerRpc("player.setOnline", rpcSetOnline);
    nk.registerRpc("player.setOffline", rpcSetOffline);
    nk.registerRpc("player.setPlaying", rpcSetPlaying);

    logger.info("LNBQSHA Player State Module initialized");
    logger.info("Registered RPCs: player.*");
    }
