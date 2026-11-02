import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const source=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
// LJ-CANDIDATE-PREVIEW-20261102: one selected distribution and isolated saves; only public package reads are cross-origin.
const output=path.resolve(process.env.LJ_DISTRIBUTION_ROOT||path.join(source,'.local/distribution-20261031')),root=path.join(output,'framework'),packs=path.join(output,'region-packs');
const user=path.resolve(process.env.LJ_PREVIEW_USER_ROOT||path.join(source,'.local/region-packs-20261031/preview-user'));
const port=Number(process.env.PORT||7132);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.gz':'application/gzip','.svg':'image/svg+xml','.png':'image/png'};
const validName=name=>/^living-japan[\w.-]*\.json(?:\.gz)?$/.test(name);
await fs.mkdir(user,{recursive:true});
http.createServer(async(req,res)=>{
 try {
  const url=new URL(req.url,'http://'+req.headers.host);
  const publicRead=url.pathname.startsWith('/region-packs/')&&['GET','HEAD','OPTIONS'].includes(req.method);
  const cors=publicRead?{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, HEAD, OPTIONS'}:{};
  const send=(body,type='application/json; charset=utf-8',status=200)=>{const bytes=Buffer.from(body);res.writeHead(status,{'Content-Type':type,'Content-Length':bytes.length,'Cache-Control':'no-store',...cors});res.end(req.method==='HEAD'?undefined:bytes);};
  if(publicRead&&req.method==='OPTIONS'){res.writeHead(204,cors);res.end();return;}
  if(req.method==='POST'&&['/api/files/upload','/api/files/delete'].includes(url.pathname)) {
   if(req.headers.origin&&req.headers.origin!==url.origin){send('隔离保存只接受当前预览页面','text/plain; charset=utf-8',403);return;}
   let size=0,parts=[];for await(const part of req){size+=part.length;if(size>32*1024*1024)throw Error('隔离文件超过32MiB');parts.push(part);}
   const input=JSON.parse(Buffer.concat(parts).toString('utf8'));
   const name=url.pathname.endsWith('/upload')?input.name:path.basename(input.path||'');
   if(!validName(name))throw Error('仅支持Living Japan隔离文件');
   const target=path.join(user,name);
   if(url.pathname.endsWith('/upload')){const temporary=target+'.tmp';await fs.writeFile(temporary,Buffer.from(input.data,'base64'));await fs.rename(temporary,target);send(JSON.stringify({path:'user/files/'+name}));}
   else {await fs.unlink(target).catch(error=>{if(error.code!=='ENOENT')throw error;});send('{}');}
   return;
  }
  if(url.pathname==='/data/region-pack-source.json'){send(JSON.stringify({schemaVersion:1,catalogUrl:'/region-packs/catalog.json'}));return;}
  let relative=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'preview.html';
  if(relative.split('/').some(part=>['..','.git','.local'].includes(part)))throw Error('无效预览路径');
  let target;
  if(relative==='preview.html')target=path.join(source,'scripts/package-preview.html');
  else if(relative==='scripts/preview-host.js')target=path.join(source,relative);
  else if(relative.startsWith('user/files/')) {const name=relative.slice(11);if(!validName(name))throw Error('无效隔离文件名');target=path.join(user,name);}
  else if(relative.startsWith('region-packs/'))target=path.join(packs,relative.slice(13));
  else target=path.join(root,relative);
  if(!['GET','HEAD'].includes(req.method)) {send('隔离预览不执行真实酒馆操作','text/plain; charset=utf-8',409);return;}
  send(await fs.readFile(target),types[path.extname(target)]||'application/octet-stream');
 }catch(error){res.writeHead(error.code==='ENOENT'?404:400,{'Content-Type':'text/plain; charset=utf-8'});res.end(error.code==='ENOENT'?'Not found':error.message);}
}).listen(port,'127.0.0.1',()=>console.log(`Package-only preview: http://127.0.0.1:${port}/preview.html`));
