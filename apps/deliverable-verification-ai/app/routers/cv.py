"""
Computer Vision analysis for deliverable verification.
Uses Pillow for image intrinsics (no heavy ML model download required).
Optional CLIP-style heuristics via colour histogram + sharpness scoring.
"""
import io
import math
import base64
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, HttpUrl
from typing import Optional, List, Dict, Any
from PIL import Image, ImageStat

router = APIRouter()


class ImageAnalysisRequest(BaseModel):
    image_url: Optional[str] = None
    image_base64: Optional[str] = None  # data:image/jpeg;base64,...
    platform: str = "instagram"
    content_type: str = "image"         # image | story | thumbnail
    brand_colors_hex: Optional[List[str]] = None  # e.g. ["#FF0000", "#00FF00"]
    min_width: int = 0
    min_height: int = 0


class CVAnalysisResponse(BaseModel):
    width: int
    height: int
    aspect_ratio: str
    quality_score: float            # 0-100, based on sharpness + resolution
    brightness_ok: bool
    saturation_level: str           # low | moderate | high
    aspect_ratio_compliant: bool
    resolution_compliant: bool
    detected_issues: List[str]
    brand_color_match: Optional[float] = None   # 0-1
    overall_score: float            # 0-100
    recommendations: List[str]


# Platform aspect ratio requirements
_ASPECT_REQUIREMENTS: Dict[str, Dict[str, tuple]] = {
    "instagram": {
        "image":     (0.8, 1.91),   # portrait to landscape
        "story":     (0.55, 0.57),  # 9:16
        "thumbnail": (1.70, 1.80),  # 16:9
    },
    "tiktok": {
        "image":     (0.55, 0.57),
        "story":     (0.55, 0.57),
        "thumbnail": (0.55, 0.57),
    },
    "youtube": {
        "image":     (1.70, 1.80),
        "story":     (0.55, 0.57),
        "thumbnail": (1.70, 1.80),
    },
    "twitter": {
        "image":     (0.5, 2.0),
        "story":     (0.55, 0.57),
        "thumbnail": (1.70, 1.80),
    },
    "linkedin": {
        "image":     (1.70, 1.80),
        "story":     (0.55, 0.57),
        "thumbnail": (1.70, 1.80),
    },
}

_MIN_RESOLUTION = {
    "instagram": (1080, 566),
    "tiktok":    (1080, 1920),
    "youtube":   (1280, 720),
    "twitter":   (600, 335),
    "linkedin":  (1200, 628),
}


def _hex_to_rgb(h: str) -> tuple:
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))


def _colour_distance(c1: tuple, c2: tuple) -> float:
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(c1, c2)))


def _brand_color_match(img: Image.Image, brand_colors: List[str]) -> float:
    """
    Computes a rough brand color match score [0-1] by comparing
    the top-10 dominant quantised palette colours to brand colours.
    """
    if not brand_colors:
        return None
    small = img.convert("RGB").resize((100, 100))
    quantised = small.quantize(colors=10, method=Image.Quantize.FASTOCTREE)
    palette = quantised.getpalette()   # [r, g, b, r, g, b, ...]
    dom_colors = [(palette[i], palette[i+1], palette[i+2]) for i in range(0, 30, 3)]

    brand_rgbs = [_hex_to_rgb(c) for c in brand_colors]
    matches = 0
    for bc in brand_rgbs:
        for dc in dom_colors:
            if _colour_distance(bc, dc) < 60:
                matches += 1
                break
    return round(matches / len(brand_rgbs), 2)


def _sharpness_score(img: Image.Image) -> float:
    """
    Variance-of-Laplacian sharpness proxy using pixel stat.
    Returns 0-100.
    """
    gray = img.convert("L")
    stat = ImageStat.Stat(gray)
    # variance of pixel values as sharpness proxy (capped)
    score = min(stat.var[0] / 5000 * 100, 100)
    return round(score, 1)


def _brightness_ok(img: Image.Image) -> bool:
    stat = ImageStat.Stat(img.convert("L"))
    mean = stat.mean[0]
    return 40 < mean < 220


def _saturation_level(img: Image.Image) -> str:
    stat = ImageStat.Stat(img.convert("HSV") if hasattr(Image, "hsv") else img)
    # Use both channel means from RGB as proxy
    r, g, b = [ImageStat.Stat(img.convert("RGB")).mean[i] for i in range(3)]
    rng = max(r, g, b) - min(r, g, b)
    if rng < 30:
        return "low"
    elif rng < 80:
        return "moderate"
    return "high"


async def _load_image(req: ImageAnalysisRequest) -> Image.Image:
    if req.image_base64:
        b64 = req.image_base64
        if "," in b64:
            b64 = b64.split(",", 1)[1]
        data = base64.b64decode(b64)
        return Image.open(io.BytesIO(data)).convert("RGB")
    if req.image_url:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(req.image_url)
            if resp.status_code >= 400:
                raise HTTPException(status_code=422, detail="Could not fetch image URL")
            return Image.open(io.BytesIO(resp.content)).convert("RGB")
    raise HTTPException(status_code=422, detail="Provide image_url or image_base64")


@router.post("/analyze-image", response_model=CVAnalysisResponse)
async def analyze_image(req: ImageAnalysisRequest):
    img = await _load_image(req)

    w, h = img.size
    aspect = w / h if h else 1.0
    aspect_str = f"{round(aspect, 2)}:1"

    # Sharpness
    quality = _sharpness_score(img)
    brightness_ok = _brightness_ok(img)
    saturation = _saturation_level(img)

    # Aspect ratio compliance
    required = (_ASPECT_REQUIREMENTS
                .get(req.platform, _ASPECT_REQUIREMENTS["instagram"])
                .get(req.content_type, (0.5, 2.0)))
    aspect_ok = required[0] <= aspect <= required[1]

    # Resolution compliance
    min_w, min_h = _MIN_RESOLUTION.get(req.platform, (600, 335))
    if req.min_width:
        min_w = max(min_w, req.min_width)
    if req.min_height:
        min_h = max(min_h, req.min_height)
    res_ok = w >= min_w and h >= min_h

    # Brand color
    brand_match = _brand_color_match(img, req.brand_colors_hex or [])

    # Issues + recommendations
    issues, recs = [], []
    if not aspect_ok:
        issues.append(f"Aspect ratio {aspect_str} falls outside {req.platform}/{req.content_type} requirement ({required[0]}–{required[1]})")
        recs.append(f"Crop or resize image to meet {req.platform} {req.content_type} aspect ratio.")
    if not res_ok:
        issues.append(f"Resolution {w}×{h} is below recommended {min_w}×{min_h} for {req.platform}")
        recs.append("Export at a higher resolution for platform-optimal quality.")
    if not brightness_ok:
        issues.append("Image brightness is outside optimal range (too dark or too bright)")
        recs.append("Adjust exposure or use platform auto-enhance before posting.")
    if quality < 30:
        issues.append("Image appears blurry or low-quality")
        recs.append("Use a sharper, higher-quality photo for better engagement.")
    if brand_match is not None and brand_match < 0.4:
        issues.append(f"Brand color match is low ({brand_match:.0%})")
        recs.append("Ensure brand colors are prominent in at least one dominant region.")

    overall = quality * 0.4 + (80 if aspect_ok else 30) * 0.3 + (80 if res_ok else 30) * 0.3
    if not brightness_ok:
        overall -= 10

    return CVAnalysisResponse(
        width=w,
        height=h,
        aspect_ratio=aspect_str,
        quality_score=quality,
        brightness_ok=brightness_ok,
        saturation_level=saturation,
        aspect_ratio_compliant=aspect_ok,
        resolution_compliant=res_ok,
        detected_issues=issues,
        brand_color_match=brand_match,
        overall_score=round(max(0.0, min(100.0, overall)), 1),
        recommendations=recs,
    )


class ThumbnailRequest(BaseModel):
    image_url: Optional[str] = None
    image_base64: Optional[str] = None
    platform: str = "youtube"


class ThumbnailResponse(BaseModel):
    quality_score: float
    resolution_compliant: bool
    brightness_ok: bool
    has_high_contrast: bool
    overall_score: float
    issues: List[str]


@router.post("/analyze-thumbnail", response_model=ThumbnailResponse)
async def analyze_thumbnail(req: ThumbnailRequest):
    image_req = ImageAnalysisRequest(
        image_url=req.image_url,
        image_base64=req.image_base64,
        platform=req.platform,
        content_type="thumbnail",
    )
    img = await _load_image(image_req)
    w, h = img.size
    quality = _sharpness_score(img)
    brightness_ok = _brightness_ok(img)

    min_w, min_h = _MIN_RESOLUTION.get(req.platform, (1280, 720))
    res_ok = w >= min_w and h >= min_h

    stat = ImageStat.Stat(img.convert("L"))
    contrast = stat.stddev[0] > 50

    issues = []
    if not res_ok:
        issues.append(f"Thumbnail resolution {w}×{h} below recommended {min_w}×{min_h}")
    if not brightness_ok:
        issues.append("Thumbnail brightness outside optimal range")
    if not contrast:
        issues.append("Low contrast — thumbnail may not attract clicks")

    overall = quality * 0.4 + (80 if res_ok else 40) * 0.3 + (80 if contrast else 40) * 0.3

    return ThumbnailResponse(
        quality_score=quality,
        resolution_compliant=res_ok,
        brightness_ok=brightness_ok,
        has_high_contrast=contrast,
        overall_score=round(max(0.0, min(100.0, overall)), 1),
        issues=issues,
    )
