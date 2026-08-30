// LNBQSHA Product Layer — Inventory System
// Owned items, equip cosmetics

import { nkruntime } from "nakama-runtime";

// ============================================================
// TYPES
// ============================================================

interface InventoryItem {
    itemId: string;
    name: string;
    type: "skin" | "emote" | "avatar" | "trail" | "effect";
    rarity: "common" | "uncommon" | "rare" | "legendary";
    equipped: boolean;
    unlockedAt: number;
}

interface InventoryData {
    userId: string;
    items: InventoryItem[];
    equipped: {
        skin?: string;
        emote?: string;
        avatar?: string;
        trail?: string;
        effect?: string;
    };
}

// ============================================================
// CONSTANTS
// ============================================================

const COLLECTION_INVENTORY = "lnbqsha_inventory";

// Catalog reference (should match data/catalog.json)
const CATALOG: Record<string, any> = {
    "cosmetic_001": {
        id: "cosmetic_001",
        name: "Neon Skin",
        type: "skin",
        rarity: "rare"
    },
    "cosmetic_002": {
        id: "cosmetic_002",
        name: "Golden Skin",
        type: "skin",
        rarity: "legendary"
    },
    "cosmetic_003": {
        id: "cosmetic_003",
        name: "Dance Emote",
        type: "emote",
        rarity: "common"
    },
    "cosmetic_004": {
        id: "cosmetic_004",
        name: "Crown Avatar",
        type: "avatar",
        rarity: "rare"
    }
};

// ============================================================
// HELPERS
// ============================================================

function getInventory(nk: nkruntime.Nakama, userId: string): InventoryData {
    const result = nk.storageRead([
        { collection: COLLECTION_INVENTORY, key: "data", userId }
    ]);

    if (result && result.length > 0 && result[0].value) {
        return result[0].value as InventoryData;
    }

    // Default inventory
    const defaultData: InventoryData = {
        userId,
        items: [],
        equipped: {}
    };

    nk.storageWrite([{
        collection: COLLECTION_INVENTORY,
        key: "data",
        userId,
        value: defaultData,
        permissionRead: 1,
        permissionWrite: 1
    }]);

    return defaultData;
}

function saveInventory(nk: nkruntime.Nakama, userId: string, data: InventoryData): void {
    nk.storageWrite([{
        collection: COLLECTION_INVENTORY,
        key: "data",
        userId,
        value: data,
        permissionRead: 1,
        permissionWrite: 1
    }]);
}

function isItemOwned(inventory: InventoryData, itemId: string): boolean {
    return inventory.items.some(item => item.itemId === itemId);
}

function getCatalogItem(itemId: string): any {
    return CATALOG[itemId];
}

// ============================================================
// RPC: Get inventory
// ============================================================

export const rpcGetInventory: nkruntime.RpcFunction = (
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

        const inventory = getInventory(nk, userId);
        return JSON.stringify(inventory);
    } catch (e) {
        throw new Error(`Failed to get inventory: ${e}`);
    }
};

// ============================================================
// RPC: Grant item (called after purchase or reward)
// ============================================================

export const rpcGrantItem: nkruntime.RpcFunction = (
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
        const itemId: string = data.itemId;

        if (!itemId) {
            throw new Error("itemId required");
        }

        const catalogItem = getCatalogItem(itemId);
        if (!catalogItem) {
            throw new Error(`Item not found in catalog: ${itemId}`);
        }

        const inventory = getInventory(nk, userId);

        // Check if already owned
        if (isItemOwned(inventory, itemId)) {
            throw new Error("Item already owned");
        }

        // Add item to inventory
        const newItem: InventoryItem = {
            itemId: itemId,
            name: catalogItem.name,
            type: catalogItem.type,
            rarity: catalogItem.rarity,
            equipped: false,
            unlockedAt: Date.now()
        };

        inventory.items.push(newItem);
        saveInventory(nk, userId, inventory);

        return JSON.stringify({
            success: true,
            item: newItem,
            inventory
        });
    } catch (e) {
        throw new Error(`Failed to grant item: ${e}`);
    }
};

// ============================================================
// RPC: Equip item
// ============================================================

export const rpcEquipItem: nkruntime.RpcFunction = (
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
        const itemId: string = data.itemId;

        if (!itemId) {
            throw new Error("itemId required");
        }

        const inventory = getInventory(nk, userId);

        // Find item in inventory
        const item = inventory.items.find(i => i.itemId === itemId);
        if (!item) {
            throw new Error("Item not found in inventory");
        }

        // Unequip all items of same type
        inventory.items.forEach(i => {
            if (i.type === item.type) {
                i.equipped = false;
            }
        });

        // Equip selected item
        item.equipped = true;

        // Update equipped slots
        inventory.equipped = inventory.equipped || {};
        inventory.equipped[item.type] = itemId;

        saveInventory(nk, userId, inventory);

        return JSON.stringify({
            success: true,
            equipped: itemId,
            inventory
        });
    } catch (e) {
        throw new Error(`Failed to equip item: ${e}`);
    }
};

// ============================================================
// RPC: Unequip item
// ============================================================

export const rpcUnequipItem: nkruntime.RpcFunction = (
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
        const itemId: string = data.itemId;

        if (!itemId) {
            throw new Error("itemId required");
        }

        const inventory = getInventory(nk, userId);

        // Find item in inventory
        const item = inventory.items.find(i => i.itemId === itemId);
        if (!item) {
            throw new Error("Item not found in inventory");
        }

        item.equipped = false;

        // Remove from equipped slots
        if (inventory.equipped && inventory.equipped[item.type] === itemId) {
            delete inventory.equipped[item.type];
        }

        saveInventory(nk, userId, inventory);

        return JSON.stringify({
            success: true,
            inventory
        });
    } catch (e) {
        throw new Error(`Failed to unequip item: ${e}`);
    }
};

// ============================================================
// RPC: Check if user owns item
// ============================================================

export const rpcHasItem: nkruntime.RpcFunction = (
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
        const itemId: string = data.itemId;

        if (!itemId) {
            throw new Error("itemId required");
        }

        const inventory = getInventory(nk, userId);
        const owned = isItemOwned(inventory, itemId);

        return JSON.stringify({ owned });
    } catch (e) {
        throw new Error(`Failed to check item ownership: ${e}`);
    }
};

// ============================================================
// INIT
// ============================================================

export function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama): void {
    // Register RPCs
    nk.registerRpc("inventory.get", rpcGetInventory);
    nk.registerRpc("inventory.grant", rpcGrantItem);
    nk.registerRpc("inventory.equip", rpcEquipItem);
    nk.registerRpc("inventory.unequip", rpcUnequipItem);
    nk.registerRpc("inventory.has", rpcHasItem);

    logger.info("LNBQSHA Inventory Module initialized");
    logger.info("Registered RPCs: inventory.*");
}
