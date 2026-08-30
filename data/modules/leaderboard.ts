// LNBQSHA Product Layer — Leaderboard & Tournament System
// Submit scores, leaderboards, tournaments, prizes

import { nkruntime } from "nakama-runtime";

// ============================================================
// TYPES
// ============================================================

interface LeaderboardEntry {
    userId: string;
    username: string;
    displayName: string;
    score: number;
    rank: number;
    timestamp: number;
    metadata: any;
}

interface Tournament {
    id: string;
    name: string;
    description: string;
    gameMode: string;
    startTime: number;
    endTime: number;
    maxPlayers: number;
    entryFee: number;
    prizePool: number;
    status: "upcoming" | "active" | "ended";
    entries: TournamentEntry[];
}

interface TournamentEntry {
    userId: string;
    username: string;
    displayName: string;
    score: number;
    rank: number;
    joinedAt: number;
    paid: boolean;
}

// ============================================================
// CONSTANTS
// ============================================================

const COLLECTION_LEADERBOARD = "lnbqsha_leaderboard";
const COLLECTION_TOURNAMENT = "lnbqsha_tournament";
const COLLECTION_TOURNAMENT_ENTRY = "lnbqsha_tournament_entry";

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

function getLeaderboard(nk: nkruntime.Nakama, leaderboardId: string): LeaderboardEntry[] {
    const result = nk.storageRead([
        { collection: COLLECTION_LEADERBOARD, key: leaderboardId, userId: "system" }
    ]);

    if (result && result.length > 0 && result[0].value) {
        return result[0].value as LeaderboardEntry[];
    }
    return [];
}

function saveLeaderboard(nk: nkruntime.Nakama, leaderboardId: string, entries: LeaderboardEntry[]): void {
    // Sort by score descending
    entries.sort((a, b) => b.score - a.score);
    // Assign ranks
    entries.forEach((entry, index) => {
        entry.rank = index + 1;
    });

    nk.storageWrite([{
        collection: COLLECTION_LEADERBOARD,
        key: leaderboardId,
        userId: "system",
        value: entries,
        permissionRead: 2,
        permissionWrite: 1
    }]);
}

function getTournament(nk: nkruntime.Nakama, tournamentId: string): Tournament | null {
    const result = nk.storageRead([
        { collection: COLLECTION_TOURNAMENT, key: tournamentId, userId: "system" }
    ]);

    if (result && result.length > 0 && result[0].value) {
        return result[0].value as Tournament;
    }
    return null;
}

function saveTournament(nk: nkruntime.Nakama, tournament: Tournament): void {
    nk.storageWrite([{
        collection: COLLECTION_TOURNAMENT,
        key: tournament.id,
        userId: "system",
        value: tournament,
        permissionRead: 2,
        permissionWrite: 1
    }]);
}

// ============================================================
// RPC: Submit score to leaderboard
// ============================================================

export const rpcSubmitScore: nkruntime.RpcFunction = (
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
        const leaderboardId: string = data.leaderboardId || "global";
        const score: number = data.score || 0;
        const metadata: any = data.metadata || {};

        if (score <= 0) {
            throw new Error("Score must be positive");
        }

        const user = nk.usersGetId([userId])[0];
        const username = user?.username || "unknown";
        const state = nk.storageRead([
            { collection: "lnbqsha_player_state", key: "state", userId }
        ]);
        let displayName = username;
        if (state && state.length > 0 && state[0].value) {
            displayName = state[0].value.displayName || username;
        }

        const entries = getLeaderboard(nk, leaderboardId);

        // Check if user already has an entry
        const existingIndex = entries.findIndex(e => e.userId === userId);
        if (existingIndex !== -1) {
            // Update if score is higher
            if (entries[existingIndex].score >= score) {
                return JSON.stringify({ success: true, updated: false });
            }
            entries.splice(existingIndex, 1);
        }

        // Add new entry
        entries.push({
            userId,
            username,
            displayName,
            score,
            rank: 0,
            timestamp: Date.now(),
            metadata
        });

        saveLeaderboard(nk, leaderboardId, entries);

        // Record activity
        try {
            const payload = JSON.stringify({
                type: "finished_game",
                metadata: { leaderboardId, score, rank: entries.findIndex(e => e.userId === userId) + 1 }
            });
            nk.rpc("social.recordActivity", payload);
        } catch (e) {
            // Ignore
        }

        const rank = entries.findIndex(e => e.userId === userId) + 1;
        return JSON.stringify({
            success: true,
            rank,
            totalEntries: entries.length
        });
    } catch (e) {
        throw new Error(`Failed to submit score: ${e}`);
    }
};

// ============================================================
// RPC: Get leaderboard
// ============================================================

export const rpcGetLeaderboard: nkruntime.RpcFunction = (
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
        const leaderboardId: string = data.leaderboardId || "global";
        const limit: number = data.limit || 100;
        const offset: number = data.offset || 0;

        const entries = getLeaderboard(nk, leaderboardId);
        const paginated = entries.slice(offset, offset + limit);

        return JSON.stringify({
            entries: paginated,
            total: entries.length,
            offset,
            limit
        });
    } catch (e) {
        throw new Error(`Failed to get leaderboard: ${e}`);
    }
};

// ============================================================
// RPC: Get user rank
// ============================================================

export const rpcGetUserRank: nkruntime.RpcFunction = (
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
        const leaderboardId: string = data.leaderboardId || "global";

        const entries = getLeaderboard(nk, leaderboardId);
        const rank = entries.findIndex(e => e.userId === userId) + 1;
        const userEntry = entries.find(e => e.userId === userId);

        return JSON.stringify({
            rank: rank > 0 ? rank : null,
            entry: userEntry || null,
            total: entries.length
        });
    } catch (e) {
        throw new Error(`Failed to get user rank: ${e}`);
    }
};

// ============================================================
// RPC: Create tournament
// ============================================================

export const rpcCreateTournament: nkruntime.RpcFunction = (
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

        // Admin check - only special users can create tournaments
        // For simplicity, allow any user for now

        const data = JSON.parse(payload);
        const name: string = data.name || "Tournament";
        const description: string = data.description || "";
        const gameMode: string = data.gameMode || "default";
        const maxPlayers: number = data.maxPlayers || 50;
        const entryFee: number = data.entryFee || 0;
        const prizePool: number = data.prizePool || 0;
        const durationHours: number = data.durationHours || 24;

        const tournamentId = generateUUID();
        const now = Date.now();

        const tournament: Tournament = {
            id: tournamentId,
            name,
            description,
            gameMode,
            startTime: now,
            endTime: now + (durationHours * 3600000),
            maxPlayers,
            entryFee,
            prizePool,
            status: "active",
            entries: []
        };

        saveTournament(nk, tournament);

        return JSON.stringify(tournament);
    } catch (e) {
        throw new Error(`Failed to create tournament: ${e}`);
    }
};

// ============================================================
// RPC: Join tournament
// ============================================================

export const rpcJoinTournament: nkruntime.RpcFunction = (
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
        const tournamentId: string = data.tournamentId;

        if (!tournamentId) {
            throw new Error("tournamentId required");
        }

        const tournament = getTournament(nk, tournamentId);
        if (!tournament) {
            throw new Error("Tournament not found");
        }

        if (tournament.status !== "active") {
            throw new Error("Tournament is not active");
        }

        if (tournament.entries.length >= tournament.maxPlayers) {
            throw new Error("Tournament is full");
        }

        // Check if already joined
        if (tournament.entries.some(e => e.userId === userId)) {
            throw new Error("Already joined tournament");
        }

        // Charge entry fee (call economy RPC)
        if (tournament.entryFee > 0) {
            try {
                const walletResult = nk.rpc("economy.getWallet", JSON.stringify({}));
                const wallet = JSON.parse(walletResult);
                if (wallet.premiumBalance < tournament.entryFee) {
                    throw new Error("Insufficient premium currency");
                }
                // Spend the currency
                // This would call economy.spendPremiumCurrency
                // For now, we'll assume it's paid
            } catch (e) {
                throw new Error(`Failed to charge entry fee: ${e}`);
            }
        }

        const user = nk.usersGetId([userId])[0];
        const username = user?.username || "unknown";
        const state = nk.storageRead([
            { collection: "lnbqsha_player_state", key: "state", userId }
        ]);
        let displayName = username;
        if (state && state.length > 0 && state[0].value) {
            displayName = state[0].value.displayName || username;
        }

        const entry: TournamentEntry = {
            userId,
            username,
            displayName,
            score: 0,
            rank: 0,
            joinedAt: Date.now(),
            paid: tournament.entryFee === 0
        };

        tournament.entries.push(entry);
        saveTournament(nk, tournament);

        return JSON.stringify(tournament);
    } catch (e) {
        throw new Error(`Failed to join tournament: ${e}`);
    }
};

// ============================================================
// RPC: Submit tournament score
// ============================================================

export const rpcSubmitTournamentScore: nkruntime.RpcFunction = (
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
        const tournamentId: string = data.tournamentId;
        const score: number = data.score || 0;

        if (!tournamentId) {
            throw new Error("tournamentId required");
        }
        if (score <= 0) {
            throw new Error("Score must be positive");
        }

        const tournament = getTournament(nk, tournamentId);
        if (!tournament) {
            throw new Error("Tournament not found");
        }

        if (tournament.status !== "active") {
            throw new Error("Tournament is not active");
        }

        // Find user's entry
        const entry = tournament.entries.find(e => e.userId === userId);
        if (!entry) {
            throw new Error("Not joined tournament");
        }

        // Update score if higher
        if (score > entry.score) {
            entry.score = score;
            // Sort entries by score
            tournament.entries.sort((a, b) => b.score - a.score);
            tournament.entries.forEach((e, index) => {
                e.rank = index + 1;
            });
            saveTournament(nk, tournament);
        }

        return JSON.stringify({
            success: true,
            rank: entry.rank,
            score: entry.score
        });
    } catch (e) {
        throw new Error(`Failed to submit tournament score: ${e}`);
    }
};

// ============================================================
// RPC: Get tournament
// ============================================================

export const rpcGetTournament: nkruntime.RpcFunction = (
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
        const tournamentId: string = data.tournamentId;

        if (!tournamentId) {
            throw new Error("tournamentId required");
        }

        const tournament = getTournament(nk, tournamentId);
        if (!tournament) {
            throw new Error("Tournament not found");
        }

        return JSON.stringify(tournament);
    } catch (e) {
        throw new Error(`Failed to get tournament: ${e}`);
    }
};

// ============================================================
// RPC: Get active tournaments
// ============================================================

export const rpcGetActiveTournaments: nkruntime.RpcFunction = (
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

        // For simplicity, we'll return a static list
        // In production, we'd list all tournaments from storage
        return JSON.stringify({
            tournaments: [],
            message: "Tournament listing not fully implemented"
        });
    } catch (e) {
        throw new Error(`Failed to get active tournaments: ${e}`);
    }
};

// ============================================================
// RPC: Claim tournament prize
// ============================================================

export const rpcClaimTournamentPrize: nkruntime.RpcFunction = (
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
        const tournamentId: string = data.tournamentId;

        if (!tournamentId) {
            throw new Error("tournamentId required");
        }

        const tournament = getTournament(nk, tournamentId);
        if (!tournament) {
            throw new Error("Tournament not found");
        }

        if (tournament.status !== "ended") {
            throw new Error("Tournament has not ended");
        }

        // Find user's entry
        const entry = tournament.entries.find(e => e.userId === userId);
        if (!entry) {
            throw new Error("Not joined tournament");
        }

        if (entry.rank === 0 || entry.rank > 3) {
            throw new Error("No prize for this rank");
        }

        // Calculate prize (top 3 get prize pool split)
        const prizeAmount = tournament.prizePool / (entry.rank === 1 ? 2 : entry.rank === 2 ? 3 : 4);

        // Grant prize (call economy RPC)
        try {
            const grantPayload = JSON.stringify({
                currency: "soft",
                amount: Math.floor(prizeAmount),
                description: `Tournament prize: ${tournament.name} (Rank ${entry.rank})`,
                source: "tournament"
            });
            // This would call economy.grantCurrency
            // For now, we'll just return the prize info
        } catch (e) {
            throw new Error(`Failed to claim prize: ${e}`);
        }

        return JSON.stringify({
            success: true,
            prize: Math.floor(prizeAmount),
            rank: entry.rank,
            tournament: tournament.name
        });
    } catch (e) {
        throw new Error(`Failed to claim tournament prize: ${e}`);
    }
};

// ============================================================
// INIT
// ============================================================

export function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama): void {
    // Register RPCs
    nk.registerRpc("leaderboard.submitScore", rpcSubmitScore);
    nk.registerRpc("leaderboard.get", rpcGetLeaderboard);
    nk.registerRpc("leaderboard.getUserRank", rpcGetUserRank);
    nk.registerRpc("tournament.create", rpcCreateTournament);
    nk.registerRpc("tournament.join", rpcJoinTournament);
    nk.registerRpc("tournament.submitScore", rpcSubmitTournamentScore);
    nk.registerRpc("tournament.get", rpcGetTournament);
    nk.registerRpc("tournament.getActive", rpcGetActiveTournaments);
    nk.registerRpc("tournament.claimPrize", rpcClaimTournamentPrize);

    logger.info("LNBQSHA Leaderboard & Tournament Module initialized");
    logger.info("Registered RPCs: leaderboard.*, tournament.*");
      }
