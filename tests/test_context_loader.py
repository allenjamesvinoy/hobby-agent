import sys
import unittest
from pathlib import Path

root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir))

from pipeline.context_loader import ContextLoader

class TestContextLoader(unittest.TestCase):
    def test_context_loader_brand_new_feature(self):
        loader = ContextLoader(root_dir)
        context = loader.assemble_targeted_context("New Crypto Tracker", "Fetch Bitcoin prices")
        
        # Must include ARCHITECTURE.md and base.py
        self.assertIn("ARCHITECTURE.md", context)
        self.assertIn("FeaturePlugin", context)
        # Must NOT include sample_notes implementation details to avoid context bloat
        self.assertNotIn("NoteService", context)

    def test_context_loader_web_app(self):
        loader = ContextLoader(root_dir)
        context = loader.assemble_targeted_context("[React App] Research Paper Companion", "Local React tool with flashcards")
        
        self.assertIn("ARCHITECTURE.md", context)
        # Web app should not load Python base interfaces
        self.assertNotIn("FeaturePlugin", context)
        self.assertNotIn("NoteService", context)

    def test_context_loader_existing_feature_match(self):
        loader = ContextLoader(root_dir)
        context = loader.assemble_targeted_context("Update sample notes", "Add markdown export to notes")
        
        # Must detect target feature and load its files
        self.assertIn("sample_notes", context)
        self.assertIn("NoteService", context)

if __name__ == "__main__":
    unittest.main()
