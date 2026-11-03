"""Responsive framing is placement data, never arbitrary CSS or image mutation."""
from copy import deepcopy

import pytest
from pydantic import ValidationError

from cms_models import SiteContent
from test_cms_models import default_content  # noqa: F401


def framing():
    return {"desktop": {"x": 42, "y": 30, "zoom": 1.2, "fit": "cover", "ratio": 1.5},
            "phone": {"x": 65, "y": 40, "zoom": 1, "fit": "contain"}}


def test_responsive_frames_round_trip_on_each_placement(default_content):
    default_content["homePage"]["packageVisuals"] = [
        {"category": "Artificii de noapte", "mediaId": "media-hero", "imageFrame": framing()}]
    default_content["homePage"]["promoSlides"][0]["imageFrame"] = framing()
    default_content["packages"][0]["imageFrame"] = framing()
    default_content["mediaItems"][0]["imageFrame"] = framing()
    result = SiteContent.model_validate(default_content).model_dump(mode="json")
    for placement in [result["homePage"]["packageVisuals"][0], result["homePage"]["promoSlides"][0],
                      result["packages"][0], result["mediaItems"][0]]:
        assert placement["imageFrame"]["phone"]["x"] == 65
        assert placement["imageFrame"]["desktop"]["zoom"] == 1.2


@pytest.mark.parametrize("key,value", [("x", -1), ("y", 101), ("zoom", 0.9), ("zoom", 3.1),
                                        ("x", float("nan")), ("ratio", float("inf")),
                                        ("ratio", 0.1), ("x", True), ("zoom", "1.2"),
                                        ("fit", "fill"), ("css", "position:fixed")])
def test_rejects_invalid_image_frame(default_content, key, value):
    frame = framing()
    frame["desktop"][key] = value
    default_content["packages"][0]["imageFrame"] = frame
    with pytest.raises(ValidationError):
        SiteContent.model_validate(default_content)


def test_optional_framing_does_not_change_legacy_snapshots(default_content):
    before = SiteContent.model_validate(deepcopy(default_content)).model_dump(mode="json")
    assert "packageVisuals" not in before["homePage"]
    assert all("imageFrame" not in item for key in ["packages", "mediaItems"] for item in before[key])


def test_manual_image_selection_survives_resetting_the_crop(default_content):
    for item in [default_content["homePage"]["promoSlides"][0], default_content["packages"][0]]:
        item["mediaSelection"] = "manual"
        item["imageFrame"] = None
    result = SiteContent.model_validate(default_content).model_dump(mode="json")
    for item in [result["homePage"]["promoSlides"][0], result["packages"][0]]:
        assert item["mediaSelection"] == "manual"
        assert "imageFrame" not in item


def test_homepage_visuals_require_unique_categories_and_valid_media(default_content):
    visual = {"category": "Artificii de noapte", "mediaId": "media-hero"}
    default_content["homePage"]["packageVisuals"] = [visual, deepcopy(visual)]
    with pytest.raises(ValidationError):
        SiteContent.model_validate(default_content)
    default_content["homePage"]["packageVisuals"] = [{**visual, "mediaId": "missing-media"}]
    with pytest.raises(ValidationError):
        SiteContent.model_validate(default_content)
