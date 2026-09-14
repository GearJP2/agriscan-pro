from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import PasswordResetOTP


class OTPAtomicityTests(TestCase):
    def test_token_revocation_failure_rolls_back_password_and_otp(self):
        user = get_user_model().objects.create_user(
            username='atomic', email='atomic@example.com', password='Original123!'
        )
        otp = PasswordResetOTP.objects.create(
            user=user, otp_hash=PasswordResetOTP.hash_otp('123456'), expiry=timezone.now() + timedelta(minutes=10),
        )
        with patch('accounts.views.blacklist_all_user_tokens', side_effect=RuntimeError('revocation failed')):
            with self.assertRaises(RuntimeError):
                APIClient().post(reverse('password-reset-confirm'), {
                    'email': user.email, 'otp_code': '123456',
                    'new_password': 'NewSecurePassword456!', 'confirm_password': 'NewSecurePassword456!',
                }, format='json')
        user.refresh_from_db()
        otp.refresh_from_db()
        self.assertTrue(user.check_password('Original123!'))
        self.assertFalse(otp.used)
