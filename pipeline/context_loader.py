import os
from pathlib import Path
from typing import List, Optional, Tuple

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
        base_path = self.root / "src" / "core" / "base.py"
        if base_path.exists():
            return f"--- src/core/base.py ---\n{base_path.read_text(encoding='utf-8')}"
        return ""

    def detect_target_project(self, query: str) -> Optional[Tuple[str, Path]]:
        """Detects if query targets an existing directory in src/features/ or apps/."""
        query_lower = query.lower()
        search_dirs = [
            ("feature", self.root / "src" / "features"),
            ("app", self.root / "apps")
        ]

        for p_type, base_dir in search_dirs:
            if not base_dir.exists():
                continue
            for item in base_dir.iterdir():
                if item.is_dir() and not item.name.startswith((".", "__")):
                    clean_name = item.name.replace("_", " ").replace("-", " ").lower()
                    if item.name.lower() in query_lower or clean_name in query_lower:
                        return (p_type, item)
        return None

    def get_directory_context(self, target_dir: Path) -> str:
        """Reads code files inside the target directory while ignoring build artifacts."""
        context_chunks = []
        valid_exts = {".py", ".js", ".jsx", ".ts", ".tsx", ".json", ".html", ".css"}
        ignore_dirs = {"node_modules", "dist", "build", "__pycache__", ".git"}

        for root, dirs, files in os.walk(target_dir):
            dirs[:] = [d for d in dirs if d not in ignore_dirs and not d.startswith(".")]
            for file in files:
                ext = Path(file).suffix.lower()
                if ext in valid_exts:
                    file_path = Path(root) / file
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
        target = self.detect_target_project(combined_text)

        chunks = [self.get_architecture_map()]

        if target:
            p_type, p_dir = target
            print(f"🎯 Target {p_type} detected: '{p_dir.name}' (Loading its files only)")
            if p_type == "feature":
                chunks.append(self.get_core_interfaces())
            chunks.append(self.get_directory_context(p_dir))
        else:
            print("✨ Brand new project detected (No existing project files loaded)")
            # If not explicitly a web app, provide base interfaces just in case
            if not any(k in combined_text.lower() for k in ["react", "frontend", "web", "html", "css", "ui"]):
                chunks.append(self.get_core_interfaces())

        return "\n\n".join([c for c in chunks if c.strip()])
