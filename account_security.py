import hashlib
import hmac
import secrets
import sqlite3
import time
from contextlib import closing


def hash_password(password):
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 600000).hex()
    return f'pbkdf2_sha256$600000${salt}${digest}'


def check_password(password, encoded):
    if not encoded:
        return False
    try:
        algorithm, rounds, salt, expected = encoded.split('$')
        if algorithm != 'pbkdf2_sha256':
            return False
        actual = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), int(rounds)).hex()
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def init_accounts(path):
    with closing(sqlite3.connect(path)) as conn, conn:
        conn.execute('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, password_hash TEXT)')
        if 'password_hash' not in {row[1] for row in conn.execute('PRAGMA table_info(users)')}:
            conn.execute('ALTER TABLE users ADD COLUMN password_hash TEXT')
        conn.execute('CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, expires_at REAL NOT NULL)')


def create_session(path, email):
    token = secrets.token_urlsafe(32)
    with closing(sqlite3.connect(path)) as conn, conn:
        conn.execute('DELETE FROM sessions WHERE expires_at <= ?', (time.time(),))
        conn.execute('INSERT INTO sessions VALUES (?, ?, ?)', (hashlib.sha256(token.encode()).hexdigest(), email, time.time() + 7 * 86400))
    return {'email': email, 'token': token}


def session_email(path, token):
    with closing(sqlite3.connect(path)) as conn, conn:
        row = conn.execute('SELECT sessions.email FROM sessions JOIN users ON users.email = sessions.email WHERE token_hash = ? AND expires_at > ? AND users.password_hash IS NOT NULL', (hashlib.sha256(token.encode()).hexdigest(), time.time())).fetchone()
    return row[0] if row else None


def revoke_session(path, token):
    with closing(sqlite3.connect(path)) as conn, conn:
        conn.execute('DELETE FROM sessions WHERE token_hash = ?', (hashlib.sha256(token.encode()).hexdigest(),))
