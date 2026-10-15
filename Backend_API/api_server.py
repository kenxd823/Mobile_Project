"""Run from any directory: python Backend_API/api_server.py."""
import os
from pathlib import Path
from threading import Lock

import cv2
import mysql.connector
import numpy as np
from flask import Flask, jsonify, request
from menu_reference import load_menu_label, load_menu_reference
from menu_predictor import MenuPredictor
from spoon_bowl import measure_spoon_bowl

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
SPOON_MODEL_PATH = BASE_DIR / 'yolo11s-seg.pt'
COCO_SPOON_CLASS = 44
SCALE_REFERENCE = 'coco-yolo11s-seg-bowl-pca-v1'
MAX_IMAGE_SIZE = 1280
FOOD_IMAGE_SIZE = 960
SPOON_IMAGE_SIZE = 640
DETECTED_FOOD_CONFIDENCE = 0.25


def load_models():
    global model_food, model_spoon
    from ultralytics import YOLO
    if model_food is None:
        model_food = YOLO(str(BASE_DIR / 'best.pt'))
    if model_spoon is None:
        spoon = YOLO(str(SPOON_MODEL_PATH))
        if spoon.names.get(COCO_SPOON_CLASS) != 'spoon' or spoon.task != 'segment':
            raise RuntimeError('The scale model must be COCO segmentation with spoon at class 44')
        model_spoon = spoon


def decode_food_image(payload):
    """อ่านภาพที่ส่งมาและย่อภาพใหญ่ เพื่อลดเวลาประมวลผล"""
    if not payload:
        return None
    image = cv2.imdecode(np.frombuffer(payload, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        return None
    height, width = image.shape[:2]
    longest_side = max(height, width)
    if longest_side > MAX_IMAGE_SIZE:
        scale = MAX_IMAGE_SIZE / longest_side
        image = cv2.resize(image, (max(1, round(width * scale)), max(1, round(height * scale))))
    return image


def detect_food_and_spoon(image, mode):
    """เรียกโมเดลอาหารและช้อน โดยไม่ให้คำขอหลายรายการใช้โมเดลพร้อมกัน"""
    food_confidence = 0.001 if mode == 'before' else 0.05
    with model_lock:
        load_models()
        food_result = model_food(
            image, conf=food_confidence, imgsz=FOOD_IMAGE_SIZE, predictor=MenuPredictor
        )[0]
        spoon_result = model_spoon(
            image, classes=[COCO_SPOON_CLASS], conf=0.15,
            imgsz=SPOON_IMAGE_SIZE, retina_masks=True, verbose=False
        )[0]
    return food_result, spoon_result


def collect_food_detections(result):
    """แต่ละเมนูเก็บกรอบที่มั่นใจสูงสุดหนึ่งกรอบ เพื่อไม่บวกพื้นที่ซ้ำ"""
    areas = {}
    confidences = {}
    for box in result.boxes:
        name = result.names[int(box.cls[0])]
        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
        area = float((x2 - x1) * (y2 - y1))
        confidence = float(box.conf[0])
        if area > 0 and confidence > confidences.get(name, -1):
            areas[name] = area
            confidences[name] = confidence
    return areas, confidences


def build_portion(menu_name, food_area, spoon_area):
    """เทียบพื้นที่อาหารกับหัวช้อน ยังไม่ใช่น้ำหนักจริงเป็นกรัม"""
    relative_area = food_area / spoon_area if spoon_area > 0 else None
    return {'className': menu_name, 'area': food_area, 'relativeArea': relative_area}


def build_menu_candidates(areas, confidences, spoon_area):
    """ส่งสามเมนูที่เป็นไปได้ พร้อมค่าโภชนาการอ้างอิงให้ผู้ใช้เลือก"""
    top_names = sorted(confidences, key=confidences.get, reverse=True)[:3]
    candidates = []
    for name in top_names:
        candidate = load_menu_reference(name)
        candidate.update(
            confidence=confidences[name],
            portions=[build_portion(name, areas[name], spoon_area)],
            comparisonReady=spoon_area > 0,
            scaleReference=SCALE_REFERENCE,
        )
        candidates.append(candidate)
    return candidates


def build_detected_foods(confidences):
    """รายการอาหารในภาพ แยกจากสามตัวเลือกของเมนูหลัก และไม่รวมสารอาหารซ้ำ"""
    foods = []
    for name in sorted(confidences, key=confidences.get, reverse=True):
        confidence = confidences[name]
        if confidence < DETECTED_FOOD_CONFIDENCE:
            continue
        reference = load_menu_reference(name)
        foods.append({
            'className': name,
            'label': reference['menu'],
            'confidence': confidence,
        })
    return foods


def build_after_match_candidates(original_menu, areas, confidences, spoon_area):
    """ให้ผู้ใช้ยืนยันพื้นที่อาหารเดิม เมื่อโมเดลเรียกชื่อหลังกินผิด"""
    candidates = []
    for detected_name in sorted(confidences, key=confidences.get, reverse=True)[:3]:
        candidates.append({
            'menu': original_menu,
            'referenceClass': original_menu,
            'detectedMenu': load_menu_label(detected_name),
            'confidence': confidences[detected_name],
            'nutrition': {},
            'nutritionBasis': 'area-only',
            'portions': [build_portion(original_menu, areas[detected_name], spoon_area)],
            'comparisonReady': spoon_area > 0,
            'scaleReference': SCALE_REFERENCE,
        })
    return candidates


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
        return jsonify(status='success', service='food-analysis', database='connected', analysisVersion=4, spoonModel='yolo11s-seg-coco-bowl')
    except mysql.connector.Error:
        return jsonify(status='error', service='food-analysis', message='เซิร์ฟเวอร์เปิดอยู่ แต่เชื่อมต่อฐานข้อมูลอาหารไม่ได้'), 503
    finally:
        if conn is not None:
            conn.close()


@app.post('/api/analyze')
def analyze_food():
    if 'image' not in request.files:
        return jsonify(status='error', message='ไม่พบรูปภาพ'), 400
    # 1. ตรวจภาพและประเภทการวิเคราะห์
    img = decode_food_image(request.files['image'].read())
    if img is None:
        return jsonify(status='error', message='อ่านรูปภาพไม่ได้ กรุณาถ่ายใหม่'), 400
    mode = request.form.get('mode', 'before')
    if mode not in ('before', 'after'):
        return jsonify(status='error', message='รูปแบบการวิเคราะห์ไม่ถูกต้อง'), 400
    try:
        # 2. ตรวจอาหารและช้อน แล้วรวบรวมผลของแต่ละเมนู
        results_food, results_spoon = detect_food_and_spoon(img, mode)
        detected_pixels, confidences = collect_food_detections(results_food)
        if not detected_pixels or (mode == 'before' and max(confidences.values()) < 0.25):
            if mode == 'after' and not detected_pixels:
                return jsonify(status='success', menu=request.form.get('menu_class') or 'อาหารหลังกิน', nutrition={}, nutritionBasis='area-only', emptyCandidate=True, comparisonReady=False)
            return jsonify(status='empty', message='ยังจับเมนูไม่ได้ ลองถ่ายอาหารจริงจากด้านบน ให้จานอยู่กลางภาพ แสงสว่าง และถือกล้องนิ่ง หากกินหมดแล้วให้เลือกปรับเองเป็นเหลือ 0%')
        # 3. แยกหัวช้อนสำหรับเทียบขนาด และเลือกเมนูที่ต้องวัด
        spoon_pixels, spoon_width_px = measure_spoon_bowl(results_spoon, img.shape)
        name = request.form.get('menu_class') if mode == 'after' else max(confidences, key=confidences.get)
        if not name or name not in detected_pixels:
            if mode == 'after' and name in results_food.names.values():
                # ยังไม่คำนวณเปอร์เซ็นต์ จนผู้ใช้ยืนยันว่าเป็นพื้นที่อาหารเดิม
                return jsonify(
                    status='success', menu=name, referenceClass=name,
                    nutrition={}, nutritionBasis='area-only', needsMenuConfirmation=True,
                    candidates=build_after_match_candidates(name, detected_pixels, confidences, spoon_pixels),
                )
            return jsonify(status='empty', message='ยังตรวจพื้นที่ของเมนูก่อนกินในภาพนี้ไม่ได้ กรุณาถ่ายใหม่หรือเลือกปรับเปอร์เซ็นต์เอง')
        # 4. ก่อนกินใช้สารอาหารต่อหนึ่งจาน หลังกินส่งเฉพาะพื้นที่
        if mode == 'after':
            # After photos only measure area. Never look up or replace baseline nutrition.
            result = {'menu': name, 'referenceClass': name, 'nutritionBasis': 'area-only', 'nutrition': {}}
        else:
            result = load_menu_reference(name)
            result['candidates'] = build_menu_candidates(detected_pixels, confidences, spoon_pixels)
            result['detectedFoods'] = build_detected_foods(confidences)
        result.update(status='success',
                      portions=[build_portion(name, detected_pixels[name], spoon_pixels)],
                      comparisonReady=spoon_pixels > 0,
                      scaleReference=SCALE_REFERENCE,
                      spoonBowlAreaPx=spoon_pixels, spoonBowlWidthPx=spoon_width_px,
                      areaMethod='detection-box',
                      missing_nutrients=[key for key, value in result['nutrition'].items() if value is None])
        return jsonify(**result)
    except Exception:
        app.logger.exception('Food analysis failed')
        return jsonify(status='error', message='วิเคราะห์ภาพไม่สำเร็จ กรุณาตรวจสอบโมเดลและข้อมูลบนเซิร์ฟเวอร์'), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', '5000')), debug=False)
