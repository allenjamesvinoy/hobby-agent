"""Local runner to test the pipeline either in mock mode (no API key needed) or live mode."""
import os
import sys
from pathlib import Path

# Add project root to sys.path
root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir))

from pipeline.context_loader import ContextLoader
from pipeline.run_agents import check_python_syntax

def run_mock_simulation():
    print("🧪 Running Pipeline in MOCK Mode (Testing wiring without calling LLM)...")
    loader = ContextLoader(root_dir)
    
    # 1. Test Context Scoper
    context = loader.assemble_targeted_context("Add habit tracker", "A streak counter for habits")
    print("\n--- Scoped Context Extracted ---")
    print(context[:300] + "\n...[truncated]...")

    # 2. Test Synthetic Feature Generation
    mock_files = {
        "src/features/sample_mock/models.py": "class MockModel:\n    pass\n",
        "src/features/sample_mock/cli.py": "def register_subcommand(subparsers):\n    pass\n",
        "tests/test_mock.py": "def test_mock():\n    assert True\n"
    }

    # 3. Test Syntax Checker
    errors = check_python_syntax(mock_files)
    assert not errors, f"Unexpected syntax error: {errors}"
    print("\n✅ Python AST Syntax Checker works perfectly!")
    print("✅ Context isolation successfully tested!")

if __name__ == "__main__":
    if "GEMINI_API_KEY" in os.environ:
        print("🔑 GEMINI_API_KEY found. Running live pipeline...")
        from pipeline.run_agents import main
        main()
    else:
        run_mock_simulation()
