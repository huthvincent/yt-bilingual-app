"""
纸牌屋 (House of Cards) 字幕下载脚本
使用 OpenSubtitles API 下载英文 SRT 字幕

使用前需要:
1. 在 https://www.opensubtitles.com 注册账户
2. 在 https://www.opensubtitles.com/consumers 创建一个 API consumer，获取 API Key
3. 设置环境变量或修改下面的配置
"""

import os
import sys
import time
from opensubtitlescom import OpenSubtitles

# -----------------------------------------------
# 配置区
# -----------------------------------------------
API_KEY = os.environ.get("OPENSUBTITLES_API_KEY", "YOUR_API_KEY_HERE")
USERNAME = os.environ.get("OPENSUBTITLES_USERNAME", "")
PASSWORD = os.environ.get("OPENSUBTITLES_PASSWORD", "")

# House of Cards (US) - IMDB ID: tt1856010 -> numeric 1856010
PARENT_IMDB_ID = 1856010
SHOW_NAME = "house-of-cards"

# Season/episode structure: S01-S06
SEASONS = {
    1: 13,   # S01: 13 episodes
    2: 13,   # S02: 13 episodes
    3: 13,   # S03: 13 episodes
    4: 13,   # S04: 13 episodes
    5: 13,   # S05: 13 episodes
    6: 8,    # S06: 8 episodes
}

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "subtitles", SHOW_NAME)


def main():
    if API_KEY == "YOUR_API_KEY_HERE":
        print("❌ 请先设置 OpenSubtitles API Key!")
        print("   1. 注册: https://www.opensubtitles.com")
        print("   2. 创建 API consumer: https://www.opensubtitles.com/consumers")
        print("   3. 设置环境变量: export OPENSUBTITLES_API_KEY='your_key'")
        print("   或直接修改此脚本顶部的 API_KEY 变量")
        sys.exit(1)

    subtitles = OpenSubtitles("YTBilingual v1.0", API_KEY)

    # Login for higher download limits (20/day vs 5/day)
    if USERNAME and PASSWORD:
        try:
            subtitles.login(USERNAME, PASSWORD)
            print("✅ 已登录 OpenSubtitles")
        except Exception as e:
            print(f"⚠️  登录失败: {e}，将以匿名模式继续（每天限5次下载）")

    total_downloaded = 0
    total_skipped = 0
    total_failed = 0

    for season, episode_count in SEASONS.items():
        season_dir = os.path.join(OUTPUT_DIR, f"S{season:02d}")
        os.makedirs(season_dir, exist_ok=True)

        for episode in range(1, episode_count + 1):
            output_file = os.path.join(season_dir, f"E{episode:02d}.srt")

            # Skip if already downloaded
            if os.path.exists(output_file) and os.path.getsize(output_file) > 100:
                print(f"⏭️  S{season:02d}E{episode:02d} 已存在，跳过")
                total_skipped += 1
                continue

            print(f"🔍 搜索 S{season:02d}E{episode:02d}...", end=" ")

            try:
                response = subtitles.search(
                    parent_imdb_id=PARENT_IMDB_ID,
                    season_number=season,
                    episode_number=episode,
                    languages="en",
                )

                if not response.data:
                    print("❌ 未找到字幕")
                    total_failed += 1
                    continue

                # Pick the best subtitle (highest download count / first result)
                best = response.data[0]
                file_id = best.id

                # Download
                srt_content = subtitles.download(file_id)
                
                with open(output_file, "wb") as f:
                    f.write(srt_content)

                print(f"✅ 已下载 ({len(srt_content)} bytes)")
                total_downloaded += 1

                # Rate limit: sleep between downloads
                time.sleep(2)

            except Exception as e:
                error_msg = str(e)
                if "406" in error_msg or "download" in error_msg.lower():
                    print(f"⚠️  达到每日下载限制，明天再继续")
                    print(f"\n📊 本次统计: 下载 {total_downloaded}, 跳过 {total_skipped}, 失败 {total_failed}")
                    sys.exit(0)
                else:
                    print(f"❌ 失败: {e}")
                    total_failed += 1

    print(f"\n📊 完成! 下载 {total_downloaded}, 跳过 {total_skipped}, 失败 {total_failed}")


if __name__ == "__main__":
    main()
