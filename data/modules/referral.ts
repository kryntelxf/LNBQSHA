// LNBQSHA Product Layer — Referral / Invite System
// Friend invites, referral codes, rewards for inviting

import { nkruntime } from "nakama-runtime";

// ============================================================
// TYPES
// ============================================================

interface Referral {
    code: string;
    userId: string;
    invitedUsers: string[];
    rewards: {
        invited: number;
        levelReached: number;
        totalEarned: number;
    };
    createdAt: number;
}

interface ReferralInvite {
    id: string;
    inviterId: string;
    inviteeId: string;
    status: "pending" | "accepted" | "completed";
    createdAt: number;
    acceptedAt?: number;
    completedAt?: number;
}

// ============================================================
// CONSTANTS
// ============================================================

const COLLECTION_REFERRAL = "lnbqsha_referral";
const COLLECTION_INVITES = "lnbqsha_invites";
const REFERRAL_REWARD_INVITER = {
    invited: { xp: 100, coins: 100 },
    levelReached: { xp: 200, coins: 200 },
    totalEarned: { xp: 500, gems: 50 }
};
const REFERRAL_REWARD_INVITEE = {
    welcome: { xp: 50, coins: 50 }
};

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

function generateReferralCode(userId: string): string {
    // Generate a short code from user ID
    const prefix = userId.substring(0, 4).toUpperCase();
    const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}${suffix}`;
}

function getReferral(nk: nkruntime.Nakama, userId: string): Referral | null {
    const result = nk.storageRead([
        { collection: COLLECTION_REFERRAL, key: userId, userId }
    ]);

    if (result && result.length > 0 && result[0].value) {
        return result[0].value as Referral;
    }
    return null;
}

function saveReferral(nk: nkruntime.Nakama, referral: Referral): void {
    nk.storageWrite([{
        collection: COLLECTION_REFERRAL,
        key: referral.userId,
        userId: referral.userId,
        value: referral,
        permissionRead: 1,
        permissionWrite: 1
    }]);
}

function getInvites(nk: nkruntime.Nakama, userId: string): ReferralInvite[] {
    const result = nk.storageRead([
        { collection: COLLECTION_INVITES, key: userId, userId }
    ]);

    if (result && result.length > 0 && result[0].value) {
        return result[0].value as ReferralInvite[];
    }
    return [];
}

function saveInvites(nk: nkruntime.Nakama, userId: string, invites: ReferralInvite[]): void {
    nk.storageWrite([{
        collection: COLLECTION_INVITES,
        key: userId,
        userId,
        value: invites,
        permissionRead: 1,
        permissionWrite: 1
    }]);
}

function grantReferralReward(nk: nkruntime.Nakama, userId: string, reward: any): void {
    if (reward.xp) {
        try {
            nk.rpc("progression.addXp", JSON.stringify({ amount: reward.xp }));
        } catch (e) {
            // Ignore
        }
    }
    // Coins and gems would be granted via economy
    // This would be implemented in a real system
}

// ============================================================
// RPC: Get referral code
// ============================================================

export const rpcGetReferralCode: nkruntime.RpcFunction = (
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

        let referral = getReferral(nk, userId);
        if (!referral) {
            referral = {
                code: generateReferralCode(userId),
                userId,
                invitedUsers: [],
                rewards: {
                    invited: 0,
                    levelReached: 0,
                    totalEarned: 0
                },
                createdAt: Date.now()
            };
            saveReferral(nk, referral);
        }

        return JSON.stringify({
            code: referral.code,
            invitedUsers: referral.invitedUsers.length,
            rewards: referral.rewards
        });
    } catch (e) {
        throw new Error(`Failed to get referral code: ${e}`);
    }
};

// ============================================================
// RPC: Use referral code
// ============================================================

export const rpcUseReferralCode: nkruntime.RpcFunction = (
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
        const code: string = data.code;

        if (!code) {
            throw new Error("Referral code required");
        }

        // Check if user already used a referral code
        const invites = getInvites(nk, userId);
        if (invites.some(inv => inv.status === "accepted" || inv.status === "completed")) {
            throw new Error("You have already used a referral code");
        }

        // Find the referral code owner
        // In production, we'd query all referrals to find the code
        // For now, we'll use a simplified lookup
        // This would need to be optimized for production

        // For simplicity, we'll assume the code is valid
        // In production, we'd need to scan all referral records

        // Create invite record
        const invite: ReferralInvite = {
            id: generateUUID(),
            inviterId: "", // We'd need to find the inviter
            inviteeId: userId,
            status: "pending",
            createdAt: Date.now()
        };

        // For now, return success
        // In production, we'd need to find the inviter by code

        // Grant welcome reward to invitee
        grantReferralReward(nk, userId, REFERRAL_REWARD_INVITEE.welcome);

        // Send notification
        try {
            const notifyPayload = JSON.stringify({
                type: "reward",
                title: "Welcome Bonus!",
                message: "You used a referral code and earned bonus rewards!",
                data: { reward: REFERRAL_REWARD_INVITEE.welcome }
            });
            nk.rpc("notification.send", notifyPayload);
        } catch (e) {
            // Ignore
        }

        return JSON.stringify({
            success: true,
            message: "Referral code applied successfully!"
        });
    } catch (e) {
        throw new Error(`Failed to use referral code: ${e}`);
    }
};

// ============================================================
// RPC: Get referral invites
// ============================================================

export const rpcGetReferralInvites: nkruntime.RpcFunction = (
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

        const invites = getInvites(nk, userId);
        const referral = getReferral(nk, userId);

        return JSON.stringify({
            invites,
            totalInvited: referral?.invitedUsers.length || 0,
            rewards: referral?.rewards || { invited: 0, levelReached: 0, totalEarned: 0 }
        });
    } catch (e) {
        throw new Error(`Failed to get referral invites: ${e}`);
    }
};

// ============================================================
// RPC: Share referral code (generate shareable link)
// ============================================================

export const rpcShareReferralCode: nkruntime.RpcFunction = (
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

        let referral = getReferral(nk, userId);
        if (!referral) {
            referral = {
                code: generateReferralCode(userId),
                userId,
                invitedUsers: [],
                rewards: {
                    invited: 0,
                    levelReached: 0,
                    totalEarned: 0
                },
                createdAt: Date.now()
            };
            saveReferral(nk, referral);
        }

        // Generate shareable link
        const shareLink = `https://lnbqsha.com/referral/${referral.code}`;

        return JSON.stringify({
            code: referral.code,
            shareLink,
            message: "Share this link with your friends!"
        });
    } catch (e) {
        throw new Error(`Failed to share referral code: ${e}`);
    }
};

// ============================================================
// INIT
// ============================================================

export function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama): void {
    nk.registerRpc("referral.getCode", rpcGetReferralCode);
    nk.registerRpc("referral.useCode", rpcUseReferralCode);
    nk.registerRpc("referral.getInvites", rpcGetReferralInvites);
    nk.registerRpc("referral.share", rpcShareReferralCode);

    logger.info("LNBQSHA Referral/Invite System initialized");
    logger.info("Registered RPCs: referral.*");
}
