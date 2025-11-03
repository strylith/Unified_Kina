let bannerNode = null;

function closeBanner(){
  if(bannerNode){
    bannerNode.remove();
    bannerNode = null;
  }
}

export function showOAuthHelpBanner(){
  try{
    if(bannerNode) return;
    const isBrave = !!(navigator.brave && navigator.brave.isBrave) || /Brave\/|Brave/i.test(navigator.userAgent || '');
    const text = isBrave
      ? 'Login may be blocked by Brave Shields. Please allow Google domains or lower shields for this site and try again.'
      : 'Login may be blocked by a privacy extension. Please allow Google domains (accounts.google.com, *.googleusercontent.com) or temporarily disable blockers and try again.';

    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483647;display:flex;justify-content:center;pointer-events:none;';
    const banner = document.createElement('div');
    banner.style.cssText = 'max-width:720px;width:100%;background:#111;color:#fff;border-radius:12px;box-shadow:0 12px 28px rgba(0,0,0,.3);padding:14px 16px;display:flex;align-items:flex-start;gap:12px;pointer-events:auto;';
    banner.innerHTML = `
      <div style="font-size:20px;line-height:1">⚠️</div>
      <div style="flex:1;">
        <div style="font-weight:700;margin-bottom:4px;">We couldn’t start Google Sign‑In</div>
        <div style="opacity:.9;font-size:14px;">${text}</div>
      </div>
      <button aria-label="Close" style="background:transparent;border:0;color:#fff;font-size:18px;cursor:pointer;">×</button>
    `;
    const closeBtn = banner.querySelector('button');
    closeBtn.onclick = closeBanner;
    wrap.appendChild(banner);
    document.body.appendChild(wrap);
    bannerNode = wrap;
  }catch{}
}







