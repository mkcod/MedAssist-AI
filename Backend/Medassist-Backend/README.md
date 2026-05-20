# MedAssist Backend — Node.js + Express + Azure

## Quick Start

```bash
cp .env.example .env   # fill in your Azure values
npm install
npm run seed           # seed demo data
npm run dev            # start dev server on :5000
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login |
| GET  | /api/auth/me | Get current user |
| GET  | /api/dashboard | Role-based dashboard stats |
| GET  | /api/appointments | List appointments |
| POST | /api/appointments | Book appointment |
| PATCH| /api/appointments/:id/status | Update status |
| GET  | /api/records | List medical records |
| POST | /api/records | Create record (with file upload) |
| GET  | /api/records/:id/download | Get SAS download URL |
| GET  | /api/medications | List medications |
| PATCH| /api/medications/:id/taken | Mark dose taken |
| GET  | /api/vitals | List vitals |
| POST | /api/vitals | Add vitals reading |
| GET  | /api/vitals/latest | Latest vitals |
| GET  | /api/vitals/chart | Chart-formatted data |
| GET  | /api/users/doctors | List doctors |
| GET  | /api/users/patients | List patients |
| PATCH| /api/users/me/profile | Update profile |
| POST | /api/chat/message | Send AI chat message |
| GET  | /api/chat/history | Chat history |

## Azure Services Used

- **Azure Cosmos DB (MongoDB API)** — primary database
- **Azure Blob Storage** — medical file attachments
- **Azure Key Vault** — secrets management
- **Azure App Service** — hosting

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Patient | rahul@medassist.com | patient123 |
| Doctor | priya@medassist.com | doctor123 |
| Receptionist | meera@medassist.com | recept123 |
| Attendee | rohan@medassist.com | attend123 |




## mlflow --> https://mlflow.org/docs/latest/genai/governance/ai-gateway/quickstart/
pip install 'mlflow[genai]'
mlflow server --port 5000


## API Key --> Open API
https://platform.openai.com/api-keys