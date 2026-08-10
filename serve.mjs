// 초간단 정적 서버 (검증용)
import http from 'http';
import fs from 'fs';
import path from 'path';

const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css' };
http.createServer((req,res)=>{
  let p = req.url.split('?')[0];
  if (p==='/') p = '/index.html';
  const f = path.join(process.cwd(), p);
  try{
    const data = fs.readFileSync(f);
    res.writeHead(200, {'Content-Type': MIME[path.extname(f)]||'application/octet-stream'});
    res.end(data);
  }catch(e){
    res.writeHead(404); res.end('404');
  }
}).listen(8123, ()=>console.log('serving on http://localhost:8123'));
