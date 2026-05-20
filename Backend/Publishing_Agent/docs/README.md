# MedAssist Agentic Publishing Agent - MAF Lite

## What this version does
- Uses a real Microsoft Agent Framework style setup in `publishing_agent.py` when Azure config and `agent-framework` are available.
- Keeps your existing modules but upgrades the orchestrator to create an agent with `AzureOpenAIResponsesClient` and `create_agent(...)`.
- Runs in terminal mode.
- Publishes approved records locally into `published_records/`.
- Keeps Cosmos optional and disabled by default.

## Install
```bash
pip install -r requirements.txt
```

## .env
```env
AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com/
AZURE_OPENAI_API_KEY=your_key
AZURE_OPENAI_API_VERSION=2024-10-21
AZURE_OPENAI_DEPLOYMENT=gpt-4o
USE_COSMOS=false
EHR_OUTPUT_DIR=./published_records
```

## Run
```bash
python main.py
```

## Notes
If Azure credentials are missing, the app falls back to demo-local generation but preserves the same tool-driven flow.
