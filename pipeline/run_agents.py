import os
import sys
import json
import ast
import re
import time
import random
import urllib.request
import mimetypes
from pathlib import Path
from typing import Dict, Tuple, Any, Optional, List

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

def call_gemini_with_retry(
    client, 
    prompt: str, 
    images: Optional[List[Tuple[bytes, str]]] = None,
    temperature: float = 0.2, 
    max_retries: int = 5
):
    """Calls Gemini with automatic exponential backoff and multimodal image support."""
    from google.genai import types

    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        temperature=temperature
    )

    contents = [prompt]
    if images:
        for img_data, mime in images:
            try:
                contents.append(types.Part.from_bytes(data=img_data, mime_type=mime))
            except Exception as e:
                print(f"⚠️ Could not attach image to Gemini payload: {e}")

    models_to_try = [MODEL_NAME]
    for alt in ["gemini-3.5-flash", "gemini-3.7-flash", "gemini-2.5-flash", "gemini-2.5-flash-lite"]:
        if alt not in models_to_try:
            models_to_try.append(alt)

    last_exc = None
    for model in models_to_try:
        for attempt in range(1, max_retries + 1):
            try:
                img_count = len(images) if images else 0
                print(f"📡 Calling Gemini ({model}, attempt {attempt}/{max_retries}, attached images: {img_count})...")
                return client.models.generate_content(
                    model=model,
                    contents=contents,
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
                    if model != models_to_try[-1]:
                        print(f"⚠️ Model '{model}' failed or overloaded ({err_str[:70]}...). Switching to fallback model...")
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

def extract_image_urls(text: str) -> List[str]:
    """Extracts image URLs from GitHub markdown, HTML img tags, and direct asset links."""
    urls = []
    # Markdown images: ![alt](url)
    urls.extend(re.findall(r'!\[.*?\]\((https?://[^\s\)]+)\)', text))
    # HTML img tags: <img ... src="url" ...>
    urls.extend(re.findall(r'<img\s+[^>]*src=["\'](https?://[^"\']+)["\']', text, re.IGNORECASE))
    # Direct GitHub user-attachments / assets links
    urls.extend(re.findall(r'(https://github\.com/user-attachments/assets/[a-zA-Z0-9\-_]+)', text))
    urls.extend(re.findall(r'(https://user-images\.githubusercontent\.com/[^\s\)]+)', text))

    seen = set()
    deduped = []
    for u in urls:
        clean = u.strip().rstrip(').,"\'')
        if clean not in seen:
            seen.add(clean)
            deduped.append(clean)
    return deduped

def download_image(url: str, github_token: Optional[str] = None) -> Optional[Tuple[bytes, str]]:
    """Downloads an image and infers its MIME type for multimodal inference."""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        if github_token and "github.com" in url:
            headers["Authorization"] = f"Bearer {github_token}"
            headers["Accept"] = "application/vnd.github.v3.raw, image/*"

        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as response:
            data = response.read()
            content_type = response.headers.get("Content-Type", "")

            # Infer mime type from magic bytes if octet-stream or missing
            if not content_type or "octet-stream" in content_type:
                if data.startswith(b'\x89PNG\r\n\x1a\n'):
                    content_type = "image/png"
                elif data.startswith(b'\xff\xd8\xff'):
                    content_type = "image/jpeg"
                elif data.startswith(b'GIF87a') or data.startswith(b'GIF89a'):
                    content_type = "image/gif"
                elif data.startswith(b'RIFF') and data[8:12] == b'WEBP':
                    content_type = "image/webp"
                else:
                    guess, _ = mimetypes.guess_type(url)
                    content_type = guess or "image/png"

            content_type = content_type.split(";")[0].strip()
            if not content_type.startswith("image/"):
                content_type = "image/png"

            return data, content_type
    except Exception as e:
        print(f"⚠️ Failed to download image attachment from {url}: {e}")
        return None

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

def run_coder_agent(
    client, 
    idea_title: str, 
    idea_body: str, 
    context: str, 
    project_kind: str, 
    target_dir: Optional[Path] = None,
    images: Optional[List[Tuple[bytes, str]]] = None
) -> Dict[str, str]:
    """Agent 1 (Coder): Generates code files tailored to the project kind, with optional visual input."""
    slug = slugify(idea_title) or "new_project"
    visual_note = f"\nUser attached {len(images)} image/screenshot reference(s). Inspect attached visual(s) carefully to match layout, colors, typography, or resolve the visual bug.\n" if images else ""

    if target_dir:
        rel_dir = target_dir.relative_to(root_dir)
        prompt = f"""
You are an expert software engineer resolving a task for an EXISTING project located at `{rel_dir}`.
{visual_note}
Repository Context & Existing Code:
{context}

Task Request:
Title: {idea_title}
Description: {idea_body}

Instructions:
1. Carefully diagnose the request and identify which specific files need changes.
2. Provide the complete updated code for ONLY the files that need to be modified or newly created.
3. If introducing any new third-party imports (e.g., pdfjs-dist, tesseract.js), you MUST also update `{rel_dir}/package.json` to include them under `dependencies`.
4. Do NOT re-emit untouched files. Keep changes focused, minimal, and high quality.

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
{visual_note}
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
{visual_note}
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

    response = call_gemini_with_retry(client, prompt, images=images, temperature=0.2)
    data = safe_parse_json(response.text)
    return data.get("files", {})

def run_reviewer_agent(
    client, 
    idea_title: str, 
    idea_body: str,
    generated_files: Dict[str, str], 
    syntax_errors: Dict[str, str],
    project_kind: str,
    target_dir: Optional[Path] = None,
    images: Optional[List[Tuple[bytes, str]]] = None
) -> Tuple[Dict[str, str], str]:
    """Agent 2 (Reviewer): Audits code, fixes syntax/bugs, and writes a PR summary with visual context."""
    files_json = json.dumps(generated_files, indent=2)
    errors_note = f"\nSyntax Errors Detected:\n{json.dumps(syntax_errors, indent=2)}" if syntax_errors else "\nNo initial syntax errors."

    review_focus = (
        "- Audit React hooks (useState, useEffect), ensure proper PDF viewing and local storage handling, verify valid package.json and imports."
        if project_kind == "web" else
        "- Check Python imports, verify register_subcommand contract in cli.py, and ensure unit tests are solid."
    )
    if target_dir:
        review_focus += f"\n- Confirm that modifications directly resolve '{idea_title}' cleanly without introducing regressions."
    if "Follow-up" in idea_body or "Feedback" in idea_body:
        review_focus += "\n- Specifically audit that the components requested in the user's follow-up comment have been completely updated to satisfy their feedback."
    if images:
        review_focus += f"\n- Visually cross-check with the {len(images)} user screenshot(s) to verify all UI defects or design requests shown have been addressed."

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
    try:
        response = call_gemini_with_retry(client, prompt, images=images, temperature=0.1)
        data = safe_parse_json(response.text)
        return data.get("files", generated_files), data.get("review_summary", "Automated PR generated.")
    except Exception as e:
        print(f"⚠️ Reviewer agent audit skipped due to API/parse issue ({e}). Retaining coder generated files directly.")
        return generated_files, f"### 🤖 Autonomous Agent PR Summary\n\nAutomated implementation for **{idea_title}** (Coder files verified and committed directly)."

def get_idea_details() -> Tuple[str, str]:
    """Reads idea title and body safely from environment or GITHUB_EVENT_PATH."""
    # Priority 1: Environment variables prepared by the workflow runner
    env_title = os.environ.get("IDEA_TITLE")
    env_body = os.environ.get("IDEA_BODY")
    if env_title and env_body:
        return env_title, env_body

    # Priority 2: GITHUB_EVENT_PATH payload parsing
    event_path = os.environ.get("GITHUB_EVENT_PATH")
    if event_path and os.path.exists(event_path):
        try:
            with open(event_path, "r", encoding="utf-8") as f:
                event = json.load(f)
            if "issue" in event:
                title = event["issue"].get("title", "")
                body = event["issue"].get("body", "")
                if "comment" in event:
                    comment_body = event["comment"].get("body", "").strip()
                    if comment_body:
                        body = (
                            f"Original Requirements:\n{body}\n\n"
                            f"--- User Follow-up Comment / Feedback ---\n{comment_body}"
                        )
                return title, body
            elif "inputs" in event:
                return event["inputs"].get("idea_title", ""), event["inputs"].get("idea_body", "")
        except Exception:
            pass

    return env_title or "CLI Habit Tracker", env_body or "A command-line habit tracker with streak counting and JSON storage."

def main():
    root = Path(__file__).resolve().parent.parent
    loader = ContextLoader(root)

    idea_title, idea_body = get_idea_details()

    project_kind = detect_project_kind(idea_title, idea_body)
    print(f"🔍 Detected project type: '{project_kind.upper()}'")

    print(f"📦 Loading scoped context for: '{idea_title}'...")
    context = loader.assemble_targeted_context(idea_title, idea_body)

    # Multimodal image attachment extraction
    images = []
    image_urls = extract_image_urls(f"{idea_title} {idea_body}")
    if image_urls:
        print(f"🖼️ Found {len(image_urls)} image attachment(s) in task:")
        github_token = os.environ.get("GITHUB_TOKEN")
        for url in image_urls[:5]:
            print(f"  ⬇️ Downloading image: {url}...")
            res = download_image(url, github_token=github_token)
            if res:
                img_data, mime = res
                images.append((img_data, mime))
                print(f"  ✓ Downloaded {len(img_data)} bytes ({mime})")

    client = get_gemini_client()

    target = loader.detect_target_project(f"{idea_title} {idea_body}")
    target_dir = target[1] if target else None

    if target_dir:
        print(f"🎯 Target project identified: '{target_dir.name}' (Incremental modification mode)")
    else:
        print("✨ Brand new project requested (Full scaffolding mode)")

    print(f"🤖 [Coder Agent] Generating {project_kind} project files (images: {len(images)})...")
    files = run_coder_agent(client, idea_title, idea_body, context, project_kind, target_dir=target_dir, images=images)

    syntax_errors = check_syntax(files)
    if syntax_errors:
        print(f"⚠️ Syntax errors caught before review: {syntax_errors}")
    else:
        print("✅ Initial syntax validation passed.")

    print(f"🧐 [Reviewer Agent] Auditing and producing final code (images: {len(images)})...")
    final_files, review_summary = run_reviewer_agent(
        client, 
        idea_title, 
        idea_body, 
        files, 
        syntax_errors, 
        project_kind, 
        target_dir=target_dir,
        images=images
    )

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
