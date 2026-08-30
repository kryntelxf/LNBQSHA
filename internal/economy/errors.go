package economy

import "errors"

var (
	ErrInsufficientBalance = errors.New("insufficient balance")
	ErrDuplicateRequest    = errors.New("duplicate request")
	ErrPendingRequest      = errors.New("request is still pending")
	ErrInvalidInput        = errors.New("invalid input")
	ErrWalletNotFound      = errors.New("wallet not found")
	ErrItemNotFound        = errors.New("item not found in catalog")
	ErrInternalError       = errors.New("internal error")
)
