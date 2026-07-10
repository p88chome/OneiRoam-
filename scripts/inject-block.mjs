// 把內容塞進 <!-- BUILD:NAME:START/END --> 之間；index.html 與 select.html 共用
export function injectBlock(html, name, content, { required = false, endIndent = '        ' } = {}) {
  const START = `<!-- BUILD:${name}:START -->`;
  const END = `<!-- BUILD:${name}:END -->`;
  const re = new RegExp(`${START}[\\s\\S]*?${END}`);
  if (!re.test(html)) {
    if (required) throw new Error(`BUILD:${name} markers not found`);
    console.warn(`BUILD:${name} markers not found — skipping`);
    return html;
  }
  return html.replace(re, `${START}\n${content}\n${endIndent}${END}`);
}
