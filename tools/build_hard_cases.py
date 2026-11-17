#!/usr/bin/env python3
"""Build the extra hard cases for the case player.

These cases were picked from the full OSReward export (``../data/full``) by
looking for the trajectories that are hardest to judge:

* false successes — the human label is FAIL but the agent ends by confidently
  declaring the task done, often with a final screen that looks right;
* hard successes — the human label is SUCCESS but the path is long and noisy
  enough that a strict judge reads the churn as failure.

Every case below was checked against its screenshots. The editorial text
(case type, why it is hard, captions, highlighted states) was written for the
project page from that inspection; it is not taken from the paper, and the
player says so.

Writes JPEG frames to ``public/cases/<slug>/`` (a thumbnail and a 1600-px
frame per state, via macOS ``sips``) and ``static/js/osreward-hard-cases.js``.

    python3 tools/build_hard_cases.py [--src ../data/full]
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_JS = ROOT / "static" / "js" / "osreward-hard-cases.js"
PUBLIC = ROOT / "public" / "cases"

E, F, V = "evidence", "focus", "verification"

CASES = [
    {
        "slug": "hard_islands_wrong_table",
        "trace": "ad74e7cb-1fd2-4310-bb05-b1b055a3be11",
        "platform": "Windows",
        "caseType": "Wrong-table false success",
        "steps": [0, 1, 2, 3, 4, 5, 6, 7, 9, 11, 12, 13, 14, 15],
        "reasonLabel": "Why it is hard",
        "reason": "Wikipedia's “List of islands by area” opens with a short Continental landmasses table "
                  "before the island ranking. Its fourth row really is Australia, so the claim matches what "
                  "is on screen; a judge has to notice which table is being read.",
        "goldWhy": "The agent never scrolled past the continental-landmass table to the main island ranking, "
                   "so “Australia (continent)” answers a different question.",
        "agentAccount": "Reported Australia (continent), 7,591,568 km², as the island in fourth place.",
        "captions": {4: "Wikipedia result opened", 5: "Continental landmasses section",
                     12: "Rank IV: Australia (continent)", 13: "Answer read from this table"},
        "markers": {5: [(E, "Continental landmasses, not islands")], 13: [(F, "Claimed answer")]},
    },
    {
        "slug": "hard_chrome_home_button",
        "trace": "756e1add-f609-479e-9fbb-05bbe7b7770b",
        "platform": "Windows",
        "caseType": "Perception false success",
        "steps": "all",
        "reasonLabel": "Why it is hard",
        "reason": "The last screens show the right page and the right row, and the agent's reasoning describes "
                  "the toggle as blue and on. Only the small “Disabled” subtitle under the setting contradicts it.",
        "goldWhy": "After the click, the Show home button row still reads “Disabled”: the setting was never enabled.",
        "agentAccount": "Said it opened Settings → Appearance and switched the Show home button toggle on.",
        "captions": {3: "Settings → Appearance", 4: "Click on the Show home button row",
                     5: "After the click", 6: "Row still reads “Disabled”"},
        "markers": {6: [(F, "Subtitle: Disabled")]},
    },
    {
        "slug": "hard_windows_double_extension",
        "trace": "7fefa5fd-49ea-4e08-9c2a-b9e9d902357b",
        "platform": "Windows",
        "caseType": "Double-extension false success",
        "steps": [0, 2, 3, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 19, 20],
        "reasonLabel": "Why it is hard",
        "reason": "Explorer pre-selects only the base name when renaming, so typing the full name over "
                  "“New Text Document” keeps the original .txt. Folder, location and file type all look right; "
                  "the doubled extension shows only inside the still-open rename box.",
        "goldWhy": "The file in Client_Contacts is named John_Doe_Info.txt.txt, and the rename was never confirmed.",
        "agentAccount": "Reported that Documents\\Client_Contacts contains a 0-byte John_Doe_Info.txt.",
        "captions": {8: "Naming the new folder", 11: "Inside the empty Client_Contacts",
                     15: "New → Text Document", 16: "Name typed over the selection",
                     17: "Rename box still open", 20: "John_Doe_Info.txt.txt"},
        "markers": {17: [(E, "Rename not committed")], 20: [(F, "Double extension")]},
    },
    {
        "slug": "hard_zotero_search_skipped",
        "trace": "2898d62a-1ae4-4980-b57d-333373e583c1",
        "platform": "Windows",
        "caseType": "Process false success",
        "steps": "all",
        "reasonLabel": "Why it is hard",
        "reason": "The paper the agent ends on is a real library item, and its title even appears in a search-like "
                  "box. But it was already open in a reader tab: the quick search bar in My Library was never used.",
        "goldWhy": "The agent typed into the reader tab instead of Zotero's quick search, so no library search ran.",
        "agentAccount": "Said it searched the library for “Windows” and found the Windows Agent Arena paper.",
        "captions": {1: "Zotero opening", 2: "A reader tab is already open",
                     3: "Triple-click on the reader tab title", 4: "“Windows” typed outside the quick search",
                     6: "Success declared"},
        "markers": {3: [(E, "Not the quick search bar")], 6: [(F, "Item was already open")]},
    },
    {
        "slug": "hard_vscode_chord_text_search",
        "trace": "fb9199e7-9804-4769-a14d-db21d539c7b5",
        "platform": "Windows",
        "caseType": "Absence-of-evidence false success",
        "steps": "all",
        "reasonLabel": "Why it is hard",
        "reason": "An empty result list reads like a clean answer. But the chord was typed into the search box as "
                  "plain text; VS Code's Record Keys mode is what matches a keystroke. “No results” here is not "
                  "evidence that nothing is bound.",
        "goldWhy": "The empty list only shows that a text search found nothing. The chord itself was never looked "
                   "up, so “unset” is unsupported.",
        "agentAccount": "Reported that Ctrl+Shift+J is unset in VS Code.",
        "captions": {1: "Keyboard Shortcuts editor", 2: "Chord typed as text",
                     3: "Empty result list", 7: "“Unset” reported"},
        "markers": {3: [(E, "Text search, not Record Keys")], 7: [(F, "Conclusion from no results")]},
    },
    {
        "slug": "hard_desktop_icons_order",
        "trace": "7b262c99-36f3-43dd-98e1-8c55e2d9f6d6",
        "platform": "Windows",
        "caseType": "Self-contradicting false success",
        "steps": "all",
        "reasonLabel": "Why it is hard",
        "reason": "The desktop looks tidied: icons have moved into a block at the top right and the Recycle Bin is "
                  "untouched. The failure is the order, and the agent's own closing description (7-Zip, Google "
                  "Chrome, Downloads, GIMP, Clock…) is not alphabetical.",
        "goldWhy": "The rearranged icons are not in alphabetical order, so the core requirement is unmet.",
        "agentAccount": "Said the icons were arranged alphabetically from right to left, Recycle Bin in place.",
        "captions": {0: "Starting desktop", 5: "Icons dragged one at a time", 6: "First “task completed”",
                     9: "Drags again after claiming done", 15: "Final layout"},
        "markers": {6: [(E, "Premature completion")], 15: [(F, "Order is not alphabetical")]},
    },
    {
        "slug": "hard_mobile_watchlist_toggle",
        "trace": "044f3cb7-ea0a-41f0-a5e2-c9d3537fe457",
        "platform": "Mobile",
        "caseType": "Toggle false success",
        "steps": "all",
        "reasonLabel": "Why it is hard",
        "reason": "Every visible step is right: Crypto tab, Most Actives sorted by volume, USDT-USD on top, star "
                  "tapped. The failure is state from before the task: USDT-USD was already in My List, so the tap "
                  "removed it. The star goes from filled to outlined.",
        "goldWhy": "USDT-USD was already on the watchlist; tapping the filled star took it off.",
        "agentAccount": "Said it added USDT-USD, the highest-volume cryptocurrency, to the watchlist.",
        "captions": {2: "USDT-USD already in My List", 5: "Most Actives, sorted by volume",
                     6: "Star already filled", 7: "Star now outlined"},
        "markers": {2: [(E, "Already watchlisted")], 6: [(E, "Filled star")], 7: [(F, "Removed by the tap")]},
    },
    {
        "slug": "hard_web_wallpaper_digits",
        "trace": "4cc834a1-873a-599f-8721-4137afd3954b",
        "platform": "Web",
        "caseType": "Transcription false success",
        "steps": "all",
        "reasonLabel": "Why it is hard",
        "reason": "The agent reached exactly the right panel, and its answer has the right shape: lead time, width, "
                  "both repeats, A+B set. Every dimension is off by one digit: the spec sheet says 62″, the answer "
                  "says 52″.",
        "goldWhy": "Technical Specs lists Width, Vertical Repeat and Horizontal Repeat as 62″; the reported 52″ is wrong.",
        "agentAccount": "4-week lead time; width, vertical and horizontal repeat of 52″; an A+B set of two 5-yard rolls.",
        "captions": {4: "Search results", 5: "Product page", 6: "Parchment selected · 4 Week Lead Time",
                     7: "Technical specs: 62″"},
        "markers": {6: [(E, "Lead time correct")], 7: [(F, "62″ on screen, 52″ in the answer")]},
    },
    {
        "slug": "hard_web_maori_shortcut",
        "trace": "1823639a-fce7-5e81-8e3d-c5315c7c0734",
        "platform": "Web",
        "caseType": "Process-constraint failure",
        "steps": "all",
        "reasonLabel": "Why it is hard",
        "reason": "The final screen is an empty text box, which is also what success looks like. The difference is "
                  "how “ā” was produced: the page's own help explains the keyboard shortcut, and the agent clicked "
                  "the on-screen button instead.",
        "goldWhy": "The task asked for keyboard shortcuts; the macron came from an on-screen button.",
        "agentAccount": "Said it typed “whānau”, inserting “ā” with the on-screen button, and then cleared the box.",
        "captions": {0: "“wh” typed", 1: "On-screen “ā” button clicked", 3: "“whānau” in the box", 4: "Box cleared"},
        "markers": {1: [(F, "Button, not a shortcut")], 4: [(E, "End state hides the method")]},
    },
    {
        "slug": "hard_7zip_two_panels",
        "trace": "9bc6397b-4802-46fe-954d-db1bdcc40669",
        "platform": "Windows",
        "caseType": "Messy-path hard success",
        "steps": [0, 1, 4, 5, 8, 10, 11, 12, 14, 17, 20, 22, 23, 24, 25, 26],
        "reasonLabel": "Why it is hard",
        "reason": "2 Panels is switched on and off several times, menus open and close, and the agent announces "
                  "completion at state 11, then keeps clicking. A strict judge can read the churn as failure; "
                  "the end state is what the task asked for.",
        "goldWhy": "2 Panels was enabled during the run and the final window is back to the original single panel.",
        "agentAccount": "Said it enabled 2 Panels and then switched back to the single-panel view.",
        "captions": {1: "Original single-panel view", 5: "2 Panels on", 10: "Switching it off",
                     11: "Early “task completed”", 24: "2 Panels on again", 25: "View → 2 Panels (checked)",
                     26: "Back to one panel"},
        "markers": {5: [(E, "Enabled")], 11: [(E, "Premature claim")], 26: [(V, "Matches the original view")]},
    },
    {
        "slug": "hard_feishu_event",
        "trace": "d68d6334-8e75-4bb0-bd9d-68d4f395704f",
        "platform": "Windows",
        "caseType": "Long-horizon hard success",
        "steps": [0, 1, 3, 5, 6, 9, 13, 17, 19, 21, 23, 24, 25, 26, 28, 31],
        "reasonLabel": "Why it is hard",
        "reason": "Two thirds of the run is the agent fighting the date and time pickers, and at state 24 the draft "
                  "still reads 10:00–10:30. The fix lands only in the last few states; a judge who stops early, or "
                  "who penalises the churn, gets it wrong.",
        "goldWhy": "The saved event Framework Sync sits on tomorrow (Fri, Mar 6) from 10:00 to 11:30 AM: 1.5 hours.",
        "agentAccount": "Said Framework Sync is on Friday, March 6, 10:00–11:30 AM.",
        "captions": {6: "Title entered, date still today", 9: "Date picker", 21: "Time dropdown",
                     24: "10:00–10:30: wrong duration", 28: "Saved: Fri 10:00–11:30"},
        "markers": {24: [(E, "Duration not fixed yet")], 28: [(V, "Saved event")]},
    },
]


def sips(src: Path, dst: Path, size: int, quality: int) -> None:
    if dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime:
        return
    subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", str(quality), "-Z", str(size),
                    str(src), "--out", str(dst)], check=True, capture_output=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", type=Path, default=ROOT.parent / "data" / "full")
    args = ap.parse_args()

    out = []
    for spec in CASES:
        d = json.loads((args.src / f"{spec['trace']}.json").read_text())
        traj = d["trajectory"]
        idx = list(range(len(traj))) if spec["steps"] == "all" else spec["steps"]
        folder = PUBLIC / spec["slug"]
        folder.mkdir(parents=True, exist_ok=True)
        portrait = spec["platform"] == "Mobile"
        steps = []
        for i in idx:
            st = traj[i]
            src = (args.src / st["screenshot_path"]).resolve()
            thumb, shot = folder / f"step_{i}.jpg", folder / f"full_step_{i}.jpg"
            sips(src, thumb, 720 if portrait else 960, 72)
            sips(src, shot, 1600, 78)
            raw = (st.get("action") or "").strip()
            steps.append({
                "number": i,
                "caption": spec["captions"].get(i, ""),
                "action": raw,
                "actionRaw": raw,
                "thought": (st.get("thought") or "").strip(),
                "thumb": thumb.relative_to(ROOT).as_posix(),
                "shot": shot.relative_to(ROOT).as_posix(),
                "markers": [{"type": t, "label": l} for t, l in spec["markers"].get(i, [])],
            })
        out.append({
            "id": spec["trace"],
            "traceId": spec["trace"],
            "platform": spec["platform"],
            "caseType": spec["caseType"],
            "set": "hard",
            "annotation": "site",
            "instruction": d["instruction"].strip(),
            "reasonLabel": spec["reasonLabel"],
            "reason": spec["reason"],
            "gold": "success" if d["human_label"] == "SUCCESS" else "failure",
            "goldWhy": spec["goldWhy"],
            "agentAccount": spec["agentAccount"],
            "steps": steps,
            "stateMeta": {"totalStates": len(traj), "showsAllStates": len(idx) == len(traj)},
            "judges": [],
        })
        print(f"{spec['slug']:34} {d['human_label']:7} {len(idx):2}/{len(traj)} states")

    OUT_JS.write_text(
        "/* Generated by tools/build_hard_cases.py from the full OSReward export.\n"
        "   Hard cases picked and annotated for the project page (not paper case studies). */\n"
        "window.OSRewardHardCases = " + json.dumps(out, ensure_ascii=False, indent=1) + ";\n"
    )
    size = sum(f.stat().st_size for c in CASES for f in (PUBLIC / c["slug"]).glob("*.jpg"))
    print(f"{len(out)} cases -> {OUT_JS.relative_to(ROOT)} ({OUT_JS.stat().st_size / 1024:.0f} KB), "
          f"frames {size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
