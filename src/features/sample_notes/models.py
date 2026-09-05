from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Dict, Any

@dataclass
class Note:
    id: int
    title: str
    content: str
    created_at: str

    @classmethod
    def create(cls, id: int, title: str, content: str) -> "Note":
        return cls(
            id=id,
            title=title,
            content=content,
            created_at=datetime.now(timezone.utc).isoformat()
        )

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Note":
        return cls(**data)
