"""Instrument metadata, parsed from the app's own TypeScript definitions.

`src/data/workloadItems.ts` and `src/data/ipcItems.ts` are the single source of
truth for item text, subscale membership, and reverse-scoring flags. Parsing
them here means the analysis can never silently drift from what the tool
actually administered — if an item is reworded or re-keyed, this picks it up.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from config import SRC_DATA_DIR

_ENTRY = re.compile(
    r"\{\s*id:\s*(?P<id>\d+)\s*,"
    r"\s*subscale:\s*'(?P<subscale>(?:[^'\\]|\\.)*)'\s*,"
    r"\s*reversed:\s*(?P<reversed>true|false)\s*,"
    r"\s*text:\s*'(?P<text>(?:[^'\\]|\\.)*)'\s*,?\s*\}",
    re.DOTALL,
)


@dataclass(frozen=True)
class Item:
    id: int
    subscale: str
    reversed: bool
    text: str


def _unescape(s: str) -> str:
    return s.replace("\\'", "'").replace('\\"', '"').replace("\\\\", "\\")


def _parse(filename: str, array_name: str) -> list[Item]:
    path = SRC_DATA_DIR / filename
    if not path.exists():
        raise FileNotFoundError(
            f"Cannot find {path}. The analysis reads item definitions straight "
            f"from the app source; run it from inside the repo."
        )
    source = path.read_text(encoding="utf-8")

    start = source.find(array_name)
    if start == -1:
        raise ValueError(f"{array_name} not found in {filename}")
    body = source[start:]

    items = [
        Item(
            id=int(m.group("id")),
            subscale=_unescape(m.group("subscale")),
            reversed=m.group("reversed") == "true",
            text=_unescape(m.group("text")),
        )
        for m in _ENTRY.finditer(body)
    ]
    if not items:
        raise ValueError(f"Parsed zero items from {filename} — has the file format changed?")

    ids = [i.id for i in items]
    if len(set(ids)) != len(ids):
        raise ValueError(f"Duplicate item ids in {filename}: {ids}")
    return sorted(items, key=lambda i: i.id)


def workload_items() -> list[Item]:
    return _parse("workloadItems.ts", "WORKLOAD_ITEMS")


def ipc_items() -> list[Item]:
    return _parse("ipcItems.ts", "IPC_ITEMS")


def subscales(items: list[Item]) -> list[str]:
    """Subscale names in order of first appearance (matches the questionnaire)."""
    seen: list[str] = []
    for it in items:
        if it.subscale not in seen:
            seen.append(it.subscale)
    return seen


def short_label(text: str, width: int = 58) -> str:
    """Trim item text to something that fits on a chart axis."""
    text = " ".join(text.split())
    return text if len(text) <= width else text[: width - 1].rstrip(" ,.;:") + "…"


if __name__ == "__main__":
    wl, ipc = workload_items(), ipc_items()
    print(f"Workload: {len(wl)} items, subscales={subscales(wl)}")
    print(f"  reverse-scored: {[i.id for i in wl if i.reversed] or 'none'}")
    print(f"IPC: {len(ipc)} items, subscales={subscales(ipc)}")
    print(f"  reverse-scored: {[i.id for i in ipc if i.reversed] or 'none'}")
