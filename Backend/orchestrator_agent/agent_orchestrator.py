"""
AgentOrchestrator — LLM-driven orchestration agent with retry + logging + Cosmos DB audit.
"""

import asyncio
import json
import os
import threading
import time
import openai
from openai import AzureOpenAI
from pathlib import Path

import logger as log
from audit_store import AuditSession

from tools.conv_tool import run_conversational_agent
from tools.summ_tool import run_summarizer_agent
from tools.pub_tool  import run_publishing_agent


def _emit_socket_log(stage: str, message: str, level: str = "info", job_id: str = None):
    """Emit a log event to the Node.js backend via HTTP POST."""
    try:
        import requests
        timestamp = datetime.now().isoformat()
        payload = {
            "job_id": job_id,
            "stage": stage,
            "message": message,
            "level": level,
            "timestamp": timestamp,
        }
        response = requests.post(
            "http://localhost:3000/api/orchestrator/log",
            json=payload,
            timeout=5,
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 200:
            return True
    except Exception:
        pass
    return False

from datetime import datetime

MAX_ATTEMPTS = 3
BACKOFF_BASE = 2

# Reasoning models (o1, o3, …) require:
#   • "developer" role instead of "system"
#   • tool_choice omitted (not supported)
_REASONING_MODEL_PREFIXES = ("o1", "o3", "o4")


def _is_reasoning_model(model_name: str) -> bool:
    name = (model_name or "").lower()
    return any(name.startswith(p) or f"-{p}" in name for p in _REASONING_MODEL_PREFIXES)


def _adapt_messages(messages: list, reasoning: bool) -> list:
    """Convert system→developer for reasoning models (no-op otherwise)."""
    if not reasoning:
        return messages
    adapted = []
    for m in messages:
        if m.get("role") == "system":
            adapted.append({**m, "role": "developer"})
        else:
            adapted.append(m)
    return adapted

SYSTEM_PROMPT = """
You are the MedAssist Orchestration Agent for a clinical conversation pipeline.

Your job is to coordinate three specialist agents in sequence to process a
doctor-patient conversation and produce a validated SOAP clinical record.

You have access to three tools:

1. run_conversational_agent
   - Records audio from the microphone
   - Diarizes speakers and classifies them as doctor or patient
   - Returns the annotated conversation JSON including a conversation_id and utterances list
   - Call this FIRST, always
   - If the returned utterances list is empty, do NOT call further tools — report that
     no conversation was captured and stop

2. run_summarizer_agent
   - Takes the conversation JSON from step 1
   - Uses RAG (Azure AI Search + LLM reasoning) to extract symptoms,
     possible condition, ICD-10 code and action plan
   - Returns a clinical summary dict
   - Call this SECOND, after run_conversational_agent succeeds with at least one utterance

3. run_publishing_agent
   - Takes the clinical summary from step 2
   - Runs guardrails, generates a SOAP record, validates and publishes it
   - Returns the final published SOAP record with a record_id
   - Call this THIRD, after run_summarizer_agent succeeds

Rules:
- Always call tools in order: conversational -> summarizer -> publishing
- Pass the full output of each tool as input to the next
- If a tool fails after all retries, stop the pipeline and report the failure clearly
- Never skip a step or call tools out of order
- After all three tools complete successfully, produce a structured summary containing:
  * conversation_id, number of utterances, detected symptoms
  * ICD-10 code, possible condition, SOAP record_id
  * overall pipeline status: success
"""

# Shorter, safety-first fallback prompt used if the primary prompt is rejected.
# This instructs the model to only perform tool orchestration and to avoid
# giving medical advice directly — outputs are for clinician review only.
SANITIZED_SYSTEM_PROMPT = (
    "You are an orchestration agent. Coordinate the three tools in order: "
    "conversational, summarizer, publishing. Do NOT provide medical advice or "
    "diagnoses. All outputs are for clinician review and require human "
    "verification. Use the provided tools only to produce structured, "
    "non-actionable summaries and metadata."
)

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "run_conversational_agent",
            "description": (
                "Records audio from the microphone, diarizes speakers, "
                "classifies them as doctor or patient using Azure Speech SDK "
                "and Azure OpenAI. Returns annotated conversation JSON. "
                "Must be called first."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "run_summarizer_agent",
            "description": (
                "Uses RAG pipeline (Azure AI Search + LLM) to extract clinical "
                "symptoms, possible condition, ICD-10 code, action plan and "
                "clinical summary from the conversation JSON. "
                "Must be called after run_conversational_agent."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "conv_output": {
                        "type": "object",
                        "description": "The conversation JSON returned by run_conversational_agent"
                    }
                },
                "required": ["conv_output"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "run_publishing_agent",
            "description": (
                "Runs guardrails, generates a validated SOAP clinical record, "
                "and publishes it to the EHR store. Must be called after "
                "run_summarizer_agent."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "summary": {
                        "type": "object",
                        "description": "The clinical summary dict returned by run_summarizer_agent"
                    },
                    "conv_output": {
                        "type": "object",
                        "description": "The original conversation JSON from run_conversational_agent"
                    }
                },
                "required": ["summary", "conv_output"]
            }
        }
    }
]


class AgentOrchestrator:

    def __init__(self, stop_event: threading.Event, session_meta: dict = None, job_id: str = None):
        self.job_id = job_id
        self.stop_event   = stop_event
        self.client       = AzureOpenAI(
            api_key=os.environ["AZURE_OPENAI_API_KEY"],
            azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
            azure_deployment=os.environ["ORCHESTRATION_DEPLOYMENT_NAME"],
            api_version="2024-12-01-preview",
        )
        self.model        = os.environ["ORCHESTRATION_DEPLOYMENT_NAME"]
        self._reasoning   = _is_reasoning_model(self.model)
        if self._reasoning:
            log.agent(f"Reasoning model detected ({self.model}) — using 'developer' role, omitting tool_choice", stage="init")
        self.messages     = [{"role": "system", "content": SYSTEM_PROMPT}]
        self._conv_output = None
        self._summary     = None
        self._partial     = {}
        self._audit: AuditSession | None = None
        self._session_meta = session_meta or {}

    # ── Retry wrapper ─────────────────────────────────────────────────────────
    async def _with_retry(self, tool_name: str, coro_fn, *args, **kwargs):
        last_err = None
        for attempt in range(1, MAX_ATTEMPTS + 1):
            t_start = time.time()
            try:
                log.tool(tool_name, f"attempt {attempt}/{MAX_ATTEMPTS}", stage=tool_name)
                result = await coro_fn(*args, **kwargs)
                if attempt > 1:
                    log.retry_ok(tool_name, attempt)
                return result, attempt, round(time.time() - t_start, 3)
            except Exception as e:
                last_err = e
                if attempt < MAX_ATTEMPTS:
                    wait = BACKOFF_BASE ** attempt
                    log.retry(tool_name, attempt, MAX_ATTEMPTS, str(e))
                    log.retry_wait(tool_name, wait)
                    await asyncio.sleep(wait)
                else:
                    log.retry_exhausted(tool_name, str(e))
        raise last_err

    # ── Partial save ──────────────────────────────────────────────────────────
    def _save_partial(self):
        out = Path(__file__).parent / "partial_output.json"
        out.write_text(json.dumps({
            "saved_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "completed_steps": list(self._partial.keys()),
            "data": self._partial
        }, indent=2), encoding="utf-8")
        log.partial_save(str(out), stage="partial")

    # ── Tool dispatcher ───────────────────────────────────────────────────────
    async def _dispatch_tool(self, tool_name: str, tool_args: dict) -> str:
        print(f"\n[Agent] Calling tool: {tool_name}")
        log.agent(f"Dispatching tool: {tool_name}", stage=tool_name)

        if tool_name == "run_conversational_agent":
            async def _call():
                return await run_conversational_agent(self.stop_event)

            result, attempt, duration = await self._with_retry(tool_name, _call)
            self._conv_output = result

            metadata = {
                "conversation_id": result.get("conversation_id"),
                "utterance_count": len(result.get("utterances", [])),
                "speakers":        list({u["speaker_id"] for u in result.get("utterances", [])}),
                "roles":           list({u.get("speaker") for u in result.get("utterances", [])
                                         if u.get("speaker")}),
            }
            self._partial["conversational_agent"] = metadata

            # ── Audit log ─────────────────────────────────────────────────
            if self._audit:
                self._audit.log_step(
                    tool_name="run_conversational_agent",
                    mcp_server="conversational",
                    status="success",
                    metadata=metadata,
                    duration_sec=duration,
                    attempt=attempt,
                )

            log.tool(tool_name, (
                f"complete | conversation_id: {metadata['conversation_id']} | "
                f"utterances: {metadata['utterance_count']} | "
                f"speakers: {metadata['speakers']} | roles: {metadata['roles']}"
            ), stage=tool_name)
            log.agent(f"Conversational agent completed — awaiting next LLM decision", stage=tool_name)
            return json.dumps({"status": "success", **metadata})

        elif tool_name == "run_summarizer_agent":
            conv_output = tool_args.get("conv_output") or self._conv_output
            if not conv_output:
                raise RuntimeError("conv_output missing — run_conversational_agent first")

            async def _call():
                return await run_summarizer_agent(conv_output)

            result, attempt, duration = await self._with_retry(tool_name, _call)
            self._summary = result

            metadata = {
                "symptom_count":      len(result.get("symptoms", [])),
                "symptoms":           result.get("symptoms", [])[:5],
                "possible_condition": result.get("possible_condition"),
                "icd10_code":         result.get("icd10_code"),
                "diagnosis_status":   result.get("diagnosis_status", "confident"),
                "action_plan":        result.get("action_plan", []),
            }
            self._partial["summarizer_agent"] = metadata

            # ── Audit log ─────────────────────────────────────────────────
            if self._audit:
                self._audit.log_step(
                    tool_name="run_summarizer_agent",
                    mcp_server="summarizer",
                    status="success",
                    metadata=metadata,
                    duration_sec=duration,
                    attempt=attempt,
                )
                self._audit.set_summary_metadata({
                    "utterance_count":   self._partial.get("conversational_agent", {}).get("utterance_count"),
                    "speakers":          self._partial.get("conversational_agent", {}).get("speakers"),
                    "roles":             self._partial.get("conversational_agent", {}).get("roles"),
                    "symptoms":          result.get("symptoms", []),
                    "possible_condition":result.get("possible_condition"),
                    "icd10_code":        result.get("icd10_code"),
                    "action_plan":       result.get("action_plan", []),
                    "diagnosis_status":  result.get("diagnosis_status", "confident"),
                })

            log.tool(tool_name, (
                f"complete | symptoms: {metadata['symptom_count']} | "
                f"condition: {metadata['possible_condition']} | "
                f"ICD10: {metadata['icd10_code']} | "
                f"status: {metadata['diagnosis_status']}"
            ), stage=tool_name)
            log.agent(f"Summarizer agent completed — awaiting next LLM decision", stage=tool_name)
            return json.dumps({"status": "success", **metadata})

        elif tool_name == "run_publishing_agent":
            summary     = self._summary
            conv_output = self._conv_output
            if not summary or not conv_output:
                raise RuntimeError("summary or conv_output missing")

            async def _call():
                return await run_publishing_agent(summary, conv_output)

            result, attempt, duration = await self._with_retry(tool_name, _call)

            soap = result["soap_record"]
            metadata = {
                "record_id":        result.get("record_id") or soap.get("recordId") or soap.get("record_id"),
                "confidence_score": soap.get("confidenceScore") or soap.get("confidence_score"),
                "approval_status":  soap.get("approvalStatus") or soap.get("approval_status"),
                "saved_to":         result["publish_result"].get("path"),
                "timestamp":        soap.get("timestamp"),
            }
            self._partial["publishing_agent"] = metadata

            # ── Audit log ─────────────────────────────────────────────────
            if self._audit:
                self._audit.log_step(
                    tool_name="run_publishing_agent",
                    mcp_server="publisher",
                    status="success",
                    metadata=metadata,
                    duration_sec=duration,
                    attempt=attempt,
                )
                self._audit.set_soap_metadata({
                    "record_id":        metadata["record_id"],
                    "confidence_score": metadata["confidence_score"],
                    "approval_status":  metadata["approval_status"],
                    "published_path":   metadata["saved_to"],
                    "timestamp":        metadata["timestamp"],
                })

            log.tool(tool_name, (
                f"complete | record_id: {metadata['record_id']} | "
                f"confidence: {metadata['confidence_score']} | "
                f"approval: {metadata['approval_status']} | "
                f"saved_to: {metadata['saved_to']}"
            ), stage=tool_name)
            log.agent(f"Publishing agent completed", stage=tool_name)
            return json.dumps({"status": "success", **metadata})

        else:
            raise ValueError(f"Unknown tool: {tool_name}")

    # ── Agentic loop ──────────────────────────────────────────────────────────
    async def run(self, session_id: str = None) -> str:

        # ── Create audit session in Cosmos DB ─────────────────────────────
        sid = session_id or f"session-{int(time.time())}"
        try:
            self._audit = AuditSession(session_id=sid, meta=self._session_meta)
            log.agent(f"Audit session created | session_id: {sid}", stage="init")
        except Exception as e:
            log.agent(f"Audit store unavailable — continuing without audit | {e}")
            self._audit = None

        self.messages.append({
            "role": "user",
            "content": (
                "Please process the clinical conversation. "
                "Start by recording the doctor-patient conversation, "
                "then summarise it, then publish the SOAP record."
            )
        })

        log.agent("Agentic loop started", stage="init")
        print("\n[Agent] Orchestration agent started — beginning agentic loop\n")

        try:
            while True:
                try:
                    call_kwargs = dict(
                        model=self.model,
                        messages=_adapt_messages(self.messages, self._reasoning),
                        tools=TOOLS,
                    )
                    if not self._reasoning:
                        call_kwargs["tool_choice"] = "auto"
                    response = self.client.chat.completions.create(**call_kwargs)
                except openai.BadRequestError as e:
                    err_str = str(e)
                    log.error(f"Orchestration failed — BadRequestError: {err_str}")

                    # If the error indicates the prompt was flagged, retry once
                    # with a sanitized, safety-first system prompt.
                    if "invalid_prompt" in err_str or "Invalid prompt" in err_str:
                        log.agent("Invalid prompt detected — attempting sanitized retry")

                        # Build sanitized messages replacing the system prompt only
                        sanitized_messages = []
                        for m in self.messages:
                            if m.get("role") == "system":
                                sanitized_messages.append({"role": "system", "content": SANITIZED_SYSTEM_PROMPT})
                            else:
                                sanitized_messages.append(m)

                        try:
                            retry_kwargs = dict(
                                model=self.model,
                                messages=_adapt_messages(sanitized_messages, self._reasoning),
                                tools=TOOLS,
                            )
                            if not self._reasoning:
                                retry_kwargs["tool_choice"] = "auto"
                            response = self.client.chat.completions.create(**retry_kwargs)
                            # Replace messages with sanitized_messages so conversation continues
                            self.messages = sanitized_messages
                            log.agent("Sanitized retry succeeded")
                        except Exception as e2:
                            log.error(f"Sanitized retry failed — {e2}")
                            raise
                    else:
                        raise

                msg = response.choices[0].message

                # ── Log LLM response received ───────────────────────────────────
                log.agent(f"LLM response received | role: {msg.role} | has_tool_calls: {bool(msg.tool_calls)}", stage="llm_response")
                print(f"[Agent] LLM response received — role: {msg.role}")

                self.messages.append({
                    "role":    "assistant",
                    "content": msg.content,
                    "tool_calls": [
                        {
                            "id":   tc.id,
                            "type": "function",
                            "function": {
                                "name":      tc.function.name,
                                "arguments": tc.function.arguments,
                            }
                        }
                        for tc in (msg.tool_calls or [])
                    ] or None
                })

                if not msg.tool_calls:
                    log.agent("Agentic loop complete — final response received", stage="complete")
                    if self._audit:
                        self._audit.complete()
                    print("\n[Agent] Final response from orchestration agent:")
                    print("─" * 60)
                    print(msg.content)
                    print("─" * 60)
                    return msg.content

                for tc in msg.tool_calls:
                    tool_name = tc.function.name
                    tool_args = json.loads(tc.function.arguments or "{}")

                    try:
                        tool_result = await self._dispatch_tool(tool_name, tool_args)
                        log.agent(f"Tool {tool_name} dispatched and completed")
                        print(f"[Agent] {tool_name} completed successfully")
                    except Exception as e:
                        log.error(f"{tool_name} failed after all retries | {e}", stage=tool_name)
                        self._save_partial()

                        # ── Audit: log failed step ─────────────────────────
                        if self._audit:
                            self._audit.log_step(
                                tool_name=tool_name,
                                mcp_server="unknown",
                                status="error",
                                error=str(e),
                            )
                            self._audit.fail(
                                error=str(e),
                                failed_at_tool=tool_name,
                            )

                        tool_result = json.dumps({"status": "error", "error": str(e)})
                        _emit_socket_log("error", f"{tool_name} failed: {e}", level="error")
                        print(f"[Agent] {tool_name} failed: {e}")

                    self.messages.append({
                        "role":         "tool",
                        "tool_call_id": tc.id,
                        "content":      tool_result,
                    })

        except Exception as e:
            if self._audit:
                self._audit.fail(error=str(e))
            _emit_socket_log("error", f"Orchestration failed: {e}", level="error")
            raise
