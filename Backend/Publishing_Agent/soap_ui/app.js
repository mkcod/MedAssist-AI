let soap = null;

async function generateSOAP() {

  const payload = {
    symptoms: ["fatigue"],
    possible_condition: "Postviral and related fatigue syndromes",
    icd10_code: "G93.30",
    action_plan: [
      "Take rest",
      "Drink fluids",
      "Monitor symptoms",
      "Consult a healthcare professional if symptoms worsen"
    ],
    clinical_summary: "Patient reports fatigue which may indicate Postviral and related fatigue syndromes."
  };

  const res = await fetch("http://localhost:8000/generate", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  soap = data.data;

  renderSOAP();
}

function renderSOAP() {
  const doc = document.getElementById("doc");

  doc.classList.remove("hidden");

  doc.innerHTML = `
    <h3>SOAP Document</h3>

    ${section("Subjective", "sub", soap.subjective)}
    ${section("Objective", "obj", soap.objective)}
    ${section("Assessment", "ass", soap.assessment)}
    ${section("Plan", "plan", soap.plan)}
  `;

  document.getElementById("actions").classList.remove("hidden");
}

function section(title, id, value) {
  return `
    <div class="section">
      <b>${title}</b>
      <textarea id="${id}">${value}</textarea>
    </div>
  `;
}

async function approve() {

  soap.subjective = document.getElementById("sub").value;
  soap.objective = document.getElementById("obj").value;
  soap.assessment = document.getElementById("ass").value;
  soap.plan = document.getElementById("plan").value;

  soap.approvalStatus = "approved";

  const res = await fetch("http://localhost:8000/publish", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(soap)
  });

  const result = await res.json();

  alert("Saved to DB ✔");
}

function decline() {
  alert("Declined");
}