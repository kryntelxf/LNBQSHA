// LNBQSHA Product Layer — Content Management System (CMS)
// Manage game content without redeploying

import { nkruntime } from "nakama-runtime";

// ============================================================
// TYPES
// ============================================================

interface ContentItem {
    id: string;
    type: "announcement" | "event" | "promo" | "news" | "patch_note" | 
           "season_info" | "tournament_info" | "shop_featured" | "guide";
    title: string;
    content: string;
    imageUrl?: string;
    linkUrl?: string;
    priority: number;
    tags: string[];
    startDate: number;
    endDate: number;
    active: boolean;
    createdBy: string;
    createdAt: number;
    updatedBy?: string;
    updatedAt?: number;
    metadata: any;
}

interface ContentCategory {
    id: string;
    name: string;
    description: string;
    items: string[]; // content ids
    priority: number;
}

// ============================================================
// CONSTANTS
// ============================================================

const COLLECTION_CMS = "lnbqsha_cms";
const COLLECTION_CMS_CATEGORIES = "lnbqsha_cms_categories";

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

function getContentItems(nk: nkruntime.Nakama): ContentItem[] {
    const result = nk.storageRead([
        { collection: COLLECTION_CMS, key: "all", userId: "system" }
    ]);

    if (result && result.length > 0 && result[0].value) {
        return result[0].value as ContentItem[];
    }
    return [];
}

function saveContentItems(nk: nkruntime.Nakama, items: ContentItem[]): void {
    nk.storageWrite([{
        collection: COLLECTION_CMS,
        key: "all",
        userId: "system",
        value: items,
        permissionRead: 2,
        permissionWrite: 1
    }]);
}

function getCategories(nk: nkruntime.Nakama): ContentCategory[] {
    const result = nk.storageRead([
        { collection: COLLECTION_CMS_CATEGORIES, key: "all", userId: "system" }
    ]);

    if (result && result.length > 0 && result[0].value) {
        return result[0].value as ContentCategory[];
    }
    return [];
}

function saveCategories(nk: nkruntime.Nakama, categories: ContentCategory[]): void {
    nk.storageWrite([{
        collection: COLLECTION_CMS_CATEGORIES,
        key: "all",
        userId: "system",
        value: categories,
        permissionRead: 2,
        permissionWrite: 1
    }]);
}

// ============================================================
// RPC: Get content items
// ============================================================

export const rpcGetContentItems: nkruntime.RpcFunction = (
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
        const type = data.type || "";
        const activeOnly = data.activeOnly !== undefined ? data.activeOnly : true;
        const limit = data.limit || 50;
        const offset = data.offset || 0;
        const tags = data.tags || [];

        const items = getContentItems(nk);
        const now = Date.now();

        let filtered = items;

        // Filter by type
        if (type) {
            filtered = filtered.filter(item => item.type === type);
        }

        // Filter by active
        if (activeOnly) {
            filtered = filtered.filter(item => 
                item.active && 
                item.startDate <= now && 
                item.endDate >= now
            );
        }

        // Filter by tags
        if (tags.length > 0) {
            filtered = filtered.filter(item => 
                tags.some(t => item.tags.includes(t))
            );
        }

        // Sort by priority (higher first) and start date
        filtered.sort((a, b) => {
            if (a.priority !== b.priority) return b.priority - a.priority;
            return b.startDate - a.startDate;
        });

        const paginated = filtered.slice(offset, offset + limit);

        return JSON.stringify({
            items: paginated,
            total: filtered.length,
            offset,
            limit
        });
    } catch (e) {
        throw new Error(`Failed to get content items: ${e}`);
    }
};

// ============================================================
// RPC: Get content item by ID
// ============================================================

export const rpcGetContentItem: nkruntime.RpcFunction = (
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
        const contentId: string = data.contentId;

        if (!contentId) {
            throw new Error("contentId required");
        }

        const items = getContentItems(nk);
        const item = items.find(i => i.id === contentId);

        if (!item) {
            throw new Error("Content not found");
        }

        return JSON.stringify(item);
    } catch (e) {
        throw new Error(`Failed to get content item: ${e}`);
    }
};

// ============================================================
// RPC: Create content item (admin)
// ============================================================

export const rpcCreateContentItem: nkruntime.RpcFunction = (
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

        // Check admin privileges
        // This would be implemented with proper roles

        const data = JSON.parse(payload);
        const type: string = data.type;
        const title: string = data.title || "";
        const content: string = data.content || "";
        const priority: number = data.priority || 0;
        const tags: string[] = data.tags || [];
        const startDate: number = data.startDate || Date.now();
        const endDate: number = data.endDate || Date.now() + 30 * 24 * 60 * 60 * 1000;
        const imageUrl: string = data.imageUrl || "";
        const linkUrl: string = data.linkUrl || "";
        const metadata: any = data.metadata || {};

        if (!type) {
            throw new Error("type required");
        }
        if (!title) {
            throw new Error("title required");
        }

        const item: ContentItem = {
            id: generateUUID(),
            type: type as any,
            title,
            content,
            imageUrl,
            linkUrl,
            priority,
            tags,
            startDate,
            endDate,
            active: true,
            createdBy: userId,
            createdAt: Date.now(),
            metadata
        };

        const items = getContentItems(nk);
        items.push(item);
        saveContentItems(nk, items);

        return JSON.stringify(item);
    } catch (e) {
        throw new Error(`Failed to create content item: ${e}`);
    }
};

// ============================================================
// RPC: Update content item (admin)
// ============================================================

export const rpcUpdateContentItem: nkruntime.RpcFunction = (
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
        const contentId: string = data.contentId;
        const updates: any = data.updates || {};

        if (!contentId) {
            throw new Error("contentId required");
        }

        const items = getContentItems(nk);
        const index = items.findIndex(i => i.id === contentId);

        if (index === -1) {
            throw new Error("Content not found");
        }

        const item = items[index];
        
        // Update fields
        if (updates.title !== undefined) item.title = updates.title;
        if (updates.content !== undefined) item.content = updates.content;
        if (updates.imageUrl !== undefined) item.imageUrl = updates.imageUrl;
        if (updates.linkUrl !== undefined) item.linkUrl = updates.linkUrl;
        if (updates.priority !== undefined) item.priority = updates.priority;
        if (updates.tags !== undefined) item.tags = updates.tags;
        if (updates.startDate !== undefined) item.startDate = updates.startDate;
        if (updates.endDate !== undefined) item.endDate = updates.endDate;
        if (updates.active !== undefined) item.active = updates.active;
        if (updates.metadata !== undefined) item.metadata = updates.metadata;

        item.updatedBy = userId;
        item.updatedAt = Date.now();

        saveContentItems(nk, items);

        return JSON.stringify(item);
    } catch (e) {
        throw new Error(`Failed to update content item: ${e}`);
    }
};

// ============================================================
// RPC: Delete content item (admin)
// ============================================================

export const rpcDeleteContentItem: nkruntime.RpcFunction = (
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
        const contentId: string = data.contentId;

        if (!contentId) {
            throw new Error("contentId required");
        }

        const items = getContentItems(nk);
        const filtered = items.filter(i => i.id !== contentId);
        saveContentItems(nk, filtered);

        return JSON.stringify({ success: true });
    } catch (e) {
        throw new Error(`Failed to delete content item: ${e}`);
    }
};

// ============================================================
// RPC: Get categories
// ============================================================

export const rpcGetCategories: nkruntime.RpcFunction = (
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

        const categories = getCategories(nk);

        // Add item counts
        const items = getContentItems(nk);
        const categoriesWithCounts = categories.map(cat => ({
            ...cat,
            itemCount: cat.items.filter(id => items.some(i => i.id === id)).length
        }));

        return JSON.stringify({
            categories: categoriesWithCounts
        });
    } catch (e) {
        throw new Error(`Failed to get categories: ${e}`);
    }
};

// ============================================================
// RPC: Create category (admin)
// ============================================================

export const rpcCreateCategory: nkruntime.RpcFunction = (
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
        const name: string = data.name || "";
        const description: string = data.description || "";
        const priority: number = data.priority || 0;
        const items: string[] = data.items || [];

        if (!name) {
            throw new Error("name required");
        }

        const category: ContentCategory = {
            id: generateUUID(),
            name,
            description,
            items,
            priority
        };

        const categories = getCategories(nk);
        categories.push(category);
        saveCategories(nk, categories);

        return JSON.stringify(category);
    } catch (e) {
        throw new Error(`Failed to create category: ${e}`);
    }
};

// ============================================================
// RPC: Update category (admin)
// ============================================================

export const rpcUpdateCategory: nkruntime.RpcFunction = (
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
        const categoryId: string = data.categoryId;
        const updates: any = data.updates || {};

        if (!categoryId) {
            throw new Error("categoryId required");
        }

        const categories = getCategories(nk);
        const index = categories.findIndex(c => c.id === categoryId);

        if (index === -1) {
            throw new Error("Category not found");
        }

        const category = categories[index];
        if (updates.name !== undefined) category.name = updates.name;
        if (updates.description !== undefined) category.description = updates.description;
        if (updates.priority !== undefined) category.priority = updates.priority;
        if (updates.items !== undefined) category.items = updates.items;

        saveCategories(nk, categories);

        return JSON.stringify(category);
    } catch (e) {
        throw new Error(`Failed to update category: ${e}`);
    }
};

// ============================================================
// RPC: Delete category (admin)
// ============================================================

export const rpcDeleteCategory: nkruntime.RpcFunction = (
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
        const categoryId: string = data.categoryId;

        if (!categoryId) {
            throw new Error("categoryId required");
        }

        const categories = getCategories(nk);
        const filtered = categories.filter(c => c.id !== categoryId);
        saveCategories(nk, filtered);

        return JSON.stringify({ success: true });
    } catch (e) {
        throw new Error(`Failed to delete category: ${e}`);
    }
};

// ============================================================
// INIT
// ============================================================

export function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama): void {
    nk.registerRpc("cms.getItems", rpcGetContentItems);
    nk.registerRpc("cms.getItem", rpcGetContentItem);
    nk.registerRpc("cms.createItem", rpcCreateContentItem);
    nk.registerRpc("cms.updateItem", rpcUpdateContentItem);
    nk.registerRpc("cms.deleteItem", rpcDeleteContentItem);
    nk.registerRpc("cms.getCategories", rpcGetCategories);
    nk.registerRpc("cms.createCategory", rpcCreateCategory);
    nk.registerRpc("cms.updateCategory", rpcUpdateCategory);
    nk.registerRpc("cms.deleteCategory", rpcDeleteCategory);

    logger.info("LNBQSHA Content Management System initialized");
    logger.info("Registered RPCs: cms.*");
  }
