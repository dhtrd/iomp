// مشغّل حزمة اختبارات التطبيق الحي — يفشل عند أول ملف أحمر
import { execSync } from 'node:child_process';
const FILES=['test_account.mjs','test_assign.mjs','test_locdel.mjs','test_perms.mjs','test_rolelabels.mjs','test_roles.mjs','test_scope.mjs','test_shell.mjs','test_toast.mjs','test_dialogs_live.mjs','test_r3_lazy_prompt.mjs','test_r4_search_sort.mjs','test_trash.mjs','test_useredit.mjs'];
let total=0, passed=0, failed=[];
for(const f of FILES){
  try{
    const out=execSync(`node ${f}`,{encoding:'utf8',stdio:['ignore','pipe','pipe']});
    const m=out.match(/RECON (\d+)\/(\d+)/);
    if(m){ passed+=+m[1]; total+=+m[2]; console.log(`✓ ${f}: ${m[1]}/${m[2]}`); }
    else { failed.push(f); console.log(`✗ ${f}: لا RECON`); }
  }catch(e){
    const out=(e.stdout||'')+(e.stderr||'');
    const m=String(out).match(/RECON (\d+)\/(\d+)/);
    console.log(`✗ ${f}${m?`: ${m[1]}/${m[2]}`:''}`);
    console.log(String(out).split('\n').filter(l=>l.includes('✗')).join('\n'));
    failed.push(f);
  }
}
console.log(`\n===== TOTAL: ${passed}/${total} — ${failed.length?('FAILED: '+failed.join(', ')):'ALL GREEN ✓'} =====`);
process.exit(failed.length?1:0);
