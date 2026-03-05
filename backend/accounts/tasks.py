from celery import shared_task
import time

@shared_task
def sample_background_task(duration=5):
    """
    A sample background task that simulates a long-running process.
    It pauses for `duration` seconds and then returns a success message.
    """
    print(f"Starting background task... Sleeping for {duration} seconds.")
    time.sleep(duration)
    return f"Task completed successfully after {duration} seconds."
