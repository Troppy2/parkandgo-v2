"""
Prometheus metrics for Park & Go.

Uses prometheus-fastapi-instrumentator for automatic HTTP metrics
(request count, latency histograms, in-progress requests) and
exposes custom counters for business-level observability.
"""
from prometheus_client import Counter, Histogram
from prometheus_fastapi_instrumentator import Instrumentator

# ── Auto-instrumented HTTP metrics ──
# Tracks request_count, request_latency_seconds, requests_in_progress
instrumentator = Instrumentator(
    should_group_status_codes=True,
    should_ignore_untemplated=True,
    excluded_handlers=["/metrics", "/docs", "/openapi.json"],
)

# ── Custom business metrics ──

recommendation_requests_total = Counter(
    "recommendation_requests_total",
    "Total recommendation endpoint calls",
    ["campus_location", "verified_only"],
)

spot_submissions_total = Counter(
    "spot_submissions_total",
    "Total community-submitted parking spots",
)

auth_logins_total = Counter(
    "auth_logins_total",
    "Total successful logins",
    ["provider"],
)

search_queries_total = Counter(
    "search_queries_total",
    "Total search queries",
)

scoring_duration_seconds = Histogram(
    "scoring_duration_seconds",
    "Time spent computing recommendation scores",
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0],
)
