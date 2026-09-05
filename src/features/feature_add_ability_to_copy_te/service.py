import json
import os
import re
from typing import List, Optional
from .models import Flashcard


class PDFReaderService:
    def __init__(self, storage_file: str = "flashcards.json"):
        self.storage_file = storage_file

    def extract_text_from_pdf(self, pdf_path: str, page_num: int = 1) -> str:
        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"PDF file not found: {pdf_path}")

        try:
            import pypdf
            reader = pypdf.PdfReader(pdf_path)
            if page_num < 1 or page_num > len(reader.pages):
                raise ValueError(f"Page number {page_num} out of bounds (1-{len(reader.pages)})")
            return reader.pages[page_num - 1].extract_text() or ""
        except ImportError:
            pass

        with open(pdf_path, "rb") as f:
            content = f.read().decode("latin-1", errors="ignore")

        text_matches = re.findall(r"\((.*?)\)\s*Tj", content)
        if text_matches:
            return " ".join(text_matches)

        cleaned = re.sub(r"[^\x20-\x7E\n]", " ", content)
        return cleaned.strip()

    def select_snippet(self, full_text: str, start_char: int = 0, length: Optional[int] = None) -> str:
        if start_char < 0:
            start_char = 0
        if length is None:
            return full_text[start_char:].strip()
        if length < 0:
            length = 0
        return full_text[start_char : start_char + length].strip()

    def create_flashcard(
        self, front: str, back: str, pdf_path: str, page_num: int
    ) -> Flashcard:
        card = Flashcard(
            front=front.strip(),
            back=back.strip(),
            source_pdf=pdf_path,
            page_num=page_num,
        )
        self.save_flashcard(card)
        return card

    def save_flashcard(self, card: Flashcard) -> None:
        cards = self.load_flashcards()
        cards.append(card)
        dirname = os.path.dirname(self.storage_file)
        if dirname:
            os.makedirs(dirname, exist_ok=True)
        with open(self.storage_file, "w", encoding="utf-8") as f:
            json.dump([c.to_dict() for c in cards], f, indent=2)

    def load_flashcards(self) -> List[Flashcard]:
        if not os.path.exists(self.storage_file):
            return []
        try:
            with open(self.storage_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                return [Flashcard.from_dict(item) for item in data]
        except (json.JSONDecodeError, OSError, TypeError):
            return []
