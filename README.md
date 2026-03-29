# 📈 SignalForge

> **AI-Powered Stock Intelligence Platform Delivering Real-Time Market Insights & Actionable Signals**

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://signalforge-theta.vercel.app/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![GitHub](https://img.shields.io/badge/GitHub-signalforge--ai-181717?logo=github)](https://github.com/TejasviUpadhyay1907/signalforge-ai)

---

## 🎯 Overview

**SignalForge** is an intelligent stock market assistant that combines real-time market data, AI-powered analysis, and portfolio intelligence to help traders and investors make informed decisions. Built for the modern investor who needs speed, accuracy, and actionable insights.

### Why SignalForge?

- ⚡ **Real-Time Analysis** — Live market data with sub-second updates via WebSocket
- 🤖 **AI-Powered Insights** — Natural language queries answered with contextual market intelligence
- 📊 **Portfolio Intelligence** — Track holdings with live P&L, risk analysis, and performance metrics
- 🎯 **Signal Generation** — Automated Buy/Hold/Sell signals with confidence scoring
- 🔍 **Smart Search** — Instant stock discovery across Indian (NSE) and US markets

---

## 💡 Problem Statement

Modern traders face critical challenges:

- **Information Overload** — Scattered data across multiple platforms
- **Slow Analysis** — Manual research takes hours, markets move in seconds
- **Lack of Context** — Raw numbers without actionable insights
- **Portfolio Blindness** — No real-time view of holdings performance
- **Decision Paralysis** — Too much data, not enough intelligence

Traditional tools provide data. **SignalForge provides intelligence.**

---

## ✨ Solution

SignalForge transforms raw market data into actionable intelligence through:

1. **AI Market Assistant** — Ask questions in natural language, get instant analysis
2. **Real-Time Signal Engine** — Automated technical analysis with confidence scoring
3. **Live Portfolio Tracking** — WebSocket-powered P&L updates every 15 seconds
4. **Risk Intelligence** — Portfolio health scoring and concentration analysis
5. **Unified Data Layer** — Seamless integration of Indian (NSE) and US markets

---

## 🚀 Key Features

### 🤖 AI Market Assistant
- Natural language query processing
- Context-aware responses with market data
- Quick commands for common analysis tasks
- Portfolio-specific insights and recommendations

### 📊 Real-Time Stock Analysis
- Live price updates via WebSocket + REST polling
- Interactive candlestick charts with multiple timeframes
- Technical indicators and trend analysis
- Signal generation with confidence metrics (15-85% range)

### 💼 Portfolio Management
- Live P&L tracking with flash animations
- Risk distribution analysis (Low/Medium/High)
- Performance leaders and attention alerts
- Health score calculation (0-100)
- Concentration risk monitoring

### 🎯 Signal Intelligence
- Automated Buy/Hold/Sell recommendations
- Confidence scoring based on multiple factors
- Real-time signal updates as market moves
- Historical signal accuracy tracking

### 📈 Interactive Visualizations
- Responsive candlestick charts
- Mini sparklines for quick trends
- Risk distribution graphs
- Portfolio composition breakdown

---

## 🛠️ Tech Stack

### Frontend
- **React 19** — Modern UI with concurrent features
- **Vite 6** — Lightning-fast build tool
- **Tailwind CSS 3.4** — Utility-first styling
- **React Router 7** — Client-side routing
- **Recharts 2.15** — Data visualization
- **Clerk** — Authentication & user management

### Backend
- **FastAPI** — High-performance Python API framework
- **SQLAlchemy 2.0** — Database ORM
- **PostgreSQL** — Production database
- **OpenAI API** — AI-powered analysis
- **yfinance** — Market data provider
- **Finnhub API** — Real-time WebSocket data

### Infrastructure
- **Vercel** — Frontend deployment
- **Render** — Backend hosting
- **WebSocket** — Real-time price streaming
- **REST API** — Batch data operations

---

## 🏗️ Architecture

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│  React Frontend (Vite + Tailwind)   │
│  • Dashboard                         │
│  • Stock Analysis                    │
│  • Portfolio Tracker                 │
│  • AI Assistant                      │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  FastAPI Backend                     │
│  • REST API Endpoints                │
│  • WebSocket Server                  │
│  • Signal Detection Engine           │
│  • AI Context Engine                 │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  External Services                   │
│  • Finnhub (Real-time data)          │
│  • Yahoo Finance (Historical data)   │
│  • OpenAI (AI Analysis)              │
│  • PostgreSQL (User data)            │
└─────────────────────────────────────┘
```

**Data Flow:**
1. User interacts with React UI
2. Frontend sends request to FastAPI backend
3. Backend fetches data from market APIs
4. Signal detection engine analyzes data
5. AI engine generates contextual insights
6. Results streamed back to frontend
7. UI updates in real-time via WebSocket

---

## 📸 Screenshots

### Dashboard
![Dashboard](./et_frontend/application%20pics/dashboard.png)
*Real-time market overview with top AI signals and portfolio summary*

### Stock Analysis
![Stock Analysis](./et_frontend/application%20pics/stockanalysis.png)
*Detailed stock analysis with interactive charts and AI-generated insights*

### Portfolio Tracking
![Portfolio Analysis](./et_frontend/application%20pics/protfolio%20analysis.png)
*Live portfolio tracking with P&L, risk analysis, and performance metrics*

### AI Assistant
![AI Assistant](./et_frontend/application%20pics/assistant.png)
*Natural language market assistant with contextual responses*

---

## 🌐 Live Demo
**Frontend:** [https://signalforge.vercel.app](https://signalforge.vercel.app)  
**Backend API:** [https://signalforge-api.onrender.com](https://signalforge-api.onrender.com)  
**GitHub:** [https://github.com/TejasviUpadhyay1907/signalforge-ai](https://github.com/TejasviUpadhyay1907/signalforge-ai)
**GitHub:** [https://github.com/Swayam2706/signalforge](https://github.com/Swayam2706/signalforge)

---

## 🔧 Installation & Setup

### Prerequisites
- Node.js 18+ and npm
- Python 3.10+
- PostgreSQL (optional, SQLite works for development)
- API Keys: Finnhub, OpenAI

### Frontend Setup
```bash
# Clone the repository
git clone https://github.com/TejasviUpadhyay1907/signalforge-ai.git
cd signalforge-ai/et_frontendom/Swayam2706/signalforge.git
cd signalforge/et_frontend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Add your environment variables
# VITE_API_BASE_URL=http://localhost:8000
# VITE_CLERK_PUBLISHABLE_KEY=your_clerk_key

# Start development server
npm run dev
```

### Backend Setup

```bash
# Navigate to backend directory
cd et_backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env

# Add your environment variables (see below)

# Run the server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

---

## 🔐 Environment Variables

### Frontend (.env)
```env
VITE_API_BASE_URL=http://localhost:8000
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
```

### Backend (.env)
```env
# API Keys
FINNHUB_API_KEY=your_finnhub_api_key
OPENAI_API_KEY=your_openai_api_key

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/signalforge

# App Config
APP_NAME=SignalForge
APP_VERSION=1.0.0
LOG_LEVEL=INFO
```

---

## 💼 Use Cases

### For Retail Investors
- Track portfolio performance in real-time
- Get AI-powered stock recommendations
- Understand risk exposure across holdings
- Make data-driven investment decisions

### For Active Traders
- Monitor live price movements with WebSocket updates
- Receive instant Buy/Hold/Sell signals
- Analyze technical indicators and trends
- Quick market scanning for opportunities

### For Market Beginners
- Ask questions in natural language
- Learn from AI-generated explanations
- Understand stock fundamentals easily
- Build confidence with guided insights

### For Portfolio Managers
- Multi-stock portfolio tracking
- Risk distribution analysis
- Performance attribution
- Concentration risk monitoring

---

## 🔮 Future Enhancements

- [ ] **Advanced AI Models** — GPT-4 integration for deeper analysis
- [ ] **Predictive Analytics** — ML models for price forecasting
- [ ] **Multi-Market Support** — European and Asian markets
- [ ] **Alert System** — Price alerts and signal notifications
- [ ] **Mobile App** — iOS and Android native apps
- [ ] **Social Features** — Share insights and strategies
- [ ] **Backtesting Engine** — Test strategies on historical data
- [ ] **Options Analysis** — Options chain and Greeks calculator
- [ ] **News Integration** — Real-time news sentiment analysis
- [ ] **API Access** — Developer API for third-party integrations

---

## 🏆 Why SignalForge Stands Out

### 🎯 Real-World Impact
- **Production-Ready** — Fully functional, deployed, and accessible
- **Practical Application** — Solves real problems for real users
- **Scalable Architecture** — Built to handle thousands of concurrent users

### 💡 Technical Innovation
- **Hybrid Data Strategy** — WebSocket + REST for optimal performance
- **AI-Powered Intelligence** — Not just data, but actionable insights
- **Real-Time Everything** — Sub-second updates across the platform
- **Smart Caching** — 90s TTL for quotes, instant response times

### 🎨 User Experience
- **Intuitive Design** — Clean, modern, glassmorphism UI
- **Responsive** — Works seamlessly on desktop, tablet, and mobile
- **Fast** — Optimized bundle size, lazy loading, code splitting
- **Accessible** — Keyboard navigation, screen reader support

### 🚀 Execution Quality
- **End-to-End Implementation** — Frontend, backend, database, deployment
- **Error Handling** — Graceful fallbacks, no crashes
- **Performance Optimized** — Parallel API calls, memoization, caching
- **Production Deployment** — Live on Vercel and Render

---

## 👥 Team

**Swayam Pawar**  
*Full-Stack Developer*  
[GitHub](https://github.com/Swayam2706) 
**Tejasvi Upadhyay**  
*AI Engineer*  
[GitHub](https://github.com/TejasviUpadhyay1907) 

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Finnhub** — Real-time market data API
- **Yahoo Finance** — Historical stock data
- **OpenRouter** — AI-powered analysis
- **Clerk** — Authentication infrastructure
- **Vercel** — Frontend hosting
- **Render** — Backend hosting

---

<div align="center">

**Built with ❤️ for traders and investors worldwide**

⭐ Star this repo if you find it useful!
