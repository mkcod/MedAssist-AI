# """
# Shared logger — writes to both terminal and pipeline.log with timestamps.
# Logs metadata only, never full JSON payloads.
# """

# import logging
# import sys
# from datetime import datetime
# from pathlib import Path

# LOG_FILE = Path(__file__).parent / "pipeline.log"

# # ── Formatter ─────────────────────────────────────────────────────────────────
# class _MetaFormatter(logging.Formatter):
#     def formatTime(self, record, datefmt=None):
#         return datetime.fromtimestamp(record.created).strftime("%Y-%m-%d %H:%M:%S")

#     def format(self, record):
#         return f"[{self.formatTime(record)}] {record.getMessage()}"


# # ── Build logger ──────────────────────────────────────────────────────────────
# def _build_logger() -> logging.Logger:
#     logger = logging.getLogger("medassist.pipeline")
#     logger.setLevel(logging.DEBUG)

#     if logger.handlers:
#         return logger

#     fmt = _MetaFormatter()

#     # Terminal handler
#     ch = logging.StreamHandler(sys.stdout)
#     ch.setFormatter(fmt)
#     ch.setLevel(logging.DEBUG)
#     logger.addHandler(ch)

#     # File handler
#     fh = logging.FileHandler(str(LOG_FILE), encoding="utf-8")
#     fh.setFormatter(fmt)
#     fh.setLevel(logging.DEBUG)
#     logger.addHandler(fh)

#     return logger


# log = _build_logger()


# # ── Public helpers ────────────────────────────────────────────────────────────
# def step(step_num: int, msg: str):
#     log.info(f"[STEP {step_num}] {msg}")

# def pipeline(msg: str):
#     log.info(f"[PIPELINE] {msg}")

# def warn(step_num: int, msg: str):
#     log.warning(f"[STEP {step_num}] ⚠  {msg}")

# def error(step_num: int, msg: str):
#     log.error(f"[STEP {step_num}] ❌ {msg}")

# def retry_attempt(step_num: int, tool: str, attempt: int, max_attempts: int, err: str):
#     log.warning(
#         f"[STEP {step_num}] {tool} → attempt {attempt}/{max_attempts} failed | {err}"
#     )

# def retry_success(step_num: int, tool: str, attempt: int):
#     log.info(f"[STEP {step_num}] {tool} → succeeded on attempt {attempt}")

# def retry_exhausted(step_num: int, tool: str, err: str):
#     log.error(f"[STEP {step_num}] {tool} → FAILED after all attempts | {err}")


"""
Shared logger for the agentic orchestrator.
Writes timestamped metadata to both terminal and agent_pipeline.log.
Also emits socket events to Node.js backend for real-time frontend display.
Forwards all log records to Azure Application Insights / Log Analytics via
azure-monitor-opentelemetry when APPLICATIONINSIGHTS_CONNECTION_STRING is set.
"""

import logging
import sys
import os
from datetime import datetime
from pathlib import Path

LOG_FILE = Path(__file__).parent / "agent_pipeline.log"

# Node.js backend URL for emitting socket log events
NODEJS_BACKEND_URL = os.environ.get("NODEJS_BACKEND_URL", "http://localhost:3000/api")

# ── Azure Monitor setup ───────────────────────────────────────────────────────
# configure_azure_monitor() auto-instruments the Python logging module so every
# logger.info/warning/error call is forwarded to Application Insights and then
# to the linked Log Analytics workspace (traces / exceptions tables in KQL).
# This is a no-op when the connection string env var is not present (local dev).
def _configure_azure_monitor() -> bool:
    conn_str = os.environ.get("APPLICATIONINSIGHTS_CONNECTION_STRING")
    if not conn_str:
        return False
    try:
        from azure.monitor.opentelemetry import configure_azure_monitor
        configure_azure_monitor(
            connection_string=conn_str,
            logger_name="medassist",   # captures all loggers under "medassist.*"
        )
        return True
    except Exception as exc:   # package not installed or transient error
        print(f"[logger] Azure Monitor init skipped: {exc}", file=sys.stderr)
        return False

_azure_monitor_ready = _configure_azure_monitor()


def _emit_socket_log(stage: str, message: str, level: str = "info"):
    """Emit a log event to the Node.js backend via HTTP POST."""
    try:
        import requests
        timestamp = datetime.now().isoformat()
        payload = {
            "job_id": None,  # Will be set by caller if needed
            "stage": stage,
            "message": message,
            "level": level,
            "timestamp": timestamp,
        }
        response = requests.post(
            f"{NODEJS_BACKEND_URL}/orchestrator/log",
            json=payload,
            timeout=5,
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 200:
            return True
    except Exception as e:
        # Silently fail - don't block logging if backend is unavailable
        pass
    return False


class _MetaFormatter(logging.Formatter):
    def formatTime(self, record, datefmt=None):
        return datetime.fromtimestamp(record.created).strftime("%Y-%m-%d %H:%M:%S")

    def format(self, record):
        return f"[{self.formatTime(record)}] {record.getMessage()}"


def _build_logger() -> logging.Logger:
    logger = logging.getLogger("medassist.agent_orchestrator")
    if logger.handlers:
        return logger
    logger.setLevel(logging.DEBUG)

    fmt = _MetaFormatter()

    ch = logging.StreamHandler(sys.stdout)
    ch.setFormatter(fmt)
    # Force UTF-8 on Windows where the default console encoding (cp1252) cannot
    # encode emoji characters used in log messages (e.g. ⏳, ❌, ✅).
    if hasattr(ch.stream, 'reconfigure'):
        try:
            ch.stream.reconfigure(encoding='utf-8', errors='replace')
        except Exception:
            pass
    logger.addHandler(ch)

    fh = logging.FileHandler(str(LOG_FILE), encoding="utf-8")
    fh.setFormatter(fmt)
    logger.addHandler(fh)

    return logger


log = _build_logger()


# ── Public helpers ────────────────────────────────────────────────────────────
def agent(msg: str, stage: str = None):
    log.info(f"[AGENT] {msg}")
    _emit_socket_log(stage or "agent", msg)

def tool(tool_name: str, msg: str, stage: str = None):
    log.info(f"[TOOL:{tool_name}] {msg}")
    _emit_socket_log(stage or tool_name, msg)

def retry(tool_name: str, attempt: int, max_attempts: int, err: str, stage: str = None):
    log.warning(f"[RETRY:{tool_name}] attempt {attempt}/{max_attempts} failed | {err}")
    _emit_socket_log(stage or "retry", f"{tool_name} retry: {err}")

def retry_wait(tool_name: str, wait: int, stage: str = None):
    log.warning(f"[RETRY:{tool_name}] retrying in {wait}s...")
    _emit_socket_log(stage or "retry", f"Waiting {wait}s before retry")

def retry_ok(tool_name: str, attempt: int, stage: str = None):
    log.info(f"[RETRY:{tool_name}] succeeded on attempt {attempt}")
    _emit_socket_log(stage or "retry", f"{tool_name} succeeded on attempt {attempt}")

def retry_exhausted(tool_name: str, err: str, stage: str = None):
    log.error(f"[RETRY:{tool_name}] FAILED after all attempts | {err}")
    _emit_socket_log(stage or "error", f"{tool_name} failed: {err}", level="error")

def error(msg: str, stage: str = None):
    log.error(f"[ERROR] {msg}")
    _emit_socket_log(stage or "error", msg, level="error")

def pipeline(msg: str, stage: str = None):
    log.info(f"[PIPELINE] {msg}")
    _emit_socket_log(stage or "pipeline", msg)

def partial_save(path: str, stage: str = None):
    log.warning(f"[PIPELINE] Partial output saved → {path}")
    _emit_socket_log(stage or "partial", f"Partial output saved to {path}")
