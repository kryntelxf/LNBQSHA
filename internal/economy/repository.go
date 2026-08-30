package economy

import (
	"context"
	"database/sql"

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

func (r *Repository) UpdateWallet(
	ctx context.Context,
	db DBTX,
	userID uuid.UUID,
	softBalance int64,
	premiumBalance int64,
	transactionID uuid.UUID,
) error {
	query := `
		UPDATE lnbqsha_wallet
		SET soft_balance = $1,
			premium_balance = $2,
			last_transaction_id = $3,
			version = version + 1,
			updated_at = NOW()
		WHERE user_id = $4
	`
	_, err := db.ExecContext(ctx, query, softBalance, premiumBalance, transactionID, userID)
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

func (r *Repository) InsertIdempotency(
	ctx context.Context,
	db DBTX,
	key string,
	userID uuid.UUID,
	transactionID uuid.UUID,
	intent Intent,
) (bool, error) {
	query := `
		INSERT INTO lnbqsha_idempotency (
			idempotency_key, user_id, transaction_id, status, intent, created_at
		) VALUES ($1, $2, $3, 'pending', $4, NOW())
		ON CONFLICT (idempotency_key, user_id) DO NOTHING
	`
	result, err := db.ExecContext(ctx, query, key, userID, transactionID, intent)
	if err != nil {
		return false, err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return false, err
	}
	return rows > 0, nil
}

func (r *Repository) GetIdempotency(
	ctx context.Context,
	db DBTX,
	key string,
	userID uuid.UUID,
) (*IdempotencyRecord, error) {
	query := `
		SELECT idempotency_key, user_id, transaction_id, status, intent, result, created_at, completed_at
		FROM lnbqsha_idempotency
		WHERE idempotency_key = $1 AND user_id = $2
	`
	var record IdempotencyRecord
	err := db.QueryRowContext(ctx, query, key, userID).Scan(
		&record.IdempotencyKey,
		&record.UserID,
		&record.TransactionID,
		&record.Status,
		&record.Intent,
		&record.Result,
		&record.CreatedAt,
		&record.CompletedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &record, nil
}

func (r *Repository) CompleteIdempotency(
	ctx context.Context,
	db DBTX,
	key string,
	userID uuid.UUID,
	result []byte,
) error {
	query := `
		UPDATE lnbqsha_idempotency
		SET status = 'completed',
			result = $1,
			completed_at = NOW()
		WHERE idempotency_key = $2 AND user_id = $3
	`
	_, err := db.ExecContext(ctx, query, result, key, userID)
	return err
}

func (r *Repository) FailIdempotency(
	ctx context.Context,
	db DBTX,
	key string,
	userID uuid.UUID,
	result []byte,
) error {
	query := `
		UPDATE lnbqsha_idempotency
		SET status = 'failed_permanent',
			result = $1,
			completed_at = NOW()
		WHERE idempotency_key = $2 AND user_id = $3
	`
	_, err := db.ExecContext(ctx, query, result, key, userID)
	return err
}

func (r *Repository) InsertOwnership(
	ctx context.Context,
	db DBTX,
	userID uuid.UUID,
	itemID string,
	transactionID uuid.UUID,
) error {
	query := `
		INSERT INTO lnbqsha_inventory (user_id, item_id, transaction_id)
		VALUES ($1, $2, $3)
		ON CONFLICT (user_id, item_id) DO NOTHING
	`
	_, err := db.ExecContext(ctx, query, userID, itemID, transactionID)
	return err
}

var _ EconomyRepository = (*Repository)(nil)
