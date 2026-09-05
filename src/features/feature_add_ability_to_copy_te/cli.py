import argparse
from .service import PDFReaderService


def register_subcommand(subparsers: argparse._SubParsersAction) -> None:
    parser = subparsers.add_parser(
        "pdf-copy",
        help="Read text from PDF and convert copied text directly into flashcards.",
    )
    sub = parser.add_subparsers(dest="pdf_cmd", help="PDF copy subcommands")

    read_parser = sub.add_parser("read", help="Read PDF page text and select text snippet")
    read_parser.add_argument("--pdf", required=True, help="Path to PDF file")
    read_parser.add_argument("--page", type=int, default=1, help="Page number to read")
    read_parser.add_argument("--start", type=int, default=0, help="Start char position")
    read_parser.add_argument("--length", type=int, default=None, help="Snippet length")

    card_parser = sub.add_parser("make-card", help="Create a flashcard from PDF text")
    card_parser.add_argument("--pdf", required=True, help="Path to PDF file")
    card_parser.add_argument("--page", type=int, default=1, help="Page number")
    card_parser.add_argument("--front", required=True, help="Front of card (copied snippet)")
    card_parser.add_argument("--back", required=True, help="Back of card (answer/note)")
    card_parser.add_argument("--storage", default="flashcards.json", help="Storage file")

    list_parser = sub.add_parser("list-cards", help="List all saved flashcards")
    list_parser.add_argument("--storage", default="flashcards.json", help="Storage file")

    parser.set_defaults(func=handle_cli)


def handle_cli(args: argparse.Namespace) -> None:
    storage = getattr(args, "storage", "flashcards.json")
    service = PDFReaderService(storage_file=storage)

    if args.pdf_cmd == "read":
        text = service.extract_text_from_pdf(args.pdf, args.page)
        snippet = service.select_snippet(text, args.start, args.length)
        print("--- EXTRACTED TEXT SNIPPET ---")
        print(snippet)
        print("------------------------------")
    elif args.pdf_cmd == "make-card":
        card = service.create_flashcard(
            front=args.front,
            back=args.back,
            pdf_path=args.pdf,
            page_num=args.page,
        )
        print(f"Flashcard created successfully! Source: {card.source_pdf} (Page {card.page_num})")
        print(f"Front: {card.front}")
        print(f"Back:  {card.back}")
    elif args.pdf_cmd == "list-cards":
        cards = service.load_flashcards()
        if not cards:
            print("No flashcards found.")
            return
        print(f"Found {len(cards)} flashcard(s):")
        for idx, card in enumerate(cards, 1):
            print(f"{idx}. [{card.source_pdf} p.{card.page_num}]")
            print(f"   Front: {card.front}")
            print(f"   Back:  {card.back}")
    else:
        print("Please specify a valid subcommand: read, make-card, list-cards")
