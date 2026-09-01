// LNBQSHA AI — Game Master
// AI-powered NPCs that play and interact with players

import { nkruntime } from "nakama-runtime";

// ============================================================
// TYPES
// ============================================================

interface AIPlayer {
    id: string;
    name: string;
    avatar: string;
    skillLevel: number;
    personality: "aggressive" | "defensive" | "balanced" | "supportive";
    currentGame: string | null;
    stats: {
        gamesPlayed: number;
        wins: number;
        losses: number;
        score: number;
    };
    lastActive: number;
}

interface AIConversation {
    id: string;
    playerId: string;
    aiId: string;
    messages: { role: "player" | "ai"; content: string; timestamp: number }[];
    context: string;
    createdAt: number;
}

// ============================================================
// CONSTANTS
// ============================================================

const COLLECTION_AI_PLAYERS = "lnbqsha_ai_players";
const COLLECTION_AI_CONVERSATIONS = "lnbqsha_ai_conversations";

// Pre-configured AI players
const AI_PLAYER_TEMPLATES: Omit<AIPlayer, "id" | "currentGame" | "lastActive" | "stats">[] = [
    {
        name: "ShadowBot",
        avatar: "shadow_bot.png",
        skillLevel: 80,
        personality: "aggressive"
    },
    {
        name: "GuardianBot",
        avatar: "guardian_bot.png",
        skillLevel: 70,
        personality: "defensive"
    },
    {
        name: "NeonBot",
        avatar: "neon_bot.png",
        skillLevel: 60,
        personality: "balanced"
    },
    {
        name: "SupportBot",
        avatar: "support_bot.png",
        skillLevel: 50,
        personality: "supportive"
    },
    {
        name: "LegendBot",
        avatar: "legend_bot.png",
        skillLevel: 90,
        personality: "aggressive"
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

function getAIPlayers(nk: nkruntime.Nakama): AIPlayer[] {
    const result = nk.storageRead([
        { collection: COLLECTION_AI_PLAYERS, key: "all", userId: "system" }
    ]);

    if (result && result.length > 0 && result[0].value) {
        return result[0].value as AIPlayer[];
    }
    return [];
}

function saveAIPlayers(nk: nkruntime.Nakama, players: AIPlayer[]): void {
    nk.storageWrite([{
        collection: COLLECTION_AI_PLAYERS,
        key: "all",
        userId: "system",
        value: players,
        permissionRead: 2,
        permissionWrite: 1
    }]);
}

function getAIConversations(nk: nkruntime.Nakama, playerId: string): AIConversation[] {
    const result = nk.storageRead([
        { collection: COLLECTION_AI_CONVERSATIONS, key: playerId, userId: playerId }
    ]);

    if (result && result.length > 0 && result[0].value) {
        return result[0].value as AIConversation[];
    }
    return [];
}

function saveAIConversations(nk: nkruntime.Nakama, playerId: string, conversations: AIConversation[]): void {
    nk.storageWrite([{
        collection: COLLECTION_AI_CONVERSATIONS,
        key: playerId,
        userId: playerId,
        value: conversations,
        permissionRead: 1,
        permissionWrite: 1
    }]);
}

function initializeAIPlayers(nk: nkruntime.Nakama): AIPlayer[] {
    const existing = getAIPlayers(nk);
    if (existing.length > 0) return existing;

    const players: AIPlayer[] = AI_PLAYER_TEMPLATES.map((template, index) => ({
        ...template,
        id: `ai_${index + 1}`,
        currentGame: null,
        lastActive: Date.now(),
        stats: {
            gamesPlayed: 0,
            wins: 0,
            losses: 0,
            score: 0
        }
    }));

    saveAIPlayers(nk, players);
    return players;
}

function getAIPlayerResponse(message: string, personality: string): string {
    // In production, this would call an LLM API
    // For now, we use rule-based responses
    const responses: Record<string, string[]> = {
        aggressive: [
            "I'll crush you!",
            "You're going down!",
            "Prepare to lose!",
            "Is that all you've got?",
            "Too easy!",
            "I'm just getting started!",
            "You can't defeat me!",
            "Try harder!"
        ],
        defensive: [
            "I'll protect my team!",
            "Stay behind me!",
            "I've got your back!",
            "Defense wins games!",
            "I'll hold the line!",
            "You can't break through!",
            "I'm a wall!",
            "My shield is unbreakable!"
        ],
        balanced: [
            "Good game!",
            "Well played!",
            "Let's do this!",
            "Here we go!",
            "Nice move!",
            "I'm ready!",
            "Let's have fun!",
            "Great match!"
        ],
        supportive: [
            "You can do it!",
            "I believe in you!",
            "Keep going!",
            "We're in this together!",
            "Stay positive!",
            "You're amazing!",
            "I'm here for you!",
            "Together we win!"
        ]
    };

    const pool = responses[personality] || responses.balanced;
    return pool[Math.floor(Math.random() * pool.length)];
}

// ============================================================
// RPC: Get AI players
// ============================================================

export const rpcGetAIPlayers: nkruntime.RpcFunction = (
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

        const players = initializeAIPlayers(nk);
        return JSON.stringify({
            players: players.map(p => ({
                id: p.id,
                name: p.name,
                avatar: p.avatar,
                skillLevel: p.skillLevel,
                personality: p.personality,
                stats: p.stats,
                status: p.currentGame ? "playing" : "online"
            }))
        });
    } catch (e) {
        throw new Error(`Failed to get AI players: ${e}`);
    }
};

// ============================================================
// RPC: Chat with AI
// ============================================================

export const rpcChatWithAI: nkruntime.RpcFunction = (
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
        const aiId: string = data.aiId;
        const message: string = data.message || "";

        if (!aiId) {
            throw new Error("aiId required");
        }
        if (!message) {
            throw new Error("message required");
        }

        const players = initializeAIPlayers(nk);
        const ai = players.find(p => p.id === aiId);
        if (!ai) {
            throw new Error("AI not found");
        }

        // Get or create conversation
        const conversations = getAIConversations(nk, userId);
        let conversation = conversations.find(c => c.aiId === aiId);

        if (!conversation) {
            conversation = {
                id: generateUUID(),
                playerId: userId,
                aiId: aiId,
                messages: [],
                context: "general",
                createdAt: Date.now()
            };
            conversations.push(conversation);
        }

        // Add player message
        conversation.messages.push({
            role: "player",
            content: message,
            timestamp: Date.now()
        });

        // Generate AI response
        const response = getAIPlayerResponse(message, ai.personality);
        conversation.messages.push({
            role: "ai",
            content: response,
            timestamp: Date.now()
        });

        // Save conversations
        saveAIConversations(nk, userId, conversations);

        return JSON.stringify({
            response,
            conversation: conversation.messages
        });
    } catch (e) {
        throw new Error(`Failed to chat with AI: ${e}`);
    }
};

// ============================================================
// RPC: Play against AI
// ============================================================

export const rpcPlayAgainstAI: nkruntime.RpcFunction = (
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
        const aiId: string = data.aiId;
        const gameMode: string = data.gameMode || "obstacle_rush";

        if (!aiId) {
            throw new Error("aiId required");
        }

        const players = initializeAIPlayers(nk);
        const ai = players.find(p => p.id === aiId);
        if (!ai) {
            throw new Error("AI not found");
        }

        // Simulate game
        const playerScore = Math.floor(Math.random() * 1000);
        const aiScore = Math.floor(Math.random() * 1000);
        const playerWin = playerScore > aiScore;

        // Update AI stats
        ai.stats.gamesPlayed += 1;
        if (playerWin) {
            ai.stats.losses += 1;
        } else {
            ai.stats.wins += 1;
        }
        ai.stats.score += aiScore;
        ai.lastActive = Date.now();
        saveAIPlayers(nk, players);

        // Record activity
        try {
            const activityPayload = JSON.stringify({
                type: "finished_game",
                metadata: {
                    game: "vs_ai",
                    aiName: ai.name,
                    playerScore,
                    aiScore,
                    result: playerWin ? "win" : "loss",
                    aiId: aiId
                }
            });
            nk.rpc("social.recordActivity", activityPayload);
        } catch (e) {
            // Ignore
        }

        return JSON.stringify({
            success: true,
            playerScore,
            aiScore,
            playerWin,
            aiName: ai.name,
            message: playerWin ? `You defeated ${ai.name}!` : `${ai.name} defeated you.`
        });
    } catch (e) {
        throw new Error(`Failed to play against AI: ${e}`);
    }
};

// ============================================================
// RPC: Get AI conversation history
// ============================================================

export const rpcGetAIConversations: nkruntime.RpcFunction = (
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

        const conversations = getAIConversations(nk, userId);
        return JSON.stringify({ conversations });
    } catch (e) {
        throw new Error(`Failed to get AI conversations: ${e}`);
    }
};

// ============================================================
// INIT
// ============================================================

export function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama): void {
    // Initialize AI players
    initializeAIPlayers(nk);

    nk.registerRpc("ai.getPlayers", rpcGetAIPlayers);
    nk.registerRpc("ai.chat", rpcChatWithAI);
    nk.registerRpc("ai.play", rpcPlayAgainstAI);
    nk.registerRpc("ai.getConversations", rpcGetAIConversations);

    logger.info("LNBQSHA AI Game Master initialized");
    logger.info(`Loaded ${AI_PLAYER_TEMPLATES.length} AI players`);
    logger.info("Registered RPCs: ai.*");
      }
