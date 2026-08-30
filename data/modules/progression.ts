// LNBQSHA Product Layer — Progression System
// Level, XP, Achievements, Daily Rewards

import { nkruntime } from "nakama-runtime";

// ============================================================
// TYPES
// ============================================================

interface ProgressionData {
    userId: string;
    level: number;
    xp: number;
    xpToNextLevel: number;
    totalXp: number;
    achievements: Achievement[];
    dailyRewards: DailyReward[];
    lastDailyClaim: number;
    streak: number;
}

interface Achievement {
    id: string;
    name: string;
    description: string;
    unlocked: boolean;
    unlockedAt?: number;
    progress?: number;
    maxProgress?: number;
}

interface DailyReward {
    day: number;
    claimed: boolean;
    reward: string;
    claimedAt?: number;
}

// ============================================================
// CONSTANTS
// ============================================================

const COLLECTION_PROGRESSION = "lnbqsha_progression";

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

function xpForLevel(level: number): number {
    return Math.floor(100 * Math.pow(1.5, level - 1));
}

function getProgression(nk: nkruntime.Nakama, userId: string): ProgressionData {
    const result = nk.storageRead([
        { collection: COLLECTION_PROGRESSION, key: "data", userId }
    ]);

    if (result && result.length > 0 && result[0].value) {
        return result[0].value as ProgressionData;
    }

    // Default progression
    const defaultData: ProgressionData = {
        userId,
        level: 1,
        xp: 0,
        xpToNextLevel: xpForLevel(2),
        totalXp: 0,
        achievements: [],
        dailyRewards: [
            { day: 1, claimed: false, reward: "100 coins" },
            { day: 2, claimed: false, reward: "150 coins" },
            { day: 3, claimed: false, reward: "200 coins + XP boost" },
            { day: 4, claimed: false, reward: "250 coins" },
            { day: 5, claimed: false, reward: "300 coins + rare item" },
            { day: 6, claimed: false, reward: "400 coins" },
            { day: 7, claimed: false, reward: "500 coins + legendary item" },
        ],
        lastDailyClaim: 0,
        streak: 0
    };

    // Save default
    nk.storageWrite([{
        collection: COLLECTION_PROGRESSION,
        key: "data",
        userId,
        value: defaultData,
        permissionRead: 1,
        permissionWrite: 1
    }]);

    return defaultData;
}

function saveProgression(nk: nkruntime.Nakama, userId: string, data: ProgressionData): void {
    nk.storageWrite([{
        collection: COLLECTION_PROGRESSION,
        key: "data",
        userId,
        value: data,
        permissionRead: 1,
        permissionWrite: 1
    }]);
}

function addXp(nk: nkruntime.Nakama, userId: string, amount: number): ProgressionData {
    const data = getProgression(nk, userId);
    data.xp += amount;
    data.totalXp += amount;

    // Level up check
    while (data.xp >= data.xpToNextLevel) {
        data.xp -= data.xpToNextLevel;
        data.level += 1;
        data.xpToNextLevel = xpForLevel(data.level);

        // Level up achievement
        const achievement: Achievement = {
            id: `level_${data.level}`,
            name: `Level ${data.level} Achieved!`,
            description: `Reached level ${data.level}`,
            unlocked: true,
            unlockedAt: Date.now()
        };
        data.achievements.push(achievement);

        // Record activity
        try {
            // Call social.recordActivity via nk.rpc
            const payload = JSON.stringify({
                type: "level_up",
                metadata: { level: data.level }
            });
            nk.rpc("social.recordActivity", payload);
        } catch (e) {
            // Ignore
        }
    }

    saveProgression(nk, userId, data);
    return data;
}

// ============================================================
// RPC: Get progression
// ============================================================

export const rpcGetProgression: nkruntime.RpcFunction = (
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

        const data = getProgression(nk, userId);
        return JSON.stringify(data);
    } catch (e) {
        throw new Error(`Failed to get progression: ${e}`);
    }
};

// ============================================================
// RPC: Add XP (called from game)
// ============================================================

export const rpcAddXp: nkruntime.RpcFunction = (
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

        const result = addXp(nk, userId, amount);
        return JSON.stringify(result);
    } catch (e) {
        throw new Error(`Failed to add XP: ${e}`);
    }
};

// ============================================================
// RPC: Unlock achievement
// ============================================================

export const rpcUnlockAchievement: nkruntime.RpcFunction = (
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
        const achievementId: string = data.achievementId;
        const name: string = data.name || achievementId;
        const description: string = data.description || "";

        if (!achievementId) {
            throw new Error("achievementId required");
        }

        const progression = getProgression(nk, userId);

        // Check if already unlocked
        const existing = progression.achievements.find(a => a.id === achievementId);
        if (existing && existing.unlocked) {
            return JSON.stringify(progression);
        }

        const achievement: Achievement = {
            id: achievementId,
            name,
            description,
            unlocked: true,
            unlockedAt: Date.now()
        };

        progression.achievements.push(achievement);
        saveProgression(nk, userId, progression);

        // Record activity
        try {
            const payload = JSON.stringify({
                type: "achievement",
                metadata: { achievementId, name }
            });
            nk.rpc("social.recordActivity", payload);
        } catch (e) {
            // Ignore
        }

        return JSON.stringify(progression);
    } catch (e) {
        throw new Error(`Failed to unlock achievement: ${e}`);
    }
};

// ============================================================
// RPC: Claim daily reward
// ============================================================

export const rpcClaimDailyReward: nkruntime.RpcFunction = (
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

        const progression = getProgression(nk, userId);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTs = today.getTime();

        // Check if already claimed today
        if (progression.lastDailyClaim >= todayTs) {
            throw new Error("Daily reward already claimed today");
        }

        // Check if streak should reset
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayTs = yesterday.getTime();

        if (progression.lastDailyClaim < yesterdayTs) {
            progression.streak = 0;
        }

        // Calculate which day to claim
        let dayIndex = progression.streak % 7;
        const reward = progression.dailyRewards[dayIndex];

        if (!reward) {
            throw new Error("Invalid daily reward");
        }

        if (reward.claimed) {
            throw new Error("Reward already claimed");
        }

        // Claim the reward
        reward.claimed = true;
        reward.claimedAt = Date.now();
        progression.streak += 1;
        progression.lastDailyClaim = todayTs;

        // Give XP bonus for streak
        const xpBonus = progression.streak * 10;
        if (xpBonus > 0) {
            addXp(nk, userId, xpBonus);
        }

        // Reset daily rewards if all claimed
        const allClaimed = progression.dailyRewards.every(r => r.claimed);
        if (allClaimed) {
            progression.dailyRewards.forEach(r => r.claimed = false);
        }

        saveProgression(nk, userId, progression);

        // Record activity
        try {
            const payload = JSON.stringify({
                type: "claimed_reward",
                metadata: { day: dayIndex + 1, reward: reward.reward, streak: progression.streak }
            });
            nk.rpc("social.recordActivity", payload);
        } catch (e) {
            // Ignore
        }

        return JSON.stringify({
            reward: reward.reward,
            streak: progression.streak,
            xpBonus,
            progression
        });
    } catch (e) {
        throw new Error(`Failed to claim daily reward: ${e}`);
    }
};

// ============================================================
// INIT
// ============================================================

export function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama): void {
    // Register RPCs
    nk.registerRpc("progression.get", rpcGetProgression);
    nk.registerRpc("progression.addXp", rpcAddXp);
    nk.registerRpc("progression.unlockAchievement", rpcUnlockAchievement);
    nk.registerRpc("progression.claimDailyReward", rpcClaimDailyReward);

    logger.info("LNBQSHA Progression Module initialized");
    logger.info("Registered RPCs: progression.*");
}
