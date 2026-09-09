import sys
import unittest
import json
import tempfile
import os
from pathlib import Path

root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir))

from pipeline.run_agents import (
    detect_project_kind,
    get_idea_details,
    extract_image_urls,
    safe_parse_json,
    check_syntax,
)
from pipeline.context_loader import ContextLoader

class TestPipelineAgents(unittest.TestCase):
    def test_detect_project_kind_with_target_app(self):
        loader = ContextLoader(root_dir)
        target = loader.detect_target_project("[Feature] apps/desktop_app_local_first_resear - not movable")
        self.assertIsNotNone(target)
        kind = detect_project_kind(
            "[Feature] apps/desktop_app_local_first_resear - right now the app is not movable in minimize mode on Mac",
            "",
            target=target
        )
        self.assertEqual(kind, "web")

    def test_detect_project_kind_with_desktop_keywords(self):
        kind = detect_project_kind(
            "apps/desktop_app_local_first_resear - window not draggable on Mac",
            None
        )
        self.assertEqual(kind, "web")

    def test_detect_project_kind_default_cli(self):
        kind = detect_project_kind("Add a habit tracker", "Streak counter with sqlite")
        self.assertEqual(kind, "python_cli")

    def test_get_idea_details_with_null_body(self):
        with tempfile.NamedTemporaryFile("w", delete=False, suffix=".json") as f:
            json.dump({"issue": {"title": "Test Issue", "body": None}}, f)
            temp_path = f.name

        old_event = os.environ.get("GITHUB_EVENT_PATH")
        old_title = os.environ.get("IDEA_TITLE")
        old_body = os.environ.get("IDEA_BODY")
        try:
            if "IDEA_TITLE" in os.environ:
                del os.environ["IDEA_TITLE"]
            if "IDEA_BODY" in os.environ:
                del os.environ["IDEA_BODY"]
            os.environ["GITHUB_EVENT_PATH"] = temp_path

            title, body = get_idea_details()
            self.assertEqual(title, "Test Issue")
            self.assertEqual(body, "")
            self.assertIsInstance(body, str)
        finally:
            os.remove(temp_path)
            if old_event:
                os.environ["GITHUB_EVENT_PATH"] = old_event
            elif "GITHUB_EVENT_PATH" in os.environ:
                del os.environ["GITHUB_EVENT_PATH"]
            if old_title:
                os.environ["IDEA_TITLE"] = old_title
            if old_body:
                os.environ["IDEA_BODY"] = old_body

    def test_extract_image_urls(self):
        text = """
        Here is a screenshot:
        ![Screenshot](https://github.com/user-attachments/assets/abc-123)
        And another:
        <img src="https://user-images.githubusercontent.com/999/image.png" width="400" />
        """
        urls = extract_image_urls(text)
        self.assertIn("https://github.com/user-attachments/assets/abc-123", urls)
        self.assertIn("https://user-images.githubusercontent.com/999/image.png", urls)

    def test_safe_parse_json(self):
        payload = '```json\n{"files": {"main.py": "print(\'hello\')"}}\n```'
        parsed = safe_parse_json(payload)
        self.assertIn("files", parsed)
        self.assertEqual(parsed["files"]["main.py"], "print('hello')")

if __name__ == "__main__":
    unittest.main()
