import json
from pathlib import Path
from typing import Optional
from .models import ThemeConfig, ColorPalette, NOTION_LIGHT_PALETTE, ThemeMode

DEFAULT_CONFIG_PATH = Path.home() / ".incubator_theme_config.json"


class ThemeService:
    def __init__(self, config_path: Optional[Path] = None):
        self.config_path = config_path or DEFAULT_CONFIG_PATH

    def get_config(self) -> ThemeConfig:
        if self.config_path.exists():
            try:
                data = json.loads(self.config_path.read_text(encoding="utf-8"))
                p_data = data.get("palette", {})
                palette = ColorPalette(
                    name=p_data.get("name", NOTION_LIGHT_PALETTE.name),
                    bg=p_data.get("bg", NOTION_LIGHT_PALETTE.bg),
                    fg=p_data.get("fg", NOTION_LIGHT_PALETTE.fg),
                    muted=p_data.get("muted", NOTION_LIGHT_PALETTE.muted),
                    accent=p_data.get("accent", NOTION_LIGHT_PALETTE.accent),
                    border=p_data.get("border", NOTION_LIGHT_PALETTE.border),
                )
                return ThemeConfig(
                    active_theme=data.get("active_theme", ThemeMode.LIGHT_NOTION.value),
                    palette=palette,
                )
            except (json.JSONDecodeError, KeyError, TypeError, ValueError, OSError):
                pass
        return ThemeConfig()

    def set_light_mode(self) -> ThemeConfig:
        config = ThemeConfig(
            active_theme=ThemeMode.LIGHT_NOTION.value,
            palette=NOTION_LIGHT_PALETTE,
        )
        self.save_config(config)
        return config

    def save_config(self, config: ThemeConfig) -> None:
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        self.config_path.write_text(
            json.dumps(config.to_dict(), indent=2),
            encoding="utf-8",
        )

    def format_notion_card(self, title: str, body: str) -> str:
        config = self.get_config()
        palette = config.palette
        header = f"[{palette.name} Mode]"
        divider = "─" * 40
        return (
            f"{header}\n"
            f"Border: {palette.border} | BG: {palette.bg}\n"
            f"{divider}\n"
            f"Title: {title} (Color: {palette.fg})\n"
            f"Content: {body}\n"
            f"Accent: {palette.accent} | Muted: {palette.muted}\n"
            f"{divider}"
        )
