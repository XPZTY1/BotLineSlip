# 💰 ManageMoney LINE Bot

**ManageMoney** คือ LINE Official Account Bot สำหรับบันทึกและบริหารจัดการรายรับ-รายจ่ายส่วนบุคคล อัจฉริยะด้วย **Gemini AI + Supabase (PostgreSQL)** ช่วยให้การจดบันทึกการเงินเป็นเรื่องง่าย พิมพ์ภาษาไทยธรรมชาติ อ่านสลิปโอนเงินอัตโนมัติ วิเคราะห์งบประมาณ พร้อมมีผู้ช่วย AI Coach คอยดูแลสุขภาพทางการเงินของคุณ

---

## 🌟 ฟีเจอร์ทั้งหมดในระบบ (All Features)

### 1. 🤖 บันทึกรายรับ-รายจ่ายด้วยภาษาไทยธรรมชาติ (Natural Language Tracking)
- พิมพ์ภาษาไทยได้ตามธรรมชาติ บอทสกัดข้อมูลจำนวนเงิน, ชื่อรายการ, วันที่ และหมวดหมู่อัตโนมัติด้วย Gemini AI
- **ตัวอย่าง**:
  - `กินข้าวมันไก่ 80`
  - `เงินเดือน 35000`
  - `เมื่อวานค่าน้ำ 350`
  - `ค่าแท็กซี่ 150 #ทริปทำงาน`
- **ระบบตัดสินใจอัจฉริยะ**: หากข้อมูลชัดเจนระบบจะบันทึกทันที หากกำกวมจะแสดงปุ่ม Quick Reply ยืนยันก่อนบันทึก

### 2. 🧾 อ่านสลิปโอนเงินอัจฉริยะ (Advanced Gemini Vision OCR)
- เพียงส่งรูปภาพสลิปโอนเงิน/ใบเสร็จเข้าห้องแชท
- AI อ่านยอดเงิน, วันที่, ประเภท (เงินเข้า/เงินออก), ชื่อธนาคารผู้ให้บริการ และข้อความบันทึกช่วยจำ/ชื่อผู้รับโอน
- **จัดหมวดให้อัตโนมัติ**: เช่น โอนเข้าบัญชีออมสิน/ลงทุน -> จัดเข้าหมวด `เงินออม`
- หากในสลิปไม่มีหมายเหตุ บอทจะถามสั้นๆ ว่า *"รายการนี้ทำอะไรครับ"* เพื่อเติมชื่อรายการให้สมบูรณ์

### 3. 📊 ระบบงบประมาณประจำเดือนและการแจ้งเตือน (Monthly Budget & Alert)
- กำหนดงบประมาณค่าใช้จ่ายรวมประจำเดือน
- **คำสั่ง**: `ตั้งงบ 15000` หรือ `ดูงบ`
- **ระบบเตือนภัยอัตโนมัติ**: ทุกครั้งที่บันทึกรายจ่าย หากยอดรวมทะลุ **80%** หรือ **100%** ของงบประมาณ บอทจะส่งข้อความเตือนภัยทันที

### 4. 🧠 AI Financial Coach (ผู้ช่วยวิเคราะห์พฤติกรรมการเงิน)
- ประมวลผลพฤติกรรมการใช้จ่ายในเดือนปัจจุบันด้วย Gemini AI
- **คำสั่ง**: `วิเคราะห์พฤติกรรม` หรือ `โค้ชการเงิน`
- แสดงผลในรูปแบบ Flex Card สวยงาม ประกอบด้วย:
  - พาดหัวสรุปสุขภาพการเงิน
  - Insight วิเคราะห์พฤติกรรมใช้จ่ายเด่นชัด (เช่น หมวดอาหารสูงเกินไป)
  - เคล็ดลับการประหยัดเงิน 1 ข้อที่ทำได้จริงทันที
  - คำคมให้กำลังใจในการออมเงิน

### 5. 🔔 ระบบแจ้งเตือนอัตโนมัติ (Daily & Weekly Notification Scheduler)
- **สรุปยามเย็นประจำวัน (20:00 น.)**: ส่งข้อความสรุปยอดใช้จ่ายของวันนั้น พร้อมสถิติจำนวนรายการ
- **สรุปประจำสัปดาห์ (วันอาทิตย์ 19:00 น.)**: ส่ง Flex Summary การใช้จ่ายย้อนหลัง 7 วัน
- ทำงานผ่านระบบ Cron Job ในตัว

### 6. 🏷️ ระบบแฮชแท็กและแยกหมวดเฉพาะอีเวนต์ (`#Hashtag`)
- ติดแฮชแท็กท้ายรายการ เช่น `ค่าอาหาร 250 #ทริปพัทยา`
- **คำสั่งค้นหา**: `สรุป #ทริปพัทยา` หรือ `#ทริปพัทยา` เพื่อดูยอดรวมรายรับ-รายจ่ายเฉพาะทริป/โครงการนั้นๆ

### 7. 🎯 ระบบเป้าหมายการออมเงิน (Savings Goals)
- กำหนดเป้าหมายออมเงินตามระยะเวลาที่ต้องการ
- **คำสั่ง**:
  - `ออมเงินซื้อไอแพด 30000 บาท ภายใน 10 เดือน` (สร้างเป้าหมาย)
  - `ดูเป้าหมาย` (ดูความคืบหน้าการออม)
  - `ยกเลิกเป้าหมาย` (ยกเลิกเป้าหมายที่เลือก)
- เมื่อบันทึกรายการในหมวด `เงินออม` บอทจะขึ้น Quick Reply ให้เลือกว่าต้องการหยอดกระปุกเข้าเป้าหมายไหน

### 8. 📈 การสรุปผลและเปรียบเทียบเชิงลึก (Summaries & Comparison)
- **สรุปตามช่วงเวลา**: `สรุปวันนี้`, `สรุปเมื่อวาน`, `สรุปสัปดาห์นี้`, `สรุปเดือนนี้`, `สรุปเดือนที่แล้ว`
- **เปรียบเทียบเดือนนี้ vs เดือนก่อน**: พิมพ์ `เปรียบเทียบ` บอทจะคำนวณ Fair Comparison เทียบยอดถึงวันที่เท่ากันของทั้งสองเดือน

### 9. 🗑️ ระบบลบรายการล่าสุด (Delete Last Transaction)
- พิมพ์คำสั่ง `ลบรายการล่าสุด` หรือ `ยกเลิกรายการล่าสุด`
- หรือกดปุ่ม **"🗑️ ลบรายการนี้"** จากใต้กล่อง Flex Card ยืนยันการบันทึกได้ทันที

### 10. 📄 ส่งออกรายงาน PDF & 📤 ไฟล์ CSV/Excel
- **ออกรายงาน PDF**: พิมพ์ `ขอ PDF` หรือ `PDF เดือนนี้` บอทจะเจนไฟล์ PDF รายงานการเงินดีไซน์สวยงามผ่าน Puppeteer และส่งลิงก์ดาวน์โหลดจาก Supabase Storage
- **ส่งออกไฟล์ CSV/Excel**: พิมพ์ `ขอ CSV` หรือ `ดาวน์โหลด CSV` เพื่อรับลิงก์ดาวน์โหลดไฟล์ `.csv` ที่มี **UTF-8 BOM** สามารถเปิดใน Microsoft Excel ภาษาไทยได้ทันทีอักขระไม่เพี้ยน

### 11. 🌐 หน้าเว็บ Dashboard (Web View)
- กดปุ่ม "ดูรายการทั้งหมด" บอทจะส่งลิงก์หน้าเว็บ HTML Responsive ให้เปิดดูประวัติรายการและแถบเป้าหมายการออมผ่าน LINE In-App Browser ได้ทันที

---

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)

* **Backend Environment**: Node.js (Express.js)
* **LINE Bot Integration**: `@line/bot-sdk` (Messaging API & Webhook Validation)
* **Artificial Intelligence**: `@google/genai` (Gemini 2.0 Flash / Gemini 3.1 Flash-Lite)
* **Database**: Supabase PostgreSQL (`@supabase/supabase-js`)
* **PDF Generator**: Puppeteer (Chromium Headless)
* **Automation Scheduler**: `node-cron`
* **Styling & Web Dashboard**: HTML5, Vanilla CSS, Flex Message JSON

---

## 📁 โครงสร้างโปรเจกต์ (Project Structure)

```text
BotLineSlip/
├── .env                       # Environment Variables Config
├── .gitignore                 # Git Ignore File
├── .npmrc                     # Local npm config
├── package.json               # Node.js Dependencies
├── README.md                  # คู่มือการใช้งานและรายละเอียดโปรเจกต์
└── src/
    ├── index.js               # Entry Point (Server Start & Scheduler Init)
    ├── app.js                 # Express Application & Routes Configuration
    ├── config.js              # Environment Validation & App Settings
    ├── constants/
    │   ├── categories.js      # รายชื่อหมวดหมู่และการจำแนกด้วย Keyword
    │   └── prompts.js         # System Prompts สำหรับ Gemini AI
    ├── handlers/
    │   └── messageHandler.js  # Main Intent Handler & Event Router
    ├── messages/
    │   ├── index.js           # Central Message Export
    │   ├── textReplies.js     # Text Templates & Intent Matchers
    │   ├── flexTransaction.js # Flex Card ยืนยันการบันทึกรายการ
    │   ├── flexSummary.js     # Flex Card สรุปรายรับรายจ่าย
    │   ├── flexComparison.js  # Flex Card เปรียบเทียบสองเดือน
    │   ├── flexGoal.js        # Flex Card เป้าหมายการออม
    │   ├── flexBudget.js      # Flex Card ความคืบหน้างบประมาณ
    │   └── flexCoach.js       # Flex Card AI Financial Coach
    ├── services/
    │   ├── supabaseClient.js  # Centralized Supabase Client Singleton
    │   ├── transactionService.js # CRUD Operations ธุรกรรม & ลบรายการ
    │   ├── goalService.js     # CRUD Operations เป้าหมายการออม
    │   ├── budgetService.js   # บริหารจัดการและตรวจสอบงบประมาณ
    │   ├── coachService.js    # AI Financial Coach Engine
    │   ├── geminiService.js   # Gemini AI Parse & Vision OCR
    │   ├── lineService.js     # LINE Messaging API Client
    │   ├── pdfService.js      # Puppeteer PDF Generator & Storage Upload
    │   └── notificationService.js # Cron Job สรุปรายวัน/สัปดาห์
    ├── utils/
    │   ├── dateParser.js      # Utility แปลงวันที่ภาษาไทย
    │   ├── moneyParser.js     # Utility สกัดตัวเลขจำนวนเงิน
    │   ├── transactionRules.js# กฎตัดสินใจ Confidence / Auto-save
    │   ├── tagParser.js       # Utility สกัด #Hashtag
    │   └── csvHelper.js       # Utility สร้างไฟล์ CSV UTF-8 BOM
    └── web/
        ├── transactionsPage.js# Render หน้าเว็บประวัติรายการทั้งหมด
        └── pdfTemplate.js     # Render หน้า HTML สำหรับแปลงเป็น PDF
```

---

## ⚙️ การตั้งค่า Environment Variables (`.env`)

สร้างไฟล์ `.env` ที่โฟลเดอร์หลักของโปรเจกต์ และระบุค่าดังนี้:

```env
# LINE Messaging API
LINE_CHANNEL_ACCESS_TOKEN="YOUR_LINE_CHANNEL_ACCESS_TOKEN"
LINE_CHANNEL_SECRET="YOUR_LINE_CHANNEL_SECRET"

# Google Gemini AI
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
GEMINI_MODEL="gemini-2.0-flash"

# Supabase PostgreSQL
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"

# Application Config
PORT=3000
APP_BASE_URL="https://your-domain.onrender.com"
```

---

## 🚀 วิธีการติดตั้งและรันโปรเจกต์ (Installation & Usage)

### 1. ติดตั้ง Dependencies
```bash
npm install
```

### 2. รันโปรเจกต์ในโหมด Development
```bash
npm run dev
```

### 3. รันโปรเจกต์ในโหมด Production
```bash
npm start
```

---

## 📖 คู่มือคำสั่งใช้งานผ่าน LINE (Commands Cheatsheet)

| คำสั่งที่พิมพ์ | ผลลัพธ์ / ความหมาย |
|---|---|
| `กินข้าวมันไก่ 80` | บันทึกรายจ่าย 80 บาท หมวดอาหาร |
| `เงินเดือน 35000` | บันทึกรายรับ 35,000 บาท หมวดเงินเดือน |
| `เมื่อวานค่าน้ำ 300` | บันทึกรายจ่ายค่าน้ำของเมื่อวาน 300 บาท |
| `ค่าอาหาร 150 #ทริปหัวหิน` | บันทึกรายจ่ายพร้อมติดแท็ก `#ทริปหัวหิน` |
| `ส่งรูปสลิปโอนเงิน` | อ่านสลิปอัตโนมัติและบันทึกรายการทันที |
| `ตั้งงบ 15000` | กำหนดงบประมาณค่าใช้จ่ายประจำเดือน |
| `ดูงบ` / `งบประมาณ` | แสดง Flex Card ความคืบหน้าการใช้เงินเทียบกับงบ |
| `วิเคราะห์พฤติกรรม` / `โค้ชการเงิน` | สรุป Insight การเงินและคำแนะนำประหยัดเงินจาก AI |
| `สรุป` / `สรุปเดือนนี้` | แสดง Flex Card สรุปรายรับ-รายจ่ายเดือนนี้ |
| `สรุปวันนี้` / `สรุปสัปดาห์นี้` | แสดง สรุปรายรับ-รายจ่ายตามช่วงเวลาที่ระบุ |
| `เปรียบเทียบ` | เปรียบเทียบรายรับ-รายจ่ายเดือนนี้กับเดือนก่อนหน้า |
| `ออมเงินซื้อโทรศัพท์ 20000 บาท ภายใน 6 เดือน` | ตั้งเป้าหมายออมเงินใหม่ |
| `ดูเป้าหมาย` | แสดงความคืบหน้าเป้าหมายออมเงินทั้งหมด |
| `ลบรายการล่าสุด` | ลบบันทึกรายการล่าสุดที่เพิ่งทำรายการไป |
| `สรุป #ทริปหัวหิน` / `#ทริปหัวหิน` | สรุปยอดเงินเฉพาะแท็กที่ระบุ |
| `ขอ PDF` / `PDF เดือนนี้` | ส่งลิงก์ดาวน์โหลดรายงาน PDF |
| `ขอ CSV` / `โหลด CSV` | ส่งลิงก์ดาวน์โหลดไฟล์ CSV/Excel |
| `รายการทั้งหมด` / `ดูประวัติ` | ส่งลิงก์เปิดหน้า Dashboard รวมประวัติย้อนหลัง |
| `ช่วยเหลือ` / `วิธีใช้งาน` | แสดงคู่มือคำสั่งสั้นๆ |

---

## 📜 License

MIT License © ManageMoney LINE Bot Team
