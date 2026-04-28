"""Shared test helpers for the accounts test package."""


def extract_error_text(response) -> str:
    """Extract a readable error message from the project's error envelope."""
    response_data = getattr(response, "data", {})
    if not isinstance(response_data, dict):
        return str(response_data)

    error_data = response_data.get("error")
    if isinstance(error_data, dict):
        details = error_data.get("details")
        if details is not None:
            return str(details)
        message = error_data.get("message")
        if message is not None:
            return str(message)

    return str(response_data)
