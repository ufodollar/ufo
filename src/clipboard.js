// 复制到剪贴板。
// 老 WebView 里 navigator.clipboard 常常不存在（或只在 https 下可用），
// 所以必须留 execCommand 兜底 —— 这个站点的用户大量在手机浏览器里操作，
// 复制地址失败等于让他们手抄 42 个字符。
export async function copyText(text) {
  if (!text) return false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) { /* 落到兜底 */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-200px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) {
    return false;
  }
}
