// 초간단 정적 서버 (검증용)
import http from 'http';
import fs from 'fs';
import path from 'path';

const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css' };
http.createServer((req,res)=>{
  let p = req.url.split('?')[0];
  //  v6.190 스냅 저장 — 브라우저 창이 안 보이면 스크린샷을 못 찍는다(v6.182).
  //   페이지가 캔버스를 dataURL로 POST하면 파일로 떨궈 준다. 저장 위치: snap/<name>.png
  if (req.method === 'POST' && p === '/__snap'){
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', ()=>{
      try{
        const j = JSON.parse(body);
        const name = String(j.name||'snap').replace(/[^\w.-]/g,'_');
        const b64 = String(j.data||'').replace(/^data:image\/\w+;base64,/,'');
        fs.mkdirSync(path.join(process.cwd(),'snap'), { recursive:true });
        fs.writeFileSync(path.join(process.cwd(),'snap',name+'.png'), Buffer.from(b64,'base64'));
        res.writeHead(200, {'Content-Type':'text/plain'}); res.end('saved '+name);
      }catch(e){ res.writeHead(500); res.end(String(e)); }
    });
    return;
  }
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
