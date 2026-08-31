// LNBQSHA Product Layer — Obstacle Rush Game
// First playable experience

import { nkruntime } from "nakama-runtime";

// ============================================================
// TYPES
// ============================================================

interface GameState {
    userId: string;
    score: number;
    distance: number;
    speed: number;
    obstacles: Obstacle[];
    startTime: number;
    lastUpdate: number;
    active: boolean;
}

interface Obstacle {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    type: "rock" | "tree" | "wall";
}

// ============================================================
// GAME LOGIC
// ============================================================

const OBSTACLE_TYPES = ["rock", "tree", "wall"];
const INITIAL_SPEED = 5;
const MAX_SPEED = 20;
const SPEED_INCREMENT = 0.1;
const OBSTACLE_SPAWN_RATE = 1000; // ms
const GAME_DURATION = 60000; // 60 seconds

function generateObstacle(): Obstacle {
    const type = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
    return {
        id: Math.random().toString(36).substring(7),
        x: 800 + Math.random() * 200,
        y: Math.random() * 400,
        width: 30 + Math.random() * 20,
        height: 30 + Math.random() * 20,
        type: type as any
    };
}

function updateGameState(state: GameState, deltaTime: number): GameState {
    if (!state.active) return state;

    // Update speed
    state.speed = Math.min(state.speed + SPEED_INCREMENT * deltaTime, MAX_SPEED);

    // Update distance
    state.distance += state.speed * deltaTime;

    // Update score (distance * difficulty)
    state.score = Math.floor(state.distance * (1 + state.speed / 50));

    // Move obstacles
    state.obstacles = state.obstacles
        .map(o => ({
            ...o,
            x: o.x - state.speed * deltaTime
        }))
        .filter(o => o.x > -100);

    // Spawn new obstacles
    if (Math.random() < deltaTime / (OBSTACLE_SPAWN_RATE / 1000)) {
        state.obstacles.push(generateObstacle());
    }

    state.lastUpdate = Date.now();
    return state;
}

// ============================================================
// RPC: Start game
// ============================================================

export const rpcStartGame: nkruntime.RpcFunction = (
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

        const state: GameState = {
            userId,
            score: 0,
            distance: 0,
            speed: INITIAL_SPEED,
            obstacles: [],
            startTime: Date.now(),
            lastUpdate: Date.now(),
            active: true
        };

        // Store game state
        nk.storageWrite([{
            collection: "obstacle_rush_game",
            key: userId,
            userId,
            value: state,
            permissionRead: 1,
            permissionWrite: 1
        }]);

        return JSON.stringify({
            success: true,
            state: {
                score: state.score,
                distance: state.distance,
                speed: state.speed,
                obstacles: state.obstacles
            }
        });
    } catch (e) {
        throw new Error(`Failed to start game: ${e}`);
    }
};

// ============================================================
// RPC: Update game (called periodically by client)
// ============================================================

export const rpcUpdateGame: nkruntime.RpcFunction = (
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
        const deltaTime = data.deltaTime || 0.1;

        // Get current state
        const result = nk.storageRead([
            { collection: "obstacle_rush_game", key: userId, userId }
        ]);

        if (!result || result.length === 0 || !result[0].value) {
            throw new Error("Game not started");
        }

        const state = result[0].value as GameState;
        if (!state.active) {
            throw new Error("Game already ended");
        }

        // Update state
        const newState = updateGameState(state, deltaTime);

        // Save state
        nk.storageWrite([{
            collection: "obstacle_rush_game",
            key: userId,
            userId,
            value: newState,
            permissionRead: 1,
            permissionWrite: 1
        }]);

        return JSON.stringify({
            score: newState.score,
            distance: newState.distance,
            speed: newState.speed,
            obstacles: newState.obstacles.slice(0, 20) // Send only last 20 obstacles
        });
    } catch (e) {
        throw new Error(`Failed to update game: ${e}`);
    }
};

// ============================================================
// RPC: End game
// ============================================================

export const rpcEndGame: nkruntime.RpcFunction = (
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

        // Get current state
        const result = nk.storageRead([
            { collection: "obstacle_rush_game", key: userId, userId }
        ]);

        if (!result || result.length === 0 || !result[0].value) {
            throw new Error("Game not started");
        }

        const state = result[0].value as GameState;
        state.active = false;

        // Calculate rewards
        const xpEarned = Math.floor(state.score / 10);
        const coinsEarned = Math.floor(state.score / 20);

        // Add XP
        try {
            const xpPayload = JSON.stringify({ amount: xpEarned });
            nk.rpc("progression.addXp", xpPayload);
        } catch (e) {
            logger.warn("Failed to add XP", e);
        }

        // Submit to leaderboard
        try {
            const lbPayload = JSON.stringify({
                leaderboardId: "obstacle_rush",
                score: state.score,
                metadata: {
                    distance: state.distance,
                    speed: state.speed,
                    duration: (Date.now() - state.startTime) / 1000
                }
            });
            nk.rpc("leaderboard.submitScore", lbPayload);
        } catch (e) {
            logger.warn("Failed to submit leaderboard score", e);
        }

        // Record activity
        try {
            const activityPayload = JSON.stringify({
                type: "finished_game",
                metadata: {
                    game: "obstacle_rush",
                    score: state.score,
                    distance: state.distance,
                    xpEarned,
                    coinsEarned
                }
            });
            nk.rpc("social.recordActivity", activityPayload);
        } catch (e) {
            logger.warn("Failed to record activity", e);
        }

        // Delete game state
        nk.storageDelete([
            { collection: "obstacle_rush_game", key: userId, userId }
        ]);

        return JSON.stringify({
            success: true,
            score: state.score,
            distance: state.distance,
            xpEarned,
            coinsEarned
        });
    } catch (e) {
        throw new Error(`Failed to end game: ${e}`);
    }
};

// ============================================================
// RPC: Get game state
// ============================================================

export const rpcGetGameState: nkruntime.RpcFunction = (
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

        const result = nk.storageRead([
            { collection: "obstacle_rush_game", key: userId, userId }
        ]);

        if (!result || result.length === 0 || !result[0].value) {
            return JSON.stringify({ active: false });
        }

        const state = result[0].value as GameState;
        return JSON.stringify({
            active: state.active,
            score: state.score,
            distance: state.distance,
            speed: state.speed
        });
    } catch (e) {
        throw new Error(`Failed to get game state: ${e}`);
    }
};

// ============================================================
// INIT
// ============================================================

export function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama): void {
    nk.registerRpc("game.start", rpcStartGame);
    nk.registerRpc("game.update", rpcUpdateGame);
    nk.registerRpc("game.end", rpcEndGame);
    nk.registerRpc("game.getState", rpcGetGameState);

    logger.info("LNBQSHA Obstacle Rush Module initialized");
    logger.info("Registered RPCs: game.*");
}
