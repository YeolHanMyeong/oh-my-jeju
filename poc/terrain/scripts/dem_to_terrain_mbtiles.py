# /// script
# requires-python = ">=3.11"
# dependencies = ["rasterio>=1.3", "mercantile", "numpy", "pillow"]
# ///
"""DEM(EPSG:3857 GeoTIFF) -> terrain-RGB(mapbox 인코딩) MBTiles 타일러.

rio-rgbify 대체. 인코딩: v = (elevation + 10000) / 0.1
  R = (v >> 16) & 0xFF, G = (v >> 8) & 0xFF, B = v & 0xFF

사용법: uv run dem_to_terrain_mbtiles.py <입력_3857.tif> <출력.mbtiles> <min_z> <max_z>
"""

import io
import sqlite3
import sys

import mercantile
import numpy as np
import rasterio
from PIL import Image
from rasterio.warp import transform_bounds
from rasterio.windows import from_bounds

TILE_SIZE = 512
BASE_VAL = -10000.0
INTERVAL = 0.1
# 주의: bbox 안의 타일은 바다뿐이어도 반드시 기록해야 한다. 타일이 누락되면
# MapLibre가 해당 타일을 영영 pending으로 두어 'load' 이벤트가 발생하지 않는다
# (특히 high-pitch 3D에서 수평선 너머 바다 타일이 요청됨).


def encode_terrain_rgb(elev: np.ndarray) -> np.ndarray:
    v = np.round((elev - BASE_VAL) / INTERVAL).astype(np.uint32)
    rgb = np.empty((*elev.shape, 3), dtype=np.uint8)
    rgb[..., 0] = (v >> 16) & 0xFF
    rgb[..., 1] = (v >> 8) & 0xFF
    rgb[..., 2] = v & 0xFF
    return rgb


def main() -> None:
    src_path, dst_path, min_z, max_z = (
        sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]),
    )

    db = sqlite3.connect(dst_path)
    db.executescript(
        """
        DROP TABLE IF EXISTS tiles; DROP TABLE IF EXISTS metadata;
        CREATE TABLE tiles (
            zoom_level INTEGER, tile_column INTEGER, tile_row INTEGER,
            tile_data BLOB,
            PRIMARY KEY (zoom_level, tile_column, tile_row)
        );
        CREATE TABLE metadata (name TEXT, value TEXT);
        """
    )

    with rasterio.open(src_path) as src:
        assert src.crs.to_epsg() == 3857, "입력은 EPSG:3857이어야 합니다"
        nodata = src.nodata
        w, s, e, n = transform_bounds(src.crs, "EPSG:4326", *src.bounds)

        # 상수 0(바다) 타일은 한 번만 인코딩해 재사용
        zero_buf = io.BytesIO()
        Image.fromarray(
            encode_terrain_rgb(np.zeros((TILE_SIZE, TILE_SIZE))), mode="RGB"
        ).save(zero_buf, format="PNG", optimize=True)
        zero_png = zero_buf.getvalue()

        written = 0
        for z in range(min_z, max_z + 1):
            for tile in mercantile.tiles(w, s, e, n, z):
                tb = mercantile.xy_bounds(tile)
                window = from_bounds(tb.left, tb.bottom, tb.right, tb.top, src.transform)
                elev = src.read(
                    1,
                    window=window,
                    out_shape=(TILE_SIZE, TILE_SIZE),
                    resampling=rasterio.enums.Resampling.bilinear,
                    boundless=True,
                    fill_value=nodata if nodata is not None else 0,
                ).astype(np.float64)

                if nodata is not None:
                    elev[elev == nodata] = 0.0
                elev[~np.isfinite(elev)] = 0.0

                if elev.max() < 0.5 and elev.min() > -0.5:
                    data = zero_png
                else:
                    png = Image.fromarray(encode_terrain_rgb(elev), mode="RGB")
                    buf = io.BytesIO()
                    png.save(buf, format="PNG", optimize=True)
                    data = buf.getvalue()

                tms_row = (1 << z) - 1 - tile.y
                db.execute(
                    "INSERT INTO tiles VALUES (?, ?, ?, ?)",
                    (z, tile.x, tms_row, data),
                )
                written += 1
            print(f"  z{z} 완료 (누적 {written} 타일)")

        db.executemany(
            "INSERT INTO metadata VALUES (?, ?)",
            [
                ("name", "jeju-terrain-rgb"),
                ("format", "png"),
                ("type", "baselayer"),
                ("version", "1"),
                ("description", "Jeju terrain-RGB DEM tiles (mapbox encoding)"),
                ("minzoom", str(min_z)),
                ("maxzoom", str(max_z)),
                ("bounds", f"{w},{s},{e},{n}"),
            ],
        )

    db.commit()
    db.close()
    print(f"완료: {dst_path} ({written} 타일)")


if __name__ == "__main__":
    main()
