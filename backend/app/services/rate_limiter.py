import time
import asyncio
from typing import Dict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from collections import deque
import threading

@dataclass
class RateLimitConfig:
    requests_per_minute: int = 15      
    requests_per_day: int = 100          
    max_retries: int = 3                 
    retry_delay_seconds: float = 5.0     

class RateLimiter:
    """
    - Per-minute rate limiting
    - Per-day quota tracking
    - Automatic retry with backoff
    - Thread-safe operations
    """
    
    def __init__(self, config: RateLimitConfig = None):
        self.config = config or RateLimitConfig()
        

        self.minute_requests: deque = deque()  # Timestamps from last minute
        self.day_requests: deque = deque()     # Timestamps from last 24 hours
        
        # Lock for thread safety
        self._lock = threading.Lock()
        
        self.total_requests = 0
        self.rejected_requests = 0
        self.total_retries = 0
    
    def _cleanup_old_requests(self):
        """Remove requests older than their time window."""
        now = time.time()
        
        # Clean minute window
        while self.minute_requests and self.minute_requests[0] < now - 60:
            self.minute_requests.popleft()
        
        # Clean day window
        while self.day_requests and self.day_requests[0] < now - 86400:
            self.day_requests.popleft()
    
    def _wait_time(self) -> float:
        """Calculate how long to wait before next request is allowed."""
        self._cleanup_old_requests()
        
        wait_times = []
        
        # Check minute limit
        if len(self.minute_requests) >= self.config.requests_per_minute:
            oldest = self.minute_requests[0]
            wait_times.append(60 - (time.time() - oldest))
        
        # Check day limit
        if len(self.day_requests) >= self.config.requests_per_day:
            oldest = self.day_requests[0]
            wait_times.append(86400 - (time.time() - oldest))
        
        return max(wait_times) if wait_times else 0
    
    def acquire(self, timeout: float = 60.0) -> bool:
        """
        Acquire permission to make a request.
        
        Args:
            timeout: Maximum seconds to wait
            
        Returns:
            True if acquired, False if timeout
        """
        start_time = time.time()
        
        while True:
            with self._lock:
                self._cleanup_old_requests()
                
                # Check if we can proceed
                if (len(self.minute_requests) < self.config.requests_per_minute and 
                    len(self.day_requests) < self.config.requests_per_day):
                    
                    # Record this request
                    now = time.time()
                    self.minute_requests.append(now)
                    self.day_requests.append(now)
                    self.total_requests += 1
                    return True
            
            # Check timeout
            if time.time() - start_time >= timeout:
                with self._lock:
                    self.rejected_requests += 1
                return False
            
            # Wait before retrying
            wait_time = min(self._wait_time(), 1.0)
            time.sleep(wait_time)
    
    async def execute_with_retry(self, func, *args, **kwargs):
        """
        Execute a function with rate limiting and retry logic.
        
        Args:
            func: Async function to execute
            *args, **kwargs: Arguments to pass to function
            
        Returns:
            Result of function execution
            
        Raises:
            Exception: If all retries exhausted
        """
        last_exception = None
        
        for attempt in range(self.config.max_retries):
            # Try to acquire rate limit
            if self.acquire(timeout=30.0):
                try:
                    result = await func(*args, **kwargs)
                    return result
                except Exception as e:
                    last_exception = e
                    print(f"Request failed (attempt {attempt + 1}): {e}")
                    
                    # Exponential backoff
                    await asyncio.sleep(self.config.retry_delay_seconds * (2 ** attempt))
                    continue
            else:
                # Rate limited - wait and retry
                await asyncio.sleep(self.config.retry_delay_seconds)
                continue
        
        # All retries exhausted
        with self._lock:
            self.total_retries += 1
        
        raise Exception(f"Rate limit exceeded after {self.config.max_retries} retries: {last_exception}")
    
    def get_stats(self) -> dict:
        """Get current rate limiter statistics."""
        self._cleanup_old_requests()
        
        return {
            "requests_last_minute": len(self.minute_requests),
            "requests_last_24h": len(self.day_requests),
            "total_requests": self.total_requests,
            "rejected_requests": self.rejected_requests,
            "total_retries": self.total_retries,
            "limit_per_minute": self.config.requests_per_minute,
            "limit_per_day": self.config.requests_per_day,
        }

rate_limiter = RateLimiter()
