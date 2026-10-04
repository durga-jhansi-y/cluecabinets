import base64
import json
import time
import urllib.error
import urllib.request
from urllib.parse import urlparse

from pydantic import BaseModel

from app import config

_gemini_client = None


def generate_structured(prompt: str, schema: type, thinking_level: str = "low") -> BaseModel:
    """Send a prompt to the AI and get the answer back in a fixed shape.

    Which AI is used depends on LLM_PROVIDER in .env.
    thinking_level: "low" for simple tasks, "medium" for harder reasoning.
    """
    started = time.time()
    if config.LLM_PROVIDER == "azure":
        instructions = (
            "Respond only with a JSON object that matches this JSON schema:\n"
            + json.dumps(schema.model_json_schema())
        )
        messages = [
            {"role": "system", "content": instructions},
            {"role": "user", "content": prompt},
        ]
        answer = azure_chat(messages, thinking_level, json_mode=True)
    else:
        answer = gemini_structured(prompt, schema, thinking_level)
    print(f"{config.LLM_PROVIDER} answered in {time.time() - started:.1f} seconds")

    # Check the answer really matches the shape we asked for.
    return schema.model_validate_json(answer)


def describe_images(images: list, instructions: str) -> str:
    """Send one or more images to the AI with instructions, and get plain text back.

    images: a list of (image bytes, mime type) pairs, for example
            [(data, "image/jpeg")]. A video is sent as several frames.
    """
    started = time.time()
    encoded = [
        (base64.b64encode(data).decode("utf-8"), mime_type) for data, mime_type in images
    ]

    if config.LLM_PROVIDER == "azure":
        content = [{"type": "text", "text": instructions}]
        for data, mime_type in encoded:
            content.append(
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:{mime_type};base64,{data}"},
                }
            )
        messages = [{"role": "user", "content": content}]
        answer = azure_chat(messages, "low", json_mode=False)
    else:
        parts = [{"type": "text", "text": instructions}]
        for data, mime_type in encoded:
            parts.append({"type": "image", "data": data, "mime_type": mime_type})
        interaction = get_gemini().interactions.create(
            model=config.GEMINI_MODEL,
            input=parts,
            generation_config={"thinking_level": "low"},
        )
        answer = interaction.output_text

    print(
        f"{config.LLM_PROVIDER} described {len(images)} image(s) "
        f"in {time.time() - started:.1f} seconds"
    )
    return answer


# ---- Azure ----

def azure_urls() -> list:
    """The web addresses to try for the Azure deployment, newest style first."""
    parsed = urlparse(config.AZURE_OPENAI_ENDPOINT.strip())
    if not parsed.netloc:
        raise RuntimeError(
            "AZURE_OPENAI_ENDPOINT should look like https://your-name.openai.azure.com/"
        )
    # Keep only the host, in case a longer address was pasted into .env.
    host = f"{parsed.scheme}://{parsed.netloc}"
    deployment = config.AZURE_OPENAI_DEPLOYMENT
    return [
        f"{host}/openai/v1/chat/completions",
        f"{host}/openai/deployments/{deployment}/chat/completions?api-version=2025-01-01-preview",
    ]


def azure_chat(messages: list, thinking_level: str, json_mode: bool) -> str:
    """Send messages to the Azure deployment over a plain web request."""
    if not (
        config.AZURE_OPENAI_API_KEY
        and config.AZURE_OPENAI_ENDPOINT
        and config.AZURE_OPENAI_DEPLOYMENT
    ):
        raise RuntimeError("Azure settings are missing. Add them to backend/.env")

    payload = {
        "model": config.AZURE_OPENAI_DEPLOYMENT,
        "messages": messages,
        "reasoning_effort": thinking_level,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    body = json.dumps(payload).encode("utf-8")

    last_error = "no address tried"
    for url in azure_urls():
        request = urllib.request.Request(
            url,
            data=body,
            headers={
                "Content-Type": "application/json",
                "api-key": config.AZURE_OPENAI_API_KEY,
            },
            method="POST",
        )
        try:
            # Give up after 5 minutes instead of hanging forever.
            with urllib.request.urlopen(request, timeout=300) as response:
                data = json.loads(response.read().decode("utf-8"))
            return data["choices"][0]["message"]["content"] or ""
        except urllib.error.HTTPError as error:
            details = error.read().decode("utf-8", "replace")[:500]
            last_error = f"{error.code} at {url.split('?')[0]}: {details}"
            if error.code == 404:
                continue  # that address doesn't exist here, try the next style
            break

    raise RuntimeError(f"Azure returned {last_error}")


# ---- Gemini ----

def get_gemini():
    """Create the Gemini client once and reuse it."""
    global _gemini_client
    if _gemini_client is None:
        from google import genai

        if not config.GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY is missing. Add it to backend/.env")
        _gemini_client = genai.Client(api_key=config.GEMINI_API_KEY)
    return _gemini_client


def gemini_structured(prompt: str, schema: type, thinking_level: str) -> str:
    """Ask Gemini. Returns the answer as JSON text."""
    interaction = get_gemini().interactions.create(
        model=config.GEMINI_MODEL,
        input=prompt,
        generation_config={"thinking_level": thinking_level},
        response_format={
            "type": "text",
            "mime_type": "application/json",
            "schema": schema.model_json_schema(),
        },
    )
    return interaction.output_text


# ---- Connection test ----

class Ping(BaseModel):
    greeting: str


def test_connection() -> str:
    """A tiny request to check the AI connection works."""
    return generate_structured("Say hello in three words.", Ping).greeting
