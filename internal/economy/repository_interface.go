package economy

import (
	"context"

	"github.com/gofrs/uuid/v5"
)

type EconomyRepository interface {
	GetWalletForUpdate(ctx context.Context, db DBTX, userID uuid.UUID) (*Wallet, error)
	CreateWallet(ctx context.Context, db DBTX, userID uuid.UUID) error
	UpdateWallet(ctx context.Context, db DBTX, userID uuid.UUID, softBalance, premiumBalance int64, transactionID uuid.UUID) error
	InsertLedger(ctx context.Context, db DBTX, entry *LedgerEntry) error
	InsertIdempotency(ctx context.Context, db DBTX, key string, userID uuid.UUID, transactionID uuid.UUID, intent Intent) (bool, error)
	GetIdempotency(ctx context.Context, db DBTX, key string, userID uuid.UUID) (*IdempotencyRecord, error)
	CompleteIdempotency(ctx context.Context, db DBTX, key string, userID uuid.UUID, result []byte) error
	FailIdempotency(ctx context.Context, db DBTX, key string, userID uuid.UUID, result []byte) error
	InsertOwnership(ctx context.Context, db DBTX, userID uuid.UUID, itemID string, transactionID uuid.UUID) error
}
