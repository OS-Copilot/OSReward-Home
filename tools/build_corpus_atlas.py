#!/usr/bin/env python3
"""Build the corpus atlas manifest from the full OSReward trajectory export.

Reads every ``*.json`` trace under ``--src`` (default ``../data/full``) and
writes ``static/js/osreward-corpus.js``: one compact row per trajectory, with
the instruction, platform, agent, human label, length and an *action barcode*
(one letter per step naming the kind of action taken). Thoughts and
screenshots are deliberately left out so the manifest stays small enough to
ship with the page.

    python3 tools/build_corpus_atlas.py [--src ../data/full]
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "static" / "js" / "osreward-corpus.js"

# One letter per action kind. Keep in sync with KINDS in osreward-atlas.js.
NAME_KIND = {
    "click": "c", "click_at": "c", "left_click": "c", "single_click": "c", "tap": "c",
    "set_checked": "c", "select": "c", "select_option": "c",
    "double_click": "d", "doubleclick": "d", "triple_click": "d", "tripleclick": "d",
    "right_click": "c", "rightclick": "c", "middle_click": "c",
    "hover": "h", "hover_at": "h", "mouse_move": "h", "move_abs": "h", "moveto": "h", "move": "h",
    "type": "t", "type_text_at": "t", "write": "t", "typewrite": "t", "fill": "t", "input": "t",
    "key_combination": "k", "key": "k", "press": "k", "hotkey": "k", "keydown": "k", "keyup": "k",
    "system_button": "k",
    "scroll": "s", "scroll_at": "s", "scroll_document": "s", "vscroll": "s", "hscroll": "s",
    "swipe": "w",
    "drag_and_drop": "g", "drag": "g", "dragto": "g", "drag_to": "g", "long_press": "g",
    "goto": "n", "navigate": "n", "open": "n", "open_app": "n", "go_back": "n", "back": "n",
    "go_forward": "n", "search": "n", "open_web_browser": "n", "home": "n",
    "wait": "p", "wait_5_seconds": "p", "sleep": "p", "screenshot": "p",
    "done": "e", "stop": "e", "terminate": "e", "answer": "e", "finish": "e", "fail": "e",
    "code": "x", "run": "x", "bash": "x", "shell": "x",
    "delete": "k", "switch_to_application": "n",
}

AGENT_NAMES = {
    "gemini3-flash-preview": "Gemini-3-Flash",
    "gemini-3-flash-preview": "Gemini-3-Flash",
    "gemini-3-pro-preview": "Gemini-3-Pro",
    "gemini-3.1-pro-preview": "Gemini-3.1-Pro",
    "claude-sonnet-4-6": "Claude-Sonnet-4.6",
    "claude-opus-4-6": "Claude-Opus-4.6",
    "qwen3-vl-235b-a22b-instruct": "Qwen3-VL-235B",
    "kimi-k2.5": "Kimi-K2.5",
}

PY_OP = re.compile(r"(?:computer(?:\.\w+)?|pyautogui)\.(\w+)\s*\(")


def kind_of(raw: str) -> str:
    r = (raw or "").strip()
    if not r:
        return "o"
    if r.upper() in ("DONE", "FAIL") or r.startswith("# Task completed"):
        return "e"
    if r.upper() == "WAIT":
        return "p"
    start, end = r.find("{"), r.rfind("}")
    if start >= 0 and end > start and not re.match(r"(computer\.|pyautogui|import|#)", r):
        body = r[start:end + 1]
        if "};{" in body:  # several tool calls in one step: the first one names it
            body = body.split("};{", 1)[0] + "}"
        try:
            j = json.loads(body)
        except ValueError:
            j = None
        if isinstance(j, dict):
            name = j.get("action_key") or j.get("name") or j.get("action") or ""
            kw = j.get("action_kwargs") or j.get("arguments") or {}
            if name in ("mobile_use", "computer_use", "computer") and isinstance(kw, dict):
                name = kw.get("action") or name
            return NAME_KIND.get(str(name).lower(), "o")
    ops = [op.lower() for op in PY_OP.findall(r)]
    ops = [op for op in ops if op not in ("move_abs", "moveto", "sleep")] or ops
    if ops:
        return NAME_KIND.get(ops[-1], "o")
    if re.match(r"(import |#!|export |from |subprocess|os\.)", r) or "\n" in r:
        return "x"
    return NAME_KIND.get(r.lower(), "o")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", type=Path, default=ROOT.parent / "data" / "full")
    args = ap.parse_args()

    files = sorted(args.src.glob("*.json"))
    platforms: list[str] = []
    agents: list[str] = []
    rows = []
    kinds = Counter()
    for path in files:
        d = json.loads(path.read_text())
        plat = d.get("platform") or "Unknown"
        agent_raw = str(d.get("agent") or "unknown")
        agent = AGENT_NAMES.get(agent_raw.lower(), agent_raw)
        if plat not in platforms:
            platforms.append(plat)
        if agent not in agents:
            agents.append(agent)
        barcode = "".join(kind_of(step.get("action")) for step in d.get("trajectory") or [])
        kinds.update(barcode)
        rows.append([
            path.stem,
            platforms.index(plat),
            agents.index(agent),
            1 if d.get("human_label") == "SUCCESS" else 0,
            re.sub(r"\s+", " ", d.get("instruction") or "").strip(),
            barcode,
        ])

    payload = {"platforms": platforms, "agents": agents, "rows": rows}
    OUT.write_text(
        "/* Generated by tools/build_corpus_atlas.py from the full OSReward export.\n"
        "   rows: [traceId, platformIdx, agentIdx, humanSuccess(1/0), instruction, actionBarcode] */\n"
        "window.OSRewardCorpus = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n"
    )
    print(f"{len(rows)} trajectories, {sum(len(r[5]) for r in rows)} steps -> {OUT.relative_to(ROOT)}"
          f" ({OUT.stat().st_size / 1024:.0f} KB)")
    print("action kinds:", dict(kinds.most_common()))


if __name__ == "__main__":
    main()
