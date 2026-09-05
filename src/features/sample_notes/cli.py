import argparse
from src.features.sample_notes.service import NoteService

def register_subcommand(subparsers: argparse._SubParsersAction) -> None:
    """Registers the 'notes' CLI command and subcommands."""
    notes_parser = subparsers.add_parser("notes", help="Manage quick notes")
    action_subparsers = notes_parser.add_subparsers(dest="action", required=True)

    # list
    action_subparsers.add_parser("list", help="List all notes")

    # add
    add_parser = action_subparsers.add_parser("add", help="Add a new note")
    add_parser.add_argument("--title", "-t", required=True, help="Note title")
    add_parser.add_argument("--content", "-c", required=True, help="Note content")

    # delete
    del_parser = action_subparsers.add_parser("delete", help="Delete a note by ID")
    del_parser.add_argument("--id", type=int, required=True, help="Note ID to delete")

    notes_parser.set_defaults(func=handle_cli)

def handle_cli(args: argparse.Namespace) -> None:
    service = NoteService()
    if args.action == "list":
        notes = service.list_notes()
        if not notes:
            print("📭 No notes found.")
            return
        print(f"📋 Found {len(notes)} note(s):")
        for n in notes:
            print(f"  [{n.id}] {n.title} - {n.content} ({n.created_at[:10]})")

    elif args.action == "add":
        note = service.add_note(args.title, args.content)
        print(f"✅ Note added: [{note.id}] {note.title}")

    elif args.action == "delete":
        success = service.delete_note(args.id)
        if success:
            print(f"🗑️ Note {args.id} deleted.")
        else:
            print(f"❌ Note with ID {args.id} not found.")
