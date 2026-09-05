"""Core modules for dynamic feature registration and shared configuration."""
from src.core.base import FeaturePlugin
from src.core.config import Config
from src.core.registry import registry

__all__ = ["FeaturePlugin", "Config", "registry"]
