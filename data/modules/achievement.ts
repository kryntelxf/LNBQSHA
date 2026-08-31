// LNBQSHA Product Layer — Achievement System
// Structured achievements with categories, progress, and rewards

import { nkruntime } from "nakama-runtime";

// ============================================================
// TYPES
// ============================================================

interface AchievementDefinition {
    id: string;
    name: string;
    description: string;
    category: "gameplay" | "social" | "economy" | "progression" | "special";
    rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
    maxProgress: number;
    reward: {
        xp?: number;
        coins?: number;
        gems?: number;
        item?: string;
    };
    hidden?: boolean;
    prerequisite?: string; // achievementId required to unlock
}

interface AchievementProgress {
    achievementId: string;
    progress: number;
    unlocked: boolean;
    unlockedAt?: number;
}

interface AchievementData {
    userId: string;
    achievements: AchievementProgress[];
    totalUnlocked: number;
    points: number;
}

// ============================================================
// CONSTANTS
// ============================================================

const COLLECTION_ACHIEVEMENT = "lnbqsha_achievement";

// Achievement definitions
const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
    // Gameplay achievements
    {
        id: "first_game",
        name: "First Steps",
        description: "Play your first game",
        category: "gameplay",
        rarity: "common",
        maxProgress: 1,
        reward: { xp: 50 }
    },
    {
        id: "game_master_10",
        name: "Game Master",
        description: "Play 10 games",
        category: "gameplay",
        rarity: "uncommon",
        maxProgress: 10,
        reward: { xp: 200, coins: 100 }
    },
    {
        id: "game_master_100",
        name: "Game Legend",
        description: "Play 100 games",
        category: "gameplay",
        rarity: "rare",
        maxProgress: 100,
        reward: { xp: 1000, gems: 50 }
    },
    {
        id: "score_100",
        name: "Centurion",
        description: "Score 100 points in a game",
        category: "gameplay",
        rarity: "common",
        maxProgress: 1,
        reward: { xp: 50, coins: 50 }
    },
    {
        id: "score_1000",
        name: "Thousand Club",
        description: "Score 1000 points in a game",
        category: "gameplay",
        rarity: "rare",
        maxProgress: 1,
        reward: { xp: 200, gems: 20 }
    },
    {
        id: "score_10000",
        name: "Legendary Score",
        description: "Score 10000 points in a game",
        category: "gameplay",
        rarity: "epic",
        maxProgress: 1,
        reward: { xp: 1000, gems: 100 }
    },
    // Social achievements
    {
        id: "first_friend",
        name: "First Friend",
        description: "Add your first friend",
        category: "social",
        rarity: "common",
        maxProgress: 1,
        reward: { xp: 50, coins: 50 }
    },
    {
        id: "social_butterfly_10",
        name: "Social Butterfly",
        description: "Add 10 friends",
        category: "social",
        rarity: "uncommon",
        maxProgress: 10,
        reward: { xp: 200, gems: 20 }
    },
    {
        id: "social_butterfly_50",
        name: "Social Legend",
        description: "Add 50 friends",
        category: "social",
        rarity: "epic",
        maxProgress: 50,
        reward: { xp: 500, gems: 100 }
    },
    {
        id: "first_clan",
        name: "Join a Clan",
        description: "Join your first clan",
        category: "social",
        rarity: "uncommon",
        maxProgress: 1,
        reward: { xp: 100, coins: 100 }
    },
    // Economy achievements
    {
        id: "first_purchase",
        name: "First Purchase",
        description: "Make your first purchase",
        category: "economy",
        rarity: "common",
        maxProgress: 1,
        reward: { xp: 50, coins: 50 }
    },
    {
        id: "big_spender_1000",
        name: "Big Spender",
        description: "Spend 1000 coins",
        category: "economy",
        rarity: "uncommon",
        maxProgress: 1000,
        reward: { xp: 200, gems: 20 }
    },
    {
        id: "big_spender_10000",
        name: "Tycoon",
        description: "Spend 10000 coins",
        category: "economy",
        rarity: "rare",
        maxProgress: 10000,
        reward: { xp: 500, gems: 50 }
    },
    {
        id: "coin_hoarder_10000",
        name: "Coin Hoarder",
        description: "Save 10000 coins",
        category: "economy",
        rarity: "rare",
        maxProgress: 10000,
        reward: { xp: 500, gems: 50 }
    },
    // Progression achievements
    {
        id: "level_5",
        name: "Level 5",
        description: "Reach level 5",
        category: "progression",
        rarity: "common",
        maxProgress: 1,
        reward: { xp: 100, coins: 100 }
    },
    {
        id: "level_10",
        name: "Level 10",
        description: "Reach level 10",
        category: "progression",
        rarity: "uncommon",
        maxProgress: 1,
        reward: { xp: 200, coins: 200 }
    },
    {
        id: "level_20",
        name: "Level 20",
        description: "Reach level 20",
        category: "progression",
        rarity: "rare",
        maxProgress: 1,
        reward: { xp: 500, gems: 50 }
    },
    {
        id: "level_50",
        name: "Level 50",
        description: "Reach level 50",
        category: "progression",
        rarity: "epic",
        maxProgress: 1,
        reward: { xp: 1000, gems: 100 }
    },
    {
        id: "level_100",
        name: "Level 100",
        description: "Reach level 100",
        category: "progression",
        rarity: "legendary",
        maxProgress: 1,
        reward: { xp: 5000, gems: 500 }
    },
    // Special achievements
    {
        id: "daily_login_7",
        name: "7-Day Streak",
        description: "Login for 7 days in a row",
        category: "special",
        rarity: "uncommon",
        maxProgress: 7,
        reward: { xp: 200, gems: 20 }
    },
    {
        id: "daily_login_30",
        name: "30-Day Streak",
        description: "Login for 30 days in a row",
        category: "special",
        rarity: "rare",
        maxProgress: 30,
        reward: { xp: 500, gems: 100 }
    },
    {
        id: "tournament_winner",
        name: "Tournament Winner",
        description: "Win a tournament",
        category: "special",
        rarity: "epic",
        maxProgress: 1,
        reward: { xp: 1000, gems: 200 }
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

function getAchievementData(nk: nkruntime.Nakama, userId: string): AchievementData {
    const result = nk.storageRead([
        { collection: COLLECTION_ACHIEVEMENT, key: "data", userId }
    ]);

    if (result && result.length > 0 && result[0].value) {
        return result[0].value as AchievementData;
    }

    // Default data
    const defaultData: AchievementData = {
        userId,
        achievements: ACHIEVEMENT_DEFINITIONS.map(def => ({
            achievementId: def.id,
            progress: 0,
            unlocked: false
        })),
        totalUnlocked: 0,
        points: 0
    };

    nk.storageWrite([{
        collection: COLLECTION_ACHIEVEMENT,
        key: "data",
        userId,
        value: defaultData,
        permissionRead: 1,
        permissionWrite: 1
    }]);

    return defaultData;
}

function saveAchievementData(nk: nkruntime.Nakama, userId: string, data: AchievementData): void {
    nk.storageWrite([{
        collection: COLLECTION_ACHIEVEMENT,
        key: "data",
        userId,
        value: data,
        permissionRead: 1,
        permissionWrite: 1
    }]);
}

function getAchievementDefinition(achievementId: string): AchievementDefinition | null {
    return ACHIEVEMENT_DEFINITIONS.find(def => def.id === achievementId) || null;
}

function unlockAchievement(
    nk: nkruntime.Nakama,
    userId: string,
    achievementId: string
): { unlocked: boolean; reward: any } {
    const data = getAchievementData(nk, userId);
    const progress = data.achievements.find(a => a.achievementId === achievementId);
    const definition = getAchievementDefinition(achievementId);

    if (!progress || !definition) {
        return { unlocked: false, reward: null };
    }

    if (progress.unlocked) {
        return { unlocked: false, reward: null };
    }

    // Check prerequisite
    if (definition.prerequisite) {
        const prereq = data.achievements.find(a => a.achievementId === definition.prerequisite);
        if (!prereq || !prereq.unlocked) {
            return { unlocked: false, reward: null };
        }
    }

    // Unlock achievement
    progress.unlocked = true;
    progress.unlockedAt = Date.now();
    data.totalUnlocked += 1;
    data.points += getRarityPoints(definition.rarity);

    saveAchievementData(nk, userId, data);

    // Grant rewards
    const reward = definition.reward;
    if (reward) {
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

    // Send notification
    try {
        const notifyPayload = JSON.stringify({
            type: "achievement",
            title: `Achievement Unlocked: ${definition.name}`,
            message: definition.description,
            data: {
                achievementId: definition.id,
                name: definition.name,
                rarity: definition.rarity
            }
        });
        nk.rpc("notification.send", notifyPayload);
    } catch (e) {
        // Ignore
    }

    // Record activity
    try {
        const activityPayload = JSON.stringify({
            type: "achievement",
            metadata: {
                achievementId: definition.id,
                name: definition.name,
                rarity: definition.rarity
            }
        });
        nk.rpc("social.recordActivity", activityPayload);
    } catch (e) {
        // Ignore
    }

    return {
        unlocked: true,
        reward: reward
    };
}

function getRarityPoints(rarity: string): number {
    switch (rarity) {
        case "common": return 10;
        case "uncommon": return 25;
        case "rare": return 50;
        case "epic": return 100;
        case "legendary": return 250;
        default: return 0;
    }
}

// ============================================================
// RPC: Get achievements
// ============================================================

export const rpcGetAchievements: nkruntime.RpcFunction = (
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

        const data = getAchievementData(nk, userId);
        const definitions = ACHIEVEMENT_DEFINITIONS;

        const achievements = definitions.map(def => {
            const progress = data.achievements.find(a => a.achievementId === def.id);
            return {
                ...def,
                progress: progress?.progress || 0,
                unlocked: progress?.unlocked || false,
                unlockedAt: progress?.unlockedAt || null
            };
        });

        return JSON.stringify({
            achievements,
            totalUnlocked: data.totalUnlocked,
            points: data.points
        });
    } catch (e) {
        throw new Error(`Failed to get achievements: ${e}`);
    }
};

// ============================================================
// RPC: Update achievement progress
// ============================================================

export const rpcUpdateAchievementProgress: nkruntime.RpcFunction = (
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
        const amount: number = data.amount || 1;

        if (!achievementId) {
            throw new Error("achievementId required");
        }

        const definition = getAchievementDefinition(achievementId);
        if (!definition) {
            throw new Error("Achievement not found");
        }

        const achievementData = getAchievementData(nk, userId);
        const progress = achievementData.achievements.find(a => a.achievementId === achievementId);

        if (!progress) {
            throw new Error("Achievement not found");
        }

        if (progress.unlocked) {
            return JSON.stringify({ success: true, unlocked: true });
        }

        // Update progress
        progress.progress = Math.min(progress.progress + amount, definition.maxProgress);

        // Check if completed
        if (progress.progress >= definition.maxProgress) {
            const result = unlockAchievement(nk, userId, achievementId);
            saveAchievementData(nk, userId, achievementData);
            return JSON.stringify({
                success: true,
                unlocked: result.unlocked,
                reward: result.reward,
                achievement: definition
            });
        }

        saveAchievementData(nk, userId, achievementData);

        return JSON.stringify({
            success: true,
            unlocked: false,
            progress: progress.progress,
            maxProgress: definition.maxProgress
        });
    } catch (e) {
        throw new Error(`Failed to update achievement progress: ${e}`);
    }
};

// ============================================================
// RPC: Get achievement leaderboard
// ============================================================

export const rpcGetAchievementLeaderboard: nkruntime.RpcFunction = (
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    payload: string
): string => {
    try {
        // For simplicity, return an empty list
        // In production, we'd query all users' achievement data and sort by points
        return JSON.stringify({
            users: [],
            message: "Achievement leaderboard coming soon"
        });
    } catch (e) {
        throw new Error(`Failed to get achievement leaderboard: ${e}`);
    }
};

// ============================================================
// INIT
// ============================================================

export function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama): void {
    nk.registerRpc("achievement.get", rpcGetAchievements);
    nk.registerRpc("achievement.update", rpcUpdateAchievementProgress);
    nk.registerRpc("achievement.leaderboard", rpcGetAchievementLeaderboard);

    logger.info("LNBQSHA Achievement System initialized");
    logger.info(`Loaded ${ACHIEVEMENT_DEFINITIONS.length} achievements`);
    logger.info("Registered RPCs: achievement.*");
}
