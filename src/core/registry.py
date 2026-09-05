import importlib
import pkgutil
import argparse
from typing import Dict, Any, Callable
import src.features

class FeatureRegistry:
    """Discovers and registers features automatically from src/features/."""

    def __init__(self) -> None:
        self.features: Dict[str, Any] = {}

    def discover_features(self) -> Dict[str, Any]:
        """Scans the features package directory and imports available feature modules."""
        package = src.features
        for _, module_name, is_pkg in pkgutil.iter_modules(package.__path__):
            if is_pkg and not module_name.startswith("__"):
                try:
                    # Attempt to import feature's cli module first, or root module
                    cli_module_path = f"src.features.{module_name}.cli"
                    try:
                        mod = importlib.import_module(cli_module_path)
                    except ModuleNotFoundError:
                        mod = importlib.import_module(f"src.features.{module_name}")

                    self.features[module_name] = mod
                except Exception as e:
                    print(f"⚠️ Warning: Failed to load feature '{module_name}': {e}")

        return self.features

    def register_all_cli(self, subparsers: Any) -> None:
        """Invokes register_subcommand or register_cli across all discovered features."""
        if not self.features:
            self.discover_features()

        for name, module in self.features.items():
            if hasattr(module, "register_subcommand"):
                module.register_subcommand(subparsers)
            elif hasattr(module, "register_cli"):
                module.register_cli(subparsers)
            elif hasattr(module, "Plugin"):
                plugin_instance = module.Plugin()
                if hasattr(plugin_instance, "register_cli"):
                    plugin_instance.register_cli(subparsers)

registry = FeatureRegistry()
