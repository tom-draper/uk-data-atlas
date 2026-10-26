"""Typed client for the UK Data Atlas API."""

from .client import DEFAULT_BASE_URL, AtlasClient, AtlasError

__all__ = ("DEFAULT_BASE_URL", "AtlasClient", "AtlasError")
