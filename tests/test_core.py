import sys
import unittest
from pathlib import Path
import argparse

# Ensure project root is in path
root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir))

from src.core.registry import FeatureRegistry
from src.core.config import Config

class TestCore(unittest.TestCase):
    def test_config_data_dir(self):
        self.assertTrue(Config.DATA_DIR.exists())

    def test_feature_discovery(self):
        registry = FeatureRegistry()
        features = registry.discover_features()
        self.assertIn("sample_notes", features)

    def test_feature_cli_registration(self):
        registry = FeatureRegistry()
        parser = argparse.ArgumentParser()
        subparsers = parser.add_subparsers(dest="command")
        registry.register_all_cli(subparsers)
        
        # Check that 'notes' was added to subparsers
        self.assertIn("notes", subparsers.choices)

if __name__ == "__main__":
    unittest.main()
