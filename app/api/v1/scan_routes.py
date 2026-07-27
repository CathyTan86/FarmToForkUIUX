import os
import sqlite3
import base64
from fastapi import APIRouter, File, UploadFile, HTTPException, Depends
from typing import Dict, Any, Optional
import numpy as np

from app.core.config import settings
from app.schemas.scan_payload import ScanPayload, AnalyzeRequest, ScanRequest, ScanResponse
from app.services.vision_extractor import VisionExtractorService
from app.services.geospatial_rusle import GeospatialRusleEngine, RASTERIO_AVAILABLE, SHAPELY_AVAILABLE
from app.ml.xgboost_pipeline import CeroImputationModel
from app.services.carbon_tracking_engine import CarbonTrackingEngine

router = APIRouter()

# Initialize vision service, imputer model, carbon engine and geospatial engine
vision_service = VisionExtractorService()
geo_engine = GeospatialRusleEngine()

print("Booting ML Pipeline...")
imputer = CeroImputationModel()
imputer.train_dummy_model()  # Trains the XGBoost weights in memory

carbon_engine = CarbonTrackingEngine()

# Pre-defined 5x5 Leontief Inverse and 3x5 Stressor matrices from database config
LeontiefInverse = np.array([
    [1.258, 0.324, 0.154, 0.124, 0.045],
    [0.215, 1.287, 0.187, 0.098, 0.054],
    [0.187, 0.298, 1.214, 0.214, 0.098],
    [0.387, 0.542, 0.698, 1.354, 0.214],
    [0.124, 0.214, 0.287, 0.187, 1.124]
])

StressorMatrix = np.array([
    [0.48, 1.15, 0.75, 2.40, 1.35],       # Row 0 = Carbon intensity (kg CO2e/$)
    [250.0, 1500.0, 450.0, 50.0, 12.0],   # Row 1 = Water intensity (L/$)
    [1.85, 8.40, 0.95, 0.12, 0.05]        # Row 2 = Land intensity (m2/$)
])

def get_db_connection():
    db_path = settings.DATABASE_PATH
    if not os.path.exists(db_path):
        # Fallback to local path if not exists
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def fuzzy_match_ocr(text: str, ingredients_list: list) -> Optional[dict]:
    normalized = text.lower().strip()
    # Step 1: Substring match
    for ing in ingredients_list:
        clean_key = ing['key_name'].replace("scanned_", "").lower()
        clean_display = ing['display_name'].lower()
        if clean_key in normalized or clean_display in normalized:
            return ing
            
    # Step 2: Word-by-word match
    words = [w.strip(" .,_-") for w in normalized.split()]
    words = [w for w in words if w]
    for word in words:
        for ing in ingredients_list:
            clean_key = ing['key_name'].replace("scanned_", "").lower()
            clean_display = ing['display_name'].lower()
            if word == clean_key or word == clean_display:
                return ing
    return None

def resolve_and_compute(matched_ingredient: dict, conn) -> dict:
    # Fetch sector details
    cursor = conn.cursor()
    cursor.execute(
        "SELECT name, commodity_price_usd_per_kg, mrio_index FROM sectors WHERE id = ?",
        (matched_ingredient['sector_id'],)
    )
    sector = cursor.fetchone()
    if not sector:
        raise HTTPException(status_code=500, detail="Sector matching ingredient not found.")

    weight_g = matched_ingredient['default_weight_g']
    weight_ratio = weight_g / 100.0

    # Calculate amino acids and nutrition
    kcal = weight_ratio * matched_ingredient['kcal_100g']
    protein = weight_ratio * matched_ingredient['protein_100g']
    sodium = weight_ratio * matched_ingredient['sodium_100g']
    potassium = weight_ratio * matched_ingredient['potassium_100g']
    
    # 9 essential amino acids + Glutamine (fallback to 0 if not present)
    lysine = weight_ratio * (matched_ingredient.get('lysine_100g') or 0.0)
    histidine = weight_ratio * (matched_ingredient.get('histidine_100g') or 0.0)
    isoleucine = weight_ratio * (matched_ingredient.get('isoleucine_100g') or 0.0)
    leucine = weight_ratio * (matched_ingredient.get('leucine_100g') or 0.0)
    methionine = weight_ratio * (matched_ingredient.get('methionine_100g') or 0.0)
    phenylalanine = weight_ratio * (matched_ingredient.get('phenylalanine_100g') or 0.0)
    threonine = weight_ratio * (matched_ingredient.get('threonine_100g') or 0.0)
    tryptophan = weight_ratio * (matched_ingredient.get('tryptophan_100g') or 0.0)
    valine = weight_ratio * (matched_ingredient.get('valine_100g') or 0.0)
    glutamine = 0.0 # Seeded fallback

    nutrient_density = ((protein / 50.0 + potassium / 3500.0) * 100.0) - (sodium / 2300.0 * 20.0)
    nutrient_density = max(1.0, nutrient_density)

    # Leontief 5x5 system calculations
    mrio_index = sector['mrio_index']
    price_per_kg = sector['commodity_price_usd_per_kg']
    weight_kg = weight_g / 1000.0
    demand_usd = weight_kg * price_per_kg

    y = np.zeros(5)
    y[mrio_index] = demand_usd

    x = LeontiefInverse @ y
    footprint = StressorMatrix @ x

    # Fetch all sectors ordered by mrio_index to build breakdown
    cursor.execute("SELECT name, mrio_index FROM sectors ORDER BY mrio_index ASC")
    all_sectors = cursor.fetchall()
    sector_names = {row['mrio_index']: row['name'] for row in all_sectors}

    breakdown = []
    for idx in range(5):
        sec_name = sector_names.get(idx, f"Sector {idx}")
        output = LeontiefInverse[idx][mrio_index] * demand_usd
        carbon = StressorMatrix[0][idx] * output
        breakdown.append({
            "sector": sec_name,
            "economic_output_usd": round(output, 4),
            "carbon_kg_co2": round(carbon, 4)
        })

    return {
        "item": {
            "id": matched_ingredient['id'],
            "key_name": matched_ingredient['key_name'],
            "display_name": matched_ingredient['display_name'],
            "weight_g": weight_g,
            "price_usd": round(demand_usd, 4),
            "sector_id": matched_ingredient['sector_id']
        },
        "nutrition": {
            "kcal": round(kcal, 1),
            "protein_g": round(protein, 2),
            "sodium_mg": round(sodium, 2),
            "potassium_mg": round(potassium, 2),
            "lysine_g": round(lysine, 3),
            "glutamine_g": round(glutamine, 3),
            "histidine_g": round(histidine, 3),
            "isoleucine_g": round(isoleucine, 3),
            "leucine_g": round(leucine, 3),
            "methionine_g": round(methionine, 3),
            "phenylalanine_g": round(phenylalanine, 3),
            "threonine_g": round(threonine, 3),
            "tryptophan_g": round(tryptophan, 3),
            "valine_g": round(valine, 3),
            "nutrient_density_index": round(nutrient_density, 1)
        },
        "sustainability": {
            "carbon_kg_co2": round(footprint[0], 4),
            "water_liters": round(footprint[1], 2),
            "land_m2": round(footprint[2], 4),
            "total_economic_impact_usd": round(float(np.sum(x)), 4)
        },
        "matrix_computation": {
            "demand_vector_y": [round(val, 4) for val in y],
            "output_vector_x": [round(val, 4) for val in x],
            "sector_breakdown": breakdown
        }
    }


@router.get("/api/data")
async def get_data():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Load ingredients
        cursor.execute("SELECT * FROM ingredients")
        ingredients = [dict(row) for row in cursor.fetchall()]

        # Load sectors
        cursor.execute("SELECT * FROM sectors")
        sectors = [dict(row) for row in cursor.fetchall()]

        # Load aaindex records
        cursor.execute("SELECT * FROM aaindex_records")
        aaindex_records = [dict(row) for row in cursor.fetchall()]

        return {
            "ingredients": ingredients,
            "sectors": sectors,
            "aaindex_records": aaindex_records,
            "leontief_inverse": LeontiefInverse.tolist(),
            "stressor_matrix": StressorMatrix.tolist()
        }
    finally:
        conn.close()


@router.post("/api/analyze")
async def analyze_ocr(payload: AnalyzeRequest):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM ingredients")
        ingredients = [dict(row) for row in cursor.fetchall()]
        
        matched = fuzzy_match_ocr(payload.ocrText, ingredients)
        if not matched:
            raise HTTPException(
                status_code=404,
                detail=f"Item '{payload.ocrText}' could not be matched to SKU database."
            )
            
        return resolve_and_compute(matched, conn)
    finally:
        conn.close()


@router.post("/api/v1/scan", response_model=ScanResponse)
@router.post("/scan", response_model=ScanResponse)
async def process_food_scan(payload: ScanRequest):
    """
    The master pipeline: Image -> Vision LLM -> XGBoost -> Leontief Matrix -> UI
    """
    try:
        # Strip data URL prefix if it exists in base64 payload
        base64_image = payload.image
        if "," in base64_image:
            base64_image = base64_image.split(",", 1)[1]

        # 1. VISION LLM: Extract features from the Base64 image
        extracted_features = vision_service.process_image(base64_image)

        # 2. XGBOOST: Predict the missing economic and geospatial variables
        imputed_data = imputer.predict_from_scan(extracted_features)

        # 3. LEONTIEF MATRIX: Compute the total carbon footprint
        # We extract the predicted demand vector from XGBoost
        demand_vector = [
            imputed_data["imputed_demand_vector"]["agriculture"],
            imputed_data["imputed_demand_vector"]["processing"],
            imputed_data["imputed_demand_vector"]["logistics"],
            imputed_data["imputed_demand_vector"]["energy"]
        ]
        
        # Multiply the Leontief Inverse (L) by the XGBoost predicted demand (y)
        y = np.array(demand_vector)
        total_economic_output = carbon_engine.L @ y
        
        # Multiply by the environmental extension vector (e) to get actual carbon
        sector_emissions = carbon_engine.e * total_economic_output
        total_carbon = float(np.sum(sector_emissions))

        # 4. CALORIE PROXY: Rough macro math for the UI
        protein = extracted_features.get('protein_g', 10)
        fat = extracted_features.get('fat_g', 5)
        carbs = extracted_features.get('carbs_g', 20)
        estimated_calories = int((protein * 4) + (fat * 9) + (carbs * 4))

        # 5. Build dynamic name based on LLM inference
        region = extracted_features.get('inferred_region', 'Local')
        ingredient = extracted_features.get('primary_ingredient', 'Dish').title()
        
        # Return the final calculated payload to the React frontend!
        return ScanResponse(
            product_name=f"{region} {ingredient}",
            retail_price_usd=extracted_features.get('retail_price_usd', 5.0),
            total_carbon_kg=round(total_carbon, 2),
            calories=estimated_calories
        )

    except Exception as e:
        print(f"Error processing scan: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error during pipeline execution")


@router.post("/api/v1/vision/analyze-frame")
async def analyze_frame(image: UploadFile = File(...)):
    # 1. Read file bytes and encode to base64
    file_bytes = await image.read()
    base64_image = base64.b64encode(file_bytes).decode("utf-8")

    # 2. Extract fields from Vision LLM Service
    extracted = vision_service.process_image(base64_image)

    # 3. Match primary ingredient to DB key
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM ingredients")
        ingredients = [dict(row) for row in cursor.fetchall()]
        
        primary_ing = extracted.get("primary_ingredient", "").lower()
        matched = None
        
        # Substring/fuzzy lookup inside DB ingredients
        for ing in ingredients:
            clean_name = ing['key_name'].replace("scanned_", "").lower()
            if primary_ing in clean_name or clean_name in primary_ing:
                matched = ing
                break
                
        # Default fallback if unknown or unmatched
        if not matched:
            matched = next((ing for ing in ingredients if ing['key_name'] == 'scanned_tofu'), ingredients[0])

        computed = resolve_and_compute(matched, conn)

        # 4. Format response matching mobile app coordinates & summary requirements
        return {
            "status": "success",
            "detected_ingredients": [
                {
                    "id": computed["item"]["key_name"],
                    "name": computed["item"]["display_name"],
                    "x": 50.0,
                    "y": 45.0,
                    "estimates": {
                        "weight_g": computed["item"]["weight_g"],
                        "kcal": computed["nutrition"]["kcal"],
                        "protein_g": computed["nutrition"]["protein_g"],
                        "carbon_kg": computed["sustainability"]["carbon_kg_co2"]
                    }
                }
            ],
            "dish_summary": {
                "estimated_total_kcal": computed["nutrition"]["kcal"],
                "estimated_total_protein_g": computed["nutrition"]["protein_g"],
                "estimated_total_carbon_kg": computed["sustainability"]["carbon_kg_co2"]
            }
        }
    finally:
        conn.close()


@router.post("/api/v1/environmental-profile")
async def environmental_profile(payload: ScanPayload):
    # Determine demand vector y based on price_allocation
    y = np.zeros(5)
    
    # Database sector lookup map to map sector names to mrio_index
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT name, mrio_index FROM sectors")
        sectors = {row['name']: row['mrio_index'] for row in cursor.fetchall()}
    finally:
        conn.close()

    # Map name parameters dynamically
    for sector_name, val in payload.price_allocation.items():
        if val < 0:
            raise HTTPException(status_code=400, detail="Demand values must be non-negative.")
        
        # Match keys (flexible string matches)
        matched_idx = None
        for db_name, m_idx in sectors.items():
            if sector_name.lower() in db_name.lower() or db_name.lower() in sector_name.lower():
                matched_idx = m_idx
                break
        
        if matched_idx is not None:
            y[matched_idx] += val
        else:
            # Fallback to key index checks
            if sector_name.isdigit() and 0 <= int(sector_name) < 5:
                y[int(sector_name)] += val

    # Calculate Leontief carbon footprint
    x = LeontiefInverse @ y
    footprint = StressorMatrix @ x

    # Calculate soil erosion if geometry provided
    soil_loss = 0.0
    rusle_status = "no_geometry"
    rusle_details = {}
    
    if payload.farm_geometry:
        if RASTERIO_AVAILABLE and SHAPELY_AVAILABLE:
            try:
                res = geo_engine.calculate_erosion(
                    payload.farm_geometry,
                    payload.crop_management_c,
                    payload.conservation_practice_p
                )
                soil_loss = res.get("soil_loss_t_ha_yr", 0.0)
                rusle_status = "success"
                rusle_details = res
            except Exception as e:
                rusle_status = f"error: {str(e)}"
        else:
            rusle_status = "libraries_missing"

    return {
        "sku": payload.sku,
        "demand_vector_y": y.tolist(),
        "output_vector_x": x.tolist(),
        "carbon_footprint_kg_co2e": round(float(footprint[0]), 4),
        "water_footprint_l": round(float(footprint[1]), 2),
        "land_footprint_m2": round(float(footprint[2]), 4),
        "rusle_soil_erosion": {
            "status": rusle_status,
            "soil_loss_t_ha_yr": round(soil_loss, 4),
            "details": rusle_details
        }
    }
