"""Tests for PDF Viewer Touchpad Zoom Feature."""
from __future__ import annotations
import argparse
import pytest
from src.features.feature_i_want_to_zoom_in_and.models import PDFViewerState, TouchpadEvent, ZoomConfig
from src.features.feature_i_want_to_zoom_in_and.service import PDFZoomService
from src.features.feature_i_want_to_zoom_in_and.cli import register_subcommand


def test_zoom_config_validation():
    with pytest.raises(ValueError, match="min_zoom must be greater than 0"):
        ZoomConfig(min_zoom=-1.0)

    with pytest.raises(ValueError, match="max_zoom must be greater than or equal to min_zoom"):
        ZoomConfig(min_zoom=3.0, max_zoom=1.0)


def test_pinch_zoom_in_and_out():
    service = PDFZoomService()
    state = PDFViewerState(file_path="doc.pdf", current_zoom=1.0)

    event_zoom_in = TouchpadEvent(event_type="pinch", scale_factor=1.5)
    updated = service.process_event(state, event_zoom_in)
    assert updated.current_zoom == 1.5

    event_zoom_out = TouchpadEvent(event_type="pinch", scale_factor=0.5)
    updated = service.process_event(updated, event_zoom_out)
    assert updated.current_zoom == 0.75


def test_zoom_limits():
    config = ZoomConfig(min_zoom=0.5, max_zoom=2.0)
    service = PDFZoomService(config=config)
    state = PDFViewerState(file_path="doc.pdf", current_zoom=1.0)

    event = TouchpadEvent(event_type="pinch", scale_factor=5.0)
    updated = service.process_event(state, event)
    assert updated.current_zoom == 2.0

    event_out = TouchpadEvent(event_type="pinch", scale_factor=0.1)
    updated = service.process_event(updated, event_out)
    assert updated.current_zoom == 0.5


def test_ctrl_scroll_zoom():
    service = PDFZoomService()
    state = PDFViewerState(file_path="doc.pdf", current_zoom=1.0)

    event = TouchpadEvent(event_type="ctrl_scroll", delta_y=-100.0)
    updated = service.process_event(state, event)
    assert updated.current_zoom > 1.0


def test_reset_zoom():
    service = PDFZoomService()
    state = PDFViewerState(file_path="doc.pdf", current_zoom=2.5)
    updated = service.reset_zoom(state)
    assert updated.current_zoom == 1.0


def test_cli_registration(capsys):
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command")
    register_subcommand(subparsers)

    args = parser.parse_args(["pdf-touchpad-zoom", "--file", "test.pdf", "--action", "pinch", "--scale", "1.5"])
    args.func(args)
    captured = capsys.readouterr()
    assert "File: test.pdf" in captured.out
    assert "150%" in captured.out


def test_cli_initial_zoom_clamping(capsys):
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command")
    register_subcommand(subparsers)

    args = parser.parse_args(["pdf-touchpad-zoom", "--initial-zoom", "10.0", "--action", "reset"])
    args.func(args)
    captured = capsys.readouterr()
    assert "100%" in captured.out
