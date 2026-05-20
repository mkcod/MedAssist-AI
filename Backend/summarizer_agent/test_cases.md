# Summarizer Agent E2E Test Cases

## Test Case 1 — Valid transcript with multiple symptoms
Scenario:
A valid conversation transcript is provided where the patient mentions multiple symptoms.

Expected:
- Symptoms should be extracted correctly from patient utterances
- System should generate a structured JSON output
- JSON must contain required keys

---

## Test Case 2 — Transcript with different symptom combinations
Scenario:
Patient describes multiple symptoms such as fever, headache, cough, or chest pain.

Expected:
- All relevant symptoms should be detected
- Summary should reflect detected symptoms
- JSON output must remain valid

---

## Test Case 3 — Transcript with negated symptoms
Scenario:
Patient mentions symptoms but negates some of them (e.g., "no fever").

Expected:
- Negated symptoms should be ignored
- Only valid symptoms should appear in output
- JSON output must remain valid

---

## Test Case 4 — Missing input file
Scenario:
System is executed with a file name that does not exist.

Expected:
- System should return an appropriate error message
- Application should not crash

---

## Test Case 5 — Empty input
Scenario:
User runs the system without providing a file name.

Expected:
- System should validate input
- Proper error message should be returned