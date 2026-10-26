#!/usr/bin/env python3
"""손글씨(Gaegu)·명조(Gowun Batang) 굵은 글씨체를 저장소에 넣을 woff2로 자른다(OFL, Google Fonts 원본).
사용: python3 tools/build-fonts.py <Gaegu.ttf> <GowunBatang.ttf>
화면(portal/*.js·html)과 데이터(portal/data/*.json)에 실제로 나오는 글자만 남겨 파일을 줄인다. 새 글자가 생기면 다시 돌린다.
필요: pip install fonttools brotli"""
import glob, json, subprocess, sys, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
chars = set(chr(c) for c in range(0x20, 0x7F)) | set("·…–—‘’“”→←↑↓↗✓※ⓘ○●◐★☆▶×÷℃㎡")
for f in glob.glob(f"{ROOT}/portal/*.js") + glob.glob(f"{ROOT}/portal/*.html") + glob.glob(f"{ROOT}/portal/*.css") + glob.glob(f"{ROOT}/portal/data/*.json"):
    chars |= set(open(f, encoding="utf-8").read())
chars = {c for c in chars if ord(c) >= 0x20 and not (0x7F <= ord(c) < 0xA0) and c not in "​﻿"}
txt = os.path.join(ROOT, "tools", ".font-chars.txt")
open(txt, "w", encoding="utf-8").write("".join(sorted(chars)))
out = os.path.join(ROOT, "portal", "fonts")
os.makedirs(out, exist_ok=True)
for src, name in zip(sys.argv[1:3], ["gaegu-700.woff2", "gowun-batang-700.woff2"]):
    subprocess.run(["pyftsubset", src, f"--text-file={txt}", "--flavor=woff2", f"--output-file={os.path.join(out, name)}", "--layout-features=*", "--no-hinting"], check=True)
    print(name, os.path.getsize(os.path.join(out, name)) // 1024, "KB")
os.unlink(txt)
print("글자 수", len(chars))
