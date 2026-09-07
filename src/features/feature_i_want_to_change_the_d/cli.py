import argparse
from typing import Any
from .service import ThemeService


def register_subcommand(subparsers: Any) -> None:
    parser = subparsers.add_parser(
        "theme",
        help="Manage display themes and default Notion light mode styling.",
    )
    parser.set_defaults(func=lambda args: parser.print_help())

    theme_subparsers = parser.add_subparsers(dest="theme_command")

    set_light_parser = theme_subparsers.add_parser(
        "set-light",
        help="Set the default CLI style to Notion Light Mode.",
    )
    set_light_parser.set_defaults(func=handle_set_light)

    show_parser = theme_subparsers.add_parser(
        "show",
        help="Show active theme configuration.",
    )
    show_parser.set_defaults(func=handle_show)

    preview_parser = theme_subparsers.add_parser(
        "preview",
        help="Preview Notion-styled light output.",
    )
    preview_parser.add_argument("--title", default="Welcome to Notion Style", help="Card title")
    preview_parser.add_argument("--body", default="Clean, minimalistic off-white layout.", help="Card body")
    preview_parser.set_defaults(func=handle_preview)


def handle_set_light(args: argparse.Namespace) -> None:
    service = ThemeService()
    config = service.set_light_mode()
    print(f"Theme updated successfully! Default mode set to: {config.active_theme} ({config.palette.name})")


def handle_show(args: argparse.Namespace) -> None:
    service = ThemeService()
    config = service.get_config()
    print(f"Active Theme: {config.active_theme}")
    print(f"Palette: {config.palette.name}")
    print(f" - Primary Text (fg): {config.palette.fg}")
    print(f" - Background (bg): {config.palette.bg}")
    print(f" - Accent: {config.palette.accent}")
    print(f" - Muted Text: {config.palette.muted}")
    print(f" - Border: {config.palette.border}")


def handle_preview(args: argparse.Namespace) -> None:
    service = ThemeService()
    preview = service.format_notion_card(args.title, args.body)
    print(preview)
