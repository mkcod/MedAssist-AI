import json
from agent import run_agent

print("Manual error tests:")
print("1. Run main.py and give blank input")
print("2. Run main.py and give missing file name")
print("Expected: graceful JSON error output")