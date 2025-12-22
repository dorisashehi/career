"""
Security headers middleware for FastAPI.

Adds security headers to all responses to protect against common vulnerabilities.
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from typing import Callable


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add security headers to all HTTP responses.

    Adds headers for:
    - X-Content-Type-Options: Prevents MIME type sniffing
    - X-Frame-Options: Prevents clickjacking attacks
    - X-XSS-Protection: Enables XSS filtering (legacy browsers)
    - Strict-Transport-Security: Forces HTTPS (HSTS)
    - Content-Security-Policy: Restricts resource loading
    - Referrer-Policy: Controls referrer information
    - Permissions-Policy: Restricts browser features
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # HSTS - Only add in production with HTTPS
        # Uncomment and configure for production:
        # response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        # Content Security Policy - Adjust based on your needs
        # This is a basic CSP, customize for your application
        csp = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "  # Adjust for production
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self' data:; "
            "connect-src 'self'; "
            "frame-ancestors 'none';"
        )
        response.headers["Content-Security-Policy"] = csp

        # Referrer Policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Permissions Policy (formerly Feature-Policy)
        permissions_policy = (
            "geolocation=(), "
            "microphone=(), "
            "camera=(), "
            "payment=(), "
            "usb=()"
        )
        response.headers["Permissions-Policy"] = permissions_policy

        return response
