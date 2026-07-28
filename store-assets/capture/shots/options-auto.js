// Auto-drive the options page for the screenshot: load accounts, then select a pair
window.addEventListener("load", () => {
  setTimeout(() => document.getElementById("load-both-btn").click(), 200);
  const t = setInterval(() => {
    const mItem  = document.querySelector('#m-list .acct-item[data-id="m4"]');
    const plItem = document.querySelector('#pl-list .acct-item[data-id="p4:balance"]');
    if (mItem && plItem) {
      clearInterval(t);
      mItem.click();
      plItem.click();
    }
  }, 150);
});
