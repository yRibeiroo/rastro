"""Rastro — servidor Flask."""
import hmac
import logging
import os
import re
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

import pluggy_sdk
from dotenv import load_dotenv
from flask import Flask, jsonify, request

load_dotenv()  # carrega o .env (que NÃO vai para o git) antes de importar o resto

import db  # noqa: E402
import sync  # noqa: E402
from pluggy_client import create_connect_token, retrieve_item  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
app = Flask(__name__)
log = logging.getLogger("rastro")

# Identificador simples: letras, números, ponto, hífen, underline e @ (até 64 caracteres)
_CLIENT_USER_ID = re.compile(r"^[\w.@-]{1,64}$")


@app.route("/api/connect-token", methods=["POST"])
def connect_token():
    body = request.get_json(silent=True) or {}
    client_user_id = body.get("clientUserId")

    if not isinstance(client_user_id, str) or not _CLIENT_USER_ID.match(client_user_id):
        return jsonify({"error": "clientUserId inválido"}), 400

    try:
        # Sem webhookUrl aqui: o webhook é registrado uma vez via register_webhook.py,
        # que permite enviar o header secreto. Por aqui ele chegaria sem autenticação.
        token = create_connect_token(client_user_id=client_user_id)
    except pluggy_sdk.ApiException as exc:
        # Loga o status, mas nunca devolve detalhes da Pluggy (nem credenciais) ao navegador
        log.error("Falha ao criar connect token na Pluggy: status=%s", exc.status)
        return jsonify({"error": "Não foi possível iniciar a conexão com o banco"}), 502

    return jsonify({"accessToken": token})


@app.route("/api/items", methods=["POST"])
def save_item():
    """Recebe o itemId do Pluggy Connect, confere na Pluggy e salva a conexão."""
    body = request.get_json(silent=True) or {}
    client_user_id = body.get("clientUserId")
    item_id = body.get("itemId")

    if not isinstance(client_user_id, str) or not _CLIENT_USER_ID.match(client_user_id):
        return jsonify({"error": "clientUserId inválido"}), 400
    try:
        item_id = str(uuid.UUID(str(item_id)))
    except ValueError:
        return jsonify({"error": "itemId inválido"}), 400

    # Não confiamos cegamente no navegador: o item precisa existir na SUA aplicação Pluggy
    try:
        item = retrieve_item(item_id)
    except pluggy_sdk.ApiException as exc:
        if exc.status == 404:
            return jsonify({"error": "Conexão não encontrada"}), 404
        log.error("Falha ao consultar item na Pluggy: status=%s", exc.status)
        return jsonify({"error": "Erro ao validar a conexão"}), 502

    connector_name = item.connector.name if item.connector else None
    db.save_connection(client_user_id, item_id, connector_name, item.status)
    return jsonify({"itemId": item_id, "banco": connector_name, "status": item.status}), 201


# ---------------- Webhooks da Pluggy ----------------

# Fila com poucos workers: o webhook responde na hora e o trabalho pesado roda em segundo plano.
# Diferente de criar uma Thread por evento, isso não explode se chegarem muitos eventos juntos.
_webhook_pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="pluggy-webhook")


def _webhook_autorizado() -> bool:
    secret = os.environ.get("PLUGGY_WEBHOOK_SECRET")
    if not secret:
        log.error("PLUGGY_WEBHOOK_SECRET não configurado: recusando webhooks")
        return False
    recebido = request.headers.get("Authorization", "")
    return hmac.compare_digest(recebido.encode(), f"Bearer {secret}".encode())


@app.route("/api/webhooks/pluggy", methods=["POST"])
def pluggy_webhook():
    if not _webhook_autorizado():
        return jsonify({"error": "não autorizado"}), 401  # 401 não é reenviado pela Pluggy

    event = request.get_json(silent=True) or {}
    evento, event_id = event.get("event"), event.get("eventId")
    if not isinstance(evento, str) or not isinstance(event_id, str):
        return jsonify({"error": "payload inválido"}), 400

    log.info("Webhook recebido: %s (%s)", evento, event_id)

    if not db.register_event(event_id, evento):
        return jsonify({"received": True, "duplicado": True}), 200

    _webhook_pool.submit(_processar_webhook, event)
    return jsonify({"received": True}), 200


def _processar_webhook(event: dict) -> None:
    evento, item_id = event["event"], event.get("itemId")
    try:
        if evento == "item/created":
            # Primeira sincronização: o item já pode estar com dados coletados
            if sync.refresh_item_status(item_id) == "UPDATED":
                sync.sync_item(item_id)

        elif evento == "item/updated":
            sync.refresh_item_status(item_id)
            sync.sync_item(item_id)

        elif evento == "item/error":
            erro = event.get("error") or {}
            db.set_connection_status(item_id, "ERROR", erro.get("message") or erro.get("code"))
            log.warning("Item %s com erro: %s", item_id, erro.get("code"))

        elif evento == "transactions/created":
            desde = event.get("transactionsCreatedAtFrom")
            sync.sync_item(item_id, datetime.fromisoformat(desde.replace("Z", "+00:00")) if desde else None)

        elif evento == "transactions/updated":
            sync.sync_transactions_by_ids(item_id, event["accountId"], event.get("transactionIds") or [])

        elif evento == "transactions/deleted":
            db.delete_transactions(event.get("transactionIds") or [])

        else:
            log.info("Evento %s ignorado", evento)
    except Exception:
        # Já respondemos 200, então a Pluggy não reenvia: o log é onde você vai ver a falha
        log.exception("Falha ao processar webhook %s (%s)", evento, event.get("eventId"))


if __name__ == "__main__":
    app.run(debug=os.environ.get("FLASK_DEBUG") == "1")
