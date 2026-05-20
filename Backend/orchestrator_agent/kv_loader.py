"""
kv_loader.py — Key Vault secret loader for all MediAssist-AI Python agents.

Usage (add to the top of any agent entrypoint, after dotenv load):
    from kv_loader import load_secrets_from_keyvault
    load_secrets_from_keyvault()

On Azure App Service: uses Managed Identity automatically (no credentials needed).
Locally: set AZURE_KEY_VAULT_URI + AZURE_TENANT_ID + AZURE_CLIENT_ID +
         AZURE_CLIENT_SECRET in your .env file.

Secret resolution order:
  1. If env var is already set (e.g. from .env), keep it — KV does not override.
  2. Fetch from Key Vault and inject into os.environ.
  3. If KV is unreachable, log a warning and continue (for local dev without KV access).
"""

from __future__ import annotations
import os
import logging

log = logging.getLogger(__name__)

# Maps Azure Key Vault secret names (hyphenated) to os.environ keys (underscored).
# A single KV secret can populate multiple env vars (e.g. one Cosmos URI → 3 vars).
_KV_TO_ENV: dict[str, list[str]] = {
    "AZURE-OPENAI-API-KEY": [
        "AZURE_OPENAI_API_KEY",
        "OPENAI_KEY",
        "OPENAI_API_KEY",
    ],
    "SPEECH-KEY": [
        "SPEECH_KEY",
    ],
    "AZURE-SEARCH-ADMIN-KEY": [
        "AZURE_SEARCH_ADMIN_KEY",
    ],
    "AZURE-STORAGE-CONNECTION-STRING": [
        "AZURE_STORAGE_CONNECTION_STRING",
    ],
    "COSMOS-DB-CONNECTION-STRING": [
        "MONGO_URI",
        "COSMOS_MONGO_URI",
        "COSMOS_AUDIT_URI",
    ],
    "INTERNAL-API-SECRET": [
        "INTERNAL_API_SECRET",
    ],
    "JWT-SECRET": [
        "JWT_SECRET",
    ],
    "WEBAPP-NAME": [
        "WEBAPP_NAME",
    ],
    "RESOURCE-GROUP-NAME": [
        "RESOURCE_GROUP_NAME",
    ],
}


def load_secrets_from_keyvault(vault_uri: str | None = None) -> None:
    """
    Fetch secrets from Azure Key Vault and inject them into os.environ.

    Parameters
    ----------
    vault_uri : str, optional
        Key Vault URI.  Falls back to AZURE_KEY_VAULT_URI env var.
    """
    vault_uri = vault_uri or os.environ.get("AZURE_KEY_VAULT_URI")
    if not vault_uri:
        log.warning(
            "[kv_loader] AZURE_KEY_VAULT_URI not set — "
            "secrets must be present in .env file for local dev."
        )
        return

    try:
        from azure.identity import DefaultAzureCredential
        from azure.keyvault.secrets import SecretClient
    except ImportError:
        log.warning(
            "[kv_loader] azure-keyvault-secrets / azure-identity not installed. "
            "Run: pip install azure-keyvault-secrets azure-identity"
        )
        return

    try:
        credential = DefaultAzureCredential()
        client = SecretClient(vault_url=vault_uri, credential=credential)
        log.info(f"[kv_loader] Loading secrets from Key Vault: {vault_uri}")

        for secret_name, env_vars in _KV_TO_ENV.items():
            # Check if ALL target env vars are already set — skip if so
            if all(os.environ.get(v) for v in env_vars):
                continue
            try:
                value = client.get_secret(secret_name).value
                if value:
                    for env_var in env_vars:
                        if not os.environ.get(env_var):   # don't override existing
                            os.environ[env_var] = value
                            log.debug(f"[kv_loader]   KV:{secret_name} → {env_var}")
            except Exception as secret_err:
                log.warning(
                    f"[kv_loader] Could not load KV secret '{secret_name}': {secret_err}"
                )

        log.info("[kv_loader] Key Vault secrets loaded successfully.")

    except Exception as auth_err:
        log.warning(
            f"[kv_loader] Could not authenticate to Key Vault ({auth_err}). "
            "Falling back to .env file values. "
            "For local dev, ensure AZURE_TENANT_ID, AZURE_CLIENT_ID, "
            "and AZURE_CLIENT_SECRET are set in your .env file."
        )
