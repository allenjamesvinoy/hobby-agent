import json
from pathlib import Path
from typing import List, Optional
from src.core.config import Config
from src.features.sample_notes.models import Note

class NoteService:
    """Manages notes persistence in a JSON store."""

    def __init__(self, storage_file: Optional[Path] = None) -> None:
        self.file_path = storage_file or (Config.DATA_DIR / "notes.json")
        self._ensure_storage()

    def _ensure_storage(self) -> None:
        if not self.file_path.exists():
            self.file_path.parent.mkdir(parents=True, exist_ok=True)
            self._save([])

    def _load(self) -> List[dict]:
        try:
            with open(self.file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []

    def _save(self, data: List[dict]) -> None:
        with open(self.file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    def list_notes(self) -> List[Note]:
        raw = self._load()
        return [Note.from_dict(item) for item in raw]

    def add_note(self, title: str, content: str) -> Note:
        notes = self.list_notes()
        new_id = (max([n.id for n in notes], default=0)) + 1
        new_note = Note.create(id=new_id, title=title, content=content)
        notes.append(new_note)
        self._save([n.to_dict() for n in notes])
        return new_note

    def delete_note(self, note_id: int) -> bool:
        notes = self.list_notes()
        filtered = [n for n in notes if n.id != note_id]
        if len(filtered) == len(notes):
            return False
        self._save([n.to_dict() for n in filtered])
        return True
