(function() {
    // --- 1. 動態載入 PDF.js 與 JSZip ---
    if (typeof pdfjsLib === 'undefined') {
        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        script.onload = () => {
            pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        };
        document.head.appendChild(script);
    }
    
    // 加入 JSZip 來打包檔案
    if (typeof JSZip === 'undefined') {
        const zipScript = document.createElement('script');
        zipScript.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
        document.head.appendChild(zipScript);
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
        dropArea.addEventListener('click', () => fileInput.click());
        dropArea.addEventListener('dragover', (e) => { e.preventDefault(); dropArea.style.borderColor = '#3498db'; });
        dropArea.addEventListener('dragleave', (e) => { e.preventDefault(); dropArea.style.borderColor = '#cbd5e0'; });
        dropArea.addEventListener('drop', (e) => {
            e.preventDefault();
            dropArea.style.borderColor = '#cbd5e0';
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleFileSelection(e.dataTransfer.files[0]);
            }
        });
        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) handleFileSelection(e.target.files[0]);
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

    // --- 4. 核心轉換與 ZIP 打包邏輯 ---
    if (convertBtn) {
        convertBtn.addEventListener('click', async () => {
            if (!currentFile) return;

            if (typeof pdfjsLib === 'undefined' || typeof JSZip === 'undefined') {
                statusMsg.innerHTML = '<span style="color:#e53e3e;">⏳ 系統正在載入處理模組，請稍候幾秒再試。</span>';
                return;
            }

            convertBtn.disabled = true;
            convertBtn.style.opacity = '0.5';
            progressWrapper.style.display = 'block';
            progressBar.style.width = '5%';

            try {
                const arrayBuffer = await currentFile.arrayBuffer();
                const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
                const totalPages = pdf.numPages;
                
                const baseFileName = currentFile.name.replace(/\.pdf$/i, '');
                
                // 初始化 ZIP 物件
                const zip = new JSZip();
                const imgFolder = zip.folder(baseFileName);

                statusMsg.innerHTML = `檔案讀取成功，共 ${totalPages} 頁。開始轉換圖片...`;

                for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
                    const progress = Math.round((pageNum / totalPages) * 80); // 留 20% 給 ZIP 打包進度
                    progressBar.style.width = `${progress}%`;
                    statusMsg.innerHTML = `正在轉換第 ${pageNum} 頁，共 ${totalPages} 頁...`;

                    const page = await pdf.getPage(pageNum);
                    const viewport = page.getViewport({ scale: 2.0 });
                    
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;

                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);

                    await page.render({ canvasContext: ctx, viewport: viewport }).promise;

                    const imgData = canvas.toDataURL('image/jpeg', 0.9);
                    
                    // 去除 DataURL 開頭的 "data:image/jpeg;base64," 字串，只保留純 Base64 資料
                    const base64Data = imgData.replace(/^data:image\/(png|jpeg);base64,/, "");
                    
                    // 將該頁面的 Base64 資料塞入 ZIP 資料夾中
                    // 為了確保檔案排序正確，補零處理 (例如 01, 02... 而不是 1, 10, 2)
                    const padNum = String(pageNum).padStart(3, '0'); 
                    imgFolder.file(`Page_${padNum}.jpg`, base64Data, {base64: true});
                }

                statusMsg.innerHTML = "圖片轉換完畢，正在壓縮打包成 ZIP 檔...";
                progressBar.style.width = '90%';

                // 產生 ZIP 檔案 Blob
                const content = await zip.generateAsync({type:"blob"});
                
                // 觸發單次下載
                const link = document.createElement('a');
                link.href = URL.createObjectURL(content);
                link.download = `${baseFileName}_JPG轉換.zip`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                progressBar.style.width = '100%';
                statusMsg.innerHTML = '<span style="color:#38b2ac; font-weight:bold;">✅ 轉換與打包完成！已經為您下載 ZIP 壓縮檔。</span>';
                
            } catch (error) {
                console.error("處理錯誤:", error);
                statusMsg.innerHTML = `<span style="color:#e53e3e;">❌ 處理過程中發生錯誤：${error.message}</span>`;
            } finally {
                convertBtn.disabled = false;
                convertBtn.style.opacity = '1';
            }
        });
    }
})();