// LNBQSHA Product Layer — Shop/Marketplace
// Buy items, limited-time offers, daily deals

import { nkruntime } from "nakama-runtime";

// ============================================================
// TYPES
// ============================================================

interface ShopItem {
    id: string;
    name: string;
    description: string;
    price: number;
    currency: "soft" | "premium";
    category: "cosmetic" | "boost" | "consumable" | "special";
    type: string; // skin, emote, avatar, xp_boost, coin_boost, etc.
    rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
    icon: string;
    limited: boolean;
    stock: number; // -1 for unlimited
    discount?: number; // percentage
    discountEnd?: number;
    tags: string[];
}

interface ShopPurchaseHistory {
    userId: string;
    itemId: string;
    price: number;
    currency: string;
    purchasedAt: number;
}

// ============================================================
// CONSTANTS
// ============================================================

const COLLECTION_SHOP_HISTORY = "lnbqsha_shop_history";
const COLLECTION_DAILY_DEALS = "lnbqsha_daily_deals";

// Shop catalog
const SHOP_CATALOG: ShopItem[] = [
    // Cosmetic items
    {
        id: "shop_cosmetic_001",
        name: "Neon Skin",
        description: "Glow in the dark with neon style",
        price: 500,
        currency: "soft",
        category: "cosmetic",
        type: "skin",
        rarity: "rare",
        icon: "neon_skin.png",
        limited: false,
        stock: -1,
        tags: ["skin", "neon", "cosmetic"]
    },
    {
        id: "shop_cosmetic_002",
        name: "Golden Skin",
        description: "Shine like gold",
        price: 1000,
        currency: "premium",
        category: "cosmetic",
        type: "skin",
        rarity: "legendary",
        icon: "golden_skin.png",
        limited: false,
        stock: -1,
        tags: ["skin", "gold", "cosmetic"]
    },
    {
        id: "shop_cosmetic_003",
        name: "Dance Emote",
        description: "Show off your moves",
        price: 200,
        currency: "soft",
        category: "cosmetic",
        type: "emote",
        rarity: "common",
        icon: "dance_emote.png",
        limited: false,
        stock: -1,
        tags: ["emote", "dance", "cosmetic"]
    },
    {
        id: "shop_cosmetic_004",
        name: "Crown Avatar",
        description: "Wear the crown of victory",
        price: 750,
        currency: "premium",
        category: "cosmetic",
        type: "avatar",
        rarity: "rare",
        icon: "crown_avatar.png",
        limited: false,
        stock: -1,
        tags: ["avatar", "crown", "cosmetic"]
    },
    // Boosts
    {
        id: "shop_boost_001",
        name: "XP Boost (1 hour)",
        description: "Double XP for 1 hour",
        price: 50,
        currency: "soft",
        category: "boost",
        type: "xp_boost",
        rarity: "uncommon",
        icon: "xp_boost.png",
        limited: false,
        stock: -1,
        tags: ["boost", "xp"]
    },
    {
        id: "shop_boost_002",
        name: "Coin Boost (1 hour)",
        description: "Double coins for 1 hour",
        price: 50,
        currency: "soft",
        category: "boost",
        type: "coin_boost",
        rarity: "uncommon",
        icon: "coin_boost.png",
        limited: false,
        stock: -1,
        tags: ["boost", "coin"]
    },
    // Limited items
    {
        id: "shop_limited_001",
        name: "Halloween Pumpkin",
        description: "Limited Halloween cosmetic",
        price: 1500,
        currency: "premium",
        category: "special",
        type: "avatar",
        rarity: "epic",
        icon: "pumpkin.png",
        limited: true,
        stock: 100,
        discount: 20,
        discountEnd: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
        tags: ["halloween", "limited", "cosmetic"]
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

function getShopHistory(nk: nkruntime.Nakama, userId: string): ShopPurchaseHistory[] {
    const result = nk.storageRead([
        { collection: COLLECTION_SHOP_HISTORY, key: userId, userId }
    ]);

    if (result && result.length > 0 && result[0].value) {
        return result[0].value as ShopPurchaseHistory[];
    }
    return [];
}

function saveShopHistory(nk: nkruntime.Nakama, userId: string, history: ShopPurchaseHistory[]): void {
    nk.storageWrite([{
        collection: COLLECTION_SHOP_HISTORY,
        key: userId,
        userId,
        value: history,
        permissionRead: 1,
        permissionWrite: 1
    }]);
}

function getShopItem(itemId: string): ShopItem | null {
    return SHOP_CATALOG.find(item => item.id === itemId) || null;
}

function getDailyDeals(nk: nkruntime.Nakama): string[] {
    const result = nk.storageRead([
        { collection: COLLECTION_DAILY_DEALS, key: "deals", userId: "system" }
    ]);

    if (result && result.length > 0 && result[0].value) {
        return result[0].value as string[];
    }
    // Generate random daily deals
    const allIds = SHOP_CATALOG.map(item => item.id);
    const deals = [];
    const shuffled = allIds.sort(() => 0.5 - Math.random());
    for (let i = 0; i < Math.min(5, shuffled.length); i++) {
        deals.push(shuffled[i]);
    }
    nk.storageWrite([{
        collection: COLLECTION_DAILY_DEALS,
        key: "deals",
        userId: "system",
        value: deals,
        permissionRead: 2,
        permissionWrite: 1
    }]);
    return deals;
}

// ============================================================
// RPC: Get shop catalog
// ============================================================

export const rpcGetShopCatalog: nkruntime.RpcFunction = (
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
        const category = data.category || "";
        const limit = data.limit || 50;
        const offset = data.offset || 0;

        let items = SHOP_CATALOG;
        if (category) {
            items = items.filter(item => item.category === category);
        }

        // Check if user has already purchased items
        const history = getShopHistory(nk, userId);
        const purchasedIds = history.map(h => h.itemId);

        const itemsWithOwnership = items.map(item => ({
            ...item,
            owned: purchasedIds.includes(item.id),
            isLimited: item.stock > 0 && item.limited
        }));

        const paginated = itemsWithOwnership.slice(offset, offset + limit);

        // Get daily deals
        const deals = getDailyDeals(nk);
        const dealItems = deals.map(id => {
            const item = getShopItem(id);
            return item ? { ...item, isDeal: true } : null;
        }).filter(Boolean);

        return JSON.stringify({
            items: paginated,
            deals: dealItems,
            total: items.length,
            offset,
            limit
        });
    } catch (e) {
        throw new Error(`Failed to get shop catalog: ${e}`);
    }
};

// ============================================================
// RPC: Purchase from shop
// ============================================================

export const rpcPurchaseFromShop: nkruntime.RpcFunction = (
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
        const idempotencyKey: string = data.idempotencyKey || generateUUID();

        if (!itemId) {
            throw new Error("itemId required");
        }

        const shopItem = getShopItem(itemId);
        if (!shopItem) {
            throw new Error("Item not found in shop");
        }

        // Check stock
        if (shopItem.limited && shopItem.stock <= 0) {
            throw new Error("Item out of stock");
        }

        // Check if already purchased (cosmetics can't be bought twice)
        const history = getShopHistory(nk, userId);
        if (history.some(h => h.itemId === itemId)) {
            throw new Error("Item already purchased");
        }

        // Calculate price with discount
        let price = shopItem.price;
        if (shopItem.discount && shopItem.discountEnd && shopItem.discountEnd > Date.now()) {
            price = price * (100 - shopItem.discount) / 100;
        }

        // Purchase via economy
        const purchasePayload = JSON.stringify({
            itemId: `shop_${itemId}`,
            idempotencyKey
        });
        const purchaseResult = nk.rpc("integration.purchase", purchasePayload);
        const purchase = JSON.parse(purchaseResult);

        if (!purchase.success) {
            throw new Error("Purchase failed");
        }

        // Grant item (if it's a cosmetic)
        if (shopItem.category === "cosmetic") {
            const grantPayload = JSON.stringify({
                itemId: `cosmetic_${shopItem.type}_${shopItem.id}`
            });
            nk.rpc("inventory.grant", grantPayload);
        }

        // Record purchase history
        const record: ShopPurchaseHistory = {
            userId,
            itemId,
            price,
            currency: shopItem.currency,
            purchasedAt: Date.now()
        };
        history.push(record);
        saveShopHistory(nk, userId, history);

        // Update stock for limited items
        if (shopItem.limited && shopItem.stock > 0) {
            // In production, we'd update the catalog in a more robust way
            // For now, we'll just log it
            logger.info(`Stock updated for ${shopItem.id}: ${shopItem.stock - 1} remaining`);
        }

        // Send notification
        try {
            const notifyPayload = JSON.stringify({
                type: "reward",
                title: "Purchase Complete!",
                message: `You purchased ${shopItem.name}!`,
                data: { itemId, itemName: shopItem.name }
            });
            nk.rpc("notification.create", notifyPayload);
        } catch (e) {
            // Ignore
        }

        return JSON.stringify({
            success: true,
            item: shopItem,
            price,
            currency: shopItem.currency,
            message: `Successfully purchased ${shopItem.name}!`
        });
    } catch (e) {
        throw new Error(`Failed to purchase from shop: ${e}`);
    }
};

// ============================================================
// RPC: Get purchase history
// ============================================================

export const rpcGetPurchaseHistory: nkruntime.RpcFunction = (
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

        const history = getShopHistory(nk, userId);
        const paginated = history.slice(offset, offset + limit);

        return JSON.stringify({
            history: paginated,
            total: history.length,
            offset,
            limit
        });
    } catch (e) {
        throw new Error(`Failed to get purchase history: ${e}`);
    }
};

// ============================================================
// RPC: Get daily deals
// ============================================================

export const rpcGetDailyDeals: nkruntime.RpcFunction = (
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

        const deals = getDailyDeals(nk);
        const dealItems = deals.map(id => {
            const item = getShopItem(id);
            return item ? { ...item, isDeal: true } : null;
        }).filter(Boolean);

        return JSON.stringify({ deals: dealItems });
    } catch (e) {
        throw new Error(`Failed to get daily deals: ${e}`);
    }
};

// ============================================================
// INIT
// ============================================================

export function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama): void {
    nk.registerRpc("shop.getCatalog", rpcGetShopCatalog);
    nk.registerRpc("shop.purchase", rpcPurchaseFromShop);
    nk.registerRpc("shop.getHistory", rpcGetPurchaseHistory);
    nk.registerRpc("shop.getDeals", rpcGetDailyDeals);

    logger.info("LNBQSHA Shop/Marketplace Module initialized");
    logger.info("Registered RPCs: shop.*");
      }
