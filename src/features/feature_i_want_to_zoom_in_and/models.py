"""Models for PDF Viewer Touchpad Zooming."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Literal


@dataclass
class ZoomConfig:
    min_zoom: float = 0.25
    max_zoom: float = 5.0
    default_zoom: float = 1.0
    sensitivity: float = 0.005

    def __post_init__(self) -> None:
        if self.min_zoom <= 0:
            raise ValueError("min_zoom must be greater than 0")
        if self.max_zoom < self.min_zoom:
            raise ValueError("max_zoom must be greater than or equal to min_zoom")


@dataclass
class TouchpadEvent:
    event_type: Literal["pinch", "ctrl_scroll"]
    delta_y: float = 0.0
    scale_factor: float = 1.0


@dataclass
class PDFViewerState:
    file_path: str
    current_zoom: float = 1.0
    page_number: int = 1
    total_pages: int = 1
