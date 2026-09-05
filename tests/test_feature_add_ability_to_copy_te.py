import io
import os
import tempfile
import unittest
from unittest.mock import patch
import argparse

from src.features.feature_add_ability_to_copy_te.models import Flashcard
from src.features.feature_add_ability_to_copy_te.service import PDFReaderService
from src.features.feature_add_ability_to_copy_te.cli import register_subcommand, handle_cli


class TestPDFCopyFeature(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.pdf_path = os.path.join(self.temp_dir.name, "sample.pdf")
        self.storage_path = os.path.join(self.temp_dir.name, "sub", "cards.json")

        with open(self.pdf_path, "wb") as f:
            f.write(b"%PDF-1.4\n(Hello PDF World) Tj\n")

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_flashcard_model(self):
        card = Flashcard(front="Question", back="Answer", source_pdf="doc.pdf", page_num=1)
        data = card.to_dict()
        self.assertEqual(data["front"], "Question")
        self.assertEqual(data["back"], "Answer")

        # Test ignoring extra fields
        data_with_extra = data.copy()
        data_with_extra["extra_field"] = "ignore_me"
        loaded = Flashcard.from_dict(data_with_extra)
        self.assertEqual(loaded.front, "Question")

    def test_extract_text_fallback(self):
        service = PDFReaderService(storage_file=self.storage_path)
        text = service.extract_text_from_pdf(self.pdf_path, page_num=1)
        self.assertIn("Hello PDF World", text)

    def test_extract_text_file_not_found(self):
        service = PDFReaderService(storage_file=self.storage_path)
        with self.assertRaises(FileNotFoundError):
            service.extract_text_from_pdf("nonexistent.pdf")

    def test_select_snippet(self):
        service = PDFReaderService(storage_file=self.storage_path)
        text = "The quick brown fox jumps over the lazy dog."
        snippet = service.select_snippet(text, start_char=4, length=15)
        self.assertEqual(snippet, "quick brown fox")

        # Edge cases
        self.assertEqual(service.select_snippet(text, start_char=-5), text.strip())
        self.assertEqual(service.select_snippet(text, start_char=0, length=-5), "")

    def test_create_and_load_flashcard(self):
        service = PDFReaderService(storage_file=self.storage_path)
        card = service.create_flashcard(
            front="What jumps over lazy dog?",
            back="Quick brown fox",
            pdf_path=self.pdf_path,
            page_num=1,
        )
        self.assertEqual(card.front, "What jumps over lazy dog?")

        cards = service.load_flashcards()
        self.assertEqual(len(cards), 1)
        self.assertEqual(cards[0].back, "Quick brown fox")

    def test_cli_subcommands(self):
        parser = argparse.ArgumentParser()
        subparsers = parser.add_subparsers()
        register_subcommand(subparsers)

        # Test CLI read
        args = parser.parse_args(["pdf-copy", "read", "--pdf", self.pdf_path, "--start", "0", "--length", "5"])
        with patch("sys.stdout", new=io.StringIO()) as fake_out:
            handle_cli(args)
            output = fake_out.getvalue()
            self.assertIn("EXTRACTED TEXT SNIPPET", output)

        # Test CLI make-card
        args = parser.parse_args([
            "pdf-copy", "make-card",
            "--pdf", self.pdf_path,
            "--front", "Question",
            "--back", "Answer",
            "--storage", self.storage_path
        ])
        with patch("sys.stdout", new=io.StringIO()) as fake_out:
            handle_cli(args)
            output = fake_out.getvalue()
            self.assertIn("Flashcard created successfully", output)

        # Test CLI list-cards
        args = parser.parse_args(["pdf-copy", "list-cards", "--storage", self.storage_path])
        with patch("sys.stdout", new=io.StringIO()) as fake_out:
            handle_cli(args)
            output = fake_out.getvalue()
            self.assertIn("Found 1 flashcard(s)", output)

        # Test CLI no subcommand
        args = parser.parse_args(["pdf-copy"])
        with patch("sys.stdout", new=io.StringIO()) as fake_out:
            handle_cli(args)
            output = fake_out.getvalue()
            self.assertIn("Please specify a valid subcommand", output)


if __name__ == "__main__":
    unittest.main()
