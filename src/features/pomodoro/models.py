from dataclasses import dataclass
from enum import Enum


class SessionType(Enum):
    WORK = "work"
    SHORT_BREAK = "short_break"
    LONG_BREAK = "long_break"


@dataclass
class PomodoroConfig:
    work_duration: int = 25
    short_break_duration: int = 5
    long_break_duration: int = 15
    long_break_interval: int = 4


@dataclass
class SessionState:
    session_type: SessionType
    duration_seconds: int
    elapsed_seconds: int = 0
    completed: bool = False
