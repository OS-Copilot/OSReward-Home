#!/usr/bin/env python3
"""Build the native case-study viewer from the original trajectory exports.

The generated WebP files are browsing thumbnails.  ``full_step_*.png`` files
are hard links to the untouched source screenshots whenever the filesystem
allows it, so opening an image in the viewer preserves the original pixels
without duplicating the storage cost.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import sqlite3
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public" / "cases"
OUTPUT_JS = ROOT / "static" / "js" / "osreward-case-steps.js"
SHORT_TRAJECTORY_LIMIT = 15


CASES = [
    {
        "id": "290315ee-b986-5afc-b9b9-7f0774cee4c2",
        "slug": "documentary_recency_failure",
        "source": Path("/root/RMAnnot/data/raw_traces/web_0315_160/trajectories/dc2a1004-c6ee-5c2c-acb7-b1f5716c18ae.json"),
        "steps": [0, 3, 6, 9, 11, 15, 18, 22, 24, 26, 27],
        "captions": {
            11: "Older titles rejected",
            22: "A valid recent result",
            26: "Old title selected",
            27: "2017 title treated as recent",
        },
        "focus": [22, 26, 27],
        "evidence": {27: "Release year: 2017"},
    },
    {
        "id": "example_task_060",
        "slug": "git_status_false_success",
        "source": Path("/root/RMAnnot/data/raw_traces/win_0320_42/example_task_060/25cc896a-a4dc-46ad-a5eb-2d36f3bf0de7.json"),
        "steps": list(range(13)),
        "captions": {
            0: "GitHub Desktop is open",
            7: "Command Prompt option found",
            8: "Terminal opened in repository",
            10: "Typed command is not visible",
            11: "Enter yields no Git output",
            12: "Agent declares completion",
        },
        "focus": [7, 8, 10, 11],
        "evidence": {10: "Command absent", 11: "Git output absent"},
    },
    {
        "id": "task_321",
        "slug": "nvda_beta_perception_failure",
        "source": Path("/root/RMAnnot/data/raw_traces_phase2/inconsistency_phase2/trajectories/37b29158-fde9-4e99-a382-1bec564db773.json"),
        "steps": [0, 3, 7, 12, 18, 24, 29, 32, 35, 36, 38, 39],
        "captions": {
            0: "Browser starting state",
            7: "NVDA result identified",
            32: "Statistics page reached",
            35: "Valuation tables inspected",
            36: "Beta value visually misread",
            39: "Incorrect value repeated at completion",
        },
        "focus": [7, 32, 35, 36],
        "evidence": {36: "On-screen evidence · Beta (5Y Monthly): 2.38"},
    },
    {
        "id": "1a1f2d7b-b2a7-50cb-8f16-3bdae408818c",
        "slug": "horse_product_ui_state_failure",
        "source": Path("/root/RMAnnot/data/raw_traces_phase2/inconsistency_phase2/trajectories/1a1f2d7b-b2a7-50cb-8f16-3bdae408818c.json"),
        "steps": [0, 1, 4],
        "captions": {
            0: "Horse.com starting state",
            1: "Product options become visible",
            2: "Product page remains in view",
            3: "Option states remain unchanged",
            4: "Disabled variants reported as available",
        },
        "focus": [1, 4],
        "evidence": {1: "Struck-through variants"},
    },
    {
        "id": "37c7fcf5-d656-40ca-842d-8bb09f0d6a06",
        "slug": "librecad_long_horizon_planning_failure",
        "source": Path("/root/RMAnnot/data/raw_traces_phase2/inconsistency_phase2/trajectories/37c7fcf5-d656-40ca-842d-8bb09f0d6a06_20260405@033709.json"),
        "steps": [0, 6, 12, 18, 24, 30, 32, 35, 37, 41, 44],
        "captions": {
            6: "Krita crop and export succeed",
            30: "Open Image finally reached",
            32: "Placed image renders blank",
            44: "Save succeeds; content remains wrong",
        },
        "focus": [30, 32, 44],
        "evidence": {44: "Question mark absent"},
    },
    {
        "id": "3c91a543-78eb-47c2-b4c5-b226fa4fe04b",
        "slug": "os_symphony_hard_case",
        "source": Path("/root/RMAnnot/data/raw_traces_phase2/ubuntu_0411_147/0301/meta_3c91a543-78eb-47c2-b4c5-b226fa4fe04b.json"),
        "steps": [0, 4, 8, 12, 18, 24, 29, 33, 38, 43, 49, 52],
        "captions": {
            0: "Terminal opened for project search",
            8: "Project file tree enumerated",
            33: "Five agent-model pairs entered",
            49: "Workbook named in Save As",
            52: "Saved workbook verified",
        },
        "focus": [8, 33, 49, 52],
        "verification": {52: "Saved workbook verified"},
    },
    {
        "id": "GoogleMapHospitalAndGasRoute_taskinfo",
        "slug": "google_maps_open_hospital_hard_case",
        "source": Path("/root/RMAnnot/data/raw_traces/mobile_0310_gemini3pro_41/GoogleMapHospitalAndGasRoute_0/GoogleMapHospitalAndGasRoute_0.json"),
        "steps": [0, 2, 4, 6, 7, 9, 11, 12, 15],
        "captions": {
            0: "Mobile starting state",
            7: "Nearest open hospital selected",
            11: "Open gas stop selected",
            12: "Complete driving route composed",
            15: "Agent terminates successfully",
        },
        "focus": [7, 11, 12],
        "verification": {7: "Open-status verification", 12: "Final-route verification"},
    },
    {
        "id": "73243cf3-bed7-48fc-8cdd-c6542a90466b",
        "slug": "obs_resolution_long_horizon_hard_case",
        "source": Path("/root/RMAnnot/data/raw_traces_phase2/inconsistency_phase2/trajectories/73243cf3-bed7-48fc-8cdd-c6542a90466b_20260405@194959.json"),
        "steps": [0, 1, 4, 21, 30, 33, 35, 37, 39, 41, 42, 43, 44],
        "captions": {
            0: "Desktop and OBS starting state",
            1: "Source file created in terminal",
            4: "Text source named StatusText",
            21: "Read from file enabled",
            30: "File picker reached after recovery",
            33: "stream_info.txt selected",
            35: "File-backed text visibly rendered",
            37: "Video settings opened",
            39: "Canvas resolution set to 1280x720",
            41: "Preset list lacks the exact output size",
            42: "Exact 854x480 value entered",
            43: "Enter closes and commits the dialog",
            44: "Agent completes the task",
        },
        "focus": [21, 35, 41, 42, 43],
        "evidence": {42: "Action enters 854x480"},
        "verification": {
            35: "File-backed text verified",
            43: "Settings accepted after Enter",
        },
    },
    {
        "id": "41a372e2-b5cd-474b-8031-81bdfef2a3f4",
        "slug": "krita_horizontal_mirror_hard_case",
        "source": Path("/root/RMAnnot/data/raw_traces_phase2/inconsistency_phase2/trajectories/41a372e2-b5cd-474b-8031-81bdfef2a3f4_20260405@034215.json"),
        "steps": list(range(7)),
        "captions": {
            0: "Original asymmetric orientation",
            1: "Horizontal mirror command exposed",
            2: "Mirrored orientation is visibly different",
            3: "Export command selected",
            4: "Desktop PNG path entered",
            5: "PNG export options reached",
            6: "Mirrored canvas remains after export",
        },
        "focus": [1, 2, 5],
        "evidence": {
            0: "Before · short stroke on the left",
            2: "After · short stroke on the right",
        },
        "verification": {
            5: "PNG export accepted",
            6: "Mirrored state persists",
        },
    },
    {
        "id": "041259e7-7396-4ffc-a7af-00cb3d00b209",
        "slug": "calc_zero_sum_false_success",
        "source": Path("/root/RMAnnot/data/raw_traces_phase2/inconsistency_phase2/trajectories/041259e7-7396-4ffc-a7af-00cb3d00b209_20260403@232242.json"),
        "steps": [0, 3, 7, 20, 22, 23, 24],
        "captions": {
            0: "Non-zero death counts are visible",
            3: "Source sheet renamed Storm_Data",
            7: "Summary sheet created",
            20: "Summary label finally entered",
            22: "SUM formula entered for column E",
            23: "Formula evaluates to zero",
            24: "Agent finishes without checking the result",
        },
        "focus": [22, 23, 24],
        "evidence": {
            0: "Source contains non-zero values",
            23: "Computed result: 0",
        },
        "verification": {
            3: "Sheet rename verified",
            20: "Summary label verified",
        },
    },
]


# Representative real judge records for the displayed cases.  The
# indices select distinct models and, where available, both sides of a judge
# split.  No response text is summarized or rewritten by this build step.
JUDGE_CASES = {
    "290315ee-b986-5afc-b9b9-7f0774cee4c2": {
        "human": "failure",
        "kind": "json",
        "path": Path("/root/case_study_traces/dc2a1004-c6ee-5c2c-acb7-b1f5716c18ae/model_judge_results.json"),
        "indices": [7, 8, 9, 10],
    },
    "example_task_060": {
        "human": "failure",
        "kind": "json",
        "path": Path("/root/case_study_traces/25cc896a-a4dc-46ad-a5eb-2d36f3bf0de7/model_judge_results.json"),
        "indices": [0, 7, 8, 10],
    },
    "task_321": {
        "human": "failure",
        "kind": "json",
        "path": Path("/root/selected_traces_export/37b29158-fde9-4e99-a382-1bec564db773/model_judge_results.json"),
        "indices": [0, 1, 2, 3],
    },
    "1a1f2d7b-b2a7-50cb-8f16-3bdae408818c": {
        "human": "failure",
        "kind": "hard_db",
        "trace_id": "1a1f2d7b-b2a7-50cb-8f16-3bdae408818c",
        "path": Path("/root/RMAnnot/data/hard_review.db"),
    },
    "37c7fcf5-d656-40ca-842d-8bb09f0d6a06": {
        "human": "failure",
        "kind": "json",
        "path": Path("/root/case_study_traces/37c7fcf5-d656-40ca-842d-8bb09f0d6a06_20260405@033709/model_judge_results.json"),
        "indices": [0, 1, 2, 3],
    },
    "3c91a543-78eb-47c2-b4c5-b226fa4fe04b": {
        "human": "success",
        "kind": "json",
        "path": Path("/root/selected_traces_export/3c91a543-78eb-47c2-b4c5-b226fa4fe04b_20260324@133025/model_judge_results.json"),
        "indices": [0, 1],
    },
    "GoogleMapHospitalAndGasRoute_taskinfo": {
        "human": "success",
        "kind": "jsonl",
        "trace_id": "GoogleMapHospitalAndGasRoute_0",
        "paths": [
            Path("/root/RM_Data_Eval/results/judge_593_aug_gemini31pro.jsonl"),
            Path("/root/RM_Data_Eval/results/judge_593_aug_qwen3vl.jsonl"),
        ],
    },
    "73243cf3-bed7-48fc-8cdd-c6542a90466b": {
        "human": "success",
        "kind": "hard_db",
        "trace_id": "73243cf3-bed7-48fc-8cdd-c6542a90466b_20260405@194959",
        "path": Path("/root/RMAnnot/data/hard_review.db"),
    },
    "41a372e2-b5cd-474b-8031-81bdfef2a3f4": {
        "human": "success",
        "kind": "hard_db",
        "trace_id": "41a372e2-b5cd-474b-8031-81bdfef2a3f4_20260405@034215",
        "path": Path("/root/RMAnnot/data/hard_review.db"),
    },
    "041259e7-7396-4ffc-a7af-00cb3d00b209": {
        "human": "failure",
        "kind": "hard_db",
        "trace_id": "041259e7-7396-4ffc-a7af-00cb3d00b209_20260403@232242",
        "path": Path("/root/RMAnnot/data/hard_review.db"),
    },
}


def compact_action(raw: object) -> str:
    """Keep the authentic action while making JSON tool calls easier to scan."""
    if raw is None:
        return "No action recorded"
    text = raw if isinstance(raw, str) else json.dumps(raw, ensure_ascii=False)
    stripped = re.sub(r"^\s*<tool_call>\s*|\s*</tool_call>\s*$", "", text, flags=re.S)
    try:
        payload = json.loads(stripped)
    except (json.JSONDecodeError, TypeError):
        return text.strip()

    name = payload.get("action_key") or payload.get("name")
    kwargs = payload.get("action_kwargs") or payload.get("arguments")
    if not name:
        return json.dumps(payload, ensure_ascii=False, separators=(", ", ": "))
    if not isinstance(kwargs, dict):
        return f"{name}({kwargs})" if kwargs is not None else f"{name}()"
    args = ", ".join(
        f"{key}={json.dumps(value, ensure_ascii=False, separators=(',', ':'))}"
        for key, value in kwargs.items()
    )
    return f"{name}({args})"


def link_original(source: Path, destination: Path) -> None:
    if destination.exists() or destination.is_symlink():
        destination.unlink()
    try:
        os.link(source, destination)
    except OSError:
        shutil.copy2(source, destination)


def make_thumbnail(source: Path, destination: Path) -> None:
    with Image.open(source) as image:
        image = image.convert("RGB")
        image.thumbnail((960, 720), Image.Resampling.LANCZOS)
        image.save(destination, "WEBP", quality=82, method=6)


def marker_list(case: dict, number: int) -> list[dict[str, str]]:
    markers = []
    if number in case.get("focus", []):
        markers.append({"type": "focus", "label": "Focus state"})
    for kind in ("evidence", "verification"):
        label = case.get(kind, {}).get(number)
        if label:
            markers.append({"type": kind, "label": label})
    return markers


def build_case(case: dict) -> tuple[list[dict], dict[str, int | bool]]:
    source_json = case["source"]
    payload = json.loads(source_json.read_text(encoding="utf-8"))
    trajectory = payload["trajectory"]
    shows_all_states = len(trajectory) < SHORT_TRAJECTORY_LIMIT
    state_numbers = list(range(len(trajectory))) if shows_all_states else case["steps"]
    case_dir = PUBLIC / case["slug"]
    case_dir.mkdir(parents=True, exist_ok=True)
    generated = []

    for number in state_numbers:
        step = trajectory[number]
        screenshot = (source_json.parent / step["screenshot_path"]).resolve()
        if not screenshot.exists():
            raise FileNotFoundError(screenshot)

        full_name = f"full_step_{number}{screenshot.suffix.lower()}"
        thumb_name = f"step_{number}.webp"
        link_original(screenshot, case_dir / full_name)
        make_thumbnail(screenshot, case_dir / thumb_name)

        action_raw = step.get("action")
        if not isinstance(action_raw, str):
            action_raw = json.dumps(action_raw, ensure_ascii=False)
        generated.append(
            {
                "number": number,
                "caption": case.get("captions", {}).get(number, "Trajectory context"),
                "action": compact_action(step.get("action")),
                "actionRaw": action_raw.strip(),
                "thought": str(step.get("thought") or "No thought recorded").strip(),
                "thumb": f"public/cases/{case['slug']}/{thumb_name}",
                "shot": f"public/cases/{case['slug']}/{full_name}",
                "markers": marker_list(case, number),
            }
        )
    return generated, {
        "totalStates": len(trajectory),
        "showsAllStates": shows_all_states,
    }


def load_judge_records(config: dict) -> list[dict]:
    """Load the selected, unedited judge records from their source export."""
    kind = config["kind"]
    if kind == "json":
        records = json.loads(config["path"].read_text(encoding="utf-8"))
        return [records[index] for index in config["indices"]]

    if kind == "jsonl":
        records = []
        for path in config["paths"]:
            match = None
            with path.open(encoding="utf-8") as handle:
                for line in handle:
                    candidate = json.loads(line)
                    if candidate.get("trace_id") == config["trace_id"]:
                        match = candidate
                        break
            if match is None:
                raise LookupError(f"No judge record for {config['trace_id']} in {path}")
            records.append(match)
        return records

    if kind == "hard_db":
        uri = f"file:{config['path']}?mode=ro"
        with sqlite3.connect(uri, uri=True) as connection:
            row = connection.execute(
                "SELECT enriched_json FROM candidates WHERE trace_id = ?",
                (config["trace_id"],),
            ).fetchone()
        if not row:
            raise LookupError(f"No hard-review record for {config['trace_id']}")
        return json.loads(row[0])["judges"]

    raise ValueError(f"Unknown judge source kind: {kind}")


def normalize_judge(record: dict, human: str) -> dict:
    label = str(record.get("judge_label") or "").strip().upper()
    verdict = "success" if label == "SUCCESS" else "failure"
    response = record.get("judge_raw_response") or record.get("raw_response")
    if not response:
        raise ValueError("Selected judge record has no raw response")

    last_n = record.get("last_n")
    if last_n:
        context = f"Evaluation setting · Last {last_n} states"
    else:
        context = "Hard-set review record"

    return {
        "name": record.get("judge_model") or record.get("model_raw") or record.get("model"),
        "verdict": verdict,
        "correct": verdict == human,
        "context": context,
        "response": str(response).strip(),
    }


def build_judges() -> dict[str, list[dict]]:
    return {
        case_id: [
            normalize_judge(record, config["human"])
            for record in load_judge_records(config)
        ]
        for case_id, config in JUDGE_CASES.items()
    }


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    data = {}
    state_meta = {}
    for case in CASES:
        data[case["id"]], state_meta[case["id"]] = build_case(case)
    judges = build_judges()
    rendered = json.dumps(data, ensure_ascii=False, indent=2)
    rendered_state_meta = json.dumps(state_meta, ensure_ascii=False, indent=2)
    rendered_judges = json.dumps(judges, ensure_ascii=False, indent=2)
    OUTPUT_JS.write_text(
        "/* Generated by tools/build_case_studies.py from the original traces. */\n"
        f"window.OSRewardCaseSteps = {rendered};\n"
        f"window.OSRewardCaseStateMeta = {rendered_state_meta};\n"
        f"window.OSRewardJudgeResponses = {rendered_judges};\n",
        encoding="utf-8",
    )
    print(f"Built {sum(map(len, data.values()))} states across {len(data)} cases")
    print(f"Attached {sum(map(len, judges.values()))} unedited judge responses")
    print(f"Wrote {OUTPUT_JS.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
