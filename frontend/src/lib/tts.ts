// Browser text-to-speech for word/sentence pronunciation.
export function speak(text: string, rate = 0.95) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = rate;
    // Prefer a native English voice when available
    const voice = window.speechSynthesis.getVoices().find(v => v.lang.startsWith('en'));
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
}
