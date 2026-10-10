from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import random
import smtplib
from email.mime.text import MIMEText
import sqlite3 # 🌟 ใช้ SQLite แทน Firebase (มีใน Python อยู่แล้ว)

app = FastAPI()

# ==========================================
# 1. ตั้งค่าและสร้างฐานข้อมูล SQLite
# ==========================================
def init_db():
    # สร้างหรือเชื่อมต่อกับไฟล์ users.db ในโฟลเดอร์นี้
    conn = sqlite3.connect("users.db")
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
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    cursor.execute("SELECT email FROM users WHERE email = ?", (clean_email,))
    existing_user = cursor.fetchone()
    conn.close()

    if existing_user:
        raise HTTPException(status_code=400, detail="อีเมลนี้ถูกใช้งานและสมัครสมาชิกเรียบร้อยแล้วครับ")

    # ถ้ายังไม่มีให้สร้างและส่ง OTP
    code = str(random.randint(100000, 999999))
    otp_storage[clean_email] = code

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

    return {"message": "ส่งรหัส OTP สำเร็จ", "email": clean_email}

# ==========================================
# 3. API ตรวจสอบ OTP และบันทึกผู้ใช้ลง SQLite
# ==========================================
@app.post("/api/verify-otp")
def verify_otp(data: VerifyRequest):
    clean_email = data.email.strip().lower()
    stored_otp = otp_storage.get(clean_email)
    
    if not stored_otp or stored_otp != data.otp:
        raise HTTPException(status_code=400, detail="รหัส OTP ไม่ถูกต้องหรือหมดอายุ")
    
    # ถ้ายืนยันสำเร็จ ให้บันทึกอีเมลลงไฟล์ users.db ถาวร
    try:
        conn = sqlite3.connect("users.db")
        cursor = conn.cursor()
        cursor.execute("INSERT INTO users (email) VALUES (?)", (clean_email,))
        conn.commit()
        conn.close()
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="อีเมลนี้ถูกใช้งานไปแล้ว")
    except Exception as e:
        raise HTTPException(status_code=500, detail="ไม่สามารถบันทึกข้อมูลลงฐานข้อมูลได้")
    
    del otp_storage[clean_email]
    return {"message": "ยืนยันตัวตนสำเร็จ บันทึกลงฐานข้อมูลแล้ว"}