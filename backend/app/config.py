import os
from pathlib import Path

from dotenv import load_dotenv

# Read backend/.env and make its values available.
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

# Which AI to use: "azure" or "gemini". Change it in .env, no code changes.
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini").lower()

AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "")
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY", "")
AZURE_OPENAI_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT", "")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")

SERPAPI_API_KEY = os.getenv("SERPAPI_API_KEY", "")
