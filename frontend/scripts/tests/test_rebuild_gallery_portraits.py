import importlib.util
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw


SCRIPT_PATH = Path(__file__).parents[1] / "rebuild-gallery-portrait-assets.py"


def load_rebuild_module():
    spec = importlib.util.spec_from_file_location("rebuild_gallery_portraits", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class RebuildGalleryPortraitsTests(unittest.TestCase):
    def test_full_width_screenshot_crop_keeps_both_horizontal_edges(self):
        rebuild = load_rebuild_module()

        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "source.png"
            image = Image.new("RGB", (1179, 2556), "black")
            draw = ImageDraw.Draw(image)
            draw.rectangle((0, 230, 1178, 2325), fill=(40, 40, 40))
            draw.rectangle((0, 230, 99, 2325), fill=(220, 30, 30))
            draw.rectangle((1079, 230, 1178, 2325), fill=(30, 60, 220))
            image.save(source)

            processed = rebuild.process_image(
                source,
                crop=(0, 230, 1179, 2326),
                max_edge=1920,
            )

        self.assertEqual(processed.size, (1080, 1920))
        self.assertGreater(processed.getpixel((5, 960))[0], 180)
        self.assertGreater(processed.getpixel((1074, 960))[2], 180)

    def test_manifest_metadata_and_revision_are_updated_together(self):
        rebuild = load_rebuild_module()
        items = [
            {
                "id": "gallery-import-002",
                "thumbnail": "/media/gallery/example.webp",
                "poster": "/media/gallery/example.webp",
                "src": "/media/gallery/example.webp",
                "width": 495,
                "height": 1801,
                "aspectRatio": 0.2748,
            }
        ]

        updated = rebuild.update_manifest(
            items,
            {"example.webp": (1080, 1920)},
            revision="source-crop-20260828",
        )

        self.assertEqual(updated, ["example.webp"])
        self.assertEqual(items[0]["width"], 1080)
        self.assertEqual(items[0]["height"], 1920)
        self.assertEqual(items[0]["aspectRatio"], 0.5625)
        self.assertEqual(
            items[0]["src"],
            "/media/gallery/example.webp?v=source-crop-20260828",
        )
        self.assertEqual(items[0]["thumbnail"], items[0]["src"])
        self.assertEqual(items[0]["poster"], items[0]["src"])


if __name__ == "__main__":
    unittest.main()
