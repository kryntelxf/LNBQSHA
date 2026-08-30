// Copyright 2026 LNBQSHA
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package server

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"path/filepath"

	"go.uber.org/zap"

	"github.com/heroiclabs/nakama/v3/internal/economy"
	"github.com/heroiclabs/nakama/v3/internal/player"
)

// This file is a standalone registration for economy RPCs.
// It does not modify the core runtime.go file.

type ctxUserIDKey struct{}

func getUserID(ctx context.Context) (string, error) {
	userID, ok := ctx.Value(ctxUserIDKey{}).(string)
	if !ok || userID == "" {
		return "", fmt.Errorf("unauthorized: missing user ID")
	}
	return userID, nil
}

// RegisterEconomyRPCs registers all economy and player RPCs.
func RegisterEconomyRPCs(
	ctx context.Context,
	logger *zap.Logger,
	db *sql.DB,
	nk *Nakama,
	initializer *Initializer,
) error {
	logger.Info("Initializing LNBQSHA Economy Module")

	catalogPath := filepath.Join("data", "catalog.json")
	catalog, err := economy.LoadCatalog(catalogPath)
	if err != nil {
		logger.Error("Failed to load catalog", zap.Error(err))
		return err
	}
	logger.Info("Catalog loaded", zap.Int("items", len(catalog)))

	economyService := economy.NewService(db)
	inventoryService := economy.NewInventoryService(db)
	playerStateService := player.NewPlayerStateService(db)

	// 1. economy.Purchase
	purchaseHandler := func(ctx context.Context, logger *zap.Logger, db *sql.DB, nk *Nakama, payload string) (string, error) {
		userID, err := getUserID(ctx)
		if err != nil {
			return "", err
		}

		var req economy.PurchaseRequest
		if err := json.Unmarshal([]byte(payload), &req); err != nil {
			return "", fmt.Errorf("invalid payload: %w", err)
		}

		if req.ItemID == "" || req.IdempotencyKey == "" {
			return "", fmt.Errorf("itemId and idempotencyKey required")
		}

		resp, err := economyService.Purchase(ctx, userID, req, catalog)
		if err != nil {
			return "", err
		}

		result, err := json.Marshal(resp)
		if err != nil {
			return "", err
		}
		return string(result), nil
	}

	if err := initializer.RegisterRpc("economy.Purchase", purchaseHandler); err != nil {
		return err
	}
	logger.Info("Registered RPC: economy.Purchase")

	// 2. inventory.list
	listHandler := func(ctx context.Context, logger *zap.Logger, db *sql.DB, nk *Nakama, payload string) (string, error) {
		userID, err := getUserID(ctx)
		if err != nil {
			return "", err
		}

		items, err := inventoryService.GetInventory(ctx, userID)
		if err != nil {
			return "", err
		}

		result, err := json.Marshal(map[string]interface{}{
			"items": items,
		})
		if err != nil {
			return "", err
		}
		return string(result), nil
	}

	if err := initializer.RegisterRpc("inventory.list", listHandler); err != nil {
		return err
	}
	logger.Info("Registered RPC: inventory.list")

	// 3. inventory.has
	hasHandler := func(ctx context.Context, logger *zap.Logger, db *sql.DB, nk *Nakama, payload string) (string, error) {
		userID, err := getUserID(ctx)
		if err != nil {
			return "", err
		}

		var req struct {
			ItemID string `json:"itemId"`
		}
		if err := json.Unmarshal([]byte(payload), &req); err != nil {
			return "", fmt.Errorf("invalid payload: %w", err)
		}
		if req.ItemID == "" {
			return "", fmt.Errorf("itemId required")
		}

		has, err := inventoryService.HasItem(ctx, userID, req.ItemID)
		if err != nil {
			return "", err
		}

		result, err := json.Marshal(map[string]interface{}{
			"has": has,
		})
		if err != nil {
			return "", err
		}
		return string(result), nil
	}

	if err := initializer.RegisterRpc("inventory.has", hasHandler); err != nil {
		return err
	}
	logger.Info("Registered RPC: inventory.has")

	// 4. player.state.get
	getStateHandler := func(ctx context.Context, logger *zap.Logger, db *sql.DB, nk *Nakama, payload string) (string, error) {
		userID, err := getUserID(ctx)
		if err != nil {
			return "", err
		}

		state, err := playerStateService.GetState(ctx, userID)
		if err != nil {
			return "", err
		}

		result, err := json.Marshal(state)
		if err != nil {
			return "", err
		}
		return string(result), nil
	}

	if err := initializer.RegisterRpc("player.state.get", getStateHandler); err != nil {
		return err
	}
	logger.Info("Registered RPC: player.state.get")

	// 5. player.state.update
	updateStateHandler := func(ctx context.Context, logger *zap.Logger, db *sql.DB, nk *Nakama, payload string) (string, error) {
		userID, err := getUserID(ctx)
		if err != nil {
			return "", err
		}

		var updates map[string]interface{}
		if err := json.Unmarshal([]byte(payload), &updates); err != nil {
			return "", fmt.Errorf("invalid payload: %w", err)
		}

		if updates == nil {
			return "", fmt.Errorf("updates required")
		}

		state, err := playerStateService.UpdateState(ctx, userID, updates)
		if err != nil {
			return "", err
		}

		result, err := json.Marshal(state)
		if err != nil {
			return "", err
		}
		return string(result), nil
	}

	if err := initializer.RegisterRpc("player.state.update", updateStateHandler); err != nil {
		return err
	}
	logger.Info("Registered RPC: player.state.update")

	logger.Info("LNBQSHA Economy Module initialized successfully")
	return nil
}
