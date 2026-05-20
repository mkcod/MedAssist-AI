import sys
from pathlib import Path

# Ensure this file's own directory is on sys.path so the agent/ and tools/
# packages resolve correctly regardless of the Azure working directory.
_here = Path(__file__).resolve().parent
if str(_here) not in sys.path:
    sys.path.insert(0, str(_here))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from agent.publishing_agent import PublishingAgent

app = FastAPI()

# ✅ CORS (very important)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

agent = PublishingAgent(Path("prompts/agent_prompt.md"))

@app.post("/generate")
async def generate(payload: dict):
    return await agent.process(payload)

@app.post("/publish")
async def publish(payload: dict):
    payload["approvalStatus"] = "approved"
    return await agent.publish(payload)