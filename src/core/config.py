import os
from pathlib import Path

class Config:
    """Base application settings and storage path definitions."""
    PROJECT_ROOT: Path = Path(__file__).resolve().parent.parent.parent
    DATA_DIR: Path = PROJECT_ROOT / "data"

    @classmethod
    def ensure_directories(cls) -> None:
        """Ensure runtime directories exist."""
        cls.DATA_DIR.mkdir(parents=True, exist_ok=True)

# Ensure required runtime directories exist on load
Config.ensure_directories()
