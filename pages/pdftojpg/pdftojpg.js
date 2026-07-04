(function() {
    // --- 1. 動態載入 PDF.js 核心與 Worker ---
    if (typeof pdfjsLib === 'undefined') {
        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        script.onload = () => {
            // 必須設定 Worker 路徑才能正常解析 PDF
            pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
            console.log("PDF.js 載入完成");
        };
        document.head.appendChild(script);
    }

    // --- 2. 綁定 DOM 元素 ---
    const dropArea = document.getElementById('pdfDropArea');
    const fileInput = document.getElementById('pdfUpload');
    const fileInfo = document.getElementById('pdf-file-info');
    const convertBtn = document.getElementById('pdfConvertBtn');
    const statusMsg = document.getElementById('pdf-status');
    const progressWrapper = document.getElementById('progressWrapper');
    const progressBar = document.getElementById('progressBar');

    let currentFile = null;

    // --- 3. UI 互動與檔案選擇邏輯 ---
    if (dropArea && fileInput) {
        // 點擊區域觸發 input
        dropArea.addEventListener('click', () => fileInput.click());

        // 拖曳效果
        dropArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropArea.style.borderColor = '#3498db';
            dropArea.style.backgroundColor = '#ebf8ff';
        });
        dropArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropArea.style.borderColor = '#cbd5e0';
            dropArea.style.backgroundColor = '#f7fafc';
        });
        dropArea.addEventListener('drop', (e) => {
            e.preventDefault();
            dropArea.style.borderColor = '#cbd5e0';
            dropArea.style.backgroundColor = '#f7fafc';
            
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                handleFileSelection(file);
            }
        });

        // 一般選擇檔案
        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                handleFileSelection(e.target.files[0]);
            }
        });
    }

    function handleFileSelection(file) {
        if (file.type !== "application/pdf") {
            fileInfo.innerHTML = '<span style="color:#e53e3e;">❌ 請上傳有效的 PDF 檔案。</span>';
            convertBtn.style.display = 'none';
            currentFile = null;
            return;
        }

        currentFile = file;
        fileInfo.innerHTML = `📄 已選擇：${file.name} (大小: ${(file.size / 1024 / 1024).toFixed(2)} MB)`;
        convertBtn.style.display = 'block';
        statusMsg.innerHTML = '';
        progressWrapper.style.display = 'none';
        progressBar.style.width = '0%';
    }

    // --- 4. 核心轉換邏輯 ---
    if (convertBtn) {
        convertBtn.addEventListener('click', async () => {
            if (!currentFile) return;

            if (typeof pdfjsLib === 'undefined') {
                statusMsg.innerHTML = '<span style="color:#e53e3e;">⏳ 系統正在載入 PDF 處理模組，請稍候再試。</span>';
                return;
            }

            // UI 狀態切換
            convertBtn.disabled = true;
            convertBtn.style.opacity = '0.5';
            progressWrapper.style.display = 'block';
            statusMsg.innerHTML = '正在讀取 PDF 檔案...';
            progressBar.style.width = '5%';

            try {
                // 將 File 物件轉為 ArrayBuffer
                const arrayBuffer = await currentFile.arrayBuffer();
                
                // 載入 PDF 文件
                const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
                const totalPages = pdf.numPages;
                
                statusMsg.innerHTML = `檔案讀取成功，共 ${totalPages} 頁。開始處理...`;

                // 取出檔名 (去除 .pdf 副檔名)
                const baseFileName = currentFile.name.replace(/\.pdf$/i, '');

                // 逐頁處理
                for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
                    // 更新進度條
                    const progress = Math.round((pageNum / totalPages) * 100);
                    progressBar.style.width = `${progress}%`;
                    statusMsg.innerHTML = `正在轉換第 ${pageNum} 頁，共 ${totalPages} 頁...`;

                    const page = await pdf.getPage(pageNum);
                    
                    // 設定縮放比例 (scale = 2.0 可以獲得較好的圖片解析度)
                    const viewport = page.getViewport({ scale: 2.0 });
                    
                    // 建立隱藏的 Canvas
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;

                    // 為了避免透明背景變成黑色，先填滿白色
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);

                    // 將 PDF 頁面渲染到 Canvas
                    const renderContext = {
                        canvasContext: ctx,
                        viewport: viewport
                    };
                    
                    await page.render(renderContext).promise;

                    // 將 Canvas 轉為 JPG 格式的 DataURL (0.9 為壓縮品質)
                    const imgData = canvas.toDataURL('image/jpeg', 0.9);

                    // 建立下載連結並觸發點擊
                    const link = document.createElement('a');
                    link.href = imgData;
                    link.download = `${baseFileName}_頁面_${pageNum}.jpg`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);

                    // 加入短暫延遲 (300毫秒)，避免瀏覽器因瞬間觸發太多下載而崩潰或嚴格阻擋
                    await new Promise(resolve => setTimeout(resolve, 300));
                }

                statusMsg.innerHTML = '<span style="color:#38b2ac; font-weight:bold;">✅ 轉換與下載完成！</span>';
                
            } catch (error) {
                console.error("PDF 轉換錯誤:", error);
                statusMsg.innerHTML = `<span style="color:#e53e3e;">❌ 轉換過程中發生錯誤：${error.message}</span>`;
            } finally {
                // 恢復按鈕狀態
                convertBtn.disabled = false;
                convertBtn.style.opacity = '1';
            }
        });
    }
})();