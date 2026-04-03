import os
from pinecone import Pinecone
from dotenv import load_dotenv

load_dotenv(".env")
pinecone_api_key = os.getenv("PINECONE_API_KEY")
if pinecone_api_key:
    pc = Pinecone(api_key=pinecone_api_key)
    index_name = os.getenv("PINECONE_INDEX_NAME", "mri-learning-agent")
    if pc.has_index(index_name):
        print(f"Deleting index {index_name}...")
        pc.delete_index(index_name)
    else:
        print(f"Index {index_name} not found.")
