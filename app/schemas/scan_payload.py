from pydantic import BaseModel, Field
from typing import Dict, Any, Optional

class ScanPayload(BaseModel):
    sku: str = Field(..., min_length=1, description="Product SKU or barcode identifier")
    price_allocation: Dict[str, float] = Field(
        ...,
        description="Allocation of consumer dollar across economic sectors (keys must match database sector names or general agriculture/processing/logistics/energy)"
    )
    farm_geometry: Optional[Dict[str, Any]] = Field(
        None,
        description="GeoJSON Polygon geometry of the source farm (optional)"
    )
    crop_management_c: float = Field(
        0.15,
        ge=0.0,
        le=1.0,
        description="RUSLE C factor — crop/vegetation management (0=full cover, 1=bare soil)"
    )
    conservation_practice_p: float = Field(
        1.0,
        ge=0.0,
        le=1.0,
        description="RUSLE P factor — conservation practice effectiveness (0=perfect, 1=none)"
    )

class AnalyzeRequest(BaseModel):
    ocrText: str = Field(..., min_length=1, description="Raw OCR or scanned text label to match against sku database")

class ScanRequest(BaseModel):
    """What the React frontend sends to the backend"""
    image: str  # The base64 encoded image string captured by the camera

class ScanResponse(BaseModel):
    """What the backend sends back to the React UI"""
    product_name: str
    retail_price_usd: float
    total_carbon_kg: float
    calories: int
