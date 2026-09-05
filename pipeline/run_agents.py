import os
import sys
import json
import ast
import re
import time
import random
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

def call_gemini_with_retry(client, prompt: str, temperature: float = 0.2, max_retries: int = 5):
    """Calls Gemini with automatic exponential backoff for 503 UNAVAILABLE or 429 rate limit spikes."""
    from google.genai import types

    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        temperature=temperature
    )

    models_to_try = [MODEL_NAME]
    for alt in ["gemini-2.0-flash", "gemini-1.5-flash"]:
        if alt not in models_to_try:
            models_to_try.append(alt)

    last_exc = None
    for model in models_to_try:
        for attempt in range(1, max_retries + 1):
            try:
                print(f"📡 Calling Gemini ({model}, attempt {attempt}/{max_retries})...")
                return client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=config
                )
            except Exception as e:
                last_exc = e
                err_str = str(e)
                is_transient = any(code in err_str for code in ["503", "429", "UNAVAILABLE", "RESOURCE_EXHAUSTED", "500", "502", "504"])
                if is_transient and attempt < max_retries:
                    wait_time = (2 ** attempt) + random.uniform(1.0, 3.0)
                    print(f"⏳ Temporary spike ({err_str[:60]}...). Backing off for {wait_time:.1f}s...")
                    time.sleep(wait_time)
                else:
                    if model != models_to_try[-1] and is_transient:
                        print(f"⚠️ Switching to fallback model after repeated spikes on {model}...")
                    break

    raise last_exc

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

def extract_files_fallback(text: str) -> dict:
    """Extracts file key-value pairs directly when JSON decoding fails on large payloads."""
    files = {}
    path_pattern = re.compile(r'\"([a-zA-Z0-9_\-\./]+\.[a-zA-Z0-9]+)\"\s*:\s*\"')
    matches = list(path_pattern.finditer(text))
    for i, match in enumerate(matches):
        path = match.group(1)
        start_content = match.end()
        if i + 1 < len(matches):
            next_start = matches[i+1].start()
            content_chunk = text[start_content:next_start]
            content = content_chunk.rstrip().rstrip(',').rstrip().rstrip('"')
        else:
            content_chunk = text[start_content:]
            content = content_chunk.rstrip().rstrip('}').rstrip().rstrip('"')
        try:
            content = content.encode().decode('unicode_escape', errors='ignore')
        except Exception:
            pass
        files[path] = content
    return files

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

    # 5. Extract file blocks via regex fallback
    recovered = extract_files_fallback(clean)
    if recovered:
        print(f"⚠️ Recovered {len(recovered)} file(s) via fallback JSON extractor.")
        return {"files": recovered}

    # 6. Last attempt
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

def run_coder_agent(client, idea_title: str, idea_body: str, context: str, project_kind: str, target_dir: Optional[Path] = None) -> Dict[str, str]:
    """Agent 1 (Coder): Generates code files tailored to the project kind."""
    slug = slugify(idea_title) or "new_project"

    if target_dir:
        rel_dir = target_dir.relative_to(root_dir)
        prompt = f"""
You are an expert software engineer resolving a task for an EXISTING project located at `{rel_dir}`.

Repository Context & Existing Code:
{context}

Task Request:
Title: {idea_title}
Description: {idea_body}

Instructions:
1. Carefully diagnose the request and identify which specific files need changes.
2. Provide the complete updated code for ONLY the files that need to be modified or newly created.
3. Do NOT re-emit untouched files. Keep changes focused, minimal, and high quality.

Output Format:
Return a raw JSON object containing ONLY modified or new files:
{{
  "files": {{
    "{rel_dir}/path/to/modified_file": "complete updated code"
  }}
}}
Do NOT wrap your JSON in markdown code blocks (no ```json). Output pure JSON only.
"""
    elif project_kind == "web":
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
   - `apps/{slug}/package.json` (with "dev", "build", "dist" scripts)
   - `apps/{slug}/index.html` (referencing /src/main.jsx)
   - `apps/{slug}/src/main.jsx` (MUST be included: mounts App to document.getElementById('root'))
   - `apps/{slug}/src/App.jsx` (MUST be included: root orchestrator component)
   - `apps/{slug}/src/components/...` (modular components for each major feature)
   - `apps/{slug}/src/index.css` (clean, modern styling)
   - `apps/{slug}/electron/main.js` (if desktop/electron app requested)
   - `apps/{slug}/README.md` (explaining how to run)
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

    response = call_gemini_with_retry(client, prompt, temperature=0.2)
    data = safe_parse_json(response.text)
    return data.get("files", {})

def run_reviewer_agent(
    client, 
    idea_title: str, 
    generated_files: Dict[str, str], 
    syntax_errors: Dict[str, str],
    project_kind: str,
    target_dir: Optional[Path] = None
) -> Tuple[Dict[str, str], str]:
    """Agent 2 (Reviewer): Audits code, fixes syntax/bugs, and writes a PR summary."""
    files_json = json.dumps(generated_files, indent=2)
    errors_note = f"\nSyntax Errors Detected:\n{json.dumps(syntax_errors, indent=2)}" if syntax_errors else "\nNo initial syntax errors."

    review_focus = (
        "- Audit React hooks (useState, useEffect), ensure proper PDF viewing and local storage handling, verify valid package.json and imports."
        if project_kind == "web" else
        "- Check Python imports, verify register_subcommand contract in cli.py, and ensure unit tests are solid."
    )
    if target_dir:
        review_focus += f"\n- Confirm that modifications directly resolve '{idea_title}' cleanly without introducing regressions."

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
    response = call_gemini_with_retry(client, prompt, temperature=0.1)
    try:
        data = safe_parse_json(response.text)
        return data.get("files", generated_files), data.get("review_summary", "Automated PR generated.")
    except Exception as e:
        print(f"⚠️ Reviewer JSON parsing failed ({e}). Retaining coder generated files directly.")
        return generated_files, f"### 🤖 Autonomous Agent PR Summary\n\nAutomated implementation for **{idea_title}**."

def get_idea_details() -> Tuple[str, str]:
    """Reads idea title and body safely from GITHUB_EVENT_PATH or environment."""
    event_path = os.environ.get("GITHUB_EVENT_PATH")
    if event_path and os.path.exists(event_path):
        try:
            with open(event_path, "r", encoding="utf-8") as f:
                event = json.load(f)
            if "issue" in event:
                return event["issue"].get("title", ""), event["issue"].get("body", "")
            elif "inputs" in event:
                return event["inputs"].get("idea_title", ""), event["inputs"].get("idea_body", "")
        except Exception:
            pass

    title = os.environ.get("IDEA_TITLE", "CLI Habit Tracker")
    body = os.environ.get("IDEA_BODY", "A command-line habit tracker with streak counting and JSON storage.")
    return title, body

def main():
    root = Path(__file__).resolve().parent.parent
    loader = ContextLoader(root)

    idea_title, idea_body = get_idea_details()

    project_kind = detect_project_kind(idea_title, idea_body)
    print(f"🔍 Detected project type: '{project_kind.upper()}'")

    print(f"📦 Loading scoped context for: '{idea_title}'...")
    context = loader.assemble_targeted_context(idea_title, idea_body)

    client = get_gemini_client()

    target = loader.detect_target_project(f"{idea_title} {idea_body}")
    target_dir = target[1] if target else None

    if target_dir:
        print(f"🎯 Target project identified: '{target_dir.name}' (Incremental modification mode)")
    else:
        print("✨ Brand new project requested (Full scaffolding mode)")

    print(f"🤖 [Coder Agent] Generating {project_kind} project files...")
    files = run_coder_agent(client, idea_title, idea_body, context, project_kind, target_dir=target_dir)

    syntax_errors = check_syntax(files)
    if syntax_errors:
        print(f"⚠️ Syntax errors caught before review: {syntax_errors}")
    else:
        print("✅ Initial syntax validation passed.")

    print("🧐 [Reviewer Agent] Auditing and producing final code...")
    final_files, review_summary = run_reviewer_agent(client, idea_title, files, syntax_errors, project_kind, target_dir=target_dir)

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
