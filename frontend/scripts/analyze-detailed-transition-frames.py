import json
import math
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageStat


def load_font(size):
    for candidate in (
        Path("C:/Windows/Fonts/segoeuib.ttf"),
        Path("C:/Windows/Fonts/arialbd.ttf"),
    ):
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


def luminance(image):
    return ImageStat.Stat(image.convert("L")).mean[0] / 255.0


def black_fraction(image, threshold=28):
    grayscale = image.convert("L")
    return sum(grayscale.histogram()[: threshold + 1]) / float(image.width * image.height)


def difference(previous, current):
    if previous is None:
        return 0.0
    delta = ImageChops.difference(previous.convert("RGB"), current.convert("RGB"))
    return sum(ImageStat.Stat(delta).mean) / (3.0 * 255.0)


def contact_sheet(directory, frames, metrics, start_index):
    selection = frames[start_index : start_index + 20]
    columns = 5
    tile_width = 288
    tile_height = 180
    label_height = 28
    rows = math.ceil(len(selection) / columns)
    sheet = Image.new("RGB", (columns * tile_width, rows * (tile_height + label_height)), "#05070b")
    draw = ImageDraw.Draw(sheet)
    font = load_font(15)

    for offset, frame_path in enumerate(selection):
        index = start_index + offset
        image = Image.open(frame_path).convert("RGB")
        image.thumbnail((tile_width, tile_height), Image.Resampling.LANCZOS)
        x = (offset % columns) * tile_width
        y = (offset // columns) * (tile_height + label_height)
        tile = Image.new("RGB", (tile_width, tile_height), "black")
        tile.paste(image, ((tile_width - image.width) // 2, (tile_height - image.height) // 2))
        sheet.paste(tile, (x, y))
        metric = metrics[index]
        label = f"F{index + 1:02d}  black {metric['blackFraction']:.2f}  delta {metric['difference']:.3f}"
        draw.text((x + 6, y + tile_height + 5), label, fill="#f4f4f4", font=font)

    end = start_index + len(selection)
    sheet.save(directory / f"contact-sheet-{start_index + 1:02d}-{end:02d}.jpg", quality=94, optimize=True)


def analyze(directory):
    frames = sorted(directory.glob("frame-*.jpg"))
    if len(frames) != 60:
        raise RuntimeError(f"{directory.name}: expected 60 frames, found {len(frames)}")

    state_path = directory / "frames.json"
    states = json.loads(state_path.read_text(encoding="utf-8")) if state_path.exists() else []
    metrics = []
    previous = None

    for index, frame_path in enumerate(frames):
        image = Image.open(frame_path).convert("RGB")
        state = states[index] if index < len(states) else {}
        metric = {
            "frame": index + 1,
            "file": frame_path.name,
            "scrollY": state.get("scrollY"),
            "capturedAfterClickMs": state.get("capturedAfterClickMs"),
            "luminance": luminance(image),
            "blackFraction": black_fraction(image),
            "difference": difference(previous, image),
        }
        metrics.append(metric)
        previous = image

    (directory / "transition-metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    for start_index in (0, 20, 40):
        contact_sheet(directory, frames, metrics, start_index)

    moving = [item for item in metrics if item["difference"] >= 0.025]
    darkest = max(metrics, key=lambda item: item["blackFraction"])
    summary = {
        "transition": directory.name,
        "frameCount": len(frames),
        "firstStrongChangeFrame": moving[0]["frame"] if moving else None,
        "lastStrongChangeFrame": moving[-1]["frame"] if moving else None,
        "peakBlackFrame": darkest["frame"],
        "peakBlackFraction": darkest["blackFraction"],
        "maxFrameDifference": max(item["difference"] for item in metrics),
        "meanFrameDifference": sum(item["difference"] for item in metrics) / len(metrics),
    }
    (directory / "analysis-summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: analyze-detailed-transition-frames.py <capture-root>")
    root = Path(sys.argv[1]).resolve()
    summaries = [analyze(directory) for directory in sorted(path for path in root.iterdir() if path.is_dir())]
    (root / "analysis-summary.json").write_text(json.dumps(summaries, indent=2), encoding="utf-8")
    print(json.dumps(summaries, indent=2))


if __name__ == "__main__":
    main()
