from tools.soap_tool import build_demo_soap


def test_pipeline_success():
    result = build_demo_soap({
        "symptoms": ["fatigue"],
        "possible_condition": "Postviral and related fatigue syndromes",
        "icd10_code": "G93.30",
        "action_plan": [
            "Take rest",
            "Drink fluids",
            "Monitor symptoms",
            "Consult a healthcare professional if symptoms worsen"
        ],
        "clinical_summary": "Patient reports fatigue which may indicate Postviral and related fatigue syndromes."
    })
    assert result["plan"].splitlines() == [
        "1. Take rest",
        "2. Drink fluids",
        "3. Monitor symptoms",
        "4. Consult a healthcare professional if symptoms worsen",
    ]