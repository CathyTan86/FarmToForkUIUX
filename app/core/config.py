import os
from pydantic import BaseModel

# Load .env file variables manually if .env exists
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env")
if os.path.exists(env_path):
    with open(env_path, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                os.environ.setdefault(key.strip(), val.strip())

class Settings(BaseModel):
    PROJECT_NAME: str = "CERO Environmental Accounting Core"
    API_V1_STR: str = "/api/v1"
    DATABASE_PATH: str = os.getenv("DATABASE_PATH", "backend/data/db/cero.db")
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    
    # Raster paths
    R_FACTOR_COG_PATH: str = os.getenv("R_FACTOR_COG_PATH", "backend/data/rasters/gloreda_r_factor.tif")
    K_FACTOR_COG_PATH: str = os.getenv("K_FACTOR_COG_PATH", "backend/data/soilgrids_k_factor.tif")
    LS_FACTOR_COG_PATH: str = os.getenv("LS_FACTOR_COG_PATH", "backend/data/srtm_ls_factor.tif")

settings = Settings()
