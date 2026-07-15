-- StockFlow initial schema
-- RLS is intentionally disabled: all access goes through the server-only service-role client.

CREATE TYPE order_status AS ENUM ('open', 'partial', 'ready', 'dispatched');

CREATE TABLE skus (
  sku_code   TEXT PRIMARY KEY,
  item_name  TEXT NOT NULL,
  hsn        TEXT NOT NULL DEFAULT '',
  uom        TEXT NOT NULL DEFAULT 'PCS',
  ean        TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_skus_ean ON skus (ean) WHERE ean IS NOT NULL;

CREATE TABLE stock (
  sku_code     TEXT PRIMARY KEY REFERENCES skus (sku_code) ON DELETE CASCADE,
  qty          INT NOT NULL DEFAULT 0 CHECK (qty >= 0),
  reserved     INT NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  bin_location TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (reserved <= qty)
);

CREATE TABLE orders (
  order_no      TEXT PRIMARY KEY,
  party_name    TEXT NOT NULL,
  due_date      DATE,
  status        order_status NOT NULL DEFAULT 'open',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  dispatched_at TIMESTAMPTZ
);

CREATE INDEX idx_orders_status ON orders (status);

CREATE TABLE order_items (
  id           BIGSERIAL PRIMARY KEY,
  order_no     TEXT NOT NULL REFERENCES orders (order_no) ON DELETE CASCADE,
  sku_code     TEXT NOT NULL,
  qty_ordered  INT NOT NULL CHECK (qty_ordered > 0),
  qty_reserved INT NOT NULL DEFAULT 0 CHECK (qty_reserved >= 0),
  unknown_sku  BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (order_no, sku_code),
  CHECK (qty_reserved <= qty_ordered)
);

CREATE INDEX idx_order_items_order_no ON order_items (order_no);
CREATE INDEX idx_order_items_sku_code ON order_items (sku_code);

CREATE TABLE activity_log (
  id         BIGSERIAL PRIMARY KEY,
  message    TEXT NOT NULL,
  username   TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_log_created_at ON activity_log (created_at DESC);

ALTER TABLE skus DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log DISABLE ROW LEVEL SECURITY;

-- Atomic reservation with row-level locking
CREATE OR REPLACE FUNCTION reserve_stock(
  p_order_no TEXT,
  p_sku_code TEXT,
  p_qty INT,
  p_username TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_stock stock%ROWTYPE;
  v_available INT;
  v_order orders%ROWTYPE;
  v_item order_items%ROWTYPE;
  v_new_status order_status;
  v_all_ready BOOLEAN;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 OR p_qty > 1000000 THEN
    RAISE EXCEPTION 'Invalid quantity';
  END IF;

  SELECT * INTO v_stock FROM stock WHERE sku_code = p_sku_code FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock not found for SKU %', p_sku_code;
  END IF;

  v_available := GREATEST(0, v_stock.qty - v_stock.reserved);
  IF p_qty > v_available THEN
    RAISE EXCEPTION 'Not enough available stock';
  END IF;

  SELECT * INTO v_order FROM orders WHERE order_no = p_order_no FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status = 'dispatched' THEN
    RAISE EXCEPTION 'Order already dispatched';
  END IF;

  SELECT * INTO v_item
  FROM order_items
  WHERE order_no = p_order_no AND sku_code = p_sku_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SKU not on this order';
  END IF;

  IF v_item.qty_reserved + p_qty > v_item.qty_ordered THEN
    RAISE EXCEPTION 'Cannot reserve more than still needed on order';
  END IF;

  UPDATE stock
  SET reserved = reserved + p_qty, updated_at = now()
  WHERE sku_code = p_sku_code;

  UPDATE order_items
  SET qty_reserved = qty_reserved + p_qty
  WHERE id = v_item.id;

  SELECT NOT EXISTS (
    SELECT 1 FROM order_items
    WHERE order_no = p_order_no AND qty_reserved < qty_ordered
  ) INTO v_all_ready;

  IF v_all_ready THEN
    v_new_status := 'ready';
  ELSIF EXISTS (
    SELECT 1 FROM order_items
    WHERE order_no = p_order_no AND qty_reserved > 0
  ) THEN
    v_new_status := 'partial';
  ELSE
    v_new_status := 'open';
  END IF;

  UPDATE orders SET status = v_new_status WHERE order_no = p_order_no;

  INSERT INTO activity_log (message, username)
  VALUES (
    format('Reserved %s× %s for order %s', p_qty, p_sku_code, p_order_no),
    p_username
  );

  RETURN jsonb_build_object('success', true, 'status', v_new_status);
END;
$$;

-- Atomic dispatch for a ready order
CREATE OR REPLACE FUNCTION dispatch_order(
  p_order_no TEXT,
  p_username TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_item RECORD;
  v_party TEXT;
BEGIN
  SELECT * INTO v_order FROM orders WHERE order_no = p_order_no FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status <> 'ready' THEN
    RAISE EXCEPTION 'Order is not ready for dispatch';
  END IF;

  v_party := v_order.party_name;

  FOR v_item IN
    SELECT oi.sku_code, oi.qty_reserved
    FROM order_items oi
    WHERE oi.order_no = p_order_no
  LOOP
    IF v_item.qty_reserved > 0 THEN
      PERFORM 1 FROM stock WHERE sku_code = v_item.sku_code FOR UPDATE;

      UPDATE stock
      SET
        qty = GREATEST(0, qty - v_item.qty_reserved),
        reserved = GREATEST(0, reserved - v_item.qty_reserved),
        updated_at = now()
      WHERE sku_code = v_item.sku_code;
    END IF;

    UPDATE order_items
    SET qty_reserved = 0
    WHERE order_no = p_order_no AND sku_code = v_item.sku_code;
  END LOOP;

  UPDATE orders
  SET status = 'dispatched', dispatched_at = now()
  WHERE order_no = p_order_no;

  INSERT INTO activity_log (message, username)
  VALUES (
    format('Dispatched order %s to %s', p_order_no, v_party),
    p_username
  );

  RETURN jsonb_build_object('success', true);
END;
$$;
