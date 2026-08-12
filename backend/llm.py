"""DeepSeek（OpenAI 兼容）客户端。

翻译 / 总结 / 词典都走这里；thinking 默认关掉，省时省钱。
"""
import os

from openai import OpenAI

from config import DEFAULT_MODEL

DEEPSEEK_BASE_URL = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com")


def get_client() -> OpenAI:
    api_key = os.environ.get("DEEPSEEK_API_KEY", "")
    if not api_key:
        raise RuntimeError("DEEPSEEK_API_KEY is not set")
    return OpenAI(api_key=api_key, base_url=DEEPSEEK_BASE_URL)


def chat_complete(
    *,
    messages: list[dict],
    model: str = DEFAULT_MODEL,
    json_mode: bool = False,
    max_tokens: int | None = None,
) -> str:
    """Non-streaming chat completion; returns assistant content text."""
    kwargs: dict = {
        "model": model,
        "messages": messages,
        # Translation / dictionary / summary don't need CoT — disable thinking.
        "extra_body": {"thinking": {"type": "disabled"}},
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    if max_tokens is not None:
        kwargs["max_tokens"] = max_tokens

    response = get_client().chat.completions.create(**kwargs)
    content = response.choices[0].message.content
    if not content:
        raise RuntimeError("DeepSeek returned empty content")
    return content
