// 全域函數：動態載入子頁面
async function loadPage(pageName) {
    const contentArea = document.getElementById('page-content');
    
    try {
        // 1. 抓取對應資料夾下的 HTML
        const response = await fetch(`pages/${pageName}/${pageName}.html`);
        if (!response.ok) throw new Error('頁面載入失敗');
        const html = await response.text();
        
        // 2. 將 HTML 注入內容區塊
        contentArea.innerHTML = html;

        // 3. 處理專屬的 JavaScript
        // 為了避免重複載入舊頁面的腳本發生衝突，先移除先前建立的 script 標籤
        const oldScript = document.getElementById('dynamic-page-script');
        if (oldScript) {
            oldScript.remove();
        }

        // 動態建立新的 script 標籤以執行該頁面的邏輯
        const script = document.createElement('script');
        script.id = 'dynamic-page-script';
        script.src = `pages/${pageName}/${pageName}.js`;
        document.body.appendChild(script);

    } catch (error) {
        contentArea.innerHTML = `<h2>發生錯誤</h2><p>${error.message}</p>`;
        console.error(error);
    }
}