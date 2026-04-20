# CAD Version Control Portal

Version control system for G-code and .mf CAD files, built for e-commerce manufacturing teams.

## Stack
- Backend: Node.js + Express + MongoDB
- Frontend: React + Vite

## Setup

### 1. Backend
```bash
cd backend
cp .env.example .env        # fill in MONGO_URI and JWT_SECRET
npm install
npm run dev                 # runs on http://localhost:5000
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev                 # runs on http://localhost:5173
```

## Structure
```
Product A
  ├── Part 1  →  v1.0, v1.1, v2.0 (gcode files)
  ├── Part 2  →  v1.0, v1.1
  └── Part 3  →  v1.0
```

## Features
- Products → Parts → G-code version history
- Upload .gcode / .mf / .nc files with version notes
- 2D toolpath renderer (canvas-based, no external deps)
- Download any version
- JWT auth with roles (admin / editor / viewer)
