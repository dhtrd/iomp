// تمييز عدد العمليات (طلب المالك 2026-10-25: «3 عملية» ⇒ «3 عمليات»)
// ت١ الدالة nOp تعطي التمييز الصحيح · ت٢ لا يبقى نصّ «fmt(…)+' عملية» في المصدر ولا في queue-io.js
// ت٣ سطر سجلّ المزامنة يستعمل nOp · ت٤ nOp تصل إلى queue-io.js عبر السياق
import { readFileSync } from 'node:fs';
const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});

const SRC=readFileSync('index.html','utf8'), QIO=readFileSync('queue-io.js','utf8');
const fm=SRC.match(/function fmt\(n\)\{[^\n]*/), nm=SRC.match(/function nOp\(n\)\{[^\n]*\}/);
ok('ت١ الدالتان fmt وnOp موجودتان في الملف المختبَر', !!fm&&!!nm);
let nOp=null; try{ nOp=new Function((fm?fm[0]:'')+'\n'+(nm?nm[0]:'')+'\nreturn nOp;')(); }catch(e){ ok('ت١ تقييم nOp', false, String(e)); }
const cases={0:'0 عملية',1:'1 عملية',2:'2 عمليات',3:'3 عمليات',10:'10 عمليات',11:'11 عملية',99:'99 عملية',100:'100 عملية',103:'103 عمليات',110:'110 عمليات',111:'111 عملية',1500:'1,500 عملية'};
if(nOp) for(const [n,want] of Object.entries(cases)){ const got=nOp(+n); ok('ت١ nOp('+n+') = «'+want+'»', got===want, 'got='+got); }
ok('ت١ nOp تتسامح مع قيمة فارغة', nOp&&nOp(undefined)==='— عملية'||nOp&&nOp(null)==='— عملية', nOp&&nOp(undefined));

const bad=/fmt\([^)]*\)\s*\+\s*' عملية/;
ok('ت٢ لا «fmt(…)+\' عملية» في index.html', !bad.test(SRC));
ok('ت٢ لا «C.fmt(…)+\' عملية» في queue-io.js', !/C\.fmt\([^)]*\)\s*\+\s*' عملية/.test(QIO));
ok('ت٢ لا «n+\' عملية» الخام في سجلّ المزامنة', !/'مزامنة '\+n\+' عملية/.test(SRC));
ok('ت٣ سجلّ المزامنة: «مزامنة <nOp> دون اتصال»', /name:'مزامنة '\+nOp\(n\)\+' دون اتصال'/.test(SRC));
ok('ت٤ السياق يمرّر nOp إلى queue-io.js', /esc,fmt,nOp,fmtDT:fmtDateTimeAr/.test(SRC) && /C\.nOp\(/.test(QIO));
ok('ت٤ رقم نسخة queue-io.js رُفع إلى 4 (تجاوز التخزين المؤقّت)', /const QIO_V='4'/.test(SRC));

let pass=0; for(const r of results){ console.log((r.pass?'✓':'✗')+' '+r.n+(r.d&&!r.pass?('  << '+r.d):'')); if(r.pass)pass++; }
console.log(`\nRECON ${pass}/${results.length} ${pass===results.length?'passed':'FAILED'}`);
process.exit(pass===results.length?0:1);
