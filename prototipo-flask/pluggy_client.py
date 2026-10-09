"""Cliente da Pluggy para o Rastro.

As credenciais vêm SOMENTE de variáveis de ambiente (arquivo .env no servidor).
Nunca envie PLUGGY_CLIENT_ID / PLUGGY_CLIENT_SECRET para o navegador.
"""
import os
import threading
import time

import pluggy_sdk

# A API Key da Pluggy vale ~2h. Renovamos com folga para não falhar no meio de uma chamada.
_API_KEY_TTL_SECONDS = 100 * 60

_lock = threading.Lock()
_cached_api_key: str | None = None
_cached_at: float = 0.0


def _require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Variável de ambiente {name} não definida. Configure-a no arquivo .env.")
    return value


def _get_api_key() -> str:
    """Troca client_id + client_secret por uma API Key, com cache em memória."""
    global _cached_api_key, _cached_at
    with _lock:
        if _cached_api_key and time.time() - _cached_at < _API_KEY_TTL_SECONDS:
            return _cached_api_key

        with pluggy_sdk.ApiClient(pluggy_sdk.Configuration()) as client:
            response = pluggy_sdk.AuthApi(client).auth_create(
                pluggy_sdk.AuthRequest(
                    clientId=_require_env("PLUGGY_CLIENT_ID"),
                    clientSecret=_require_env("PLUGGY_CLIENT_SECRET"),
                )
            )
        _cached_api_key = response.api_key
        _cached_at = time.time()
        return _cached_api_key


def get_api_client() -> pluggy_sdk.ApiClient:
    """ApiClient autenticado, para usar com AccountApi, TransactionApi etc."""
    config = pluggy_sdk.Configuration(api_key={"default": _get_api_key()})
    return pluggy_sdk.ApiClient(config)


def retrieve_item(item_id: str) -> pluggy_sdk.Item:
    """Busca o item na Pluggy. Lança ApiException (404) se ele não pertencer à sua aplicação."""
    with get_api_client() as client:
        return pluggy_sdk.ItemsApi(client).items_retrieve(item_id)


def create_connect_token(client_user_id: str, webhook_url: str | None = None) -> str:
    """Cria um Connect Token (curta duração) para o frontend abrir o Pluggy Connect."""
    request = pluggy_sdk.ConnectTokenRequest(
        options=pluggy_sdk.ItemOptions(
            clientUserId=client_user_id,
            webhookUrl=webhook_url,
            avoidDuplicates=True,
        )
    )
    with get_api_client() as client:
        response = pluggy_sdk.AuthApi(client).connect_token_create(request)
    return response.access_token
