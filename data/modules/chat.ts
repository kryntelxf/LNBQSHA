// LNBQSHA Product Layer — In-Game Chat System
// Channel-based chat, message history, moderation

import { nkruntime } from "nakama-runtime";

// ============================================================
// TYPES
// ============================================================

interface ChatMessage {
    id: string;
    channelId: string;
    userId: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    message: string;
    timestamp: number;
    edited: boolean;
    deleted: boolean;
    metadata?: any;
}

interface ChatChannel {
    id: string;
    type: "global" | "party" | "clan" | "match" | "direct";
    name: string;
    members: string[];
    createdAt: number;
    lastMessageAt: number;
}

interface ChatBan {
    userId: string;
    channelId: string;
    reason: string;
    bannedAt: number;
    expiresAt: number;
}

// ============================================================
// CONSTANTS
// ============================================================

const COLLECTION_CHAT_MESSAGES = "lnbqsha_chat_messages";
const COLLECTION_CHAT_CHANNELS = "lnbqsha_chat_channels";
const COLLECTION_CHAT_BANS = "lnbqsha_chat_bans";
const MAX_MESSAGES_PER_CHANNEL = 100;
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

function getChannelMessages(nk: nkruntime.Nakama, channelId: string): ChatMessage[] {
    const result = nk.storageRead([
        { collection: COLLECTION_CHAT_MESSAGES, key: channelId, userId: "system" }
    ]);

    if (result && result.length > 0 && result[0].value) {
        return result[0].value as ChatMessage[];
    }
    return [];
}

function saveChannelMessages(nk: nkruntime.Nakama, channelId: string, messages: ChatMessage[]): void {
    // Sort by timestamp descending (newest first)
    messages.sort((a, b) => b.timestamp - a.timestamp);
    
    // Limit to MAX_MESSAGES_PER_CHANNEL
    if (messages.length > MAX_MESSAGES_PER_CHANNEL) {
        messages = messages.slice(0, MAX_MESSAGES_PER_CHANNEL);
    }

    nk.storageWrite([{
        collection: COLLECTION_CHAT_MESSAGES,
        key: channelId,
        userId: "system",
        value: messages,
        permissionRead: 2,
        permissionWrite: 1
    }]);
}

function getChannel(nk: nkruntime.Nakama, channelId: string): ChatChannel | null {
    const result = nk.storageRead([
        { collection: COLLECTION_CHAT_CHANNELS, key: channelId, userId: "system" }
    ]);

    if (result && result.length > 0 && result[0].value) {
        return result[0].value as ChatChannel;
    }
    return null;
}

function saveChannel(nk: nkruntime.Nakama, channel: ChatChannel): void {
    nk.storageWrite([{
        collection: COLLECTION_CHAT_CHANNELS,
        key: channel.id,
        userId: "system",
        value: channel,
        permissionRead: 2,
        permissionWrite: 1
    }]);
}

function isUserBannedFromChat(nk: nkruntime.Nakama, userId: string, channelId: string): boolean {
    const result = nk.storageRead([
        { collection: COLLECTION_CHAT_BANS, key: `${userId}:${channelId}`, userId: "system" }
    ]);

    if (result && result.length > 0 && result[0].value) {
        const ban = result[0].value as ChatBan;
        if (ban.expiresAt > Date.now()) {
            return true;
        }
        // Ban expired
        nk.storageDelete([
            { collection: COLLECTION_CHAT_BANS, key: `${userId}:${channelId}`, userId: "system" }
        ]);
    }
    return false;
}

function banUserFromChat(nk: nkruntime.Nakama, userId: string, channelId: string, reason: string, duration: number): void {
    const ban: ChatBan = {
        userId,
        channelId,
        reason,
        bannedAt: Date.now(),
        expiresAt: Date.now() + duration * 1000
    };

    nk.storageWrite([{
        collection: COLLECTION_CHAT_BANS,
        key: `${userId}:${channelId}`,
        userId: "system",
        value: ban,
        permissionRead: 1,
        permissionWrite: 1
    }]);
}

function createChannel(
    nk: nkruntime.Nakama,
    type: ChatChannel["type"],
    name: string,
    members: string[]
): ChatChannel {
    const channel: ChatChannel = {
        id: generateUUID(),
        type,
        name,
        members,
        createdAt: Date.now(),
        lastMessageAt: Date.now()
    };

    saveChannel(nk, channel);
    return channel;
}

function sendChatMessage(
    nk: nkruntime.Nakama,
    channelId: string,
    userId: string,
    username: string,
    displayName: string,
    avatarUrl: string,
    message: string,
    metadata?: any
): ChatMessage {
    const chatMessage: ChatMessage = {
        id: generateUUID(),
        channelId,
        userId,
        username,
        displayName,
        avatarUrl,
        message: message.substring(0, MAX_MESSAGE_LENGTH),
        timestamp: Date.now(),
        edited: false,
        deleted: false,
        metadata: metadata || {}
    };

    const messages = getChannelMessages(nk, channelId);
    messages.unshift(chatMessage);
    saveChannelMessages(nk, channelId, messages);

    // Update channel last message time
    const channel = getChannel(nk, channelId);
    if (channel) {
        channel.lastMessageAt = Date.now();
        saveChannel(nk, channel);
    }

    return chatMessage;
}

// ============================================================
// RPC: Get chat messages
// ============================================================

export const rpcGetChatMessages: nkruntime.RpcFunction = (
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
        const channelId: string = data.channelId;
        const limit: number = data.limit || 50;
        const offset: number = data.offset || 0;

        if (!channelId) {
            throw new Error("channelId required");
        }

        // Check if channel exists
        const channel = getChannel(nk, channelId);
        if (!channel) {
            throw new Error("Channel not found");
        }

        // Check if user is member of channel
        if (!channel.members.includes(userId) && channel.type !== "global") {
            throw new Error("Not a member of this channel");
        }

        // Check if user is banned
        if (isUserBannedFromChat(nk, userId, channelId)) {
            throw new Error("You are banned from this channel");
        }

        const messages = getChannelMessages(nk, channelId);
        const paginated = messages.slice(offset, offset + limit);

        return JSON.stringify({
            channel,
            messages: paginated,
            total: messages.length,
            offset,
            limit
        });
    } catch (e) {
        throw new Error(`Failed to get chat messages: ${e}`);
    }
};

// ============================================================
// RPC: Send chat message
// ============================================================

export const rpcSendChatMessage: nkruntime.RpcFunction = (
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
        const channelId: string = data.channelId;
        const message: string = data.message || "";
        const metadata: any = data.metadata || {};

        if (!channelId) {
            throw new Error("channelId required");
        }
        if (!message || message.trim().length === 0) {
            throw new Error("Message cannot be empty");
        }
        if (message.length > MAX_MESSAGE_LENGTH) {
            throw new Error(`Message exceeds maximum length of ${MAX_MESSAGE_LENGTH}`);
        }

        // Check if channel exists
        const channel = getChannel(nk, channelId);
        if (!channel) {
            throw new Error("Channel not found");
        }

        // Check if user is member of channel
        if (!channel.members.includes(userId) && channel.type !== "global") {
            throw new Error("Not a member of this channel");
        }

        // Check if user is banned
        if (isUserBannedFromChat(nk, userId, channelId)) {
            throw new Error("You are banned from this channel");
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

        // Check for profanity (simplified)
        const forbiddenWords = ["goblok", "bangsat", "anjing", "kontol", "memek"];
        let cleanMessage = message;
        for (const word of forbiddenWords) {
            const regex = new RegExp(word, "gi");
            cleanMessage = cleanMessage.replace(regex, "***");
        }

        const chatMessage = sendChatMessage(
            nk,
            channelId,
            userId,
            username,
            displayName,
            avatarUrl,
            cleanMessage,
            metadata
        );

        // Broadcast to channel members (if real-time)
        // This would be done via Nakama's real-time API

        return JSON.stringify({
            success: true,
            message: chatMessage
        });
    } catch (e) {
        throw new Error(`Failed to send chat message: ${e}`);
    }
};

// ============================================================
// RPC: Create chat channel
// ============================================================

export const rpcCreateChatChannel: nkruntime.RpcFunction = (
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
        const type: ChatChannel["type"] = data.type || "global";
        const name: string = data.name || "Chat Channel";
        const members: string[] = data.members || [];

        // Add creator to members
        if (!members.includes(userId)) {
            members.push(userId);
        }

        // For global channel, use a fixed ID
        let channelId: string;
        if (type === "global") {
            channelId = "global";
            const existing = getChannel(nk, channelId);
            if (existing) {
                // Update global channel members
                existing.members = members;
                saveChannel(nk, existing);
                return JSON.stringify(existing);
            }
        }

        const channel = createChannel(nk, type, name, members);

        return JSON.stringify(channel);
    } catch (e) {
        throw new Error(`Failed to create chat channel: ${e}`);
    }
};

// ============================================================
// RPC: Join chat channel
// ============================================================

export const rpcJoinChatChannel: nkruntime.RpcFunction = (
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
        const channelId: string = data.channelId;

        if (!channelId) {
            throw new Error("channelId required");
        }

        const channel = getChannel(nk, channelId);
        if (!channel) {
            throw new Error("Channel not found");
        }

        if (!channel.members.includes(userId)) {
            channel.members.push(userId);
            saveChannel(nk, channel);
        }

        return JSON.stringify(channel);
    } catch (e) {
        throw new Error(`Failed to join chat channel: ${e}`);
    }
};

// ============================================================
// RPC: Leave chat channel
// ============================================================

export const rpcLeaveChatChannel: nkruntime.RpcFunction = (
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
        const channelId: string = data.channelId;

        if (!channelId) {
            throw new Error("channelId required");
        }

        // Can't leave global channel
        if (channelId === "global") {
            throw new Error("Cannot leave global channel");
        }

        const channel = getChannel(nk, channelId);
        if (!channel) {
            throw new Error("Channel not found");
        }

        channel.members = channel.members.filter(id => id !== userId);
        saveChannel(nk, channel);

        return JSON.stringify({ success: true });
    } catch (e) {
        throw new Error(`Failed to leave chat channel: ${e}`);
    }
};

// ============================================================
// INIT
// ============================================================

export function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama): void {
    nk.registerRpc("chat.getMessages", rpcGetChatMessages);
    nk.registerRpc("chat.send", rpcSendChatMessage);
    nk.registerRpc("chat.createChannel", rpcCreateChatChannel);
    nk.registerRpc("chat.joinChannel", rpcJoinChatChannel);
    nk.registerRpc("chat.leaveChannel", rpcLeaveChatChannel);

    // Create global channel if it doesn't exist
    const globalChannel = getChannel(nk, "global");
    if (!globalChannel) {
        createChannel(nk, "global", "Global Chat", []);
    }

    logger.info("LNBQSHA Chat System initialized");
    logger.info("Registered RPCs: chat.*");
  }
