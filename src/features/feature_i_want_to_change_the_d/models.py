from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, Any


class ThemeMode(str, Enum):
    LIGHT_NOTION = "light_notion"
    DARK = "dark"


@dataclass
class ColorPalette:
    name: str
    bg: str
    fg: str
    muted: str
    accent: str
    border: str


NOTION_LIGHT_PALETTE = ColorPalette(
    name="Notion Light",
    bg="#F7F6F3",
    fg="#37352F",
    muted="#787774",
    accent="#0B6E99",
    border="#E1E0DC",
)


@dataclass
class ThemeConfig:
    active_theme: str = ThemeMode.LIGHT_NOTION.value
    palette: ColorPalette = field(default_factory=lambda: NOTION_LIGHT_PALETTE)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "active_theme": self.active_theme,
            "palette": {
                "name": self.palette.name,
                "bg": self.palette.bg,
                "fg": self.palette.fg,
                "muted": self.palette.muted,
                "accent": self.palette.accent,
                "border": self.palette.border,
            },
        }
