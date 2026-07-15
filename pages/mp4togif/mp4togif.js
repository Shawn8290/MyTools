(function() {
    // 動態載入 gif.js
    if (typeof GIF === 'undefined') {
        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.js";
        document.head.appendChild(script);
    }

    const videoUpload = document.getElementById('videoUpload');
    const hiddenVideo = document.getElementById('hidden-video');
    const canvas = document.getElementById('preview-canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const convertBtn = document.getElementById('startConvertBtn');
    
    const transparentCheckbox = document.getElementById('transparent-bg');
    const toleranceGroup = document.getElementById('tolerance-group');
    const toleranceSlider = document.getElementById('tolerance');
    const statusMsg = document.getElementById('status-msg');
    
    let gif;

    function median(values) {
        values.sort((a, b) => a - b);
        return values[Math.floor(values.length / 2)];
    }

    // 從畫面外框估計實際背景色，避免 MP4 壓縮後的白底不再是純 #fff。
    function estimateBackgroundColor(data, width, height) {
        const samples = [];
        const samplePixel = (x, y) => {
            const index = (y * width + x) * 4;
            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);

            // 只採用明亮、低彩度的外框像素，降低主體碰到邊界時的干擾。
            if ((r + g + b) / 3 >= 180 && max - min <= 45) {
                samples.push([r, g, b]);
            }
        };

        const step = Math.max(1, Math.floor(Math.min(width, height) / 100));
        for (let x = 0; x < width; x += step) {
            samplePixel(x, 0);
            samplePixel(x, height - 1);
        }
        for (let y = step; y < height - 1; y += step) {
            samplePixel(0, y);
            samplePixel(width - 1, y);
        }

        if (!samples.length) return { r: 255, g: 255, b: 255 };

        return {
            r: median(samples.map(pixel => pixel[0])),
            g: median(samples.map(pixel => pixel[1])),
            b: median(samples.map(pixel => pixel[2]))
        };
    }

    function colorDistanceSquared(data, pixelIndex, background) {
        const dataIndex = pixelIndex * 4;
        const dr = data[dataIndex] - background.r;
        const dg = data[dataIndex + 1] - background.g;
        const db = data[dataIndex + 2] - background.b;
        return dr * dr + dg * dg + db * db;
    }

    // 只移除「與畫面外框連通」且接近背景色的區域，保留主體內部的白色。
    function removeConnectedBackground(frameData, width, height, tolerance) {
        const data = frameData.data;
        const pixelCount = width * height;
        const background = estimateBackgroundColor(data, width, height);
        const backgroundMask = new Uint8Array(pixelCount);
        const queue = new Int32Array(pixelCount);
        const strictLimit = tolerance * tolerance;
        let head = 0;
        let tail = 0;

        const enqueueIfBackground = (pixelIndex) => {
            if (backgroundMask[pixelIndex]) return;
            if (colorDistanceSquared(data, pixelIndex, background) > strictLimit) return;
            backgroundMask[pixelIndex] = 1;
            queue[tail++] = pixelIndex;
        };

        for (let x = 0; x < width; x++) {
            enqueueIfBackground(x);
            enqueueIfBackground((height - 1) * width + x);
        }
        for (let y = 1; y < height - 1; y++) {
            enqueueIfBackground(y * width);
            enqueueIfBackground(y * width + width - 1);
        }

        while (head < tail) {
            const pixelIndex = queue[head++];
            const x = pixelIndex % width;
            const y = Math.floor(pixelIndex / width);

            if (x > 0) enqueueIfBackground(pixelIndex - 1);
            if (x + 1 < width) enqueueIfBackground(pixelIndex + 1);
            if (y > 0) enqueueIfBackground(pixelIndex - width);
            if (y + 1 < height) enqueueIfBackground(pixelIndex + width);
        }

        // 沿已確認的背景再清理一圈壓縮／縮放產生的淺色白邊。
        // 僅處理緊鄰背景的像素，不會搜尋或挖掉主體內部的白色區塊。
        const cleanupLimit = Math.min(255, tolerance * 1.7) ** 2;
        for (let pass = 0; pass < 2; pass++) {
            const additions = [];
            for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex++) {
                if (backgroundMask[pixelIndex]) continue;
                const x = pixelIndex % width;
                const y = Math.floor(pixelIndex / width);
                const touchesBackground =
                    (x > 0 && backgroundMask[pixelIndex - 1]) ||
                    (x + 1 < width && backgroundMask[pixelIndex + 1]) ||
                    (y > 0 && backgroundMask[pixelIndex - width]) ||
                    (y + 1 < height && backgroundMask[pixelIndex + width]);

                if (touchesBackground && colorDistanceSquared(data, pixelIndex, background) <= cleanupLimit) {
                    additions.push(pixelIndex);
                }
            }
            if (!additions.length) break;
            additions.forEach(pixelIndex => { backgroundMask[pixelIndex] = 1; });
        }

        for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex++) {
            if (backgroundMask[pixelIndex]) {
                const dataIndex = pixelIndex * 4;
                data[dataIndex] = 0;
                data[dataIndex + 1] = 0;
                data[dataIndex + 2] = 0;
                data[dataIndex + 3] = 0;
            }
        }
    }

    // 控制去背選項的顯示與隱藏
    transparentCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            toleranceGroup.style.display = 'block';
        } else {
            toleranceGroup.style.display = 'none';
        }
    });

    // 更新容差值顯示
    toleranceSlider.addEventListener('input', (e) => {
        document.getElementById('tolerance-val').textContent = e.target.value;
    });

    // 讀取影片
    videoUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const fileURL = URL.createObjectURL(file);
        hiddenVideo.src = fileURL;
        
        hiddenVideo.onloadedmetadata = () => {
            const scale = hiddenVideo.videoWidth > 400 ? 400 / hiddenVideo.videoWidth : 1;
            canvas.width = hiddenVideo.videoWidth * scale;
            canvas.height = hiddenVideo.videoHeight * scale;
            convertBtn.style.display = 'block';
            statusMsg.textContent = `影片載入完成：${(hiddenVideo.duration).toFixed(2)} 秒`;
        };
    });

    // 核心處理邏輯
    convertBtn.addEventListener('click', () => {
        if (typeof GIF === 'undefined') {
            alert("GIF 模組還在載入中，請稍後。");
            return;
        }

        convertBtn.disabled = true;
        const isTransparent = transparentCheckbox.checked;
        const tolerance = parseInt(toleranceSlider.value);
        
        statusMsg.textContent = isTransparent 
            ? "正在逐格擷取並去背... (這可能需要一點時間)" 
            : "正在擷取影片畫格... (一般轉換速度較快)";
        
        // 設定 GIF 參數 (若不需要去背，就不設定 transparent 屬性)
        let gifOptions = {
            workers: 2,
            quality: 10,
            width: canvas.width,
            height: canvas.height,
            workerScript: "js/gif.worker.js"
        };
        
        if (isTransparent) {
            gifOptions.transparent = "rgba(0,0,0,0)";
        }

        gif = new GIF(gifOptions);

        gif.on('finished', function(blob) {
            const resultImg = document.getElementById('result-gif');
            resultImg.src = URL.createObjectURL(blob);
            document.getElementById('result-area').style.display = 'block';
            statusMsg.textContent = "轉換完成！可以對圖片點右鍵「另存圖片」";
            convertBtn.disabled = false;
        });

        hiddenVideo.currentTime = 0;
        hiddenVideo.play();

        const targetFrameInterval = 1 / 30;
        let lastCapturedTime = -Infinity;

        function captureFrame() {
            if (hiddenVideo.paused || hiddenVideo.ended) {
                statusMsg.textContent = "擷取完畢，正在編碼 GIF...";
                gif.render();
                return;
            }

            // requestAnimationFrame 可能以 60Hz 執行；限制為約 30fps，避免重複
            // 擷取相同的影片畫格，縮短去背／編碼時間並控制 GIF 大小。
            if (hiddenVideo.currentTime - lastCapturedTime < targetFrameInterval) {
                requestAnimationFrame(captureFrame);
                return;
            }
            lastCapturedTime = hiddenVideo.currentTime;

            // 1. 將影片畫面畫到 Canvas 上
            ctx.drawImage(hiddenVideo, 0, 0, canvas.width, canvas.height);
            
            // 2. 如果有勾選去背，才執行耗時的像素運算
            if (isTransparent) {
                const frameData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                removeConnectedBackground(frameData, canvas.width, canvas.height, tolerance);
                ctx.putImageData(frameData, 0, 0);
            }

            // 3. 把這一格加入 GIF 佇列
            gif.addFrame(ctx, {copy: true, delay: 33});

            requestAnimationFrame(captureFrame);
        }

        captureFrame();
    });
})();
