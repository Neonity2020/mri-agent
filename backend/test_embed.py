import os
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from dotenv import load_dotenv

load_dotenv(".env")

def test_model(model_name):
    print(f"\nTesting {model_name}...")
    try:
        embeddings = GoogleGenerativeAIEmbeddings(model=model_name, google_api_key=os.getenv("GEMINI_API_KEY"))
        res = embeddings.embed_query("test")
        print(f"Success! Dimension: {len(res)}")
    except Exception as e:
        print(f"Failed: {e}")

test_model("models/text-embedding-004")
test_model("text-embedding-004")
test_model("models/embedding-001")
test_model("embedding-001")
