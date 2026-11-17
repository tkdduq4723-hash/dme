"""Run a single briefing delivery with required cloud configuration."""

import os
from pathlib import Path
import subprocess
import sys


def main():
    missing = [name for name in ("GMAIL_USER", "GMAIL_APP_PASS", "RECIPIENT_EMAIL")
               if not os.environ.get(name, "").strip()]
    if missing:
        print("Missing cloud configuration: " + ", ".join(missing))
        return 1
    try:
        result = subprocess.run(
            [sys.executable, str(Path(__file__).with_name("send_briefing.py"))],
            timeout=240,
        )
        return result.returncode
    except subprocess.TimeoutExpired:
        print("Briefing delivery exceeded the four-minute limit.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
