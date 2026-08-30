package economy

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/gofrs/uuid/v5"
)

type Repository struct{}

func NewRepository() *Repository {
	return &Repository{}
}

func (r *Repository) GetWalletForUpdate(ctx context.Context, db DBTX, userID uuid.UUID) (*Wallet, error) {
	var wallet Wallet
	query := `
		SELECT user_id, soft_balance, premium_balance, last_transaction_id, version, created_at, updated_at
		FROM lnbqsha_wallet
		WHERE user_id = $1
		FOR UPDATE
	`
	err := db.QueryRowContext(ctx, query, userID).Scan(
		&wallet.UserID,
		&wallet.SoftBalance,
		&wallet.PremiumBalance,
		&wallet.LastTransactionID,
		&wallet.Version,
		&wallet.CreatedAt,
		&wallet.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, ErrWalletNotFound
	}
	if err != nil {
		return nil, err
	}
	return &wallet, nil
}

func (r *Repository) CreateWallet(ctx context.Context, db DBTX, userID uuid.UUID) error {
	query := `
		INSERT INTO lnbqsha_wallet (user_id, soft_balance, premium_balance, version)
		VALUES ($1, 0, 0, 1)
		ON CONFLICT (user_id) DO NOTHING
	`
	_, err := db.ExecContext(ctx, query, userID)
	return err
}

func (r *Repository) InsertLedger(ctx context.Context, db DBTX, entry *LedgerEntry) error {
	query := `
		INSERT INTO lnbqsha_wallet_ledger (
			transaction_id, operation_id, user_id, idempotency_key,
			currency, amount, balance_after, operation, source,
			reference_id, intent, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
	`
	_, err := db.ExecContext(ctx, query,
		entry.TransactionID,
		entry.OperationID,
		entry.UserID,
		entry.IdempotencyKey,
		entry.Currency,
		entry.Amount,
		entry.BalanceAfter,
		entry.Operation,
		entry.Source,
		entry.ReferenceID,
		entry.Intent,
	)
	return err
}

var _ EconomyRepository = (*Repository)(nil)
