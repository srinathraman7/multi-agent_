"""CLI: generate an audit-page metrics report from a JSON evaluation input."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from .metrics import EvaluationInput, generate_metrics_report


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate incident evaluation metrics.")
    parser.add_argument("input", type=Path, help="Evaluation JSON input file")
    parser.add_argument("--output", type=Path, help="Optional metrics JSON output file")
    args = parser.parse_args()

    data = EvaluationInput.model_validate_json(args.input.read_text(encoding="utf-8"))
    rendered = generate_metrics_report(data).model_dump_json(indent=2)
    if args.output:
        args.output.write_text(rendered + "\n", encoding="utf-8")
    else:
        print(rendered)


if __name__ == "__main__":
    main()
