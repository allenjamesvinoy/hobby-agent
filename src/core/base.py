from typing import Protocol, Any
import argparse

class FeaturePlugin(Protocol):
    """Protocol that all feature plugins can implement for CLI discovery."""
    
    @property
    def name(self) -> str:
        """The command/feature name."""
        ...

    def register_cli(self, subparsers: Any) -> None:
        """Register arguments on the argparse subparser."""
        ...
