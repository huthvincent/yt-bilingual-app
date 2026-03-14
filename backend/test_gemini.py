import json
import asyncio
import os
from google import genai
from google.genai import types

async def test():
    client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
    prompt = "Reply with {'status': 'ok'} in JSON."
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        print("Success:", response.text)
    except Exception as e:
        print("Error:", e)

asyncio.run(test())
