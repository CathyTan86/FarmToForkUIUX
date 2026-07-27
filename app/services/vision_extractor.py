import json
import base64
import os
# In production, uncomment the SDK for the LLM you are using:
# import anthropic  # For Claude
# import google.generativeai as genai # For Gemini
# from openai import OpenAI # For GPT-4o

class VisionExtractorService:
    """
    This service acts as the 'Eyes' of the application.
    It receives an image from the frontend camera, sends it to a Vision LLM,
    and forces the LLM to return a strict JSON payload containing the features
    required by the XGBoost pipeline.
    """
    
    def __init__(self):
        # Initialize your LLM client here
        # Example: self.client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        pass

    def _get_extraction_prompt(self) -> str:
        """
        The prompt is critical. It forces the LLM to act as a data extractor
        and return ONLY valid JSON, with no conversational filler.
        """
        return """
        You are an expert supply chain data extraction AI.
        Analyze the provided image of a food product, receipt, or label.
        Extract the following information and return it STRICTLY as a valid JSON object.
        Do NOT wrap the JSON in markdown blocks (like ```json), just output the raw JSON.
        
        Required fields:
        - "product_category": (string) Try to classify as one of: ['dairy_alt', 'meat', 'produce', 'snack', 'beverage', 'unknown']
        - "primary_ingredient": (string) The main ingredient (e.g., 'almond', 'beef', 'wheat')
        - "packaging_type": (string) e.g., 'tetra_pak', 'plastic', 'glass', 'paper', 'none'
        - "inferred_region": (string) Where was this produced? (e.g., 'California', 'Brazil', 'Unknown')
        - "retail_price_usd": (float) Extract price if visible on receipt, otherwise estimate standard market value, default to 5.0
        - "weight_kg": (float) Extract weight, convert to kg. Default to 1.0 if unknown.
        - "protein_g": (float) Extract from nutrition label. Default 0.0.
        - "fat_g": (float) Extract from nutrition label. Default 0.0.
        - "carbs_g": (float) Extract from nutrition label. Default 0.0.
        
        If a field is completely missing and cannot be inferred, use "Unknown" for strings and 0.0 for numbers.
        """

    def process_image(self, base64_image: str) -> dict:
        """
        Sends the image to the Vision LLM and parses the JSON response.
        """
        print("Sending image to Vision LLM for extraction...")
        prompt = self._get_extraction_prompt()

        try:
            # --- MOCK LLM CALL ---
            # Replace this block with your actual LLM API call.
            # Example using Anthropic Claude 3.5 Sonnet:
            """
            response = self.client.messages.create(
                model="claude-3-5-sonnet-20240620",
                max_tokens=1024,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/jpeg",
                                    "data": base64_image,
                                }
                            }
                        ]
                    }
                ]
            )
            llm_text_output = response.content[0].text
            """
            
            # For development, we return a simulated perfect response
            llm_text_output = '''{
                "product_category": "dairy_alt",
                "primary_ingredient": "almond",
                "packaging_type": "tetra_pak",
                "inferred_region": "California",
                "retail_price_usd": 4.99,
                "weight_kg": 1.0,
                "protein_g": 2.0,
                "fat_g": 3.5,
                "carbs_g": 1.0
            }'''
            
            # Parse the text response into a Python dictionary
            extracted_data = json.loads(llm_text_output)
            
            # Basic validation to ensure keys exist before sending to XGBoost
            required_keys = ['product_category', 'primary_ingredient', 'packaging_type', 'inferred_region']
            for key in required_keys:
                if key not in extracted_data:
                    extracted_data[key] = "Unknown"
                    
            print("Successfully extracted data via Vision LLM.")
            return extracted_data

        except json.JSONDecodeError:
            print("Error: The LLM did not return valid JSON.")
            # Return a safe fallback so the app doesn't crash
            return self._get_fallback_payload()
        except Exception as e:
            print(f"An error occurred during Vision LLM extraction: {e}")
            return self._get_fallback_payload()

    def _get_fallback_payload(self) -> dict:
        """Returns a safe, neutral payload if the LLM fails."""
        return {
            "product_category": "unknown",
            "primary_ingredient": "unknown",
            "packaging_type": "unknown",
            "inferred_region": "Unknown",
            "retail_price_usd": 1.0,
            "weight_kg": 1.0,
            "protein_g": 0.0,
            "fat_g": 0.0,
            "carbs_g": 0.0
        }

if __name__ == "__main__":
    # Test the service locally
    extractor = VisionExtractorService()
    # Passing a dummy base64 string
    result = extractor.process_image("dummy_base64_string_xyz")
    print(json.dumps(result, indent=2))