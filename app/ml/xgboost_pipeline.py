"""
XGBoost Imputation Pipeline
--------------------------------
Installation:
Run the following command in your terminal once your system completes its run:
$ pip install xgboost scikit-learn pandas numpy

This script defines the ML architecture that bridges the gap between messy frontend 
scans (parsed by an LLM) and our strict mathematical engines (Leontief & RUSLE).
"""

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.multioutput import MultiOutputRegressor
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split

class CeroImputationModel:
    def __init__(self):
        # --- FEATURE MAP (The 'X' Inputs from the LLM parser) ---
        # These are the fields the LLM will extract from the scanned receipt/label.
        self.categorical_features = [
            'product_category', # e.g., "dairy_alternative", "red_meat"
            'primary_ingredient', # e.g., "almond", "beef", "soy"
            'packaging_type',   # e.g., "tetra_pak", "plastic_wrap", "glass"
            'inferred_region'   # e.g., "California", "Brazil", "Unknown"
        ]
        
        self.numerical_features = [
            'retail_price_usd', # e.g., 4.99
            'weight_kg',        # e.g., 1.0
            'protein_g',        # e.g., 12.0 (for nutrient density estimation)
            'fat_g',            # e.g., 8.0
            'carbs_g'           # e.g., 4.0
        ]

        # --- TARGET MAP (The 'Y' Outputs to feed the Math Engines) ---
        # 1. Economic Allocation (y vector for Leontief) - % of price per sector
        # 2. Proxy Environmental Factors (if exact farm is unknown)
        self.target_variables = [
            'y_agriculture_pct', 
            'y_processing_pct',
            'y_logistics_pct',
            'y_energy_pct',
            'proxy_R_factor',  # Proxy rainfall erosivity
            'proxy_K_factor'   # Proxy soil erodibility
        ]

        # We must scale numbers and One-Hot-Encode text so XGBoost can process them.
        self.preprocessor = ColumnTransformer(
            transformers=[
                ('num', StandardScaler(), self.numerical_features),
                ('cat', OneHotEncoder(handle_unknown='ignore'), self.categorical_features)
            ]
        )

        # Wrap XGBoost to predict multiple targets simultaneously
        self.model = Pipeline([
            ('preprocessor', self.preprocessor),
            ('regressor', MultiOutputRegressor(
                xgb.XGBRegressor(
                    objective='reg:squarederror',
                    n_estimators=200,
                    learning_rate=0.1,
                    max_depth=6,
                    random_state=42
                )
            ))
        ])

    def train_dummy_model(self):
        """
        In production, replace this dummy data with your parsed AGRIBALYSE, 
        EXIOBASE, and Thai FCD datasets.
        """
        print("Generating synthetic LCA training data...")
        # Synthetic dataset representing 1000 historical products
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

        # Synthetic target data (what we want the model to learn to predict)
        Y_dummy = pd.DataFrame({
            'y_agriculture_pct': np.random.uniform(0.1, 0.6, n_samples),
            'y_processing_pct': np.random.uniform(0.1, 0.4, n_samples),
            'y_logistics_pct': np.random.uniform(0.05, 0.2, n_samples),
            'y_energy_pct': np.random.uniform(0.05, 0.2, n_samples),
            'proxy_R_factor': np.random.uniform(50, 300, n_samples),
            'proxy_K_factor': np.random.uniform(0.1, 0.5, n_samples)
        })

        # Normalize the economic percentages so they sum to 1.0
        pct_cols = ['y_agriculture_pct', 'y_processing_pct', 'y_logistics_pct', 'y_energy_pct']
        Y_dummy[pct_cols] = Y_dummy[pct_cols].div(Y_dummy[pct_cols].sum(axis=1), axis=0)

        print("Training XGBoost Multi-Output Regressor...")
        X_train, X_test, y_train, y_test = train_test_split(X_dummy, Y_dummy, test_size=0.2)
        self.model.fit(X_train, y_train)
        
        # Simple accuracy proxy (R^2 score)
        score = self.model.score(X_test, y_test)
        print(f"Training Complete. Model Variance Score (R^2): {score:.2f}")

    def predict_from_scan(self, llm_parsed_json: dict) -> dict:
        """
        Takes the structured JSON output from your LLM (which parsed the messy scan)
        and predicts the exact mathematical inputs needed for the backend engines.
        """
        # Convert single dictionary into a DataFrame with 1 row
        input_df = pd.DataFrame([llm_parsed_json])
        
        # Predict
        predictions = self.model.predict(input_df)[0]
        
        # Structure the payload for the CarbonMatrixEngine & GeospatialRusleEngine
        retail_price = llm_parsed_json.get('retail_price_usd', 1.0)
        
        imputed_payload = {
            "imputed_demand_vector": {
                "agriculture": round(predictions[0] * retail_price, 3),
                "processing": round(predictions[1] * retail_price, 3),
                "logistics": round(predictions[2] * retail_price, 3),
                "energy": round(predictions[3] * retail_price, 3)
            },
            "imputed_environmental_proxies": {
                "R_factor": round(predictions[4], 2),
                "K_factor": round(predictions[5], 3)
            }
        }
        
        return imputed_payload

if __name__ == "__main__":
    # 1. Initialize and train the model (would load from saved file in production)
    imputer = CeroImputationModel()
    imputer.train_dummy_model()
    
    # 2. Simulate a scan from the frontend App, passed through the LLM
    print("\n--- Simulating Live Scan Request ---")
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
    
    print(f"LLM Parsed Data: {mock_llm_output}")
    
    # 3. Generate the imputed variables for the math engines
    math_engine_inputs = imputer.predict_from_scan(mock_llm_output)
    
    print("\n--- Imputed Outputs for Math Engines ---")
    import json
    print(json.dumps(math_engine_inputs, indent=4))