import importlib.util
import os
from pathlib import Path
import sqlite3
import tempfile
import time
import unittest
from contextlib import closing
from unittest.mock import patch
from fastapi.testclient import TestClient


class AccountTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix='account-tests-', dir=Path(__file__).parent / '.logs')
        cls.path = str(Path(cls.temp.name) / 'accounts.db')
        with patch.dict(os.environ, {'AUTH_DATABASE': cls.path}):
            spec = importlib.util.spec_from_file_location('test_account_server', Path(__file__).with_name('main.py'))
            cls.server = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(cls.server)
        cls.client = TestClient(cls.server.app)

    @classmethod
    def tearDownClass(cls):
        cls.client.close()
        cls.temp.cleanup()

    def setUp(self):
        with closing(sqlite3.connect(self.path)) as conn, conn:
            conn.execute('DELETE FROM users')
            conn.execute('DELETE FROM sessions')
        self.server.otp_storage.clear()

    def register(self, email='test@example.test', password='test-password'):
        with patch.object(self.server.smtplib, 'SMTP_SSL'):
            response = self.client.post('/api/send-otp', json={'email': email, 'password': password})
        self.assertEqual(response.status_code, 200)
        code = self.server.otp_storage[email.strip().lower()]['code']
        response = self.client.post('/api/verify-otp', json={'email': email, 'otp': code})
        self.assertEqual(response.status_code, 200)
        return response.json()

    def test_unregistered_and_pending_accounts_cannot_login(self):
        body = {'email': 'unknown@example.test', 'password': 'test-password'}
        self.assertEqual(self.client.post('/api/login', json=body).status_code, 401)
        with patch.object(self.server.smtplib, 'SMTP_SSL'):
            self.client.post('/api/send-otp', json=body)
        self.assertEqual(self.client.post('/api/login', json=body).status_code, 401)

    def test_registered_account_requires_correct_password(self):
        self.register()
        with closing(sqlite3.connect(self.path)) as conn, conn:
            stored = conn.execute('SELECT password_hash FROM users').fetchone()[0]
        self.assertNotIn('test-password', stored)
        self.assertTrue(stored.startswith('pbkdf2_sha256$'))
        self.assertEqual(self.client.post('/api/login', json={'email': 'test@example.test', 'password': 'wrong'}).status_code, 401)
        response = self.client.post('/api/login', json={'email': ' TEST@EXAMPLE.TEST ', 'password': 'test-password'})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['token'])

    def test_otp_is_required_expires_and_has_attempt_limit(self):
        with patch.object(self.server.smtplib, 'SMTP_SSL'):
            self.client.post('/api/send-otp', json={'email': 'test@example.test', 'password': 'test-password'})
        pending = self.server.otp_storage['test@example.test']
        wrong = '999999' if pending['code'] != '999999' else '000000'
        for _ in range(5):
            self.assertEqual(self.client.post('/api/verify-otp', json={'email': 'test@example.test', 'otp': wrong}).status_code, 400)
        self.assertEqual(self.client.post('/api/verify-otp', json={'email': 'test@example.test', 'otp': pending['code']}).status_code, 400)
        with closing(sqlite3.connect(self.path)) as conn, conn:
            self.assertEqual(conn.execute('SELECT COUNT(*) FROM users').fetchone()[0], 0)

    def test_session_validation_expiry_and_logout(self):
        data = self.register()
        headers = {'Authorization': 'Bearer ' + data['token']}
        self.assertEqual(self.client.get('/api/session').status_code, 401)
        self.assertEqual(self.client.get('/api/session', headers={'Authorization': 'Bearer invented'}).status_code, 401)
        self.assertEqual(self.client.get('/api/session', headers=headers).json()['email'], 'test@example.test')
        self.client.post('/api/logout', headers=headers)
        self.assertEqual(self.client.get('/api/session', headers=headers).status_code, 401)
        data = self.client.post('/api/login', json={'email': 'test@example.test', 'password': 'test-password'}).json()
        with closing(sqlite3.connect(self.path)) as conn, conn:
            conn.execute('UPDATE sessions SET expires_at = ?', (time.time() - 1,))
        self.assertEqual(self.client.get('/api/session', headers={'Authorization': 'Bearer ' + data['token']}).status_code, 401)

    def test_expired_otp_and_failed_email_delivery_cannot_register(self):
        with patch.object(self.server.smtplib, 'SMTP_SSL', side_effect=OSError('test delivery failure')):
            response = self.client.post('/api/send-otp', json={'email': 'test@example.test', 'password': 'test-password'})
        self.assertEqual(response.status_code, 500)
        self.assertNotIn('test@example.test', self.server.otp_storage)
        with patch.object(self.server.smtplib, 'SMTP_SSL'):
            self.client.post('/api/send-otp', json={'email': 'test@example.test', 'password': 'test-password'})
        pending = self.server.otp_storage['test@example.test']
        pending['expires_at'] = time.time() - 1
        response = self.client.post('/api/verify-otp', json={'email': 'test@example.test', 'otp': pending['code']})
        self.assertEqual(response.status_code, 400)
        with closing(sqlite3.connect(self.path)) as conn, conn:
            self.assertEqual(conn.execute('SELECT COUNT(*) FROM users').fetchone()[0], 0)

    def test_legacy_account_must_verify_email_to_set_password(self):
        with closing(sqlite3.connect(self.path)) as conn, conn:
            conn.execute('INSERT INTO users (email) VALUES (?)', ('test@example.test',))
        response = self.client.post('/api/login', json={'email': 'test@example.test', 'password': 'anything'})
        self.assertEqual(response.status_code, 401)
        self.register()
        with closing(sqlite3.connect(self.path)) as conn, conn:
            self.assertEqual(conn.execute('SELECT COUNT(*) FROM users').fetchone()[0], 1)
        self.assertEqual(self.client.post('/api/login', json={'email': 'test@example.test', 'password': 'test-password'}).status_code, 200)

    def test_duplicate_registration_cannot_change_existing_password(self):
        self.register()
        with patch.object(self.server.smtplib, 'SMTP_SSL') as smtp:
            response = self.client.post('/api/send-otp', json={'email': 'test@example.test', 'password': 'replacement'})
            self.assertEqual(response.status_code, 400)
            smtp.assert_not_called()
        self.assertEqual(self.client.post('/api/login', json={'email': 'test@example.test', 'password': 'replacement'}).status_code, 401)

    def test_old_database_migration_preserves_existing_users(self):
        path = str(Path(self.temp.name) / 'legacy.db')
        with closing(sqlite3.connect(path)) as conn, conn:
            conn.execute('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL)')
            conn.execute('INSERT INTO users VALUES (1, ?)', ('legacy@example.test',))
        self.server.init_accounts(path)
        with closing(sqlite3.connect(path)) as conn, conn:
            self.assertEqual(conn.execute('SELECT id, email, password_hash FROM users').fetchone(), (1, 'legacy@example.test', None))


if __name__ == '__main__':
    unittest.main()
