package economy

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/gofrs/uuid/v5"
)

type Service struct {
	db   *sql.DB
	repo EconomyRepository
}

func NewService(db *sql.DB) *Service {
	return &Service{
		db:   db,
		repo: NewRepository(),
	}
}

func (s *Service) Purchase(
	ctx context.Context,
	userID string,
	req PurchaseRequest,
	catalog map[string]CatalogItem,
) (*PurchaseResponse, error) {
	if userID == "" || req.ItemID == "" || req.IdempotencyKey == "" {
		return nil, ErrInvalidInput
	}

	userUUID, err := uuid.FromString(userID)
	if err != nil {
		return nil, fmt.Errorf("%w: invalid user_id", ErrInvalidInput)
	}

	item, ok := catalog[req.ItemID]
	if !ok {
		return nil, ErrItemNotFound
	}

	transactionID := uuid.Must(uuid.NewV4())
	operationID := uuid.Must(uuid.NewV4())

	intent := Intent{
		Operation:   "purchase",
		UserID:      userID,
		Currency:    item.Currency,
		Amount:      -item.Price,
		Source:      "game_result",
		ReferenceID: &req.ItemID,
		Description: fmt.Sprintf("Purchase: %s", item.Name),
		Metadata: map[string]interface{}{
			"item_id":   item.ID,
			"item_name": item.Name,
		},
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInternalError, err)
	}
	defer tx.Rollback()

	existing, err := s.repo.GetIdempotency(ctx, tx, req.IdempotencyKey, userUUID)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		if existing.Status == "completed" {
			var result PurchaseResponse
			if err := json.Unmarshal(*existing.Result, &result); err != nil {
				return nil, ErrInternalError
			}
			return &result, nil
		}
		if existing.Status == "pending" {
			return nil, ErrPendingRequest
		}
		if existing.Status == "failed_permanent" {
			var failureResult PurchaseResponse
			if err := json.Unmarshal(*existing.Result, &failureResult); err != nil {
				return nil, ErrInternalError
			}
			if failureResult.Message == "Insufficient soft balance" ||
				failureResult.Message == "Insufficient premium balance" {
				return nil, ErrInsufficientBalance
			}
			return nil, fmt.Errorf("request permanently failed: %s", failureResult.Message)
		}
	}

	inserted, err := s.repo.InsertIdempotency(ctx, tx, req.IdempotencyKey, userUUID, transactionID, intent)
	if err != nil {
		return nil, err
	}
	if !inserted {
		existing, err := s.repo.GetIdempotency(ctx, tx, req.IdempotencyKey, userUUID)
		if err != nil {
			return nil, err
		}
		if existing != nil && existing.Status == "completed" {
			var result PurchaseResponse
			if err := json.Unmarshal(*existing.Result, &result); err != nil {
				return nil, ErrInternalError
			}
			return &result, nil
		}
		return nil, ErrDuplicateRequest
	}

	if err := s.repo.CreateWallet(ctx, tx, userUUID); err != nil {
		return nil, err
	}

	wallet, err := s.repo.GetWalletForUpdate(ctx, tx, userUUID)
	if err != nil {
		return nil, err
	}

	var newBalance int64
	if item.Currency == "soft" {
		if wallet.SoftBalance < item.Price {
			failResult, _ := json.Marshal(PurchaseResponse{
				Success: false,
				Message: "Insufficient soft balance",
			})
			_ = s.repo.FailIdempotency(ctx, tx, req.IdempotencyKey, userUUID, failResult)
			if commitErr := tx.Commit(); commitErr != nil {
				return nil, fmt.Errorf("%w: %v", ErrInternalError, commitErr)
			}
			return nil, ErrInsufficientBalance
		}
		wallet.SoftBalance -= item.Price
		newBalance = wallet.SoftBalance
	} else {
		if wallet.PremiumBalance < item.Price {
			failResult, _ := json.Marshal(PurchaseResponse{
				Success: false,
				Message: "Insufficient premium balance",
			})
			_ = s.repo.FailIdempotency(ctx, tx, req.IdempotencyKey, userUUID, failResult)
			if commitErr := tx.Commit(); commitErr != nil {
				return nil, fmt.Errorf("%w: %v", ErrInternalError, commitErr)
			}
			return nil, ErrInsufficientBalance
		}
		wallet.PremiumBalance -= item.Price
		newBalance = wallet.PremiumBalance
	}

	if err := s.repo.UpdateWallet(ctx, tx, userUUID, wallet.SoftBalance, wallet.PremiumBalance, transactionID); err != nil {
		return nil, err
	}

	ledgerEntry := &LedgerEntry{
		TransactionID:  transactionID,
		OperationID:    operationID,
		UserID:         userUUID,
		IdempotencyKey: req.IdempotencyKey,
		Currency:       item.Currency,
		Amount:         -item.Price,
		BalanceAfter:   newBalance,
		Operation:      "purchase",
		Source:         "game_result",
		ReferenceID:    &req.ItemID,
		Intent:         intent,
	}
	if err := s.repo.InsertLedger(ctx, tx, ledgerEntry); err != nil {
		return nil, err
	}

	if err := s.repo.InsertOwnership(ctx, tx, userUUID, req.ItemID, transactionID); err != nil {
		return nil, err
	}

	response := PurchaseResponse{
		Success:        true,
		TransactionID:  transactionID.String(),
		NewBalance:     newBalance,
		Currency:       item.Currency,
		Message:        fmt.Sprintf("Purchased %s successfully", item.Name),
	}
	resultJSON, err := json.Marshal(response)
	if err != nil {
		return nil, ErrInternalError
	}
	if err := s.repo.CompleteIdempotency(ctx, tx, req.IdempotencyKey, userUUID, resultJSON); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInternalError, err)
	}

	return &response, nil
}
