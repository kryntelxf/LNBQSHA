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

type ctxUserIDKey struct{}

func getUserID(ctx context.Context) (string, error) {
	userID, ok := ctx.Value(ctxUserIDKey{}).(string)
	if !ok || userID == "" {
		return "", fmt.Errorf("unauthorized: missing user ID")
	}
	return userID, nil
}

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
