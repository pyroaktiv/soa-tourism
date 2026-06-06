package repository

import (
	"context"
	_ "embed"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed schema.sql
var schemaSQL string

var ErrNotFound = errors.New("not found")
var ErrAlreadyExists = errors.New("already exists")

type CartItem struct {
	ID       string
	CartID   string
	TourID   string
	TourName string
	Price    float64
	AddedAt  time.Time
}

type Cart struct {
	ID     string
	UserID string
	Items  []CartItem
}

type PurchaseToken struct {
	ID          string
	UserID      string
	TourID      string
	TourName    string
	Price       float64
	PurchasedAt time.Time
}

type Repository struct {
	pool *pgxpool.Pool
}

func New(ctx context.Context, uri string) (*Repository, error) {
	cfg, err := pgxpool.ParseConfig(uri)
	if err != nil {
		return nil, fmt.Errorf("parse postgres uri: %w", err)
	}
	cfg.MaxConns = 10

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("connect postgres: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping postgres: %w", err)
	}

	if _, err := pool.Exec(ctx, schemaSQL); err != nil {
		pool.Close()
		return nil, fmt.Errorf("apply schema: %w", err)
	}

	return &Repository{pool: pool}, nil
}

func (r *Repository) Close() {
	r.pool.Close()
}

func (r *Repository) GetOrCreateCart(ctx context.Context, userID string) (*Cart, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	cart, err := getOrCreateCartTx(ctx, tx, userID)
	if err != nil {
		return nil, err
	}

	items, err := listCartItemsTx(ctx, tx, cart.ID)
	if err != nil {
		return nil, err
	}
	cart.Items = items

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return cart, nil
}

func (r *Repository) AddItem(ctx context.Context, userID, tourID, tourName string, price float64) (*Cart, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	cart, err := getOrCreateCartTx(ctx, tx, userID)
	if err != nil {
		return nil, err
	}

	// User can't add a tour they already purchased.
	var purchased bool
	if err := tx.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM purchase_tokens WHERE user_id = $1 AND tour_id = $2)`,
		userID, tourID,
	).Scan(&purchased); err != nil {
		return nil, fmt.Errorf("check purchase: %w", err)
	}
	if purchased {
		return nil, ErrAlreadyExists
	}

	_, err = tx.Exec(ctx,
		`INSERT INTO cart_items (id, cart_id, tour_id, tour_name, price)
		 VALUES ($1, $2, $3, $4, $5)
		 ON CONFLICT (cart_id, tour_id) DO NOTHING`,
		uuid.NewString(), cart.ID, tourID, tourName, price,
	)
	if err != nil {
		return nil, fmt.Errorf("insert cart item: %w", err)
	}

	items, err := listCartItemsTx(ctx, tx, cart.ID)
	if err != nil {
		return nil, err
	}
	cart.Items = items

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return cart, nil
}

func (r *Repository) RemoveItem(ctx context.Context, userID, tourID string) (*Cart, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	cart, err := getOrCreateCartTx(ctx, tx, userID)
	if err != nil {
		return nil, err
	}

	if _, err := tx.Exec(ctx,
		`DELETE FROM cart_items WHERE cart_id = $1 AND tour_id = $2`,
		cart.ID, tourID,
	); err != nil {
		return nil, fmt.Errorf("delete cart item: %w", err)
	}

	items, err := listCartItemsTx(ctx, tx, cart.ID)
	if err != nil {
		return nil, err
	}
	cart.Items = items

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return cart, nil
}

func (r *Repository) RemoveToursFromAllCarts(ctx context.Context, tourIDs []string) error {
	if len(tourIDs) == 0 {
		return nil
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx,
		`DELETE FROM cart_items WHERE tour_id = ANY($1)`,
		tourIDs,
	); err != nil {
		return fmt.Errorf("failed to delete tours from carts: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// Checkout moves every cart_item of the user into purchase_tokens atomically.
// Returns the newly minted tokens.
func (r *Repository) Checkout(ctx context.Context, userID string) ([]PurchaseToken, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	cart, err := getOrCreateCartTx(ctx, tx, userID)
	if err != nil {
		return nil, err
	}

	items, err := listCartItemsTx(ctx, tx, cart.ID)
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, ErrNotFound
	}

	now := time.Now().UTC()
	tokens := make([]PurchaseToken, 0, len(items))

	for _, item := range items {
		tok := PurchaseToken{
			ID:          uuid.NewString(),
			UserID:      userID,
			TourID:      item.TourID,
			TourName:    item.TourName,
			Price:       item.Price,
			PurchasedAt: now,
		}
		_, err := tx.Exec(ctx,
			`INSERT INTO purchase_tokens (id, user_id, tour_id, tour_name, price, purchased_at)
			 VALUES ($1, $2, $3, $4, $5, $6)
			 ON CONFLICT (user_id, tour_id) DO NOTHING`,
			tok.ID, tok.UserID, tok.TourID, tok.TourName, tok.Price, tok.PurchasedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("insert purchase token: %w", err)
		}
		tokens = append(tokens, tok)
	}

	if _, err := tx.Exec(ctx, `DELETE FROM cart_items WHERE cart_id = $1`, cart.ID); err != nil {
		return nil, fmt.Errorf("clear cart: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return tokens, nil
}

func (r *Repository) ListTokens(ctx context.Context, userID string) ([]PurchaseToken, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, user_id, tour_id, tour_name, price, purchased_at
		 FROM purchase_tokens WHERE user_id = $1
		 ORDER BY purchased_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tokens []PurchaseToken
	for rows.Next() {
		var t PurchaseToken
		if err := rows.Scan(&t.ID, &t.UserID, &t.TourID, &t.TourName, &t.Price, &t.PurchasedAt); err != nil {
			return nil, err
		}
		tokens = append(tokens, t)
	}
	return tokens, rows.Err()
}

func (r *Repository) HasToken(ctx context.Context, userID, tourID string) (bool, error) {
	var exists bool
	err := r.pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM purchase_tokens WHERE user_id = $1 AND tour_id = $2)`,
		userID, tourID,
	).Scan(&exists)
	return exists, err
}

// --- helpers running inside an open tx ---

func getOrCreateCartTx(ctx context.Context, tx pgx.Tx, userID string) (*Cart, error) {
	var cart Cart
	err := tx.QueryRow(ctx,
		`SELECT id, user_id FROM shopping_carts WHERE user_id = $1`,
		userID,
	).Scan(&cart.ID, &cart.UserID)
	if err == nil {
		return &cart, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("query cart: %w", err)
	}

	cart = Cart{ID: uuid.NewString(), UserID: userID}
	if _, err := tx.Exec(ctx,
		`INSERT INTO shopping_carts (id, user_id) VALUES ($1, $2)
		 ON CONFLICT (user_id) DO NOTHING`,
		cart.ID, cart.UserID,
	); err != nil {
		return nil, fmt.Errorf("insert cart: %w", err)
	}

	// re-read in case a concurrent inserter won the race.
	if err := tx.QueryRow(ctx,
		`SELECT id, user_id FROM shopping_carts WHERE user_id = $1`,
		userID,
	).Scan(&cart.ID, &cart.UserID); err != nil {
		return nil, fmt.Errorf("re-read cart: %w", err)
	}
	return &cart, nil
}

func listCartItemsTx(ctx context.Context, tx pgx.Tx, cartID string) ([]CartItem, error) {
	rows, err := tx.Query(ctx,
		`SELECT id, cart_id, tour_id, tour_name, price, added_at
		 FROM cart_items WHERE cart_id = $1 ORDER BY added_at ASC`,
		cartID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []CartItem
	for rows.Next() {
		var item CartItem
		if err := rows.Scan(&item.ID, &item.CartID, &item.TourID, &item.TourName, &item.Price, &item.AddedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}
