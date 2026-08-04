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
        "evidence": {36: "Visible Beta: 2.38"},
    },
    {
        "id": "3f2b353a-709d-40ac-9126-7dc9823c2e62",
        "slug": "audacity_fadeout_llm_miss",
        "source": Path("/root/RMAnnot/data/raw_traces_phase2/ubuntu_0411_147/0301/meta_3f2b353a-709d-40ac-9126-7dc9823c2e62.json"),
        "steps": [0, 2, 4, 6, 8, 9, 12, 15, 18, 19],
        "captions": {
            0: "Original waveform loaded",
            8: "Fade Out targeted for 0 to 10 seconds",
            9: "Waveform after applying the effect",
            18: "Export reaches metadata stage",
            19: "Final waveform requires verification",
        },
        "focus": [8, 9, 18, 19],
        "evidence": {19: "Final waveform"},
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
        "id": "da372ad2-063e-5dfd-a822-36f7167598ee",
        "slug": "rome_hotel_restaurant_web_hard_case",
        "source": Path("/root/RMAnnot/data/raw_traces/web_0315_160/trajectories/e7b83a42-174a-5d65-84dd-fe9863d4f748.json"),
        "steps": [0, 4, 8, 12, 16, 18, 20, 23, 26, 28],
        "captions": {
            0: "Initial hotel search",
            18: "EUR 161 for two nights; rating 8.3",
            20: "Exact hotel address recovered",
            26: "Yelp anti-bot block",
            28: "Two nearby options rated above 4",
        },
        "focus": [18, 20, 26, 28],
        "verification": {18: "Hotel constraints verified", 28: "Restaurant evidence verified"},
    },
]


# Representative real judge records for the eight displayed cases.  The
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
    "3f2b353a-709d-40ac-9126-7dc9823c2e62": {
        "human": "failure",
        "kind": "json",
        "path": Path("/root/case_study_traces/3f2b353a-709d-40ac-9126-7dc9823c2e62_20260324@132004/model_judge_results.json"),
        "indices": [0, 1, 7, 9],
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
    "da372ad2-063e-5dfd-a822-36f7167598ee": {
        "human": "success",
        "kind": "hard_db",
        "trace_id": "e7b83a42-174a-5d65-84dd-fe9863d4f748",
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


def build_case(case: dict) -> list[dict]:
    source_json = case["source"]
    payload = json.loads(source_json.read_text(encoding="utf-8"))
    trajectory = payload["trajectory"]
    case_dir = PUBLIC / case["slug"]
    case_dir.mkdir(parents=True, exist_ok=True)
    generated = []

    for number in case["steps"]:
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
    return generated


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

    version = record.get("version")
    last_n = record.get("last_n")
    if version and str(version)[0].isdigit():
        context = f"{version} · last {last_n} states" if last_n else str(version)
    elif last_n:
        context = f"Last {last_n} states"
    else:
        context = "Hard-set review record"

    return {
        "name": record.get("judge_model") or record.get("model") or record.get("model_raw"),
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
    data = {case["id"]: build_case(case) for case in CASES}
    judges = build_judges()
    rendered = json.dumps(data, ensure_ascii=False, indent=2)
    rendered_judges = json.dumps(judges, ensure_ascii=False, indent=2)
    OUTPUT_JS.write_text(
        "/* Generated by tools/build_case_studies.py from the original traces. */\n"
        f"window.OSRewardCaseSteps = {rendered};\n"
        f"window.OSRewardJudgeResponses = {rendered_judges};\n",
        encoding="utf-8",
    )
    print(f"Built {sum(map(len, data.values()))} states across {len(data)} cases")
    print(f"Attached {sum(map(len, judges.values()))} unedited judge responses")
    print(f"Wrote {OUTPUT_JS.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
