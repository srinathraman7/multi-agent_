"""LLM wrapper: Gemini (primary) with automatic Groq fallback."""
from __future__ import annotations

import json
import os
import time
from typing import Any

_GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "")
_GROQ_KEY = os.environ.get("GROQ_API_KEY", "")


def call_llm(prompt: str, *, system: str = "", json_mode: bool = True) -> str:
    """Call Gemini; fall back to Groq on error or rate limit.

    Returns the raw text of the model's reply.
    Raises RuntimeError only if both providers fail.
    """
    if _GEMINI_KEY:
        try:
            return _call_gemini(prompt, system=system)
        except Exception as exc:
            print(f"[LLM] Gemini failed ({exc}), trying Groq…")

    if _GROQ_KEY:
        try:
            return _call_groq(prompt, system=system)
        except Exception as exc:
            raise RuntimeError(f"Both LLM providers failed. Last error: {exc}") from exc

    # No keys at all — return a structured stub for demo/testing
    return _stub_response(prompt)


# ─── Gemini ───────────────────────────────────────────────────────────────────

def _call_gemini(prompt: str, *, system: str = "") -> str:
    import urllib.request
    import urllib.error

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-1.5-flash:generateContent?key={_GEMINI_KEY}"
    )
    messages = []
    if system:
        messages.append({"role": "user", "parts": [{"text": system}]})
        messages.append({"role": "model", "parts": [{"text": "Understood."}]})
    messages.append({"role": "user", "parts": [{"text": prompt}]})

    body = json.dumps({
        "contents": messages,
        "generationConfig": {"responseMimeType": "application/json"},
    }).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())
    return data["candidates"][0]["content"]["parts"][0]["text"]


# ─── Groq ─────────────────────────────────────────────────────────────────────

def _call_groq(prompt: str, *, system: str = "") -> str:
    import urllib.request

    url = "https://api.groq.com/openai/v1/chat/completions"
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    body = json.dumps({
        "model": "llama3-8b-8192",
        "messages": messages,
        "response_format": {"type": "json_object"},
        "temperature": 0.1,
    }).encode()
    req = urllib.request.Request(url, data=body, headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {_GROQ_KEY}",
    }, method="POST")
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())
    return data["choices"][0]["message"]["content"]


# ─── Stub (no keys) ───────────────────────────────────────────────────────────

def _stub_response(prompt: str) -> str:
    """Return a plausible structured response when no LLM key is configured."""
    if "root_cause" in prompt.lower() or "evidence" in prompt.lower():
        return json.dumps({
            "root_causes": [{
                "cause": "Configuration change in recent deployment reduced resource limits",
                "confidence": 0.80,
                "evidence_ids": ["evt_0007", "evt_0390", "evt_0412"],
                "reasoning": "Error spike correlates with deployment event 8 minutes earlier.",
            }]
        })
    return json.dumps({"result": "stub", "message": "No LLM key configured."})
