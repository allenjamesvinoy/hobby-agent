#!/usr/bin/env python3
import sys
import argparse
from src.core.registry import registry

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Autonomous Multi-Agent Hobby Incubator CLI"
    )
    subparsers = parser.add_subparsers(dest="command", help="Available feature subcommands")
    
    # Auto-register all features discovered dynamically in src/features/
    registry.register_all_cli(subparsers)
    return parser

def main() -> None:
    parser = build_parser()
    if len(sys.argv) == 1:
        parser.print_help()
        sys.exit(0)

    args = parser.parse_args()
    if hasattr(args, "func"):
        args.func(args)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
