import sys
import unittest
from pathlib import Path
import tempfile

root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir))

from src.features.sample_notes.service import NoteService
from src.features.sample_notes.models import Note

class TestSampleNotes(unittest.TestCase):
    def test_note_service_crud(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            temp_file = Path(tmpdir) / "notes_test.json"
            service = NoteService(storage_file=temp_file)

            # Initial list empty
            self.assertEqual(len(service.list_notes()), 0)

            # Add note
            note = service.add_note("Test Title", "Test Content")
            self.assertEqual(note.id, 1)
            self.assertEqual(note.title, "Test Title")
            self.assertEqual(len(service.list_notes()), 1)

            # Add second note
            note2 = service.add_note("Second Title", "Second Content")
            self.assertEqual(note2.id, 2)
            self.assertEqual(len(service.list_notes()), 2)

            # Delete note
            deleted = service.delete_note(1)
            self.assertTrue(deleted)
            self.assertEqual(len(service.list_notes()), 1)
            self.assertEqual(service.list_notes()[0].id, 2)

if __name__ == "__main__":
    unittest.main()
