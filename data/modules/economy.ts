// LNBQSHA Product Layer — Economy Module
// TypeScript runtime untuk economy RPC.
// Tidak mengganggu core Go Nakama.

import { nkruntime } from "nakama-runtime";

// ============================================================
// CATALOG (Server-side price authority)
// ============================================================

const CATALOG: Record<string, any> = {
  "cosmetic_001": {
    id: "cosmetic_001",
    name: "Neon Skin",
    description: "Glow in the dark with neon style",
    price: 500,
    currency: "soft",
    type: "skin"
  },
  "cosmetic_002": {
    id: "cosmetic_002",
    name: "Golden Skin",
    description: "Shine like gold",
    price: 1000,
    currency: "premium",
    type: "skin"
  },
  "cosmetic_003": {
    id: "cosmetic_003",
    name: "Dance Emote",
    description: "Show off your moves",
    price: 200,
    currency: "soft",
    type: "emote"
  },
  "cosmetic_004": {
    id: "cosmetic_004",
    name: "Crown Avatar",
    description: "Wear the crown of victory",
    price: 750,
    currency: "premium",
    type: "avatar"
  },
  "tournament_001": {
    id: "tournament_001",
    name: "Weekly Championship",
    description: "Compete for glory and prizes",
    price: 100,
    currency: "premium",
    type: "tournament_entry"
  }
};

// ============================================================
// HELPERS — Wallet (Storage Engine)
// ============================================================

const COLLECTION_WALLET = "lnbqsha_wallet_dev";
const COLLECTION_LEDGER = "lnbqsha_ledger_dev";
const COLLECTION_IDEMPOTENCY = "lnbqsha_idempotency_dev";

function getWallet(nk: nkruntime.Nakama, userId: string): any {
  const result = nk.storageRead([
    { collection: COLLECTION_WALLET, key: userId, userId }
  ]);
  if (result && result.length > 0 && result[0].value) {
    return result[0].value;
  }
  return null;
}

function createWallet(nk: nkruntime.Nakama, userId: string): any {
  const wallet = {
    userId,
    softBalance: 0,
    premiumBalance: 0,
    totalEarned: 0,
    totalSpent: 0,
    version: "0"
  };
  nk.storageWrite([
    {
      collection: COLLECTION_WALLET,
      key: userId,
      userId,
      value: wallet,
      version: "*",
      permissionRead: 1,
      permissionWrite: 1
    }
  ]);
  return wallet;
}

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ============================================================
// RPC: economy.purchase
// ============================================================

export const rpcPurchase: nkruntime.RpcFunction = (
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
    const idempotencyKey: string = data.idempotencyKey;

    if (!itemId) {
      throw new Error("itemId required");
    }
    if (!idempotencyKey) {
      throw new Error("idempotencyKey required");
    }

    const item = CATALOG[itemId];
    if (!item) {
      throw new Error(`Item not found: ${itemId}`);
    }

    // Get or create wallet
    let wallet = getWallet(nk, userId);
    if (!wallet) {
      wallet = createWallet(nk, userId);
    }

    // Check balance
    if (item.currency === "soft") {
      if (wallet.softBalance < item.price) {
        throw new Error("Insufficient soft balance");
      }
      wallet.softBalance -= item.price;
    } else {
      if (wallet.premiumBalance < item.price) {
        throw new Error("Insufficient premium balance");
      }
      wallet.premiumBalance -= item.price;
    }

    // Save wallet
    nk.storageWrite([
      {
        collection: COLLECTION_WALLET,
        key: userId,
        userId,
        value: wallet,
        permissionRead: 1,
        permissionWrite: 1
      }
    ]);

    // Record transaction in ledger
    const ledgerEntry = {
      id: generateUUID(),
      userId,
      itemId,
      price: item.price,
      currency: item.currency,
      balanceAfter: item.currency === "soft" ? wallet.softBalance : wallet.premiumBalance,
      timestamp: Date.now()
    };

    nk.storageWrite([
      {
        collection: COLLECTION_LEDGER,
        key: ledgerEntry.id,
        userId,
        value: ledgerEntry,
        permissionRead: 1,
        permissionWrite: 1
      }
    ]);

    return JSON.stringify({
      success: true,
      newBalance: item.currency === "soft" ? wallet.softBalance : wallet.premiumBalance,
      currency: item.currency,
      message: `Purchased ${item.name} successfully`
    });
  } catch (e) {
    throw new Error(`Purchase failed: ${e}`);
  }
};

// ============================================================
// RPC: economy.getWallet
// ============================================================

export const rpcGetWallet: nkruntime.RpcFunction = (
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

    let wallet = getWallet(nk, userId);
    if (!wallet) {
      wallet = createWallet(nk, userId);
    }

    return JSON.stringify(wallet);
  } catch (e) {
    throw new Error(`Failed to get wallet: ${e}`);
  }
};

// ============================================================
// INIT
// ============================================================

export function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama): void {
  // Register RPCs
  nk.registerRpc("economy.purchase", rpcPurchase);
  nk.registerRpc("economy.getWallet", rpcGetWallet);
  
  logger.info("LNBQSHA Economy Module (TypeScript) initialized");
  logger.info("Catalog loaded with items:", Object.keys(CATALOG));
      }
