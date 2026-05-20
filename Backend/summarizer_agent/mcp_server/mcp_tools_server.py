import os
import sys

from mcp.server.fastmcp import FastMCP

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from rag_pipeline import run_rag_pipeline

mcp = FastMCP("MedAssistTools")


@mcp.tool()
def clinical_summary_pipeline(transcript):
    return run_rag_pipeline(transcript)


if __name__ == "__main__":
    mcp.run(transport="stdio")