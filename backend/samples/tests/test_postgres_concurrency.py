from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from threading import Barrier
from unittest import skipUnless

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import close_old_connections, connection, transaction
from django.test import TransactionTestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import PasswordResetOTP
from notifications.models import Notification
from samples.models import MycotoxinResult, Sample
from samples.utils import generate_sequential_sample_id


@skipUnless(connection.vendor == 'postgresql', 'Requires real PostgreSQL row/advisory locks')
class PostgreSQLConcurrencyTests(TransactionTestCase):
    def setUp(self):
        cache.clear()
        self.user = get_user_model().objects.create_user(
            username='parallel', email='parallel@example.com', role='admin'
        )

    def run_pair(self, action):
        barrier = Barrier(2)

        def worker():
            close_old_connections()
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SET lock_timeout = '5s'")
                barrier.wait(timeout=10)
                return action()
            finally:
                connection.close()

        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(worker) for _ in range(2)]
            return [future.result(timeout=20) for future in futures]

    def make_sample(self, sample_id, sequence_number=0):
        return Sample.objects.create(
            sample_id=sample_id, sequence_number=sequence_number, region='Central', province='Bangkok',
            district='Test', vegetation_variety='Rice', sub_type='Rice', collection_date=date(2026, 1, 1),
            recorded_by=self.user,
        )

    def test_two_first_samples_in_same_namespace_get_distinct_ids(self):
        def create():
            with transaction.atomic():
                sid, seq = generate_sequential_sample_id(date(2026, 1, 1), 'Rice')
                return self.make_sample(sid, seq).sample_id

        self.assertEqual(set(self.run_pair(create)), {'RIC-2026-001', 'RIC-2026-002'})

    def test_two_first_results_create_one_row_and_one_alert(self):
        sample = self.make_sample('RIC-2026-001')

        def record():
            client = APIClient()
            client.force_authenticate(self.user)
            return client.post(reverse('sample-add-mycotoxin-result', kwargs={'sample_id': sample.sample_id}),
                               {'toxin_type': 'AFB1', 'value': 30}, format='json').status_code

        self.assertEqual(sorted(self.run_pair(record)), [200, 201])
        self.assertEqual(MycotoxinResult.objects.count(), 1)
        self.assertEqual(Notification.objects.count(), 1)

    def test_one_otp_is_consumed_once_under_concurrent_requests(self):
        PasswordResetOTP.objects.create(
            user=self.user, otp_hash=PasswordResetOTP.hash_otp('123456'),
            expiry=timezone.now() + timedelta(minutes=10),
        )

        def reset():
            return APIClient().post(reverse('password-reset-confirm'), {
                'email': self.user.email, 'otp_code': '123456',
                'new_password': 'StrongConcurrentPass456!', 'confirm_password': 'StrongConcurrentPass456!',
            }, format='json').status_code

        self.assertEqual(sorted(self.run_pair(reset)), [200, 400])

    def test_dashboard_generation_lock_mutual_exclusion_and_release(self):
        import time
        from samples.management.commands.generate_dashboard_snapshot import dashboard_generation_lock

        barrier = Barrier(2)

        def worker_attempt():
            close_old_connections()
            try:
                barrier.wait(timeout=5)
                with dashboard_generation_lock() as acquired:
                    if acquired:
                        time.sleep(0.1)
                    return acquired
            finally:
                connection.close()

        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(worker_attempt) for _ in range(2)]
            results = [f.result(timeout=10) for f in futures]

        self.assertEqual(sorted(results), [False, True])

        close_old_connections()
        with dashboard_generation_lock() as acquired:
            self.assertTrue(acquired)

