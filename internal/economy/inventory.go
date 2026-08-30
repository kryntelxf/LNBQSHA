package economy

import (
	"context"
	"fmt"

	"github.com/gofrs/uuid/v5"
)

type InventoryItem struct {
	ItemID     string `json:"itemId"`
	AcquiredAt int64  `json:"acquiredAt"`
}

type InventoryService struct {
	repo EconomyRepository
}

func NewInventoryService(db DBTX) *InventoryService {
	return &InventoryService{
		repo: NewRepository(),
	}
}

func (s *InventoryService) GetInventory(ctx context.Context, userID string) ([]InventoryItem, error) {
	if userID == "" {
		return nil, ErrInvalidInput
	}

	_, err := uuid.FromString(userID)
	if err != nil {
		return nil, fmt.Errorf("%w: invalid user_id", ErrInvalidInput)
	}

	// TODO: Implement actual inventory query from database
	return []InventoryItem{}, nil
}

func (s *InventoryService) HasItem(ctx context.Context, userID string, itemID string) (bool, error) {
	if userID == "" || itemID == "" {
		return false, ErrInvalidInput
	}

	_, err := uuid.FromString(userID)
	if err != nil {
		return false, fmt.Errorf("%w: invalid user_id", ErrInvalidInput)
	}

	// TODO: Implement actual inventory check from database
	return false, nil
}
