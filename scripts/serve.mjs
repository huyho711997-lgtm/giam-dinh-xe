import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const port=Number(process.env.PORT || 4173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.json':'application/json; charset=utf-8'};
const server=http.createServer((request,response)=>{
  try {
    let pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
    if(pathname.endsWith('/'))pathname+='index.html';
    const filename=path.resolve(root,'.'+pathname);
    const relative=path.relative(root,filename);
    if(relative.startsWith('..') || path.isAbsolute(relative) || relative.split(path.sep).some(part=>part.startsWith('.'))) {
      response.writeHead(403).end('Forbidden');return;
    }
    const stat=fs.statSync(filename);
    if(!stat.isFile()){response.writeHead(404).end('Not found');return;}
    response.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-cache'});
    if(request.method==='HEAD')response.end();else fs.createReadStream(filename).pipe(response);
  }catch(error){response.writeHead(error.code==='ENOENT'?404:400).end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close());
