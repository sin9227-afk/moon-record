#!/usr/bin/env python3
"""앱 이름·아이콘·스플래시·세로 고정을 Capacitor 안드로이드 프로젝트에 입힌다.

사용법:
    python3 scripts/build_android_app.py <android-project-dir> <icon-512.png>

`npx cap add android` 로 방금 만들어진 프로젝트를 받아
- 앱 이름(런처 라벨)을 '달의 기록' 으로,
- 런처 아이콘(적응형/레거시/원형)을 icons/icon-512.png 에서,
- 스플래시 화면을 같은 아이콘과 배경색으로,
- 세로 화면 고정 + 키보드 리사이즈,
- 버전 이름/코드
를 채운다. 웹 자산과 GitHub Pages 구조는 건드리지 않는다.
"""

import re
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    sys.exit("Pillow가 필요합니다: python3 -m pip install pillow")

CREAM = (246, 243, 236, 255)
INK = (46, 43, 43)
APP_NAME = "달의 기록"
VERSION_NAME = "1.0.0"
VERSION_CODE = "1"

# 밀도별 배율 (mdpi 기준)
DENSITY = {"mdpi": 1.0, "hdpi": 1.5, "xhdpi": 2.0, "xxhdpi": 3.0, "xxxhdpi": 4.0}
LAUNCHER_DP = 48      # 레거시 런처 아이콘
FOREGROUND_DP = 108   # 적응형 아이콘 foreground 캔버스
SPLASH_BASE = {       # 템플릿과 같은 비율 (land/port), mdpi 크기
    "port": (320, 480),
    "land": (480, 320),
}


def extract_mark(src: Image.Image) -> Image.Image:
    """아이콘에서 배경을 지우고 달·별 모양만 남긴다 (적응형 아이콘 foreground/스플래시용)."""
    src = src.convert("RGBA")
    w, h = src.size
    rgb = src.convert("RGB")
    sp, op_ = src.load(), rgb.load()
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dp = out.load()
    for y in range(h):
        for x in range(w):
            if sp[x, y][3] < 32:      # 투명한 모서리 (원본 PNG의 둥근 모서리)
                continue
            r, g, b = op_[x, y]
            lum = 0.299 * r + 0.587 * g + 0.114 * b
            a = (200.0 - lum) / 160.0  # 배경(밝음)=0, 달(어두움)=1
            if a <= 0.02:
                continue
            a = 1.0 if a >= 0.96 else a
            dp[x, y] = (INK[0], INK[1], INK[2], int(round(a * 255)))
    return out.crop(out.getbbox() or (0, 0, w, h))


def fit(mark: Image.Image, size: int) -> Image.Image:
    """mark를 정사각 캔버스 가운데에 size*0.84 비율로 맞춘다."""
    target = max(1, int(round(size * 0.84)))
    w, h = mark.size
    scale = target / max(w, h)
    resized = mark.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(resized, ((size - resized.width) // 2, (size - resized.height) // 2), resized)
    return canvas


def round_mask(img: Image.Image) -> Image.Image:
    """원형 런처 아이콘용 마스크."""
    size = img.size[0]
    big = 4  # 계단 현상 완화
    mask = Image.new("L", (size * big, size * big), 0)
    from PIL import ImageDraw
    ImageDraw.Draw(mask).ellipse((0, 0, size * big - 1, size * big - 1), fill=255)
    mask = mask.resize((size, size), Image.LANCZOS)
    out = img.copy()
    out.putalpha(mask)
    return out


def write_icons(icon: Image.Image, res: Path) -> None:
    mark = extract_mark(icon)
    for name, scale in DENSITY.items():
        d = res / f"mipmap-{name}"
        d.mkdir(parents=True, exist_ok=True)

        legacy_px = round(LAUNCHER_DP * scale)
        legacy = icon.convert("RGBA").resize((legacy_px, legacy_px), Image.LANCZOS)
        legacy.save(d / "ic_launcher.png")
        round_mask(legacy).save(d / "ic_launcher_round.png")

        fg_px = round(FOREGROUND_DP * scale)
        fg = Image.new("RGBA", (fg_px, fg_px), (0, 0, 0, 0))
        # 적응형 아이콘 안전 영역(108dp 중 66dp)에 들어가도록 0.6배로 줄여 중앙 배치
        inner = fit(mark, fg_px)
        small = inner.resize((max(1, round(fg_px * 0.705)), max(1, round(fg_px * 0.705))), Image.LANCZOS)
        fg.paste(small, ((fg_px - small.width) // 2, (fg_px - small.height) // 2), small)
        fg.save(d / "ic_launcher_foreground.png")

    # 적응형 아이콘 배경색
    (res / "values").mkdir(parents=True, exist_ok=True)
    (res / "values" / "ic_launcher_background.xml").write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        "<resources>\n"
        '    <color name="ic_launcher_background">#F6F3EC</color>\n'
        "</resources>\n",
        encoding="utf-8",
    )

    # 스플래시: 크림 배경 + 가운데 달
    for key, (bw, bh) in SPLASH_BASE.items():
        for name, scale in DENSITY.items():
            d = res / f"drawable-{key}-{name}"
            d.mkdir(parents=True, exist_ok=True)
            w, h = round(bw * scale), round(bh * scale)
            splash = Image.new("RGB", (w, h), CREAM[:3])
            glyph_px = max(24, round(min(w, h) * 0.22))
            glyph = fit(mark, glyph_px)
            splash.paste(glyph, ((w - glyph_px) // 2, (h - glyph_px) // 2), glyph)
            splash.save(d / "splash.png")
    (res / "drawable").mkdir(parents=True, exist_ok=True)
    w, h = 480, 320
    splash = Image.new("RGB", (w, h), CREAM[:3])
    glyph = fit(mark, 96)
    splash.paste(glyph, ((w - 96) // 2, (h - 96) // 2), glyph)
    splash.save(res / "drawable" / "splash.png")


def patch_strings(android: Path) -> None:
    p = android / "app/src/main/res/values/strings.xml"
    xml = p.read_text(encoding="utf-8")
    for key in ("app_name", "title_activity_main"):
        xml = re.sub(rf'(<string name="{key}">).*?(</string>)', rf"\g<1>{APP_NAME}\g<2>", xml)
    p.write_text(xml, encoding="utf-8")


def patch_manifest(android: Path) -> None:
    p = android / "app/src/main/AndroidManifest.xml"
    xml = p.read_text(encoding="utf-8")
    if "screenOrientation" not in xml:
        xml = xml.replace(
            'android:name=".MainActivity"',
            'android:name=".MainActivity"\n            android:screenOrientation="portrait"',
            1,
        )
    if "windowSoftInputMode" not in xml:
        xml = xml.replace(
            'android:name=".MainActivity"',
            'android:name=".MainActivity"\n            android:windowSoftInputMode="adjustResize"',
            1,
        )
    p.write_text(xml, encoding="utf-8")


def patch_gradle(android: Path) -> None:
    p = android / "app/build.gradle"
    g = p.read_text(encoding="utf-8")
    g = re.sub(r"versionCode\s+\d+", f"versionCode {VERSION_CODE}", g)
    g = re.sub(r'versionName\s+"[^"]*"', f'versionName "{VERSION_NAME}"', g)
    p.write_text(g, encoding="utf-8")


def patch_theme(android: Path) -> None:
    p = android / "app/src/main/res/values/styles.xml"
    xml = p.read_text(encoding="utf-8")
    if "windowSplashScreenBackground" in xml:
        return
    xml = xml.replace(
        '<item name="android:background">@drawable/splash</item>',
        '<item name="android:background">@drawable/splash</item>\n'
        '        <item name="windowSplashScreenBackground">@color/ic_launcher_background</item>\n'
        '        <item name="windowSplashScreenAnimatedIcon">@mipmap/ic_launcher_foreground</item>\n'
        '        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>',
        1,
    )
    p.write_text(xml, encoding="utf-8")


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    android = Path(sys.argv[1]).resolve()
    icon_path = Path(sys.argv[2]).resolve()
    res = android / "app/src/main/res"
    if not res.is_dir():
        sys.exit(f"안드로이드 프로젝트가 아닙니다: {android}")

    write_icons(Image.open(icon_path), res)
    patch_strings(android)
    patch_manifest(android)
    patch_gradle(android)
    patch_theme(android)
    print("안드로이드 앱 꾸미기 완료:", android)


if __name__ == "__main__":
    main()
