"""Minimal geo utilities for impossible-travel detection.

We carry a small dictionary of major Indian (+ a few international) cities
so we can do haversine-distance checks without an external API on the
hot path. If a city is unknown, the check silently no-ops.
"""
from math import radians, sin, cos, sqrt, asin
from datetime import datetime
from typing import Optional, Tuple


# (lat, lon) for major cities. Keys are lowercased.
CITY_COORDS = {
    # India – top 30 by population
    "mumbai": (19.0760, 72.8777),
    "delhi": (28.7041, 77.1025),
    "new delhi": (28.6139, 77.2090),
    "bangalore": (12.9716, 77.5946),
    "bengaluru": (12.9716, 77.5946),
    "hyderabad": (17.3850, 78.4867),
    "chennai": (13.0827, 80.2707),
    "kolkata": (22.5726, 88.3639),
    "pune": (18.5204, 73.8567),
    "ahmedabad": (23.0225, 72.5714),
    "surat": (21.1702, 72.8311),
    "jaipur": (26.9124, 75.7873),
    "lucknow": (26.8467, 80.9462),
    "kanpur": (26.4499, 80.3319),
    "nagpur": (21.1458, 79.0882),
    "indore": (22.7196, 75.8577),
    "thane": (19.2183, 72.9781),
    "bhopal": (23.2599, 77.4126),
    "visakhapatnam": (17.6868, 83.2185),
    "patna": (25.5941, 85.1376),
    "vadodara": (22.3072, 73.1812),
    "ghaziabad": (28.6692, 77.4538),
    "ludhiana": (30.9010, 75.8573),
    "agra": (27.1767, 78.0081),
    "nashik": (19.9975, 73.7898),
    "faridabad": (28.4089, 77.3178),
    "meerut": (28.9845, 77.7064),
    "rajkot": (22.3039, 70.8022),
    "varanasi": (25.3176, 82.9739),
    "gurgaon": (28.4595, 77.0266),
    "gurugram": (28.4595, 77.0266),
    "noida": (28.5355, 77.3910),
    # International (for IP-moves-abroad cases)
    "singapore": (1.3521, 103.8198),
    "dubai": (25.2048, 55.2708),
    "london": (51.5074, -0.1278),
    "new york": (40.7128, -74.0060),
    "hong kong": (22.3193, 114.1694),
}


def haversine_km(a: Tuple[float, float], b: Tuple[float, float]) -> float:
    """Great-circle distance between two (lat, lon) points in km."""
    lat1, lon1 = map(radians, a)
    lat2, lon2 = map(radians, b)
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return 2 * 6371.0 * asin(sqrt(h))


def travel_check(
    last_city: Optional[str],
    last_country: Optional[str],
    last_at: Optional[datetime],
    cur_city: Optional[str],
    cur_country: Optional[str],
    now: Optional[datetime] = None,
) -> Optional[dict]:
    """Return dict with `distance_km`, `minutes`, `implied_kmh` if an
    impossible-travel situation is detected, else None.

    'Impossible' = implied speed > 800 km/h (faster than a commercial jet).
    """
    if not (last_city and cur_city and last_at):
        return None
    a = CITY_COORDS.get(last_city.lower())
    b = CITY_COORDS.get(cur_city.lower())
    if not (a and b):
        return None
    if a == b:
        return None  # same city, nothing to flag

    now = now or datetime.utcnow()
    delta = (now - last_at).total_seconds() / 60.0  # minutes
    if delta <= 0:
        return None
    distance = haversine_km(a, b)
    if distance < 50:
        return None  # too close to matter
    implied_kmh = (distance / delta) * 60.0
    if implied_kmh < 800:
        return None

    return {
        "distance_km": round(distance, 1),
        "minutes": round(delta, 1),
        "implied_kmh": round(implied_kmh, 0),
        "from_city": last_city,
        "to_city": cur_city,
    }
