"""Sincronização das transações da Pluggy para o banco do Rastro."""
import logging
from datetime import datetime

import pluggy_sdk

import db
from pluggy_client import get_api_client, retrieve_item

log = logging.getLogger("rastro.sync")

_PAGE_SIZE = 500


def _contraparte(tx: pluggy_sdk.Transaction) -> str | None:
    """Nome de quem recebeu (saída) ou de quem pagou (entrada), quando o banco informa."""
    pd = tx.payment_data
    if pd:
        parte = pd.receiver if (tx.type == "DEBIT") else pd.payer
        if parte is not None and getattr(parte, "name", None):
            return parte.name
    if tx.merchant is not None and getattr(tx.merchant, "name", None):
        return tx.merchant.name
    return None


def _to_row(tx: pluggy_sdk.Transaction, item_id: str) -> dict:
    valor = float(tx.amount)
    # Na Pluggy, conta corrente já vem com sinal; garantimos: saída negativa, entrada positiva
    if tx.type == "DEBIT" and valor > 0:
        valor = -valor
    return {
        # O SDK devolve alguns ids como uuid.UUID; o banco guarda texto
        "id": str(tx.id),
        "item_id": item_id,
        "account_id": str(tx.account_id),
        "data": tx.var_date.isoformat(),
        "descricao": tx.description,
        "valor": valor,
        "tipo": tx.type,
        "categoria_pluggy": tx.category,
        "contraparte": _contraparte(tx),
    }


def _fetch_pages(api: pluggy_sdk.TransactionApi, **filtros) -> list[pluggy_sdk.Transaction]:
    resultados, page = [], 1
    while True:
        resp = api.transactions_list(page_size=_PAGE_SIZE, page=page, **filtros)
        resultados.extend(resp.results or [])
        if page >= (resp.total_pages or 1):
            return resultados
        page += 1


def sync_item(item_id: str, created_at_from: datetime | None = None) -> int:
    """Busca as transações de todas as contas do item e salva. Retorna quantas foram gravadas."""
    total = 0
    with get_api_client() as client:
        accounts = pluggy_sdk.AccountApi(client).accounts_list(item_id).results or []
        tx_api = pluggy_sdk.TransactionApi(client)
        for account in accounts:
            filtros = {"account_id": account.id}
            if created_at_from:
                filtros["created_at_from"] = created_at_from
            txs = _fetch_pages(tx_api, **filtros)
            total += db.upsert_transactions([_to_row(t, item_id) for t in txs])
    log.info("item %s: %d transações sincronizadas", item_id, total)
    return total


def sync_transactions_by_ids(item_id: str, account_id: str, ids: list[str]) -> int:
    """Rebusca transações específicas (evento transactions/updated)."""
    with get_api_client() as client:
        txs = _fetch_pages(pluggy_sdk.TransactionApi(client), account_id=account_id, ids=ids)
    return db.upsert_transactions([_to_row(t, item_id) for t in txs])


def refresh_item_status(item_id: str) -> str | None:
    """Consulta o item na Pluggy (fonte da verdade) e atualiza o status salvo."""
    item = retrieve_item(item_id)
    db.set_connection_status(item_id, item.status)
    return item.status
