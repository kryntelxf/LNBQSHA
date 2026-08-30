package economy

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"

	"github.com/gofrs/uuid/v5"
)

type Wallet struct {
	UserID            uuid.UUID  `db:"user_id"`
	SoftBalance       int64      `db:"soft_balance"`
	PremiumBalance    int64      `db:"premium_balance"`
	LastTransactionID *uuid.UUID `db:"last_transaction_id"`
	Version           int64      `db:"version"`
	CreatedAt         time.Time  `db:"created_at"`
	UpdatedAt         time.Time  `db:"updated_at"`
}

type LedgerEntry struct {
	ID             uuid.UUID `db:"id"`
	TransactionID  uuid.UUID `db:"transaction_id"`
	OperationID    uuid.UUID `db:"operation_id"`
	UserID         uuid.UUID `db:"user_id"`
	IdempotencyKey string    `db:"idempotency_key"`
	Currency       string    `db:"currency"`
	Amount         int64     `db:"amount"`
	BalanceAfter   int64     `db:"balance_after"`
	Operation      string    `db:"operation"`
	Source         string    `db:"source"`
	ReferenceID    *string   `db:"reference_id"`
	Intent         Intent    `db:"intent"`
	CreatedAt      time.Time `db:"created_at"`
}

type Intent struct {
	Operation   string                 `json:"operation"`
	UserID      string                 `json:"user_id"`
	Currency    string                 `json:"currency"`
	Amount      int64                  `json:"amount"`
	Source      string                 `json:"source"`
	ReferenceID *string                `json:"reference_id,omitempty"`
	Description string                 `json:"description"`
	Metadata    map[string]interface{} `json:"metadata"`
}

func (i Intent) Value() (driver.Value, error) {
	return json.Marshal(i)
}

func (i *Intent) Scan(value interface{}) error {
	if value == nil {
		return nil
	}
	b, ok := value.([]byte)
	if !ok {
		return fmt.Errorf("cannot scan %T into Intent", value)
	}
	return json.Unmarshal(b, i)
}

type IdempotencyRecord struct {
	IdempotencyKey string     `db:"idempotency_key"`
	UserID         uuid.UUID  `db:"user_id"`
	TransactionID  uuid.UUID  `db:"transaction_id"`
	Status         string     `db:"status"`
	Intent         Intent     `db:"intent"`
	Result         *[]byte    `db:"result"`
	CreatedAt      time.Time  `db:"created_at"`
	CompletedAt    *time.Time `db:"completed_at"`
}

type PurchaseRequest struct {
	ItemID         string `json:"itemId"`
	IdempotencyKey string `json:"idempotencyKey"`
}

type PurchaseResponse struct {
	Success        bool   `json:"success"`
	TransactionID  string `json:"transactionId"`
	NewBalance     int64  `json:"newBalance"`
	Currency       string `json:"currency"`
	Message        string `json:"message"`
}
