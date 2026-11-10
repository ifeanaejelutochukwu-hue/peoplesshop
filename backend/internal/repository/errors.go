package repository

import "errors"

// ErrNotFound is returned when a database query finds no rows.
var ErrNotFound = errors.New("record not found")

// ErrDuplicate is returned when a unique constraint is violated.
var ErrDuplicate = errors.New("record already exists")

// ErrInsufficientStock is returned when stock availability is insufficient.
var ErrInsufficientStock = errors.New("insufficient stock")
