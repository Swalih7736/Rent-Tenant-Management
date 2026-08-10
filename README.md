# RentFlow — Tenant & Rent Management System

Welcome to the **RentFlow** repository! This is a web application designed to manage properties, tenant lifecycles, monthly rent payments, utilities, and financial reports.

For a comprehensive, **non-technical business overview of the project's features, roles, and functional workflows**, please see the detailed document:
👉 **[PROJECT_DETAILS.md](./PROJECT_DETAILS.md)**

---

## 📂 Project Structure

The project is split into two main sections:

```text
Rent-Management/
├── backend/          # Python FastAPI application
│   ├── app/          # App configuration, routes, models, and services
│   ├── tests/        # Backend test suite
│   ├── schema.sql    # Supabase / PostgreSQL database schema
│   ├── run.py        # Entry point for development server
│   └── ...
└── frontend/         # React + Vite client app (Tailwind CSS, Recharts)
    ├── src/          # React components, pages, and API handlers
    ├── index.html    # Single-page application template
    └── ...
```

---

## 🚀 Quick Start & Development Setup

### 1. Prerequisites
*   [Python 3.10+](https://www.python.org/)
*   [Node.js (v18+)](https://nodejs.org/)
*   A [Supabase](https://supabase.com/) account/project (for Database & Auth)

---

### 2. Backend Setup (FastAPI)

1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   # Windows (PowerShell/CMD)
   python -m venv venv
   .\venv\Scripts\activate

   # macOS/Linux
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure Environment Variables:
   Create a `.env` file in the `backend/` directory by copying `.env.example` and filling in your Supabase connection settings:
   ```env
   SUPABASE_URL=your-supabase-project-url
   SUPABASE_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   ```
5. Apply the Database Schema:
   Execute the contents of `backend/schema.sql` inside your Supabase SQL Editor.
6. Start the Backend API Server:
   ```bash
   python run.py
   ```
   The API will be available at `http://localhost:8000`. You can view the interactive documentation at `http://localhost:8000/docs`.

---

### 3. Frontend Setup (React + Vite)

1. Open a new terminal and navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   The application will be accessible at `http://localhost:5173`.

---

## 🔒 Security & Roles
The application uses Role-Based Access Control (RBAC):
- **Admin**: Full read/write/delete privileges across all models, and user registration controls.
- **Manager**: Day-to-day data entry (properties, tenants, payments, meter readings).
- **Viewer**: Read-only operations for dashboards, records, and reports.

For more details on these roles, see **[PROJECT_DETAILS.md](./PROJECT_DETAILS.md)**.
