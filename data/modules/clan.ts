// LNBQSHA Product Layer — Clan/Guild System
// Communities, clans, guilds

import { nkruntime } from "nakama-runtime";

// ============================================================
// TYPES
// ============================================================

interface Clan {
    id: string;
    name: string;
    tag: string;
    description: string;
    level: number;
    xp: number;
    xpToNextLevel: number;
    members: ClanMember[];
    maxMembers: number;
    leaderId: string;
    createdAt: number;
    updatedAt: number;
}

interface ClanMember {
    userId: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    role: "leader" | "officer" | "member";
    joinedAt: number;
    xpContributed: number;
}

interface ClanInvite {
    id: string;
    clanId: string;
    userId: string;
    invitedBy: string;
    status: "pending" | "accepted" | "rejected";
    createdAt: number;
}

// ============================================================
// CONSTANTS
// ============================================================

const COLLECTION_CLAN = "lnbqsha_clan";
const COLLECTION_CLAN_INVITE = "lnbqsha_clan_invite";
const COLLECTION_USER_CLAN = "lnbqsha_user_clan";
const MAX_CLAN_MEMBERS = 50;
const XP_PER_LEVEL = 100;

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

function getClan(nk: nkruntime.Nakama, clanId: string): Clan | null {
    const result = nk.storageRead([
        { collection: COLLECTION_CLAN, key: clanId, userId: "system" }
    ]);

    if (result && result.length > 0 && result[0].value) {
        return result[0].value as Clan;
    }
    return null;
}

function saveClan(nk: nkruntime.Nakama, clan: Clan): void {
    clan.updatedAt = Date.now();
    nk.storageWrite([{
        collection: COLLECTION_CLAN,
        key: clan.id,
        userId: "system",
        value: clan,
        permissionRead: 2,
        permissionWrite: 1
    }]);
}

function getUserClan(nk: nkruntime.Nakama, userId: string): string | null {
    const result = nk.storageRead([
        { collection: COLLECTION_USER_CLAN, key: userId, userId }
    ]);

    if (result && result.length > 0 && result[0].value) {
        return result[0].value.clanId;
    }
    return null;
}

function setUserClan(nk: nkruntime.Nakama, userId: string, clanId: string | null): void {
    if (clanId) {
        nk.storageWrite([{
            collection: COLLECTION_USER_CLAN,
            key: userId,
            userId,
            value: { clanId },
            permissionRead: 1,
            permissionWrite: 1
        }]);
    } else {
        nk.storageDelete([
            { collection: COLLECTION_USER_CLAN, key: userId, userId }
        ]);
    }
}

function getClanInvites(nk: nkruntime.Nakama, userId: string): ClanInvite[] {
    const result = nk.storageRead([
        { collection: COLLECTION_CLAN_INVITE, key: userId, userId }
    ]);

    if (result && result.length > 0 && result[0].value) {
        return result[0].value as ClanInvite[];
    }
    return [];
}

function saveClanInvites(nk: nkruntime.Nakama, userId: string, invites: ClanInvite[]): void {
    nk.storageWrite([{
        collection: COLLECTION_CLAN_INVITE,
        key: userId,
        userId,
        value: invites,
        permissionRead: 1,
        permissionWrite: 1
    }]);
}

function getClanXpForLevel(level: number): number {
    return XP_PER_LEVEL * level * level;
}

// ============================================================
// RPC: Create clan
// ============================================================

export const rpcCreateClan: nkruntime.RpcFunction = (
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
        const name: string = data.name || "";
        const tag: string = data.tag || "";
        const description: string = data.description || "";

        if (!name || name.length < 3) {
            throw new Error("Clan name must be at least 3 characters");
        }
        if (!tag || tag.length < 2 || tag.length > 5) {
            throw new Error("Clan tag must be 2-5 characters");
        }

        // Check if user already in clan
        if (getUserClan(nk, userId)) {
            throw new Error("Already in a clan");
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

        const clanId = generateUUID();
        const now = Date.now();

        const clan: Clan = {
            id: clanId,
            name,
            tag: tag.toUpperCase(),
            description,
            level: 1,
            xp: 0,
            xpToNextLevel: getClanXpForLevel(2),
            members: [{
                userId,
                username,
                displayName,
                avatarUrl,
                role: "leader",
                joinedAt: now,
                xpContributed: 0
            }],
            maxMembers: MAX_CLAN_MEMBERS,
            leaderId: userId,
            createdAt: now,
            updatedAt: now
        };

        saveClan(nk, clan);
        setUserClan(nk, userId, clanId);

        // Record activity
        try {
            const activityPayload = JSON.stringify({
                type: "joined_clan",
                metadata: { clanId, clanName: name, clanTag: tag }
            });
            nk.rpc("social.recordActivity", activityPayload);
        } catch (e) {
            // Ignore
        }

        return JSON.stringify(clan);
    } catch (e) {
        throw new Error(`Failed to create clan: ${e}`);
    }
};

// ============================================================
// RPC: Join clan
// ============================================================

export const rpcJoinClan: nkruntime.RpcFunction = (
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
        const clanId: string = data.clanId;

        if (!clanId) {
            throw new Error("clanId required");
        }

        // Check if user already in clan
        if (getUserClan(nk, userId)) {
            throw new Error("Already in a clan");
        }

        const clan = getClan(nk, clanId);
        if (!clan) {
            throw new Error("Clan not found");
        }

        if (clan.members.length >= clan.maxMembers) {
            throw new Error("Clan is full");
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

        const member: ClanMember = {
            userId,
            username,
            displayName,
            avatarUrl,
            role: "member",
            joinedAt: Date.now(),
            xpContributed: 0
        };

        clan.members.push(member);
        saveClan(nk, clan);
        setUserClan(nk, userId, clanId);

        // Record activity
        try {
            const activityPayload = JSON.stringify({
                type: "joined_clan",
                metadata: { clanId, clanName: clan.name, clanTag: clan.tag }
            });
            nk.rpc("social.recordActivity", activityPayload);
        } catch (e) {
            // Ignore
        }

        return JSON.stringify(clan);
    } catch (e) {
        throw new Error(`Failed to join clan: ${e}`);
    }
};

// ============================================================
// RPC: Leave clan
// ============================================================

export const rpcLeaveClan: nkruntime.RpcFunction = (
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

        const clanId = getUserClan(nk, userId);
        if (!clanId) {
            throw new Error("Not in a clan");
        }

        const clan = getClan(nk, clanId);
        if (!clan) {
            throw new Error("Clan not found");
        }

        // Remove member
        clan.members = clan.members.filter(m => m.userId !== userId);

        // If clan is empty, delete it
        if (clan.members.length === 0) {
            nk.storageDelete([
                { collection: COLLECTION_CLAN, key: clanId, userId: "system" }
            ]);
            setUserClan(nk, userId, null);
            return JSON.stringify({ success: true, deleted: true });
        }

        // If leader left, assign new leader
        if (clan.leaderId === userId) {
            clan.leaderId = clan.members[0].userId;
            clan.members[0].role = "leader";
        }

        saveClan(nk, clan);
        setUserClan(nk, userId, null);

        return JSON.stringify(clan);
    } catch (e) {
        throw new Error(`Failed to leave clan: ${e}`);
    }
};

// ============================================================
// RPC: Get clan
// ============================================================

export const rpcGetClan: nkruntime.RpcFunction = (
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
        const clanId: string = data.clanId;

        if (!clanId) {
            throw new Error("clanId required");
        }

        const clan = getClan(nk, clanId);
        if (!clan) {
            throw new Error("Clan not found");
        }

        return JSON.stringify(clan);
    } catch (e) {
        throw new Error(`Failed to get clan: ${e}`);
    }
};

// ============================================================
// RPC: Get user's clan
// ============================================================

export const rpcGetUserClan: nkruntime.RpcFunction = (
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

        const clanId = getUserClan(nk, userId);
        if (!clanId) {
            return JSON.stringify({ clan: null });
        }

        const clan = getClan(nk, clanId);
        if (!clan) {
            setUserClan(nk, userId, null);
            return JSON.stringify({ clan: null });
        }

        return JSON.stringify({ clan });
    } catch (e) {
        throw new Error(`Failed to get user's clan: ${e}`);
    }
};

// ============================================================
// RPC: Promote clan member
// ============================================================

export const rpcPromoteClanMember: nkruntime.RpcFunction = (
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
        const memberId: string = data.userId;

        if (!memberId) {
            throw new Error("userId required");
        }

        const clanId = getUserClan(nk, userId);
        if (!clanId) {
            throw new Error("Not in a clan");
        }

        const clan = getClan(nk, clanId);
        if (!clan) {
            throw new Error("Clan not found");
        }

        // Check if user is leader
        if (clan.leaderId !== userId) {
            throw new Error("Only clan leader can promote members");
        }

        const member = clan.members.find(m => m.userId === memberId);
        if (!member) {
            throw new Error("Member not found");
        }

        if (member.role === "leader") {
            throw new Error("Cannot promote leader");
        }

        // Promote
        member.role = "officer";
        saveClan(nk, clan);

        return JSON.stringify(clan);
    } catch (e) {
        throw new Error(`Failed to promote member: ${e}`);
    }
};

// ============================================================
// RPC: Demote clan member
// ============================================================

export const rpcDemoteClanMember: nkruntime.RpcFunction = (
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
        const memberId: string = data.userId;

        if (!memberId) {
            throw new Error("userId required");
        }

        const clanId = getUserClan(nk, userId);
        if (!clanId) {
            throw new Error("Not in a clan");
        }

        const clan = getClan(nk, clanId);
        if (!clan) {
            throw new Error("Clan not found");
        }

        // Check if user is leader
        if (clan.leaderId !== userId) {
            throw new Error("Only clan leader can demote members");
        }

        const member = clan.members.find(m => m.userId === memberId);
        if (!member) {
            throw new Error("Member not found");
        }

        if (member.role === "leader") {
            throw new Error("Cannot demote leader");
        }

        // Demote
        member.role = "member";
        saveClan(nk, clan);

        return JSON.stringify(clan);
    } catch (e) {
        throw new Error(`Failed to demote member: ${e}`);
    }
};

// ============================================================
// RPC: Add clan XP
// ============================================================

export const rpcAddClanXp: nkruntime.RpcFunction = (
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
        const amount: number = data.amount || 0;

        if (amount <= 0) {
            throw new Error("XP amount must be positive");
        }

        const clanId = getUserClan(nk, userId);
        if (!clanId) {
            throw new Error("Not in a clan");
        }

        const clan = getClan(nk, clanId);
        if (!clan) {
            throw new Error("Clan not found");
        }

        // Add XP
        clan.xp += amount;

        // Check level up
        while (clan.xp >= clan.xpToNextLevel) {
            clan.xp -= clan.xpToNextLevel;
            clan.level += 1;
            clan.xpToNextLevel = getClanXpForLevel(clan.level + 1);
        }

        // Update member contribution
        const member = clan.members.find(m => m.userId === userId);
        if (member) {
            member.xpContributed += amount;
        }

        saveClan(nk, clan);

        return JSON.stringify({
            success: true,
            level: clan.level,
            xp: clan.xp,
            xpToNextLevel: clan.xpToNextLevel
        });
    } catch (e) {
        throw new Error(`Failed to add clan XP: ${e}`);
    }
};

// ============================================================
// RPC: Get clan leaderboard
// ============================================================

export const rpcGetClanLeaderboard: nkruntime.RpcFunction = (
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    payload: string
): string => {
    try {
        // For simplicity, return an empty list
        // In production, we'd query all clans and sort by level/xp
        return JSON.stringify({
            clans: [],
            message: "Clan leaderboard coming soon"
        });
    } catch (e) {
        throw new Error(`Failed to get clan leaderboard: ${e}`);
    }
};

// ============================================================
// INIT
// ============================================================

export function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama): void {
    nk.registerRpc("clan.create", rpcCreateClan);
    nk.registerRpc("clan.join", rpcJoinClan);
    nk.registerRpc("clan.leave", rpcLeaveClan);
    nk.registerRpc("clan.get", rpcGetClan);
    nk.registerRpc("clan.getUserClan", rpcGetUserClan);
    nk.registerRpc("clan.promote", rpcPromoteClanMember);
    nk.registerRpc("clan.demote", rpcDemoteClanMember);
    nk.registerRpc("clan.addXp", rpcAddClanXp);
    nk.registerRpc("clan.leaderboard", rpcGetClanLeaderboard);

    logger.info("LNBQSHA Clan/Guild Module initialized");
    logger.info("Registered RPCs: clan.*");
      }
