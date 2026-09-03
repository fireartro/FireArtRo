import json
import math
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFont, ImageStat


def mean_luminance(image):
    grayscale = image.convert("L")
    return ImageStat.Stat(grayscale).mean[0] / 255.0


def black_fraction(image, threshold=28):
    grayscale = image.convert("L")
    histogram = grayscale.histogram()
    return sum(histogram[: threshold + 1]) / float(image.width * image.height)


def frame_difference(previous, current):
    difference = ImageChops.difference(previous.convert("RGB"), current.convert("RGB"))
    return sum(ImageStat.Stat(difference).mean) / (3.0 * 255.0)


def load_font(size):
    candidates = [
        Path("C:/Windows/Fonts/segoeuib.ttf"),
        Path("C:/Windows/Fonts/arialbd.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


def make_contact_sheet(section_directory, frames, metrics):
    columns = 9
    tile_width = 160
    tile_height = 100
    label_height = 24
    rows = math.ceil(len(frames) / columns)
    sheet = Image.new("RGB", (columns * tile_width, rows * (tile_height + label_height)), "#090a0d")
    draw = ImageDraw.Draw(sheet)
    font = load_font(13)

    for index, frame_path in enumerate(frames):
        image = Image.open(frame_path).convert("RGB")
        image.thumbnail((tile_width, tile_height), Image.Resampling.LANCZOS)
        x = (index % columns) * tile_width
        y = (index // columns) * (tile_height + label_height)
        tile = Image.new("RGB", (tile_width, tile_height), "black")
        tile.paste(image, ((tile_width - image.width) // 2, (tile_height - image.height) // 2))
        sheet.paste(tile, (x, y))
        metric = metrics[index]
        label = f"{index:02d} y{metric['scrollY']} d{metric['difference']:.2f}"
        draw.text((x + 4, y + tile_height + 4), label, fill="#f2f2f2", font=font)

    sheet.save(section_directory / "contact-sheet.jpg", quality=88, optimize=True)


def analyze_section(section_directory):
    frames = sorted(section_directory.glob("frame-*.jpg"))
    state_path = section_directory / "frames.json"
    screencast_path = section_directory / "screencast-metadata.json"
    if state_path.exists():
        states = json.loads(state_path.read_text(encoding="utf-8"))
    elif screencast_path.exists():
        states = json.loads(screencast_path.read_text(encoding="utf-8"))
    else:
        states = []
    metrics = []
    previous = None

    for index, frame_path in enumerate(frames):
        image = Image.open(frame_path).convert("RGB")
        state = states[index] if index < len(states) else {}
        metric = {
            "frame": index,
            "file": frame_path.name,
            "scrollY": state.get("scrollY"),
            "progress": state.get("progress"),
            "luminance": mean_luminance(image),
            "blackFraction": black_fraction(image),
            "difference": frame_difference(previous, image) if previous is not None else 0.0,
        }
        metrics.append(metric)
        previous = image

    (section_directory / "transition-metrics.json").write_text(
        json.dumps(metrics, indent=2), encoding="utf-8"
    )
    make_contact_sheet(section_directory, frames, metrics)
    return metrics


def main():
    if len(sys.argv) < 2:
        raise SystemExit("Usage: analyze-reference-frames.py <viewport-directory>")

    viewport_directory = Path(sys.argv[1]).resolve()
    all_metrics = []
    for section_directory in sorted(path for path in viewport_directory.iterdir() if path.is_dir()):
        if not (section_directory / "frames.json").exists() and not (section_directory / "screencast-metadata.json").exists():
            continue
        metrics = analyze_section(section_directory)
        for metric in metrics:
            all_metrics.append({"section": section_directory.name, **metric})

    transition_candidates = sorted(
        all_metrics,
        key=lambda item: item["difference"] * 0.62 + item["blackFraction"] * 0.38,
        reverse=True,
    )[:30]
    (viewport_directory / "transition-candidates.json").write_text(
        json.dumps(transition_candidates, indent=2), encoding="utf-8"
    )
    print(json.dumps(transition_candidates[:12], indent=2))


if __name__ == "__main__":
    main()
