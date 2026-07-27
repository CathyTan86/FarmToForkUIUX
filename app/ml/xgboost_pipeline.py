"""
XGBoost Imputation Pipeline
--------------------------------
Installation:
$ pip install xgboost scikit-learn pandas numpy joblib

This script defines the ML architecture that bridges the gap between messy frontend 
scans (parsed by an LLM) and strict mathematical engines (Leontief EEIO & RUSLE).
"""

import numpy as np
import pandas as pd
import xgboost as xgb
import joblib
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split


class CeroImputationModel:
    def __init__(self):
        # --- FEATURE MAP (The 'X' Inputs from the LLM parser) ---
        self.categorical_features = [
            'product_category',    # e.g., "dairy_alternative", "red_meat"
            'primary_ingredient',  # e.g., "almond", "beef", "soy"
            'packaging_type',      # e.g., "tetra_pak", "plastic_wrap", "glass"
            'inferred_region'      # e.g., "California", "Brazil", "Unknown"
        ]
        
        self.numerical_features = [
            'retail_price_usd',    # e.g., 4.99
            'weight_kg',           # e.g., 1.0
            'protein_g',           # e.g., 12.0
            'fat_g',               # e.g., 8.0
            'carbs_g'              # e.g., 4.0
        ]

        # --- TARGET MAP (The 'Y' Outputs to feed the Math Engines) ---
        self.target_variables = [
            'y_agriculture_pct', 
            'y_processing_pct',
            'y_logistics_pct',
            'y_energy_pct',
            'proxy_R_factor',      # Proxy rainfall erosivity
            'proxy_K_factor'       # Proxy soil erodibility
        ]

        # Preprocessor: Scale numeric features and One-Hot-Encode categorical text
        self.preprocessor = ColumnTransformer(
            transformers=[
                ('num', StandardScaler(), self.numerical_features),
                ('cat', OneHotEncoder(handle_unknown='ignore'), self.categorical_features)
            ]
        )

        # Native multi-output XGBoost Pipeline
        self.model = Pipeline([
            ('preprocessor', self.preprocessor),
            ('regressor', xgb.XGBRegressor(
                objective='reg:squarederror',
                n_estimators=200,
                learning_rate=0.05,
                max_depth=5,
                min_child_weight=3,
                subsample=0.8,
                colsample_bytree=0.8,
                random_state=42
            ))
        ])

    def train_dummy_model(self):
        """
        In production, replace dummy data with parsed AGRIBALYSE, 
        EXIOBASE, and regional database tables.
        """
        print("Generating synthetic LCA training data...")
        np.random.seed(42)
        n_samples = 1000
        
        X_dummy = pd.DataFrame({
            'product_category': np.random.choice(['dairy_alt', 'meat', 'produce', 'snack'], n_samples),
            'primary_ingredient': np.random.choice(['almond', 'beef', 'soy', 'wheat'], n_samples),
            'packaging_type': np.random.choice(['tetra_pak', 'plastic', 'none'], n_samples),
            'inferred_region': np.random.choice(['California', 'Brazil', 'Thailand', 'Unknown'], n_samples),
            'retail_price_usd': np.random.uniform(1.0, 25.0, n_samples),
            'weight_kg': np.random.uniform(0.1, 5.0, n_samples),
            'protein_g': np.random.uniform(0.0, 50.0, n_samples),
            'fat_g': np.random.uniform(0.0, 30.0, n_samples),
            'carbs_g': np.random.uniform(0.0, 100.0, n_samples)
        })

        Y_dummy = pd.DataFrame({
            'y_agriculture_pct': np.random.uniform(0.1, 0.6, n_samples),
            'y_processing_pct': np.random.uniform(0.1, 0.4, n_samples),
            'y_logistics_pct': np.random.uniform(0.05, 0.2, n_samples),
            'y_energy_pct': np.random.uniform(0.05, 0.2, n_samples),
            'proxy_R_factor': np.random.uniform(50, 300, n_samples),
            'proxy_K_factor': np.random.uniform(0.1, 0.5, n_samples)
        })

        # Normalize target economic percentages so they sum strictly to 1.0
        pct_cols = ['y_agriculture_pct', 'y_processing_pct', 'y_logistics_pct', 'y_energy_pct']
        Y_dummy[pct_cols] = Y_dummy[pct_cols].div(Y_dummy[pct_cols].sum(axis=1), axis=0)

        print("Training XGBoost Multi-Output Regressor...")
        X_train, X_test, y_train, y_test = train_test_split(X_dummy, Y_dummy, test_size=0.2, random_state=42)
        self.model.fit(X_train, y_train)
        
        score = self.model.score(X_test, y_test)
        print(f"Training Complete. Model Variance Score (R^2): {score:.2f}")

    def predict_from_scan(self, llm_parsed_json: dict) -> dict:
        """
        Takes structured JSON output from the LLM parser
        and predicts normalized inputs for backend math engines.
        """
        # 1. Enforce default fallback values
        default_input = {
            'product_category': 'Unknown', 
            'primary_ingredient': 'Unknown',
            'packaging_type': 'Unknown', 
            'inferred_region': 'Unknown',
            'retail_price_usd': 1.0, 
            'weight_kg': 1.0,
            'protein_g': 0.0, 
            'fat_g': 0.0, 
            'carbs_g': 0.0
        }
        sanitized_input = {**default_input, **llm_parsed_json}
        
        # 2. Strict feature column ordering to avoid mismatch issues
        ordered_features = self.numerical_features + self.categorical_features
        input_df = pd.DataFrame([sanitized_input])[ordered_features]
        
        # 3. Predict raw outputs from XGBoost
        predictions = self.model.predict(input_df)[0]
        
        # 4. Normalize economic percentages (L1-normalization / Softmax equivalent)
        raw_pcts = np.maximum(0, predictions[:4])  # Clip negative predictions to 0
        total_pct = np.sum(raw_pcts)
        
        normalized_pcts = raw_pcts / total_pct if total_pct > 0 else np.array([0.25, 0.25, 0.25, 0.25])
        retail_price = float(sanitized_input['retail_price_usd'])
        
        # 5. Build JSON payload for math engines
        return {
            "imputed_demand_vector": {
                "agriculture": round(float(normalized_pcts[0] * retail_price), 3),
                "processing": round(float(normalized_pcts[1] * retail_price), 3),
                "logistics": round(float(normalized_pcts[2] * retail_price), 3),
                "energy": round(float(normalized_pcts[3] * retail_price), 3)
            },
            "imputed_environmental_proxies": {
                "R_factor": round(float(predictions[4]), 2),
                "K_factor": round(float(predictions[5]), 3)
            }
        }

    # --- MODEL PERSISTENCE ---
    def save_model(self, filepath: str = "cero_xgb_imputer.joblib"):
        """Saves the fitted pipeline artifact to disk."""
        joblib.dump(self.model, filepath)
        print(f"Model successfully saved to {filepath}")

    def load_model(self, filepath: str = "cero_xgb_imputer.joblib"):
        """Loads a pre-trained pipeline artifact from disk for instant inference."""
        self.model = joblib.load(filepath)
        print(f"Model successfully loaded from {filepath}")


if __name__ == "__main__":
    import json

    # 1. Train and save
    imputer = CeroImputationModel()
    imputer.train_dummy_model()
    imputer.save_model("cero_xgb_imputer.joblib")
    
    # 2. Test production loading
    print("\n--- Testing Production Model Load ---")
    prod_imputer = CeroImputationModel()
    prod_imputer.load_model("cero_xgb_imputer.joblib")
    
    # 3. Live scan simulation
    mock_llm_output = {
        'product_category': 'dairy_alt',
        'primary_ingredient': 'almond',
        'packaging_type': 'tetra_pak',
        'inferred_region': 'California',
        'retail_price_usd': 5.50,
        'weight_kg': 1.0,
        'protein_g': 12.0,
        'fat_g': 5.0,
        'carbs_g': 3.0
    }
    
    print(f"\nLLM Parsed Data: {mock_llm_output}")
    math_engine_inputs = prod_imputer.predict_from_scan(mock_llm_output)
    
    print("\n--- Imputed Outputs for Math Engines ---")
    print(json.dumps(math_engine_inputs, indent=4))
