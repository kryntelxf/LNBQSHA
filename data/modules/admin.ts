// LNBQSHA Product Layer — Admin & Moderation Tools
// Player management, content moderation, system controls

import { nkruntime } from "nakama-runtime";

// ============================================================
// TYPES
// ============================================================

interface AdminAction {
    id: string;
    adminId: string;
    action: "ban" | "mute" | "warn" | "delete" | "grant" | "revoke";
    targetUserId: string;
    reason: string;
    duration?: number; // seconds
    data?: any;
    createdAt: number;
}

interface PlayerReport {
    id: string;
    reporterId: string;
    reportedUserId: string;
    reason: string;
    description: string;
    status: "pending" | "reviewed" | "dismissed" | "actioned";
    createdAt: number;
    reviewedAt?: number;
    reviewedBy?: string;
    actionTaken?: string;
}

// ============================================================
// CONSTANTS
// ============================================================

const COLLECTION_ADMIN_ACTIONS = "lnbqsha_admin_actions";
const COLLECTION_REPORTS = "lnbqsha_reports";
const COLLECTION_BANNED_USERS = "lnbqsha_banned_users";

// Admin user IDs (in production, this would be managed by roles)
const ADMIN_USERS: string[] = [
    // Add admin user IDs here
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

function isAdmin(userId: string): boolean {
    return ADMIN_USERS.includes(userId);
}

function getAdminActions(nk: nkruntime.Nakama, userId: string): AdminAction[] {
    const result = nk.storageRead([
        { collection: COLLECTION_ADMIN_ACTIONS, key: userId, userId }
    ]);

    if (result && result.length > 0 && result[0].value) {
        return result[0].value as AdminAction[];
    }
    return [];
}

function saveAdminActions(nk: nkruntime.Nakama, userId: string, actions: AdminAction[]): void {
    nk.storageWrite([{
        collection: COLLECTION_ADMIN_ACTIONS,
        key: userId,
        userId,
        value: actions,
        permissionRead: 1,
        permissionWrite: 1
    }]);
}

function getReports(nk: nkruntime.Nakama): PlayerReport[] {
    const result = nk.storageRead([
        { collection: COLLECTION_REPORTS, key: "all", userId: "system" }
    ]);

    if (result && result.length > 0 && result[0].value) {
        return result[0].value as PlayerReport[];
    }
    return [];
}

function saveReports(nk: nkruntime.Nakama, reports: PlayerReport[]): void {
    nk.storageWrite([{
        collection: COLLECTION_REPORTS,
        key: "all",
        userId: "system",
        value: reports,
        permissionRead: 1,
        permissionWrite: 1
    }]);
}

function isUserBanned(nk: nkruntime.Nakama, userId: string): boolean {
    const result = nk.storageRead([
        { collection: COLLECTION_BANNED_USERS, key: userId, userId }
    ]);

    if (result && result.length > 0 && result[0].value) {
        const ban = result[0].value;
        if (ban.expiresAt && Date.now() > ban.expiresAt) {
            // Ban expired
            nk.storageDelete([
                { collection: COLLECTION_BANNED_USERS, key: userId, userId }
            ]);
            return false;
        }
        return true;
    }
    return false;
}

function banUser(nk: nkruntime.Nakama, userId: string, reason: string, duration?: number): void {
    nk.storageWrite([{
        collection: COLLECTION_BANNED_USERS,
        key: userId,
        userId,
        value: {
            userId,
            reason,
            bannedAt: Date.now(),
            expiresAt: duration ? Date.now() + duration * 1000 : null
        },
        permissionRead: 1,
        permissionWrite: 1
    }]);
}

function unbanUser(nk: nkruntime.Nakama, userId: string): void {
    nk.storageDelete([
        { collection: COLLECTION_BANNED_USERS, key: userId, userId }
    ]);
}

// ============================================================
// RPC: Admin grant currency
// ============================================================

export const rpcAdminGrantCurrency: nkruntime.RpcFunction = (
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

        if (!isAdmin(userId)) {
            throw new Error("Admin privileges required");
        }

        const data = JSON.parse(payload);
        const targetUserId: string = data.targetUserId;
        const currency: string = data.currency || "soft";
        const amount: number = data.amount || 0;
        const reason: string = data.reason || "Admin grant";

        if (!targetUserId) {
            throw new Error("targetUserId required");
        }
        if (amount <= 0) {
            throw new Error("Amount must be positive");
        }

        // Grant currency via economy
        // This would call economy.grantCurrency
        // For now, we'll just log it

        // Record admin action
        const action: AdminAction = {
            id: generateUUID(),
            adminId: userId,
            action: "grant",
            targetUserId,
            reason,
            data: { currency, amount },
            createdAt: Date.now()
        };

        const actions = getAdminActions(nk, userId);
        actions.push(action);
        saveAdminActions(nk, userId, actions);

        return JSON.stringify({
            success: true,
            message: `Granted ${amount} ${currency} to ${targetUserId}`
        });
    } catch (e) {
        throw new Error(`Failed to grant currency: ${e}`);
    }
};

// ============================================================
// RPC: Admin ban user
// ============================================================

export const rpcAdminBanUser: nkruntime.RpcFunction = (
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

        if (!isAdmin(userId)) {
            throw new Error("Admin privileges required");
        }

        const data = JSON.parse(payload);
        const targetUserId: string = data.targetUserId;
        const reason: string = data.reason || "No reason provided";
        const duration: number = data.duration || 0; // 0 = permanent

        if (!targetUserId) {
            throw new Error("targetUserId required");
        }

        banUser(nk, targetUserId, reason, duration);

        // Record admin action
        const action: AdminAction = {
            id: generateUUID(),
            adminId: userId,
            action: "ban",
            targetUserId,
            reason,
            duration,
            createdAt: Date.now()
        };

        const actions = getAdminActions(nk, userId);
        actions.push(action);
        saveAdminActions(nk, userId, actions);

        return JSON.stringify({
            success: true,
            message: `Banned ${targetUserId}${duration ? ` for ${duration} seconds` : " permanently"}`
        });
    } catch (e) {
        throw new Error(`Failed to ban user: ${e}`);
    }
};

// ============================================================
// RPC: Admin unban user
// ============================================================

export const rpcAdminUnbanUser: nkruntime.RpcFunction = (
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

        if (!isAdmin(userId)) {
            throw new Error("Admin privileges required");
        }

        const data = JSON.parse(payload);
        const targetUserId: string = data.targetUserId;

        if (!targetUserId) {
            throw new Error("targetUserId required");
        }

        unbanUser(nk, targetUserId);

        // Record admin action
        const action: AdminAction = {
            id: generateUUID(),
            adminId: userId,
            action: "revoke",
            targetUserId,
            reason: "Unban",
            createdAt: Date.now()
        };

        const actions = getAdminActions(nk, userId);
        actions.push(action);
        saveAdminActions(nk, userId, actions);

        return JSON.stringify({
            success: true,
            message: `Unbanned ${targetUserId}`
        });
    } catch (e) {
        throw new Error(`Failed to unban user: ${e}`);
    }
};

// ============================================================
// RPC: Admin get user info
// ============================================================

export const rpcAdminGetUserInfo: nkruntime.RpcFunction = (
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

        if (!isAdmin(userId)) {
            throw new Error("Admin privileges required");
        }

        const data = JSON.parse(payload);
        const targetUserId: string = data.targetUserId;

        if (!targetUserId) {
            throw new Error("targetUserId required");
        }

        // Get user data
        const user = nk.usersGetId([targetUserId])[0];
        const isBanned = isUserBanned(nk, targetUserId);

        // Get player state
        let playerState = null;
        try {
            const stateResult = nk.rpc("player.getStateByUserId", JSON.stringify({ userId: targetUserId }));
            playerState = JSON.parse(stateResult);
        } catch (e) {
            // Ignore
        }

        // Get progression
        let progression = null;
        try {
            const progResult = nk.rpc("progression.get", JSON.stringify({}));
            progression = JSON.parse(progResult);
        } catch (e) {
            // Ignore
        }

        // Get wallet
        let wallet = null;
        try {
            const walletResult = nk.rpc("economy.getWallet", JSON.stringify({}));
            wallet = JSON.parse(walletResult);
        } catch (e) {
            // Ignore
        }

        return JSON.stringify({
            user,
            isBanned,
            playerState,
            progression,
            wallet
        });
    } catch (e) {
        throw new Error(`Failed to get user info: ${e}`);
    }
};

// ============================================================
// RPC: Admin get reports
// ============================================================

export const rpcAdminGetReports: nkruntime.RpcFunction = (
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

        if (!isAdmin(userId)) {
            throw new Error("Admin privileges required");
        }

        const data = JSON.parse(payload || "{}");
        const status = data.status || "pending";
        const limit = data.limit || 50;
        const offset = data.offset || 0;

        const reports = getReports(nk);
        const filtered = reports.filter(r => r.status === status);
        const paginated = filtered.slice(offset, offset + limit);

        return JSON.stringify({
            reports: paginated,
            total: filtered.length,
            offset,
            limit
        });
    } catch (e) {
        throw new Error(`Failed to get reports: ${e}`);
    }
};

// ============================================================
// RPC: Admin handle report
// ============================================================

export const rpcAdminHandleReport: nkruntime.RpcFunction = (
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

        if (!isAdmin(userId)) {
            throw new Error("Admin privileges required");
        }

        const data = JSON.parse(payload);
        const reportId: string = data.reportId;
        const action: string = data.action; // "dismiss", "ban", "warn"
        const actionReason: string = data.reason || "";

        if (!reportId) {
            throw new Error("reportId required");
        }

        const reports = getReports(nk);
        const report = reports.find(r => r.id === reportId);
        if (!report) {
            throw new Error("Report not found");
        }

        report.status = action === "dismiss" ? "dismissed" : "actioned";
        report.reviewedAt = Date.now();
        report.reviewedBy = userId;
        report.actionTaken = action;

        // If action is ban, ban the reported user
        if (action === "ban") {
            banUser(nk, report.reportedUserId, actionReason || "Banned by admin");
        }

        saveReports(nk, reports);

        return JSON.stringify({
            success: true,
            report
        });
    } catch (e) {
        throw new Error(`Failed to handle report: ${e}`);
    }
};

// ============================================================
// INIT
// ============================================================

export function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama): void {
    nk.registerRpc("admin.grantCurrency", rpcAdminGrantCurrency);
    nk.registerRpc("admin.banUser", rpcAdminBanUser);
    nk.registerRpc("admin.unbanUser", rpcAdminUnbanUser);
    nk.registerRpc("admin.getUserInfo", rpcAdminGetUserInfo);
    nk.registerRpc("admin.getReports", rpcAdminGetReports);
    nk.registerRpc("admin.handleReport", rpcAdminHandleReport);

    logger.info("LNBQSHA Admin & Moderation Tools initialized");
    logger.info("Registered RPCs: admin.*");
        }
