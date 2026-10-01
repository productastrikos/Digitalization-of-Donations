# Enterprise Admin Dashboard — UI Template

A production-ready, fully self-contained React admin dashboard template. No backend, no API, no authentication required — all data is static and bundled with the frontend.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 (Create React App) |
| Routing | React Router v6 |
| Charts | Chart.js 4 + react-chartjs-2 |
| Map | React-Leaflet + Leaflet |
| Styling | Tailwind CSS 3 + CSS custom properties |
| Data | Static seed data (no server) |

---

## Pages

| Route | Page | Description |
|---|---|---|
| `/` | Dashboard | KPI cards, charts, segment overview, Digital Twin preview |
| `/operations` | Operations | Records, assets, and inventory (3 tabs) |
| `/analytics` | Analytics | Performance reports, workflow pipeline, system monitor (3 tabs) |
| `/services` | Services | Request management table and charts |
| `/map` | Digital Twin | Full-page interactive map with layer toggles |

---

## Project Structure

```
client/
  src/
    App.js               # Routes + static user
    index.css            # Design tokens, theme, component CSS
    components/
      Layout.js          # Sidebar, header, alert + advisory panels
      KPICard.js         # KPI card component
      KPIDetailModal.js  # KPI drill-down modal
      AdvisoryPanel.js   # AI advisory slide-out panel
      AlertPanel.js      # Real-time alerts slide-out panel
      ZoneFilterBar.js   # Segment filter pill bar
      chartUtils.js      # Chart tokens, timeframe control, helpers
    pages/
      Dashboard.js       # Main overview page
      Operations.js      # 3-tab operations page
      Analytics.js       # 3-tab analytics page
      CitizenServices.js # Services/requests page
      DigitalTwin.js     # Full-page map view
    services/
      socket.js          # Static data context provider
      api.js             # Static API stubs
```

---

## Quick Start

```bash
# Install dependencies
cd client && npm install

# Start development server (http://localhost:3000)
npm start
```

Or from the project root:

```bash
npm run dev      # starts client dev server
npm run build    # produces client/build/
```

---

## Customisation

**Retheming** — all colours are CSS custom properties in `client/src/index.css`. Change `--app-panel`, `--app-accent`, and `--app-advisory` to instantly retheme every component.

**KPI values** — edit the `SEED_KPIS` and `SEED_BINS_SUMMARY` objects in `client/src/services/socket.js`.

**Navigation labels** — update `NAV_SECTIONS` and `PAGE_TITLES` in `client/src/components/Layout.js`.

**Static advisories / alerts** — edit `STATIC_ADVISORIES` in `AdvisoryPanel.js` and `SEED_ALERTS` in `socket.js`.

┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│  Dashboard │ Collection │ Fleet │ WTE │ Digital Twin     │
│  Processing │ Landfills │ Sustainability │ Enterprise    │
├─────────────────────────────────────────────────────────┤
│               Socket.io (Real-time)                      │
├─────────────────────────────────────────────────────────┤
│                 Express.js Backend                        │
│  REST API │ Simulation Engine │ AI Advisory Engine        │
├─────────────────────────────────────────────────────────┤
│           In-Memory Data Store (No DB required)          │
└─────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ (https://nodejs.org)
- **npm** 9+

### Installation

```bash
# 1. Navigate to project root
cd wastemanagement_SL

# 2. Install root dependencies (concurrently)
npm install

# 3. Install all dependencies (server + client)
npm run install:all
```

### Running the Platform

```bash
# Start both server and client concurrently
npm run dev
```

Or run them separately:

```bash
# Terminal 1 - Backend (port 5000)
cd server && npm run dev

# Terminal 2 - Frontend (port 3000)
cd client && npm start
```

### Access
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000/api

### Netlify Deployment

The project is prepared for a Netlify full-stack deployment using Netlify static hosting for the React frontend and a Netlify Function wrapper for the Express API.

1. Deploy the repository root to Netlify.
2. Use `npm run build:netlify` as the build command.
3. Use `client/build` as the publish directory.
4. Backend requests to `/api/*` are routed to the Netlify function automatically.
5. Add these environment variables in Netlify:

```bash
JWT_SECRET=replace-this-with-a-secure-random-secret
REACT_APP_REALTIME_MODE=polling
```

Notes:
- `netlify.toml` is already included at the repository root.
- SPA route refreshes are handled by the included redirect rules.
- Socket.io does not run persistently on Netlify Functions, so the client uses polling mode in production.
- The simulation remains in-memory. In a serverless environment that means state can reset on cold starts, which is acceptable for demo deployment but not durable persistence.

### Demo Credentials

| Role         | Username    | Password     |
|--------------|-------------|------------- |
| Admin        | admin       | admin123     |
| Operator     | operator    | operator123  |
| Analyst      | analyst     | analyst123   |
| Field Worker | fieldworker | field123     |

---

## 📋 Platform Modules

### 1. Command Dashboard
- 6 real-time KPI cards (Collection, Recycling, Fleet, WTE, Landfill, Carbon)
- Trend charts, waste composition, zone comparisons
- Zone performance table, activity feed
- Real-time weather integration

### 2. Waste Collection
- 400+ smart bin monitoring with fill levels, temperature, type
- Zone-based filtering and sorting
- Scheduled collection actions
- Zone-level fill comparison charts

### 3. Fleet Management
- 45 vehicle real-time tracking (compactors, mini trucks, hook lifts)
- Status monitoring: active, en route, collecting, idle, maintenance
- Fuel levels, load capacity, speed
- Dispatch controls

### 4. WTE Plant (Kerawalapitiya)
- Power output, daily intake, efficiency gauges
- Furnace unit monitoring (3 units)
- Emission tracking (CO₂, SO₂, NOₓ, PM, Dioxins)
- 24-hour power output trends

### 5. Processing & Recycling
- Transfer stations, recycling centers, composting facilities
- Material recovery distribution
- Throughput and utilization tracking

### 6. Landfill Management
- Aruwakkalu and Karadiyana monitoring
- Capacity utilization, intake tracking
- Environmental monitoring (methane, groundwater, odor)
- Remaining lifespan projections

### 7. Sustainability & ESG
- Carbon score, waste diversion rate, CO₂ reduction tracking
- Circular economy breakdown
- Environmental Performance Index
- UN SDG alignment scores (Goals 6, 7, 11, 12, 13)

### 8. Enterprise Modules
- **HR**: Staff count, attendance, field workers, hiring
- **Finance**: Budget tracking, revenue, spend analysis
- **Procurement**: PO management, vendor tracking, savings
- **IT & Security**: System infrastructure
- **Legal & Compliance**: Regulatory compliance
- **ESG Reporting**: Environmental reporting
- **Citizen Services**: Complaint management, resolution tracking

### 9. Digital Twin (Leaflet Map)
- Interactive dark-themed map of Colombo
- Real-time bin positions with fill-level color coding
- Vehicle tracking with status indicators
- Facility locations with type icons
- Layer toggle controls
- Entity click-to-detail panels

---

## 🧠 AI Advisory Engine

The platform includes a rule-based advisory engine that generates contextual operational recommendations:

- **Overflow Cluster Detection**: Identifies zones with high bin overflow rates
- **Low Collection Rate**: Flags underperforming collection zones
- **Landfill Pressure**: Monitors capacity thresholds
- **WTE Optimization**: Suggests furnace and intake adjustments
- **Segregation Improvement**: Recommends waste sorting interventions
- **Fleet Maintenance**: Predictive maintenance advisories
- **Weather Impact**: Rainfall and heat-related operational adjustments
- **Cost Optimization**: Budget and efficiency recommendations
- **Emission Compliance**: Regulatory threshold monitoring
- **Circular Economy**: Material recovery and recycling suggestions

Each advisory includes root cause analysis (3-layer), evidence, actionable recommendations, projected impact, and executable action buttons.

---

## 🔧 Data Simulation

The simulation engine generates realistic data for all 15 Colombo zones:

- **Hourly patterns**: Peak waste generation at 8AM, 12PM, 6PM
- **Weekly cycles**: Weekday vs weekend variation
- **Monthly trends**: Monsoon, festival, and seasonal effects
- **Weather correlation**: Rainfall reduces collection efficiency
- **Festival calendar**: Vesak, Poson, Christmas, New Year multipliers
- **Random events**: Equipment failures, road blocks, sudden demand spikes
- **Traffic patterns**: Zone-specific congestion multipliers

### Colombo Zones Modeled
Fort, Pettah, Borella, Maradana, Grandpass, Dematagoda, Kotahena, Mattakkuliya, Modara, Slave Island, Kollupitiya, Bambalapitiya, Wellawatte, Dehiwala, Mount Lavinia

---

## 🛠️ Tech Stack

| Layer       | Technology                                    |
|-------------|-----------------------------------------------|
| Frontend    | React 18, Tailwind CSS, Chart.js, Leaflet     |
| Backend     | Node.js, Express.js                           |
| Real-time   | Socket.io                                     |
| Auth        | JWT + bcryptjs                                |
| Maps        | Leaflet + CARTO dark tiles                    |
| Charts      | Chart.js + react-chartjs-2                    |

---

## 📁 Project Structure

```
wastemanagement_SL/
├── package.json              # Root monorepo config
├── README.md
├── server/
│   ├── package.json
│   ├── .env                  # Server configuration
│   ├── index.js              # Express server + Socket.io + all routes
│   ├── models.js             # Mongoose schemas (reference)
│   ├── simulation.js         # Data simulation engine
│   └── aiAdvisory.js         # AI advisory engine
├── client/
│   ├── package.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── public/
│   │   └── index.html
│   └── src/
│       ├── index.js
│       ├── index.css           # Tailwind + custom styles
│       ├── App.js              # Router & auth
│       ├── services/
│       │   ├── api.js          # Axios API service
│       │   └── socket.js       # Socket.io context
│       ├── components/
│       │   ├── Layout.js       # Main layout shell
│       │   ├── AlertPanel.js   # Real-time alerts
│       │   └── AdvisoryPanel.js # AI advisories
│       └── pages/
│           ├── Login.js
│           ├── Dashboard.js
│           ├── WasteCollection.js
│           ├── FleetManagement.js
│           ├── WTEPlant.js
│           ├── Processing.js
│           ├── Landfills.js
│           ├── Sustainability.js
│           ├── Enterprise.js
│           └── DigitalTwin.js
```

---

## ⚠️ Notes

- The platform runs entirely **in-memory** — no MongoDB installation required
- Data is generated fresh on each server restart via the simulation engine
- All GPS coordinates use real Colombo ward locations
- The WTE plant model is based on the Kerawalapitiya facility specifications
- Landfill data reflects Aruwakkalu and Karadiyana site characteristics
