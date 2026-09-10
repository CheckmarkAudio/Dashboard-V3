/** Tiny local sample assets. No uploads or third-party media requests. */
const sampleRate = 8000
const frames = sampleRate
const bytes = new Uint8Array(44 + frames * 2)
const view = new DataView(bytes.buffer)
const text = (offset: number, value: string) => [...value].forEach((char, index) => bytes[offset + index] = char.charCodeAt(0))
text(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); text(8, 'WAVE'); text(12, 'fmt ')
view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
text(36, 'data'); view.setUint32(40, frames * 2, true)
for (let i = 0; i < frames; i++) view.setInt16(44 + i * 2, Math.sin(i / sampleRate * 220 * Math.PI * 2) * 1600 * Math.sin(i / frames * Math.PI), true)
export const sampleAudio = 'data:audio/wav;base64,' + btoa(String.fromCharCode(...bytes))
export const sampleArtwork = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><rect width="600" height="600" fill="#29251e"/><circle cx="300" cy="260" r="160" fill="none" stroke="#c99a52" stroke-width="2"/><circle cx="300" cy="260" r="120" fill="none" stroke="#c99a52"/><path d="M120 320 Q210 130 300 320T480 320" fill="none" stroke="#c99a52" stroke-width="5"/><text x="300" y="490" text-anchor="middle" fill="#eee1cc" font-family="Georgia" font-size="38">AFTER HOURS</text><text x="300" y="530" text-anchor="middle" fill="#c99a52" font-family="sans-serif" font-size="14">SAMPLE ARTWORK</text></svg>')
