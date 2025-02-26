let mediaRecorder;
let audioChunks = [];
let audioContext;
let audioBuffer;
let originalBlob;

const startButton = document.getElementById('startRecord');
const stopButton = document.getElementById('stopRecord');
const playOriginalButton = document.getElementById('playOriginal');
const playTransformedButton = document.getElementById('playTransformed');
const characterSelect = document.getElementById('characterSelect');
const audioPlayback = document.getElementById('audioPlayback');

// 녹음 시작
startButton.onclick = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    
    mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
    };
    
    mediaRecorder.onstop = () => {
        originalBlob = new Blob(audioChunks, { type: 'audio/wav' });
        audioChunks = [];
        processAudio(originalBlob);
        playOriginalButton.disabled = false;
        playTransformedButton.disabled = false;
    };
    
    audioChunks = [];
    mediaRecorder.start();
    startButton.disabled = true;
    stopButton.disabled = false;
};

// 녹음 중지
stopButton.onclick = () => {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
    startButton.disabled = false;
    stopButton.disabled = true;
};

// 원본 오디오 재생
playOriginalButton.onclick = () => {
    audioPlayback.src = URL.createObjectURL(originalBlob);
    audioPlayback.play();
};

// 오디오 처리
async function processAudio(blob) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await blob.arrayBuffer();
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
}

// 변형된 오디오 재생
playTransformedButton.onclick = () => {
    const character = characterSelect.value;
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;

    if (character === 'robot') {
        const gainNode = audioContext.createGain();
        gainNode.gain.value = 1.2; // 볼륨 조절
        source.playbackRate.value = 0.8; // 속도 낮춤
        source.connect(gainNode).connect(audioContext.destination);
    } else if (character === 'highPitch') {
        source.playbackRate.value = 1.5; // 속도 높여 고음으로
        source.connect(audioContext.destination);
    } else if (character === 'lowPitch') {
        source.playbackRate.value = 0.7; // 속도 낮춰 저음으로
        source.connect(audioContext.destination);
    }

    source.start(0);

    // 변형된 오디오를 <audio> 태그에서 재생 가능하도록 WAV로 변환
    source.onended = () => {
        const transformedBlob = bufferToWave(audioBuffer);
        audioPlayback.src = URL.createObjectURL(transformedBlob);
    };
};

// AudioBuffer를 WAV로 변환
function bufferToWave(abuffer) {
    const numOfChan = abuffer.numberOfChannels;
    const length = abuffer.length * numOfChan * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    const channels = [];
    let offset = 44, pos = 0;

    // WAV 헤더 작성
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // 파일 길이 - 8
    setUint32(0x45564157); // "WAVE"
    setUint32(0x20746d66); // "fmt "
    setUint32(16);         // Subchunk1Size
    setUint16(1);          // AudioFormat (PCM)
    setUint16(numOfChan);  // NumChannels
    setUint32(abuffer.sampleRate); // SampleRate
    setUint32(abuffer.sampleRate * numOfChan * 2); // ByteRate
    setUint16(numOfChan * 2); // BlockAlign
    setUint16(16);         // BitsPerSample
    setUint32(0x61746164); // "data"
    setUint32(abuffer.length * numOfChan * 2); // Subchunk2Size

    for (let i = 0; i < abuffer.numberOfChannels; i++) {
        channels.push(abuffer.getChannelData(i));
    }

    while (pos < abuffer.length) {
        for (let ch = 0; ch < numOfChan; ch++) {
            let sample = channels[ch][pos];
            sample = Math.max(-1, Math.min(1, sample));
            sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(offset, sample, true);
            offset += 2;
        }
        pos++;
    }

    return new Blob([buffer], { type: 'audio/wav' });

    function setUint16(data) { view.setUint16(offset, data, true); offset += 2; }
    function setUint32(data) { view.setUint32(offset, data, true); offset += 4; }
}