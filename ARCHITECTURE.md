# Repository Architecture Map & Agent Guidelines

## 1. System Overview
This project is an extensible, modular incubator designed for autonomous agent development. Features are structured as **Vertical Slices** inside `src/features/` and auto-registered at runtime.

## 2. Rules for AI Agents
1. **Vertical Isolation**: Put all files for a new feature inside `src/features/<feature_name>/`.
2. **Never Edit Core**: Do NOT modify `src/core/` or `main.py` unless explicitly commanded.
3. **Auto-Discovery Contract**: Every feature module under `src/features/<feature_name>/` must expose a `cli.py` with a `register_subcommand(subparsers)` function or a `Plugin` class in `__init__.py`.
4. **File Length Limit**: Keep all files under 150 lines of code. Split into `models.py`, `service.py`, `cli.py`, etc.
5. **No Monolithic Imports**: Only import from `src.core.base` or your own feature slice. Never cross-import other features directly.

## 3. Directory Layout
- `src/core/`: Immutable core system (Plugin base classes, dynamic registry, config).
- `src/features/`: Isolated feature plugins (each directory is independent).
- `pipeline/`: Multi-agent orchestration, context isolation loader, and execution scripts.
- `tests/`: Automated unit tests for core and features.
- `.github/workflows/`: GitHub Actions workflows for autonomous code generation and CI.
