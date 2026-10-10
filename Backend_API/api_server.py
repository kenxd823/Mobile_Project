import os
import cv2
import mysql.connector
from flask import Flask, request, jsonify
from ultralytics import YOLO

app = Flask(__name__)

DB_CONFIG = {
    "host": "localhost",
    "user": "root",
    "password": "",
    "database": "ncd_database",
}

print("กำลังโหลดโมเดล YOLO...")
model_food = YOLO("best.pt")
model_spoon = YOLO("best (10)spoon.pt")
print("โหลดโมเดลสำเร็จ!")

@app.route('/api/analyze', methods=['POST'])
def analyze_food():
    if 'image' not in request.files:
        return jsonify({"status": "error", "message": "ไม่พบรูปภาพ"}), 400

    file = request.files['image']
    image_path = "temp_img.jpg"
    file.save(image_path)

    try:
       # 💡 [ชุดใหม่] ย่อรูปภาพโดยรักษาสัดส่วนเดิมไว้ (ภาพไม่เบี้ยว)
        img = cv2.imread(image_path)
        h, w, _ = img.shape
        new_w = 800  # ล็อกความกว้างไว้ที่ 800
        new_h = int((new_w / w) * h) # คำนวณความสูงให้สมดุลอัตโนมัติ
        img = cv2.resize(img, (new_w, new_h))
        cv2.imwrite(image_path, img)

        results_food = model_food(image_path, conf=0.25)[0]
        results_spoon = model_spoon(image_path, conf=0.25)[0]

        detected_pixels = {}
        spoon_pixels = 0
        
        # 1. ตรวจจับอาหาร
        names = results_food.names
        if len(results_food.boxes) > 0:
            for box in results_food.boxes:
                class_name = names[int(box.cls[0])]
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                # แปลงค่าให้เป็นตัวเลขธรรมดากันแอปมือถือ Error
                area = float((x2 - x1) * (y2 - y1)) 
                if area > 0:
                    detected_pixels[class_name] = detected_pixels.get(class_name, 0) + area

        # 2. ตรวจจับช้อน
        if len(results_spoon.boxes) > 0:
            for box in results_spoon.boxes:
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                spoon_pixels += float((x2 - x1) * (y2 - y1))

        if not detected_pixels:
            os.remove(image_path)
            return jsonify({"status": "empty", "message": "ไม่พบอาหาร หรือทานหมดเกลี้ยง 100%"})

        # 3. ดึงข้อมูลจาก MySQL
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor(dictionary=True)
        
        total_kcal, total_protein, total_carb = 0.0, 0.0, 0.0
        scale_ratio = 1.0
        
        if spoon_pixels > 0:
            cursor.execute("SELECT pixel_per_gram FROM test_nutrition_data WHERE class_name = 'spoon_head' LIMIT 1")
            spoon_db = cursor.fetchone()
            if spoon_db and float(spoon_db['pixel_per_gram']) > 0:
                scale_ratio = float(spoon_db['pixel_per_gram']) / float(spoon_pixels)

        menu_names = []
        for class_name, pixels in detected_pixels.items():
            cursor.execute("SELECT * FROM test_nutrition_data WHERE class_name = %s", (class_name,))
            db_data = cursor.fetchone()
            
            if db_data and float(db_data['pixel_per_gram']) > 0:
                adjusted_pixels = float(pixels) * scale_ratio
                weight_g = adjusted_pixels / float(db_data['pixel_per_gram'])
                
                total_kcal += weight_g * float(db_data['kcal_per_gram'])
                total_protein += weight_g * float(db_data['protein_per_gram'])
                total_carb += weight_g * float(db_data['carb_per_gram'])
                menu_names.append(db_data['name_th'])

        cursor.close()
        conn.close()
        os.remove(image_path)
        
        if not menu_names:
            detected_names_str = ", ".join(detected_pixels.keys())
            return jsonify({
                "status": "empty", 
                "message": f"AI ตรวจเจอ: '{detected_names_str}'\nแต่ไม่มีในฐานข้อมูล"
            })

        # ส่งข้อมูลกลับไปที่แอป (ใช้ int และ float คลุมตัวเลขทั้งหมด)
        return jsonify({
            "status": "success",
            "menu": ", ".join(set(menu_names)),
            "nutrition": {
                "calories": int(round(total_kcal, 0)),
                "protein": float(round(total_protein, 1)),
                "carbs": float(round(total_carb, 1))
            }
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        if os.path.exists(image_path):
            os.remove(image_path)
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)