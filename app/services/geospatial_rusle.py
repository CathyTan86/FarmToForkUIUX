import os
import numpy as np
from typing import Dict, Any, Optional

try:
    from shapely.geometry import shape as shapely_shape
    SHAPELY_AVAILABLE = True
except ImportError:
    SHAPELY_AVAILABLE = False

try:
    import rasterio
    import rasterio.windows
    from pyproj import Transformer
    RASTERIO_AVAILABLE = True
except ImportError:
    RASTERIO_AVAILABLE = False


class GeospatialRusleEngine:
    def __init__(self):
        # Cloud-Optimized GeoTIFF (COG) paths — override via environment variables
        # for cloud-mounted S3 or GCS assets in production.
        self.r_factor_cog = os.getenv("R_FACTOR_COG_PATH", "backend/data/rasters/gloreda_r_factor.tif")
        self.k_factor_cog = os.getenv("K_FACTOR_COG_PATH", "backend/data/soilgrids_k_factor.tif")
        self.ls_factor_cog = os.getenv("LS_FACTOR_COG_PATH", "backend/data/srtm_ls_factor.tif")

    def _sample_raster(self, raster_path: str, lat: float, lng: float) -> Optional[float]:
        """
        Reads a single pixel value from a Cloud-Optimized GeoTIFF at the given WGS84 coordinate.
        """
        if not RASTERIO_AVAILABLE:
            return None

        try:
            with rasterio.open(raster_path) as src:
                if src.crs and src.crs.to_epsg() != 4326:
                    transformer = Transformer.from_crs(
                        "EPSG:4326", src.crs, always_xy=True
                    )
                    x_proj, y_proj = transformer.transform(lng, lat)
                else:
                    x_proj, y_proj = lng, lat

                row, col = src.index(x_proj, y_proj)

                if not (0 <= row < src.height and 0 <= col < src.width):
                    return None

                window = rasterio.windows.Window(col, row, 1, 1)
                data = src.read(1, window=window)

                nodata = src.nodatavals[0] if src.nodatavals else None
                if data.size == 0 or (
                    nodata is not None
                    and np.isclose(float(data[0, 0]), float(nodata))
                ):
                    return None

                return float(data[0, 0])

        except Exception as e:
            print(
                f"WARNING: Raster sampling failed at ({lat}, {lng}) "
                f"for {raster_path}: {e}"
            )
            return None

    def calculate_erosion(
        self,
        geojson_geometry: Dict[str, Any],
        c_factor: float,
        p_factor: float,
    ) -> Dict[str, Any]:
        """
        Compute annual soil erosion (RUSLE: A = R * K * LS * C * P) for a farm polygon geometry.
        """
        if not SHAPELY_AVAILABLE:
            raise ValueError(
                "GeospatialRusleEngine: shapely is not installed. "
                "Run: brew install geos && pip install shapely"
            )

        if not RASTERIO_AVAILABLE:
            raise ValueError(
                "GeospatialRusleEngine: rasterio is not installed. "
                "Run: brew install gdal && pip install rasterio"
            )

        geom = shapely_shape(geojson_geometry)
        representative_pt = geom.representative_point()
        lng, lat = representative_pt.x, representative_pt.y

        r_val  = self._sample_raster(self.r_factor_cog,  lat, lng)
        k_val  = self._sample_raster(self.k_factor_cog,  lat, lng)
        ls_val = self._sample_raster(self.ls_factor_cog, lat, lng)

        if r_val is None or k_val is None or ls_val is None:
            missing = [
                name for name, val in
                [("R (rainfall erosivity)", r_val),
                 ("K (soil erodibility)",   k_val),
                 ("LS (slope-length)",      ls_val)]
                if val is None
            ]
            raise ValueError(
                f"Missing environmental raster data at ({lat:.6f}, {lng:.6f}): "
                f"{', '.join(missing)}."
            )

        # Core RUSLE equation: A = R * K * LS * C * P
        soil_loss_annual_tons = r_val * k_val * ls_val * c_factor * p_factor

        # USDA thresholds
        risk_level = "low"
        if soil_loss_annual_tons > 11.0:
            risk_level = "severe"
        elif soil_loss_annual_tons > 5.0:
            risk_level = "moderate"

        return {
            "representative_point": {"latitude": lat, "longitude": lng},
            "factors": {
                "R": r_val, "K": k_val, "LS": ls_val,
                "C": c_factor, "P": p_factor
            },
            "annual_soil_loss_tons_acre": round(soil_loss_annual_tons, 3),
            "sediment_risk_rating": risk_level,
        }
