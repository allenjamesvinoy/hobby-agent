import time
from typing import Callable, Optional
from src.features.pomodoro.models import PomodoroConfig, SessionState, SessionType


class PomodoroService:
    def __init__(self, config: Optional[PomodoroConfig] = None):
        self.config = config or PomodoroConfig()
        self.completed_work_sessions = 0

    def get_next_break_type(self) -> SessionType:
        if self.completed_work_sessions > 0 and self.completed_work_sessions % self.config.long_break_interval == 0:
            return SessionType.LONG_BREAK
        return SessionType.SHORT_BREAK

    def create_session(self, session_type: SessionType) -> SessionState:
        if session_type == SessionType.WORK:
            duration = self.config.work_duration * 60
        elif session_type == SessionType.SHORT_BREAK:
            duration = self.config.short_break_duration * 60
        else:
            duration = self.config.long_break_duration * 60
        return SessionState(session_type=session_type, duration_seconds=duration)

    def tick(self, state: SessionState, seconds: int = 1) -> SessionState:
        if state.completed:
            return state
        state.elapsed_seconds += seconds
        if state.elapsed_seconds >= state.duration_seconds:
            state.elapsed_seconds = state.duration_seconds
            state.completed = True
            if state.session_type == SessionType.WORK:
                self.completed_work_sessions += 1
        return state

    def format_time(self, seconds: int) -> str:
        mins, secs = divmod(seconds, 60)
        return f"{mins:02d}:{secs:02d}"

    def run_timer(
        self,
        state: SessionState,
        tick_callback: Optional[Callable[[SessionState], None]] = None,
        sleep_fn: Callable[[float], None] = time.sleep,
    ) -> None:
        while not state.completed:
            sleep_fn(1.0)
            self.tick(state, 1)
            if tick_callback:
                tick_callback(state)
