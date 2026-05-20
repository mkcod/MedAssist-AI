import asyncio
import os
from dotenv import load_dotenv

from agent_framework import Agent
from agent_framework.openai import OpenAIChatClient

from maf_agent.instructions import SYSTEM_INSTRUCTIONS
from maf_agent.tool_registry import get_tools

load_dotenv()

ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT")

print("Loaded endpoint:", ENDPOINT)
print("Loaded deployment:", DEPLOYMENT)
print("API key loaded:", bool(API_KEY))


def create_agent():
    client = OpenAIChatClient(
        model=DEPLOYMENT,
        base_url=ENDPOINT,
        api_key=API_KEY
    )

    agent = Agent(
        client,
        name="ClinicalSymptomSummarizer",
        instructions=SYSTEM_INSTRUCTIONS,
        tools=get_tools()
    )

    return agent


async def run_agent(user_input: str):
    agent = create_agent()
    response = await agent.run(user_input)
    return response


if __name__ == "__main__":
    conversation = """
    Patient: I have fever and headache since yesterday.
    Doctor: Do you have cough?
    Patient: Yes mild cough.
    """

    result = asyncio.run(run_agent(conversation))
    print(result)