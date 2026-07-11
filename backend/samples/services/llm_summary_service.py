import json
import logging
import re

import requests
from django.conf import settings
from urllib.parse import urlsplit, urlunsplit

logger = logging.getLogger('agriscan.samples')


class LLMSummaryServiceError(RuntimeError):
    pass


class LLMSummaryNotConfigured(LLMSummaryServiceError):
    pass


class LLMSummaryService:
    @staticmethod
    def _parse_risk_drivers(content: str) -> list[str]:
        json_match = re.search(r'\{[\s\S]*\}', content)
        source = json_match.group(0) if json_match else content

        try:
            parsed = json.loads(source)
            drivers = parsed.get('riskDrivers')
            if isinstance(drivers, list):
                return [
                    item.strip()
                    for item in drivers[:4]
                    if isinstance(item, str) and item.strip()
                ]
        except json.JSONDecodeError:
            pass

        return [
            line.strip().lstrip('-*0123456789.) ').strip()
            for line in content.splitlines()
            if line.strip()
        ][:4]

    @staticmethod
    def _build_prompt(payload: dict) -> str:
        return '\n'.join([
            'You write concise public health surveillance summaries for mycotoxin risk dashboards.',
            'Return only valid JSON with a riskDrivers array of exactly 4 short strings.',
            'Do not invent precise statistics beyond the provided aggregate data.',
            f'Aggregate dashboard data: {json.dumps(payload, separators=(",", ":"))}',
        ])

    @classmethod
    def _generate_openai_compatible(cls, endpoint: str, model: str, api_key: str, prompt: str) -> list[str]:
        try:
            response = requests.post(
                endpoint,
                headers={
                    'Authorization': f'Bearer {api_key}',
                    'Content-Type': 'application/json',
                },
                json={
                    'model': model,
                    'messages': [
                        {
                            'role': 'system',
                            'content': (
                                'You write concise public health surveillance summaries. '
                                'Return only valid JSON with riskDrivers.'
                            ),
                        },
                        {'role': 'user', 'content': prompt},
                    ],
                    'temperature': 0.2,
                    'max_tokens': settings.LLM_SUMMARY_MAX_OUTPUT_TOKENS,
                },
                timeout=settings.LLM_SUMMARY_TIMEOUT_SECONDS,
            )
        except requests.RequestException as exc:
            logger.warning(
                'public_health_summary.llm_provider_request_failed',
                extra={'error': str(exc)},
            )
            raise LLMSummaryServiceError('LLM provider request failed.') from exc

        if response.status_code >= 400:
            logger.warning(
                'public_health_summary.llm_provider_failed',
                extra={'status_code': response.status_code},
            )
            raise LLMSummaryServiceError('LLM provider returned an error.')

        try:
            data = response.json()
        except ValueError as exc:
            raise LLMSummaryServiceError('LLM provider returned invalid JSON.') from exc
        choices = data.get('choices')
        first_choice = choices[0] if isinstance(choices, list) and choices else {}
        if not isinstance(first_choice, dict):
            first_choice = {}
        message = first_choice.get('message', {})
        if not isinstance(message, dict):
            message = {}
        content = message.get('content', '') or first_choice.get('text', '')
        return cls._parse_risk_drivers(content)

    @staticmethod
    def _gemini_generate_content_url(endpoint: str, model: str) -> str:
        if ':generateContent' in endpoint:
            return endpoint

        parsed = urlsplit(endpoint)
        prefix = parsed.path.split('/models', 1)[0]
        if prefix == '/v1beta2':
            prefix = '/v1beta'
        path = f'{prefix}/models/{model}:generateContent'
        return urlunsplit((parsed.scheme, parsed.netloc, path, '', ''))

    @classmethod
    def _generate_gemini(cls, endpoint: str, model: str, api_key: str, prompt: str) -> list[str]:
        try:
            response = requests.post(
                cls._gemini_generate_content_url(endpoint, model),
                headers={
                    'Content-Type': 'application/json',
                    'x-goog-api-key': api_key,
                },
                json={
                    'contents': [
                        {
                            'role': 'user',
                            'parts': [{'text': prompt}],
                        },
                    ],
                'generationConfig': {
                    'temperature': 0.2,
                    'maxOutputTokens': settings.LLM_SUMMARY_MAX_OUTPUT_TOKENS,
                    'responseMimeType': 'application/json',
                    'thinkingConfig': {'thinkingBudget': 0},
                },
                },
                timeout=settings.LLM_SUMMARY_TIMEOUT_SECONDS,
            )
        except requests.RequestException as exc:
            logger.warning(
                'public_health_summary.gemini_provider_request_failed',
                extra={'error': str(exc)},
            )
            raise LLMSummaryServiceError('Gemini provider request failed.') from exc

        if response.status_code >= 400:
            logger.warning(
                'public_health_summary.gemini_provider_failed',
                extra={'status_code': response.status_code, 'body': response.text[:300]},
            )
            raise LLMSummaryServiceError('Gemini provider returned an error.')

        try:
            data = response.json()
        except ValueError as exc:
            raise LLMSummaryServiceError('Gemini provider returned invalid JSON.') from exc
        candidates = data.get('candidates')
        first_candidate = candidates[0] if isinstance(candidates, list) and candidates else {}
        if not isinstance(first_candidate, dict):
            first_candidate = {}
        candidate_content = first_candidate.get('content', {})
        if not isinstance(candidate_content, dict):
            candidate_content = {}
        parts = candidate_content.get('parts', [])
        if not isinstance(parts, list):
            parts = []
        content = '\n'.join(
            part.get('text', '')
            for part in parts
            if isinstance(part, dict)
        )
        return cls._parse_risk_drivers(content)

    @classmethod
    def generate_public_health_summary(cls, payload: dict) -> dict:
        endpoint = settings.LLM_SUMMARY_ENDPOINT
        model = settings.LLM_SUMMARY_MODEL
        api_key = settings.LLM_SUMMARY_API_KEY

        if not endpoint or not model or not api_key:
            raise LLMSummaryNotConfigured('LLM summary provider is not configured.')

        prompt = cls._build_prompt(payload)
        if 'generativelanguage.googleapis.com' in endpoint:
            risk_drivers = cls._generate_gemini(endpoint, model, api_key, prompt)
        else:
            risk_drivers = cls._generate_openai_compatible(endpoint, model, api_key, prompt)

        if not risk_drivers:
            raise LLMSummaryServiceError('LLM provider returned no usable risk drivers.')

        return {'riskDrivers': risk_drivers}
