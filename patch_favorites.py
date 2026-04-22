import json
import os
import glob

history_dir = "/Users/rui/Desktop/yt-bilingual-app/history"
fav_file = os.path.join(history_dir, "favorites.json")

with open(fav_file, "r", encoding="utf-8") as f:
    favorites = json.load(f)

# Load all history transcripts
transcripts = {}
for file in glob.glob(os.path.join(history_dir, "*.json")):
    if "favorites" in file or "subscriptions" in file:
        continue
    with open(file, "r", encoding="utf-8") as f:
        data = json.load(f)
        if "videoId" in data:
            transcripts[data["videoId"]] = data.get("transcript", [])

patched_count = 0
for fav in favorites:
    vid = fav.get("videoId")
    if vid in transcripts:
        # Find matching block
        blocks = transcripts[vid]
        for b in blocks:
            if abs(b.get("start", 0) - fav.get("start", 0)) < 0.1:
                if "highlights" in b and b["highlights"]:
                    fav["highlights"] = b["highlights"]
                    patched_count += 1
                break

with open(fav_file, "w", encoding="utf-8") as f:
    json.dump(favorites, f, ensure_ascii=False, indent=2)

print(f"Patched {patched_count} favorites with highlights!")
