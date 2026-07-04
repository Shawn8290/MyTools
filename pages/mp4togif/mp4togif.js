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
            workerScript: "https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js"
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

        function captureFrame() {
            if (hiddenVideo.paused || hiddenVideo.ended) {
                statusMsg.textContent = "擷取完畢，正在編碼 GIF...";
                gif.render();
                return;
            }

            // 1. 將影片畫面畫到 Canvas 上
            ctx.drawImage(hiddenVideo, 0, 0, canvas.width, canvas.height);
            
            // 2. 如果有勾選去背，才執行耗時的像素運算
            if (isTransparent) {
                let frameData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                let length = frameData.data.length;

                for (let i = 0; i < length; i += 4) {
                    let r = frameData.data[i];
                    let g = frameData.data[i + 1];
                    let b = frameData.data[i + 2];

                    if (r > tolerance && g > tolerance && b > tolerance) {
                        frameData.data[i + 3] = 0; 
                    }
                }
                ctx.putImageData(frameData, 0, 0);
            }

            // 3. 把這一格加入 GIF 佇列
            gif.addFrame(ctx, {copy: true, delay: 33});

            requestAnimationFrame(captureFrame);
        }

        captureFrame();
    });
})();