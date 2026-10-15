# Finance AI — Standalone

เวอร์ชันนี้แยกเฉพาะระบบ **Finance AI** ออกจาก LifeOS แล้ว

มีเพียง:

```text
index.html
style.css
script.js
```

ไม่ต้องใช้ React / Vite / npm

## เปิดใช้งาน

ใน VS Code:

1. เปิดโฟลเดอร์ `FinanceAI_Standalone`
2. คลิกขวา `index.html`
3. เลือก **Open with Live Server**

## ระบบที่ยังอยู่

- Initial Balance
- Available Balance
- Auto Budget Deduction
- Quick Expense
- Category
- Thai Voice Expense Input
- Drag & Drop Receipt
- Paste Image (Ctrl+V)
- Receipt / Food Photo Scanner
- Gemini Vision (Optional)
- Demo AI ถ้าไม่มี API Key
- Editable Item + Price
- Auto Total
- Confirm & Deduct
- Receipt Thumbnail
- Expandable Sub-items
- Delete Transaction + Refund Balance
- Live Camera Scanner
- Reset Demo Data
- localStorage

## AI Scanner & อ่านรูปภาพสินค้า / ใบเสร็จ

ระบบรองรับการใช้ **Gemini Vision AI** เพื่อ:
1. **อ่านรูปภาพสิ่งของ/สินค้าที่ถืออยู่หน้ากล้อง** (เช่น กระดาษทิชชู่, ขนม, ขวดน้ำ, ของใช้ส่วนตัว, ยา)
2. **อ่านตัวหนังสือ/โลโก้บนบรรจุภัณฑ์** เช่น คำว่า "เช็ดหน้า", ยี่ห้อ, ขนาด
3. **ค้นหาและประเมินราคาตลาดจริงในประเทศไทย (฿)** ตามราคาร้านสะดวกซื้อ 7-Eleven, ซูเปอร์มาร์เก็ต
4. **ระบุหมวดหมู่อัตโนมัติ** เช่น Shopping (ของใช้), Food (อาหาร/เครื่องดื่ม), Health (สุขภาพ/ยา)
5. **AI Search & Hints**: พิมพ์คำช่วยค้นหา เช่น "ทิชชู่ 1 ห่อ", "ซื้อจาก 7-11" เพื่อให้ AI ค้นหาราคาได้ละเอียดยิ่งขึ้น

### การเปิดใช้งาน AI จริง (รับฟรี)

1. เข้าไปสร้าง API Key ฟรีได้ที่ [Google AI Studio](https://aistudio.google.com/app/apikey)
2. นำ Key มาวางในหน้าต่างสแกนเนอร์โดยตรง หรือกดปุ่ม **AI Settings** ด้านขวาบน
3. ระบบตรวจหาโมเดลที่ใช้งานได้อัตโนมัติผ่าน `ModelService.ListModels` (รองรับโมเดลตระกูล Flash เช่น `gemini-3.8-flash`, `gemini-2.5-flash`, `gemini-2.0-flash`)

*หากยังไม่ได้ใส่ Key ระบบจะทำงานในโหมด Demo AI พร้อมแถบแจ้งเตือนและกล่องใส่ Key ทันที*

## แก้หน้าตา

แก้:

```text
style.css
```

สีหลักอยู่ด้านบนไฟล์ใน `:root`

## แก้ระบบ

แก้:

```text
script.js
```

ตัวแปรหลัก:

```js
const STORAGE_KEY = "finance_ai_transactions";
const INITIAL_BALANCE_KEY = "finance_ai_initial_balance";
```

## ล้างข้อมูลทั้งหมดเอง

เปิด Browser DevTools > Application > Local Storage

ลบ:

```text
finance_ai_transactions
finance_ai_initial_balance
finance_ai_gemini_api_key
```
