from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
import os
from pydantic import BaseModel
import smtplib
from email.mime.text import MIMEText
import sqlite3 # 🌟 ใช้ SQLite แทน Firebase (มีใน Python อยู่แล้ว)
import secrets
import time
from pathlib import Path
from contextlib import closing
from account_security import hash_password, check_password, init_accounts, create_session, session_email, revoke_session, delete_authenticated_account

DB_PATH = os.getenv('AUTH_DATABASE', str(Path(__file__).with_name('users.db')))

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv('AUTH_WEB_ORIGINS', 'http://localhost:8081,http://127.0.0.1:8081,http://192.168.0.254:8081').split(',') if origin.strip()],
    allow_methods=['GET', 'POST'],
    allow_headers=['Content-Type', 'Authorization'],
)


@app.get('/api/health')
def health():
    return {'status': 'success', 'service': 'account-api', 'authVersion': 2}

# ==========================================
# 1. ตั้งค่าและสร้างฐานข้อมูล SQLite
# ==========================================
def init_db():
    # สร้างหรือเชื่อมต่อกับไฟล์ users.db ในโฟลเดอร์นี้
    init_accounts(DB_PATH)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # สร้างตาราง users เพื่อเก็บอีเมล (ถ้ายังไม่มี)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL
        )
    ''')
    conn.commit()
    conn.close()

# เรียกใช้ฟังก์ชันสร้างฐานข้อมูลตอนรันโค้ด
init_db()

# เก็บ OTP ชั่วคราว
otp_storage = {}

class EmailRequest(BaseModel):
    email: str
    password: str | None = None

class LoginRequest(BaseModel):
    email: str
    password: str

class DeleteAccountRequest(BaseModel):
    password: str

class VerifyRequest(BaseModel):
    email: str
    otp: str

# ==========================================
# 2. API ส่งรหัส OTP และเช็คอีเมลซ้ำจาก SQLite
# ==========================================
@app.post("/api/send-otp")
def send_otp(data: EmailRequest):
    clean_email = data.email.strip().lower()

    # เปิดฐานข้อมูลเช็คว่ามีอีเมลนี้หรือยัง
    if '@' not in clean_email or len(clean_email) > 254:
        raise HTTPException(status_code=400, detail='กรุณากรอกอีเมลให้ถูกต้อง')
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT password_hash FROM users WHERE email = ?", (clean_email,))
    existing_user = cursor.fetchone()
    conn.close()

    if existing_user and existing_user[0]:
        raise HTTPException(status_code=400, detail="อีเมลนี้ถูกใช้งานและสมัครสมาชิกเรียบร้อยแล้วครับ")

    # ถ้ายังไม่มีให้สร้างและส่ง OTP
    pending = otp_storage.get(clean_email)
    if data.password is not None:
        if len(data.password) < 8 or len(data.password) > 128:
            raise HTTPException(status_code=400, detail='รหัสผ่านต้องมีความยาว 8–128 ตัวอักษร')
        password_hash = hash_password(data.password)
    elif pending and pending['expires_at'] > time.time():
        password_hash = pending['password_hash']
    else:
        raise HTTPException(status_code=400, detail='กรุณากลับไปสมัครสมาชิกและตั้งรหัสผ่านก่อน')
    if pending and time.time() - pending['sent_at'] < 30:
        raise HTTPException(status_code=429, detail='กรุณารอ 30 วินาทีก่อนขอรหัสใหม่')
    code = f'{secrets.randbelow(1000000):06d}'

    sender_email = "nokken15@gmail.com"
    sender_password = "iyvl uocx gyfg dqle"  
    
    msg = MIMEText(f"รหัสยืนยันตัวตน (OTP) ของคุณคือ: {code}")
    msg["Subject"] = "รหัส OTP สำหรับยืนยันตัวตนในแอป"
    msg["From"] = sender_email
    msg["To"] = clean_email

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(sender_email, sender_password)
            server.sendmail(sender_email, clean_email, msg.as_string())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ไม่สามารถส่งอีเมลได้: {str(e)}")

    otp_storage[clean_email] = {'code': code, 'password_hash': password_hash, 'expires_at': time.time() + 600, 'sent_at': time.time(), 'attempts': 0}
    return {"message": "ส่งรหัส OTP สำเร็จ", "email": clean_email}

# ==========================================
# 3. API ตรวจสอบ OTP และบันทึกผู้ใช้ลง SQLite
# ==========================================
@app.post("/api/verify-otp")
def verify_otp(data: VerifyRequest):
    clean_email = data.email.strip().lower()
    stored_otp = otp_storage.get(clean_email)
    
    if not stored_otp or stored_otp['expires_at'] <= time.time() or stored_otp['attempts'] >= 5:
        otp_storage.pop(clean_email, None)
        raise HTTPException(status_code=400, detail="รหัส OTP ไม่ถูกต้องหรือหมดอายุ")
    stored_otp['attempts'] += 1
    if not secrets.compare_digest(stored_otp['code'], data.otp):
        raise HTTPException(status_code=400, detail="รหัส OTP ไม่ถูกต้องหรือหมดอายุ")
    
    # ถ้ายืนยันสำเร็จ ให้บันทึกอีเมลลงไฟล์ users.db ถาวร
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("INSERT INTO users (email, password_hash) VALUES (?, ?) ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash WHERE users.password_hash IS NULL", (clean_email, stored_otp['password_hash']))
        if cursor.rowcount != 1:
            conn.close()
            raise HTTPException(status_code=400, detail='อีเมลนี้สมัครสมาชิกแล้ว กรุณาเข้าสู่ระบบ')
        conn.commit()
        conn.close()
    except HTTPException:
        raise
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="อีเมลนี้ถูกใช้งานไปแล้ว")
    except Exception as e:
        raise HTTPException(status_code=500, detail="ไม่สามารถบันทึกข้อมูลลงฐานข้อมูลได้")
    
    del otp_storage[clean_email]
    return {"message": "สมัครสมาชิกสำเร็จ", **create_session(DB_PATH, clean_email)}


@app.post('/api/login')
def login(data: LoginRequest):
    clean_email = data.email.strip().lower()
    if len(data.password) > 128:
        raise HTTPException(status_code=401, detail='อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาสมัครสมาชิกก่อนหากยังไม่มีบัญชี')
    with closing(sqlite3.connect(DB_PATH)) as conn, conn:
        row = conn.execute('SELECT password_hash FROM users WHERE email = ?', (clean_email,)).fetchone()
    if row and not row[0]:
        raise HTTPException(status_code=401, detail='บัญชีเดิมยังไม่ได้ตั้งรหัสผ่าน กรุณาไปหน้าสมัครสมาชิกเพื่อยืนยัน OTP และตั้งรหัสผ่าน')
    if not row or not check_password(data.password, row[0]):
        raise HTTPException(status_code=401, detail='อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาสมัครสมาชิกก่อนหากยังไม่มีบัญชี')
    return create_session(DB_PATH, clean_email)


@app.get('/api/session')
def get_session(authorization: str | None = Header(default=None)):
    token = authorization[7:] if authorization and authorization.startswith('Bearer ') else ''
    email = session_email(DB_PATH, token) if token else None
    if not email:
        raise HTTPException(status_code=401, detail='กรุณาเข้าสู่ระบบใหม่')
    return {'email': email}


@app.post('/api/logout')
def logout(authorization: str | None = Header(default=None)):
    if authorization and authorization.startswith('Bearer '):
        revoke_session(DB_PATH, authorization[7:])
    return {'status': 'success'}


@app.post('/api/delete-account')
def delete_account(data: DeleteAccountRequest, authorization: str | None = Header(default=None)):
    token = authorization[7:] if authorization and authorization.startswith('Bearer ') else ''
    email, error = delete_authenticated_account(DB_PATH, token, data.password)
    if error == 'session':
        raise HTTPException(status_code=401, detail='กรุณาเข้าสู่ระบบใหม่ก่อนลบบัญชี')
    if error == 'password':
        raise HTTPException(status_code=403, detail='รหัสผ่านไม่ถูกต้อง บัญชียังไม่ได้ถูกลบ')
    otp_storage.pop(email, None)
    return {'status': 'success', 'message': 'ลบบัญชีแล้ว'}
