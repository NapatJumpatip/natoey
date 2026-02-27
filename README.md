# NCON2559 Construction Accounting System

A production-ready SaaS construction accounting web application built with React, Express, and PostgreSQL.

## 🏗️ Architecture

```
ncon2559/
├── backend/          # Express API server
│   ├── src/
│   │   ├── db/       # Schema, migrations, seed, pool
│   │   ├── middleware/  # JWT auth, role checks
│   │   ├── routes/   # Auth, Projects, Documents, Reports, Users
│   │   └── server.js
│   ├── Dockerfile
│   └── package.json
├── frontend/         # React + Vite + Tailwind
│   ├── src/
│   │   ├── components/  # Layout, Sidebar, Navbar
│   │   ├── context/     # AuthContext
│   │   ├── lib/         # API client with JWT refresh
│   │   └── pages/       # All page components
│   ├── Dockerfile
│   ├── vercel.json
│   └── package.json
└── .env.example
```

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- PostgreSQL (or Supabase account)

### 1. Clone and Setup
```bash
cd ncon2559

# Backend
cp .env.example backend/.env
# Edit backend/.env with your DATABASE_URL and JWT secrets

# Frontend
cd frontend
echo "VITE_API_URL=http://localhost:5000/api" > .env
```

### 2. Setup Database
```bash
cd backend
npm install
npm run migrate   # Creates tables
npm run seed      # Inserts sample data
```

### 3. Start Development
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

### Demo Credentials
| Role   | Email                  | Password |
|--------|------------------------|----------|
| Admin  | admin@ncon2559.com     | 123456   |
| Editor | editor@ncon2559.com    | 123456   |
| Viewer | viewer@ncon2559.com    | 123456   |

## 🌐 Production Deployment

### Frontend → Vercel

1. Push `frontend/` to GitHub
2. Connect repo to [Vercel](https://vercel.com)
3. Set build settings:
   - Framework: Vite
   - Build command: `npm run build`
   - Output: `dist`
4. Add env variable:
   ```
   VITE_API_URL=https://api.ncon2559.com/api
   ```
5. Add custom domain: `ncon2559.com`

### Backend → Render

1. Push `backend/` to GitHub
2. Create [Render](https://render.com) Web Service
3. Set build command: `npm install`
4. Set start command: `node src/server.js`
5. Add env variables from `.env.example`
6. Add custom domain: `api.ncon2559.com`

### Database → Supabase

1. Create project at [Supabase](https://supabase.com)
2. Copy the PostgreSQL connection string
3. Set `DATABASE_URL` in Render env vars
4. Run migrations: `npm run migrate && npm run seed`

### Domain (ncon2559.com)

1. Add DNS records:
   - `ncon2559.com` → Vercel (CNAME or A record)
   - `api.ncon2559.com` → Render (CNAME)
2. Enable HTTPS on both platforms (automatic)

## 📋 Features

- **Dashboard**: KPI cards, cash flow charts, profit trends, expense breakdown
- **Projects**: CRUD with contract tracking, income/expense aggregation
- **Documents**: 8 types (QT, INV, TIV, RCT, PO, VP, ADV, CLR) with auto-numbering
- **Tax Forms**: VAT Sales/Purchase, ภงด.3, ภงด.53, 50 ทวิ
- **Reports**: PDF and Excel exports
- **Auth**: JWT with 15m access + 7d refresh tokens, bcrypt hashing
- **Roles**: ADMIN / EDITOR / VIEWER with per-project access control
- **Responsive**: Mobile-friendly with collapsible sidebar

## 🔧 Tech Stack

| Layer    | Technology                                           |
|----------|------------------------------------------------------|
| Frontend | React 18, Vite, Tailwind CSS, React Router, Recharts |
| Backend  | Node.js, Express, pg (node-postgres)                 |
| Database | PostgreSQL                                           |
| Auth     | JWT + bcrypt                                         |
| Export   | PDFKit, ExcelJS                                      |
| Deploy   | Vercel (FE), Render (BE), Supabase (DB)              |
