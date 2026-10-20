import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const failures=[];let scripts=0,assets=0;
function visit(directory){
  for(const item of fs.readdirSync(directory,{withFileTypes:true})){
    const filename=path.join(directory,item.name);
    if(item.isDirectory())visit(filename);
    else if(item.name.endsWith('.js')){
      try{new vm.Script(fs.readFileSync(filename,'utf8'),{filename});scripts++;}
      catch(error){failures.push(error.message);}
    }
  }
}
visit(path.join(root,'js'));
for(const match of html.matchAll(/<(?:script|link|img)\b[^>]*?\b(?:src|href)="([^"]+)"/gi)){
  const url=match[1];
  if(/^(?:https?:|data:|#|\/\/)/i.test(url))continue;
  if(!fs.existsSync(path.resolve(root,url)))failures.push('Missing asset: '+url);else assets++;
}
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}
else console.log(`OK: ${scripts} JavaScript files compile; ${assets} local HTML references exist.`);
