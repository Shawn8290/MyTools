document.addEventListener('DOMContentLoaded', () => {
    const menuLinks = document.querySelectorAll('#main-menu a');
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('sidebar');

    // 1. 選單按鈕點擊事件：切換展開/收摺狀態
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

            // 呼叫 app.js 中的載入函數
            const pageName = e.target.getAttribute('data-page');
            if (typeof loadPage === 'function') {
                loadPage(pageName);
            }

            // 【修改處】不管螢幕多大，只要點擊了任何一個功能，就自動將選單收起
            if (sidebar && sidebar.classList.contains('open')) {
                sidebar.classList.remove('open');
            }
        });
    });
});