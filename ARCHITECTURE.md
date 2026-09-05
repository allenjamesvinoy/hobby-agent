# Repository Architecture Map & Agent Guidelines

## 1. System Overview
This project is an extensible multi-purpose incubator designed for autonomous agent development. It supports two categories of projects:
1. **Python CLI Features (Vertical Slices)**: Placed inside `src/features/<feature_name>/` and auto-registered at runtime into the main CLI.
2. **Web / Frontend Apps**: Self-contained web apps placed inside `apps/<app_name>/` (e.g., React/Vite or single-page web applications with pure client-side storage).

## 2. Rules for AI Agents
1. **Project Placement**:
   - For Python CLI tools: Place files strictly in `src/features/<feature_name>/`.
   - For Web / React apps: Place files strictly in `apps/<app_name>/`.
2. **Never Edit Core**: Do NOT modify `src/core/`, `main.py`, `.github/`, or `pipeline/` unless explicitly instructed.
3. **Contracts**:
   - Python CLI features must expose `cli.py` with `register_subcommand(subparsers)`.
   - Web apps must include a `package.json` (or standalone index) and a `README.md` with instructions to run locally.
4. **File Length Limit**: Keep files focused and modular (aim for under 150–200 lines per file).
5. **Privacy & Storage**: For web apps requesting local storage, use browser `localStorage` or `IndexedDB`—avoid introducing remote backends or cloud databases unless explicitly asked.

## 3. Directory Layout
- `src/core/`: Immutable CLI plugin engine (base classes, dynamic registry, config).
- `src/features/`: Isolated Python CLI feature plugins.
- `apps/`: Isolated standalone Web & React applications.
- `pipeline/`: Multi-agent orchestration, context isolation loader, and execution scripts.
- `tests/`: Automated unit tests.
- `.github/workflows/`: GitHub Actions workflows for autonomous code generation and CI.
