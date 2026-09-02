"""LLM provider factory — returns the right provider based on configuration."""

from app.services.llm_provider import LLMProvider


def get_llm_provider(provider_name: str, api_key: str, model: str) -> LLMProvider:
    """Create an LLM provider instance.

    Args:
        provider_name: "openai" or "anthropic"
        api_key: The API key for the provider
        model: The model identifier
    """
    if provider_name == "openai":
        from app.services.openai_provider import OpenAIProvider

        return OpenAIProvider(api_key=api_key, model=model)
    elif provider_name == "anthropic":
        from app.services.anthropic_provider import AnthropicProvider

        return AnthropicProvider(api_key=api_key, model=model)
    else:
        raise ValueError(
            f"Unknown LLM provider: {provider_name!r}. Must be 'openai' or 'anthropic'."
        )
