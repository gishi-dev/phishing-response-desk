export const versions = {
  revised: 'B 修正版', initial: 'A 初版（比較用）',
  'teach-change': '教材：変更済みの一言', 'teach-route': '教材：確認の経路',
  'teach-notice': '教材：周知と返答', 'teach-operator': '教材：確認担当者の開封',
};
export const routes = ['既存の連絡先', '普段のブックマーク', 'メール内のリンク', 'メールに書かれた連絡先'];
export const operations = ['なし', '開いた', '入力した', '未記録'];
export const disclaimer = '記録上の対応状況で、安全や被害の有無を確かめた結果ではない';
export const personValid = v => /^E(?:0[1-9]|1[0-9]|20)$/.test(v);
export const dateValid = v => { if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T00:00:00Z');return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===v; };
export const timeValid = v => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) && dateValid(v.slice(0,10)) && +v.slice(11,13)<24 && +v.slice(14)<60;
export function guard(value) {
  const text = JSON.stringify(value).normalize('NFKC');
  if (text.length > 70000) throw Error('入力が長すぎます。必要な要点だけを記録してください。');
  // 日付・社員番号・例示用送信元を除き、秘密の値らしい並びを保存前に止める。
  const plain = text.replace(/\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?Z?)?)?/g, '').replace(/E(?:0[1-9]|1[0-9]|20)\b/g, '');
  if (/(?:パスワード|認証コード|カード番号|password|token|secret|api[_ -]?key)\s*[=:：]\s*[^\s、。"}]+/i.test(text) || /\d[\d -]{4,}\d/.test(plain) || /\b(?=[A-Za-z0-9_-]{8,}\b)(?=[A-Za-z0-9_-]*[A-Za-z])(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]+\b/.test(plain)) {
    throw Error('秘密の値らしい入力は保存できません。値を消し、操作の有無と確認の要点だけを書いてください。');
  }
  const withoutSender = text.replace(/[a-z]+@example\.(?:jp|invalid)/g, '');
  if (/(?:https?:|www\.|[A-Za-z0-9-]+\.(?:com|net|org|jp|invalid)\b|@)/i.test(withoutSender)) throw Error('外部の宛先やURLは記録できません。架空の確認先の役割名で書いてください。');
}
export function validateReport(x) {
  if (!x || typeof x !== 'object' || Array.isArray(x)) throw Error('報告はJSONオブジェクトで指定してください。');
  const allowed = ['id','receiver','summary','sender','receivedAt','note','operation'];
  if (Object.keys(x).some(k=>!allowed.includes(k))) throw Error('報告の項目が想定外です。入力形式を確認してください。');
  if (!/^M\d{2,3}$/.test(x.id) || !personValid(x.receiver)) throw Error('報告IDはMと2〜3桁、受信者はE01〜E20で指定してください。');
  if (typeof x.sender!=='string' || !/^[a-z]+@example\.(jp|invalid)$/.test(x.sender)) throw Error('送信元は英小文字の識別名と例示用ドメインだけにしてください。');
  if (x.receivedAt !== null && !timeValid(x.receivedAt)) throw Error('受信時刻の形式が正しくありません。空欄はnullにしてください。');
  if (x.operation !== null && !operations.includes(x.operation)) throw Error('操作は、なし・開いた・入力した・未記録、またはnullで指定してください。');
  for (const k of ['summary','note']) if (typeof x[k]!=='string' || !x[k].trim() || x[k].length>1500) throw Error('要約と報告メモを各1500文字以内で入力してください。');
  guard(x); return {...x, summary:x.summary.trim(), note:x.note.trim()};
}
export const reportInput = r => Object.fromEntries(['id','receiver','summary','sender','receivedAt','note','operation'].map(k=>[k,r[k]]));
export const context = (r,version) => ({version,revision:r.revision,report:reportInput(r)});
function matchingContext(value,r,version) {
  if(!value||typeof value!=='object'||Object.keys(value).sort().join()!=='report,revision,version'||value.version!==version||value.revision!==r.revision)return false;
  const expected=reportInput(r),p=value.report;
  return p&&typeof p==='object'&&Object.keys(p).sort().join()===Object.keys(expected).sort().join()&&Object.keys(expected).every(k=>p[k]===expected[k]);
}
export function validateCandidate(x,r,version) {
  if (!x || Object.keys(x).sort().join()!=='context,missing,notice,proposal' || !matchingContext(x.context,r,version)) throw Error('候補の入力・版・更新番号が現在と一致しません。現在の依頼JSONを使って整理し直してください。');
  if (!Array.isArray(x.missing) || x.missing.length>12 || x.missing.some(t=>typeof t!=='string'||!t.trim()||t.length>1500) || !['notice','proposal'].every(k=>typeof x[k]==='string'&&x[k].trim()&&x[k].length<=2000)) throw Error('候補はmissing（文の配列）、notice、proposal（文）を指定してください。');
  guard({missing:x.missing,notice:x.notice,proposal:x.proposal}); return x;
}
export function exposureNeeds(e) {
  const needs=[];
  if (!e.openedAt) needs.push('開いた時刻');
  if (!e.operationReview) needs.push('入力・ダウンロード・実行等の確認');
  if (!e.impactOwner) needs.push('影響を調べる担当');
  if (!e.contact) needs.push('関係先への連絡記録');
  if (e.operation==='入力した') {
    if (!e.change) needs.push('正規の経路での変更・使い回し先の確認');
    if (!e.login) needs.push('ログイン状態・連携・取引等の確認');
  }
  return needs;
}
export function blockers(r,c,candidate) {
  const result=[];
  if (!candidate) result.push('再整理待ち：現在の入力に合う候補がありません');
  if (!r.receivedAt || !r.operation || r.operation==='未記録') result.push('受信時刻または操作の有無が未記録');
  const last=c.confirmations.at(-1);
  if (!last) result.push('確認の経路・控え・確認担当が未記録');
  else if (!routes.slice(0,2).includes(last.route)) result.push('メール内の経路で確認：別経路での再確認が必要');
  for (const e of c.exposures) { const needs=exposureNeeds(e); if(needs.length) result.push(`${e.person}（${e.operation}）：${needs.join('、')}が未記録`); }
  return result;
}
export function state(r,c,candidate,version='revised') {
  if (version==='initial') return '記録上完了（比較用）';
  if (!candidate) return '再整理待ち';
  const last=c.confirmations.at(-1);
  if (last && !routes.slice(0,2).includes(last.route)) return '再確認待ち';
  if (c.exposures.some(e=>exposureNeeds(e).length)) return '事後対応待ち';
  if (!r.receivedAt || !r.operation || r.operation==='未記録') return '確認中';
  if (!last) return '報告受付';
  if (c.judgment?.completion==='記録上完了') return '記録上完了';
  return '別経路で確認済み';
}
export function parseReports(text) {
  if (text.length>60000) throw Error('貼り付けは60000文字以内にしてください。');
  if (text.trim().startsWith('[')) { const data=JSON.parse(text); if(!Array.isArray(data)||!data.length) throw Error('報告の配列を指定してください。'); return data.map(validateReport); }
  // 引用符・改行を含むCSVも1つのセルとして扱う。
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++) {const ch=text[i]; if(ch==='"') {if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;} else if(!quoted&&(ch===','||ch==='\n')){row.push(cell.replace(/\r$/,''));cell='';if(ch==='\n'){rows.push(row);row=[];}}else cell+=ch;}
  if(quoted) throw Error('CSVの引用符が閉じられていません。');
  if(cell||row.length){row.push(cell.replace(/\r$/,''));rows.push(row);}
  const header=rows.shift();
  if(header?.join()!=='id,receiver,summary,sender,receivedAt,note,operation') throw Error('CSVの見出しは id,receiver,summary,sender,receivedAt,note,operation の順にしてください。');
  return rows.filter(r=>r.some(Boolean)).map(row=>{if(row.length!==7)throw Error('CSVの列数を確認してください。');return validateReport(Object.fromEntries(header.map((k,i)=>[k,row[i]===''&&['receivedAt','operation'].includes(k)?null:row[i]])));});
}
