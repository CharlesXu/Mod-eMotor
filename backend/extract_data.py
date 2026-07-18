#!/usr/bin/env python3
"""
Data extraction tool - extracts all data from the original API and imports into DB.
Usage: python extract_data.py <activation_code> [--db DATABASE_URL]
"""
import sys
import json
import time
import urllib.request
import os
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select

# Add project root
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.crypto_utils import encrypt, decrypt
from app.models import Base, Motor, Part, AddItem, ActivationCode

API_BASE = "http://motomate.cn:3807"
DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/emotor"
)


def create_multipart_body(fields=None):
    """Create multipart/form-data body."""
    boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
    parts = []
    if fields:
        for key, value in fields.items():
            parts.append(f'--{boundary}')
            parts.append(f'Content-Disposition: form-data; name="{key}"')
            parts.append('')
            parts.append(value)
    parts.append(f'--{boundary}--')
    parts.append('')
    return '\r\n'.join(parts).encode(), boundary


def api_post(path, fields=None):
    """Send a POST request to the API."""
    body, boundary = create_multipart_body(fields)
    req = urllib.request.Request(
        f'{API_BASE}{path}',
        data=body,
        headers={
            'Content-Type': f'multipart/form-data; boundary={boundary}',
            'User-Agent': 'Mozilla/5.0',
        }
    )
    try:
        resp = urllib.request.urlopen(req, timeout=15)
        return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"  HTTP Error {e.code}: {e.read().decode('utf-8', errors='replace')[:300]}")
        return None
    except Exception as e:
        print(f"  Error: {e}")
        return None


async def extract_all_data(activation_code):
    """Extract all data from the original API and import into database."""
    print("=" * 60)
    print("电改模拟工具 - 数据提取工具 (PostgreSQL)")
    print("=" * 60)

    engine = create_async_engine(DB_URL, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # Step 1: Activate
        print("\n[1/4] 正在激活验证码...")
        ts = int(time.time() * 1000)
        encrypted_code = encrypt(f"{activation_code}_{ts}")

        result = api_post('/getTools', {
            'data': json.dumps({'type': 'PC', 'c': '', 'd': '', 'e': encrypted_code})
        })

        if not result or result.get('stat') != 'success':
            print(f"  ❌ 激活失败: {result.get('reason', 'Unknown error') if result else 'No response'}")
            return False

        print("  ✅ 激活成功!")

        # Register activation code in DB
        existing = await db.execute(select(ActivationCode).where(ActivationCode.code == activation_code))
        if not existing.scalar_one_or_none():
            db.add(ActivationCode(
                code=activation_code,
                activated_at=int(time.time() * 1000),
                expires_at=int(time.time() * 1000) + 365 * 24 * 60 * 60 * 1000
            ))
            print("  ✅ 激活码已注册到数据库")

        # Step 2: Get parts list
        print("\n[2/4] 正在获取配件列表...")
        result = api_post('/getPartList')
        if result and result.get('stat') == 'success':
            parts_data = result.get('data', [])
            print(f"  ✅ 获取到 {len(parts_data)} 个配件")

            parts = []
            for part_str in parts_data:
                fields = part_str.split('_')
                if len(fields) >= 10:
                    parts.append(Part(
                        type=fields[0], brand=fields[1], name=fields[2],
                        concise=fields[3] if len(fields) > 3 else "",
                        size=fields[4] if len(fields) > 4 else "",
                        color=fields[5] if len(fields) > 5 else "",
                        product_id=fields[6] if len(fields) > 6 else "",
                        body_angle=fields[7] if len(fields) > 7 else "",
                        position=fields[8] if len(fields) > 8 else "",
                        describe=fields[9] if len(fields) > 9 else "",
                        top_time=fields[10] if len(fields) > 10 else "0",
                    ))

            for p in parts:
                db.add(p)
            await db.flush()
            print(f"  ✅ 配件数据已导入数据库 ({len(parts)} 条)")

            # Download part images
            print(f"\n  正在下载配件图片...")
            os.makedirs('app/uploads/partImg', exist_ok=True)
            downloaded = 0
            for part in parts:
                pid = part.product_id
                if pid:
                    for img_num in ['1', '2']:
                        img_url = f"{API_BASE}/uploads/partImg/{pid}/{pid}_{img_num}.png"
                        try:
                            req = urllib.request.Request(img_url)
                            resp = urllib.request.urlopen(req, timeout=5)
                            img_dir = f"app/uploads/partImg/{pid}"
                            os.makedirs(img_dir, exist_ok=True)
                            img_path = f"{img_dir}/{pid}_{img_num}.png"
                            with open(img_path, 'wb') as f:
                                f.write(resp.read())
                            downloaded += 1
                        except:
                            pass
            print(f"  ✅ 下载了 {downloaded} 张配件图片")
        else:
            print(f"  ❌ 获取配件列表失败: {result}")
            parts = []

        # Step 3: Get add-on items
        print("\n[3/4] 正在获取附加件列表...")
        brands = list(set(p.brand for p in parts)) if parts else ['NIU', 'ZEEHO']
        all_items = []
        for brand in brands[:10]:
            result = api_post('/getAddList', {
                'time': str(int(time.time() * 1000)),
                'belongCarBrand': brand,
                'belongCarName': ''
            })
            if result and result.get('stat') == 'success':
                items = result.get('data', [])
                all_items.extend(items)
                print(f"  {brand}: {len(items)} 个附加件")

        if all_items:
            count = 0
            for item in all_items:
                db.add(AddItem(
                    brand=item.get('brand', ''),
                    name=item.get('name', ''),
                    type=item.get('type', ''),
                    car_name=item.get('car_name', ''),
                    product_id=item.get('product_id', ''),
                    picsrc=item.get('picsrc', ''),
                    describe=item.get('describe', ''),
                    price=item.get('price', ''),
                ))
                count += 1
            await db.flush()
            print(f"  ✅ 附加件数据已导入数据库 ({count} 条)")

        await db.commit()

    await engine.dispose()

    print("\n" + "=" * 60)
    print("数据提取完成! 所有数据已导入 PostgreSQL")
    print("=" * 60)
    return True


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("用法: python extract_data.py <激活码>")
        print("示例: python extract_data.py ABCD-1234-EFGH")
        print()
        print("环境变量 DATABASE_URL 可指定数据库地址")
        sys.exit(1)

    activation_code = sys.argv[1]
    asyncio.run(extract_all_data(activation_code))