// LNBQSHA Product Layer — Battle Pass / Season Pass
// Premium progression with tiers and rewards

import { nkruntime } from "nakama-runtime";

// ============================================================
// TYPES
// ============================================================

interface BattlePassSeason {
    id: string;
    name: string;
    description: string;
    startTime: number;
    endTime: number;
    tiers: BattlePassTier[];
    maxTiers: number;
    premiumPrice: number;
    premiumCurrency: string;
}

interface BattlePassTier {
    tier: number;
    xpRequired: number;
    freeReward?: BattlePassReward;
    premiumReward?: BattlePassReward;
}

interface BattlePassReward {
    type: "xp" | "coins" | "gems" | "item" | "skin" | "emote" | "avatar";
    amount?: number;
    itemId?: string;
    name: string;
    rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
}

interface BattlePassProgress {
    userId: string;
    seasonId: string;
    tier: number;
    xp: number;
    xpToNextTier: number;
    freeClaimed: number[];
    premiumClaimed: number[];
    hasPremium: boolean;
    premiumPurchasedAt?: number;
}

// ============================================================
// CONSTANTS
// ============================================================

const COLLECTION_BATTLE_PASS = "lnbqsha_battle_pass";

// Current season
const CURRENT_SEASON: BattlePassSeason = {
    id: "season_001",
    name: "Season 1: Neon Nights",
    description: "The first season of LNBQSHA Battle Pass!",
    startTime: Date.now(),
    endTime: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days
    maxTiers: 50,
    premiumPrice: 1000,
    premiumCurrency: "premium",
    tiers: []
};

// Generate tiers
function generateTiers(): BattlePassTier[] {
    const tiers: BattlePassTier[] = [];
    const XP_PER_TIER = 100;

    for (let i = 1; i <= 50; i++) {
        // Every 5 tiers give better rewards
        const isMilestone = i % 5 === 0;
        const isMajorMilestone = i % 10 === 0;

        const tier: BattlePassTier = {
            tier: i,
            xpRequired: i * XP_PER_TIER,
            freeReward: {
                type: "xp",
                amount: isMajorMilestone ? 100 : isMilestone ? 50 : 25,
                name: `${isMajorMilestone ? "Major " : ""}XP Reward`,
                rarity: isMajorMilestone ? "epic" : isMilestone ? "rare" : "common"
            },
            premiumReward: {
                type: i % 5 === 0 ? "gems" : i % 3 === 0 ? "coins" : "item",
                amount: i % 5 === 0 ? 50 : i % 3 === 0 ? 100 : undefined,
                itemId: i % 5 === 0 ? "skin_neon" : undefined,
                name: `Tier ${i} Reward`,
                rarity: isMajorMilestone ? "legendary" : isMilestone ? "epic" : "rare"
            }
        };

        // Special rewards at certain tiers
        if (i === 10) {
            tier.premiumReward = {
                type: "skin",
                itemId: "skin_golden",
                name: "Golden Skin",
                rarity: "legendary"
            };
        }
        if (i === 25) {
            tier.premiumReward = {
                type: "emote",
                itemId: "emote_dance",
                name: "Dance Emote",
                rarity: "epic"
            };
        }
        if (i === 50) {
            tier.premiumReward = {
                type: "avatar",
                itemId: "avatar_crown",
                name: "Crown Avatar",
                rarity: "legendary"
            };
        }

        tiers.push(tier);
    }

    return tiers;
}

// Fill tiers
CURRENT_SEASON.tiers = generateTiers();

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

function getBattlePassProgress(nk: nkruntime.Nakama, userId: string): BattlePassProgress | null {
    const result = nk.storageRead([
        { collection: COLLECTION_BATTLE_PASS, key: userId, userId }
    ]);

    if (result && result.length > 0 && result[0].value) {
        return result[0].value as BattlePassProgress;
    }
    return null;
}

function saveBattlePassProgress(nk: nkruntime.Nakama, userId: string, progress: BattlePassProgress): void {
    nk.storageWrite([{
        collection: COLLECTION_BATTLE_PASS,
        key: userId,
        userId,
        value: progress,
        permissionRead: 1,
        permissionWrite: 1
    }]);
}

function initializeBattlePass(nk: nkruntime.Nakama, userId: string): BattlePassProgress {
    const progress: BattlePassProgress = {
        userId,
        seasonId: CURRENT_SEASON.id,
        tier: 1,
        xp: 0,
        xpToNextTier: CURRENT_SEASON.tiers[0]?.xpRequired || 100,
        freeClaimed: [],
        premiumClaimed: [],
        hasPremium: false
    };

    saveBattlePassProgress(nk, userId, progress);
    return progress;
}

function getCurrentTierDefinition(tier: number): BattlePassTier | null {
    return CURRENT_SEASON.tiers.find(t => t.tier === tier) || null;
}

function addBattlePassXp(nk: nkruntime.Nakama, userId: string, amount: number): { tier: number; xp: number } {
    let progress = getBattlePassProgress(nk, userId);
    if (!progress) {
        progress = initializeBattlePass(nk, userId);
    }

    progress.xp += amount;
    let leveledUp = false;

    // Check for tier up
    while (progress.xp >= progress.xpToNextTier && progress.tier < CURRENT_SEASON.maxTiers) {
        progress.xp -= progress.xpToNextTier;
        progress.tier += 1;
        const tierDef = getCurrentTierDefinition(progress.tier);
        progress.xpToNextTier = tierDef?.xpRequired || 100;
        leveledUp = true;

        // Send notification for tier up
        try {
            const notifyPayload = JSON.stringify({
                type: "level_up",
                title: `Battle Pass Tier ${progress.tier}!`,
                message: `You reached tier ${progress.tier}!`,
                data: { tier: progress.tier }
            });
            nk.rpc("notification.send", notifyPayload);
        } catch (e) {
            // Ignore
        }
    }

    saveBattlePassProgress(nk, userId, progress);

    return {
        tier: progress.tier,
        xp: progress.xp
    };
}

// ============================================================
// RPC: Get battle pass
// ============================================================

export const rpcGetBattlePass: nkruntime.RpcFunction = (
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

        let progress = getBattlePassProgress(nk, userId);
        if (!progress) {
            progress = initializeBattlePass(nk, userId);
        }

        return JSON.stringify({
            season: {
                ...CURRENT_SEASON,
                tiers: undefined // Don't send all tiers to save bandwidth
            },
            progress: {
                tier: progress.tier,
                xp: progress.xp,
                xpToNextTier: progress.xpToNextTier,
                hasPremium: progress.hasPremium,
                freeClaimed: progress.freeClaimed,
                premiumClaimed: progress.premiumClaimed
            },
            tiers: CURRENT_SEASON.tiers.map(t => ({
                ...t,
                freeClaimed: progress.freeClaimed.includes(t.tier),
                premiumClaimed: progress.premiumClaimed.includes(t.tier),
                locked: t.tier > progress.tier
            }))
        });
    } catch (e) {
        throw new Error(`Failed to get battle pass: ${e}`);
    }
};

// ============================================================
// RPC: Add battle pass XP
// ============================================================

export const rpcAddBattlePassXp: nkruntime.RpcFunction = (
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

        const result = addBattlePassXp(nk, userId, amount);

        return JSON.stringify({
            success: true,
            tier: result.tier,
            xp: result.xp
        });
    } catch (e) {
        throw new Error(`Failed to add battle pass XP: ${e}`);
    }
};

// ============================================================
// RPC: Claim battle pass tier reward
// ============================================================

export const rpcClaimBattlePassReward: nkruntime.RpcFunction = (
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
        const tier: number = data.tier || 0;
        const isPremium: boolean = data.isPremium || false;

        if (tier <= 0 || tier > CURRENT_SEASON.maxTiers) {
            throw new Error("Invalid tier");
        }

        let progress = getBattlePassProgress(nk, userId);
        if (!progress) {
            progress = initializeBattlePass(nk, userId);
        }

        // Check if tier is unlocked
        if (tier > progress.tier) {
            throw new Error("Tier not unlocked");
        }

        const tierDef = getCurrentTierDefinition(tier);
        if (!tierDef) {
            throw new Error("Tier not found");
        }

        if (isPremium) {
            if (!progress.hasPremium) {
                throw new Error("Premium battle pass required");
            }
            if (progress.premiumClaimed.includes(tier)) {
                throw new Error("Premium reward already claimed");
            }
            if (!tierDef.premiumReward) {
                throw new Error("No premium reward for this tier");
            }

            // Grant premium reward
            const reward = tierDef.premiumReward;
            grantReward(nk, userId, reward);
            progress.premiumClaimed.push(tier);
        } else {
            if (progress.freeClaimed.includes(tier)) {
                throw new Error("Free reward already claimed");
            }
            if (!tierDef.freeReward) {
                throw new Error("No free reward for this tier");
            }

            // Grant free reward
            const reward = tierDef.freeReward;
            grantReward(nk, userId, reward);
            progress.freeClaimed.push(tier);
        }

        saveBattlePassProgress(nk, userId, progress);

        return JSON.stringify({
            success: true,
            tier,
            isPremium,
            claimed: true
        });
    } catch (e) {
        throw new Error(`Failed to claim battle pass reward: ${e}`);
    }
};

function grantReward(nk: nkruntime.Nakama, userId: string, reward: BattlePassReward): void {
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
        case "skin":
        case "emote":
        case "avatar":
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
// RPC: Purchase premium battle pass
// ============================================================

export const rpcPurchasePremiumBattlePass: nkruntime.RpcFunction = (
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

        let progress = getBattlePassProgress(nk, userId);
        if (!progress) {
            progress = initializeBattlePass(nk, userId);
        }

        if (progress.hasPremium) {
            throw new Error("Already have premium battle pass");
        }

        // Deduct premium currency
        // This would call economy.spendPremiumCurrency
        // For now, we'll assume it's paid

        progress.hasPremium = true;
        progress.premiumPurchasedAt = Date.now();
        saveBattlePassProgress(nk, userId, progress);

        return JSON.stringify({
            success: true,
            hasPremium: true,
            message: "Premium battle pass purchased!"
        });
    } catch (e) {
        throw new Error(`Failed to purchase premium battle pass: ${e}`);
    }
};

// ============================================================
// INIT
// ============================================================

export function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama): void {
    nk.registerRpc("battlepass.get", rpcGetBattlePass);
    nk.registerRpc("battlepass.addXp", rpcAddBattlePassXp);
    nk.registerRpc("battlepass.claim", rpcClaimBattlePassReward);
    nk.registerRpc("battlepass.purchase", rpcPurchasePremiumBattlePass);

    logger.info("LNBQSHA Battle Pass Module initialized");
    logger.info(`Season: ${CURRENT_SEASON.name}, ${CURRENT_SEASON.maxTiers} tiers`);
    logger.info("Registered RPCs: battlepass.*");
}
