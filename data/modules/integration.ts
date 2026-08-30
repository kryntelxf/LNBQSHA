// LNBQSHA Product Layer — Integration Module
// Connects all modules together: economy → inventory → progression → social

import { nkruntime } from "nakama-runtime";

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
// INTEGRATION: Purchase + Inventory + Progression
// ============================================================

export const rpcCompletePurchase: nkruntime.RpcFunction = (
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
        const itemId: string = data.itemId;
        const idempotencyKey: string = data.idempotencyKey || generateUUID();

        if (!itemId) {
            throw new Error("itemId required");
        }

        // 1. Purchase item (economy)
        const purchasePayload = JSON.stringify({
            itemId,
            idempotencyKey
        });
        const purchaseResult = nk.rpc("economy.purchase", purchasePayload);
        const purchase = JSON.parse(purchaseResult);

        if (!purchase.success) {
            throw new Error("Purchase failed");
        }

        // 2. Grant item to inventory
        const grantPayload = JSON.stringify({
            itemId
        });
        const grantResult = nk.rpc("inventory.grant", grantPayload);
        const inventory = JSON.parse(grantResult);

        // 3. Add XP for purchase (progression)
        // Different items give different XP
        let xpAmount = 0;
        const catalog: Record<string, any> = {
            "cosmetic_001": { name: "Neon Skin", xp: 50 },
            "cosmetic_002": { name: "Golden Skin", xp: 100 },
            "cosmetic_003": { name: "Dance Emote", xp: 25 },
            "cosmetic_004": { name: "Crown Avatar", xp: 75 }
        };
        if (catalog[itemId]) {
            xpAmount = catalog[itemId].xp || 0;
        }
        if (xpAmount > 0) {
            const xpPayload = JSON.stringify({ amount: xpAmount });
            nk.rpc("progression.addXp", xpPayload);
        }

        // 4. Record activity
        const activityPayload = JSON.stringify({
            type: "purchased_item",
            metadata: {
                itemId,
                itemName: catalog[itemId]?.name || itemId,
                xpGained: xpAmount
            }
        });
        nk.rpc("social.recordActivity", activityPayload);

        return JSON.stringify({
            success: true,
            purchase,
            inventory,
            xpGained: xpAmount,
            message: `Purchased ${catalog[itemId]?.name || itemId} successfully!`
        });
    } catch (e) {
        throw new Error(`Failed to complete purchase: ${e}`);
    }
};

// ============================================================
// INTEGRATION: Game Complete
// ============================================================

export const rpcCompleteGame: nkruntime.RpcFunction = (
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
        const gameMode: string = data.gameMode || "obstacle_rush";
        const score: number = data.score || 0;
        const duration: number = data.duration || 0;
        const metadata: any = data.metadata || {};

        // 1. Add XP based on score
        const xpAmount = Math.floor(score / 10);
        if (xpAmount > 0) {
            const xpPayload = JSON.stringify({ amount: xpAmount });
            nk.rpc("progression.addXp", xpPayload);
        }

        // 2. Submit to leaderboard
        const leaderboardPayload = JSON.stringify({
            leaderboardId: `game_${gameMode}`,
            score,
            metadata: { duration, ...metadata }
        });
        const leaderboardResult = nk.rpc("leaderboard.submitScore", leaderboardPayload);
        const leaderboard = JSON.parse(leaderboardResult);

        // 3. Record activity
        const activityPayload = JSON.stringify({
            type: "finished_game",
            metadata: {
                gameMode,
                score,
                duration,
                rank: leaderboard.rank || 0,
                xpGained: xpAmount
            }
        });
        nk.rpc("social.recordActivity", activityPayload);

        // 4. Check for achievements
        // Check if user has reached certain milestones
        const progressionResult = nk.rpc("progression.get", JSON.stringify({}));
        const progression = JSON.parse(progressionResult);

        // Achievement: First game
        const achievements = [
            {
                id: "first_game",
                name: "First Game!",
                description: "Completed your first game",
                condition: () => true
            },
            {
                id: "score_100",
                name: "Score 100",
                description: "Reached score 100 in a game",
                condition: () => score >= 100
            },
            {
                id: "score_500",
                name: "Score 500",
                description: "Reached score 500 in a game",
                condition: () => score >= 500
            },
            {
                id: "level_5",
                name: "Level 5",
                description: "Reached level 5",
                condition: () => progression.level >= 5
            },
            {
                id: "level_10",
                name: "Level 10",
                description: "Reached level 10",
                condition: () => progression.level >= 10
            }
        ];

        for (const achievement of achievements) {
            // Check if already unlocked
            const alreadyUnlocked = progression.achievements.some((a: any) => a.id === achievement.id && a.unlocked);
            if (!alreadyUnlocked && achievement.condition()) {
                const unlockPayload = JSON.stringify({
                    achievementId: achievement.id,
                    name: achievement.name,
                    description: achievement.description
                });
                nk.rpc("progression.unlockAchievement", unlockPayload);
            }
        }

        // 5. Check daily rewards
        const dailyPayload = JSON.stringify({});
        try {
            const dailyResult = nk.rpc("progression.claimDailyReward", dailyPayload);
            // Daily reward claimed
        } catch (e) {
            // Already claimed or not available
        }

        return JSON.stringify({
            success: true,
            score,
            xpGained: xpAmount,
            rank: leaderboard.rank || 0,
            newLevel: progression.level,
            message: "Game completed! Keep playing to earn more!"
        });
    } catch (e) {
        throw new Error(`Failed to complete game: ${e}`);
    }
};

// ============================================================
// INTEGRATION: Daily Login Bonus
// ============================================================

export const rpcDailyLogin: nkruntime.RpcFunction = (
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

        // 1. Claim daily reward (progression)
        const dailyPayload = JSON.stringify({});
        let dailyResult;
        try {
            dailyResult = nk.rpc("progression.claimDailyReward", dailyPayload);
        } catch (e) {
            // Already claimed
            return JSON.stringify({
                success: false,
                message: "Daily reward already claimed",
                claimed: false
            });
        }

        const reward = JSON.parse(dailyResult);

        // 2. Bonus XP for logging in
        const bonusXp = 20;
        const xpPayload = JSON.stringify({ amount: bonusXp });
        nk.rpc("progression.addXp", xpPayload);

        // 3. Record activity
        const activityPayload = JSON.stringify({
            type: "daily_login",
            metadata: {
                streak: reward.streak || 0,
                reward: reward.reward || "",
                bonusXp
            }
        });
        nk.rpc("social.recordActivity", activityPayload);

        return JSON.stringify({
            success: true,
            claimed: true,
            reward: reward.reward || "",
            streak: reward.streak || 0,
            bonusXp,
            message: `Daily login reward claimed! Streak: ${reward.streak || 0}`
        });
    } catch (e) {
        throw new Error(`Failed to claim daily login: ${e}`);
    }
};

// ============================================================
// INTEGRATION: Get Player Dashboard
// ============================================================

export const rpcGetDashboard: nkruntime.RpcFunction = (
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

        // Get all player data in one call
        const wallet = JSON.parse(nk.rpc("economy.getWallet", JSON.stringify({})));
        const progression = JSON.parse(nk.rpc("progression.get", JSON.stringify({})));
        const state = JSON.parse(nk.rpc("player.getState", JSON.stringify({})));
        const inventory = JSON.parse(nk.rpc("inventory.get", JSON.stringify({})));
        const friends = JSON.parse(nk.rpc("social.getFriends", JSON.stringify({})));

        return JSON.stringify({
            wallet,
            progression,
            state,
            inventory,
            friends: friends.length || 0,
            dashboard: {
                totalXp: progression.totalXp || 0,
                level: progression.level || 1,
                coins: wallet.softBalance || 0,
                gems: wallet.premiumBalance || 0,
                items: inventory.items?.length || 0,
                friends: friends.length || 0,
                achievements: progression.achievements?.filter((a: any) => a.unlocked).length || 0
            }
        });
    } catch (e) {
        throw new Error(`Failed to get dashboard: ${e}`);
    }
};

// ============================================================
// INIT
// ============================================================

export function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama): void {
    // Register Integration RPCs
    nk.registerRpc("integration.purchase", rpcCompletePurchase);
    nk.registerRpc("integration.completeGame", rpcCompleteGame);
    nk.registerRpc("integration.dailyLogin", rpcDailyLogin);
    nk.registerRpc("integration.getDashboard", rpcGetDashboard);

    logger.info("LNBQSHA Integration Module initialized");
    logger.info("Registered RPCs: integration.*");
    }
