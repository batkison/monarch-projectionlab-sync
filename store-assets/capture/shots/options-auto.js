// Auto-drive the options page for the screenshot: load accounts, then select a pair
window.addEventListener("load", () => {
  setTimeout(() => document.getElementById("load-both-btn").click(), 200);
  const t = setInterval(() => {
    const assetPill = [...document.querySelectorAll('#pl-filter-pills .pill')].find(p => p.textContent === "Asset");
    const mItem  = document.querySelector('#m-list .acct-item[data-id="m6"]');
    if (assetPill && mItem) {
      clearInterval(t);
      assetPill.click();
      mItem.click();
      const t2 = setInterval(() => {
        const plItem = document.querySelector('#pl-list .acct-item[data-id="p6:amount"]');
        if (plItem) {
          clearInterval(t2);
          plItem.click();
          setTimeout(() => {
            const list = document.getElementById("m-list");
            const sel = list && list.querySelector(".sel-m");
            if (sel) list.scrollTop = sel.offsetTop - list.offsetTop - list.clientHeight / 2 + sel.clientHeight / 2;
            window.scrollTo(0, 0);
          }, 200);
        }
      }, 100);
    }
  }, 150);
});
