let mediaRecorder;
let audioChunks = [];
let audioContext;
let audioBuffer;
let originalBlob;

const startButton = document.getElementById("startRecord");
const stopButton = document.getElementById("stopRecord");
const playOriginalButton = document.getElementById("playOriginal");
const playTransformedButton = document.getElementById("playTransformed");
const characterSelect = document.getElementById("characterSelect");
const audioPlayback = document.getElementById("audioPlayback");

// Tone.js 초기화
const toneContext = new Tone.Context();
let pororoPreset;

// 뽀로로 프리셋 초기화
async function initPororoPreset() {
    pororoPreset = {
        pitch: new Tone.PitchShift({
            pitch: 4,
            windowSize: 0.1,
            delayTime: 0,
            feedback: 0,
        }),
        chorus: new Tone.Chorus({
            frequency: 4,
            delayTime: 2.5,
            depth: 0.5,
            spread: 180,
        }),
        filter: new Tone.Filter({
            frequency: 2000,
            type: "highpass",
            rolloff: -12,
        }),
        eq: new Tone.EQ3({
            low: -3,
            mid: 2,
            high: 4,
            lowFrequency: 400,
            highFrequency: 2500,
        }),
        compressor: new Tone.Compressor({
            threshold: -24,
            ratio: 12,
            attack: 0.003,
            release: 0.25,
        }),
        reverb: new Tone.Reverb({
            decay: 0.5,
            preDelay: 0.01,
        }),
    };

    // 이펙트 체인 연결
    await pororoPreset.reverb.generate();
    Object.values(pororoPreset).forEach((effect) => effect.toDestination());
}

// 페이지 로드 시 프리셋 초기화
initPororoPreset();

// 캐릭터 정보 추가
const characters = [
    {
        id: "robot",
        name: "로봇",
        image: "https://github.com/user-attachments/assets/e829c553-d66e-4fda-8348-11f7160ba2b6",
    },
    {
        id: "highPitch",
        name: "고음",
        image: "https://github.com/user-attachments/assets/8d03b886-c440-497a-8377-b1d252083936",
    },
    {
        id: "lowPitch",
        name: "저음",
        image: "https://github.com/user-attachments/assets/76977c20-a22b-4919-bded-11ebd1be51e6",
    },
    {
        id: "pororo",
        name: "뽀로로",
        image: "https://github.com/user-attachments/assets/1055642e-02e4-4d27-b71c-67a3294b44e7",
    },
];

let currentCharacterIndex = 0;

// 캐릭터 선택 UI 요소
const prevButton = document.getElementById("prevCharacter");
const nextButton = document.getElementById("nextCharacter");
const characterImage = document.querySelector(".character-image");
const characterName = document.querySelector(".character-name");

// 캐릭터 표시 업데이트 함수
function updateCharacterDisplay() {
    const character = characters[currentCharacterIndex];
    characterImage.style.backgroundImage = `url(${character.image})`;
    characterName.textContent = character.name;
}

// 이전 캐릭터로 이동
prevButton.onclick = () => {
    currentCharacterIndex =
        (currentCharacterIndex - 1 + characters.length) % characters.length;
    updateCharacterDisplay();
};

// 다음 캐릭터로 이동
nextButton.onclick = () => {
    currentCharacterIndex = (currentCharacterIndex + 1) % characters.length;
    updateCharacterDisplay();
};

// 키보드 좌우 화살표로 캐릭터 선택
document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
        prevButton.click();
    } else if (event.key === "ArrowRight") {
        nextButton.click();
    }
});

// 초기 캐릭터 표시
updateCharacterDisplay();

// 녹음 시작
startButton.onclick = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
        originalBlob = new Blob(audioChunks, { type: "audio/wav" });
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
    mediaRecorder.stream.getTracks().forEach((track) => track.stop());
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

// 뽀로로 음성 효과 적용
async function applyPororoEffect(audioBuffer) {
    const player = new Tone.Player().toDestination();
    player.buffer = new Tone.ToneAudioBuffer(audioBuffer);

    // 이펙트 체인 연결
    player.chain(
        pororoPreset.pitch,
        pororoPreset.chorus,
        pororoPreset.filter,
        pororoPreset.eq,
        pororoPreset.compressor,
        pororoPreset.reverb,
        Tone.Destination
    );

    return player;
}

// 변형된 오디오 재생
playTransformedButton.onclick = async () => {
    const character = characters[currentCharacterIndex].id;
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;

    if (character === "pororo") {
        // 기존 재생 중지
        Tone.Transport.stop();
        Tone.Transport.cancel();

        // 뽀로로 효과 적용
        const pororoPlayer = await applyPororoEffect(audioBuffer);

        // 재생
        await Tone.start();
        pororoPlayer.start();

        // 재생 완료 후 처리
        pororoPlayer.onstop = () => {
            const transformedBlob = bufferToWave(audioBuffer);
            audioPlayback.src = URL.createObjectURL(transformedBlob);
        };
    } else if (character === "robot") {
        const gainNode = audioContext.createGain();
        gainNode.gain.value = 1.2;
        source.playbackRate.value = 0.8;
        source.connect(gainNode).connect(audioContext.destination);
        source.start(0);
    } else if (character === "highPitch") {
        source.playbackRate.value = 1.5;
        source.connect(audioContext.destination);
        source.start(0);
    } else if (character === "lowPitch") {
        source.playbackRate.value = 0.7;
        source.connect(audioContext.destination);
        source.start(0);
    }

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
    let offset = 44,
        pos = 0;

    // WAV 헤더 작성
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // 파일 길이 - 8
    setUint32(0x45564157); // "WAVE"
    setUint32(0x20746d66); // "fmt "
    setUint32(16); // Subchunk1Size
    setUint16(1); // AudioFormat (PCM)
    setUint16(numOfChan); // NumChannels
    setUint32(abuffer.sampleRate); // SampleRate
    setUint32(abuffer.sampleRate * numOfChan * 2); // ByteRate
    setUint16(numOfChan * 2); // BlockAlign
    setUint16(16); // BitsPerSample
    setUint32(0x61746164); // "data"
    setUint32(abuffer.length * numOfChan * 2); // Subchunk2Size

    for (let i = 0; i < abuffer.numberOfChannels; i++) {
        channels.push(abuffer.getChannelData(i));
    }

    while (pos < abuffer.length) {
        for (let ch = 0; ch < numOfChan; ch++) {
            let sample = channels[ch][pos];
            sample = Math.max(-1, Math.min(1, sample));
            sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
            view.setInt16(offset, sample, true);
            offset += 2;
        }
        pos++;
    }

    return new Blob([buffer], { type: "audio/wav" });

    function setUint16(data) {
        view.setUint16(offset, data, true);
        offset += 2;
    }
    function setUint32(data) {
        view.setUint32(offset, data, true);
        offset += 4;
    }
}
