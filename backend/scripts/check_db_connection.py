import sys
import os
import psycopg2


def check_db():
    print("Checking database connectivity...")
    engine = os.environ.get('DB_ENGINE', 'sqlite')
    if engine != 'postgresql':
        print(f"Using {engine}, skipping PostgreSQL connectivity check.")
        return True

    host = os.environ.get('DB_HOST', 'localhost')
    port = os.environ.get('DB_PORT', '5432')
    name = os.environ.get('DB_NAME', 'postgres')
    user = os.environ.get('DB_USER', 'postgres')
    password = os.environ.get('DB_PASSWORD', 'postgres')

    print(f"Connecting to {host}:{port}/{name} as {user}...")

    try:
        conn = psycopg2.connect(
            dbname=name,
            user=user,
            password=password,
            host=host,
            port=port,
            connect_timeout=5
        )
        conn.close()
        print("Database connection successful!")
        return True
    except Exception as e:
        print(f"Database connection FAILED: {e}")
        return False


if __name__ == "__main__":
    if not check_db():
        sys.exit(1)
    sys.exit(0)
