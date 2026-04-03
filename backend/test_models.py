import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv(".env")
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

try:
    models = list(genai.list_models())
    found_embed = False
    print("Testing models:")
    for m in models:
        # print(f"Model: {m.name}, Methods: {m.supported_generation_methods}")
        if "embedContent" in m.supported_generation_methods:
            print(f"AVAILABLE EMBEDDING: {m.name}")
            found_embed = True
    if not found_embed:
        print("NO EMBEDDING MODELS AVAILABLE FOR THIS API KEY.")
except Exception as e:
    print(f"ListModels failed: {e}")
