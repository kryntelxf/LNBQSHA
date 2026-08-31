// LNBQSHA Product Layer — Quests/Missions System
// Daily, weekly quests with rewards

import { nkruntime } from "nakama-runtime";

// ============================================================
// TYPES
// ============================================================

interface QuestDefinition {
    id: string;
    name: string;
    description: string;
    type: "daily" | "weekly" | "special";
    objective: {
        type: "play_games" | "win_games" | "score_points" | "collect_coins" | 
              "spend_coins" | "add_friends" | "play_with_friends" | 
              "join_clan" | "level_up" | "purchase_item";
        target: number;
        metadata?: any;
    };
    rewards: {
        xp?: number;
        coins?: number;
        gems?: number;
        item?: string;
    };
    expiresIn: number; // seconds
}

interface QuestProgress {
    userId: string;
    questId: string;
    progress: number;
    completed: boolean;
    claimed: boolean;
    startedAt: number;
    expiresAt: number;
    completedAt?: number;
}

// ============================================================
// CONSTANTS
// ============================================================

const COLLECTION_QUEST = "lnbqsha_quest";

// Daily quests
const DAILY_QUESTS: QuestDefinition[] = [
    {
        id: "daily_play_3",
        name: "Daily Player",
        description: "Play 3 games today",
        type: "daily",
        objective: { type: "play_games", target: 3 },
        rewards: { xp: 50, coins: 100 },
        expiresIn: 86400 // 24 hours
    },
    {
        id: "daily_win_1",
        name: "Daily Winner",
        description: "Win 1 game today",
        type: "daily",
        objective: { type: "win_games", target: 1 },
        rewards: { xp: 100, coins: 50 },
        expiresIn: 86400
    },
    {
        id: "daily_score_100",
        name: "Daily Scorer",
        description: "Score 100 points today",
        type: "daily",
        objective: { type: "score_points", target: 100 },
        rewards: { xp: 75, gems: 5 },
        expiresIn: 86400
    },
    {
        id: "daily_collect_100",
        name: "Daily Collector",
        description: "Collect 100 coins today",
        type: "daily",
        objective: { type: "collect_coins", target: 100 },
        rewards: { xp: 50, coins: 50 },
        expiresIn: 86400
    }
];

// Weekly quests
const WEEKLY_QUESTS: QuestDefinition[] = [
    {
        id: "weekly_play_20",
        name: "Weekly Grinder",
        description: "Play 20 games this week",
        type: "weekly",
        objective: { type: "play_games", target: 20 },
        rewards: { xp: 500, coins: 500 },
        expiresIn: 604800 // 7 days
    },
    {
        id: "weekly_win_10",
        name: "Weekly Champion",
        description: "Win 10 games this week",
        type: "weekly",
        objective: { type: "win_games", target: 10 },
        rewards: { xp: 750, gems: 50 },
        expiresIn: 604800
    },
    {
        id: "weekly_score_1000",
        name: "Weekly Legend",
        description: "Score 1000 points this week",
        type: "weekly",
        objective: { type: "score_points", target: 1000 },
        rewards: { xp: 1000, gems: 75 },
        expiresIn: 604800
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

function getQuestProgress(nk: nkruntime.Nakama, userId: string): QuestProgress[] {
    const result = nk.storageRead([
        { collection: COLLECTION_QUEST, key: userId, userId }
    ]);

    if (result && result.length > 0 && result[0].value) {
        return result[0].value as QuestProgress[];
    }
    return [];
}

function saveQuestProgress(nk: nkruntime.Nakama, userId: string, progress: QuestProgress[]): void {
    nk.storageWrite([{
        collection: COLLECTION_QUEST,
        key: userId,
        userId,
        value: progress,
        permissionRead: 1,
        permissionWrite: 1
    }]);
}

function getQuestDefinition(questId: string): QuestDefinition | null {
    const all = [...DAILY_QUESTS, ...WEEKLY_QUESTS];
    return all.find(q => q.id === questId) || null;
}

function initializeQuests(nk: nkruntime.Nakama, userId: string): QuestProgress[] {
    const progress: QuestProgress[] = [];
    const now = Date.now();

    // Initialize daily quests
    for (const quest of DAILY_QUESTS) {
        // Check if already exists
        const existing = getQuestProgress(nk, userId);
        if (existing.some(q => q.questId === quest.id)) {
            continue;
        }
        progress.push({
            userId,
            questId: quest.id,
            progress: 0,
            completed: false,
            claimed: false,
            startedAt: now,
            expiresAt: now + quest.expiresIn * 1000
        });
    }

    // Initialize weekly quests
    for (const quest of WEEKLY_QUESTS) {
        const existing = getQuestProgress(nk, userId);
        if (existing.some(q => q.questId === quest.id)) {
            continue;
        }
        progress.push({
            userId,
            questId: quest.id,
            progress: 0,
            completed: false,
            claimed: false,
            startedAt: now,
            expiresAt: now + quest.expiresIn * 1000
        });
    }

    return progress;
}

function updateQuestProgress(
    nk: nkruntime.Nakama,
    userId: string,
    questId: string,
    amount: number
): { quest: QuestDefinition; progress: number; completed: boolean } {
    const progressList = getQuestProgress(nk, userId);
    const questProgress = progressList.find(q => q.questId === questId);
    const definition = getQuestDefinition(questId);

    if (!questProgress || !definition) {
        return { quest: null, progress: 0, completed: false };
    }

    // Check if expired
    if (Date.now() > questProgress.expiresAt) {
        // Reset the quest
        questProgress.progress = 0;
        questProgress.completed = false;
        questProgress.claimed = false;
        questProgress.expiresAt = Date.now() + definition.expiresIn * 1000;
        saveQuestProgress(nk, userId, progressList);
        return { quest: definition, progress: 0, completed: false };
    }

    // Check if already completed
    if (questProgress.completed && questProgress.claimed) {
        return { quest: definition, progress: questProgress.progress, completed: true };
    }

    // Update progress
    questProgress.progress = Math.min(questProgress.progress + amount, definition.objective.target);

    // Check if completed
    if (questProgress.progress >= definition.objective.target && !questProgress.completed) {
        questProgress.completed = true;
        questProgress.completedAt = Date.now();

        // Grant rewards
        const rewards = definition.rewards;
        if (rewards) {
            if (rewards.xp) {
                try {
                    nk.rpc("progression.addXp", JSON.stringify({ amount: rewards.xp }));
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
                type: "reward",
                title: `Quest Complete: ${definition.name}`,
                message: `You completed the quest and earned rewards!`,
                data: { questId: definition.id, name: definition.name }
            });
            nk.rpc("notification.send", notifyPayload);
        } catch (e) {
            // Ignore
        }
    }

    saveQuestProgress(nk, userId, progressList);

    return {
        quest: definition,
        progress: questProgress.progress,
        completed: questProgress.completed
    };
}

// ============================================================
// RPC: Get quests
// ============================================================

export const rpcGetQuests: nkruntime.RpcFunction = (
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

        let progress = getQuestProgress(nk, userId);

        // Initialize if empty
        if (progress.length === 0) {
            progress = initializeQuests(nk, userId);
            saveQuestProgress(nk, userId, progress);
        }

        // Get all quest definitions
        const allQuests = [...DAILY_QUESTS, ...WEEKLY_QUESTS];

        const quests = allQuests.map(q => {
            const p = progress.find(pr => pr.questId === q.id);
            return {
                ...q,
                progress: p?.progress || 0,
                completed: p?.completed || false,
                claimed: p?.claimed || false,
                expiresAt: p?.expiresAt || 0,
                startedAt: p?.startedAt || 0
            };
        });

        return JSON.stringify({
            quests,
            daily: quests.filter(q => q.type === "daily"),
            weekly: quests.filter(q => q.type === "weekly")
        });
    } catch (e) {
        throw new Error(`Failed to get quests: ${e}`);
    }
};

// ============================================================
// RPC: Update quest progress (called from other modules)
// ============================================================

export const rpcUpdateQuest: nkruntime.RpcFunction = (
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
        const amount: number = data.amount || 1;
        const metadata: any = data.metadata || {};

        let progress = getQuestProgress(nk, userId);
        if (progress.length === 0) {
            progress = initializeQuests(nk, userId);
        }

        // Map objective type to quest type
        const objectiveMap: Record<string, string> = {
            "play_games": "play_games",
            "win_games": "win_games",
            "score_points": "score_points",
            "collect_coins": "collect_coins",
            "spend_coins": "spend_coins",
            "add_friends": "add_friends",
            "play_with_friends": "play_with_friends",
            "join_clan": "join_clan",
            "level_up": "level_up",
            "purchase_item": "purchase_item"
        };

        const questType = objectiveMap[type];
        if (!questType) {
            return JSON.stringify({ success: false, message: "Unknown objective type" });
        }

        // Update all quests with matching objective
        const allQuests = [...DAILY_QUESTS, ...WEEKLY_QUESTS];
        const matchingQuests = allQuests.filter(q => q.objective.type === questType);

        for (const quest of matchingQuests) {
            const questProgress = progress.find(q => q.questId === quest.id);
            if (!questProgress) continue;
            if (questProgress.completed && questProgress.claimed) continue;

            updateQuestProgress(nk, userId, quest.id, amount);
        }

        return JSON.stringify({ success: true });
    } catch (e) {
        throw new Error(`Failed to update quest: ${e}`);
    }
};

// ============================================================
// RPC: Claim quest reward
// ============================================================

export const rpcClaimQuestReward: nkruntime.RpcFunction = (
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
        const questId: string = data.questId;

        if (!questId) {
            throw new Error("questId required");
        }

        const progressList = getQuestProgress(nk, userId);
        const questProgress = progressList.find(q => q.questId === questId);

        if (!questProgress) {
            throw new Error("Quest not found");
        }

        if (!questProgress.completed) {
            throw new Error("Quest not completed");
        }

        if (questProgress.claimed) {
            throw new Error("Quest reward already claimed");
        }

        const definition = getQuestDefinition(questId);
        if (!definition) {
            throw new Error("Quest definition not found");
        }

        // Mark as claimed
        questProgress.claimed = true;
        saveQuestProgress(nk, userId, progressList);

        // Grant rewards (already granted when completed)
        // But we should also grant any additional rewards here if needed

        return JSON.stringify({
            success: true,
            questId,
            message: `Claimed reward for ${definition.name}!`
        });
    } catch (e) {
        throw new Error(`Failed to claim quest reward: ${e}`);
    }
};

// ============================================================
// RPC: Reset daily quests (called by system)
// ============================================================

export const rpcResetDailyQuests: nkruntime.RpcFunction = (
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    payload: string
): string => {
    try {
        // Admin only
        const userId = ctx.userId;
        if (!userId) {
            throw new Error("Unauthorized");
        }

        // For now, we'll just reset all daily quests
        // In production, this would be called by a cron job

        // We'd need to get all users and reset their daily quests
        // This is a simplified version

        return JSON.stringify({ success: true });
    } catch (e) {
        throw new Error(`Failed to reset daily quests: ${e}`);
    }
};

// ============================================================
// INIT
// ============================================================

export function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama): void {
    nk.registerRpc("quest.get", rpcGetQuests);
    nk.registerRpc("quest.update", rpcUpdateQuest);
    nk.registerRpc("quest.claim", rpcClaimQuestReward);

    logger.info("LNBQSHA Quests/Missions Module initialized");
    logger.info(`Loaded ${DAILY_QUESTS.length} daily quests and ${WEEKLY_QUESTS.length} weekly quests`);
    logger.info("Registered RPCs: quest.*");
      }
