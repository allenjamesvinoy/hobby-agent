import argparse
from pathlib import Path
from src.features.feature_i_want_to_change_the_d.models import ThemeConfig
from src.features.feature_i_want_to_change_the_d.service import ThemeService
from src.features.feature_i_want_to_change_the_d.cli import (
    register_subcommand,
    handle_set_light,
    handle_show,
    handle_preview,
)


def test_theme_config_default():
    config = ThemeConfig()
    assert config.active_theme == "light_notion"
    assert config.palette.name == "Notion Light"
    assert config.palette.fg == "#37352F"


def test_theme_service_save_and_get(tmp_path: Path):
    config_file = tmp_path / "theme_config.json"
    service = ThemeService(config_path=config_file)

    config = service.set_light_mode()
    assert config_file.exists()

    loaded_config = service.get_config()
    assert loaded_config.active_theme == "light_notion"
    assert loaded_config.palette.bg == "#F7F6F3"


def test_theme_service_invalid_config_fallback(tmp_path: Path):
    config_file = tmp_path / "corrupted_config.json"
    config_file.write_text("invalid json...", encoding="utf-8")
    service = ThemeService(config_path=config_file)

    config = service.get_config()
    assert config.active_theme == "light_notion"


def test_theme_service_format_notion_card(tmp_path: Path):
    config_file = tmp_path / "theme_config.json"
    service = ThemeService(config_path=config_file)
    service.set_light_mode()

    formatted = service.format_notion_card("Test Title", "Test Body")
    assert "Notion Light" in formatted
    assert "Title: Test Title" in formatted
    assert "Content: Test Body" in formatted


def test_register_subcommand():
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="subcommand")
    register_subcommand(subparsers)

    args = parser.parse_args(["theme", "set-light"])
    assert args.theme_command == "set-light"


def test_cli_handlers(capsys, tmp_path: Path, monkeypatch):
    config_file = tmp_path / "theme_config.json"
    monkeypatch.setattr(
        "src.features.feature_i_want_to_change_the_d.cli.ThemeService",
        lambda: ThemeService(config_path=config_file),
    )

    args = argparse.Namespace()
    handle_set_light(args)
    captured = capsys.readouterr()
    assert "Theme updated successfully" in captured.out

    handle_show(args)
    captured = capsys.readouterr()
    assert "Active Theme: light_notion" in captured.out

    preview_args = argparse.Namespace(title="Hello", body="World")
    handle_preview(preview_args)
    captured = capsys.readouterr()
    assert "Title: Hello" in captured.out
