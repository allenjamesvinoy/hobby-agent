import os
import sys
import json
import ast
import re
from pathlib import Path
from typing import Dict, Tuple, Any

# Ensure repository root is in sys.path
root_dir = Path(__file__).resolve().parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from pipeline.context_loader import ContextLoader

def get_gemini_client():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("❌ Error: GEMINI_API_KEY is not set.")
        sys.exit(1)
    
    from google import genai
    return genai.Client(api_key=api_key)

MODEL_NAME = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")

def detect_project_kind(idea_title: str, idea_body: str) -> str:
    """Classifies the project as 'web' (React/HTML/JS) or 'python_cli'."""
    text = f"{idea_title} {idea_body}".lower()
    web_keywords = ["react", "frontend", "web", "html", "css", "vue", "svelte", "ui", "dashboard", "browser"]
    if any(k in text for k in web_keywords):
        return "web"
    return "python_cli"

def slugify(text: str) -> str:
    """Converts a title to a clean snake_case/kebab-case directory name."""
    clean = re.sub(r"[^\w\s-]", "", text).strip().lower()
    return re.sub(r"[-\s]+", "_", clean)[:30].strip("_")

def safe_parse_json(raw_text: str) -> dict:
    """Robust JSON parser that handles LLM output, unescaped control characters, and fences."""
    clean = raw_text.strip()

    # 1. Strip markdown code fences if wrapped
    if clean.startswith("```"):
        clean = re.sub(r"^```(?:json)?\s*", "", clean)
        clean = re.sub(r"\s*```$", "", clean)

    # 2. Try json.loads with strict=False (allows unescaped newlines/tabs in code strings)
    try:
        return json.loads(clean, strict=False)
    except Exception:
        pass

    # 3. Extract substring between first '{' and last '}'
    start = clean.find("{")
    end = clean.rfind("}")
    if start != -1 and end != -1 and end > start:
        sub = clean[start:end+1]
        try:
            return json.loads(sub, strict=False)
        except Exception:
            pass

    # 4. Repair literal unescaped control characters in strings
    try:
        repaired = re.sub(
            r'[\x00-\x1f\x7f-\x9f]', 
            lambda m: '\\n' if m.group(0) == '\n' else ('\\t' if m.group(0) == '\t' else ''), 
            clean
        )
        return json.loads(repaired, strict=False)
    except Exception:
        pass

    # 5. Last attempt
    return json.loads(clean, strict=False)

def check_syntax(files: Dict[str, str]) -> Dict[str, str]:
    """Verifies syntax for Python AST and JSON files."""
    errors = {}
    for path, code in files.items():
        if path.endswith(".py"):
            try:
                ast.parse(code)
            except SyntaxError as e:
                errors[path] = f"Python SyntaxError line {e.lineno}: {e.msg}"
        elif path.endswith(".json"):
            try:
                json.loads(code)
            except json.JSONDecodeError as e:
                errors[path] = f"JSONDecodeError: {e}"
    return errors

def run_coder_agent(client, idea_title: str, idea_body: str, context: str, project_kind: str) -> Dict[str, str]:
    """Agent 1 (Coder): Generates code files tailored to the project kind."""
    slug = slugify(idea_title) or "new_project"

    if project_kind == "web":
        prompt = f"""
You are an expert Frontend/React software engineer building an application for a hobby incubator.

Repository Context & Architecture Rules:
{context}

Project Request:
Title: {idea_title}
Description: {idea_body}

Task:
1. Build a modern, self-contained React web application under `apps/{slug}/`.
2. Provide all essential files:
   - `apps/{slug}/package.json` (with scripts like "dev", "build" and React dependencies)
   - `apps/{slug}/index.html`
   - `apps/{slug}/src/main.jsx`
   - `apps/{slug}/src/App.jsx`
   - `apps/{slug}/src/components/...` (modular components for each major feature)
   - `apps/{slug}/src/index.css` (clean, modern styling)
   - `apps/{slug}/README.md` (explaining how to run: npm install && npm run dev)
3. For local storage / persistence: use browser `localStorage` or `IndexedDB`. Do NOT add any cloud backend or external database.
4. Keep each file modular and maintainable (aim for under 200 lines per file).

Output Format:
Return a single, raw JSON object with the following schema:
{{
  "files": {{
    "apps/{slug}/package.json": "...",
    "apps/{slug}/index.html": "...",
    "apps/{slug}/src/App.jsx": "...",
    "apps/{slug}/README.md": "..."
  }}
}}
Do NOT wrap your JSON in markdown code blocks (no ```json). Output pure JSON only.
"""
    else:
        prompt = f"""
You are an expert Python software engineer building modular CLI features for a hobby incubator.

Repository Context & Architecture Rules:
{context}

Feature Request:
Title: {idea_title}
Description: {idea_body}

Task:
1. Implement this feature inside its own vertical slice under `src/features/{slug}/`.
2. Provide all needed files:
   - `src/features/{slug}/__init__.py`
   - `src/features/{slug}/models.py`
   - `src/features/{slug}/service.py`
   - `src/features/{slug}/cli.py` (which exposes `register_subcommand(subparsers)`)
3. Provide a unit test file under `tests/test_{slug}.py`.
4. Adhere strictly to the 150-line file limit.

Output Format:
Return a single, raw JSON object:
{{
  "files": {{
    "src/features/{slug}/__init__.py": "...",
    "src/features/{slug}/models.py": "...",
    "src/features/{slug}/service.py": "...",
    "src/features/{slug}/cli.py": "...",
    "tests/test_{slug}.py": "..."
  }}
}}
Do NOT wrap your JSON in markdown code blocks (no ```json). Output pure JSON only.
"""

    from google.genai import types
    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.2
        )
    )
    data = safe_parse_json(response.text)
    return data.get("files", {})

def run_reviewer_agent(
    client, 
    idea_title: str, 
    generated_files: Dict[str, str], 
    syntax_errors: Dict[str, str],
    project_kind: str
) -> Tuple[Dict[str, str], str]:
    """Agent 2 (Reviewer): Audits code, fixes syntax/bugs, and writes a PR summary."""
    files_json = json.dumps(generated_files, indent=2)
    errors_note = f"\nSyntax Errors Detected:\n{json.dumps(syntax_errors, indent=2)}" if syntax_errors else "\nNo initial syntax errors."

    review_focus = (
        "- Audit React hooks (useState, useEffect), ensure proper localStorage/IndexedDB handling, verify valid package.json and imports."
        if project_kind == "web" else
        "- Check Python imports, verify register_subcommand contract in cli.py, and ensure unit tests are solid."
    )

    prompt = f"""
You are a Senior Staff Engineer reviewing code generated by an AI assistant for: "{idea_title}".
Project Kind: {project_kind}

Generated Files:
{files_json}
{errors_note}

Review Checklist:
{review_focus}
- Fix any syntax errors or missing imports.
- Ensure the code is production-ready, clean, and robust.
- Provide a clear, professional Pull Request summary in GitHub Markdown.

Return raw JSON only:
{{
  "files": {{
    "path/to/file": "full code content"
  }},
  "review_summary": "### 🤖 Autonomous Agent PR Summary\\n\\n#### 🌟 What was built\\n- ...\\n\\n#### 🛠️ Files Added\\n- ...\\n\\n#### 🔍 Reviewer Fixes & Verification Notes\\n- ..."
}}
"""
    from google.genai import types
    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.1
        )
    )
    try:
        data = safe_parse_json(response.text)
        return data.get("files", generated_files), data.get("review_summary", "Automated PR generated.")
    except Exception as e:
        print(f"⚠️ Reviewer JSON parsing failed ({e}). Retaining coder generated files directly.")
        return generated_files, f"### 🤖 Autonomous Agent PR Summary\n\nAutomated implementation for **{idea_title}**."

def main():
    root = Path(__file__).resolve().parent.parent
    loader = ContextLoader(root)

    idea_title = os.environ.get("IDEA_TITLE", "CLI Habit Tracker")
    idea_body = os.environ.get("IDEA_BODY", "A command-line habit tracker with streak counting and JSON storage.")

    project_kind = detect_project_kind(idea_title, idea_body)
    print(f"🔍 Detected project type: '{project_kind.upper()}'")

    print(f"📦 Loading scoped context for: '{idea_title}'...")
    context = loader.assemble_targeted_context(idea_title, idea_body)

    client = get_gemini_client()

    print(f"🤖 [Coder Agent] Generating {project_kind} project files...")
    files = run_coder_agent(client, idea_title, idea_body, context, project_kind)

    syntax_errors = check_syntax(files)
    if syntax_errors:
        print(f"⚠️ Syntax errors caught before review: {syntax_errors}")
    else:
        print("✅ Initial syntax validation passed.")

    print("🧐 [Reviewer Agent] Auditing and producing final code...")
    final_files, review_summary = run_reviewer_agent(client, idea_title, files, syntax_errors, project_kind)

    # Post-review syntax check
    post_syntax = check_syntax(final_files)
    if post_syntax:
        print(f"⚠️ Notice: Syntax check after review reported: {post_syntax}")

    # Write files to disk
    print("💾 Writing project files to repository...")
    for filepath, content in final_files.items():
        if filepath.startswith(".github/") or filepath.startswith("pipeline/"):
            print(f"⚠️ Skipping protected file: {filepath}")
            continue

        target_file = root / filepath
        target_file.parent.mkdir(parents=True, exist_ok=True)
        target_file.write_text(content, encoding="utf-8")
        print(f"  ✓ {filepath}")

    # Write PR summary for GitHub Action
    summary_file = root / "pr_summary.md"
    summary_file.write_text(review_summary, encoding="utf-8")
    print("📝 Written pr_summary.md")
    print("🎉 Pipeline run complete!")

if __name__ == "__main__":
    main()
