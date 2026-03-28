"""
Database Service for SignalForge — Supabase PostgreSQL
All user data is keyed by clerk_user_id.
"""

import os
import logging
import psycopg2
import psycopg2.extras
import psycopg2.pool
from typing import Optional, List, Dict, Any
from datetime import datetime
from contextlib import contextmanager

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "")

# Validate DATABASE_URL on module load
if not DATABASE_URL:
    logger.error("CRITICAL: DATABASE_URL environment variable is not set!")
elif "postgresql" not in DATABASE_URL:
    logger.error(f"CRITICAL: DATABASE_URL must be PostgreSQL, got: {DATABASE_URL[:30]}...")
else:
    logger.info(f"Database configured: {DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else 'localhost'}")

# Connection pool for better performance and reliability
_connection_pool = None

def get_pool():
    """Get or create connection pool."""
    global _connection_pool
    if _connection_pool is None:
        try:
            _connection_pool = psycopg2.pool.SimpleConnectionPool(
                minconn=1,
                maxconn=10,
                dsn=DATABASE_URL
            )
            logger.info("Database connection pool created successfully")
        except Exception as e:
            logger.error(f"Failed to create connection pool: {e}")
            raise
    return _connection_pool


@contextmanager
def get_conn():
    """Context manager for database connections using connection pool."""
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable is not set")
    if "postgresql" not in DATABASE_URL:
        raise ValueError(f"Invalid DATABASE_URL: must be PostgreSQL connection string")
    
    pool = get_pool()
    conn = None
    try:
        conn = pool.getconn()
        conn.autocommit = False
        yield conn
        conn.commit()
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Database transaction failed: {e}")
        raise
    finally:
        if conn:
            pool.putconn(conn)


def _row_to_dict(cursor, row) -> Dict:
    """Convert a psycopg2 row to a dict using column names."""
    cols = [desc[0] for desc in cursor.description]
    return dict(zip(cols, row))


def _rows_to_dicts(cursor, rows) -> List[Dict]:
    return [_row_to_dict(cursor, r) for r in rows]


# ─── Portfolio ────────────────────────────────────────────────────────────────

def get_or_create_portfolio(clerk_user_id: str, name: str = "My Portfolio") -> Dict:
    """Get user's default portfolio, creating it if it doesn't exist."""
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM portfolios WHERE clerk_user_id = %s LIMIT 1", (clerk_user_id,))
        row = cur.fetchone()
        if row:
            return _row_to_dict(cur, row)
        cur.execute(
            "INSERT INTO portfolios (clerk_user_id, name) VALUES (%s, %s) RETURNING *",
            (clerk_user_id, name)
        )
        return _row_to_dict(cur, cur.fetchone())


def get_holdings(clerk_user_id: str) -> List[Dict]:
    """Get all holdings for a user."""
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM portfolio_holdings WHERE clerk_user_id = %s ORDER BY created_at DESC",
            (clerk_user_id,)
        )
        rows = _rows_to_dicts(cur, cur.fetchall())
        logger.info(f"get_holdings: user={clerk_user_id} found={len(rows)} holdings")
        return rows


def add_holding(clerk_user_id: str, symbol: str, company_name: str, exchange: str,
                quantity: float, average_price: float) -> Dict:
    """Add or update a holding (upsert by symbol). Single transaction."""
    logger.info(f"add_holding called: user={clerk_user_id} symbol={symbol} qty={quantity} avgPrice={average_price}")
    
    with get_conn() as conn:
        cur = conn.cursor()

        # Get or create portfolio in same transaction
        cur.execute("SELECT id FROM portfolios WHERE clerk_user_id = %s LIMIT 1", (clerk_user_id,))
        row = cur.fetchone()
        if row:
            portfolio_id = row[0]
            logger.info(f"Found existing portfolio: id={portfolio_id} for user={clerk_user_id}")
        else:
            cur.execute(
                "INSERT INTO portfolios (clerk_user_id, name) VALUES (%s, 'My Portfolio') RETURNING id",
                (clerk_user_id,)
            )
            portfolio_id = cur.fetchone()[0]
            logger.info(f"Created new portfolio: id={portfolio_id} for user={clerk_user_id}")

        # Upsert holding — all in same connection/transaction
        logger.info(f"Upserting holding: portfolio={portfolio_id} symbol={symbol}")
        cur.execute("""
            INSERT INTO portfolio_holdings
                (portfolio_id, clerk_user_id, symbol, company_name, exchange, quantity, average_price)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (portfolio_id, symbol)
            DO UPDATE SET
                quantity = portfolio_holdings.quantity + EXCLUDED.quantity,
                average_price = (
                    portfolio_holdings.average_price * portfolio_holdings.quantity
                    + EXCLUDED.average_price * EXCLUDED.quantity
                ) / (portfolio_holdings.quantity + EXCLUDED.quantity),
                company_name = EXCLUDED.company_name,
                updated_at = NOW()
            RETURNING *
        """, (portfolio_id, clerk_user_id, symbol.upper(), company_name, exchange, quantity, average_price))
        result = _row_to_dict(cur, cur.fetchone())
        logger.info(f"Holding saved successfully: user={clerk_user_id} symbol={symbol.upper()} qty={quantity} portfolio={portfolio_id} holding_id={result['id']}")
        return result


def update_holding(holding_id: str, clerk_user_id: str, quantity: float, average_price: float) -> Optional[Dict]:
    """Update a holding's quantity and average price."""
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("""
            UPDATE portfolio_holdings
            SET quantity = %s, average_price = %s, updated_at = NOW()
            WHERE id = %s AND clerk_user_id = %s
            RETURNING *
        """, (quantity, average_price, holding_id, clerk_user_id))
        row = cur.fetchone()
        return _row_to_dict(cur, row) if row else None


def delete_holding(holding_id: str, clerk_user_id: str) -> bool:
    """Delete a holding."""
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM portfolio_holdings WHERE id = %s AND clerk_user_id = %s",
            (holding_id, clerk_user_id)
        )
        return cur.rowcount > 0


# ─── Watchlist ────────────────────────────────────────────────────────────────

def get_watchlist(clerk_user_id: str) -> List[Dict]:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM watchlists WHERE clerk_user_id = %s ORDER BY created_at DESC", (clerk_user_id,))
        return _rows_to_dicts(cur, cur.fetchall())


def add_to_watchlist(clerk_user_id: str, symbol: str, company_name: str, exchange: str) -> Dict:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO watchlists (clerk_user_id, symbol, company_name, exchange)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (clerk_user_id, symbol) DO UPDATE SET company_name = EXCLUDED.company_name
            RETURNING *
        """, (clerk_user_id, symbol.upper(), company_name, exchange))
        return _row_to_dict(cur, cur.fetchone())


def remove_from_watchlist(clerk_user_id: str, symbol: str) -> bool:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM watchlists WHERE clerk_user_id = %s AND symbol = %s", (clerk_user_id, symbol.upper()))
        return cur.rowcount > 0


# ─── Trade Alerts ─────────────────────────────────────────────────────────────

def create_alert(clerk_user_id: str, data: Dict) -> Dict:
    with get_conn() as conn:
        cur = conn.cursor()
        # Deactivate existing active alert for same symbol
        cur.execute(
            "UPDATE trade_alerts SET status = 'replaced', updated_at = NOW() WHERE clerk_user_id = %s AND symbol = %s AND status = 'active'",
            (clerk_user_id, data["symbol"].upper())
        )
        cur.execute("""
            INSERT INTO trade_alerts (clerk_user_id, symbol, company_name, action, entry_min, entry_max, stop_loss, target_price, signal_confidence)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        """, (
            clerk_user_id, data["symbol"].upper(), data.get("companyName", data["symbol"]),
            data.get("action"), data.get("entryMin"), data.get("entryMax"),
            data.get("stopLoss"), data.get("targetPrice"), data.get("signalConfidence", 50)
        ))
        return _row_to_dict(cur, cur.fetchone())


def get_alerts(clerk_user_id: str) -> List[Dict]:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM trade_alerts WHERE clerk_user_id = %s AND status = 'active' ORDER BY created_at DESC",
            (clerk_user_id,)
        )
        return _rows_to_dicts(cur, cur.fetchall())


def delete_alert(alert_id: str, clerk_user_id: str) -> bool:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE trade_alerts SET status = 'deleted', updated_at = NOW() WHERE id = %s AND clerk_user_id = %s",
            (alert_id, clerk_user_id)
        )
        return cur.rowcount > 0
