import os
import glob
from pathlib import Path
from typing import List, Optional

class ContextLoader:
    """Extracts strictly scoped context to prevent token bloat and context overload."""

    def __init__(self, repo_root: Optional[Path] = None) -> None:
        self.root = repo_root or Path(__file__).resolve().parent.parent

    def get_architecture_map(self) -> str:
        arch_path = self.root / "ARCHITECTURE.md"
        if arch_path.exists():
            return f"--- ARCHITECTURE.md ---\n{arch_path.read_text(encoding='utf-8')}"
        return ""

    def get_core_interfaces(self) -> str:
        interfaces = []
        base_path = self.root / "src" / "core" / "base.py"
        if base_path.exists():
            interfaces.append(f"--- src/core/base.py ---\n{base_path.read_text(encoding='utf-8')}")
        return "\n\n".join(interfaces)

    def detect_target_feature(self, query: str) -> Optional[str]:
        """Detects if the query targets an existing feature directory."""
        features_dir = self.root / "src" / "features"
        if not features_dir.exists():
            return None

        query_lower = query.lower()
        for item in features_dir.iterdir():
            if item.is_dir() and not item.name.startswith("__"):
                clean_name = item.name.replace("_", " ").lower()
                if item.name.lower() in query_lower or clean_name in query_lower:
                    return item.name
        return None

    def get_feature_context(self, feature_name: str) -> str:
        """Reads only the files inside the specified feature slice."""
        feature_dir = self.root / "src" / "features" / feature_name
        if not feature_dir.exists():
            return ""

        context_chunks = []
        for file_path in feature_dir.glob("*.py"):
            try:
                rel_path = file_path.relative_to(self.root)
                content = file_path.read_text(encoding="utf-8")
                context_chunks.append(f"--- {rel_path} ---\n{content}")
            except Exception:
                continue

        return "\n\n".join(context_chunks)

    def assemble_targeted_context(self, idea_title: str, idea_body: str) -> str:
        """Assembles a minimal, context-safe prompt payload."""
        combined_text = f"{idea_title} {idea_body}"
        target_feature = self.detect_target_feature(combined_text)

        chunks = [self.get_architecture_map(), self.get_core_interfaces()]

        if target_feature:
            print(f"🎯 Target feature detected: '{target_feature}' (Loading its files only)")
            chunks.append(self.get_feature_context(target_feature))
        else:
            print("✨ Brand new feature detected (No existing feature files loaded)")

        return "\n\n".join([c for c in chunks if c.strip()])
