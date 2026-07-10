"""
สคริปต์ทดสอบง่ายๆ: อ่านรูปสลิปโอนเงินจากไฟล์ในเครื่อง แล้วให้ Gemini วิเคราะห์
รันในเครื่องตัวเองผ่าน VS Code ได้เลย ไม่ต้องมี LINE / เว็บเซิร์ฟเวอร์

วิธีใช้:
    python read_slip.py path/to/slip.jpg
"""

import sys
import json
from google import genai
from google.genai import types

# ใส่ API key ตรงนี้ตรงๆ ก่อนก็ได้ (ทดสอบง่ายๆ)
# หรือจะ export GEMINI_API_KEY=... ในเทอร์มินัลแล้วอ่านจาก os.environ ก็ได้ทีหลัง
GEMINI_API_KEY = "AQ.Ab8RN6Jc0isz1q5lXq9_pP68G3R5-ATdxRZEe9KYjB9FIH0aSg"

GEMINI_MODEL = "gemini-3.5-flash"

SLIP_PROMPT = """
คุณเป็นผู้ช่วยอ่านสลิปโอนเงินจากธนาคารไทย จากรูปภาพที่ให้มา
จงวิเคราะห์และตอบกลับเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอกเหนือจาก JSON
โครงสร้าง JSON ที่ต้องการ:
{
  "is_slip": true/false,
  "bank": "ชื่อธนาคารผู้โอน หรือ null",
  "date": "วันที่ทำรายการ รูปแบบ YYYY-MM-DD หรือ null",
  "time": "เวลาทำรายการ รูปแบบ HH:MM หรือ null",
  "amount": ตัวเลขจำนวนเงิน (number) หรือ null,
  "sender_name": "ชื่อผู้โอน หรือ null",
  "receiver_name": "ชื่อผู้รับโอน หรือ null",
  "receiver_bank": "ธนาคารปลายทาง หรือ null",
  "ref_no": "เลขที่อ้างอิงรายการ หรือ null"
}
ตอบเป็น JSON object เดียว ไม่ต้องมี markdown code block
"""


def guess_mime_type(path: str) -> str:
    lower = path.lower()
    if lower.endswith(".png"):
        return "image/png"
    if lower.endswith(".webp"):
        return "image/webp"
    return "image/jpeg"


def read_slip(image_path: str) -> dict:
    with open(image_path, "rb") as f:
        image_bytes = f.read()

    client = genai.Client(api_key=GEMINI_API_KEY)

    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=[
            SLIP_PROMPT,
            types.Part.from_bytes(
                data=image_bytes, mime_type=guess_mime_type(image_path)
            ),
        ],
        config=types.GenerateContentConfig(response_mime_type="application/json"),
    )

    return json.loads(response.text)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("วิธีใช้: python read_slip.py path/to/slip.jpg")
        sys.exit(1)

    image_path = sys.argv[1]
    result = read_slip(image_path)
    print(json.dumps(result, ensure_ascii=False, indent=2))