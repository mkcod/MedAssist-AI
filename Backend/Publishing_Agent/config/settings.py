import os
import shlex
import sys
from dataclasses import dataclass, field
from dotenv import load_dotenv

load_dotenv(override=False)  # bootstrap only; real secrets come from Key Vault

try:
    from kv_loader import load_secrets_from_keyvault as _load_kv
    _load_kv()
except Exception:
    pass  # KV unavailable locally without credentials — .env fallback used

def _default_mcp_command() -> str:
    return os.getenv("MCP_COMMAND", sys.executable)

def _default_mcp_args() -> list[str]:
    raw = os.getenv("MCP_ARGS", "").strip()
    if not raw:
        return ["-m", "mcp_server.mcp_tools_server"]

    # Backward-compat: convert script path to module launch
    if raw.endswith(".py") and ("/" in raw or "\\" in raw):
        module = raw.replace("\\", ".").replace("/", ".")
        module = module[:-3]  # drop .py
        return ["-m", module]

    return shlex.split(raw)

@dataclass
class Settings:
    azure_openai_endpoint: str = os.getenv("AZURE_OPENAI_ENDPOINT", "")
    azure_openai_api_key: str = os.getenv("AZURE_OPENAI_API_KEY", "")
    azure_openai_api_version: str = os.getenv("AZURE_OPENAI_API_VERSION", "2024-06-01")
    azure_openai_deployment: str = os.getenv("AZURE_OPENAI_DEPLOYMENT", "")

    mcp_command: str = field(default_factory=_default_mcp_command)
    mcp_args: list[str] = field(default_factory=_default_mcp_args)

    @property
    def mcp_args_raw(self):
        return " ".join(self.mcp_args)

    @property
    def azure_openai_configured(self):
        return bool(
            self.azure_openai_endpoint
            and self.azure_openai_api_key
            and self.azure_openai_deployment
        )

settings = Settings()