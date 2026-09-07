"""Service logic for adjusting PDF zoom based on touchpad gestures."""
from __future__ import annotations
from .models import PDFViewerState, TouchpadEvent, ZoomConfig


class PDFZoomService:
    def __init__(self, config: ZoomConfig | None = None):
        self.config = config or ZoomConfig()

    def clamp_zoom(self, zoom: float) -> float:
        return max(self.config.min_zoom, min(self.config.max_zoom, round(zoom, 4)))

    def apply_pinch(self, state: PDFViewerState, scale_factor: float) -> PDFViewerState:
        new_zoom = self.clamp_zoom(state.current_zoom * scale_factor)
        state.current_zoom = new_zoom
        return state

    def apply_ctrl_scroll(self, state: PDFViewerState, delta_y: float) -> PDFViewerState:
        change = -delta_y * self.config.sensitivity
        new_zoom = self.clamp_zoom(state.current_zoom + change)
        state.current_zoom = new_zoom
        return state

    def process_event(self, state: PDFViewerState, event: TouchpadEvent) -> PDFViewerState:
        if event.event_type == "pinch":
            return self.apply_pinch(state, event.scale_factor)
        elif event.event_type == "ctrl_scroll":
            return self.apply_ctrl_scroll(state, event.delta_y)
        return state

    def reset_zoom(self, state: PDFViewerState) -> PDFViewerState:
        state.current_zoom = self.config.default_zoom
        return state
