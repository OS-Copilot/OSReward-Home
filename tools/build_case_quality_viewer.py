#!/usr/bin/env python3
"""Build the diagnostic case viewer as a self-contained HTML file.

The local preview environment is intentionally minimal and may serve WebP or
new asset paths inconsistently.  This build embeds the selected original
screenshots and the two JavaScript data files directly into the page so the
viewer also works when opened from disk.
"""

from __future__ import annotations

import base64
import mimetypes
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "case_quality_viewer.template.html"
OUTPUT = ROOT / "case_quality_viewer.html"

SELECTED_ASSET_DIRS = (
    ROOT / "public" / "cases" / "horse_product_ui_state_failure",
    ROOT / "public" / "cases" / "krita_horizontal_mirror_hard_case",
    ROOT / "public" / "cases" / "calc_zero_sum_false_success",
)


def data_url(path: Path) -> str:
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{encoded}"


def inline_selected_images(source: str) -> str:
    for directory in SELECTED_ASSET_DIRS:
        for path in sorted(directory.glob("full_step_*")):
            relative = path.relative_to(ROOT).as_posix()
            source = source.replace(relative, data_url(path))
    return source


def safe_inline_script(source: str) -> str:
    return source.replace("</script", "<\\/script")


def main() -> None:
    page = TEMPLATE.read_text(encoding="utf-8")
    steps = (ROOT / "static" / "js" / "osreward-case-steps.js").read_text(
        encoding="utf-8"
    )
    data = (ROOT / "static" / "js" / "osreward-data.js").read_text(
        encoding="utf-8"
    )

    steps = safe_inline_script(inline_selected_images(steps))
    data = safe_inline_script(inline_selected_images(data))
    page = page.replace(
        '<script src="static/js/osreward-case-steps.js"></script>',
        f"<script>\n{steps}\n</script>",
    )
    page = page.replace(
        '<script src="static/js/osreward-data.js"></script>',
        f"<script>\n{data}\n</script>",
    )
    OUTPUT.write_text(page, encoding="utf-8")
    print(f"Wrote {OUTPUT.name} ({OUTPUT.stat().st_size / 1024 / 1024:.1f} MiB)")


if __name__ == "__main__":
    main()
