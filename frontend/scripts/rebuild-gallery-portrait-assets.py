from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import NamedTuple
from urllib.parse import urlsplit

from PIL import Image, ImageOps


REVISION = "source-crop-20260828"
MAX_EDGE = 1920
SCREENSHOT_CROP = (0, 230, 1179, 2326)


class AssetSpec(NamedTuple):
    source: str
    destination: str
    crop: tuple[int, int, int, int] | None


ASSETS = (
    AssetSpec(
        "tmp/source-media-20260801/image-set/image00002.png",
        "fireartro-artificii-noapte-spectacol-002.webp",
        SCREENSHOT_CROP,
    ),
    AssetSpec(
        "tmp/source-media-20260801/image-set/image00003.png",
        "fireartro-artificii-zi-spectacol-003.webp",
        SCREENSHOT_CROP,
    ),
    AssetSpec(
        "tmp/source-media-20260801/image-set/image00011.png",
        "fireartro-artificii-noapte-spectacol-010.webp",
        SCREENSHOT_CROP,
    ),
    AssetSpec(
        "tmp/source-media-20260801/image-set/image00012.png",
        "fireartro-artificii-noapte-spectacol-011.webp",
        SCREENSHOT_CROP,
    ),
    AssetSpec(
        "tmp/source-media-20260801/image-set/image00014.png",
        "fireartro-artificii-zi-spectacol-012.webp",
        SCREENSHOT_CROP,
    ),
    AssetSpec(
        "tmp/source-media-20260801/image-set/image00015.png",
        "fireartro-artificii-noapte-spectacol-013.webp",
        SCREENSHOT_CROP,
    ),
    AssetSpec(
        "tmp/source-media-20260801/image-set/image00016.png",
        "fireartro-artificii-noapte-spectacol-014.webp",
        SCREENSHOT_CROP,
    ),
    AssetSpec(
        "tmp/source-media-20260801/image-set/image00017.png",
        "fireartro-artificii-noapte-spectacol-015.webp",
        SCREENSHOT_CROP,
    ),
    AssetSpec(
        "tmp/source-media-20260801/into-it/image00084.jpeg",
        "fireartro-nunta-spectacol-088.webp",
        (0, 12, 738, 1318),
    ),
    AssetSpec(
        "tmp/source-media-20260801/into-it/image00086.jpeg",
        "fireartro-artificii-noapte-spectacol-090.webp",
        None,
    ),
    AssetSpec(
        "tmp/source-media-20260801/into-it/image00100.jpeg",
        "fireartro-artificii-noapte-spectacol-104.webp",
        (0, 12, 738, 1324),
    ),
    AssetSpec(
        "tmp/source-media-20260801/into-it/image00132.jpeg",
        "fireartro-nunta-spectacol-134.webp",
        None,
    ),
)


def process_image(
    source: Path,
    crop: tuple[int, int, int, int] | None,
    max_edge: int = MAX_EDGE,
) -> Image.Image:
    with Image.open(source) as raw:
        image = ImageOps.exif_transpose(raw).convert("RGB")

    if crop is not None:
        left, top, right, bottom = crop
        if left < 0 or top < 0 or right > image.width or bottom > image.height:
            raise ValueError(f"Crop {crop} exceeds {source} dimensions {image.size}.")
        if left >= right or top >= bottom:
            raise ValueError(f"Crop {crop} is empty for {source}.")
        image = image.crop(crop)

    if max(image.size) > max_edge:
        scale = max_edge / max(image.size)
        image = image.resize(
            (round(image.width * scale), round(image.height * scale)),
            Image.Resampling.LANCZOS,
        )

    return image


def media_filename(url: str) -> str:
    return Path(urlsplit(url).path).name


def revisioned_url(filename: str, revision: str = REVISION) -> str:
    return f"/media/gallery/{filename}?v={revision}"


def update_manifest(
    items: list[dict],
    rebuilt: dict[str, tuple[int, int]],
    revision: str = REVISION,
) -> list[str]:
    matched: dict[str, int] = {filename: 0 for filename in rebuilt}

    for item in items:
        filename = media_filename(item.get("src", ""))
        dimensions = rebuilt.get(filename)
        if dimensions is None:
            continue

        matched[filename] += 1
        width, height = dimensions
        url = revisioned_url(filename, revision)
        item.update(
            {
                "thumbnail": url,
                "poster": url,
                "src": url,
                "width": width,
                "height": height,
                "aspectRatio": round(width / height, 4),
            }
        )

    invalid = {filename: count for filename, count in matched.items() if count != 1}
    if invalid:
        raise ValueError(f"Expected one catalog entry per rebuilt image, got {invalid}.")

    return sorted(matched)


def project_paths(project_root: Path) -> tuple[Path, Path]:
    gallery = project_root / "frontend" / "public" / "media" / "gallery"
    manifest = project_root / "frontend" / "src" / "data" / "importedGalleryItems.json"
    return gallery, manifest


def expected_dimensions(project_root: Path) -> dict[str, tuple[int, int]]:
    dimensions = {}
    for spec in ASSETS:
        source = project_root / spec.source
        if not source.is_file():
            raise FileNotFoundError(f"Missing source image: {source}")
        dimensions[spec.destination] = process_image(source, spec.crop).size
    return dimensions


def rebuild_assets(project_root: Path) -> list[dict]:
    project_root = project_root.resolve()
    gallery, manifest_path = project_paths(project_root)
    gallery.mkdir(parents=True, exist_ok=True)

    rebuilt: dict[str, tuple[int, int]] = {}
    report = []
    for spec in ASSETS:
        source = project_root / spec.source
        destination = gallery / spec.destination
        if not source.is_file():
            raise FileNotFoundError(f"Missing source image: {source}")

        image = process_image(source, spec.crop)
        temporary = destination.with_suffix(".tmp.webp")
        image.save(temporary, "WEBP", quality=86, method=6)
        temporary.replace(destination)
        rebuilt[spec.destination] = image.size
        report.append(
            {
                "source": str(source),
                "destination": str(destination),
                "width": image.width,
                "height": image.height,
            }
        )

    items = json.loads(manifest_path.read_text(encoding="utf-8"))
    update_manifest(items, rebuilt)
    temporary_manifest = manifest_path.with_suffix(".tmp.json")
    temporary_manifest.write_text(
        json.dumps(items, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary_manifest.replace(manifest_path)
    return report


def check_assets(project_root: Path) -> list[dict]:
    project_root = project_root.resolve()
    gallery, manifest_path = project_paths(project_root)
    expected = expected_dimensions(project_root)
    items = json.loads(manifest_path.read_text(encoding="utf-8"))
    catalog = {media_filename(item.get("src", "")): item for item in items}
    report = []

    for filename, dimensions in expected.items():
        destination = gallery / filename
        if not destination.is_file():
            raise FileNotFoundError(f"Missing rebuilt image: {destination}")

        with Image.open(destination) as image:
            actual_format = image.format
            actual_dimensions = image.size

        if actual_format != "WEBP":
            raise ValueError(f"Expected WebP for {destination}, got {actual_format}.")
        if actual_dimensions != dimensions:
            raise ValueError(
                f"Expected {dimensions} for {destination}, got {actual_dimensions}."
            )

        item = catalog.get(filename)
        if item is None:
            raise ValueError(f"Missing catalog entry for {filename}.")
        if (item.get("width"), item.get("height")) != dimensions:
            raise ValueError(f"Catalog dimensions do not match {filename}.")
        expected_url = revisioned_url(filename)
        if any(item.get(field) != expected_url for field in ("thumbnail", "poster", "src")):
            raise ValueError(f"Catalog URL revision does not match {filename}.")

        report.append(
            {
                "destination": str(destination),
                "width": dimensions[0],
                "height": dimensions[1],
                "format": actual_format,
            }
        )

    return report


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Rebuild corrected FireArtRo portraits.")
    parser.add_argument(
        "--project-root",
        type=Path,
        default=Path(__file__).resolve().parents[2],
        help="Path to the FireArtRo repository root.",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Validate generated assets and manifest without writing files.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    report = check_assets(args.project_root) if args.check else rebuild_assets(args.project_root)
    action = "Validated" if args.check else "Rebuilt"
    print(f"{action} {len(report)} gallery portrait assets.")
    for item in report:
        print(f"- {Path(item['destination']).name}: {item['width']}x{item['height']}")


if __name__ == "__main__":
    main()
