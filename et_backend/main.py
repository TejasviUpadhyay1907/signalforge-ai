"""
SignalForge - AI Opportunity Intelligence Engine for Indian Stocks

Production-ready FastAPI backend with comprehensive features:
- Clerk JWT authentication
- Global error handling
- Structured logging and monitoring
- Rate limiting and security
- Caching layer
- Health checks
- AI-powered stock analysis
"""

import time
import asyncio
from datetime import datetime
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager
from fastapi import FastAPI,Depends,Request, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging

# Configuration and settings
from et_backend.config import settings, get_settings

# Database
from et_backend.db.base import create_tables
from et_backend.db.session import get_db_session

# Routers
from et_backend.routers.portfolio import router as portfolio_router
from et_backend.routers.stock import router as stock_router
from et_backend.routers.assistant import router as assistant_router
from et_backend.routers.monitoring import router as monitoring_router
from et_backend.routers.database import router as database_router
from et_backend.routers.health import router as health_router

# Middleware
from et_backend.middleware.enhanced import setup_all_middleware

# Exception handling
from et_backend.error_handlers import setup_exception_handlers

# Authentication
from et_backend.auth import get_current_user, require_auth

# Core modules
from et_backend.data.fetcher import fetch_stock_data, get_single_stock_data
from et_backend.signals.detector import detect_signal, detect_signals_batch
from et_backend.context.context_engine import generate_full_context, generate_full_context_batch
from et_backend.scoring.scorer import calculate_signal_score, calculate_signal_score_batch
from et_backend.ai.explainer import AIExplainer
from et_backend.ranking.ranker import create_demo_response, get_top_n_opportunities
from et_backend.insights.insight_generator import generate_batch_insights
from et_backend.utils.tag_generator import generate_tags, generate_risk_note
from et_backend.utils.response import StandardResponse
from et_backend.utils.cache import stock_data_cache, api_response_cache, cleanup_expired_cache

# Exceptions
from et_backend.exceptions import (
    SignalForgeException,
    ValidationError,
    ExternalAPIError,
    DatabaseError
)

# Setup logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Default stocks for scanning
DEFAULT_STOCKS = [
    'RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'HINDUNILVR.NS',
    'ICICIBANK.NS', 'KOTAKBANK.NS', 'SBIN.NS', 'BAJFINANCE.NS', 'BHARTIARTL.NS'
]

# Global AI explainer instance
explainer = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    logger.info("Starting SignalForge API...")
    
    # Validate configuration
    missing_configs = settings.validate_required_configs()
    if missing_configs:
        logger.warning(f"Missing configuration: {missing_configs}")
        if settings.is_production:
            raise RuntimeError(f"Required configuration missing: {missing_configs}")
    
    # Create database tables
    try:
        create_tables()
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        if settings.is_production:
            raise
    
    # Initialize AI explainer
    global explainer
    try:
        explainer = AIExplainer()
        logger.info(f"AI Explainer initialized with {explainer.api_provider}")
    except Exception as e:
        logger.warning(f"AI Explainer setup failed: {e}. Using fallback explanations.")
        explainer = None
    
    # Cache initialization
    logger.info(f"Cache initialized - Stock data TTL: {settings.CACHE_TTL_STOCK_DATA}s")
    
    logger.info("SignalForge API startup completed successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down SignalForge API...")
    
    # Clean up cache
    try:
        cleanup_expired_cache()
        logger.info("Cache cleanup completed")
    except Exception as e:
        logger.error(f"Cache cleanup failed: {e}")
    
    logger.info("SignalForge API shutdown completed")


# Initialize FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    description="AI Opportunity Intelligence Engine for Indian Stocks",
    version=settings.APP_VERSION,
    lifespan=lifespan
)

# Setup middleware
setup_all_middleware(app)

# Setup exception handlers
setup_exception_handlers(app)

# Include routers
app.include_router(portfolio_router)
app.include_router(stock_router)
app.include_router(assistant_router)
app.include_router(monitoring_router)
app.include_router(database_router)
app.include_router(health_router)


@app.get("/")
async def root():
    """Root endpoint with API information."""
    return StandardResponse.success({
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "status": "operational",
        "endpoints": {
            "scan": "/scan",
            "stock": "/stock/{symbol}",
            "portfolio": "/portfolio",
            "assistant": "/assistant/chat",
            "health": "/health",
            "monitoring": "/monitoring"
        }
    }, "SignalForge API is running")


@app.get("/scan")
async def market_scan(
    stocks: Optional[str] = None,
    max_results: int = 10,
    use_ai: bool = True,
    user: Optional[dict] = Depends(get_current_user)
):
    """
    Market scan endpoint with caching and optimization.
    
    Args:
        stocks: Comma-separated stock symbols (optional)
        max_results: Maximum number of results to return (5-10)
        use_ai: Whether to use AI for explanations
        
    Returns:
        Top stock opportunities with signals and analysis
    """
    try:
        start_time = time.time()
        
        # Validate inputs
        if max_results < 5 or max_results > 10:
            raise ValidationError("max_results must be between 5 and 10")
        
        # Use default stocks if none provided
        if stocks:
            stock_list = [s.strip().upper() + ".NS" for s in stocks.split(',')]
        else:
            stock_list = DEFAULT_STOCKS
        
        # Check cache first
        cache_key = f"scan:{':'.join(sorted(stock_list))}:{max_results}:{use_ai}"
        cached_result = api_response_cache.get(cache_key)
        
        if cached_result is not None:
            logger.info(f"Cache hit for scan: {len(stock_list)} stocks")
            return StandardResponse.success(cached_result, f"Market scan completed from cache - {len(cached_result.get('top_stocks', []))} top opportunities")
        
        # Fetch stock data (with caching in fetcher)
        stock_data = fetch_stock_data(stock_list)
        
        # Detect signals
        signals = detect_signals_batch(stock_data)
        
        # Generate context and scores
        context_data = generate_full_context_batch(signals, stock_data)
        scored_signals = calculate_signal_score_batch(signals, context_data, stock_data)
        
        # Generate explanations (AI or fallback)
        explanations = {}
        if use_ai and explainer:
            try:
                explanations = explainer.explain_batch(scored_signals)
            except Exception as e:
                logger.warning(f"AI explanation failed: {e}. Using fallback explanations.")
        
        # Sort by confidence and limit results
        sorted_signals = sorted(scored_signals, key=lambda x: x['score'], reverse=True)
        top_signals = sorted_signals[:max_results]
        
        # Prepare response data
        response_data = {
            'top_stocks': [],
            'summary': {
                'market_condition': 'Bullish' if len([s for s in top_signals if s.get('trend') == 'Bullish']) > len(top_signals) // 2 else 'Bearish',
                'top_signal': top_signals[0]['signal_type'] if top_signals else 'No signals',
                'insight': f"Market analysis completed for {len(stock_list)} stocks"
            }
        }
        
        for signal in top_signals:
            symbol = signal['symbol'].replace('.NS', '')
            stock_info = {
                'symbol': symbol,
                'price': signal['current_price'],
                'signal': signal['signal_type'],
                'confidence': signal['score'],
                'trend': signal['trend'],
                'risk': generate_risk_note(signal['signal_type'], signal['score']),
                'tags': generate_tags(signal['signal_type'], signal['score']),
                'explanation': explanations.get(symbol, f"{signal['signal_type']} signal detected with {signal['score']}% confidence")
            }
            
            response_data['top_stocks'].append(stock_info)
        
        # Cache the result
        api_response_cache.set(cache_key, response_data, ttl=settings.CACHE_TTL_API_RESPONSE)
        
        logger.info(f"Scan completed in {time.time() - start_time:.2f}s for {len(stock_list)} stocks")
        
        return StandardResponse.success(response_data, f"Market scan completed - {len(response_data['top_stocks'])} top opportunities found")
        
    except Exception as e:
        logger.error(f"Error during market scan: {str(e)}")
        return StandardResponse.server_error("Failed to complete market scan")


# Exception handlers with standardized responses
@app.exception_handler(404)
async def not_found_handler(request, exc):
    return StandardResponse.not_found("Resource not found")

@app.exception_handler(500)
async def internal_error_handler(request, exc):
    return StandardResponse.server_error("Internal server error")

@app.exception_handler(400)
async def bad_request_handler(request, exc):
    return StandardResponse.bad_request("Bad request")

@app.exception_handler(401)
async def unauthorized_handler(request, exc):
    return StandardResponse.unauthorized("Unauthorized")

@app.exception_handler(403)
async def forbidden_handler(request, exc):
    return StandardResponse.forbidden("Forbidden")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return StandardResponse.success({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    }, "Health check completed")


def _add_fallback_explanations(signals_data: Dict[str, Dict]):
    """Add fallback explanations when AI is unavailable."""
    for symbol, signal_data in signals_data.items():
        signal_type = signal_data['signal_type'].lower()
        strength = signal_data['strength'].lower()
        signal_data['explanation'] = f"Stock shows {signal_type} signal with {strength} confidence."


@app.get("/stocks")
async def get_default_stocks():
    """Get list of default stock symbols."""
    return {
        "default_stocks": DEFAULT_STOCKS,
        "count": len(DEFAULT_STOCKS),
        "market": "Indian (NSE)"
    }


@app.get("/scan/sectors")
async def get_sectors():
    """Get available sectors and their stock symbols."""
    sectors = {
        "banking":  ["HDFCBANK.NS", "ICICIBANK.NS", "KOTAKBANK.NS", "SBIN.NS", "AXISBANK.NS"],
        "it":       ["TCS.NS", "INFY.NS", "WIPRO.NS", "HCLTECH.NS", "TECHM.NS"],
        "energy":   ["RELIANCE.NS", "ONGC.NS"],
        "fmcg":     ["HINDUNILVR.NS", "ITC.NS", "NESTLEIND.NS"],
        "auto":     ["MARUTI.NS", "TATAMOTORS.NS"],
        "pharma":   ["SUNPHARMA.NS", "CIPLA.NS", "DRREDDY.NS"],
    }
    return StandardResponse.success({"sectors": sectors, "count": len(sectors)}, "Sectors retrieved")


# Run instructions
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
