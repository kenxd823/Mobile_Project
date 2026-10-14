"""Run from any directory: python Backend_API/api_server.py."""
import os
from pathlib import Path
from threading import Lock

import cv2
import mysql.connector
import numpy as np
from flask import Flask, jsonify, request
from menu_reference import load_menu_reference
from menu_predictor import MenuPredictor

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 12 * 1024 * 1024
BASE_DIR = Path(__file__).resolve().parent
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', '3306')),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'database': os.getenv('DB_NAME', 'ncd_database'),
    'connection_timeout': 5,
}
model_food = None
model_spoon = None
model_lock = Lock()


def load_models():
    global model_food, model_spoon
    if model_food is None or model_spoon is None:
        from ultralytics import YOLO
        model_food = YOLO(str(BASE_DIR / 'best.pt'))
        model_spoon = YOLO(str(BASE_DIR / 'best (10)spoon.pt'))


@app.after_request
def cors_headers(response):
    origin = request.headers.get('Origin')
    allowed = os.getenv('WEB_ORIGINS', 'http://localhost:8081,http://localhost:19006').split(',')
    if origin and origin in allowed:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Vary'] = 'Origin'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        response.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
    return response


@app.errorhandler(413)
def too_large(_error):
    return jsonify(status='error', message='รูปภาพใหญ่เกิน 12 MB กรุณาถ่ายใหม่'), 413


@app.get('/api/health')
def health():
    conn = None
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        conn.ping(reconnect=False)
        return jsonify(status='success', service='food-analysis', database='connected', analysisVersion=2)
    except mysql.connector.Error:
        return jsonify(status='error', service='food-analysis', message='เซิร์ฟเวอร์เปิดอยู่ แต่เชื่อมต่อฐานข้อมูลอาหารไม่ได้'), 503
    finally:
        if conn is not None:
            conn.close()


@app.post('/api/analyze')
def analyze_food():
    if 'image' not in request.files:
        return jsonify(status='error', message='ไม่พบรูปภาพ'), 400
    payload = request.files['image'].read()
    img = cv2.imdecode(np.frombuffer(payload, dtype=np.uint8), cv2.IMREAD_COLOR) if payload else None
    if img is None:
        return jsonify(status='error', message='อ่านรูปภาพไม่ได้ กรุณาถ่ายใหม่'), 400
    h, w = img.shape[:2]
    longest = max(h, w)
    if longest > 1280:
        img = cv2.resize(img, (max(1, round(w * 1280 / longest)), max(1, round(h * 1280 / longest))))
    mode = request.form.get('mode', 'before')
    if mode not in ('before', 'after'):
        return jsonify(status='error', message='รูปแบบการวิเคราะห์ไม่ถูกต้อง'), 400
    try:
        # In-memory images prevent concurrent requests overwriting temp_img.jpg.
        with model_lock:
            load_models()
            results_food = model_food(img, conf=0.001 if mode == 'before' else 0.05, imgsz=960, predictor=MenuPredictor)[0]
            results_spoon = model_spoon(img, conf=0.25)[0]
        detected_pixels = {}
        confidences = {}
        for box in results_food.boxes:
            name = results_food.names[int(box.cls[0])]
            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
            area = float((x2 - x1) * (y2 - y1))
            if area > 0:
                confidence = float(box.conf[0])
                if confidence > confidences.get(name, -1):
                    detected_pixels[name] = area
                    confidences[name] = confidence
        if not detected_pixels or (mode == 'before' and max(confidences.values()) < 0.25):
            if mode == 'after' and not detected_pixels:
                return jsonify(status='success', menu=request.form.get('menu_class') or 'อาหารหลังกิน', nutrition={}, nutritionBasis='area-only', emptyCandidate=True, comparisonReady=False)
            return jsonify(status='empty', message='ยังจับเมนูไม่ได้ ลองถ่ายอาหารจริงจากด้านบน ให้จานอยู่กลางภาพ แสงสว่าง และถือกล้องนิ่ง หากกินหมดแล้วให้เลือกปรับเองเป็นเหลือ 0%')
        spoon_pixels = 0.0
        for box in results_spoon.boxes:
            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
            spoon_pixels = max(spoon_pixels, float((x2 - x1) * (y2 - y1)))
        # One reference serving of the detected menu, not a serving for every box.
        name = request.form.get('menu_class') if mode == 'after' else max(confidences, key=confidences.get)
        if not name or name not in detected_pixels:
            return jsonify(status='empty', message='ยังตรวจพื้นที่ของเมนูก่อนกินในภาพนี้ไม่ได้ กรุณาถ่ายใหม่หรือเลือกปรับเปอร์เซ็นต์เอง')
        if mode == 'after':
            # After photos only measure area. Never look up or replace baseline nutrition.
            result = {'menu': name, 'referenceClass': name, 'nutritionBasis': 'area-only', 'nutrition': {}}
        else:
            result = load_menu_reference(name)
            result['candidates'] = [
                {**load_menu_reference(candidate), 'confidence': confidences[candidate],
                 'portions': [{'className': candidate, 'area': detected_pixels[candidate], 'relativeArea': detected_pixels[candidate] / spoon_pixels if spoon_pixels > 0 else None}],
                 'comparisonReady': spoon_pixels > 0}
                for candidate in sorted(confidences, key=confidences.get, reverse=True)[:3]
            ]
        result.update(status='success',
                      portions=[{'className': name, 'area': detected_pixels[name], 'relativeArea': detected_pixels[name] / spoon_pixels if spoon_pixels > 0 else None}],
                      comparisonReady=spoon_pixels > 0,
                      areaMethod='detection-box',
                      missing_nutrients=[key for key, value in result['nutrition'].items() if value is None])
        return jsonify(**result)
    except Exception:
        app.logger.exception('Food analysis failed')
        return jsonify(status='error', message='วิเคราะห์ภาพไม่สำเร็จ กรุณาตรวจสอบโมเดลและข้อมูลบนเซิร์ฟเวอร์'), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', '5000')), debug=False)
