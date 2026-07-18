#!/usr/bin/env python3
"""Startup script for 电改模拟工具 API server."""
import os
import uvicorn

if __name__ == "__main__":
    is_dev = os.getenv("ENV", "production") == "development"
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=3807,
        reload=is_dev,
        log_level="info"
    )