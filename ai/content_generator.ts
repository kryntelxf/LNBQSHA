// LNBQSHA AI — Content Generator
// AI-powered game content generation

import { nkruntime } from "nakama-runtime";

// ============================================================
// TYPES
// ============================================================

interface GeneratedContent {
    id: string;
    type: "quest" | "achievement" | "event" | "challenge" | "story";
    title: string;
    description: string;
    difficulty: "easy" | "medium" | "hard" | "legendary";
    rewards: {
        xp?: number;
        coins?: number;
        gems?: number;
        item?: string;
    };
    requirements: {
        level?: number;
        questId?: string;
        achievementId?: string;
    };
    generatedAt: number;
    expiresAt: number;
}

// ============================================================
// CONSTANTS
// ============================================================

const COLLECTION_GENERATED_CONTENT = "lnbqsha_generated_content";

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

function getGeneratedContent(nk: nkruntime.Nakama): GeneratedContent[] {
    const result = nk.storageRead([
        { collection: COLLECTION_GENERATED_CONTENT, key: "all", userId: "system" }
    ]);

    if (result && result.length > 0 && result[0].value) {
        return result[0].value as GeneratedContent[];
    }
    return [];
}

function saveGeneratedContent(nk: nkruntime.Nakama, content: GeneratedContent[]): void {
    nk.storageWrite([{
        collection: COLLECTION_GENERATED_CONTENT,
        key: "all",
        userId: "system",
        value: content,
        permissionRead: 2,
        permissionWrite: 1
    }]);
}

function generateQuestContent(level: number): GeneratedContent {
    const questTypes = [
        { title: "Defeat the Monsters", desc: "Defeat {count} monsters in the arena", difficulty: "medium" },
        { title: "Collect the Treasures", desc: "Collect {count} treasures from the dungeon", difficulty: "easy" },
        { title: "Save the Kingdom", desc: "Save the kingdom from the evil wizard", difficulty: "hard" },
        { title: "Become the Champion", desc: "Win {count} matches in the arena", difficulty: "hard" },
        { title: "Explore the Unknown", desc: "Explore {count} new areas in the world", difficulty: "medium" }
    ];

    const template = questTypes[Math.floor(Math.random() * questTypes.length)];
    const count = Math.floor(Math.random() * 5) + 3;

    return {
        id: generateUUID(),
        type: "quest",
        title: template.title,
        description: template.desc.replace(/{count}/g, String(count)),
        difficulty: template.difficulty as any,
        rewards: {
            xp: level * 10 + Math.floor(Math.random() * 50),
            coins: level * 5 + Math.floor(Math.random() * 20),
            gems: Math.floor(Math.random() * 3)
        },
        requirements: {
            level: Math.max(1, level - 2)
        },
        generatedAt: Date.now(),
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
    };
}

function generateAchievementContent(level: number): GeneratedContent {
    const achievementTypes = [
        { title: "Master of {game}", desc: "Win {count} games in {game}", difficulty: "hard" },
        { title: "Collector", desc: "Collect {count} items", difficulty: "medium" },
        { title: "Social Butterfly", desc: "Add {count} friends", difficulty: "easy" },
        { title: "Legendary Player", desc: "Reach level {level}", difficulty: "legendary" },
        { title: "Tournament Winner", desc: "Win {count} tournaments", difficulty: "hard" }
    ];

    const template = achievementTypes[Math.floor(Math.random() * achievementTypes.length)];
    const count = Math.floor(Math.random() * 10) + 5;
    const games = ["Obstacle Rush", "Block Battle", "Coin Race", "Puzzle Quest"];

    return {
        id: generateUUID(),
        type: "achievement",
        title: template.title.replace(/{game}/g, games[Math.floor(Math.random() * games.length)]),
        description: template.desc
            .replace(/{count}/g, String(count))
            .replace(/{game}/g, games[Math.floor(Math.random() * games.length)])
            .replace(/{level}/g, String(level + 5)),
        difficulty: template.difficulty as any,
        rewards: {
            xp: level * 15 + Math.floor(Math.random() * 100),
            gems: Math.floor(Math.random() * 5) + 1
        },
        requirements: {
            level: level
        },
        generatedAt: Date.now(),
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000
    };
}

function generateEventContent(level: number): GeneratedContent {
    const eventTypes = [
        { title: "Double XP Weekend", desc: "Earn double XP for 48 hours", difficulty: "easy" },
        { title: "Tournament of Champions", desc: "Compete in the ultimate tournament", difficulty: "hard" },
        { title: "Community Challenge", desc: "Complete challenges with the community", difficulty: "medium" },
        { title: "Raid Boss", desc: "Defeat the raid boss with friends", difficulty: "legendary" }
    ];

    const template = eventTypes[Math.floor(Math.random() * eventTypes.length)];

    return {
        id: generateUUID(),
        type: "event",
        title: template.title,
        description: template.desc,
        difficulty: template.difficulty as any,
        rewards: {
            xp: level * 20 + Math.floor(Math.random() * 200),
            gems: Math.floor(Math.random() * 10) + 5
        },
        requirements: {},
        generatedAt: Date.now(),
        expiresAt: Date.now() + 3 * 24 * 60 * 60 * 1000
    };
}

// ============================================================
// RPC: Generate content
// ============================================================

export const rpcGenerateContent: nkruntime.RpcFunction = (
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
        const count: number = data.count || 3;
        const type: string = data.type || "all";

        // Get user's level
        let level = 1;
        try {
            const progResult = nk.rpc("progression.get", JSON.stringify({}));
            const prog = JSON.parse(progResult);
            level = prog.level || 1;
        } catch (e) {
            // Ignore
        }

        const generated: GeneratedContent[] = [];
        const generators = {
            quest: () => generateQuestContent(level),
            achievement: () => generateAchievementContent(level),
            event: () => generateEventContent(level)
        };

        const types = type === "all" ? Object.keys(generators) : [type];
        let attempts = 0;

        while (generated.length < count && attempts < 100) {
            attempts++;
            const randomType = types[Math.floor(Math.random() * types.length)];
            const generator = generators[randomType as keyof typeof generators];
            if (generator) {
                generated.push(generator());
            }
        }

        // Save generated content
        const existing = getGeneratedContent(nk);
        const allContent = [...existing, ...generated];
        saveGeneratedContent(nk, allContent);

        // Send notification
        try {
            const notifyPayload = JSON.stringify({
                type: "reward",
                title: "New Content Generated!",
                message: `${generated.length} new quests, achievements, and events are ready!`,
                data: { count: generated.length }
            });
            nk.rpc("notification.send", notifyPayload);
        } catch (e) {
            // Ignore
        }

        return JSON.stringify({
            success: true,
            generated: generated,
            totalContent: allContent.length
        });
    } catch (e) {
        throw new Error(`Failed to generate content: ${e}`);
    }
};

// ============================================================
// RPC: Get generated content
// ============================================================

export const rpcGetGeneratedContent: nkruntime.RpcFunction = (
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
        const type = data.type || "";
        const limit = data.limit || 50;
        const offset = data.offset || 0;

        let content = getGeneratedContent(nk);
        const now = Date.now();

        // Remove expired content
        content = content.filter(c => c.expiresAt > now);
        saveGeneratedContent(nk, content);

        // Filter by type
        if (type) {
            content = content.filter(c => c.type === type);
        }

        // Sort by generatedAt (newest first)
        content.sort((a, b) => b.generatedAt - a.generatedAt);

        const paginated = content.slice(offset, offset + limit);

        return JSON.stringify({
            content: paginated,
            total: content.length,
            offset,
            limit
        });
    } catch (e) {
        throw new Error(`Failed to get generated content: ${e}`);
    }
};

// ============================================================
// RPC: Claim generated content
// ============================================================

export const rpcClaimGeneratedContent: nkruntime.RpcFunction = (
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
        const contentId: string = data.contentId;

        if (!contentId) {
            throw new Error("contentId required");
        }

        const content = getGeneratedContent(nk);
        const index = content.findIndex(c => c.id === contentId);

        if (index === -1) {
            throw new Error("Content not found");
        }

        const item = content[index];

        // Check if expired
        if (item.expiresAt < Date.now()) {
            content.splice(index, 1);
            saveGeneratedContent(nk, content);
            throw new Error("Content has expired");
        }

        // Grant rewards
        if (item.rewards) {
            if (item.rewards.xp) {
                try {
                    nk.rpc("progression.addXp", JSON.stringify({ amount: item.rewards.xp }));
                } catch (e) {
                    // Ignore
                }
            }
            // Coins and gems would be granted via economy
        }

        // Remove claimed content
        content.splice(index, 1);
        saveGeneratedContent(nk, content);

        return JSON.stringify({
            success: true,
            claimed: item,
            message: `Claimed ${item.title}!`
        });
    } catch (e) {
        throw new Error(`Failed to claim content: ${e}`);
    }
};

// ============================================================
// INIT
// ============================================================

export function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama): void {
    nk.registerRpc("ai.generateContent", rpcGenerateContent);
    nk.registerRpc("ai.getGeneratedContent", rpcGetGeneratedContent);
    nk.registerRpc("ai.claimContent", rpcClaimGeneratedContent);

    logger.info("LNBQSHA AI Content Generator initialized");
    logger.info("Registered RPCs: ai.generateContent, ai.getGeneratedContent, ai.claimContent");
              }
