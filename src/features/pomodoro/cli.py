import argparse
from src.features.pomodoro.models import PomodoroConfig, SessionType
from src.features.pomodoro.service import PomodoroService


def handle_start(args: argparse.Namespace) -> None:
    config = PomodoroConfig(
        work_duration=args.work,
        short_break_duration=args.short_break,
        long_break_duration=args.long_break,
        long_break_interval=args.interval,
    )
    service = PomodoroService(config)
    session_type = SessionType(args.type)
    session = service.create_session(session_type)

    duration_min = session.duration_seconds // 60
    print(f"Starting {session.session_type.value} session ({duration_min} min)... ")

    if args.dry_run:
        print("Dry run complete.")
        return

    def callback(state):
        remaining = state.duration_seconds - state.elapsed_seconds
        print(f"\rTime remaining: {service.format_time(remaining)}", end="", flush=True)

    service.run_timer(session, tick_callback=callback)
    print("\nSession complete!")


def register_subcommand(subparsers: argparse._SubParsersAction) -> None:
    parser = subparsers.add_parser("pomodoro", help="Pomodoro timer CLI")
    parser.add_argument("--work", type=int, default=25, help="Work duration in minutes")
    parser.add_argument("--short-break", type=int, default=5, help="Short break duration in minutes")
    parser.add_argument("--long-break", type=int, default=15, help="Long break duration in minutes")
    parser.add_argument("--interval", type=int, default=4, help="Long break interval in sessions")
    parser.add_argument(
        "--type",
        choices=["work", "short_break", "long_break"],
        default="work",
        help="Session type",
    )
    parser.add_argument("--dry-run", action="store_true", help="Initialize without running full timer")
    parser.set_defaults(func=handle_start)
