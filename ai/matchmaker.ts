// LNBQSHA AI — Smart Matchmaker
// AI-powered player matching based on skill, preferences, and behavior

import { nkruntime } from "nakama-runtime";

// ============================================================
// TYPES
// ============================================================

interface PlayerProfile {
    userId: string;
    skillLevel: number;
    preferredGames: string[];
    playStyle: "aggressive" | "defensive" | "balanced" | "supportive";
    averageScore: number;
    gamesPlayed: number;
    winRate: number;
    recentPerformance: number[];
    preferences: {
        language: string;
        region: string;
        playTime: string;
    };
}

interface MatchSuggestion {
    matchId: string;
    players: string[];
    gameMode: string;
    estimatedSkill: number;
    confidence: number;
    reason: string;
}

// ============================================================
// CONSTANTS
// ============================================================

const COLLECTION_PLAYER_PROFILES = "lnbqsha_player_profiles";
const COLLECTION_MATCH_SUGGESTIONS = "lnbqsha_match_suggestions";

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

function getPlayerProfile(nk: nkruntime.Nakama, userId: string): PlayerProfile | null {
    const result = nk.storageRead([
        { collection: COLLECTION_PLAYER_PROFILES, key: userId, userId }
    ]);

    if (result && result.length > 0 && result[0].value) {
        return result[0].value as PlayerProfile;
    }
    return null;
}

function savePlayerProfile(nk: nkruntime.Nakama, profile: PlayerProfile): void {
    nk.storageWrite([{
        collection: COLLECTION_PLAYER_PROFILES,
        key: profile.userId,
        userId: profile.userId,
        value: profile,
        permissionRead: 1,
        permissionWrite: 1
    }]);
}

function getMatchSuggestions(nk: nkruntime.Nakama): MatchSuggestion[] {
    const result = nk.storageRead([
        { collection: COLLECTION_MATCH_SUGGESTIONS, key: "all", userId: "system" }
    ]);

    if (result && result.length > 0 && result[0].value) {
        return result[0].value as MatchSuggestion[];
    }
    return [];
}

function saveMatchSuggestions(nk: nkruntime.Nakama, suggestions: MatchSuggestion[]): void {
    nk.storageWrite([{
        collection: COLLECTION_MATCH_SUGGESTIONS,
        key: "all",
        userId: "system",
        value: suggestions,
        permissionRead: 1,
        permissionWrite: 1
    }]);
}

function updatePlayerProfile(nk: nkruntime.Nakama, userId: string, gameMode: string, score: number, win: boolean): PlayerProfile {
    let profile = getPlayerProfile(nk, userId);
    if (!profile) {
        profile = {
            userId,
            skillLevel: 50,
            preferredGames: [],
            playStyle: "balanced",
            averageScore: 0,
            gamesPlayed: 0,
            winRate: 0,
            recentPerformance: [],
            preferences: {
                language: "en",
                region: "global",
                playTime: "any"
            }
        };
    }

    // Update stats
    profile.gamesPlayed += 1;
    profile.averageScore = (profile.averageScore * (profile.gamesPlayed - 1) + score) / profile.gamesPlayed;
    profile.recentPerformance.push(score);
    if (profile.recentPerformance.length > 10) {
        profile.recentPerformance.shift();
    }

    // Update win rate
    const totalWins = profile.gamesPlayed * (profile.winRate / 100);
    const newWins = win ? totalWins + 1 : totalWins;
    profile.winRate = (newWins / profile.gamesPlayed) * 100;

    // Update skill level based on performance
    const avgRecent = profile.recentPerformance.reduce((a, b) => a + b, 0) / profile.recentPerformance.length || 0;
    const baseSkill = 50 + (avgRecent / 1000) * 20;
    profile.skillLevel = Math.min(100, Math.max(1, baseSkill));

    // Update preferred games
    if (!profile.preferredGames.includes(gameMode)) {
        profile.preferredGames.push(gameMode);
        if (profile.preferredGames.length > 5) {
            profile.preferredGames.shift();
        }
    }

    savePlayerProfile(nk, profile);
    return profile;
}

function findMatches(profiles: PlayerProfile[], gameMode: string): MatchSuggestion[] {
    const suggestions: MatchSuggestion[] = [];
    const available = [...profiles];

    // Sort by skill level
    available.sort((a, b) => a.skillLevel - b.skillLevel);

    // Find groups of 2-4 players with similar skill
    for (let i = 0; i < available.length; i++) {
        const player = available[i];
        const matched: PlayerProfile[] = [player];
        const remaining = available.filter(p => p.userId !== player.userId);

        // Try to match with similar skill and play style
        for (const candidate of remaining) {
            if (matched.length >= 4) break;

            const skillDiff = Math.abs(candidate.skillLevel - player.skillLevel);
            const styleMatch = candidate.playStyle === player.playStyle;
            const gamePreference = candidate.preferredGames.includes(gameMode);

            // Calculate match score
            let matchScore = 0;
            if (skillDiff < 10) matchScore += 3;
            else if (skillDiff < 20) matchScore += 2;
            else if (skillDiff < 30) matchScore += 1;

            if (styleMatch) matchScore += 2;
            if (gamePreference) matchScore += 1;

            if (matchScore >= 2) {
                matched.push(candidate);
            }
        }

        if (matched.length >= 2) {
            const avgSkill = matched.reduce((sum, p) => sum + p.skillLevel, 0) / matched.length;
            const confidence = Math.min(100, 50 + (matched.length - 2) * 15);

            suggestions.push({
                matchId: generateUUID(),
                players: matched.map(p => p.userId),
                gameMode: gameMode,
                estimatedSkill: Math.round(avgSkill),
                confidence,
                reason: matched.length === 4 
                    ? "Perfect match! 4 players with similar skill." 
                    : matched.length === 3 
                    ? "Great match! 3 players with similar skill." 
                    : "Good match! 2 players with similar skill."
            });

            // Remove matched players from available
            const matchedIds = matched.map(p => p.userId);
            for (let j = available.length - 1; j >= 0; j--) {
                if (matchedIds.includes(available[j].userId)) {
                    available.splice(j, 1);
                }
            }
        }
    }

    return suggestions;
}

// ============================================================
// RPC: Update player profile
// ============================================================

export const rpcUpdatePlayerProfile: nkruntime.RpcFunction = (
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
        const gameMode: string = data.gameMode || "default";
        const score: number = data.score || 0;
        const win: boolean = data.win || false;

        const profile = updatePlayerProfile(nk, userId, gameMode, score, win);

        return JSON.stringify({
            success: true,
            profile
        });
    } catch (e) {
        throw new Error(`Failed to update player profile: ${e}`);
    }
};

// ============================================================
// RPC: Get player profile
// ============================================================

export const rpcGetPlayerProfile: nkruntime.RpcFunction = (
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

        const profile = getPlayerProfile(nk, userId);
        if (!profile) {
            return JSON.stringify({
                userId,
                skillLevel: 50,
                preferredGames: [],
                playStyle: "balanced",
                averageScore: 0,
                gamesPlayed: 0,
                winRate: 0,
                recentPerformance: [],
                preferences: {
                    language: "en",
                    region: "global",
                    playTime: "any"
                }
            });
        }

        return JSON.stringify(profile);
    } catch (e) {
        throw new Error(`Failed to get player profile: ${e}`);
    }
};

// ============================================================
// RPC: Find matches
// ============================================================

export const rpcFindMatches: nkruntime.RpcFunction = (
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

        // Get all player profiles
        // In production, we'd query all profiles efficiently
        // For now, we'll use a simplified approach

        // Get online players
        const onlinePlayers = nk.statusGet([]);
        const profiles: PlayerProfile[] = [];

        for (const player of onlinePlayers) {
            const profile = getPlayerProfile(nk, player.userId);
            if (profile && profile.userId !== userId) {
                profiles.push(profile);
            }
        }

        // Add current player
        const currentProfile = getPlayerProfile(nk, userId);
        if (currentProfile) {
            profiles.push(currentProfile);
        }

        // Find matches
        const suggestions = findMatches(profiles, gameMode);

        // Save suggestions
        saveMatchSuggestions(nk, suggestions);

        // Return suggestions for current user
        const userSuggestions = suggestions.filter(s => s.players.includes(userId));

        return JSON.stringify({
            matches: userSuggestions,
            total: userSuggestions.length
        });
    } catch (e) {
        throw new Error(`Failed to find matches: ${e}`);
    }
};

// ============================================================
// RPC: Get match suggestions
// ============================================================

export const rpcGetMatchSuggestions: nkruntime.RpcFunction = (
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

        const suggestions = getMatchSuggestions(nk);
        const userSuggestions = suggestions.filter(s => s.players.includes(userId));

        // Remove expired suggestions
        const validSuggestions = userSuggestions.slice(0, 10);

        return JSON.stringify({
            suggestions: validSuggestions
        });
    } catch (e) {
        throw new Error(`Failed to get match suggestions: ${e}`);
    }
};

// ============================================================
// RPC: Accept match suggestion
// ============================================================

export const rpcAcceptMatchSuggestion: nkruntime.RpcFunction = (
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
        const matchId: string = data.matchId;

        if (!matchId) {
            throw new Error("matchId required");
        }

        const suggestions = getMatchSuggestions(nk);
        const index = suggestions.findIndex(s => s.matchId === matchId);

        if (index === -1) {
            throw new Error("Match suggestion not found");
        }

        const suggestion = suggestions[index];

        // Check if user is in the match
        if (!suggestion.players.includes(userId)) {
            throw new Error("User not in this match");
        }

        // Create a match
        // In production, this would call matchmaker
        const matchIdResult = `match_${generateUUID()}`;

        // Remove suggestion
        suggestions.splice(index, 1);
        saveMatchSuggestions(nk, suggestions);

        return JSON.stringify({
            success: true,
            matchId: matchIdResult,
            players: suggestion.players,
            gameMode: suggestion.gameMode
        });
    } catch (e) {
        throw new Error(`Failed to accept match suggestion: ${e}`);
    }
};

// ============================================================
// INIT
// ============================================================

export function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama): void {
    nk.registerRpc("ai.updateProfile", rpcUpdatePlayerProfile);
    nk.registerRpc("ai.getProfile", rpcGetPlayerProfile);
    nk.registerRpc("ai.findMatches", rpcFindMatches);
    nk.registerRpc("ai.getSuggestions", rpcGetMatchSuggestions);
    nk.registerRpc("ai.acceptSuggestion", rpcAcceptMatchSuggestion);

    logger.info("LNBQSHA AI Smart Matchmaker initialized");
    logger.info("Registered RPCs: ai.updateProfile, ai.getProfile, ai.findMatches, ai.getSuggestions, ai.acceptSuggestion");
      }
