"""Banco de dados do Rastro (SQLite por enquanto; troca fácil para Postgres depois)."""
import os
import sqlite3

DB_PATH = os.environ.get("RASTRO_DB", "rastro.db")

_SCHEMA = """
CREATE TABLE IF NOT EXISTS conexoes (
    item_id        TEXT PRIMARY KEY,
    client_user_id TEXT NOT NULL,
    banco          TEXT,
    status         TEXT,
    erro           TEXT,
    criado_em      TEXT DEFAULT CURRENT_TIMESTAMP,
    atualizado_em  TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transacoes (
    id           TEXT PRIMARY KEY,          -- id da transação na Pluggy
    item_id      TEXT NOT NULL,
    account_id   TEXT NOT NULL,
    data         TEXT NOT NULL,             -- ISO 8601
    descricao    TEXT,
    valor        REAL NOT NULL,             -- negativo = saída, positivo = entrada
    tipo         TEXT,                      -- DEBIT / CREDIT
    categoria_pluggy TEXT,
    contraparte  TEXT,                      -- quem pagou / quem recebeu (Pix, TED...)
    categoria    TEXT,                      -- categoria do Rastro (preenchida depois)
    atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_transacoes_data ON transacoes (data);

CREATE TABLE IF NOT EXISTS webhook_eventos (
    event_id    TEXT PRIMARY KEY,
    evento      TEXT NOT NULL,
    recebido_em TEXT DEFAULT CURRENT_TIMESTAMP
);
"""


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.executescript(_SCHEMA)
    return conn


# ---------- conexões ----------

def save_connection(client_user_id: str, item_id: str, banco: str | None, status: str | None) -> None:
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO conexoes (item_id, client_user_id, banco, status)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(item_id) DO UPDATE SET
                status = excluded.status,
                banco = COALESCE(excluded.banco, conexoes.banco),
                erro = NULL,
                atualizado_em = CURRENT_TIMESTAMP
            """,
            (item_id, client_user_id, banco, status),
        )


def set_connection_status(item_id: str, status: str, erro: str | None = None) -> None:
    with _connect() as conn:
        conn.execute(
            "UPDATE conexoes SET status = ?, erro = ?, atualizado_em = CURRENT_TIMESTAMP WHERE item_id = ?",
            (status, erro, item_id),
        )


def list_connections(client_user_id: str) -> list[tuple]:
    with _connect() as conn:
        return conn.execute(
            "SELECT item_id, banco, status, erro FROM conexoes WHERE client_user_id = ?",
            (client_user_id,),
        ).fetchall()


# ---------- transações ----------

def upsert_transactions(rows: list[dict]) -> int:
    """Insere ou atualiza transações. Nunca sobrescreve a categoria do Rastro."""
    if not rows:
        return 0
    with _connect() as conn:
        conn.executemany(
            """
            INSERT INTO transacoes (id, item_id, account_id, data, descricao, valor, tipo, categoria_pluggy, contraparte)
            VALUES (:id, :item_id, :account_id, :data, :descricao, :valor, :tipo, :categoria_pluggy, :contraparte)
            ON CONFLICT(id) DO UPDATE SET
                data = excluded.data,
                descricao = excluded.descricao,
                valor = excluded.valor,
                tipo = excluded.tipo,
                categoria_pluggy = excluded.categoria_pluggy,
                contraparte = excluded.contraparte,
                atualizado_em = CURRENT_TIMESTAMP
            """,
            rows,
        )
    return len(rows)


def delete_transactions(ids: list[str]) -> int:
    if not ids:
        return 0
    with _connect() as conn:
        cur = conn.executemany("DELETE FROM transacoes WHERE id = ?", [(i,) for i in ids])
        return cur.rowcount


# ---------- webhooks ----------

def register_event(event_id: str, evento: str) -> bool:
    """Grava o eventId. Retorna False se ele já tinha chegado antes (evento duplicado)."""
    with _connect() as conn:
        cur = conn.execute(
            "INSERT OR IGNORE INTO webhook_eventos (event_id, evento) VALUES (?, ?)",
            (event_id, evento),
        )
        return cur.rowcount == 1
