-- Shopping cart - one per user, lazily created on first AddToCart.
CREATE TABLE IF NOT EXISTS shopping_carts (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per OrderItem in a cart. Tour info is snapshot at AddToCart time
-- so the price the user sees in their cart can't shift under them.
CREATE TABLE IF NOT EXISTS cart_items (
    id        TEXT PRIMARY KEY,
    cart_id   TEXT NOT NULL REFERENCES shopping_carts(id) ON DELETE CASCADE,
    tour_id   TEXT NOT NULL,
    tour_name TEXT NOT NULL,
    price     DOUBLE PRECISION NOT NULL,
    added_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(cart_id, tour_id)
);

CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);

-- TourPurchaseToken - issued at checkout, one per purchased tour per user.
CREATE TABLE IF NOT EXISTS purchase_tokens (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL,
    tour_id      TEXT NOT NULL,
    tour_name    TEXT NOT NULL,
    price        DOUBLE PRECISION NOT NULL,
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, tour_id)
);

CREATE INDEX IF NOT EXISTS idx_purchase_tokens_user_id ON purchase_tokens(user_id);
