// LNBQSHA Product Layer — Daily Login Reward System
// Login calendar, streak rewards, bonus days

import { nkruntime } from "nakama-runtime";

// ============================================================
// TYPES
// ============================================================

interface DailyLoginData {
    userId: string;
    lastLoginDate: string; // YYYY-MM-DD
    streak: number;
    totalLogins: number;
    claimedDays: string[]; // YYYY-MM-DD
    rewards: {
        streak: number;
        claimed: boolean;
        reward: string;
        date: string;
    }[];
}

interface DailyReward {
    day: number;
    reward: string;
    type: "xp" | "coins" | "gems" | "item";
    amount?: number;
    itemId?: string;
    rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
}

// ============================================================
// CONSTANTS
// ============================================================

const COLLECTION_DAILY_LOGIN = "lnbqsha_daily_login";

const DAILY_REWARDS: DailyReward[] = [
    { day: 1, reward: "100 XP", type: "xp", amount: 100, rarity: "common" },
    { day: 2, reward: "50 Coins", type: "coins", amount: 50, rarity: "common" },
    { day: 3, reward: "5 Gems", type: "gems", amount: 5, rarity: "uncommon" },
    { day: 4, reward: "100 XP", type: "xp", amount: 100, rarity: "common" },
    { day: 5, reward: "100 Coins", type: "coins", amount: 100, rarity: "uncommon" },
    { day: 6, reward: "10 Gems", type: "gems", amount: 10, rarity: "rare" },
    { day: 7, reward: "200 XP + 50 Coins", type: "xp", amount: 200, rarity: "rare" },
    { day: 8, reward: "100 Coins", type: "coins", amount: 100, rarity: "common" },
    { day: 9, reward: "5 Gems", type: "gems", amount: 5, rarity: "uncommon" },
    { day: 10, reward: "200 XP", type: "xp", amount: 200, rarity: "rare" },
    { day: 11, reward: "150 Coins", type: "coins", amount: 150, rarity: "uncommon" },
    { day: 12, reward: "15 Gems", type: "gems", amount: 15, rarity: "rare" },
    { day: 13, reward: "200 XP", type: "xp", amount: 200, rarity: "rare" },
    { day: 14, reward: "Skin: Neon", type: "item", itemId: "skin_neon", rarity: "epic" },
    { day: 15, reward: "200 Coins", type: "coins", amount: 200, rarity: "rare" },
    { day: 16, reward: "10 Gems", type: "gems", amount: 10, rarity: "rare" },
    { day: 17, reward: "300 XP", type: "xp", amount: 300, rarity: "epic" },
    { day: 18, reward: "250 Coins", type: "coins", amount: 250, rarity: "rare" },
    { day: 19, reward: "20 Gems", type: "gems", amount: 20, rarity: "epic" },
    { day: 20, reward: "300 XP", type: "xp", amount: 300, rarity: "epic" },
    { day: 21, reward: "Emote: Dance", type: "item", itemId: "emote_dance", rarity: "epic" },
    { day: 22, reward: "300 Coins", type: "coins", amount: 300, rarity: "epic" },
    { day: 23, reward: "15 Gems", type: "gems", amount: 15, rarity: "rare" },
    { day: 24, reward: "400 XP", type: "xp", amount: 400, rarity: "epic" },
    { day: 25, reward: "350 Coins", type: "coins", amount: 350, rarity: "epic" },
    { day: 26, reward: "25 Gems", type: "gems", amount: 25, rarity: "epic" },
    { day: 27, reward: "400 XP", type: "xp", amount: 400, rarity: "epic" },
    { day: 28, reward: "Avatar: Crown", type: "item", itemId: "avatar_crown", rarity: "legendary" },
    { day: 29, reward: "400 Coins", type: "coins", amount: 400, rarity: "epic" },
    { day: 30, reward: "30 Gems", type: "gems", amount: 30, rarity: "legendary" }
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

function getTodayString(): string {
    return new Date().toISOString().split('T')[0];
}

function getYesterdayString(): string {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
}

function getDailyLoginData(nk: nkruntime.Nakama, userId: string): DailyLoginData {
    const result = nk.storageRead([
        { collection: COLLECTION_DAILY_LOGIN, key: userId, userId }
    ]);

    if (result && result.length > 0 && result[0].value) {
        return result[0].value as DailyLoginData;
    }

    // Default data
    const defaultData: DailyLoginData = {
        userId,
        lastLoginDate: "",
        streak: 0,
        totalLogins: 0,
        claimedDays: [],
        rewards: []
    };

    return defaultData;
}

function saveDailyLoginData(nk: nkruntime.Nakama, userId: string, data: DailyLoginData): void {
    nk.storageWrite([{
        collection: COLLECTION_DAILY_LOGIN,
        key: userId,
        userId,
        value: data,
        permissionRead: 1,
        permissionWrite: 1
    }]);
}

function getRewardForDay(day: number): DailyReward | null {
    // Cycle through rewards
    const index = (day - 1) % DAILY_REWARDS.length;
    return DAILY_REWARDS[index] || null;
}

function grantDailyReward(nk: nkruntime.Nakama, userId: string, reward: DailyReward): void {
    switch (reward.type) {
        case "xp":
            if (reward.amount) {
                try {
                    nk.rpc("progression.addXp", JSON.stringify({ amount: reward.amount }));
                } catch (e) {
                    // Ignore
                }
            }
            break;
        case "coins":
            // Grant coins via economy
            break;
        case "gems":
            // Grant gems via economy
            break;
        case "item":
            if (reward.itemId) {
                try {
                    nk.rpc("inventory.grant", JSON.stringify({ itemId: reward.itemId }));
                } catch (e) {
                    // Ignore
                }
            }
            break;
    }
}

// ============================================================
// RPC: Claim daily login reward
// ============================================================

export const rpcClaimDailyLogin: nkruntime.RpcFunction = (
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

        const data = getDailyLoginData(nk, userId);
        const today = getTodayString();

        // Check if already claimed today
        if (data.claimedDays.includes(today)) {
            throw new Error("Daily login already claimed today");
        }

        // Check streak
        const yesterday = getYesterdayString();
        if (data.lastLoginDate === yesterday) {
            data.streak += 1;
        } else if (data.lastLoginDate !== today) {
            data.streak = 1; // Reset streak
        }

        data.lastLoginDate = today;
        data.totalLogins += 1;
        data.claimedDays.push(today);

        // Get reward for current streak day
        const reward = getRewardForDay(data.streak);
        if (reward) {
            grantDailyReward(nk, userId, reward);
            data.rewards.push({
                streak: data.streak,
                claimed: true,
                reward: reward.reward,
                date: today
            });
        }

        saveDailyLoginData(nk, userId, data);

        // Send notification
        try {
            const notifyPayload = JSON.stringify({
                type: "reward",
                title: `Daily Login Reward - Day ${data.streak}!`,
                message: `You claimed your daily login reward!`,
                data: { streak: data.streak, reward: reward?.reward || "Reward" }
            });
            nk.rpc("notification.send", notifyPayload);
        } catch (e) {
            // Ignore
        }

        // Record activity
        try {
            const activityPayload = JSON.stringify({
                type: "daily_login",
                metadata: { streak: data.streak, reward: reward?.reward || "Reward" }
            });
            nk.rpc("social.recordActivity", activityPayload);
        } catch (e) {
            // Ignore
        }

        return JSON.stringify({
            success: true,
            streak: data.streak,
            reward: reward?.reward || "Reward",
            totalLogins: data.totalLogins
        });
    } catch (e) {
        throw new Error(`Failed to claim daily login reward: ${e}`);
    }
};

// ============================================================
// RPC: Get daily login status
// ============================================================

export const rpcGetDailyLoginStatus: nkruntime.RpcFunction = (
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

        const data = getDailyLoginData(nk, userId);
        const today = getTodayString();
        const claimedToday = data.claimedDays.includes(today);

        // Calculate next reward
        const nextDay = claimedToday ? data.streak + 1 : data.streak + 1;
        const nextReward = getRewardForDay(nextDay);

        return JSON.stringify({
            claimedToday,
            streak: data.streak,
            totalLogins: data.totalLogins,
            nextReward: nextReward?.reward || "Reward",
            nextRewardDay: nextDay,
            rewards: data.rewards.slice(-7) // Last 7 rewards
        });
    } catch (e) {
        throw new Error(`Failed to get daily login status: ${e}`);
    }
};

// ============================================================
// RPC: Get daily login calendar
// ============================================================

export const rpcGetDailyLoginCalendar: nkruntime.RpcFunction = (
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

        const data = getDailyLoginData(nk, userId);
        const calendar = [];

        // Show next 30 days
        for (let i = 0; i < 30; i++) {
            const day = i + 1;
            const reward = getRewardForDay(day);
            const claimed = data.streak >= day;

            calendar.push({
                day,
                reward: reward?.reward || "Reward",
                claimed,
                locked: !claimed && day > data.streak + 1,
                rarity: reward?.rarity || "common"
            });
        }

        return JSON.stringify({
            calendar,
            streak: data.streak,
            claimedToday: data.claimedDays.includes(getTodayString())
        });
    } catch (e) {
        throw new Error(`Failed to get daily login calendar: ${e}`);
    }
};

// ============================================================
// RPC: Get monthly login stats
// ============================================================

export const rpcGetMonthlyLoginStats: nkruntime.RpcFunction = (
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

        const data = getDailyLoginData(nk, userId);
        const month = new Date().getMonth();
        const year = new Date().getFullYear();

        // Count logins this month
        const thisMonthLogins = data.claimedDays.filter(date => {
            const d = new Date(date);
            return d.getMonth() === month && d.getFullYear() === year;
        });

        return JSON.stringify({
            totalLogins: data.totalLogins,
            thisMonthLogins: thisMonthLogins.length,
            streak: data.streak,
            bestStreak: data.streak // In production, we'd track best streak
        });
    } catch (e) {
        throw new Error(`Failed to get monthly login stats: ${e}`);
    }
};

// ============================================================
// INIT
// ============================================================

export function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama): void {
    nk.registerRpc("dailyLogin.claim", rpcClaimDailyLogin);
    nk.registerRpc("dailyLogin.status", rpcGetDailyLoginStatus);
    nk.registerRpc("dailyLogin.calendar", rpcGetDailyLoginCalendar);
    nk.registerRpc("dailyLogin.stats", rpcGetMonthlyLoginStats);

    logger.info("LNBQSHA Daily Login Reward System initialized");
    logger.info("Registered RPCs: dailyLogin.*");
}
