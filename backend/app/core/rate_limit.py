import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status


class RateLimiter:
    """Simple in-memory sliding-window limiter (single instance; move to Redis when scaling)."""

    def __init__(self, times: int, seconds: int) -> None:
        self.times = times
        self.seconds = seconds
        self.hits: dict[str, deque[float]] = defaultdict(deque)

    async def __call__(self, request: Request) -> None:
        client = request.client.host if request.client else "unknown"
        key = f"{client}:{request.url.path}"
        now = time.monotonic()
        window = self.hits[key]
        while window and now - window[0] > self.seconds:
            window.popleft()
        if len(window) >= self.times:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many requests. Please slow down.")
        window.append(now)

    def reset(self) -> None:
        self.hits.clear()
