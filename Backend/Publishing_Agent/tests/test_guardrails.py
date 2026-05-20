import json
from tools.guardrails_tool import guardrails_check

def test_guardrails_blocks_prescribe():
    res = json.loads(guardrails_check('{"text":"Please prescribe antibiotics"}'))
    assert res["status"] == "blocked"
