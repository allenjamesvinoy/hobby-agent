import unittest
import argparse
from src.features.pomodoro.models import PomodoroConfig, SessionType
from src.features.pomodoro.service import PomodoroService
from src.features.pomodoro.cli import register_subcommand


class TestPomodoro(unittest.TestCase):
    def test_default_config(self):
        config = PomodoroConfig()
        self.assertEqual(config.work_duration, 25)
        self.assertEqual(config.short_break_duration, 5)
        self.assertEqual(config.long_break_duration, 15)
        self.assertEqual(config.long_break_interval, 4)

    def test_create_session(self):
        service = PomodoroService()
        session = service.create_session(SessionType.WORK)
        self.assertEqual(session.duration_seconds, 25 * 60)
        self.assertFalse(session.completed)

    def test_tick_session(self):
        service = PomodoroService()
        session = service.create_session(SessionType.SHORT_BREAK)
        service.tick(session, 100)
        self.assertEqual(session.elapsed_seconds, 100)
        self.assertFalse(session.completed)

        service.tick(session, 200)
        self.assertEqual(session.elapsed_seconds, 300)
        self.assertTrue(session.completed)

    def test_run_timer_mock_sleep(self):
        service = PomodoroService(PomodoroConfig(work_duration=1))
        session = service.create_session(SessionType.WORK)
        ticks = []

        def cb(st):
            ticks.append(st.elapsed_seconds)

        def mock_sleep(s):
            pass

        service.run_timer(session, tick_callback=cb, sleep_fn=mock_sleep)
        self.assertTrue(session.completed)
        self.assertEqual(len(ticks), 60)
        self.assertEqual(service.completed_work_sessions, 1)

    def test_break_type_logic(self):
        service = PomodoroService()
        self.assertEqual(service.get_next_break_type(), SessionType.SHORT_BREAK)
        service.completed_work_sessions = 4
        self.assertEqual(service.get_next_break_type(), SessionType.LONG_BREAK)

    def test_register_subcommand(self):
        parser = argparse.ArgumentParser()
        subparsers = parser.add_subparsers()
        register_subcommand(subparsers)
        args = parser.parse_args(["pomodoro", "--work", "20", "--dry-run"])
        self.assertEqual(args.work, 20)
        self.assertTrue(args.dry_run)

    def test_handle_start_dry_run(self):
        parser = argparse.ArgumentParser()
        subparsers = parser.add_subparsers()
        register_subcommand(subparsers)
        args = parser.parse_args(["pomodoro", "--type", "long_break", "--long-break", "20", "--dry-run"])
        args.func(args)
        self.assertEqual(args.long_break, 20)


if __name__ == "__main__":
    unittest.main()
