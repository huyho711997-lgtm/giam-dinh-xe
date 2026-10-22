import fs from 'node:fs';
import {fileURLToPath} from 'node:url';

const rootFolderId = '1uPf8jI8nOnl8KW9j4JRpnXSkfTswIxD5';
const types = {doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',pdf:'application/pdf',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg'};
const decode = text => text.replace(/&#(x[\da-f]+|\d+);|&(amp|quot|apos|lt|gt);/gi,(_match,numeric,named) => numeric ? String.fromCodePoint(parseInt(numeric.replace(/^x/i,''),/^x/i.test(numeric) ? 16 : 10)) : {amp:'&',quot:'"',apos:"'",lt:'<',gt:'>'}[named.toLowerCase()]);
const folders = {};
const queue = [{id:rootFolderId,name:'Biểu mẫu bồi thường Tasco'}];
while (queue.length) {
  if (Object.keys(folders).length >= 30) throw new Error('Kho có quá nhiều thư mục để đồng bộ tự động.');
  const folder = queue.shift();
  if (folders[folder.id]) continue;
  const response = await fetch('https://drive.google.com/embeddedfolderview?id=' + folder.id,{headers:{'Accept-Language':'en-US,en;q=0.9'},signal:AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error('Không đọc được thư mục ' + folder.name);
  const html = await response.text();
  if (!html.includes('flip-contents')) throw new Error('Thư mục chưa được chia sẻ công khai: ' + folder.name);
  const files = [];
  for (const match of html.matchAll(/<div class="flip-entry" id="entry-([\w-]+)"([\s\S]*?)(?=<div class="flip-entry"|<footer|$)/g)) {
    const fragment = match[2];
    const title = fragment.match(/class="flip-entry-title">([\s\S]*?)<\/div>/)?.[1];
    const link = fragment.match(/<a href="([^"]+)"/)?.[1];
    if (!title || !link) continue;
    const name = decode(title.replace(/<[^>]*>/g,''));
    const isFolder = link.includes('/drive/folders/');
    const mimeType = isFolder ? 'application/vnd.google-apps.folder' : types[name.split('.').pop().toLowerCase()] || 'application/octet-stream';
    const modified = fragment.match(/class="flip-entry-last-modified"><div>(\d+)\/(\d+)\/(\d+)<\/div>/);
    const file = {id:match[1],name,mimeType};
    if (modified) file.modifiedTime = new Date(Date.UTC(Number(modified[3]) + (modified[3].length === 2 ? 2000 : 0),Number(modified[1])-1,Number(modified[2]))).toISOString();
    files.push(file);
    if (isFolder) queue.push({id:file.id,name});
  }
  folders[folder.id] = {name:folder.name,files};
}
const catalog = {version:1,rootFolderId,folderName:'Biểu mẫu bồi thường Tasco',syncedAt:new Date().toISOString(),folders};
const json = JSON.stringify(catalog,null,2) + '\n';
if (process.argv.includes('--stdout')) process.stdout.write(json);
else {
  fs.writeFileSync(fileURLToPath(new URL('../js/data/shared-forms-drive.json',import.meta.url)),json);
  console.log('Đã đồng bộ ' + Object.values(folders).reduce((total,folder) => total + folder.files.length,0) + ' mục trong ' + Object.keys(folders).length + ' thư mục.');
}
