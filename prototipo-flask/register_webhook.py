"""Registra (ou atualiza) o webhook do Rastro na Pluggy. Rode uma vez:

    python register_webhook.py https://SEU-DOMINIO/api/webhooks/pluggy

A Pluggy não assina os webhooks; por isso enviamos um header Authorization secreto,
que o app.py confere em toda requisição. A URL precisa ser HTTPS (localhost não é aceito;
para testar no seu PC, use um túnel como o ngrok).
"""
import os
import sys

import pluggy_sdk
from dotenv import load_dotenv

load_dotenv()

from pluggy_client import get_api_client  # noqa: E402

EVENTOS = [
    "item/created",
    "item/updated",
    "item/error",
    "transactions/created",
    "transactions/updated",
    "transactions/deleted",
]


def main() -> None:
    if len(sys.argv) != 2 or not sys.argv[1].startswith("https://"):
        sys.exit("Uso: python register_webhook.py https://seu-dominio/api/webhooks/pluggy")
    url = sys.argv[1]

    secret = os.environ.get("PLUGGY_WEBHOOK_SECRET")
    if not secret:
        sys.exit("Defina PLUGGY_WEBHOOK_SECRET no .env antes (veja o .env.example).")
    headers = {"Authorization": f"Bearer {secret}"}

    with get_api_client() as client:
        api = pluggy_sdk.WebhookApi(client)
        existentes = {
            (getattr(w.event, "value", w.event), w.url): w for w in (api.webhooks_list().results or [])
        }

        for evento in EVENTOS:
            atual = existentes.get((evento, url))
            if atual:
                api.webhooks_update(atual.id, pluggy_sdk.UpdateWebhook(url=url, event=evento, headers=headers))
                print(f"atualizado: {evento}")
            else:
                api.webhooks_create(pluggy_sdk.CreateWebhook(url=url, event=evento, headers=headers))
                print(f"criado:     {evento}")


if __name__ == "__main__":
    main()
