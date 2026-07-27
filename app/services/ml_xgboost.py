"""
Redirect/Forwarder for XGBoost ML Pipeline.
The primary implementation is located in `app.ml.xgboost_pipeline`.
"""
try:
    from app.ml.xgboost_pipeline import CeroImputationModel, XGBoostPipeline
except ImportError:
    pass
