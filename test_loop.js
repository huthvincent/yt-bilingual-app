const fs = require('fs');
const data = JSON.parse(fs.readFileSync('/Users/rui/Desktop/yt-bilingual-app/history/Dan_Koe_20251207_DKT6m_8vCkA.json', 'utf8'));
const transcript = data.transcript;

function getActiveIndex(currentTime) {
    const effectiveTime = currentTime + 0.8;
    let activeIndex = -1;
    for (let i = 0; i < transcript.length; i++) {
        const item = transcript[i];
        if (effectiveTime >= item.start && effectiveTime < item.end) {
            activeIndex = i;
            break;
        } else if (effectiveTime >= item.end) {
            activeIndex = i;
        } else {
            break;
        }
    }
    return activeIndex;
}

console.log("0s -> index", getActiveIndex(0));
console.log("10s -> index", getActiveIndex(10));
console.log("800s -> index", getActiveIndex(800));
console.log("1100s -> index", getActiveIndex(1100));
console.log("1200s -> index", getActiveIndex(1200));

// Let's check the items between index 0 and 281, are there any that have string types for start or end?
for (let i=0; i<transcript.length; i++) {
    if (typeof transcript[i].start !== 'number' || typeof transcript[i].end !== 'number') {
        console.log("BAD TYPE AT INDEX", i, transcript[i]);
    }
}
