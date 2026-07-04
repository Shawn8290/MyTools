document.addEventListener('DOMContentLoaded', () => {
    const menuLinks = document.querySelectorAll('#main-menu a');
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('sidebar');

    // 1. 手機版選單按鈕點擊事件：切換展開/收摺狀態
    if (mobileBtn && sidebar) {
        mobileBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }

    // 2. 綁定各個選單項目的點擊事件
    menuLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault(); 

            // 切換選取的視覺狀態
            menuLinks.forEach(l => l.classList.remove('active'));
            e.target.classList.add('active');

            // 呼叫 app.js 中的載入函數 (若您有將 loadPage 定義在其他檔案)
            const pageName = e.target.getAttribute('data-page');
            if (typeof loadPage === 'function') {
                loadPage(pageName);
            }

            // 【新增】如果是手機版螢幕，點擊選單後自動將選單收起，提升體驗
            if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
                sidebar.classList.remove('open');
            }
        });
    });
});