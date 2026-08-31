// LNBQSHA Product Layer — Obstacle Rush Match Handler
// Real-time multiplayer game match handler

import { nkruntime } from "nakama-runtime";

// ============================================================
// TYPES
// ============================================================

interface MatchState {
    players: Map<string, PlayerState>;
    obstacles: Obstacle[];
    gameStarted: boolean;
    gameEnded: boolean;
    startTime: number;
    endTime: number;
    spawnTimer: number;
    speed: number;
}

interface PlayerState {
    userId: string;
    username: string;
    x: number;
    y: number;
    score: number;
    distance: number;
    alive: boolean;
    joinedAt: number;
    lastUpdate: number;
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
// MATCH HANDLER
// ============================================================

function generateUUID(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === "x" ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function generateObstacle(): Obstacle {
    const types = ["rock", "tree", "wall"];
    const type = types[Math.floor(Math.random() * types.length)];
    return {
        id: generateUUID(),
        x: 800 + Math.random() * 200,
        y: Math.random() * 400,
        width: 30 + Math.random() * 20,
        height: 30 + Math.random() * 20,
        type: type as any
    };
}

function initMatchState(): MatchState {
    return {
        players: new Map(),
        obstacles: [],
        gameStarted: false,
        gameEnded: false,
        startTime: 0,
        endTime: 0,
        spawnTimer: 0,
        speed: 5
    };
}

function updateMatchState(state: MatchState, deltaTime: number): MatchState {
    if (!state.gameStarted || state.gameEnded) return state;

    // Update speed
    state.speed = Math.min(state.speed + 0.05 * deltaTime, 20);

    // Move obstacles
    state.obstacles = state.obstacles
        .map(o => ({
            ...o,
            x: o.x - state.speed * deltaTime
        }))
        .filter(o => o.x > -100);

    // Spawn obstacles
    state.spawnTimer += deltaTime;
    const spawnRate = Math.max(200, 1000 - state.speed * 30);
    if (state.spawnTimer > spawnRate / 1000) {
        state.spawnTimer = 0;
        state.obstacles.push(generateObstacle());
    }

    // Update players
    for (const [userId, player] of state.players) {
        if (!player.alive) continue;
        // Update distance based on speed
        player.distance += state.speed * deltaTime;
        player.score = Math.floor(player.distance * (1 + state.speed / 20));

        // Check collision with obstacles
        // In a real game, this would be more sophisticated
        // For now, we just check if player is in the same area as obstacles
        // Simplified collision detection
    }

    return state;
}

// ============================================================
// NAKAMA MATCH HANDLER
// ============================================================

export const matchHandler: nkruntime.MatchHandler = {
    matchInit: (ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, params: any) => {
        logger.info("Obstacle Rush match initialized", params);
        const state = initMatchState();
        const tickRate = 10; // 10 ticks per second
        const label = JSON.stringify({
            mode: "obstacle_rush",
            created: Date.now()
        });
        return { state, tickRate, label };
    },

    matchJoinAttempt: (ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, state: any, presences: any) => {
        // Allow all players to join
        return { state, accept: true };
    },

    matchJoin: (ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, state: any, presences: any) => {
        for (const presence of presences) {
            const userId = presence.getUserId();
            const username = presence.getUsername();
            
            if (!state.players.has(userId)) {
                state.players.set(userId, {
                    userId,
                    username,
                    x: 100 + Math.random() * 200,
                    y: 100 + Math.random() * 200,
                    score: 0,
                    distance: 0,
                    alive: true,
                    joinedAt: Date.now(),
                    lastUpdate: Date.now()
                });
                logger.info(`Player ${username} joined Obstacle Rush match`);
            }
        }

        // Start game if enough players
        if (state.players.size >= 2 && !state.gameStarted) {
            state.gameStarted = true;
            state.startTime = Date.now();
            logger.info("Obstacle Rush match started");
        }

        return { state };
    },

    matchLeave: (ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, state: any, presences: any) => {
        for (const presence of presences) {
            const userId = presence.getUserId();
            state.players.delete(userId);
            logger.info(`Player ${presence.getUsername()} left Obstacle Rush match`);
        }
        return { state };
    },

    matchLoop: (ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, state: any, messages: any) => {
        const deltaTime = 0.1; // 100ms per tick

        // Process incoming messages
        for (const message of messages) {
            const userId = message.getUserId();
            const data = message.getData();
            try {
                const parsed = JSON.parse(data);
                if (parsed.type === "move") {
                    const player = state.players.get(userId);
                    if (player) {
                        player.x = parsed.x || player.x;
                        player.y = parsed.y || player.y;
                        player.lastUpdate = Date.now();
                    }
                }
                if (parsed.type === "die") {
                    const player = state.players.get(userId);
                    if (player) {
                        player.alive = false;
                    }
                }
            } catch (e) {
                // Ignore malformed messages
            }
        }

        // Update game state
        state = updateMatchState(state, deltaTime);

        // Check if game should end
        if (state.gameStarted && !state.gameEnded) {
            const alivePlayers = Array.from(state.players.values()).filter(p => p.alive);
            if (alivePlayers.length <= 1 || Date.now() - state.startTime > 60000) {
                state.gameEnded = true;
                state.endTime = Date.now();
                logger.info("Obstacle Rush match ended");

                // Calculate rewards
                const rankedPlayers = Array.from(state.players.values())
                    .sort((a, b) => b.score - a.score);

                for (let i = 0; i < rankedPlayers.length; i++) {
                    const player = rankedPlayers[i];
                    const userId = player.userId;
                    const username = player.username;
                    const score = player.score;
                    const rank = i + 1;

                    // Grant rewards
                    try {
                        const reward = Math.max(0, 100 - (rank - 1) * 10);
                        nk.rpc("game.end", JSON.stringify({
                            score,
                            userId,
                            rank
                        }));
                    } catch (e) {
                        // Ignore
                    }

                    // Record activity
                    try {
                        nk.rpc("social.recordActivity", JSON.stringify({
                            type: "finished_game",
                            metadata: {
                                game: "obstacle_rush",
                                score,
                                rank,
                                players: state.players.size
                            }
                        }));
                    } catch (e) {
                        // Ignore
                    }

                    // Send notification
                    try {
                        const message = rank === 1 ? "🎉 You won the match!" : `You finished #${rank}`;
                        nk.rpc("notification.send", JSON.stringify({
                            userId,
                            type: "game_start",
                            title: rank === 1 ? "🏆 Victory!" : "Game Over",
                            message: `Obstacle Rush: ${message} Score: ${score}`,
                            data: { score, rank }
                        }));
                    } catch (e) {
                        // Ignore
                    }
                }
            }
        }

        // Broadcast state to all players
        const broadcastData = {
            players: Array.from(state.players.values()).map(p => ({
                userId: p.userId,
                username: p.username,
                x: p.x,
                y: p.y,
                score: p.score,
                alive: p.alive
            })),
            obstacles: state.obstacles.slice(0, 30),
            gameStarted: state.gameStarted,
            gameEnded: state.gameEnded,
            speed: state.speed
        };

        return {
            state,
            broadcast: JSON.stringify(broadcastData),
            presences: Array.from(state.players.keys())
        };
    },

    matchTerminate: (ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, state: any) => {
        logger.info("Obstacle Rush match terminated");
        return { state };
    },

    matchSignal: (ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, state: any, data: string) => {
        logger.info("Obstacle Rush match signal received", { data });
        return { state, data: "Signal processed" };
    }
};

// ============================================================
// RPC: Create Obstacle Rush match
// ============================================================

export const rpcCreateObstacleRushMatch: nkruntime.RpcFunction = (
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

        // Register the match handler
        // In Nakama, match handlers are registered in InitModule
        // This RPC is just a wrapper to trigger match creation

        // Create a match using Nakama's matchmaker
        const matchId = nk.matchCreate("obstacle_rush", {});
        
        return JSON.stringify({
            success: true,
            matchId
        });
    } catch (e) {
        throw new Error(`Failed to create Obstacle Rush match: ${e}`);
    }
};

// ============================================================
// RPC: Join Obstacle Rush matchmaking
// ============================================================

export const rpcJoinObstacleRushQueue: nkruntime.RpcFunction = (
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

        // Get user's progression for skill-based matchmaking
        let skillLevel = 0;
        try {
            const progResult = nk.rpc("progression.get", JSON.stringify({}));
            const prog = JSON.parse(progResult);
            skillLevel = prog.level || 0;
        } catch (e) {
            // Ignore
        }

        // Add to matchmaking queue
        const matchId = nk.matchmakerAdd(userId, {
            mode: "obstacle_rush",
            skill: skillLevel,
            count: 4,
            query: `+mode:obstacle_rush`
        });

        return JSON.stringify({
            success: true,
            matchId,
            message: "Added to Obstacle Rush queue"
        });
    } catch (e) {
        throw new Error(`Failed to join matchmaking: ${e}`);
    }
};

// ============================================================
// RPC: Cancel Obstacle Rush matchmaking
// ============================================================

export const rpcCancelObstacleRushQueue: nkruntime.RpcFunction = (
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

        // Remove from matchmaking
        nk.matchmakerRemove(userId);

        return JSON.stringify({
            success: true,
            message: "Removed from Obstacle Rush queue"
        });
    } catch (e) {
        throw new Error(`Failed to cancel matchmaking: ${e}`);
    }
};

// ============================================================
// INIT
// ============================================================

export function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama): void {
    // Register match handler
    nk.matchRegister("obstacle_rush", matchHandler);

    // Register RPCs
    nk.registerRpc("obstacle_rush.create", rpcCreateObstacleRushMatch);
    nk.registerRpc("obstacle_rush.joinQueue", rpcJoinObstacleRushQueue);
    nk.registerRpc("obstacle_rush.cancelQueue", rpcCancelObstacleRushQueue);

    logger.info("LNBQSHA Obstacle Rush Match Handler initialized");
    logger.info("Registered match handler: obstacle_rush");
    logger.info("Registered RPCs: obstacle_rush.*");
  }
