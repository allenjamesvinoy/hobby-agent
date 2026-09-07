"""CLI subcommand integration for PDF Touchpad Zoom feature."""
from __future__ import annotations
import argparse
from typing import Any
from .models import PDFViewerState, TouchpadEvent, ZoomConfig
from .service import PDFZoomService


def handle_cmd(args: argparse.Namespace) -> None:
    config = ZoomConfig(min_zoom=args.min_zoom, max_zoom=args.max_zoom)
    service = PDFZoomService(config=config)
    initial_zoom = service.clamp_zoom(args.initial_zoom)
    state = PDFViewerState(file_path=args.file, current_zoom=initial_zoom)

    if args.action == "pinch":
        event = TouchpadEvent(event_type="pinch", scale_factor=args.scale)
        state = service.process_event(state, event)
    elif args.action == "scroll":
        event = TouchpadEvent(event_type="ctrl_scroll", delta_y=args.delta_y)
        state = service.process_event(state, event)
    elif args.action == "reset":
        state = service.reset_zoom(state)

    print(f"File: {state.file_path}")
    print(f"Zoom Level: {int(state.current_zoom * 100)}% ({state.current_zoom:.2f}x)")


def register_subcommand(subparsers: Any) -> None:
    parser = subparsers.add_parser(
        "pdf-touchpad-zoom",
        help="Simulate and calculate PDF viewer zoom levels via touchpad gestures"
    )
    parser.add_argument("--file", type=str, default="sample.pdf", help="Target PDF file path")
    parser.add_argument("--initial-zoom", type=float, default=1.0, help="Initial zoom factor")
    parser.add_argument("--action", choices=["pinch", "scroll", "reset"], default="pinch", help="Touchpad action")
    parser.add_argument("--scale", type=float, default=1.2, help="Pinch gesture scale factor")
    parser.add_argument("--delta-y", type=float, default=-50.0, help="Touchpad scroll delta Y")
    parser.add_argument("--min-zoom", type=float, default=0.25, help="Minimum zoom limit")
    parser.add_argument("--max-zoom", type=float, default=5.0, help="Maximum zoom limit")

    parser.set_defaults(func=handle_cmd)
