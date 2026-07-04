document.addEventListener('DOMContentLoaded', () => {
    const menuLinks = document.querySelectorAll('#main-menu a');

    menuLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault(); // 防止預設跳轉

            // 移除所有選單的 active 狀態
            menuLinks.forEach(l => l.classList.remove('active'));
            
            // 為當前點擊的選單加上 active
            e.target.classList.add('active');

            // 取得 data-page 屬性並呼叫 app.js 中的載入函數
            const pageName = e.target.getAttribute('data-page');
            loadPage(pageName);
        });
    });
});