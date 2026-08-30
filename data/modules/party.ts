// LNBQSHA Product Layer — Party & Matchmaking System
// Create, join, leave parties, and matchmaking

import { nkruntime } from "nakama-runtime";

// ============================================================
// TYPES
// ============================================================

interface Party {
    id: string;
    leaderId: string;
    members: PartyMember[];
    maxMembers: number;
    gameMode: string;
    createdAt: number;
}

interface PartyMember {
    userId: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    status: "ready" | "not_ready";
}

interface MatchmakingQueue {
    userId: string;
    gameMode: string;
    skillLevel: number;
    enteredAt: number;
}

// ============================================================
// CONSTANTS
// ============================================================

const COLLECTION_PARTIES = "lnbqsha_parties";
const COLLECTION_MATCHMAKING = "lnbqsha_matchmaking";
const MAX_PARTY_SIZE = 5;
const MATCHMAKING_TIMEOUT = 30000; // 30 seconds

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

function getParty(nk: nkruntime.Nakama, partyId: string): Party | null {
    const result = nk.storageRead([
        { collection: COLLECTION_PARTIES, key: partyId, userId: "system" }
    ]);

    if (result && result.length > 0 && result[0].value) {
        return result[0].value as Party;
    }
    return null;
}

function saveParty(nk: nkruntime.Nakama, party: Party): void {
    nk.storageWrite([{
        collection: COLLECTION_PARTIES,
        key: party.id,
        userId: "system",
        value: party,
        permissionRead: 2,
        permissionWrite: 1
    }]);
}

function getMatchmakingQueue(nk: nkruntime.Nakama): MatchmakingQueue[] {
    const result = nk.storageRead([
        { collection: COLLECTION_MATCHMAKING, key: "queue", userId: "system" }
    ]);

    if (result && result.length > 0 && result[0].value) {
        return result[0].value as MatchmakingQueue[];
    }
    return [];
}

function saveMatchmakingQueue(nk: nkruntime.Nakama, queue: MatchmakingQueue[]): void {
    nk.storageWrite([{
        collection: COLLECTION_MATCHMAKING,
        key: "queue",
        userId: "system",
        value: queue,
        permissionRead: 1,
        permissionWrite: 1
    }]);
}

function findMatch(queue: MatchmakingQueue[], gameMode: string, skillLevel: number): string[] {
    // Find players with same game mode and similar skill level
    const candidates = queue.filter(q => 
        q.gameMode === gameMode && 
        Math.abs(q.skillLevel - skillLevel) <= 50
    );

    if (candidates.length >= 2) {
        return candidates.map(q => q.userId);
    }
    return [];
}

// ============================================================
// RPC: Create party
// ============================================================

export const rpcCreateParty: nkruntime.RpcFunction = (
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
        const gameMode: string = data.gameMode || "default";

        // Check if user is already in a party
        // We would need to track user's current party
        // For now, create a new party

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

        const partyId = generateUUID();
        const party: Party = {
            id: partyId,
            leaderId: userId,
            members: [{
                userId,
                username,
                displayName,
                avatarUrl,
                status: "ready"
            }],
            maxMembers: MAX_PARTY_SIZE,
            gameMode,
            createdAt: Date.now()
        };

        saveParty(nk, party);

        // Store user's current party (for tracking)
        nk.storageWrite([{
            collection: "lnbqsha_user_party",
            key: userId,
            userId,
            value: { partyId },
            permissionRead: 1,
            permissionWrite: 1
        }]);

        return JSON.stringify(party);
    } catch (e) {
        throw new Error(`Failed to create party: ${e}`);
    }
};

// ============================================================
// RPC: Join party
// ============================================================

export const rpcJoinParty: nkruntime.RpcFunction = (
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
        const partyId: string = data.partyId;

        if (!partyId) {
            throw new Error("partyId required");
        }

        const party = getParty(nk, partyId);
        if (!party) {
            throw new Error("Party not found");
        }

        if (party.members.length >= party.maxMembers) {
            throw new Error("Party is full");
        }

        // Check if user is already in party
        if (party.members.some(m => m.userId === userId)) {
            throw new Error("Already in party");
        }

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

        const member: PartyMember = {
            userId,
            username,
            displayName,
            avatarUrl,
            status: "not_ready"
        };

        party.members.push(member);
        saveParty(nk, party);

        // Store user's current party
        nk.storageWrite([{
            collection: "lnbqsha_user_party",
            key: userId,
            userId,
            value: { partyId },
            permissionRead: 1,
            permissionWrite: 1
        }]);

        return JSON.stringify(party);
    } catch (e) {
        throw new Error(`Failed to join party: ${e}`);
    }
};

// ============================================================
// RPC: Leave party
// ============================================================

export const rpcLeaveParty: nkruntime.RpcFunction = (
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
        const partyId: string = data.partyId;

        if (!partyId) {
            throw new Error("partyId required");
        }

        const party = getParty(nk, partyId);
        if (!party) {
            throw new Error("Party not found");
        }

        // Remove user from party
        party.members = party.members.filter(m => m.userId !== userId);

        // If party is empty, delete it
        if (party.members.length === 0) {
            nk.storageDelete([
                { collection: COLLECTION_PARTIES, key: partyId, userId: "system" }
            ]);
            // Also delete user's party tracking
            nk.storageDelete([
                { collection: "lnbqsha_user_party", key: userId, userId }
            ]);
            return JSON.stringify({ success: true, deleted: true });
        }

        // If leader left, assign new leader
        if (party.leaderId === userId) {
            party.leaderId = party.members[0].userId;
        }

        saveParty(nk, party);

        // Delete user's party tracking
        nk.storageDelete([
            { collection: "lnbqsha_user_party", key: userId, userId }
        ]);

        return JSON.stringify(party);
    } catch (e) {
        throw new Error(`Failed to leave party: ${e}`);
    }
};

// ============================================================
// RPC: Get party
// ============================================================

export const rpcGetParty: nkruntime.RpcFunction = (
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
        const partyId: string = data.partyId;

        if (!partyId) {
            throw new Error("partyId required");
        }

        const party = getParty(nk, partyId);
        if (!party) {
            throw new Error("Party not found");
        }

        return JSON.stringify(party);
    } catch (e) {
        throw new Error(`Failed to get party: ${e}`);
    }
};

// ============================================================
// RPC: Get user's party
// ============================================================

export const rpcGetUserParty: nkruntime.RpcFunction = (
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

        const result = nk.storageRead([
            { collection: "lnbqsha_user_party", key: userId, userId }
        ]);

        if (result && result.length > 0 && result[0].value) {
            const { partyId } = result[0].value;
            const party = getParty(nk, partyId);
            if (party) {
                return JSON.stringify(party);
            }
        }

        return JSON.stringify({ party: null });
    } catch (e) {
        throw new Error(`Failed to get user's party: ${e}`);
    }
};

// ============================================================
// RPC: Start matchmaking
// ============================================================

export const rpcStartMatchmaking: nkruntime.RpcFunction = (
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
        const gameMode: string = data.gameMode || "default";

        // Get user's progression
        const progressionResult = nk.storageRead([
            { collection: "lnbqsha_progression", key: "data", userId }
        ]);
        let skillLevel = 0;
        if (progressionResult && progressionResult.length > 0 && progressionResult[0].value) {
            skillLevel = progressionResult[0].value.level || 0;
        }

        // Check if already in queue
        const queue = getMatchmakingQueue(nk);
        if (queue.some(q => q.userId === userId)) {
            throw new Error("Already in matchmaking queue");
        }

        // Add to queue
        const entry: MatchmakingQueue = {
            userId,
            gameMode,
            skillLevel,
            enteredAt: Date.now()
        };
        queue.push(entry);
        saveMatchmakingQueue(nk, queue);

        // Try to find a match immediately
        const matchedUsers = findMatch(queue, gameMode, skillLevel);
        if (matchedUsers.length >= 2) {
            // Remove matched users from queue
            const newQueue = queue.filter(q => !matchedUsers.includes(q.userId));
            saveMatchmakingQueue(nk, newQueue);

            // Create a match (or return the matched users)
            return JSON.stringify({
                success: true,
                matched: true,
                users: matchedUsers,
                gameMode
            });
        }

        return JSON.stringify({
            success: true,
            matched: false,
            queuePosition: queue.length
        });
    } catch (e) {
        throw new Error(`Failed to start matchmaking: ${e}`);
    }
};

// ============================================================
// RPC: Cancel matchmaking
// ============================================================

export const rpcCancelMatchmaking: nkruntime.RpcFunction = (
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

        const queue = getMatchmakingQueue(nk);
        const newQueue = queue.filter(q => q.userId !== userId);
        saveMatchmakingQueue(nk, newQueue);

        return JSON.stringify({ success: true });
    } catch (e) {
        throw new Error(`Failed to cancel matchmaking: ${e}`);
    }
};

// ============================================================
// INIT
// ============================================================

export function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama): void {
    // Register RPCs
    nk.registerRpc("party.create", rpcCreateParty);
    nk.registerRpc("party.join", rpcJoinParty);
    nk.registerRpc("party.leave", rpcLeaveParty);
    nk.registerRpc("party.get", rpcGetParty);
    nk.registerRpc("party.getUserParty", rpcGetUserParty);
    nk.registerRpc("matchmaking.start", rpcStartMatchmaking);
    nk.registerRpc("matchmaking.cancel", rpcCancelMatchmaking);

    logger.info("LNBQSHA Party & Matchmaking Module initialized");
    logger.info("Registered RPCs: party.*, matchmaking.*");
}
