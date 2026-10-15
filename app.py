"""
=========================================================
FINANCE AI — FASTAPI BACKEND SERVER WITH MYSQL
=========================================================
Endpoints:
- GET    /api/transactions      : ดึงข้อมูลรายการใช้จ่ายทั้งหมด
- POST   /api/transactions      : เพิ่มรายการใหม่
- PUT    /api/transactions/{id} : แก้ไขรายการ
- DELETE /api/transactions/{id} : ลบรายการ
- POST   /api/transactions/bulk : อัปเดตข้อมูลแบบกลุ่ม (Bulk Sync)
- GET    /api/forecast          : ระบบพยากรณ์รายจ่ายล่วงหน้า (Predictive Budgeting)
- GET    /api/health            : ตรวจสอบสถานะการเชื่อมต่อ Database
"""

import os
import time
import json
import calendar
from datetime import datetime
from typing import List, Optional, Any, Dict
from contextlib import contextmanager

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import pymysql
from pymysql.cursors import DictCursor

# Load environment configuration with defaults
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "finance_db")

app = FastAPI(
    title="Finance AI API",
    description="Backend API for Finance AI with MySQL Database",
    version="1.0.0"
)

# Enable CORS for frontend integration (file://, localhost, custom ports)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# DATABASE CONNECTION & TABLE INITIALIZATION
# =========================================================

@contextmanager
def get_db_connection():
    """Provides a transactional database connection context."""
    conn = pymysql.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        charset="utf8mb4",
        cursorclass=DictCursor,
        autocommit=True
    )
    try:
        yield conn
    finally:
        conn.close()


def init_database_tables():
    """Ensure database and transactions table exist on startup."""
    try:
        # First connect without specifying database to create database if not exists
        root_conn = pymysql.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            charset="utf8mb4"
        )
        with root_conn.cursor() as cur:
            cur.execute(
                f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}` "
                f"CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
            )
        root_conn.close()

        # Connect to target database and create table
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS transactions (
                        id BIGINT PRIMARY KEY,
                        merchant VARCHAR(255) NOT NULL,
                        category VARCHAR(100) NOT NULL DEFAULT 'General',
                        total DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                        date VARCHAR(100) NOT NULL,
                        image LONGTEXT NULL,
                        items JSON NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        INDEX idx_category (category),
                        INDEX idx_created (created_at)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
                """)
        print("[Database] MySQL initialized successfully.")
    except Exception as exc:
        print(f"[Database Warning] Could not auto-initialize MySQL ({exc}). "
              "Please verify MySQL server is running and credentials are correct.")


@app.on_event("startup")
def on_startup():
    init_database_tables()


# =========================================================
# PYDANTIC DATA MODELS
# =========================================================

class ItemModel(BaseModel):
    name: str = Field(..., description="ชื่อรายการสินค้า")
    price: float = Field(..., description="ราคาสินค้า (บาท)")


class TransactionBase(BaseModel):
    merchant: str = Field(..., description="ชื่อร้านค้าหรือผู้รับเงิน")
    category: Optional[str] = Field("General", description="หมวดหมู่ค่าใช้จ่าย")
    total: float = Field(..., description="ยอดเงินรวม (บาท)")
    date: Optional[str] = Field(None, description="วันเวลาที่บันทึก เช่น 'Today · 00:39'")
    image: Optional[str] = Field("", description="URL หรือ Base64 ของรูปสลิป/ใบเสร็จ")
    items: Optional[List[ItemModel]] = Field(default_factory=list, description="รายการย่อย")


class TransactionCreate(TransactionBase):
    id: Optional[int] = Field(None, description="รหัสรายการ หากไม่ระบุจะสร้างจาก Timestamp ปัจจุบัน")


class TransactionUpdate(BaseModel):
    merchant: Optional[str] = None
    category: Optional[str] = None
    total: Optional[float] = None
    date: Optional[str] = None
    image: Optional[str] = None
    items: Optional[List[ItemModel]] = None


# =========================================================
# HELPER FUNCTIONS
# =========================================================

def parse_db_transaction(row: Dict[str, Any]) -> Dict[str, Any]:
    """Format MySQL row into standard frontend Transaction structure."""
    if not row:
        return {}

    items = row.get("items")
    if isinstance(items, str):
        try:
            items = json.loads(items)
        except Exception:
            items = []
    elif items is None:
        items = []

    return {
        "id": int(row["id"]),
        "merchant": row.get("merchant", ""),
        "category": row.get("category", "General"),
        "total": float(row.get("total", 0.0)),
        "date": row.get("date", ""),
        "image": row.get("image") or "",
        "items": items
    }


# =========================================================
# API ENDPOINTS
# =========================================================

@app.get("/api/health")
def health_check():
    """Verify backend and database connection status."""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1 AS ok;")
                cur.fetchone()
        return {"status": "ok", "database": "connected", "database_name": DB_NAME}
    except Exception as exc:
        return {"status": "degraded", "database": "disconnected", "error": str(exc)}


@app.get("/api/transactions", response_model=List[Dict[str, Any]])
def get_all_transactions():
    """
    ดึงข้อมูลรายการใช้จ่ายทั้งหมดจากฐานข้อมูล MySQL
    เรียงลำดับจากรายการล่าสุดไปเก่าสุด
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id, merchant, category, total, date, image, items
                    FROM transactions
                    ORDER BY id DESC;
                """)
                rows = cur.fetchall()
        return [parse_db_transaction(r) for r in rows]
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database query failed: {str(exc)}"
        )


@app.post("/api/transactions", status_code=status.HTTP_201_CREATED)
def create_transaction(payload: TransactionCreate):
    """
    เพิ่มรายการใช้จ่ายใหม่ลงในฐานข้อมูล MySQL
    """
    tx_id = payload.id if payload.id is not None else int(time.time() * 1000)
    tx_date = payload.date if payload.date else time.strftime("Today · %H:%M")
    items_json = json.dumps([item.dict() for item in payload.items], ensure_ascii=False)

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO transactions (id, merchant, category, total, date, image, items)
                    VALUES (%s, %s, %s, %s, %s, %s, %s);
                """, (
                    tx_id,
                    payload.merchant,
                    payload.category or "General",
                    payload.total,
                    tx_date,
                    payload.image or "",
                    items_json
                ))

        return {
            "id": tx_id,
            "merchant": payload.merchant,
            "category": payload.category or "General",
            "total": payload.total,
            "date": tx_date,
            "image": payload.image or "",
            "items": [item.dict() for item in payload.items]
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create transaction: {str(exc)}"
        )


@app.put("/api/transactions/{tx_id}")
def update_transaction(tx_id: int, payload: TransactionUpdate):
    """
    แก้ไขข้อมูลรายการใช้จ่ายตาม ID ที่ระบุ
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM transactions WHERE id = %s;", (tx_id,))
                existing = cur.fetchone()

                if not existing:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Transaction {tx_id} not found"
                    )

                merchant = payload.merchant if payload.merchant is not None else existing["merchant"]
                category = payload.category if payload.category is not None else existing["category"]
                total = payload.total if payload.total is not None else float(existing["total"])
                date_val = payload.date if payload.date is not None else existing["date"]
                image_val = payload.image if payload.image is not None else (existing["image"] or "")

                if payload.items is not None:
                    items_json = json.dumps([item.dict() for item in payload.items], ensure_ascii=False)
                else:
                    items_json = existing["items"]
                    if not isinstance(items_json, str):
                        items_json = json.dumps(items_json, ensure_ascii=False)

                cur.execute("""
                    UPDATE transactions
                    SET merchant = %s, category = %s, total = %s, date = %s, image = %s, items = %s
                    WHERE id = %s;
                """, (merchant, category, total, date_val, image_val, items_json, tx_id))

        return {
            "id": tx_id,
            "merchant": merchant,
            "category": category,
            "total": total,
            "date": date_val,
            "image": image_val,
            "items": json.loads(items_json) if isinstance(items_json, str) else items_json
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update transaction: {str(exc)}"
        )


@app.delete("/api/transactions/{tx_id}")
def delete_transaction(tx_id: int):
    """
    ลบรายการใช้จ่ายตาม ID ที่ระบุออกจาก MySQL
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM transactions WHERE id = %s;", (tx_id,))
                if cur.rowcount == 0:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Transaction {tx_id} not found"
                    )
        return {"success": True, "message": f"Transaction {tx_id} deleted successfully"}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete transaction: {str(exc)}"
        )


@app.post("/api/transactions/bulk")
def bulk_save_transactions(transactions: List[TransactionCreate]):
    """
    บันทึก/เขียนทับรายการทั้งหมด (Bulk Synchronize จาก Frontend)
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM transactions;")
                for tx in transactions:
                    tx_id = tx.id if tx.id is not None else int(time.time() * 1000)
                    tx_date = tx.date if tx.date else time.strftime("Today · %H:%M")
                    items_json = json.dumps([item.dict() for item in tx.items], ensure_ascii=False)
                    cur.execute("""
                        INSERT INTO transactions (id, merchant, category, total, date, image, items)
                        VALUES (%s, %s, %s, %s, %s, %s, %s);
                    """, (
                        tx_id,
                        tx.merchant,
                        tx.category or "General",
                        tx.total,
                        tx_date,
                        tx.image or "",
                        items_json
                    ))
        return {"success": True, "count": len(transactions)}
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Bulk save failed: {str(exc)}"
        )


@app.get("/api/forecast")
def get_predictive_forecast(
    year: Optional[int] = None,
    month: Optional[int] = None,
    budget: Optional[float] = 10000.0
):
    """
    ระบบพยากรณ์รายจ่ายล่วงหน้า (Predictive Budgeting)
    คำนวณค่าเฉลี่ยการใช้จ่ายรายวันจาก MySQL แล้วคูณจำนวนวันที่เหลือในเดือนนั้นเพื่อทำนายยอดรวม
    """
    now = datetime.now()
    target_year = year if year is not None else now.year

    if month is None:
        target_month = now.month
    else:
        # Standardize month between 1 and 12
        if month == 0:
            target_month = 1
        elif 1 <= month <= 12:
            target_month = month
        else:
            target_month = now.month

    monthly_budget = float(budget if budget is not None else 10000.0)

    # 1. จำนวนวันทั้งหมดในเดือน
    _, days_in_month = calendar.monthrange(target_year, target_month)

    # 2. คำนวณจำนวนวันที่ผ่านไปแล้ว และจำนวนวันที่เหลือ
    if target_year == now.year and target_month == now.month:
        elapsed_days = max(1, now.day)
    elif target_year < now.year or (target_year == now.year and target_month < now.month):
        elapsed_days = days_in_month
    else:
        elapsed_days = 0

    remaining_days = max(0, days_in_month - elapsed_days)

    # 3. ดึงข้อมูลรายการใช้จ่ายจาก MySQL
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id, merchant, category, total, date, items, created_at
                    FROM transactions
                    ORDER BY id DESC;
                """)
                rows = cur.fetchall()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database query failed: {str(exc)}"
        )

    # 4. กรองรายการเฉพาะเดือนและปีที่ต้องการ
    month_spent = 0.0
    month_tx_count = 0

    for r in rows:
        tx_dt = None
        if r.get("created_at") and isinstance(r["created_at"], datetime):
            tx_dt = r["created_at"]
        elif r.get("id"):
            try:
                val = int(r["id"])
                if val > 1e11:
                    tx_dt = datetime.fromtimestamp(val / 1000.0)
                elif val > 1e8:
                    tx_dt = datetime.fromtimestamp(val)
            except Exception:
                pass

        if not tx_dt:
            tx_dt = now

        if tx_dt.year == target_year and tx_dt.month == target_month:
            month_spent += float(r.get("total") or 0.0)
            month_tx_count += 1

    # 5. คำนวณค่าเฉลี่ยรายวัน และพยากรณ์ยอดรวมสิ้นเดือน
    daily_avg = round(month_spent / elapsed_days, 2) if elapsed_days > 0 else 0.0
    projected_remaining = round(daily_avg * remaining_days, 2)
    projected_total = round(month_spent + projected_remaining, 2)

    # 6. เปรียบเทียบกับงบประมาณ (Budget)
    is_over_budget = projected_total > monthly_budget
    difference = round(abs(projected_total - monthly_budget), 2)
    burn_percentage = round((projected_total / monthly_budget) * 100, 1) if monthly_budget > 0 else 0.0

    if is_over_budget:
        advice = (
            f"เตือน: อัตราใช้จ่ายเฉลี่ยวันละ ฿{daily_avg:,.0f} "
            f"อาจทำให้ยอดรวมสิ้นเดือนแตะ ฿{projected_total:,.0f} "
            f"ซึ่งเกินงบประมาณไป ฿{difference:,.0f} แนะนำให้ชะลอรายจ่ายที่ไม่จำเป็น"
        )
    else:
        advice = (
            f"การเงินปลอดภัย: อัตราใช้จ่ายเฉลี่ยวันละ ฿{daily_avg:,.0f} "
            f"คาดว่าสิ้นเดือนจะใช้งบประมาณ ฿{projected_total:,.0f} "
            f"และยังเหลืองบออมปลอดภัย ฿{difference:,.0f}"
        )

    return {
        "year": target_year,
        "month": target_month,
        "days_in_month": days_in_month,
        "elapsed_days": elapsed_days,
        "remaining_days": remaining_days,
        "spent_so_far": round(month_spent, 2),
        "transaction_count": month_tx_count,
        "daily_avg": daily_avg,
        "projected_remaining": projected_remaining,
        "projected_total": projected_total,
        "budget": monthly_budget,
        "is_over_budget": is_over_budget,
        "difference": difference,
        "burn_percentage": burn_percentage,
        "advice": advice
    }


if __name__ == "__main__":
    import uvicorn
    print("[Server] Starting Finance AI Backend at http://127.0.0.1:8000")
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
