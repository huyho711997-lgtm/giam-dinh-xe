// Sao khối trình vẽ sơ đồ (giữa hai dấu SCENE-EDITOR trong index.html) sang trang độc lập so-do-hien-truong.html,
// để hai nơi luôn dùng cùng một giao diện. Chạy: npm run sync:scene-page   (thêm --check để chỉ kiểm tra, không ghi).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const BEGIN=/^[ \t]*<!-- SCENE-EDITOR:BEGIN[^\n]*-->\r?\n/m,END=/^[ \t]*<!-- SCENE-EDITOR:END -->/m;

export function extractSceneBlock(html,name){
  const begin=BEGIN.exec(html),end=END.exec(html);
  if(!begin||!end||end.index<begin.index)throw new Error(`${name}: thiếu cặp dấu SCENE-EDITOR:BEGIN/END`);
  return {start:begin.index+begin[0].length,stop:end.index,text:html.slice(begin.index+begin[0].length,end.index)};
}

// Đường dẫn → giá trị đầy đủ (kèm ?v=) của mọi script/css cục bộ trong index.html.
export function localAssetRefs(html){
  const refs=new Map();
  for(const match of html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)="([^"]+)"/gi)){
    if(/^(?:https?:|data:|#|\/\/)/i.test(match[1]))continue;
    const file=match[1].split(/[?#]/)[0];
    if(!refs.has(file))refs.set(file,match[1]);
  }
  return refs;
}

// Chép khối giao diện, rồi đưa số phiên bản ?v= của các file dùng chung trong trang độc lập về đúng bằng index.html
// (nếu không, sửa file vẽ mà quên đổi ?v= ở trang này thì trình duyệt vẫn dùng bản cũ trong bộ nhớ đệm).
export function syncScenePage(indexHtml,pageHtml){
  const source=extractSceneBlock(indexHtml,'index.html'),target=extractSceneBlock(pageHtml,'so-do-hien-truong.html');
  const merged=pageHtml.slice(0,target.start)+source.text+pageHtml.slice(target.stop),refs=localAssetRefs(indexHtml);
  return merged.replace(/\b(src|href)="([^"]+)"/g,(whole,attr,value)=>{
    if(/^(?:https?:|data:|#|\/\/)/i.test(value))return whole;
    const next=refs.get(value.split(/[?#]/)[0]);
    return next?`${attr}="${next}"`:whole;
  });
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const indexPath=path.join(root,'index.html'),pagePath=path.join(root,'so-do-hien-truong.html');
  const page=fs.readFileSync(pagePath,'utf8'),next=syncScenePage(fs.readFileSync(indexPath,'utf8'),page);
  if(process.argv.includes('--check')){
    if(next!==page){console.error('so-do-hien-truong.html lệch với index.html — chạy: npm run sync:scene-page');process.exitCode=1;}
    else console.log('OK: trang vẽ độc lập khớp với trình vẽ trong index.html.');
  }else{
    if(next===page)console.log('Không có thay đổi.');
    else{fs.writeFileSync(pagePath,next);console.log('Đã cập nhật so-do-hien-truong.html từ index.html.');}
  }
}
