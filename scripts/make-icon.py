#!/usr/bin/env python3
"""生成 MarkUp 应用图标：1024x1024 圆角矩形渐变底 + 白色粗体 M。
纯标准库实现（zlib + struct 手写 PNG），无需 PIL。"""
import struct, zlib, math

SIZE = 1024
RADIUS = 220
TOP = (0x63, 0x66, 0xF1)    # indigo
BOT = (0x8B, 0x5C, 0xF6)    # violet
T = 100                      # M 笔画粗细

# M 的五段笔画（顶点折线）
PTS = [(300, 724), (300, 300), (512, 540), (724, 300), (724, 724)]
SEGMENTS = list(zip(PTS, PTS[1:]))

def seg_dist(px, py, a, b):
    ax, ay = a; bx, by = b
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy
    t = 0.0 if L2 == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / L2))
    cx, cy = ax + t * dx, ay + t * dy
    return math.hypot(px - cx, py - cy)

def rounded_rect(x, y):
    # 圆角矩形内部判定
    if RADIUS <= x < SIZE - RADIUS or RADIUS <= y < SIZE - RADIUS:
        return 0 <= x < SIZE and 0 <= y < SIZE
    cx = RADIUS if x < RADIUS else SIZE - RADIUS
    cy = RADIUS if y < RADIUS else SIZE - RADIUS
    return (x - cx) ** 2 + (y - cy) ** 2 <= RADIUS ** 2

rows = []
for y in range(SIZE):
    row = bytearray()
    g = y / (SIZE - 1)
    cr = int(TOP[0] + (BOT[0] - TOP[0]) * g)
    cg = int(TOP[1] + (BOT[1] - TOP[1]) * g)
    cb = int(TOP[2] + (BOT[2] - TOP[2]) * g)
    in_band = RADIUS - T <= y <= 724 + T  # M 的纵向包围盒
    for x in range(SIZE):
        if not rounded_rect(x, y):
            row += b"\x00\x00\x00\x00"
            continue
        white = False
        if in_band and 300 - T <= x <= 724 + T:
            for a, b in SEGMENTS:
                if seg_dist(x, y, a, b) <= T / 2:
                    white = True
                    break
        row += bytes((255, 255, 255, 255)) if white else bytes((cr, cg, cb, 255))
    rows.append(b"\x00" + bytes(row))

raw = b"".join(rows)

def chunk(tag, data):
    c = tag + data
    return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c))

png = (
    b"\x89PNG\r\n\x1a\n"
    + chunk(b"IHDR", struct.pack(">IIBBBBB", SIZE, SIZE, 8, 6, 0, 0, 0))
    + chunk(b"IDAT", zlib.compress(raw, 9))
    + chunk(b"IEND", b"")
)
with open("icon-src.png", "wb") as f:
    f.write(png)
print("icon-src.png written")
