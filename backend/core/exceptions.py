"""
Custom exception classes and DRF exception handler for AgriScan Pro.

Provides consistent error response formatting across the API.
"""

import logging
from datetime import datetime, timezone
from rest_framework.exceptions import APIException, NotFound
from rest_framework import status
from rest_framework.views import exception_handler
from django.http import Http404
from django.core.exceptions import PermissionDenied
import rest_framework.exceptions

logger = logging.getLogger('agriscan.middleware')


# ----- Custom Exception Classes -----


class SampleNotFound(NotFound):
    """Raised when a requested sample does not exist."""
    default_detail = 'Sample not found.'
    default_code = 'sample_not_found'


class SampleAlreadyExists(APIException):
    """Raised when attempting to create a sample that already exists."""
    status_code = status.HTTP_409_CONFLICT
    default_detail = 'A sample with this ID already exists.'
    default_code = 'sample_already_exists'


class UserNotFound(NotFound):
    """Raised when a requested user does not exist."""
    default_detail = 'User not found.'
    default_code = 'user_not_found'


class UserAlreadyExists(APIException):
    """Raised when attempting to create a user that already exists."""
    status_code = status.HTTP_409_CONFLICT
    default_detail = 'A user with this email already exists.'
    default_code = 'user_already_exists'


# ----- Custom DRF Exception Handler -----


def agriscan_exception_handler(exc, context):
    """
    Custom exception handler that returns consistent JSON error responses.

    All errors follow the format:
    {
        "error": {
            "code": "error_code",
            "message": "Human-readable message",
            "details": {...}  # Optional — only for validation errors
        },
        "status": "error",
        "timestamp": "2026-03-27T12:00:00Z"
    }

    Args:
        exc: The exception being handled
        context: Dictionary with request, view, and other context

    Returns:
        Response with consistent error format, or None for unhandled exceptions
    """
    # Convert Django Http404 and PermissionDenied to DRF exceptions
    if isinstance(exc, Http404):
        exc = NotFound()
    elif isinstance(exc, PermissionDenied):
        exc = rest_framework.exceptions.PermissionDenied()

    # Use DRF's default exception handler to get a Response object
    response = exception_handler(exc, context)

    if response is not None:
        # Build consistent error envelope
        error_data = {
            'code': getattr(exc, 'default_code', 'error'),
            'message': str(exc.detail) if hasattr(exc, 'detail') else str(exc),
        }

        # For validation errors, move field-level errors to 'details' key
        if isinstance(response.data, dict):
            # Check if this is a validation error (has field-level errors)
            has_field_errors = any(
                isinstance(v, list) for v in response.data.values()
            )
            if has_field_errors:
                error_data['details'] = response.data
                error_data['message'] = 'Validation failed.'
            elif isinstance(response.data.get('detail'), str):
                # Non-field error like authentication errors
                error_data['message'] = response.data['detail']

        # Wrap in consistent envelope
        response.data = {
            'error': error_data,
            'status': 'error',
            'timestamp': datetime.now(timezone.utc).isoformat(),
        }
    else:
        # Unhandled exception (500) — should not reach here in normal operation
        logger.error(
            'agriscan.unhandled_exception',
            extra={
                'exception_type': type(exc).__name__,
                'path': context.get('request').path if context.get('request') else 'unknown',
            },
            exc_info=exc,
        )

    return response
