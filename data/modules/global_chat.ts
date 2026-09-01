// LNBQSHA Product Layer — Global Chat
// Global chat room for all players

import { nkruntime } from "nakama-runtime";

// ============================================================
// TYPES
// ============================================================

interface GlobalChatMessage {
    id: string;
    userId: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    message: string;
    timestamp: number;
    edited: boolean;
    deleted: boolean;
    isPinned: boolean;
    pinnedBy?: string;
    pinnedAt?: number;
}

// ============================================================
// CONSTANTS
// ============================================================

const COLLECTION_GLOBAL_CHAT = "lnbqsha_global_chat";
const MAX_MESSAGES = 200;
const MAX_MESSAGE_LENGTH = 500;

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

function getGlobalMessages(nk: nkruntime.Nakama): GlobalChatMessage[] {
    const result = nk.storageRead([
        { collection: COLLECTION_GLOBAL_CHAT, key: "global", userId: "system" }
    ]);

    if (result && result.length > 0 && result[0].value) {
        return result[0].value as GlobalChatMessage[];
    }
    return [];
}

function saveGlobalMessages(nk: nkruntime.Nakama, messages: GlobalChatMessage[]): void {
    // Sort by timestamp
    messages.sort((a, b) => b.timestamp - a.timestamp);
    
    // Limit to MAX_MESSAGES
    if (messages.length > MAX_MESSAGES) {
        messages = messages.slice(0, MAX_MESSAGES);
    }

    nk.storageWrite([{
        collection: COLLECTION_GLOBAL_CHAT,
        key: "global",
        userId: "system",
        value: messages,
        permissionRead: 2,
        permissionWrite: 1
    }]);
}

function sendGlobalMessage(
    nk: nkruntime.Nakama,
    userId: string,
    username: string,
    displayName: string,
    avatarUrl: string,
    message: string
): GlobalChatMessage {
    const chatMessage: GlobalChatMessage = {
        id: generateUUID(),
        userId,
        username,
        displayName,
        avatarUrl,
        message: message.substring(0, MAX_MESSAGE_LENGTH),
        timestamp: Date.now(),
        edited: false,
        deleted: false,
        isPinned: false
    };

    const messages = getGlobalMessages(nk);
    messages.unshift(chatMessage);
    saveGlobalMessages(nk, messages);

    // Broadcast to all online players
    // This would use Nakama's real-time API
    // For now, we just store it

    return chatMessage;
}

// ============================================================
// RPC: Get global messages
// ============================================================

export const rpcGetGlobalMessages: nkruntime.RpcFunction = (
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
        const limit = data.limit || 50;
        const offset = data.offset || 0;

        const messages = getGlobalMessages(nk);
        const paginated = messages.slice(offset, offset + limit);

        return JSON.stringify({
            messages: paginated,
            total: messages.length,
            offset,
            limit
        });
    } catch (e) {
        throw new Error(`Failed to get global messages: ${e}`);
    }
};

// ============================================================
// RPC: Send global message
// ============================================================

export const rpcSendGlobalMessage: nkruntime.RpcFunction = (
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
        const message: string = data.message || "";

        if (!message || message.trim().length === 0) {
            throw new Error("Message cannot be empty");
        }
        if (message.length > MAX_MESSAGE_LENGTH) {
            throw new Error(`Message exceeds maximum length of ${MAX_MESSAGE_LENGTH}`);
        }

        // Get user info
        const user = nk.usersGetId([userId])[0];
        const username = user?.username || "unknown";
        const state = nk.storageRead([
            { collection: "lnbqsha_player_state", key: "state", userId }
        ]);
        let displayName = username;
        let avatarUrl = "";
        if (state && state.length > 0 && state[0].value) {
            const playerState = state[0].value;
            displayName = playerState.displayName || username;
            avatarUrl = playerState.avatarUrl || "";
        }

        // Check for profanity
        const forbiddenWords = ["goblok", "bangsat", "anjing", "kontol", "memek"];
        let cleanMessage = message;
        for (const word of forbiddenWords) {
            const regex = new RegExp(word, "gi");
            cleanMessage = cleanMessage.replace(regex, "***");
        }

        const chatMessage = sendGlobalMessage(
            nk,
            userId,
            username,
            displayName,
            avatarUrl,
            cleanMessage
        );

        // Send notification to all online players
        // This would use Nakama's broadcast API
        // For now, we just return the message

        // Record activity
        try {
            const activityPayload = JSON.stringify({
                type: "chat_message",
                metadata: {
                    message: cleanMessage.substring(0, 50)
                }
            });
            nk.rpc("social.recordActivity", activityPayload);
        } catch (e) {
            // Ignore
        }

        return JSON.stringify({
            success: true,
            message: chatMessage
        });
    } catch (e) {
        throw new Error(`Failed to send global message: ${e}`);
    }
};

// ============================================================
// RPC: Pin global message (admin)
// ============================================================

export const rpcPinGlobalMessage: nkruntime.RpcFunction = (
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
        const messageId: string = data.messageId;

        if (!messageId) {
            throw new Error("messageId required");
        }

        const messages = getGlobalMessages(nk);
        const message = messages.find(m => m.id === messageId);

        if (!message) {
            throw new Error("Message not found");
        }

        // Unpin all messages
        messages.forEach(m => m.isPinned = false);

        // Pin this message
        message.isPinned = true;
        message.pinnedBy = userId;
        message.pinnedAt = Date.now();

        saveGlobalMessages(nk, messages);

        return JSON.stringify({
            success: true,
            message
        });
    } catch (e) {
        throw new Error(`Failed to pin message: ${e}`);
    }
};

// ============================================================
// RPC: Unpin global message (admin)
// ============================================================

export const rpcUnpinGlobalMessage: nkruntime.RpcFunction = (
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
        const messageId: string = data.messageId;

        if (!messageId) {
            throw new Error("messageId required");
        }

        const messages = getGlobalMessages(nk);
        const message = messages.find(m => m.id === messageId);

        if (!message) {
            throw new Error("Message not found");
        }

        message.isPinned = false;

        saveGlobalMessages(nk, messages);

        return JSON.stringify({ success: true });
    } catch (e) {
        throw new Error(`Failed to unpin message: ${e}`);
    }
};

// ============================================================
// RPC: Delete global message (admin)
// ============================================================

export const rpcDeleteGlobalMessage: nkruntime.RpcFunction = (
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
        const messageId: string = data.messageId;

        if (!messageId) {
            throw new Error("messageId required");
        }

        const messages = getGlobalMessages(nk);
        const filtered = messages.filter(m => m.id !== messageId);
        saveGlobalMessages(nk, filtered);

        return JSON.stringify({ success: true });
    } catch (e) {
        throw new Error(`Failed to delete message: ${e}`);
    }
};

// ============================================================
// RPC: Get global chat stats
// ============================================================

export const rpcGetGlobalChatStats: nkruntime.RpcFunction = (
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

        const messages = getGlobalMessages(nk);
        const now = Date.now();
        const today = new Date().setHours(0, 0, 0, 0);

        const todayMessages = messages.filter(m => m.timestamp >= today);
        const pinnedMessages = messages.filter(m => m.isPinned);

        return JSON.stringify({
            totalMessages: messages.length,
            todayMessages: todayMessages.length,
            pinnedMessages: pinnedMessages.length,
            topUsers: [] // In production, calculate top users
        });
    } catch (e) {
        throw new Error(`Failed to get global chat stats: ${e}`);
    }
};

// ============================================================
// INIT
// ============================================================

export function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama): void {
    nk.registerRpc("globalChat.getMessages", rpcGetGlobalMessages);
    nk.registerRpc("globalChat.send", rpcSendGlobalMessage);
    nk.registerRpc("globalChat.pin", rpcPinGlobalMessage);
    nk.registerRpc("globalChat.unpin", rpcUnpinGlobalMessage);
    nk.registerRpc("globalChat.delete", rpcDeleteGlobalMessage);
    nk.registerRpc("globalChat.stats", rpcGetGlobalChatStats);

    logger.info("LNBQSHA Global Chat System initialized");
    logger.info("Registered RPCs: globalChat.*");
      }
