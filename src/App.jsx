import { useState, useEffect, useRef, useCallback } from "react";

const LS = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const DEF_ACTS = ["Futures & Commodities Trading","Equity Trading","Kite / Zerodha Platform","Personal","Trial Business – Venture A","Trial Business – Venture B","Trial Business – Venture C"];
const DEF_CATS = {
  "Futures & Commodities Trading":["Brokerage","STT","Exchange Charges","SEBI Fees","Stamp Duty","GST on Charges","Software/Tools","Data Feeds","Other"],
  "Equity Trading":["Brokerage","STT","Exchange Charges","SEBI Fees","Stamp Duty","GST on Charges","Software/Tools","Research Reports","Other"],
  "Kite / Zerodha Platform":["Brokerage","API Charges","Margin Interest","Ledger Charges","DP Charges","Other Platform Charges"],
  "Personal":["Food & Dining","Transport","Groceries","Entertainment","Healthcare","Clothing","Utilities","Rent","EMI","Shopping","Other"],
  "Trial Business – Venture A":["Marketing","Operations","Salaries","Rent","Utilities","Miscellaneous"],
  "Trial Business – Venture B":["Marketing","Operations","Salaries","Rent","Utilities","Miscellaneous"],
  "Trial Business – Venture C":["Marketing","Operations","Salaries","Rent","Utilities","Miscellaneous"],
};
const ACC_TYPES = [
  {key:"savings",label:"Savings Account",cls:"asset"},{key:"current",label:"Current Account",cls:"asset"},
  {key:"trading",label:"Trading Account",cls:"asset"},{key:"wallet",label:"Digital Wallet",cls:"asset"},
  {key:"investment",label:"Investment Account",cls:"asset"},{key:"realestate",label:"Real Estate",cls:"asset"},
  {key:"cash",label:"Cash",cls:"asset"},{key:"creditcard",label:"Credit Card",cls:"liability"},
  {key:"paylater",label:"Pay Later",cls:"liability"},{key:"loan",label:"Loan",cls:"liability"},
  {key:"borrowing",label:"Borrowing (Friends)",cls:"liability"},
];
const PAY_METHODS = ["UPI","Debit Card","Credit Card","Cash","Bank Transfer","NEFT/RTGS","Cheque","Pay Later","Wallet"];
const LEGACY_GMAIL_QUERY = 'subject:(receipt OR invoice OR "order confirmation" OR "payment confirmation" OR "amount debited" OR "transaction" OR "bill") newer_than:2d';
const GMAIL_QUERY = "in:anywhere";

// SMS forwarder apps send emails in predictable subject formats
// MacroDroid: "SMS from +91XXXXXXXXXX"  |  SMS Forwarder: "Fwd: SMS"  |  IFTTT: "New SMS received"
const SMS_GMAIL_QUERY = '(subject:"SMS from" OR subject:"Fwd: SMS" OR subject:"New SMS received" OR subject:"SMS Alert" OR from:smsforwarder OR subject:"Text message from") newer_than:2d';

// Well-known Indian bank/service sender IDs
const KNOWN_SENDERS = [
  {label:"HDFC Bank",      number:"HDFCBK",   type:"bank"},
  {label:"ICICI Bank",     number:"ICICIB",    type:"bank"},
  {label:"SBI",            number:"SBIINB",    type:"bank"},
  {label:"Axis Bank",      number:"AXISBK",    type:"bank"},
  {label:"Kotak Bank",     number:"KOTAKB",    type:"bank"},
  {label:"Yes Bank",       number:"YESBKL",    type:"bank"},
  {label:"IndusInd Bank",  number:"INDBNK",    type:"bank"},
  {label:"Paytm Bank",     number:"PAYTMB",    type:"bank"},
  {label:"Zerodha",        number:"ZERODHA",   type:"broker"},
  {label:"Groww",          number:"GROWWB",    type:"broker"},
  {label:"Upstox",         number:"UPSTOX",    type:"broker"},
  {label:"PhonePe",        number:"PHONEPE",   type:"upi"},
  {label:"Google Pay",     number:"GPAY",      type:"upi"},
  {label:"Amazon Pay",     number:"AMAZON",    type:"upi"},
  {label:"CRED",           number:"CREDCL",    type:"upi"},
  {label:"Swiggy",         number:"SWIGGY",    type:"merchant"},
  {label:"Zomato",         number:"ZOMATO",    type:"merchant"},
  {label:"Ola",            number:"OLACAN",    type:"merchant"},
  {label:"Uber",           number:"UBERIN",    type:"merchant"},
  {label:"Amazon",         number:"AMAZON",    type:"merchant"},
  {label:"Flipkart",       number:"FKRTIL",    type:"merchant"},
];

const gid   = () => Math.random().toString(36).slice(2,10);
const today = () => new Date().toISOString().slice(0,10);
const fmt   = n  => new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",minimumFractionDigits:0}).format(n||0);
const fmtD  = d  => d?new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}):"";
const fmtDT = d  => d?new Date(d).toLocaleString("en-IN",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}):"";
const amtClose=(a,b)=>Math.abs(a-b)<2;
const strSim=(a,b)=>{a=(a||"").toLowerCase();b=(b||"").toLowerCase();let m=0;for(let c of a)if(b.includes(c))m++;return m/Math.max(a.length,b.length,1);};
const LOCKED_OWNER_EMAIL = "akshaychouhan16803@gmail.com";
const DEFAULT_GOOGLE_CLIENT_ID = "975238186836-47bvtn56uhrlcbe11n1pe1h26qbor5s1.apps.googleusercontent.com";
const DEFAULT_MICROSOFT_CLIENT_ID = (import.meta.env.VITE_MICROSOFT_CLIENT_ID || "").trim();
const DEFAULT_AI_MODEL = "claude-sonnet-4-20250514";
const EMAIL_SYNC_CACHE_VERSION = "v5";

if(typeof window!=="undefined"){
  const h=window.location.hostname;
  const isLocal=h==="localhost"||h==="127.0.0.1";
  if(window.location.protocol==="http:"&&!isLocal){
    const target=`https://${window.location.host}${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.replace(target);
  }
}

function decodeGoogleCredential(credential=""){
  try{
    const payload=credential.split(".")[1]||"";
    const b64=payload.replace(/-/g,"+").replace(/_/g,"/");
    return JSON.parse(atob(b64));
  }catch{return null;}
}

function loadGoogleIdentityScript(){
  if(window.google?.accounts?.id)return Promise.resolve();
  const existing=document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
  if(existing)return new Promise((res,rej)=>{existing.addEventListener("load",res,{once:true});existing.addEventListener("error",()=>rej(new Error("Failed to load Google Identity Services")), {once:true});});
  return new Promise((res,rej)=>{
    const s=document.createElement("script");
    s.src="https://accounts.google.com/gsi/client";
    s.async=true;s.defer=true;
    s.onload=()=>res();
    s.onerror=()=>rej(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(s);
  });
}

function decodeB64(s){try{return decodeURIComponent(escape(atob(s.replace(/-/g,'+').replace(/_/g,'/'))));}catch{return "";}}
function decodeB64Binary(s){try{return atob((s||"").replace(/-/g,"+").replace(/_/g,"/"));}catch{return"";}}
function htmlToText(html=""){
  return (html||"")
    .replace(/<style[\s\S]*?<\/style>/gi," ")
    .replace(/<script[\s\S]*?<\/script>/gi," ")
    .replace(/<[^>]*>/g," ")
    .replace(/&nbsp;/gi," ")
    .replace(/&amp;/gi,"&")
    .replace(/&lt;/gi,"<")
    .replace(/&gt;/gi,">")
    .replace(/\s+/g," ")
    .trim();
}
function extractEmailTextAll(payload,d=0,out=[]){
  if(d>8||!payload)return out;
  const mime=(payload.mimeType||"").toLowerCase();
  const data=payload.body?.data?decodeB64(payload.body.data):"";
  if(data){
    if(mime.includes("html"))out.push(htmlToText(data));
    else out.push(data.replace(/\s+/g," ").trim());
  }
  if(Array.isArray(payload.parts))payload.parts.forEach(p=>extractEmailTextAll(p,d+1,out));
  return out;
}
function collapseTextParts(parts=[]){
  const seen=new Set();
  const merged=[];
  for(const p of parts){
    const t=(p||"").replace(/\s+/g," ").trim();
    if(!t||seen.has(t))continue;
    seen.add(t);
    merged.push(t);
  }
  return merged.join("\n");
}

function collectGmailAttachmentMeta(payload,out=[]){
  if(!payload)return out;
  const name=(payload.filename||"").trim();
  const attachmentId=payload?.body?.attachmentId||"";
  const size=Number(payload?.body?.size)||0;
  const mimeType=(payload.mimeType||"").toLowerCase();
  if(name&&attachmentId){
    out.push({name,attachmentId,size,mimeType});
  }
  if(Array.isArray(payload.parts))payload.parts.forEach(p=>collectGmailAttachmentMeta(p,out));
  return out;
}

const RECEIPT_KEYWORDS = [
  "invoice","tax invoice","receipt","payment receipt","payment confirmation",
  "payment successful","amount debited","amount credited","bill","cash memo",
  "order receipt","order invoice","refund","payout","settlement",
];
const TRANSACTION_ALERT_KEYWORDS = [
  "debited","credited","debit","credit","charges","charged","card","upi","imps",
  "neft","rtgs","transaction","spent","purchase","paid","received","withdrawn",
  "salary","refund",
];
const NON_FINANCIAL_EMAIL_KEYWORDS = [
  "security alert","security notice","verification code","otp","one-time password",
  "password","sign in","signin","login","2fa","two-factor","new device",
  "recover account","reset your password","welcome to","newsletter","digest",
  "policy update","privacy update",
];

function hasMoneyEvidence(text=""){
  const t=(text||"").replace(/[,]/g," ");
  return /((?:₹|rs\.?|inr|\$|usd|eur|gbp)\s*\d|\d\s*(?:usd|inr|eur|gbp)|\b(?:amount|amt|total|paid|payment|debited|credited|refund|payout|settlement|invoice total|grand total)\b[^0-9]{0,24}\d)/i.test(t);
}

function isReceiptLikeEmail({subject="",from="",body="",attachmentNames=[],attachmentText="",hasAttachment=false}={}){
  const text=`${subject}\n${from}\n${body}\n${attachmentText}`.toLowerCase();
  const attachmentNameText=(attachmentNames||[]).join(" ").toLowerCase();
  const hasReceiptKeyword=RECEIPT_KEYWORDS.some(k=>text.includes(k)||attachmentNameText.includes(k));
  const hasTxnAlertKeyword=TRANSACTION_ALERT_KEYWORDS.some(k=>text.includes(k));
  const senderLooksFinancial=/\b(bank|card|wallet|upi|finance|payments?)\b/.test((from||"").toLowerCase());
  const hasMoney=hasMoneyEvidence(text);
  const hasNonFinancialKeyword=NON_FINANCIAL_EMAIL_KEYWORDS.some(k=>text.includes(k));
  // If transaction evidence is strong, do not reject only because body contains words like "login".
  if(hasNonFinancialKeyword&&!hasReceiptKeyword&&!(hasTxnAlertKeyword&&hasMoney))return false;
  if(hasReceiptKeyword)return true;
  if(hasTxnAlertKeyword&&hasMoney&&(senderLooksFinancial||/\b(account|a\/c|acc|card)\b/.test(text)))return true;
  if(hasAttachment){
    // For mails with attachments, still require at least one transaction phrase in subject/body.
    return /\b(payment|paid|debited|credited|refund|invoice|receipt|bill|order|transaction|charges?)\b/i.test(text);
  }
  return false;
}

function sanitizeEmailTransactions(items=[],ctx={}){
  if(!Array.isArray(items)||!items.length)return[];
  const evidenceText=`${ctx.subject||""}\n${ctx.from||""}\n${ctx.body||""}\n${(ctx.attachmentNames||[]).join(" ")}\n${ctx.attachmentText||""}`;
  const strongReceipt=isReceiptLikeEmail(ctx);
  const hasMoney=hasMoneyEvidence(evidenceText);
  const hasTxnAlert=TRANSACTION_ALERT_KEYWORDS.some(k=>evidenceText.toLowerCase().includes(k));
  const normalized=items.map(x=>({
    ...x,
    type:x?.type==="income"?"income":"expense",
    amount:Number(x?.amount)||0,
  })).filter(x=>{
    if(!(x.amount>0))return false;
    if(Number.isInteger(x.amount)&&x.amount>=1900&&x.amount<=2100&&!/(₹|inr|rs\.?)/i.test(evidenceText))return false;
    return x.type==="income"||x.type==="expense";
  });
  if(!normalized.length)return[];
  if(ctx.aiCashFlow===true)return normalized;
  if(!(strongReceipt||(hasTxnAlert&&hasMoney)))return[];
  const hasReceiptContext=RECEIPT_KEYWORDS.some(k=>evidenceText.toLowerCase().includes(k));
  if(!hasMoney&&!(ctx.hasAttachment&&hasReceiptContext)&&!hasTxnAlert)return[];
  return normalized;
}

async function withTimeout(promise,ms,label="request"){
  let timer;
  try{
    return await Promise.race([
      promise,
      new Promise((_,rej)=>{timer=setTimeout(()=>rej(new Error(`${label} timed out after ${Math.ceil(ms/1000)}s`)),ms);}),
    ]);
  }finally{
    clearTimeout(timer);
  }
}

const RETRYABLE_HTTP_STATUS = new Set([408,409,425,429,500,502,503,504]);
const sleep = (ms)=>new Promise(res=>setTimeout(res,ms));

function parseRetryAfterMs(value){
  if(!value)return null;
  const n=Number(value);
  if(Number.isFinite(n)&&n>=0)return n*1000;
  const t=Date.parse(value);
  if(Number.isFinite(t))return Math.max(0,t-Date.now());
  return null;
}

function nextRetryDelay(attempt,retryAfterMs=null){
  if(Number.isFinite(retryAfterMs)&&retryAfterMs>0)return Math.min(retryAfterMs,15000);
  const backoff=Math.min(9000,500*(2**(attempt-1)));
  const jitter=Math.floor(Math.random()*350);
  return backoff+jitter;
}

function classifySyncError(err){
  const msg=String(err?.message||"").toLowerCase();
  const m=msg.match(/\b(4\d\d|5\d\d)\b/);
  const status=Number(err?.status||m?.[1]||0);
  if(status===401||status===403)return "auth";
  if(status===429)return "rate-limit";
  if(status>=500&&status<600)return "server";
  if(msg.includes("timed out"))return "timeout";
  if(msg.includes("network")||msg.includes("failed to fetch"))return "network";
  return status?`http-${status}`:"other";
}

function formatFailureSummary(reasons={}){
  const labels={auth:"auth", "rate-limit":"rate limit", server:"server", timeout:"timeout", network:"network", other:"other"};
  const top=Object.entries(reasons).sort((a,b)=>b[1]-a[1]).slice(0,3);
  if(!top.length)return "";
  return top.map(([k,v])=>`${labels[k]||k}: ${v}`).join(", ");
}

async function fetchJsonWithRetry(url,options={},label="Request",maxAttempts=4){
  let lastErr=null;
  for(let attempt=1;attempt<=maxAttempts;attempt++){
    try{
      const r=await fetch(url,options);
      if(r.ok)return await r.json();
      const body=await r.text();
      const err=new Error(`${label} ${r.status}${body?`: ${body.slice(0,180)}`:""}`);
      err.status=r.status;
      if(attempt<maxAttempts&&RETRYABLE_HTTP_STATUS.has(r.status)){
        await sleep(nextRetryDelay(attempt,parseRetryAfterMs(r.headers.get("retry-after"))));
        continue;
      }
      throw err;
    }catch(err){
      const msg=String(err?.message||"").toLowerCase();
      const retryableNetwork=msg.includes("failed to fetch")||msg.includes("network")||msg.includes("timed out");
      if(attempt<maxAttempts&&retryableNetwork){
        lastErr=err;
        await sleep(nextRetryDelay(attempt));
        continue;
      }
      throw err;
    }
  }
  throw lastErr||new Error(`${label} failed`);
}

function parseAmountFromText(text=""){
  const t=(text||"").replace(/[,]/g,"");
  const m1=t.match(/(?:inr|rs\.?|₹|\$|usd|eur|gbp)\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
  const m1b=t.match(/\b([0-9]+(?:\.[0-9]{1,2})?)\s*(?:usd|inr|eur|gbp)\b/i);
  const m2=t.match(/\b(?:amount|amt|paid|payment|debited|credited|refund|total|payout|settlement)\b[^0-9]{0,20}([0-9]{2,9}(?:\.[0-9]{1,2})?)/i);
  const m3=t.match(/\b([0-9]{1,6}\.[0-9]{2})\b/); // useful for receipt PDFs like 17.30
  const m=m1||m1b||m2||m3;
  if(!m)return 0;
  const n=Number(m[1]);
  return Number.isFinite(n)?n:0;
}

function fallbackExtractEmail(subject="",from="",body="",meta={}){
  const attachmentText=(meta?.attachmentText||"")+"";
  const attachmentNames=(meta?.attachmentNames||[]);
  const hasAttachment=Boolean(meta?.hasAttachment);
  const text=`${subject}\n${from}\n${body}\n${attachmentText}\n${attachmentNames.join(" ")}`.replace(/\s+/g," ").trim();
  const lower=text.toLowerCase();
  const amount=parseAmountFromText(text);
  if(amount<=0)return[];
  if(amount>1e7)return[];
  const explicitExpense=/\b(debited|charged|spent|withdrawn|purchase|paid|payment)\b/.test(lower);
  const explicitIncome=/\b(credited|received|refund|salary|payout|settlement|deposit)\b/.test(lower);
  if(!explicitExpense&&!explicitIncome&&!isReceiptLikeEmail({subject,from,body,attachmentText,attachmentNames,hasAttachment}))return[];
  if(!hasMoneyEvidence(text)&&!explicitExpense&&!explicitIncome)return[];
  const expenseHints=["debited","paid","payment","purchase","invoice","receipt","order","bill","spent","charged","upi"];
  const incomeHints=["credited","received","refund","salary","payout","settlement","deposit"];
  const hasExp=expenseHints.some(k=>lower.includes(k));
  const hasInc=incomeHints.some(k=>lower.includes(k));
  if(!hasExp&&!hasInc&&!explicitExpense&&!explicitIncome)return[];
  const type=(hasInc||explicitIncome)&&!(hasExp||explicitExpense)?"income":"expense";
  const em=(from.match(/([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i)?.[1]||"").toLowerCase();
  const vendor=(from||em||"email").replace(/\s+/g," ").trim().slice(0,120);
  return[{
    type,
    businessActivity:"Personal",
    category:"Other",
    isNewCategory:false,
    description:(subject||`${type==="income"?"Email income":"Email expense"}`).trim().slice(0,140),
    amount,
    date:today(),
    vendor,
    paymentMethod:"",
  }];
}

function buildJE(tx,accs=[]){
  const accName=id=>{const a=accs.find(x=>x.id===id);return a?.name||"";};
  const payAcc=()=>{if(tx.accountId){const n=accName(tx.accountId);if(n)return n;}return tx.paymentMethod==="Credit Card"?"Credit Card Payable":"Bank Account – Savings";};
  if(tx.type==="borrow"){
    const receivedIn=payAcc();
    const borrowedFrom=tx.liabilityAccountId?accName(tx.liabilityAccountId):(tx.borrowSource?`Borrowings – ${tx.borrowSource}`:"Borrowings – Other");
    return[{account:receivedIn||"Cash on Hand",dr:tx.amount,cr:0},{account:borrowedFrom||"Borrowings – Other",dr:0,cr:tx.amount}];
  }
  const eMap={"Futures & Commodities Trading":"Trading Expenses – Futures","Equity Trading":"Trading Expenses – Equity","Kite / Zerodha Platform":"Kite Platform Charges","Personal":"Personal Drawings"};
  const iMap={"Futures & Commodities Trading":"Trading Income – Futures","Equity Trading":"Trading Income – Equity"};
  if(tx.type==="expense"){const ea=tx.businessActivity==="Personal"?"Drawings Account":(eMap[tx.businessActivity]||`${tx.businessActivity} – Expenses`);return[{account:ea,dr:tx.amount,cr:0},{account:payAcc(),dr:0,cr:tx.amount}];}
  if(tx.type==="income"){const ia=iMap[tx.businessActivity]||`${tx.businessActivity} – Income`;return[{account:payAcc(),dr:tx.amount,cr:0},{account:ia,dr:0,cr:tx.amount}];}
  return[];
}

async function callAI(messages,max_tokens=800){
  const cfg=LS.get("ledger_ai_cfg",{endpoint:"",secret:"",model:DEFAULT_AI_MODEL});
  const endpoint=(cfg.endpoint||"").trim();
  const secret=(cfg.secret||"").trim();
  const model=(cfg.model||DEFAULT_AI_MODEL).trim()||DEFAULT_AI_MODEL;
  if(!endpoint)throw new Error("AI backend not configured. Open Settings → AI Backend and set endpoint.");
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),25000);
  try{
    const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json",...(secret?{"x-ledgerai-key":secret}:{})},body:JSON.stringify({model,max_tokens,messages}),signal:ctrl.signal});
    const txt=await r.text();
    let d={};
    try{d=JSON.parse(txt||"{}");}catch{}
    if(!r.ok){
      const msg=d?.error?.message||d?.message||txt?.slice?.(0,180)||`HTTP ${r.status}`;
      throw new Error(`AI ${r.status}: ${msg}`);
    }
    return d.text||d.output||d.content?.[0]?.text||d.result?.content?.[0]?.text||"";
  }catch(e){
    if(e?.name==="AbortError")throw new Error("AI request timed out");
    throw e;
  }finally{
    clearTimeout(timer);
  }
}
async function aiClassify(text,acts,cats,type="expense"){
  const c=Object.entries(cats).map(([a,cs])=>`${a}: ${cs.join(", ")}`).join("\n");
  try{
    const raw=await callAI([{role:"user",content:`Classify this ${type} for Indian trader.\nText: "${text.slice(0,800)}"\nActivities: ${acts.join(", ")}\nCategories:\n${c}\nReturn ONLY JSON: {"businessActivity":"","category":"","isNewCategory":false,"description":"","amount":null,"date":"YYYY-MM-DD","vendor":"","paymentMethod":""}`}]);
    try{return JSON.parse(raw.replace(/```json|```/g,"").trim());}catch{return {};}
  }catch{return {};}
}
async function aiExtractBatch(text,acts,cats){
  const c=Object.entries(cats).map(([a,cs])=>`${a}: ${cs.join(", ")}`).join("\n");
  try{
    const raw=await callAI([{role:"user",content:`Extract ALL financial transactions from text. Indian context.\nText:\n${text.slice(0,3000)}\nActivities: ${acts.join(", ")}\nCategories:\n${c}\nReturn ONLY JSON array: [{"type":"expense|income","businessActivity":"","category":"","isNewCategory":false,"description":"","amount":0,"date":"YYYY-MM-DD","vendor":"","paymentMethod":""}]`}],1400);
    try{const a=JSON.parse(raw.replace(/```json|```/g,"").trim());return Array.isArray(a)?a:[];}catch{return[];}
  }catch{return[];}
}
async function aiExtractEmail(subject,from,body,acts,cats,meta={}){
  const c=Object.entries(cats).map(([a,cs])=>`${a}: ${cs.join(", ")}`).join("\n");
  const attachmentNames=(meta.attachmentNames||[]).slice(0,10).join(", ");
  const attachmentText=clipTextForAI((meta.attachmentText||"")+"",14000);
  const emailBody=clipTextForAI((body||"")+"",14000);
  const hasAttachment=meta.hasAttachment?"yes":"no";
  try{
    const raw=await callAI([{role:"user",content:`Extract ONLY real completed financial transactions from this email (Indian context).
Strict rules:
1) Read COMPLETE provided email body and COMPLETE provided attachment text and detect transactions from either source.
2) Return [] unless there is clear receipt/invoice/payment/debit/credit evidence.
2) Ignore security/login/OTP/verification/newsletter alerts.
3) Do NOT guess amounts from years, OTPs, IDs, order numbers, or ticket numbers.
4) If amount is not clearly present, return [].

Subject: "${subject}"
From: "${from}"
Has attachment: ${hasAttachment}
Attachment names: "${attachmentNames}"
Body:
${emailBody}
Attachment extracted text (if any):
${attachmentText}

Activities: ${acts.join(", ")}
Categories:
${c}

Return ONLY JSON array:
[{"type":"expense|income","businessActivity":"","category":"","isNewCategory":false,"description":"","amount":0,"date":"YYYY-MM-DD","vendor":"","paymentMethod":""}]`}],1300);
    try{const a=JSON.parse(raw.replace(/```json|```/g,"").trim());return Array.isArray(a)?a:[];}catch{return[];}
  }catch{return[];}
}

async function aiAnalyzeEmail(subject,from,body,acts,cats,meta={}){
  const c=Object.entries(cats).map(([a,cs])=>`${a}: ${cs.join(", ")}`).join("\n");
  const attachmentNames=(meta.attachmentNames||[]).slice(0,12).join(", ");
  const attachmentText=clipTextForAI((meta.attachmentText||"")+"",14000);
  const emailBody=clipTextForAI((body||"")+"",14000);
  const hasAttachment=meta.hasAttachment?"yes":"no";
  const raw=await callAI([{role:"user",content:`You are a cashflow extraction engine for bookkeeping.
Analyze this ENTIRE email body and ENTIRE attachment text.
Goal:
1) Decide if this email contains real cash inflow/outflow transaction evidence.
2) If yes, extract all transactions with amount, type, date, vendor, category.

Rules:
- Consider BOTH body and attachment text.
- Bank alerts with debited/credited + amount are valid transactions.
- Ignore newsletters, OTP, login/security notifications unless they clearly include a transaction.
- Do not use years/IDs/OTP/order IDs as amounts.
- If no valid transaction evidence, return isCashFlow=false and transactions=[].

Subject: "${subject}"
From: "${from}"
Has attachment: ${hasAttachment}
Attachment names: "${attachmentNames}"
Body:
${emailBody}
Attachment text:
${attachmentText}

Activities: ${acts.join(", ")}
Categories:
${c}

Return ONLY JSON:
{
  "isCashFlow": true/false,
  "confidence": 0.0,
  "reason": "",
  "transactions": [
    {"type":"expense|income","businessActivity":"","category":"","isNewCategory":false,"description":"","amount":0,"date":"YYYY-MM-DD","vendor":"","paymentMethod":""}
  ]
}`}],1600);
  try{
    const obj=JSON.parse(raw.replace(/```json|```/g,"").trim());
    const tx=Array.isArray(obj?.transactions)?obj.transactions:[];
    return{
      isCashFlow:Boolean(obj?.isCashFlow),
      confidence:Number(obj?.confidence)||0,
      reason:String(obj?.reason||""),
      transactions:tx,
    };
  }catch{
    return{isCashFlow:false,confidence:0,reason:"parse_failed",transactions:[]};
  }
}
async function aiParseStatement(text,name,type){
  try{
    const raw=await callAI([{role:"user",content:`Parse bank/card statement. Account: ${name} (${type}).\n${text.slice(0,5000)}\nReturn ONLY JSON array: [{"date":"YYYY-MM-DD","description":"","amount":0,"type":"debit|credit","reference":"","balance":null}]`}],1500);
    try{const a=JSON.parse(raw.replace(/```json|```/g,"").trim());return Array.isArray(a)?a:[];}catch{return[];}
  }catch{return[];}
}
async function aiSummarize(txns){
  try{
    return await callAI([{role:"user",content:`Summarize today's transactions for Indian trader. Brief, insightful, flag anomalies.\n${JSON.stringify(txns.slice(0,20))}\n3-5 bullet points.`}]);
  }catch{
    return "AI summary unavailable right now. Configure AI backend in Settings or try again later.";
  }
}

// ── ONEDRIVE / MICROSOFT GRAPH HELPERS ────────────────────────────────────────
const GRAPH = "https://graph.microsoft.com/v1.0";
const OD_FILE = "LedgerAI/ledgerai-data.json";         // saved at OneDrive root/LedgerAI/
const OD_SCOPES = ["Files.ReadWrite", "User.Read"];
const MS_MAIL_SCOPES = ["Mail.Read", "User.Read"];
const MSAL_CDN = "https://alcdn.msauth.net/browser/2.38.2/js/msal-browser.min.js";

let _msalApp = null;
let _msalClientId = null;

async function loadMsal() {
  if (window.msal) return;
  await new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = MSAL_CDN;
    s.onload = res; s.onerror = () => rej(new Error("Failed to load MSAL"));
    document.head.appendChild(s);
  });
}

async function getMsal(clientId) {
  await loadMsal();
  if (!_msalApp || _msalClientId !== clientId) {
    _msalApp = new window.msal.PublicClientApplication({
      auth: { clientId, authority: "https://login.microsoftonline.com/common", redirectUri: window.location.origin },
      cache: { cacheLocation: "localStorage", storeAuthStateInCookie: false },
    });
    await _msalApp.initialize();
    _msalClientId = clientId;
  }
  return _msalApp;
}

async function odLogin(clientId) {
  const msal = await getMsal(clientId);
  const result = await msal.loginPopup({ scopes: OD_SCOPES });
  return result.account;
}

async function odGetToken(clientId) {
  const msal = await getMsal(clientId);
  const accounts = msal.getAllAccounts();
  if (!accounts.length) throw new Error("Not signed in to Microsoft");
  try {
    const r = await msal.acquireTokenSilent({ scopes: OD_SCOPES, account: accounts[0] });
    return r.accessToken;
  } catch {
    const r = await msal.acquireTokenPopup({ scopes: OD_SCOPES, account: accounts[0] });
    return r.accessToken;
  }
}

async function odGetProfile(clientId) {
  const token = await odGetToken(clientId);
  const r = await fetch(`${GRAPH}/me`, { headers: { Authorization: `Bearer ${token}` } });
  return r.json();
}

async function msGetProfileByToken(token){
  const r=await fetch(`${GRAPH}/me`,{headers:{Authorization:`Bearer ${token}`}});
  if(!r.ok)throw new Error(`Microsoft profile ${r.status}`);
  return r.json();
}

function pickMsAccount(msal,accountHint){
  const all=msal.getAllAccounts();
  if(accountHint?.homeAccountId){
    const byId=all.find(a=>a.homeAccountId===accountHint.homeAccountId);
    if(byId)return byId;
  }
  if(accountHint?.username){
    const u=(accountHint.username||"").toLowerCase();
    const byUser=all.find(a=>(a.username||"").toLowerCase()===u);
    if(byUser)return byUser;
  }
  return all[0]||null;
}

async function msLoginMail(clientId){
  const msal=await getMsal(clientId);
  const login=await msal.loginPopup({scopes:MS_MAIL_SCOPES,prompt:"select_account"});
  const account=login.account||pickMsAccount(msal,{});
  if(!account)throw new Error("Microsoft account not found after login");
  try{
    const tok=await msal.acquireTokenSilent({scopes:MS_MAIL_SCOPES,account});
    return{account,accessToken:tok.accessToken};
  }catch{
    const tok=await msal.acquireTokenPopup({scopes:MS_MAIL_SCOPES,account});
    return{account,accessToken:tok.accessToken};
  }
}

async function msGetMailToken(clientId,accountHint){
  const msal=await getMsal(clientId);
  const account=pickMsAccount(msal,accountHint);
  if(!account)throw new Error("Not signed in to Microsoft");
  try{
    const tok=await msal.acquireTokenSilent({scopes:MS_MAIL_SCOPES,account});
    return{account,accessToken:tok.accessToken};
  }catch{
    const tok=await msal.acquireTokenPopup({scopes:MS_MAIL_SCOPES,account,prompt:"select_account"});
    return{account,accessToken:tok.accessToken};
  }
}

async function odSave(clientId, data) {
  const token = await odGetToken(clientId);
  const body = JSON.stringify({ ...data, savedAt: new Date().toISOString(), version: 4 }, null, 2);
  const r = await fetch(`${GRAPH}/me/drive/root:/${OD_FILE}:/content`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body,
  });
  if (!r.ok) { const e = await r.text(); throw new Error(`OneDrive save failed: ${r.status} ${e}`); }
  return r.json();
}

async function odLoad(clientId) {
  const token = await odGetToken(clientId);
  const r = await fetch(`${GRAPH}/me/drive/root:/${OD_FILE}:/content`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`OneDrive load failed: ${r.status}`);
  return r.json();
}

async function odListVersions(clientId) {
  const token = await odGetToken(clientId);
  const r = await fetch(`${GRAPH}/me/drive/root:/${OD_FILE}:/versions?$top=10`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return [];
  const d = await r.json();
  return d.value || [];
}

async function odSignOut(clientId) {
  const msal = await getMsal(clientId);
  const accounts = msal.getAllAccounts();
  if (accounts.length) await msal.logoutPopup({ account: accounts[0] });
  _msalApp = null; _msalClientId = null;
}

async function gmailFetch(url,token,label="Gmail"){
  return fetchJsonWithRetry(url,{headers:{Authorization:`Bearer ${token}`}},label,4);
}
async function gmailListMessages(token,query,max=20){
  const target=Math.max(1,Math.min(Number(max)||20,50000));
  let pageToken="";const all=[];
  while(all.length<target){
    const pageSize=Math.min(500,target-all.length);
    const url=`https://www.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${pageSize}${pageToken?`&pageToken=${encodeURIComponent(pageToken)}`:""}`;
    const d=await gmailFetch(url,token,"Gmail list");
    if(d.messages?.length)all.push(...d.messages);
    if(!d.nextPageToken)break;
    pageToken=d.nextPageToken;
  }
  return all;
}
async function gmailGetMessageMetadata(token,id){
  return gmailFetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,token,"Gmail message metadata");
}
async function gmailGetMessage(token,id){
  try{
    return await gmailFetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,token,"Gmail message full");
  }catch(err){
    // Fallback keeps sync moving for oversized/problematic messages.
    const meta=await gmailGetMessageMetadata(token,id);
    return {...meta,__lite:true};
  }
}
async function gmailGetProfile(token){return gmailFetch("https://www.googleapis.com/gmail/v1/users/me/profile",token,"Gmail profile");}
async function gmailGetAttachment(token,msgId,attachmentId){
  return gmailFetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${msgId}/attachments/${attachmentId}`,token,"Gmail attachment");
}
function extractReadableAttachmentText(rawBinary=""){
  return (rawBinary||"").replace(/[^\x20-\x7E\r\n]+/g," ");
}
function extractAttachmentMoneyHints(text=""){
  const src=(text||"").replace(/\s+/g," ");
  const re=/((?:₹|rs\.?|inr|\$|usd|eur|gbp)\s*[0-9]+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?\s*(?:usd|inr|eur|gbp))/ig;
  const out=[];let m;
  while((m=re.exec(src))&&out.length<8){
    const v=(m[1]||"").trim();
    if(v&&!out.includes(v))out.push(v);
  }
  return out.join(", ");
}
function extractPdfLikeText(binary=""){
  const ascii=extractReadableAttachmentText(binary);
  // Pull likely string literals from PDF streams: ( ... )
  const literals=[];
  const re=/\(([^()]{2,240})\)/g;
  let m;
  while((m=re.exec(binary))&&literals.length<400){
    const t=(m[1]||"").replace(/\\[nrtbf()\\]/g," ").replace(/\s+/g," ").trim();
    if(t)literals.push(t);
  }
  const joined=[ascii,...literals].join(" ");
  return joined.replace(/\s+/g," ").trim();
}
function extractAttachmentTextByType(binary="",mimeType="",name=""){
  const mt=(mimeType||"").toLowerCase();
  const nm=(name||"").toLowerCase();
  if(mt.startsWith("text/")||mt.includes("json")||mt.includes("xml")||mt.includes("csv")||mt.includes("html")||/\.(txt|csv|json|xml|html?|md|log)$/i.test(nm)){
    return extractReadableAttachmentText(binary).replace(/\s+/g," ").trim();
  }
  if(mt.includes("pdf")||nm.endsWith(".pdf")){
    return extractPdfLikeText(binary);
  }
  return extractReadableAttachmentText(binary).replace(/\s+/g," ").trim();
}
function clipTextForAI(text="",max=12000){
  const src=(text||"").replace(/\s+/g," ").trim();
  if(src.length<=max)return src;
  const keyRe=/(₹|rs\.?|inr|\$|usd|eur|gbp|invoice|receipt|debited|credited|payment|amount|total|refund|payout|settlement|upi|card|account)/ig;
  const windows=[];let m;
  while((m=keyRe.exec(src))&&windows.length<16){
    const i=m.index||0;
    const from=Math.max(0,i-120);
    const to=Math.min(src.length,i+240);
    windows.push(src.slice(from,to));
  }
  const focused=windows.join(" ... ").replace(/\s+/g," ").trim();
  if(focused.length>=Math.min(max,4000))return focused.slice(0,max);
  const head=src.slice(0,Math.floor(max*0.45));
  const tail=src.slice(-Math.floor(max*0.45));
  return `${head} ... ${focused} ... ${tail}`.slice(0,max);
}
async function gmailAttachmentEvidenceText(token,msgId,attachments=[]){
  if(!Array.isArray(attachments)||!attachments.length)return "";
  let totalBytes=0;
  const keep=attachments
    .filter(a=>a?.attachmentId&&(a.size||0)<=8_000_000)
    .filter(a=>{
      if(totalBytes>12_000_000)return false;
      totalBytes+=(a.size||0);
      return true;
    })
    .slice(0,8);
  if(!keep.length)return "";
  const chunks=[];
  for(const a of keep){
    try{
      const payload=await withTimeout(gmailGetAttachment(token,msgId,a.attachmentId),18000,`Attachment ${a.name||a.attachmentId}`);
      const binary=decodeB64Binary(payload?.data||"");
      const compact=extractAttachmentTextByType(binary,a.mimeType,a.name);
      const hints=extractAttachmentMoneyHints(compact);
      const sample=clipTextForAI(compact,9000);
      if(sample)chunks.push(`[${a.name}] ${hints?`Amount hints: ${hints}. `:""}${sample}`);
    }catch(e){
      console.warn("Attachment read skipped",a?.name||a?.attachmentId,e);
    }
  }
  return chunks.join("\n");
}
function initOAuth(clientId,cb){
  if(!window.google?.accounts?.oauth2){cb(new Error("Google Identity Services not loaded"),null);return;}
  window.google.accounts.oauth2.initTokenClient({client_id:clientId,scope:"https://www.googleapis.com/auth/gmail.readonly",callback:(r)=>{if(r.error)cb(new Error(r.error),null);else cb(null,r.access_token);}}).requestAccessToken({prompt:"consent"});
}

async function msGraphFetch(url,token,extraHeaders={}){
  return fetchJsonWithRetry(url,{headers:{Authorization:`Bearer ${token}`,...extraHeaders}},"Microsoft Mail",4);
}

async function msListMessages(token,max=100,fromDate=""){
  const target=Math.max(1,Math.min(Number(max)||100,50000));
  const params=new URLSearchParams({
    "$top":String(Math.min(50,target)),
    "$select":"id,subject,from,receivedDateTime,hasAttachments",
    "$orderby":"receivedDateTime desc",
  });
  if(fromDate)params.set("$filter",`receivedDateTime ge ${fromDate}T00:00:00Z`);
  let next=`${GRAPH}/me/messages?${params.toString()}`;
  const all=[];
  while(next&&all.length<target){
    const d=await msGraphFetch(next,token);
    if(Array.isArray(d.value)&&d.value.length)all.push(...d.value);
    next=d["@odata.nextLink"]||"";
  }
  return all.slice(0,target);
}

async function msGetMessage(token,id){
  const url=`${GRAPH}/me/messages/${id}?$select=id,subject,from,receivedDateTime,body,bodyPreview,hasAttachments`;
  return msGraphFetch(url,token,{Prefer:'outlook.body-content-type="text"'});
}

function msExtractBody(msg){
  const txt=(msg?.body?.content||msg?.bodyPreview||"")+"";
  return txt.replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
}

function hydrateEmailAccount(acc={}){
  const query=((acc.syncQuery||"")+"").trim();
  const provider=((acc.provider||"google")+"").toLowerCase()==="microsoft"?"microsoft":"google";
  return{
    ...acc,
    provider,
    syncQuery:provider==="google"?(!query||query===LEGACY_GMAIL_QUERY?GMAIL_QUERY:query):query,
    maxEmails:Math.max(1,Math.min(Number(acc.maxEmails)||100,5000)),
    autoPost:acc.autoPost!==false,
    connected:Boolean(acc.connected),
    firstSyncCompleted:Boolean(acc.firstSyncCompleted),
    syncFromDate:(acc.syncFromDate||"")+"",
    msClientId:(acc.msClientId||"")+"",
    msAccountId:(acc.msAccountId||"")+"",
    msUsername:(acc.msUsername||"")+"",
  };
}

export default function App(){
  const[authCfg,setAuthCfg]=useState(()=>{
    const saved=LS.get("ledger_auth_cfg",{enabled:true,googleClientId:"",ownerEmail:""});
    const emailCfg=LS.get("ledger_emails",[]);
    const fallbackClientId=emailCfg.find(a=>a.clientId)?.clientId||"";
    return{
      enabled:true,
      googleClientId:DEFAULT_GOOGLE_CLIENT_ID||saved.googleClientId||fallbackClientId,
      ownerEmail:LOCKED_OWNER_EMAIL,
    };
  });
  const[authUser,setAuthUser]=useState(()=>LS.get("ledger_auth_user",null));
  const[authBypass,setAuthBypass]=useState(()=>LS.get("ledger_auth_bypass",false));
  const[authMsg,setAuthMsg]=useState("");
  const[tab,setTab]=useState("dashboard");
  const[txns,setTxns]=useState(()=>LS.get("ledger_txns",[]));
  const[acts,setActs]=useState(()=>LS.get("ledger_acts",DEF_ACTS));
  const[cats,setCats]=useState(()=>LS.get("ledger_cats",DEF_CATS));
  const[accs,setAccs]=useState(()=>LS.get("ledger_accs",[]));
  const[inbox,setInbox]=useState(()=>LS.get("ledger_inbox",[]));
  const[emails,setEmails]=useState(()=>LS.get("ledger_emails",[]).map(a=>({...hydrateEmailAccount(a),token:undefined})));
  const[smsNums,setSmsNums]=useState(()=>LS.get("ledger_sms",[]));
  const[sbCfg,setSbCfg]=useState(()=>{
    const saved=LS.get("ledger_odcfg",{clientId:"",email:"",name:"",enabled:false}); // reusing name for compat
    return{...saved,clientId:(saved.clientId||DEFAULT_MICROSOFT_CLIENT_ID||"").trim()};
  });
  const setSbCfgAlias=v=>setSbCfg(typeof v==="function"?v:v);
  const[syncStatus,setSyncStatus]=useState("idle"); // idle|syncing|ok|error
  const[lastSync,setLastSync]=useState(()=>LS.get("ledger_lastsync",""));
  const syncTimer=useRef(null);
  const[showAdd,setShowAdd]=useState(false);
  const[addType,setAddType]=useState("expense");
  const[editTx,setEditTx]=useState(null);
  const[summary,setSummary]=useState("");
  const[sumLoad,setSumLoad]=useState(false);
  const[filter,setFilter]=useState({activity:"All",type:"All",from:"",to:""});
  const bypassActive=Boolean(authCfg.enabled&&authBypass);

  const onGoogleCredential=useCallback((resp)=>{
    const payload=decodeGoogleCredential(resp?.credential||"");
    if(!payload?.email){setAuthMsg("Google login failed. Please try again.");return;}
    const email=(payload.email||"").toLowerCase();
    const owner=LOCKED_OWNER_EMAIL.toLowerCase();
    if(owner!==email){setAuthMsg(`Access denied. This dashboard is locked to ${LOCKED_OWNER_EMAIL}.`);return;}
    setAuthCfg(p=>({...p,ownerEmail:LOCKED_OWNER_EMAIL}));
    setAuthUser({email:payload.email,name:payload.name||payload.email,picture:payload.picture||"",lastLoginAt:new Date().toISOString()});
    setAuthBypass(false);
    setAuthMsg("");
  },[]);

  const signOut=()=>{
    setAuthUser(null);
    try{window.google?.accounts?.id?.disableAutoSelect();}catch{}
  };

  // ── localStorage mirrors ─────────────────────────────────────────────────
  useEffect(()=>LS.set("ledger_auth_cfg",authCfg),[authCfg]);
  useEffect(()=>LS.set("ledger_auth_bypass",authBypass),[authBypass]);
  useEffect(()=>{
    try{
      if(authUser)localStorage.setItem("ledger_auth_user",JSON.stringify(authUser));
      else localStorage.removeItem("ledger_auth_user");
    }catch{}
  },[authUser]);
  useEffect(()=>LS.set("ledger_txns",txns),[txns]);
  useEffect(()=>LS.set("ledger_acts",acts),[acts]);
  useEffect(()=>LS.set("ledger_cats",cats),[cats]);
  useEffect(()=>LS.set("ledger_accs",accs),[accs]);
  useEffect(()=>LS.set("ledger_inbox",inbox),[inbox]);
  useEffect(()=>LS.set("ledger_emails",emails.map(a=>({...a,token:undefined}))),[emails]);
  useEffect(()=>LS.set("ledger_sms",smsNums),[smsNums]);
  useEffect(()=>LS.set("ledger_odcfg",sbCfg),[sbCfg]);
  useEffect(()=>LS.set("ledger_lastsync",lastSync),[lastSync]);

  useEffect(()=>{
    const owner=LOCKED_OWNER_EMAIL.toLowerCase();
    const current=(authUser?.email||"").toLowerCase();
    if(owner&&current&&owner!==current)setAuthUser(null);
  },[authUser]);
  useEffect(()=>{
    if(authCfg.ownerEmail!==LOCKED_OWNER_EMAIL)setAuthCfg(p=>({...p,ownerEmail:LOCKED_OWNER_EMAIL}));
  },[authCfg.ownerEmail]);

  // ── OneDrive sync helpers ────────────────────────────────────────────────
  const pushToCloud=useCallback(async(state={})=>{
    if(!sbCfg.enabled||!sbCfg.clientId)return;
    setSyncStatus("syncing");
    try{
      const payload={
        txns:state.txns??txns,
        inbox:state.inbox??inbox,
        accs:state.accs??accs,
        acts:state.acts??acts,
        cats:state.cats??cats,
        smsNums:state.smsNums??smsNums,
        emails:(state.emails??emails).map(a=>({...a,token:undefined})),
      };
      await odSave(sbCfg.clientId,payload);
      const ts=new Date().toISOString();
      setLastSync(ts);setSyncStatus("ok");
      setTimeout(()=>setSyncStatus("idle"),3000);
    }catch(e){
      console.error("OneDrive sync error",e);
      setSyncStatus("error");
      // If token expired, mark as needing reconnect
      if(e.message.includes("Not signed in")||e.message.includes("401"))
        setSbCfg(p=>({...p,enabled:false,needsReconnect:true}));
    }
  },[sbCfg,txns,inbox,accs,acts,cats,smsNums,emails]);

  const debouncedSync=useCallback((state={})=>{
    if(!sbCfg.enabled)return;
    if(syncTimer.current)clearTimeout(syncTimer.current);
    syncTimer.current=setTimeout(()=>pushToCloud(state),3000);
  },[sbCfg.enabled,pushToCloud]);

  const loadFromCloud=useCallback(async()=>{
    if(!sbCfg.clientId)return;
    setSyncStatus("syncing");
    try{
      const d=await odLoad(sbCfg.clientId);
      if(!d){setSyncStatus("idle");return;}
      if(d.txns)setTxns(d.txns);
      if(d.inbox)setInbox(d.inbox);
      if(d.accs)setAccs(d.accs);
      if(d.acts)setActs(d.acts);
      if(d.cats)setCats(d.cats);
      if(d.smsNums)setSmsNums(d.smsNums);
      if(d.emails)setEmails(d.emails.map(a=>({...hydrateEmailAccount(a),token:undefined})));
      setLastSync(new Date().toISOString());setSyncStatus("ok");
      setTimeout(()=>setSyncStatus("idle"),3000);
    }catch(e){
      console.error("OneDrive load error",e);
      setSyncStatus("error");
    }
  },[sbCfg]);

  // Auto-load from cloud on first mount if configured
  useEffect(()=>{
    if(sbCfg.enabled&&sbCfg.url&&sbCfg.key)loadFromCloud();
  // eslint-disable-next-line
  },[]);

  // Auto-sync when data changes
  useEffect(()=>{debouncedSync({txns});},[txns]);
  useEffect(()=>{debouncedSync({inbox});},[inbox]);
  useEffect(()=>{debouncedSync({accs});},[accs]);
  useEffect(()=>{debouncedSync({acts,cats});},[acts,cats]);

  const ensureCat=(act,cat)=>setCats(p=>({...p,[act]:(p[act]||[]).includes(cat)?p[act]:[...(p[act]||[]),cat]}));
  const saveTx=useCallback((tx)=>{
    if(tx.isNewCategory)ensureCat(tx.businessActivity,tx.category);
    const accName=tx.accountId?accs.find(a=>a.id===tx.accountId)?.name||"":tx.accountName||"";
    const liabName=tx.liabilityAccountId?accs.find(a=>a.id===tx.liabilityAccountId)?.name||"":tx.liabilityAccountName||"";
    const je=buildJE(tx,accs);const full={...tx,accountName:accName,liabilityAccountName:liabName,journalEntries:je};
    if(tx.id&&txns.find(t=>t.id===tx.id))setTxns(p=>p.map(t=>t.id===tx.id?full:t));
    else setTxns(p=>[{...full,id:gid(),createdAt:new Date().toISOString()},...p]);
    setShowAdd(false);setEditTx(null);
  },[txns,accs]);
  const delTx=id=>setTxns(p=>p.filter(t=>t.id!==id));
  const addInbox=items=>setInbox(p=>[...items.map(i=>({...i,_iid:gid(),_ts:Date.now()})),...p]);
  const autoPostTxns=useCallback((items=[])=>{
    const valid=items.filter(i=>i?.amount>0&&(i.type==="expense"||i.type==="income"));
    if(!valid.length)return 0;
    const addByAct={};
    valid.forEach(i=>{
      if(i.isNewCategory&&i.businessActivity&&i.category){
        if(!addByAct[i.businessActivity])addByAct[i.businessActivity]=new Set();
        addByAct[i.businessActivity].add(i.category);
      }
    });
    if(Object.keys(addByAct).length){
      setCats(prev=>{
        const next={...prev};
        Object.entries(addByAct).forEach(([act,set])=>{
          const existing=new Set(next[act]||[]);
          set.forEach(c=>existing.add(c));
          next[act]=[...existing];
        });
        return next;
      });
    }
    const prepared=valid.map(item=>{
      const tx={...item,id:gid(),createdAt:new Date().toISOString(),source:item.source||"email"};
      const accName=tx.accountId?accs.find(a=>a.id===tx.accountId)?.name||"":tx.accountName||"";
      const liabName=tx.liabilityAccountId?accs.find(a=>a.id===tx.liabilityAccountId)?.name||"":tx.liabilityAccountName||"";
      return {...tx,accountName:accName,liabilityAccountName:liabName,journalEntries:buildJE(tx,accs)};
    });
    setTxns(prev=>[...prepared,...prev]);
    return prepared.length;
  },[accs]);
  const approveInbox=item=>{
    if(item.isNewCategory)ensureCat(item.businessActivity,item.category);
    const tx={...item,id:gid(),createdAt:new Date().toISOString(),source:item.source||"auto"};
    const accName=tx.accountId?accs.find(a=>a.id===tx.accountId)?.name||"":tx.accountName||"";
    const liabName=tx.liabilityAccountId?accs.find(a=>a.id===tx.liabilityAccountId)?.name||"":tx.liabilityAccountName||"";
    setTxns(p=>[{...tx,accountName:accName,liabilityAccountName:liabName,journalEntries:buildJE(tx,accs)},...p]);
    setInbox(p=>p.filter(i=>i._iid!==item._iid));
  };
  const editInbox=item=>{setEditTx({...item,id:undefined});setAddType(item.type||"expense");setShowAdd(true);setInbox(p=>p.filter(i=>i._iid!==item._iid));};
  const discardInbox=iid=>setInbox(p=>p.filter(i=>i._iid!==iid));

  const todayTxns=txns.filter(t=>t.date===today());
  const totInc=txns.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0);
  const totExp=txns.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
  const todInc=todayTxns.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0);
  const todExp=todayTxns.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
  const byAct=acts.map(a=>({a,inc:txns.filter(t=>t.businessActivity===a&&t.type==="income").reduce((s,t)=>s+t.amount,0),exp:txns.filter(t=>t.businessActivity===a&&t.type==="expense").reduce((s,t)=>s+t.amount,0)}));
  const filtered=txns.filter(t=>{
    if(filter.activity!=="All"&&t.businessActivity!==filter.activity)return false;
    if(filter.type!=="All"&&t.type!==filter.type)return false;
    if(filter.from&&t.date<filter.from)return false;
    if(filter.to&&t.date>filter.to)return false;
    return true;
  });
  const TABS=[["dashboard","Dashboard"],["transactions","Ledger"],["inbox",`Inbox${inbox.length?` (${inbox.length})`:""}`],["email",`Email${emails.length?` (${emails.length})`:""}`],["messages",`Messages${smsNums.length?` (${smsNums.filter(s=>s.active).length}✓)`:""}`],["journal","Journal"],["accounts","Accounts"],["reports","Reports"],["settings","Settings"],["daily","Day Review"]];

  if(authCfg.enabled&&!authCfg.googleClientId){
    return <AuthSetupScreen authCfg={authCfg} setAuthCfg={setAuthCfg}/>;
  }
  if(authCfg.enabled&&!authUser&&!bypassActive){
    return <AuthLoginScreen clientId={authCfg.googleClientId} ownerEmail={LOCKED_OWNER_EMAIL} onCredential={onGoogleCredential} authMsg={authMsg} allowTemporaryBypass onBypass={()=>setAuthBypass(true)}/>;
  }

  return(
    <div style={{fontFamily:"'DM Sans',sans-serif",background:"#07090f",minHeight:"100vh",color:"#e2e8f0"}}>
      <style>{CSS}</style>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>
      <script src="https://accounts.google.com/gsi/client" async defer/>
      <nav>
        <div className="logo">⬡ LedgerAI</div>
        {TABS.map(([k,l])=><div key={k} className={`ni${tab===k?" a":""}`} onClick={()=>setTab(k)}>{l}</div>)}
        <div style={{flex:1}}/>
        {/* Cloud sync status pill */}
        <div onClick={()=>setTab("cloud")} style={{cursor:"pointer",padding:"4px 10px",borderRadius:8,fontSize:11,fontWeight:600,marginRight:8,border:"1px solid",
          borderColor:syncStatus==="ok"?"#34d399":syncStatus==="syncing"?"#818cf8":syncStatus==="error"?"#f87171":"#1e293b",
          color:syncStatus==="ok"?"#34d399":syncStatus==="syncing"?"#818cf8":syncStatus==="error"?"#f87171":"#475569",
          background:syncStatus==="ok"?"#052e16":syncStatus==="syncing"?"#0d0d2b":syncStatus==="error"?"#450a0a":"transparent",
          display:"flex",alignItems:"center",gap:5,whiteSpace:"nowrap"}}>
          {syncStatus==="syncing"&&<span style={{animation:"spin 1s linear infinite",display:"inline-block"}}>⟳</span>}
          {syncStatus==="ok"&&"☁ Saved"}
          {syncStatus==="idle"&&(sbCfg.enabled?"☁ Cloud":"⚠ Local only")}
          {syncStatus==="error"&&"☁ Sync error"}
        </div>
        {bypassActive&&<div style={{marginRight:8,fontSize:11,color:"#fbbf24",whiteSpace:"nowrap"}}>⚠ Auth bypass active (HTTP)</div>}
        {bypassActive&&<button className="btn sm ghost" style={{marginRight:6}} onClick={()=>setAuthBypass(false)}>Re-enable lock</button>}
        {authCfg.enabled&&authUser&&<div style={{marginRight:8,fontSize:11,color:"#94a3b8",whiteSpace:"nowrap",maxWidth:220,overflow:"hidden",textOverflow:"ellipsis"}} title={authUser.email}>👤 {authUser.email}</div>}
        {authCfg.enabled&&authUser&&<button className="btn sm ghost" style={{marginRight:6}} onClick={signOut}>Sign out</button>}
        <button className="btn sm ghost" style={{marginRight:6}} onClick={()=>{setAddType("income");setEditTx(null);setShowAdd(true);}}>+ Income</button>
        <button className="btn sm pri" onClick={()=>{setAddType("expense");setEditTx(null);setShowAdd(true);}}>+ Expense</button>
        <button className="btn sm" style={{marginLeft:6,background:"#f59e0b",color:"#fff"}} onClick={()=>{setAddType("borrow");setEditTx(null);setShowAdd(true);}}>+ Borrowed</button>
      </nav>
      <div className="wrap">
        {tab==="dashboard"&&<DashTab byAct={byAct} totInc={totInc} totExp={totExp} todInc={todInc} todExp={todExp} txns={txns} todayTxns={todayTxns} inbox={inbox} emails={emails} onEdit={tx=>{setEditTx(tx);setAddType(tx.type);setShowAdd(true);}} onDelete={delTx}/>}
        {tab==="transactions"&&<LedgerTab txns={filtered} filter={filter} setFilter={setFilter} acts={acts} onEdit={tx=>{setEditTx(tx);setAddType(tx.type);setShowAdd(true);}} onDelete={delTx}/>}
        {tab==="inbox"&&<InboxTab inbox={inbox} addInbox={addInbox} acts={acts} cats={cats} onApprove={approveInbox} onEdit={editInbox} onDiscard={discardInbox}/>}
        <div style={{display:tab==="email"?"block":"none"}} aria-hidden={tab!=="email"}>
          <EmailTab emails={emails} setEmails={setEmails} inbox={inbox} addInbox={addInbox} autoPostTxns={autoPostTxns} acts={acts} cats={cats} defaultGoogleClientId={authCfg.googleClientId||DEFAULT_GOOGLE_CLIENT_ID} defaultMicrosoftClientId={sbCfg.clientId||DEFAULT_MICROSOFT_CLIENT_ID||""}/>
        </div>
        {tab==="messages"&&<MessagesTab smsNums={smsNums} setSmsNums={setSmsNums} emails={emails} inbox={inbox} addInbox={addInbox} acts={acts} cats={cats}/>}
        {tab==="journal"&&<JournalTab txns={txns}/>}
        {tab==="accounts"&&<AccountsTab accs={accs} setAccs={setAccs} txns={txns} addInbox={addInbox} acts={acts} cats={cats}/>}
        {tab==="reports"&&<ReportsTab txns={txns} acts={acts} totInc={totInc} totExp={totExp}/>}
        {tab==="settings"&&<SettingsTab acts={acts} setActs={setActs} cats={cats} setCats={setCats}/>}
        {tab==="cloud"&&<CloudTab sbCfg={sbCfg} setSbCfg={setSbCfg} syncStatus={syncStatus} lastSync={lastSync} onSync={pushToCloud} onLoad={loadFromCloud} txns={txns} setTxns={setTxns} inbox={inbox} setInbox={setInbox} accs={accs} setAccs={setAccs} acts={acts} setActs={setActs} cats={cats} setCats={setCats} smsNums={smsNums} setSmsNums={setSmsNums} emails={emails} setEmails={setEmails}/>}
        {tab==="daily"&&<DailyTab todayTxns={todayTxns} todInc={todInc} todExp={todExp} summary={summary} sumLoad={sumLoad} getSummary={async()=>{setSumLoad(true);setSummary(await aiSummarize(todayTxns));setSumLoad(false);}} onEdit={tx=>{setEditTx(tx);setAddType(tx.type);setShowAdd(true);}} onDelete={delTx} inbox={inbox}/>}
      </div>
      {showAdd&&<AddModal type={addType} existing={editTx} acts={acts} cats={cats} accs={accs} onSave={saveTx} onClose={()=>{setShowAdd(false);setEditTx(null);}}/>}
    </div>
  );
}

function AuthSetupScreen({authCfg,setAuthCfg}){
  const[clientId,setClientId]=useState(authCfg.googleClientId||"");
  const origin=typeof window!=="undefined"?window.location.origin:"http://accounts.niprasha.com";
  const httpsOrigin=origin.startsWith("http://")?origin.replace("http://","https://"):origin;
  return(
    <div style={{fontFamily:"'DM Sans',sans-serif",background:"#07090f",minHeight:"100vh",color:"#e2e8f0",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <style>{CSS}</style>
      <div className="modal" style={{maxWidth:560}}>
        <div style={{fontSize:18,fontWeight:700,marginBottom:10}}>Secure Access Setup</div>
        <div style={{fontSize:13,color:"#64748b",lineHeight:1.8,marginBottom:12}}>
          This dashboard is locked behind Google sign-in. Enter your Google Web Client ID once.
        </div>
        <div style={{background:"#0d0d2b",border:"1px solid #6366f1",borderRadius:8,padding:"10px 12px",fontSize:12,color:"#c7d2fe",marginBottom:10,lineHeight:1.8}}>
          Add this to your Google OAuth Authorized JavaScript origins:
          <br/><code style={{background:"#0a0c12",padding:"2px 6px",borderRadius:4}}>{origin}</code>
          {httpsOrigin!==origin&&<><br/>Also add:<br/><code style={{background:"#0a0c12",padding:"2px 6px",borderRadius:4}}>{httpsOrigin}</code></>}
        </div>
        <label>Google Client ID</label>
        <input value={clientId} onChange={e=>setClientId(e.target.value)} placeholder="xxxxxxxxxxxx-xxxx.apps.googleusercontent.com"/>
        <div style={{fontSize:11,color:"#64748b",marginTop:10}}>Allowed owner is locked to <b>{LOCKED_OWNER_EMAIL}</b>.</div>
        <button className="btn pri" style={{marginTop:14,width:"100%"}} onClick={()=>{
          if(!clientId.trim())return alert("Enter Google Client ID");
          setAuthCfg({enabled:true,googleClientId:clientId.trim(),ownerEmail:LOCKED_OWNER_EMAIL});
        }}>Save & Continue</button>
      </div>
    </div>
  );
}

function AuthLoginScreen({clientId,ownerEmail,onCredential,authMsg,allowTemporaryBypass=false,onBypass=()=>{}}){
  const btnRef=useRef(null);
  const[loading,setLoading]=useState(true);
  const[loginErr,setLoginErr]=useState("");

  useEffect(()=>{
    let alive=true;
    const mount=async()=>{
      if(!alive)return;
      setLoginErr("");
      if(!clientId){
        setLoginErr("Google Client ID is missing.");
        setLoading(false);
        return;
      }
      const isLocalhost=window.location.hostname==="localhost"||window.location.hostname==="127.0.0.1";
      const isHttps=window.location.protocol==="https:";
      if(!isHttps&&!isLocalhost){
        setLoginErr("Google Sign-In needs HTTPS on custom domains. Open this app on HTTPS after certificate activation.");
        setLoading(false);
        return;
      }
      try{
        await loadGoogleIdentityScript();
        if(!window.google?.accounts?.id)throw new Error("Google Identity Services not available.");
        window.google.accounts.id.initialize({
          client_id:clientId,
          callback:onCredential,
          auto_select:true,
          cancel_on_tap_outside:false,
          login_hint:ownerEmail||LOCKED_OWNER_EMAIL,
        });
        if(btnRef.current){
          btnRef.current.innerHTML="";
          window.google.accounts.id.renderButton(btnRef.current,{
            theme:"filled_blue",
            size:"large",
            shape:"pill",
            text:"continue_with",
            width:320,
          });
        }
        window.google.accounts.id.prompt();
      }catch(e){
        setLoginErr(e.message||"Unable to start Google Sign-In.");
      }
      setLoading(false);
    };
    if(clientId)mount();
    return()=>{alive=false;};
  },[clientId,onCredential,ownerEmail]);

  return(
    <div style={{fontFamily:"'DM Sans',sans-serif",background:"#07090f",minHeight:"100vh",color:"#e2e8f0",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <style>{CSS}</style>
      <div className="modal" style={{maxWidth:560}}>
        <div style={{fontSize:18,fontWeight:700,marginBottom:10}}>Sign in to LedgerAI</div>
        <div style={{fontSize:13,color:"#64748b",marginBottom:10}}>
          {ownerEmail?`Only ${ownerEmail} can access this dashboard.`:"Sign in with your Google account to claim owner access."}
        </div>
        <div style={{display:"flex",justifyContent:"center",padding:"10px 0 14px"}}>
          {loading?<div style={{fontSize:12,color:"#64748b"}}>Loading Google sign-in…</div>:<div ref={btnRef}/>}
        </div>
        {authMsg&&<div style={{background:"#450a0a",border:"1px solid #f87171",borderRadius:8,padding:"8px 10px",fontSize:12,color:"#fca5a5",marginBottom:10}}>{authMsg}</div>}
        {loginErr&&<div style={{background:"#1a1a2e",border:"1px solid #818cf8",borderRadius:8,padding:"10px 12px",fontSize:12,color:"#c7d2fe"}}>{loginErr}</div>}
        {allowTemporaryBypass&&(
          <div style={{marginTop:10}}>
            <button className="btn ghost" style={{width:"100%"}} onClick={onBypass}>Continue temporarily without login</button>
            <div style={{fontSize:11,color:"#64748b",marginTop:8,lineHeight:1.5}}>
              Temporary mode for testing. Use "Re-enable lock" from the top bar when ready.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── MESSAGES / SMS TAB ────────────────────────────────────────────────────────
function MessagesTab({smsNums,setSmsNums,emails,inbox,addInbox,acts,cats}){
  const[method,setMethod]=useState("android"); // android | ios | ifttt
  const[showAdd,setShowAdd]=useState(false);
  const[showGuide,setShowGuide]=useState(null); // "android"|"ios"|"ifttt"|null
  const[testText,setTestText]=useState("");
  const[testLoad,setTestLoad]=useState(false);

  const activeSims = [...new Set(smsNums.filter(s=>s.sim).map(s=>s.sim))];
  const linkedEmails = emails.filter(e=>e.connected);
  const smsInbox = inbox.filter(i=>i.source==="sms");

  // Build the Gmail query extension for SMS-forwarded messages, filtered by registered numbers
  const buildSmsQuery = (emailAccId) => {
    const nums = smsNums.filter(s=>s.active && (s.linkedEmailId===emailAccId||!s.linkedEmailId));
    if(!nums.length) return SMS_GMAIL_QUERY;
    const numParts = nums.map(s=>s.number).join(" OR ");
    return `(${SMS_GMAIL_QUERY}) (${numParts})`;
  };

  const testSingle = async()=>{
    if(!testText.trim())return;
    setTestLoad(true);
    const items = await aiExtractBatch(testText, acts, cats);
    if(items.length){
      addInbox(items.map(i=>({...i,type:i.type||"expense",source:"sms",smsText:testText})));
      alert(`✓ Extracted ${items.length} transaction(s) — check Inbox.`);
    } else {
      alert("No financial transactions found in this message.");
    }
    setTestText("");setTestLoad(false);
  };

  const typeColor={bank:"#3b82f6",broker:"#8b5cf6",upi:"#10b981",merchant:"#f59e0b",other:"#64748b"};

  return(
    <div>
      <R style={{marginBottom:4}}>
        <h2 className="h2" style={{flex:1}}>Messages / SMS Integration</h2>
        <div style={{display:"flex",gap:8}}>
          <button className="btn sm ghost" onClick={()=>setShowGuide("overview")}>📖 How it Works</button>
          <button className="btn sm suc" onClick={()=>setShowAdd(true)}>+ Add Number</button>
        </div>
      </R>
      <p style={{fontSize:13,color:"#64748b",marginBottom:20}}>
        Your browser cannot directly read SMS (OS security restriction). Instead, a free forwarder app on your phone silently emails every transaction SMS to your connected Gmail — which LedgerAI then picks up automatically on the next sync.
        {smsInbox>0&&<span style={{color:"#f59e0b",marginLeft:8}}>⏳ {smsInbox} SMS-sourced items in Inbox.</span>}
      </p>

      {/* Status banner */}
      {smsNums.length>0 && linkedEmails.length>0 && (
        <div style={{background:"#052e16",border:"1px solid #34d399",borderRadius:10,padding:"12px 16px",marginBottom:20,fontSize:13,color:"#86efac",display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
          <span>✅</span>
          <span><b>{smsNums.filter(s=>s.active).length}</b> numbers active · forwarding to <b>{linkedEmails.length}</b> Gmail account(s) · SMS picked up on next Email Sync</span>
          <button className="btn sm" style={{background:"#064e3b",color:"#34d399",marginLeft:"auto"}} onClick={()=>setShowGuide("test")}>🧪 Test a Message</button>
        </div>
      )}

      {/* Method selector + quick guides */}
      <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        {[["android","🤖 Android"],["ios","🍎 iOS"],["ifttt","⚡ IFTTT / Automation"]].map(([k,l])=>(
          <button key={k} className={`btn ${method===k?"pri":"ghost"}`} style={{fontSize:13}} onClick={()=>setMethod(k)}>{l}</button>
        ))}
      </div>

      {/* Method guides inline */}
      {method==="android" && <AndroidGuide emails={linkedEmails} smsNums={smsNums}/>}
      {method==="ios"     && <IosGuide     emails={linkedEmails} smsNums={smsNums}/>}
      {method==="ifttt"   && <IftttGuide   emails={linkedEmails} smsNums={smsNums}/>}

      {/* Registered numbers */}
      <div style={{marginTop:28}}>
        <R style={{marginBottom:12}}>
          <div className="sh">Registered Numbers & Sender IDs ({smsNums.length})</div>
          <button className="btn sm ghost" onClick={()=>{
            // Bulk add known Indian bank senders
            const existing=new Set(smsNums.map(s=>s.number));
            const toAdd=KNOWN_SENDERS.filter(s=>!existing.has(s.number)).map(s=>({...s,id:gid(),sim:"SIM 1",linkedEmailId:linkedEmails[0]?.id||"",active:true}));
            setSmsNums(p=>[...p,...toAdd]);
          }}>⚡ Add All Indian Banks</button>
        </R>

        {smsNums.length===0 && (
          <div className="card" style={{textAlign:"center",padding:40,color:"#475569"}}>
            <div style={{fontSize:32,marginBottom:10}}>📱</div>
            <div style={{fontSize:14,fontWeight:500,marginBottom:8}}>No numbers added yet</div>
            <div style={{fontSize:13,marginBottom:16}}>Add your bank sender IDs, broker numbers, UPI apps and merchant numbers to monitor.</div>
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              <button className="btn ghost" onClick={()=>{const toAdd=KNOWN_SENDERS.slice(0,8).map(s=>({...s,id:gid(),sim:"SIM 1",linkedEmailId:linkedEmails[0]?.id||"",active:true}));setSmsNums(p=>[...p,...toAdd]);}}>⚡ Add Common Banks</button>
              <button className="btn pri" onClick={()=>setShowAdd(true)}>+ Add Custom Number</button>
            </div>
          </div>
        )}

        {/* Group by SIM */}
        {activeSims.length>0 ? activeSims.map(sim=>(
          <div key={sim} style={{marginBottom:20}}>
            <div style={{fontSize:12,color:"#818cf8",fontWeight:700,marginBottom:8,display:"flex",alignItems:"center",gap:8}}>
              <span>📶 {sim}</span>
              <span style={{fontSize:11,color:"#475569",fontWeight:400}}>— {smsNums.filter(s=>s.sim===sim).length} numbers</span>
            </div>
            <SmsNumList nums={smsNums.filter(s=>s.sim===sim)} emails={emails} setSmsNums={setSmsNums} typeColor={typeColor}/>
          </div>
        )) : smsNums.length>0 && <SmsNumList nums={smsNums} emails={emails} setSmsNums={setSmsNums} typeColor={typeColor}/>}
      </div>

      {/* Gmail query preview */}
      {smsNums.some(s=>s.active) && linkedEmails.length>0 && (
        <div className="card" style={{marginTop:16,background:"#0a0c12"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#475569",marginBottom:10,textTransform:"uppercase",letterSpacing:".5px"}}>Auto-Generated Gmail Search Queries (used during Email Sync)</div>
          {linkedEmails.map(ea=>(
            <div key={ea.id} style={{marginBottom:10}}>
              <div style={{fontSize:12,color:"#94a3b8",marginBottom:4}}>📧 {ea.email||ea.label}</div>
              <div style={{background:"#07090f",borderRadius:6,padding:"8px 10px",fontSize:11,color:"#64748b",fontFamily:"DM Mono",wordBreak:"break-all"}}>{buildSmsQuery(ea.id)}</div>
            </div>
          ))}
          <div style={{fontSize:11,color:"#475569",marginTop:8}}>These queries are automatically added to each Gmail sync to capture SMS-forwarded emails.</div>
        </div>
      )}

      {/* Manual test */}
      <div className="card" style={{marginTop:16}}>
        <div style={{fontWeight:600,fontSize:14,marginBottom:10,color:"#94a3b8"}}>🧪 Manual Test — Paste a Single SMS</div>
        <div style={{fontSize:12,color:"#64748b",marginBottom:10}}>Use this to test classification of any SMS before setting up auto-forwarding.</div>
        <textarea rows={3} value={testText} onChange={e=>setTestText(e.target.value)} placeholder="Your a/c XX1234 debited for INR 850.00 on 02-Mar-26 at SWIGGY. Avl Bal INR 12,450.00"/>
        <button className="btn pri" style={{marginTop:10,width:"100%"}} onClick={testSingle} disabled={testLoad||!testText.trim()}>{testLoad?"🤖 Classifying…":"🤖 Classify & Add to Inbox"}</button>
      </div>

      {showAdd&&<AddSmsModal emails={emails} onSave={n=>{setSmsNums(p=>[...p,{...n,id:gid()}]);setShowAdd(false);}} onClose={()=>setShowAdd(false)}/>}
      {showGuide==="overview"&&<SmsOverviewModal onClose={()=>setShowGuide(null)}/>}
    </div>
  );
}

function SmsNumList({nums,emails,setSmsNums,typeColor}){
  return(
    <div style={{display:"grid",gap:6}}>
      {nums.map(s=>{
        const linkedEmail=emails.find(e=>e.id===s.linkedEmailId);
        return(
          <div key={s.id} className="card" style={{padding:"10px 14px",borderLeft:`3px solid ${typeColor[s.type]||"#64748b"}`,opacity:s.active?1:0.5}}>
            <R>
              <div style={{flex:1,display:"flex",gap:12,alignItems:"center"}}>
                <label style={{margin:0,textTransform:"none",letterSpacing:0,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                  <input type="checkbox" checked={s.active!==false} onChange={e=>setSmsNums(p=>p.map(x=>x.id===s.id?{...x,active:e.target.checked}:x))} style={{width:"auto"}}/>
                </label>
                <div>
                  <div style={{fontWeight:500,fontSize:13}}>{s.label}</div>
                  <div style={{fontSize:11,color:"#475569",display:"flex",gap:8,marginTop:2,flexWrap:"wrap"}}>
                    <span style={{fontFamily:"DM Mono",color:"#818cf8"}}>{s.number}</span>
                    <span style={{background:typeColor[s.type]+"22",color:typeColor[s.type],padding:"0 6px",borderRadius:3}}>{s.type}</span>
                    {s.sim&&<span>📶 {s.sim}</span>}
                    {linkedEmail&&<span>→ 📧 {linkedEmail.email||linkedEmail.label}</span>}
                  </div>
                </div>
              </div>
              <button className="btn sm dan" style={{padding:"2px 8px"}} onClick={()=>setSmsNums(p=>p.filter(x=>x.id!==s.id))}>✕</button>
            </R>
          </div>
        );
      })}
    </div>
  );
}

function AddSmsModal({emails,onSave,onClose}){
  const[f,setF]=useState({label:"",number:"",type:"bank",sim:"SIM 1",linkedEmailId:emails[0]?.id||"",active:true});
  const[tab,setTab]=useState("custom"); // custom | known
  return(
    <div className="overlay"><div className="modal" style={{maxWidth:500}}>
      <MH title="Add SMS Sender" onClose={onClose}/>
      <div style={{display:"flex",gap:6,marginBottom:16,borderBottom:"1px solid #1e293b",paddingBottom:12}}>
        {[["custom","✏ Custom"],["known","⚡ From Known List"]].map(([k,l])=>(
          <button key={k} className={`btn sm ${tab===k?"pri":"ghost"}`} onClick={()=>setTab(k)}>{l}</button>
        ))}
      </div>
      {tab==="known"&&(
        <div style={{maxHeight:320,overflowY:"auto"}}>
          {["bank","broker","upi","merchant"].map(type=>(
            <div key={type} style={{marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",marginBottom:6}}>{type}</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {KNOWN_SENDERS.filter(s=>s.type===type).map(s=>(
                  <button key={s.number} className="btn sm ghost" style={{fontSize:12}} onClick={()=>{
                    setF(p=>({...p,label:s.label,number:s.number,type:s.type}));
                    setTab("custom");
                  }}>{s.label}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {tab==="custom"&&(
        <>
          <label>Label</label><input value={f.label} onChange={e=>setF(p=>({...p,label:e.target.value}))} placeholder="e.g. HDFC Bank / Zerodha"/>
          <label>Sender ID or Number</label><input value={f.number} onChange={e=>setF(p=>({...p,number:e.target.value}))} placeholder="e.g. HDFCBK or +919876543210"/>
          <div style={{fontSize:11,color:"#475569",marginTop:4}}>Indian bank SMS use sender IDs like HDFCBK, ICICIB, SBIINB. International numbers use +country code.</div>
          <label>Type</label>
          <select value={f.type} onChange={e=>setF(p=>({...p,type:e.target.value}))}>
            {["bank","broker","upi","merchant","other"].map(t=><option key={t}>{t}</option>)}
          </select>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div>
              <label>SIM / Phone Number</label>
              <input value={f.sim} onChange={e=>setF(p=>({...p,sim:e.target.value}))} placeholder="e.g. SIM 1, +91-98xxx"/>
            </div>
            <div>
              <label>Forward to Gmail Account</label>
              <select value={f.linkedEmailId} onChange={e=>setF(p=>({...p,linkedEmailId:e.target.value}))}>
                <option value="">— Select —</option>
                {emails.map(e=><option key={e.id} value={e.id}>{e.email||e.label}</option>)}
              </select>
            </div>
          </div>
          {emails.length===0&&<div style={{background:"#1a1a2e",border:"1px solid #6366f1",borderRadius:8,padding:10,marginTop:12,fontSize:12,color:"#c7d2fe"}}>💡 Connect a Gmail account in the Email tab first — that's where forwarded SMS will arrive.</div>}
          <div style={{display:"flex",gap:10,marginTop:18}}>
            <button className="btn ghost" onClick={onClose} style={{flex:1}}>Cancel</button>
            <button className="btn pri" style={{flex:2}} onClick={()=>{if(!f.label||!f.number)return alert("Enter label and sender ID");onSave(f);}}>Add Sender</button>
          </div>
        </>
      )}
    </div></div>
  );
}

function AndroidGuide({emails,smsNums}){
  const targetEmail=emails[0]?.email||"your-gmail@gmail.com";
  return(
    <div className="card" style={{background:"#0a0c12"}}>
      <div style={{fontWeight:700,fontSize:15,marginBottom:16,color:"#f1f5f9",display:"flex",alignItems:"center",gap:10}}>
        <span>🤖</span><span>Android Setup — MacroDroid (Free, Recommended)</span>
      </div>
      <div style={{display:"grid",gap:12}}>
        {[
          {n:"1",t:"Install MacroDroid",d:<span>Download <b>MacroDroid</b> from the Play Store (free). It's a no-code automation app — no Tasker or scripting needed.</span>},
          {n:"2",t:"Create a New Macro",d:<span>Open MacroDroid → <b>+ Add Macro</b> → name it "SMS to LedgerAI"</span>},
          {n:"3",t:"Set Trigger: SMS Received",d:<span>Tap <b>Triggers → SMS / MMS → SMS Received</b><br/>
            In "From number/sender" enter your bank IDs separated by commas:<br/>
            <code style={{background:"#07090f",padding:"4px 8px",borderRadius:4,fontSize:11,display:"block",marginTop:6,wordBreak:"break-all"}}>
              {smsNums.slice(0,5).map(s=>s.number).join(", ") || "HDFCBK, ICICIB, SBIINB, ZERODHA, GPAY"}
            </code>
            <span style={{fontSize:11,color:"#64748b",marginTop:4,display:"block"}}>Or leave blank to forward ALL SMS (then filter in Gmail).</span>
          </span>},
          {n:"4",t:"Set Action: Send Email",d:<span>Tap <b>Actions → Communication → Send Email</b><br/>
            <b>To:</b> <code style={{background:"#07090f",padding:"2px 6px",borderRadius:3,fontSize:11}}>{targetEmail}</code><br/>
            <b>Subject:</b> <code style={{background:"#07090f",padding:"2px 6px",borderRadius:3,fontSize:11}}>SMS from [sender_number]</code> (use the variable button)<br/>
            <b>Body:</b> <code style={{background:"#07090f",padding:"2px 6px",borderRadius:3,fontSize:11}}>[sms_body]</code> (use the variable button)
          </span>},
          {n:"5",t:"Save & Enable",d:<span>Tap <b>Save</b> → make sure the macro is <b>Enabled</b> (toggle green). Done! Every matching SMS is now emailed to your Gmail automatically.</span>},
          {n:"6",t:"Multiple SIMs",d:<span>For SIM 2: create a second macro with identical settings. In the trigger, you can restrict to SIM 1 or SIM 2. Name it "SMS to LedgerAI – SIM 2". Repeat for as many SIMs as you have.</span>},
        ].map(s=>(
          <div key={s.n} style={{display:"flex",gap:12}}>
            <div style={{width:24,height:24,borderRadius:12,background:"#6366f1",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,flexShrink:0}}>{s.n}</div>
            <div><div style={{fontWeight:600,fontSize:13,marginBottom:4}}>{s.t}</div><div style={{fontSize:13,color:"#94a3b8",lineHeight:1.7}}>{s.d}</div></div>
          </div>
        ))}
      </div>
      <div style={{background:"#1a1a2e",border:"1px solid #6366f1",borderRadius:8,padding:12,marginTop:16,fontSize:12,color:"#c7d2fe"}}>
        💡 <b>Alternative Android apps:</b> SMS Forwarder Pro (paid, more features), Tasker + AutoEmail plugin (power users), or AutoForward SMS.
      </div>
    </div>
  );
}

function IosGuide({emails,smsNums}){
  const targetEmail=emails[0]?.email||"your-gmail@gmail.com";
  return(
    <div className="card" style={{background:"#0a0c12"}}>
      <div style={{fontWeight:700,fontSize:15,marginBottom:16,color:"#f1f5f9",display:"flex",alignItems:"center",gap:10}}>
        <span>🍎</span><span>iOS Setup — Two Options</span>
      </div>

      <div style={{fontWeight:600,fontSize:13,color:"#818cf8",marginBottom:10}}>Option A — iOS Shortcuts (Free, Built-in)</div>
      <div style={{background:"#07090f",borderRadius:8,padding:14,marginBottom:16}}>
        <div style={{fontSize:12,color:"#64748b",marginBottom:12}}>⚠️ iOS Shortcuts have a limitation — they can trigger on messages but require you to tap a notification. Best for semi-automatic use.</div>
        {[
          {n:"1",d:"Open Shortcuts app → Automation tab → + New Automation"},
          {n:"2",d:"Choose trigger: Message → Received from → add your bank numbers one by one"},
          {n:"3",d:'Add action: "Send Email" → To: '+targetEmail+' Subject: "SMS from [Sender]" Body: [Message Content]'},
          {n:"4",d:'Turn off "Ask Before Running" (requires iOS 15+) → Done'},
        ].map(s=>(
          <div key={s.n} style={{display:"flex",gap:10,marginBottom:8,fontSize:13,color:"#94a3b8"}}>
            <div style={{width:20,height:20,borderRadius:10,background:"#1e293b",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0}}>{s.n}</div>
            <span style={{lineHeight:1.6}}>{s.d}</span>
          </div>
        ))}
      </div>

      <div style={{fontWeight:600,fontSize:13,color:"#818cf8",marginBottom:10}}>Option B — Dedicated App (Fully Automatic)</div>
      <div style={{background:"#07090f",borderRadius:8,padding:14}}>
        <div style={{fontSize:13,color:"#94a3b8",lineHeight:1.8}}>
          Install <b style={{color:"#e2e8f0"}}>"Forward SMS to Email"</b> or <b style={{color:"#e2e8f0"}}>"SMS Auto Forward"</b> from the App Store (small paid apps ~₹200).<br/>
          Set up rules to forward from specific numbers → to <code style={{background:"#0a0c12",padding:"1px 6px",borderRadius:3,fontSize:11}}>{targetEmail}</code>.<br/>
          These apps run fully in the background — no tapping required.
        </div>
      </div>

      <div style={{background:"#1a1a2e",border:"1px solid #6366f1",borderRadius:8,padding:12,marginTop:16,fontSize:12,color:"#c7d2fe"}}>
        💡 <b>Multiple numbers on iOS:</b> For dual-SIM iPhones, add rules for both numbers in the same app. Each gets its own forwarding rule.
      </div>
    </div>
  );
}

function IftttGuide({emails,smsNums}){
  const targetEmail=emails[0]?.email||"your-gmail@gmail.com";
  return(
    <div className="card" style={{background:"#0a0c12"}}>
      <div style={{fontWeight:700,fontSize:15,marginBottom:16,color:"#f1f5f9",display:"flex",alignItems:"center",gap:10}}>
        <span>⚡</span><span>IFTTT — Cross-Platform Automation</span>
      </div>
      <div style={{fontSize:13,color:"#64748b",marginBottom:14}}>IFTTT (If This Then That) works on Android. Free tier supports this use case.</div>
      {[
        {n:"1",t:"Create IFTTT account",d:<span>Go to <a href="https://ifttt.com" target="_blank" rel="noreferrer">ifttt.com</a> and sign up free. Install the IFTTT app on your Android phone.</span>},
        {n:"2",t:"Create an Applet",d:<span>Tap <b>Create</b> → <b>If This</b> → search <b>Android SMS</b> → <b>New SMS received from phone number</b></span>},
        {n:"3",t:"Configure trigger",d:<span>Enter the sender number/ID: <code style={{background:"#07090f",padding:"2px 6px",borderRadius:3,fontSize:11}}>{smsNums[0]?.number||"HDFCBK"}</code>. Create one applet per bank number (IFTTT free allows 5 applets).</span>},
        {n:"4",t:"Set action: Gmail",d:<span>Then That → <b>Gmail → Send an email</b><br/>To: <code style={{background:"#07090f",padding:"2px 6px",borderRadius:3,fontSize:11}}>{targetEmail}</code><br/>Subject: <code style={{background:"#07090f",padding:"2px 6px",borderRadius:3,fontSize:11}}>SMS from {"{{FromNumber}}"}</code><br/>Body: <code style={{background:"#07090f",padding:"2px 6px",borderRadius:3,fontSize:11}}>{"{{Text}}"}</code></span>},
        {n:"5",t:"Repeat per number",d:<span>Create a separate applet for each bank/broker sender ID. IFTTT Pro ($3.99/mo) removes the 5-applet limit if you have many numbers.</span>},
      ].map(s=>(
        <div key={s.n} style={{display:"flex",gap:12,marginBottom:12}}>
          <div style={{width:24,height:24,borderRadius:12,background:"#f59e0b22",color:"#f59e0b",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,flexShrink:0}}>{s.n}</div>
          <div><div style={{fontWeight:600,fontSize:13,marginBottom:3}}>{s.t}</div><div style={{fontSize:13,color:"#94a3b8",lineHeight:1.7}}>{s.d}</div></div>
        </div>
      ))}
      <div style={{background:"#1a1a2e",border:"1px solid #f59e0b",borderRadius:8,padding:12,marginTop:8,fontSize:12,color:"#fcd34d"}}>
        ⚡ <b>Power user tip:</b> Use <b>Zapier</b> or <b>Make (Integromat)</b> as alternatives to IFTTT with more flexibility. Zapier's free tier also supports SMS → Email workflows via Android integration.
      </div>
    </div>
  );
}

function SmsOverviewModal({onClose}){
  return(
    <div className="overlay"><div className="modal" style={{maxWidth:560}}>
      <MH title="How SMS Auto-Import Works" onClose={onClose}/>
      <div style={{fontSize:13,color:"#94a3b8",lineHeight:1.9}}>
        <div style={{display:"grid",gap:16}}>
          {[
            {icon:"📱",t:"Why can't the browser read SMS directly?",d:"iOS and Android both block websites from accessing the Messages app — it's a fundamental OS security feature to protect your privacy. There is no SMS API for browsers."},
            {icon:"📧",t:"The solution: SMS → Email → LedgerAI",d:"A free automation app on your phone silently forwards financial SMS to your connected Gmail. LedgerAI's Gmail sync then picks it up, AI classifies it, and it lands in your Inbox for review. Completely automatic after one-time setup."},
            {icon:"🔒",t:"Is it private?",d:"The SMS text goes to your own Gmail account that you already own. LedgerAI reads it with the same read-only Gmail access you already granted. Nothing goes to any third-party server."},
            {icon:"⚡",t:"How fast is it?",d:"MacroDroid forwards the SMS instantly when received. Gmail sync runs when you click Sync (or you can schedule it). Typically under 2 minutes from SMS received to appearing in Inbox."},
            {icon:"📱",t:"Multiple SIMs / phones?",d:"Set up a forwarding rule per SIM on each phone. All rules point to one Gmail. The Gmail sync consolidates everything. You can have 5 SIMs across 3 phones — they all funnel into one Inbox."},
          ].map(s=>(
            <div key={s.t} style={{display:"flex",gap:12}}>
              <span style={{fontSize:22,flexShrink:0}}>{s.icon}</span>
              <div><div style={{fontWeight:600,fontSize:13,color:"#f1f5f9",marginBottom:4}}>{s.t}</div><div style={{fontSize:13,color:"#64748b"}}>{s.d}</div></div>
            </div>
          ))}
        </div>
      </div>
      <button className="btn pri" style={{marginTop:20,width:"100%"}} onClick={onClose}>Got it — let's set it up</button>
    </div></div>
  );
}

// ── EMAIL TAB ─────────────────────────────────────────────────────────────────
function EmailTab({emails,setEmails,inbox,addInbox,autoPostTxns,acts,cats,defaultGoogleClientId,defaultMicrosoftClientId}){
  const[syncingIds,setSyncingIds]=useState({});
  const[syncProgress,setSyncProgress]=useState({});
  const[logs,setLogs]=useState({});
  const[toast,setToast]=useState("");
  const[firstSyncPrompt,setFirstSyncPrompt]=useState(null); // {accId,fromDate,scanAll}
  const[reviewState,setReviewState]=useState(null); // {accId,items}
  const log=(id,msg)=>setLogs(p=>({...p,[id]:msg}));
  const googleClientId=(defaultGoogleClientId||DEFAULT_GOOGLE_CLIENT_ID||"").trim();
  const microsoftClientId=(defaultMicrosoftClientId||DEFAULT_MICROSOFT_CLIENT_ID||"").trim();
  const providerOf=acc=>(((acc?.provider||"google")+"").toLowerCase()==="microsoft"?"microsoft":"google");
  const isSyncReady=(acc)=>{
    if(!acc?.connected)return false;
    const provider=providerOf(acc);
    if(provider==="microsoft")return Boolean((acc.msClientId||microsoftClientId||"").trim());
    return Boolean(acc.token);
  };
  const emailInbox=inbox.filter(i=>i.source==="email").length;
  const connected=emails.filter(a=>{
    const provider=providerOf(a);
    if(provider==="microsoft")return Boolean(a.connected);
    return Boolean(a.connected&&a.token);
  }).length;
  const syncableAccounts=emails.filter(isSyncReady);
  const anySyncing=Object.values(syncingIds).some(Boolean);
  const setSyncing=(id,val)=>setSyncingIds(p=>({...p,[id]:val}));
  const setProgress=(id,patch)=>setSyncProgress(p=>({...p,[id]:{...(p[id]||{}),...patch}}));

  useEffect(()=>{
    if(!toast)return;
    const t=setTimeout(()=>setToast(""),2600);
    return()=>clearTimeout(t);
  },[toast]);

  const gmailDate=(d)=>{
    if(!d)return"";
    try{return new Date(d).toISOString().slice(0,10).replace(/-/g,"/");}catch{return"";}
  };

  const connectGoogleAccount=(existing=null)=>{
    if(!googleClientId){alert("Google OAuth is not configured for this app yet.");return;}
    if(!window.google?.accounts?.oauth2){alert("Google Identity Services loading… please wait a moment and try again.");return;}
    initOAuth(googleClientId,async(err,token)=>{
      if(err){
        const msg=String(err.message||"");
        if(msg.includes("access_denied")){
          alert("Access denied by Google OAuth. Add your email as a Test User in Google Auth Platform, or publish the OAuth app to production.");
        }else if(msg.includes("redirect_uri_mismatch")){
          alert(`OAuth error: redirect_uri_mismatch\n\nAdd this in Google OAuth:\nOrigin: ${window.location.origin}\nRedirect URIs: ${window.location.origin} and ${window.location.origin}/`);
        }else alert(`OAuth error: ${msg}`);
        return;
      }
      try{
        const profile=await gmailGetProfile(token);
        const mail=(profile.emailAddress||"").trim();
        if(!mail)throw new Error("Google did not return email address.");
        setEmails(prev=>{
          const next=[...prev];
          const ix=existing
            ?next.findIndex(a=>a.id===existing.id)
            :next.findIndex(a=>providerOf(a)==="google"&&(a.email||"").toLowerCase()===mail.toLowerCase());
          const base=hydrateEmailAccount({id:gid(),provider:"google",label:mail.split("@")[0],email:mail,syncQuery:GMAIL_QUERY,maxEmails:100,autoPost:false,enabled:true,firstSyncCompleted:false,syncFromDate:""});
          if(ix>=0){
            const cur=hydrateEmailAccount(next[ix]);
            next[ix]={...cur,provider:"google",email:mail,token,connected:true,enabled:true,clientId:googleClientId};
          }else{
            next.unshift({...base,token,connected:true,clientId:googleClientId});
          }
          return next;
        });
        setToast(`✅ Gmail connected: ${mail}`);
      }catch(e){
        alert("Profile fetch error: "+e.message);
      }
    });
  };

  const connectMicrosoftAccount=async(existing=null)=>{
    const msClient=(existing?.msClientId||microsoftClientId||DEFAULT_MICROSOFT_CLIENT_ID||"").trim();
    if(!msClient){
      alert("Outlook connector is not configured for this deployment. Admin needs to set VITE_MICROSOFT_CLIENT_ID once.");
      return;
    }
    try{
      const login=await msLoginMail(msClient);
      const account=login.account||{};
      const profile=await msGetProfileByToken(login.accessToken);
      const mail=(profile.mail||profile.userPrincipalName||account.username||"").trim();
      if(!mail)throw new Error("Microsoft did not return an email address.");
      setEmails(prev=>{
        const next=[...prev];
        const ix=existing
          ?next.findIndex(a=>a.id===existing.id)
          :next.findIndex(a=>providerOf(a)==="microsoft"&&(a.email||"").toLowerCase()===mail.toLowerCase());
        const base=hydrateEmailAccount({id:gid(),provider:"microsoft",label:mail.split("@")[0],email:mail,syncQuery:"",maxEmails:100,autoPost:false,enabled:true,firstSyncCompleted:false,syncFromDate:"",msClientId:msClient,msAccountId:account.homeAccountId||"",msUsername:account.username||mail});
        if(ix>=0){
          const cur=hydrateEmailAccount(next[ix]);
          next[ix]={...cur,provider:"microsoft",email:mail,token:login.accessToken,connected:true,enabled:true,msClientId:msClient,msAccountId:account.homeAccountId||cur.msAccountId||"",msUsername:account.username||cur.msUsername||mail};
        }else{
          next.unshift({...base,token:login.accessToken,connected:true});
        }
        return next;
      });
      setToast(`✅ Outlook connected: ${mail}`);
    }catch(e){
      const msg=String(e.message||"Microsoft OAuth failed.");
      if(msg.includes("popup_window_error")||msg.includes("user_cancelled"))alert("Microsoft sign-in was cancelled.");
      else alert(`Microsoft OAuth error: ${msg}`);
    }
  };

  const connectAccount=(provider,existing=null)=>{
    if(provider==="microsoft"){connectMicrosoftAccount(existing);return;}
    connectGoogleAccount(existing);
  };

  const disconnectAccount=(acc)=>{
    const provider=providerOf(acc);
    setEmails(prev=>prev.map(a=>a.id===acc.id?{...a,token:null,connected:false}:a));
    setToast(`${provider==="microsoft"?"Outlook":"Gmail"} disconnected: ${acc.email||acc.label||"account"}`);
  };

  const removeAccount=(acc)=>{
    if(!window.confirm(`Remove ${acc.email||acc.label||"this account"} from Email Integration?`))return;
    setEmails(prev=>prev.filter(a=>a.id!==acc.id));
  };

  const runSync=async(acc,opts={})=>{
    const provider=providerOf(acc);
    if(provider==="google"&&!acc?.token){alert("Connect this Gmail account first.");return;}
    const msClient=(acc?.msClientId||microsoftClientId||"").trim();
    if(provider==="microsoft"&&!msClient){alert("Outlook connector is not configured for this deployment. Admin needs to set VITE_MICROSOFT_CLIENT_ID once.");return;}
    const scanAll=opts.scanAll===true;
    const fromDate=(opts.fromDate||acc.syncFromDate||"").trim();
    const markFirst=opts.markFirstSync===true;
    setSyncing(acc.id,true);
    setProgress(acc.id,{phase:"fetching",processed:0,total:0,remaining:0,matched:0,newCount:0,found:0});
    try{
      const requestedMax=scanAll?50000:Math.max(1,Math.min(Number(acc.maxEmails)||100,5000));
      let token=acc.token||"";
      let messages=[];
      if(provider==="microsoft"){
        const auth=await msGetMailToken(msClient,{homeAccountId:acc.msAccountId,username:acc.msUsername||acc.email});
        token=auth.accessToken;
        const msAcc=auth.account||{};
        setEmails(prev=>prev.map(a=>a.id===acc.id?{...a,token,connected:true,msClientId:msClient,msAccountId:msAcc.homeAccountId||a.msAccountId||"",msUsername:msAcc.username||a.msUsername||a.email||""}:a));
        log(acc.id,scanAll?`Scanning Outlook mailbox from ${fromDate||"beginning"}…`:"Fetching Outlook email list…");
        messages=await msListMessages(token,requestedMax,fromDate);
      }else{
        const baseQuery=(acc.syncQuery||GMAIL_QUERY||"in:anywhere").trim();
        const qParts=[baseQuery];
        if(fromDate&&gmailDate(fromDate))qParts.push(`after:${gmailDate(fromDate)}`);
        const finalQuery=qParts.join(" ").trim();
        log(acc.id,scanAll?`Scanning Gmail mailbox from ${fromDate||"beginning"}…`:"Fetching Gmail email list…");
        messages=await gmailListMessages(token,finalQuery,requestedMax);
      }
      if(!messages.length){
        log(acc.id,"✓ No matching emails found.");
        setProgress(acc.id,{phase:"done",processed:0,total:0,remaining:0,matched:0,newCount:0,found:0});
        setSyncing(acc.id,false);
        return;
      }
      const processedKey=`proc_${EMAIL_SYNC_CACHE_VERSION}_${acc.id}`;
      const processed=new Set(LS.get(processedKey,[]));
      const fresh=messages.filter(m=>!processed.has(m.id));
      if(!fresh.length){
        log(acc.id,"✓ All emails already processed.");
        setProgress(acc.id,{phase:"done",processed:0,total:0,remaining:0,matched:messages.length,newCount:0,found:0});
        setSyncing(acc.id,false);
        return;
      }
      const toProcess=scanAll?fresh:fresh.slice(0,Math.max(1,Math.min(Number(acc.maxEmails)||100,5000)));
      setProgress(acc.id,{phase:"processing",processed:0,total:toProcess.length,remaining:toProcess.length,matched:messages.length,newCount:fresh.length,found:0,failed:0,skipped:0,failureReasons:{}});
      const found=[];let done=0;let failed=0;let skipped=0;let fallbackUsed=0;
      const failureReasons={};
      let lastProgressTs=0;
      const flushProgress=(force=false)=>{
        const now=Date.now();
        if(!force&&now-lastProgressTs<250&&done<toProcess.length)return;
        lastProgressTs=now;
        const statusParts=[`Processed ${done}/${toProcess.length} emails`,`found ${found.length}`];
        if(failed>0)statusParts.push(`failed ${failed}`);
        if(skipped>0)statusParts.push(`skipped ${skipped}`);
        if(fallbackUsed>0)statusParts.push(`fallback ${fallbackUsed}`);
        const failureSummary=formatFailureSummary(failureReasons);
        if(failureSummary)statusParts.push(failureSummary);
        log(acc.id,`${statusParts.join(" · ")}…`);
        setProgress(acc.id,{phase:"processing",processed:done,total:toProcess.length,remaining:Math.max(0,toProcess.length-done),matched:messages.length,newCount:fresh.length,found:found.length,failed,skipped,failureReasons:{...failureReasons}});
      };
      const processMessage=async(msg)=>{
        try{
          let subject="";let from="";let rawDate="";let body="";
          let hasAttachment=false;let attachmentNames=[];let attachmentText="";
          if(provider==="microsoft"){
            const full=await withTimeout(msGetMessage(token,msg.id),20000,"Outlook message fetch");
            subject=full.subject||"";
            const addr=full.from?.emailAddress?.address||"";
            const name=full.from?.emailAddress?.name||"";
            from=name&&addr?`${name} <${addr}>`:(addr||name||"");
            rawDate=full.receivedDateTime||msg.receivedDateTime||"";
            body=msExtractBody(full);
            hasAttachment=Boolean(full.hasAttachments||msg.hasAttachments);
          }else{
            const full=await withTimeout(gmailGetMessage(token,msg.id),20000,"Gmail message fetch");
            const H=full.payload?.headers||[];
            subject=H.find(h=>h.name==="Subject")?.value||"";
            from=H.find(h=>h.name==="From")?.value||"";
            rawDate=H.find(h=>h.name==="Date")?.value||"";
            const bodyParts=extractEmailTextAll(full.payload,0,[]);
            if(full.snippet)bodyParts.push(full.snippet);
            body=collapseTextParts(bodyParts);
            const attachmentMeta=collectGmailAttachmentMeta(full.payload,[]);
            attachmentNames=attachmentMeta.map(a=>a.name).filter(Boolean);
            hasAttachment=attachmentNames.length>0;
            if(hasAttachment){
              attachmentText=await gmailAttachmentEvidenceText(token,msg.id,attachmentMeta);
            }
          }
          const emailContext={subject,from,body,attachmentNames,attachmentText,hasAttachment};
          const parsedDate=rawDate?new Date(rawDate):null;
          const eDate=parsedDate&&!Number.isNaN(parsedDate.getTime())?parsedDate.toISOString().slice(0,10):today();
          let items=[];
          let aiResult={isCashFlow:false,confidence:0,reason:"",transactions:[]};
          try{
            aiResult=await withTimeout(
              aiAnalyzeEmail(subject,from,body,acts,cats,{attachmentNames,attachmentText,hasAttachment}),
              35000,
              "AI mail analysis",
            );
            items=Array.isArray(aiResult.transactions)?aiResult.transactions:[];
          }catch(aiErr){
            console.error(aiErr);
          }
          if(!items.length){
            const fb=fallbackExtractEmail(subject,from,body,{attachmentNames,attachmentText,hasAttachment}).map(item=>({...item,date:item.date||eDate}));
            if(fb.length){fallbackUsed++;items=fb;}
          }
          items=sanitizeEmailTransactions(items,{...emailContext,aiCashFlow:Boolean(aiResult?.isCashFlow)});
          if(!items.length){
            skipped++;
            processed.add(msg.id);
            return;
          }
          items.forEach(item=>found.push({...item,date:item.date||eDate,source:"email",emailProvider:provider,emailSubject:subject,emailFrom:from,emailAccountId:acc.id,emailMsgId:msg.id}));
          processed.add(msg.id);
        }catch(e){
          failed++;
          const reason=classifySyncError(e);
          failureReasons[reason]=(failureReasons[reason]||0)+1;
          console.error(e);
        }finally{
          done++;
          flushProgress();
        }
      };
      const maxParallel=Math.max(1,Math.min(provider==="microsoft"?4:3,toProcess.length));
      let nextIndex=0;
      const worker=async()=>{
        while(true){
          const current=nextIndex++;
          if(current>=toProcess.length)break;
          await processMessage(toProcess[current]);
        }
      };
      log(acc.id,`Matched ${messages.length} email(s), ${fresh.length} new. Reading ${toProcess.length} now with ${maxParallel} parallel workers…`);
      await Promise.all(Array.from({length:maxParallel},()=>worker()));
      flushProgress(true);
      LS.set(processedKey,[...processed].slice(-50000));
      const deduped=[];const seen=new Set();
      for(const i of found){
        const key=[i.emailMsgId||"",i.type||"",Number(i.amount)||0,(i.date||""),String(i.description||"").toLowerCase().slice(0,80)].join("|");
        if(seen.has(key))continue;
        seen.add(key);
        deduped.push(i);
      }
      const valid=deduped.filter(i=>i.amount>0&&(i.type==="income"||i.type==="expense"));
      setEmails(prev=>prev.map(a=>a.id===acc.id?{...a,lastSync:new Date().toISOString(),lastCount:valid.length,firstSyncCompleted:a.firstSyncCompleted||markFirst,syncFromDate:fromDate||a.syncFromDate||"",msClientId:provider==="microsoft"?(a.msClientId||msClient):a.msClientId}:a));
      if(!valid.length){
        if(failed===toProcess.length){
          log(acc.id,"⚠ Sync finished, but all emails failed extraction. Check network/auth and retry.");
          setProgress(acc.id,{phase:"error",processed:toProcess.length,total:toProcess.length,remaining:0,matched:messages.length,newCount:fresh.length,found:0,failed,skipped,failureReasons:{...failureReasons}});
          setSyncing(acc.id,false);
          return;
        }
        log(acc.id,`✓ Done — no income/expense found.${failed?` Failed: ${failed}.`:""}${skipped?` Skipped: ${skipped}.`:""}`);
        setProgress(acc.id,{phase:"done",processed:toProcess.length,total:toProcess.length,remaining:0,matched:messages.length,newCount:fresh.length,found:0,failed,skipped,failureReasons:{...failureReasons}});
        setSyncing(acc.id,false);
        return;
      }
      log(acc.id,`AI found ${valid.length} income/expense item(s). Review before posting.`);
      setProgress(acc.id,{phase:"review",processed:toProcess.length,total:toProcess.length,remaining:0,matched:messages.length,newCount:fresh.length,found:valid.length,failed,skipped,failureReasons:{...failureReasons}});
      setReviewState({accId:acc.id,items:valid});
    }catch(e){
      const msg=String(e.message||"");
      if(msg.includes("401")||msg.includes("Not signed in to Microsoft")){
        log(acc.id,provider==="microsoft"?"⚠ Microsoft session expired — reconnect required.":"⚠ Token expired — reconnect required.");
        setEmails(prev=>prev.map(a=>a.id===acc.id?{...a,token:null,connected:false}:a));
      }else log(acc.id,"Error: "+msg);
      setProgress(acc.id,{phase:"error"});
    }
    setSyncing(acc.id,false);
  };

  const startSync=(acc,scanAll=false)=>{
    if(!isSyncReady(acc)){alert(`Connect this ${providerOf(acc)==="microsoft"?"Outlook":"Gmail"} account first.`);return;}
    if(!acc.firstSyncCompleted){
      const d=acc.syncFromDate||new Date(Date.now()-90*24*60*60*1000).toISOString().slice(0,10);
      setFirstSyncPrompt({accId:acc.id,fromDate:d,scanAll:true});
      return;
    }
    runSync(acc,{scanAll});
  };

  const submitReview=(rows,mode="dashboard")=>{
    const reviewAccId=reviewState?.accId;
    const normalized=rows.map(r=>{
      const activity=r.businessActivity||acts[0]||"Personal";
      const category=r.category||cats[activity]?.[0]||"Other";
      const known=(cats[activity]||[]).includes(category);
      return{
        ...r,
        type:r.type==="income"?"income":"expense",
        amount:Number(r.amount)||0,
        date:r.date||today(),
        businessActivity:activity,
        category,
        isNewCategory:!known,
      };
    }).filter(r=>r.amount>0);
    if(!normalized.length){setReviewState(null);return;}
    if(mode==="inbox"){
      addInbox(normalized.map(i=>({...i,source:"email"})));
      setToast(`Queued ${normalized.length} item(s) to Inbox for review.`);
    }else{
      const posted=autoPostTxns?autoPostTxns(normalized.map(i=>({...i,source:"email"}))):0;
      setToast(`Added ${posted||normalized.length} transaction(s) to Dashboard.`);
    }
    if(reviewAccId)setProgress(reviewAccId,{phase:"done",remaining:0});
    setReviewState(null);
  };

  return(
    <div>
      <R style={{marginBottom:10}}>
        <h2 className="h2" style={{flex:1}}>Email Integration</h2>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button className="btn sm suc" onClick={()=>connectAccount("google",null)}>+ Connect Gmail Account</button>
          <button className="btn sm pri" onClick={()=>connectAccount("microsoft",null)}>+ Connect Outlook Account</button>
        </div>
      </R>

      {toast&&<div style={{background:"#052e16",border:"1px solid #34d399",borderRadius:10,padding:"10px 12px",fontSize:12,color:"#86efac",marginBottom:12}}>{toast}</div>}

      <div className="card" style={{marginBottom:14,background:"linear-gradient(135deg,#10192d,#0a1220)"}}>
        <R>
          <div style={{fontSize:13,color:"#94a3b8"}}>
            Connected accounts: <b style={{color:"#e2e8f0"}}>{connected}</b> / {emails.length}
            {emailInbox>0&&<span style={{marginLeft:10,color:"#f59e0b"}}>· {emailInbox} items pending in Inbox</span>}
          </div>
          {syncableAccounts.length>0&&<button className="btn sm pri" disabled={anySyncing} onClick={()=>syncableAccounts.forEach(a=>startSync(a,false))}>{anySyncing?"⏳ Syncing…":"🔄 Sync All Accounts"}</button>}
        </R>
      </div>

      {emails.length===0&&(
        <div className="card" style={{textAlign:"center",padding:56,background:"linear-gradient(135deg,#0f1624,#081122)"}}>
          <div style={{fontSize:42,marginBottom:12}}>📬</div>
          <div style={{fontSize:20,fontWeight:700,marginBottom:8}}>Connect your first email account</div>
          <div style={{fontSize:13,color:"#64748b",marginBottom:20}}>Choose Gmail or Outlook, sign in, grant permissions, then sync from a start date.</div>
          <div style={{display:"flex",justifyContent:"center",gap:10}}>
            <button className="btn suc" onClick={()=>connectAccount("google",null)}>+ Connect Gmail Account</button>
            <button className="btn pri" onClick={()=>connectAccount("microsoft",null)}>+ Connect Outlook Account</button>
          </div>
        </div>
      )}

      {emails.map(rawAcc=>{
        const acc=hydrateEmailAccount(rawAcc);
        const provider=providerOf(acc);
        const providerLabel=provider==="microsoft"?"Outlook":"Gmail";
        const linked=provider==="microsoft"?Boolean(acc.connected):Boolean(acc.connected&&acc.token);
        return(
        <div key={acc.id} className="card" style={{marginBottom:12,background:linked?"linear-gradient(135deg,#0f1c36,#0b1530)":"#0f1624"}}>
          <R style={{marginBottom:8}}>
            <div style={{display:"flex",gap:12,alignItems:"center",flex:1,minWidth:0}}>
              <div style={{width:40,height:40,borderRadius:20,display:"flex",alignItems:"center",justifyContent:"center",background:linked?"#052e16":"#1a1a2e"}}>{linked?"✅":provider==="microsoft"?"Ⓜ️":"📧"}</div>
              <div style={{minWidth:0}}>
                <div style={{fontWeight:700,fontSize:15,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{acc.email||acc.label||"Email account"}</div>
                <div style={{fontSize:12,color:"#64748b"}}>
                  <span>{providerLabel} · </span>
                  {linked?<span style={{color:"#34d399"}}>Connected</span>:<span style={{color:"#f87171"}}>Disconnected</span>}
                  {acc.firstSyncCompleted&&acc.syncFromDate&&<span> · first synced from {fmtD(acc.syncFromDate)}</span>}
                  {acc.lastSync&&<span> · last sync {fmtDT(acc.lastSync)}</span>}
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {!linked&&<button className="btn sm pri" onClick={()=>connectAccount(provider,acc)}>Connect {providerLabel}</button>}
              {linked&&<button className="btn sm" style={{background:"#1a2234",color:"#818cf8"}} disabled={Boolean(syncingIds[acc.id])} onClick={()=>startSync(acc,false)}>{syncingIds[acc.id]?"⏳ Syncing…":"🔄 Sync"}</button>}
              {linked&&<button className="btn sm ghost" disabled={Boolean(syncingIds[acc.id])} onClick={()=>setFirstSyncPrompt({accId:acc.id,fromDate:acc.syncFromDate||new Date(Date.now()-180*24*60*60*1000).toISOString().slice(0,10),scanAll:true})}>🧠 Scan From Date</button>}
              {linked&&<button className="btn sm dan" onClick={()=>disconnectAccount(acc)}>Disconnect {providerLabel}</button>}
              <button className="btn sm ghost" onClick={()=>setEmails(p=>p.map(a=>a.id===acc.id?{...a,_open:!a._open}:a))}>⚙</button>
              <button className="btn sm ghost" onClick={()=>removeAccount(acc)}>Remove</button>
            </div>
          </R>
          {syncProgress[acc.id]&&(
            <div style={{background:"#0a0f1d",border:"1px solid #1e293b",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#c7d2fe",marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:10,marginBottom:6,flexWrap:"wrap"}}>
                <span>
                  {syncProgress[acc.id].phase==="fetching"&&"Fetching emails…"}
                  {syncProgress[acc.id].phase==="processing"&&`Processed ${syncProgress[acc.id].processed||0}/${syncProgress[acc.id].total||0}${syncProgress[acc.id].failed?` · failed ${syncProgress[acc.id].failed}`:""}${syncProgress[acc.id].skipped?` · skipped ${syncProgress[acc.id].skipped}`:""}`}
                  {syncProgress[acc.id].phase==="review"&&`Scan complete. ${syncProgress[acc.id].found||0} item(s) awaiting review.`}
                  {syncProgress[acc.id].phase==="done"&&"Sync completed."}
                  {syncProgress[acc.id].phase==="error"&&"Sync failed."}
                </span>
                <span style={{color:"#94a3b8"}}>
                  {(syncProgress[acc.id].phase==="processing"||syncProgress[acc.id].phase==="review"||syncProgress[acc.id].phase==="done")&&`Left ${Math.max(0,syncProgress[acc.id].remaining||0)}`}
                </span>
              </div>
              {Number(syncProgress[acc.id].total)>0&&(
                <div style={{height:6,background:"#1e293b",borderRadius:4,overflow:"hidden"}}>
                  <div style={{height:"100%",background:"#6366f1",width:`${Math.min(100,Math.round(((syncProgress[acc.id].processed||0)/(syncProgress[acc.id].total||1))*100))}%`,transition:"width .15s linear"}}/>
                </div>
              )}
              {(Number(syncProgress[acc.id].failed)>0||Number(syncProgress[acc.id].skipped)>0)&&<div style={{marginTop:6,fontSize:11,color:"#64748b"}}>Failed = processing error/API issue. Skipped = no financial transaction extracted.</div>}
              {Number(syncProgress[acc.id].failed)>0&&formatFailureSummary(syncProgress[acc.id].failureReasons||{})&&(
                <div style={{marginTop:4,fontSize:11,color:"#94a3b8"}}>
                  Failure reasons: {formatFailureSummary(syncProgress[acc.id].failureReasons||{})}
                </div>
              )}
            </div>
          )}
          {logs[acc.id]&&<div style={{background:"#0a0f1d",border:"1px solid #1e293b",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#c7d2fe",marginBottom:acc._open?10:0}}>{logs[acc.id]}</div>}
          {acc._open&&(
            <div style={{background:"#0a0f1d",border:"1px solid #1e293b",borderRadius:10,padding:14,marginTop:8}}>
              <div style={{fontSize:11,fontWeight:700,color:"#475569",marginBottom:10,textTransform:"uppercase"}}>Sync Preferences</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div><label>Account Label</label><input value={acc.label||""} onChange={e=>setEmails(p=>p.map(a=>a.id===acc.id?{...a,label:e.target.value}:a))} placeholder="Business email account"/></div>
                <div><label>Max emails per sync</label><input type="number" min="1" max="5000" value={acc.maxEmails||100} onChange={e=>setEmails(p=>p.map(a=>a.id===acc.id?{...a,maxEmails:Number(e.target.value)}:a))}/></div>
                {provider==="google"&&<div><label>Search Query</label><input value={acc.syncQuery||GMAIL_QUERY} onChange={e=>setEmails(p=>p.map(a=>a.id===acc.id?{...a,syncQuery:e.target.value}:a))}/></div>}
                <div><label>Post destination</label><select value={acc.autoPost===false?"inbox":"dashboard"} onChange={e=>setEmails(p=>p.map(a=>a.id===acc.id?{...a,autoPost:e.target.value==="dashboard"}:a))}><option value="dashboard">Dashboard (after review modal)</option><option value="inbox">Inbox (after review modal)</option></select></div>
              </div>
              {provider==="microsoft"&&<div style={{fontSize:11,color:"#64748b",marginTop:8}}>Outlook sync scans inbox messages from selected date. Search query is only for Gmail.</div>}
              <div style={{fontSize:11,color:"#64748b",marginTop:8}}>First sync asks for a start date. AI scans emails from that date and pre-fills income/expense fields for your review.</div>
            </div>
          )}
        </div>
      )})}

      {firstSyncPrompt&&<EmailFirstSyncModal value={firstSyncPrompt.fromDate} onClose={()=>setFirstSyncPrompt(null)} onStart={(fromDate)=>{
        const acc=emails.find(a=>a.id===firstSyncPrompt.accId);
        if(acc)runSync(acc,{scanAll:firstSyncPrompt.scanAll,fromDate,markFirstSync:!acc.firstSyncCompleted});
        setFirstSyncPrompt(null);
      }}/>}
      {reviewState&&<EmailReviewModal acts={acts} cats={cats} initialItems={reviewState.items} onClose={()=>setReviewState(null)} onSubmit={submitReview}/>}
    </div>
  );
}

function EmailFirstSyncModal({value,onClose,onStart}){
  const[fromDate,setFromDate]=useState(value||new Date(Date.now()-90*24*60*60*1000).toISOString().slice(0,10));
  return(
    <div className="overlay"><div className="modal" style={{maxWidth:520}}>
      <MH title="First Sync Date" onClose={onClose}/>
      <div style={{fontSize:13,color:"#94a3b8",lineHeight:1.7,marginBottom:10}}>
        Choose the starting date. LedgerAI will scan all emails from this date to today and use AI to extract income/expense transactions.
      </div>
      <label>Sync from date</label>
      <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} max={today()}/>
      <div style={{display:"flex",gap:10,marginTop:18}}>
        <button className="btn ghost" style={{flex:1}} onClick={onClose}>Cancel</button>
        <button className="btn pri" style={{flex:2}} onClick={()=>{if(!fromDate)return alert("Select a date.");onStart(fromDate);}}>Start Sync</button>
      </div>
    </div></div>
  );
}

function EmailReviewModal({initialItems,acts,cats,onClose,onSubmit}){
  const normalize=(i)=>{
    const act=i.businessActivity||acts[0]||"Personal";
    const cat=i.category||cats[act]?.[0]||"Other";
    return{...i,type:i.type==="income"?"income":"expense",businessActivity:act,category:cat,date:i.date||today(),amount:Number(i.amount)||0,description:i.description||i.vendor||cat,paymentMethod:i.paymentMethod||""};
  };
  const[rows,setRows]=useState(()=>initialItems.map(normalize));
  const update=(idx,patch)=>setRows(p=>p.map((r,i)=>i===idx?{...r,...patch}:r));
  const remove=(idx)=>setRows(p=>p.filter((_,i)=>i!==idx));
  return(
    <div className="overlay"><div className="modal" style={{maxWidth:980}}>
      <MH title={`Review AI Extraction (${rows.length})`} onClose={onClose}/>
      <div style={{fontSize:12,color:"#64748b",marginBottom:12}}>Edit any field before posting. This is where you confirm business activity/category accuracy.</div>
      <div style={{maxHeight:"58vh",overflowY:"auto",display:"grid",gap:10,paddingRight:4}}>
        {rows.map((r,i)=>(
          <div key={`${r.emailMsgId||"m"}-${i}`} style={{border:"1px solid #1e293b",borderRadius:10,padding:10,background:"#0a0f1d"}}>
            <div style={{display:"grid",gridTemplateColumns:"110px 120px 120px 1fr 1fr",gap:8,marginBottom:8}}>
              <div><label>Type</label><select value={r.type} onChange={e=>update(i,{type:e.target.value})}><option value="expense">Expense</option><option value="income">Income</option></select></div>
              <div><label>Date</label><input type="date" value={r.date||""} onChange={e=>update(i,{date:e.target.value})}/></div>
              <div><label>Amount</label><input type="number" value={r.amount||""} onChange={e=>update(i,{amount:Number(e.target.value)})}/></div>
              <div><label>Business</label><select value={r.businessActivity||acts[0]||""} onChange={e=>update(i,{businessActivity:e.target.value,category:cats[e.target.value]?.[0]||r.category||"Other"})}>{acts.map(a=><option key={a} value={a}>{a}</option>)}</select></div>
              <div><label>Category</label><input list={`cat-${i}`} value={r.category||""} onChange={e=>update(i,{category:e.target.value})}/><datalist id={`cat-${i}`}>{(cats[r.businessActivity]||[]).map(c=><option key={c} value={c}/>)}</datalist></div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr auto",gap:8,alignItems:"end"}}>
              <div><label>Description</label><input value={r.description||""} onChange={e=>update(i,{description:e.target.value})}/></div>
              <div><label>Vendor</label><input value={r.vendor||""} onChange={e=>update(i,{vendor:e.target.value})}/></div>
              <div><label>Payment</label><select value={r.paymentMethod||""} onChange={e=>update(i,{paymentMethod:e.target.value})}><option value="">Select</option>{PAY_METHODS.map(m=><option key={m} value={m}>{m}</option>)}</select></div>
              <button className="btn sm dan" onClick={()=>remove(i)}>Remove</button>
            </div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:10,marginTop:14}}>
        <button className="btn ghost" style={{flex:1}} onClick={onClose}>Cancel</button>
        <button className="btn ghost" style={{flex:1}} onClick={()=>onSubmit(rows,"inbox")}>Send to Inbox</button>
        <button className="btn pri" style={{flex:2}} onClick={()=>onSubmit(rows,"dashboard")}>Approve & Add to Dashboard</button>
      </div>
    </div></div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function DashTab({byAct,totInc,totExp,todInc,todExp,txns,todayTxns,inbox,emails,onEdit,onDelete}){
  const max=Math.max(...byAct.map(a=>Math.max(a.inc,a.exp)),1);
  const epend=inbox.filter(i=>i.source==="email").length;
  return(<div>
    <R style={{marginBottom:10}}>
      <h2 className="h2" style={{flex:1}}>Overview</h2>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {inbox.length>0&&<div style={{background:"#0d0d2b",border:"1px solid #6366f1",borderRadius:8,padding:"5px 12px",fontSize:12,color:"#c7d2fe"}}>⏳ {inbox.length} pending{epend>0?` (${epend} email)`:""}</div>}
        {emails.length>0&&<div style={{background:"#052e16",border:"1px solid #34d399",borderRadius:8,padding:"5px 12px",fontSize:12,color:"#34d399"}}>📧 {emails.filter(a=>a.connected).length}/{emails.length} connected</div>}
      </div>
    </R>
    <div className="g4" style={{marginBottom:18}}>
      {[{l:"Total Income",v:totInc,c:"#34d399",s:`Today ${fmt(todInc)}`},{l:"Total Expenses",v:totExp,c:"#f87171",s:`Today ${fmt(todExp)}`},{l:"Net P&L",v:totInc-totExp,c:totInc-totExp>=0?"#34d399":"#f87171",s:"All time"},{l:"Transactions",v:txns.length,c:"#818cf8",s:`Today: ${todayTxns.length}`,nf:true}].map(s=>(
        <div key={s.l} className="sc"><div className="lxs">{s.l}</div><div className="mono" style={{fontSize:24,fontWeight:700,color:s.c,margin:"6px 0 2px"}}>{s.nf?s.v:fmt(s.v)}</div><div style={{fontSize:11,color:"#475569"}}>{s.s}</div></div>
      ))}
    </div>
    <div className="sh" style={{marginBottom:10}}>By Business Activity</div>
    <div style={{display:"grid",gap:8,marginBottom:22}}>
      {byAct.map(a=>(
        <div key={a.a} className="card" style={{padding:"12px 16px"}}>
          <R style={{marginBottom:6}}><span style={{fontSize:13,fontWeight:500,color:a.a==="Personal"?"#c084fc":"#e2e8f0",flex:1}}>{a.a}</span>
            <span className="mono" style={{fontSize:12,color:"#34d399",marginRight:10}}>{fmt(a.inc)}</span>
            <span className="mono" style={{fontSize:12,color:"#f87171",marginRight:10}}>{fmt(a.exp)}</span>
            <span className="mono" style={{fontSize:12,color:a.inc-a.exp>=0?"#818cf8":"#f59e0b"}}>{fmt(a.inc-a.exp)}</span>
          </R>
          {[["#34d399",a.inc,"Inc"],["#f87171",a.exp,"Exp"]].map(([c,v,l])=>(
            <div key={l} style={{display:"flex",gap:8,alignItems:"center",marginBottom:2}}>
              <div style={{width:28,fontSize:10,color:"#475569"}}>{l}</div>
              <div style={{flex:1,background:"#1e293b",borderRadius:3,height:4,overflow:"hidden"}}><div style={{height:"100%",background:c,borderRadius:3,width:`${(v/max)*100}%`,transition:"width .3s"}}/></div>
            </div>
          ))}
        </div>
      ))}
    </div>
    <div className="sh" style={{marginBottom:10}}>Recent Transactions</div>
    <TxTable txns={txns.slice(0,10)} onEdit={onEdit} onDelete={onDelete}/>
  </div>);
}

// ── LEDGER ────────────────────────────────────────────────────────────────────
function LedgerTab({txns,filter,setFilter,acts,onEdit,onDelete}){
  const fInc=txns.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0);
  const fExp=txns.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
  return(<div>
    <h2 className="h2" style={{marginBottom:14}}>Transaction Ledger</h2>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
      <select style={{width:"auto"}} value={filter.activity} onChange={e=>setFilter(p=>({...p,activity:e.target.value}))}>
        <option value="All">All Activities</option>{acts.map(a=><option key={a}>{a}</option>)}
      </select>
      <select style={{width:"auto"}} value={filter.type} onChange={e=>setFilter(p=>({...p,type:e.target.value}))}>
        <option value="All">All Types</option><option value="income">Income</option><option value="expense">Expense</option><option value="borrow">Borrowed Cash</option>
      </select>
      <input type="date" style={{width:"auto"}} value={filter.from} onChange={e=>setFilter(p=>({...p,from:e.target.value}))}/>
      <input type="date" style={{width:"auto"}} value={filter.to} onChange={e=>setFilter(p=>({...p,to:e.target.value}))}/>
      <button className="btn sm ghost" onClick={()=>setFilter({activity:"All",type:"All",from:"",to:""})}>Clear</button>
    </div>
    <div style={{fontSize:12,color:"#475569",marginBottom:10}}>{txns.length} entries · <span style={{color:"#34d399"}}>{fmt(fInc)}</span> · <span style={{color:"#f87171"}}>{fmt(fExp)}</span> · <span style={{color:"#818cf8"}}>{fmt(fInc-fExp)}</span></div>
    <TxTable txns={txns} onEdit={onEdit} onDelete={onDelete}/>
  </div>);
}

// ── INBOX ─────────────────────────────────────────────────────────────────────
function InboxTab({inbox,addInbox,acts,cats,onApprove,onEdit,onDiscard}){
  const[bulk,setBulk]=useState("");
  const[loading,setLoading]=useState(false);
  const runBatch=async()=>{if(!bulk.trim())return;setLoading(true);const items=await aiExtractBatch(bulk,acts,cats);addInbox(items.map(i=>({...i,type:i.type||"expense"})));setBulk("");setLoading(false);};
  const todItems=inbox.filter(i=>i.date===today());
  const oldItems=inbox.filter(i=>i.date!==today());
  const emailItems=inbox.filter(i=>i.source==="email");
  return(<div>
    <h2 className="h2" style={{marginBottom:4}}>Inbox — Review & Approve</h2>
    <p style={{fontSize:13,color:"#64748b",marginBottom:18}}>Transactions from email auto-import, SMS paste, or statement reconciliation appear here before entering the ledger.</p>
    {emailItems.length>0&&<div style={{background:"#052e16",border:"1px solid #34d399",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#86efac"}}>📧 <b>{emailItems.length}</b> transaction(s) auto-extracted from email — review below.</div>}
    <div className="card" style={{marginBottom:22}}>
      <div style={{fontWeight:600,fontSize:14,marginBottom:10,color:"#94a3b8"}}>📥 Manual Paste (SMS / Bank Alerts)</div>
      <textarea rows={4} value={bulk} onChange={e=>setBulk(e.target.value)} placeholder="Paste bank SMS, UPI alerts, Kite messages…"/>
      <button className="btn pri" style={{marginTop:10,width:"100%"}} onClick={runBatch} disabled={loading||!bulk.trim()}>{loading?"🤖 Extracting…":"🤖 Extract & Queue for Review"}</button>
    </div>
    {inbox.length===0&&<div className="card" style={{textAlign:"center",color:"#475569",padding:40}}>No pending items. Sync email accounts or paste messages above.</div>}
    {todItems.length>0&&<><R style={{marginBottom:10}}><div className="sh">Today ({todItems.length})</div><button className="btn sm suc" onClick={()=>todItems.forEach(onApprove)}>✓ Approve All Today</button></R>{todItems.map(item=><ICard key={item._iid} item={item} onApprove={onApprove} onEdit={onEdit} onDiscard={onDiscard}/>)}</>}
    {oldItems.length>0&&<><div className="sh" style={{marginTop:20,marginBottom:10}}>Older ({oldItems.length})</div>{oldItems.map(item=><ICard key={item._iid} item={item} onApprove={onApprove} onEdit={onEdit} onDiscard={onDiscard}/>)}</>}
  </div>);
}

function ICard({item,onApprove,onEdit,onDiscard}){
  const[ex,setEx]=useState(false);
  const typeColor=item.type==="income"?"#34d399":item.type==="borrow"?"#f59e0b":"#f87171";
  return(
    <div className="card" style={{marginBottom:8,borderLeft:`3px solid ${typeColor}`}}>
      <R style={{marginBottom:8}}>
        <div style={{flex:1}}>
          <div style={{display:"flex",gap:6,marginBottom:3,flexWrap:"wrap",alignItems:"center"}}>
            <span className={`tag t${item.type}`}>{item.type}</span>
            {item.isNewCategory&&<span className="tag" style={{background:"#1e1b4b",color:"#a78bfa"}}>New Cat</span>}
            {item.source==="email"&&<span className="tag" style={{background:"#1a2010",color:"#86efac"}}>📧 Email</span>}
            {item.source==="statement"&&<span className="tag" style={{background:"#052e16",color:"#34d399"}}>Stmt</span>}
            {item.source==="auto"&&<span className="tag" style={{background:"#0d0d2b",color:"#818cf8"}}>AI</span>}
            <span style={{fontSize:11,color:"#64748b"}}>{fmtD(item.date)}</span>
          </div>
          <div style={{fontWeight:500,fontSize:14}}>{item.description||item.category}</div>
          <div style={{fontSize:12,color:"#475569"}}>{item.businessActivity} · {item.category}{item.vendor?` · ${item.vendor}`:""}{item.paymentMethod?` · ${item.paymentMethod}`:""}{item.accountName?` · ${item.accountName}`:""}{item.borrowSource?` · Borrowed from ${item.borrowSource}`:""}</div>
          {item.emailSubject&&<div style={{fontSize:11,color:"#374151",marginTop:3,cursor:"pointer"}} onClick={()=>setEx(!ex)}>📧 {item.emailSubject.slice(0,60)}{item.emailSubject.length>60?"…":""} {ex?"▲":"▼"}</div>}
          {ex&&item.emailFrom&&<div style={{fontSize:11,color:"#374151",marginTop:2}}>From: {item.emailFrom}</div>}
        </div>
        <div className="mono" style={{fontSize:20,fontWeight:700,color:typeColor,whiteSpace:"nowrap",marginLeft:12}}>{fmt(item.amount)}</div>
      </R>
      <div style={{display:"flex",gap:8}}>
        <button className="btn sm suc" onClick={()=>onApprove(item)}>✓ Approve</button>
        <button className="btn sm ghost" onClick={()=>onEdit(item)}>✏ Edit</button>
        <button className="btn sm dan" onClick={()=>onDiscard(item._iid)}>✕ Discard</button>
      </div>
    </div>
  );
}

// ── JOURNAL ───────────────────────────────────────────────────────────────────
function JournalTab({txns}){
  return(<div>
    <h2 className="h2" style={{marginBottom:14}}>Journal Entries</h2>
    <div className="card" style={{padding:0,overflow:"hidden"}}>
      <div style={{display:"grid",gridTemplateColumns:"88px 1fr 90px 90px",gap:6,padding:"8px 14px",background:"#0a0c12",fontSize:10,color:"#475569",fontWeight:700,textTransform:"uppercase"}}>
        <span>Date</span><span>Account</span><span style={{textAlign:"right"}}>Dr</span><span style={{textAlign:"right"}}>Cr</span>
      </div>
      {txns.length===0&&<div style={{padding:40,textAlign:"center",color:"#475569"}}>No entries yet.</div>}
      {txns.map(tx=>(
        <div key={tx.id} style={{borderBottom:"1px solid #0d0f17"}}>
          <div style={{padding:"10px 14px 4px",display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",background:"#111827"}}>
            <span style={{fontFamily:"DM Mono",fontSize:11,color:"#6366f1"}}>{fmtD(tx.date)}</span>
            <span style={{fontWeight:500,fontSize:13}}>{tx.description||tx.category}</span>
            <span className={`tag t${tx.type}`}>{tx.type}</span>
            {tx.source==="email"&&<span style={{fontSize:10,background:"#1a2010",color:"#86efac",padding:"1px 5px",borderRadius:3}}>📧</span>}
            {tx.source==="auto"&&<span style={{fontSize:10,background:"#1e1b4b",color:"#818cf8",padding:"1px 5px",borderRadius:3}}>AI</span>}
            {tx.source==="statement"&&<span style={{fontSize:10,background:"#052e16",color:"#34d399",padding:"1px 5px",borderRadius:3}}>Stmt</span>}
          </div>
          {(tx.journalEntries||[]).map((e,i)=>(
            <div key={i} style={{display:"grid",gridTemplateColumns:"88px 1fr 90px 90px",gap:6,padding:"2px 14px",fontSize:12}}>
              <span/><span style={{color:e.dr>0?"#e2e8f0":"#64748b",paddingLeft:e.dr===0?18:0}}>{e.account}</span>
              <span className="mono" style={{textAlign:"right",color:"#34d399"}}>{e.dr>0?fmt(e.dr):""}</span>
              <span className="mono" style={{textAlign:"right",color:"#f87171"}}>{e.cr>0?fmt(e.cr):""}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  </div>);
}

// ── ACCOUNTS ──────────────────────────────────────────────────────────────────
function AccountsTab({accs,setAccs,txns,addInbox,acts,cats}){
  const[showForm,setShowForm]=useState(false);
  const[reconId,setReconId]=useState(null);
  const assets=accs.filter(a=>a.cls==="asset");
  const liabs=accs.filter(a=>a.cls==="liability");
  return(<div>
    <R style={{marginBottom:18}}><h2 className="h2" style={{flex:1}}>Accounts & Balances</h2><button className="btn sm pri" onClick={()=>setShowForm(true)}>+ Add Account</button></R>
    <div className="g4" style={{marginBottom:18}}>
      {[{l:"Total Assets",v:assets.reduce((s,a)=>s+(a.balance||0),0),c:"#34d399"},{l:"Total Liabilities",v:liabs.reduce((s,a)=>s+(a.balance||0),0),c:"#f87171"},{l:"Net Worth",v:assets.reduce((s,a)=>s+(a.balance||0),0)-liabs.reduce((s,a)=>s+(a.balance||0),0),c:"#818cf8"}].map(s=>(
        <div key={s.l} className="sc"><div className="lxs">{s.l}</div><div className="mono" style={{fontSize:22,color:s.c,marginTop:6}}>{fmt(s.v)}</div></div>
      ))}
    </div>
    {[["Assets",assets,"#34d399"],["Liabilities",liabs,"#f87171"]].map(([lbl,list,c])=>(
      <div key={lbl} style={{marginBottom:22}}>
        <div className="sh" style={{marginBottom:10}}>{lbl}</div>
        {list.length===0&&<div style={{color:"#475569",fontSize:13}}>No {lbl.toLowerCase()} yet.</div>}
        {list.map(acc=>(
          <div key={acc.id} className="card" style={{marginBottom:8,padding:"12px 16px"}}><R>
            <div style={{flex:1}}><div style={{fontWeight:500,fontSize:14}}>{acc.name}</div><div style={{fontSize:12,color:"#475569"}}>{acc.typeName}{acc.bank?` · ${acc.bank}`:""}{acc.number?` · ···${acc.number.slice(-4)}`:""}</div></div>
            <div className="mono" style={{fontSize:16,fontWeight:700,color:c,marginRight:12}}>{fmt(acc.balance||0)}</div>
            <button className="btn sm" style={{background:"#1a2234",color:"#818cf8",marginRight:6}} onClick={()=>setReconId(acc.id)}>📂 Reconcile</button>
            <button className="btn sm dan" onClick={()=>setAccs(p=>p.filter(a=>a.id!==acc.id))}>✕</button>
          </R></div>
        ))}
      </div>
    ))}
    {showForm&&<AddAccModal onSave={a=>{setAccs(p=>[...p,{...a,id:gid()}]);setShowForm(false);}} onClose={()=>setShowForm(false)}/>}
    {reconId&&<ReconModal account={accs.find(a=>a.id===reconId)} txns={txns} acts={acts} addInbox={addInbox} onClose={()=>setReconId(null)}/>}
  </div>);
}

function AddAccModal({onSave,onClose}){
  const[f,setF]=useState({name:"",type:"savings",number:"",bank:"",balance:""});
  const t=ACC_TYPES.find(x=>x.key===f.type)||ACC_TYPES[0];
  return(<div className="overlay"><div className="modal" style={{maxWidth:440}}>
    <MH title="Add Account" onClose={onClose}/>
    <label>Account Type</label><select value={f.type} onChange={e=>setF(p=>({...p,type:e.target.value}))}>{ACC_TYPES.map(x=><option key={x.key} value={x.key}>{x.label} ({x.cls})</option>)}</select>
    <label>Account Name</label><input value={f.name} onChange={e=>setF(p=>({...p,name:e.target.value}))} placeholder="e.g. HDFC Savings"/>
    <label>Bank / Institution</label><input value={f.bank} onChange={e=>setF(p=>({...p,bank:e.target.value}))} placeholder="HDFC, Zerodha…"/>
    <label>Account Number (last 4)</label><input value={f.number} onChange={e=>setF(p=>({...p,number:e.target.value}))} placeholder="Optional"/>
    <label>Opening Balance (₹)</label><input type="number" value={f.balance} onChange={e=>setF(p=>({...p,balance:e.target.value}))} placeholder="0"/>
    <div style={{display:"flex",gap:10,marginTop:18}}>
      <button className="btn ghost" onClick={onClose} style={{flex:1}}>Cancel</button>
      <button className="btn pri" style={{flex:2}} onClick={()=>{if(!f.name)return alert("Enter account name");onSave({...f,cls:t.cls,typeName:t.label,balance:Number(f.balance)||0});}}>Add Account</button>
    </div>
  </div></div>);
}

function ReconModal({account,txns,acts,addInbox,onClose}){
  const[csv,setCsv]=useState("");const[load,setLoad]=useState(false);const[res,setRes]=useState(null);
  const parse=async()=>{
    setLoad(true);
    const rows=await aiParseStatement(csv,account.name,account.typeName);
    const matched=[],unmatched=[],suspicious=[];
    rows.forEach(row=>{
      const cands=txns.filter(t=>Math.abs(new Date(t.date)-new Date(row.date))/864e5<=3&&amtClose(t.amount,row.amount));
      if(cands.length>0){const best=cands.sort((a,b)=>strSim(b.description||"",row.description)-strSim(a.description||"",row.description))[0];matched.push({row,tx:best,conf:strSim(best.description||"",row.description)});}
      else unmatched.push(row);
    });
    txns.filter(t=>t.accountId===account.id||t.paymentMethod===account.typeName).forEach(tx=>{
      if(!matched.find(m=>m.tx?.id===tx.id)&&!rows.some(r=>Math.abs(new Date(tx.date)-new Date(r.date))/864e5<=3&&amtClose(tx.amount,r.amount)))suspicious.push(tx);
    });
    setRes({matched,unmatched,suspicious});setLoad(false);
  };
  const importUnmatched=()=>{addInbox(res.unmatched.map(row=>({type:row.type==="credit"?"income":"expense",date:row.date,description:row.description,amount:row.amount,vendor:"",businessActivity:acts[0]||"",category:"Other",paymentMethod:account.typeName,accountId:account.id,source:"statement"})));onClose();};
  return(<div className="overlay"><div className="modal" style={{maxWidth:660}}>
    <MH title={`Reconcile: ${account.name}`} onClose={onClose}/>
    {!res&&<><p style={{fontSize:13,color:"#64748b",marginBottom:12}}>Paste bank/card statement to auto-match against your ledger.</p>
    <textarea rows={8} value={csv} onChange={e=>setCsv(e.target.value)} placeholder="Paste statement CSV or raw text…"/>
    <button className="btn pri" style={{marginTop:12,width:"100%"}} onClick={parse} disabled={load||!csv.trim()}>{load?"🤖 Reconciling…":"🤖 Parse & Reconcile"}</button></>}
    {res&&<>
      <div className="g2" style={{marginBottom:14,gap:10}}>
        {[{l:"Matched",v:res.matched.length,c:"#34d399"},{l:"Not in ledger",v:res.unmatched.length,c:"#f59e0b"},{l:"Suspicious",v:res.suspicious.length,c:"#f87171"}].map(s=>(
          <div key={s.l} style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:8,padding:"10px 14px"}}><div style={{fontSize:11,color:"#475569"}}>{s.l}</div><div className="mono" style={{fontSize:22,color:s.c,fontWeight:700}}>{s.v}</div></div>
        ))}
      </div>
      {res.unmatched.length>0&&<><div style={{fontWeight:600,fontSize:13,color:"#f59e0b",marginBottom:8}}>⚠ Not in ledger</div>
        <div style={{maxHeight:160,overflowY:"auto",marginBottom:10}}>{res.unmatched.map((row,i)=><div key={i} style={{display:"flex",gap:8,padding:"6px 10px",background:"#0f172a",borderRadius:6,marginBottom:3,fontSize:13}}><span style={{color:"#64748b",width:80,flexShrink:0}}>{fmtD(row.date)}</span><span style={{flex:1}}>{row.description}</span><span className="mono" style={{color:row.type==="credit"?"#34d399":"#f87171"}}>{fmt(row.amount)}</span></div>)}</div>
        <button className="btn suc" style={{width:"100%",marginBottom:14}} onClick={importUnmatched}>📥 Send All to Inbox for Review</button>
      </>}
      {res.suspicious.length>0&&<><div style={{fontWeight:600,fontSize:13,color:"#f87171",marginBottom:8}}>🔴 In ledger but not in statement</div>
        {res.suspicious.map(tx=><div key={tx.id} style={{display:"flex",gap:8,padding:"6px 10px",background:"#150505",border:"1px solid #3f1010",borderRadius:6,marginBottom:3,fontSize:13}}><span style={{color:"#64748b",width:80}}>{fmtD(tx.date)}</span><span style={{flex:1}}>{tx.description||tx.category}</span><span className="mono" style={{color:"#f87171"}}>{fmt(tx.amount)}</span></div>)}
      </>}
      <div style={{display:"flex",gap:10,marginTop:14}}>
        <button className="btn ghost" onClick={()=>setRes(null)} style={{flex:1}}>← Re-parse</button>
        <button className="btn ghost" onClick={onClose} style={{flex:1}}>Done</button>
      </div>
    </>}
  </div></div>);
}

// ── REPORTS ───────────────────────────────────────────────────────────────────
function ReportsTab({txns,acts,totInc,totExp}){
  const dr=txns.filter(t=>t.type==="expense"&&t.businessActivity==="Personal");
  const drT=dr.reduce((s,t)=>s+t.amount,0);
  const catMap={};txns.filter(t=>t.type==="expense").forEach(t=>{catMap[t.category]=(catMap[t.category]||0)+t.amount;});
  const cats=Object.entries(catMap).sort((a,b)=>b[1]-a[1]);
  const maxC=cats[0]?.[1]||1;
  const emailTxns=txns.filter(t=>t.source==="email");
  return(<div>
    <h2 className="h2" style={{marginBottom:18}}>Reports</h2>
    <div className="g2" style={{gap:18}}>
      <div className="card">
        <div style={{fontWeight:600,fontSize:14,marginBottom:14,color:"#94a3b8",borderBottom:"1px solid #1e293b",paddingBottom:10}}>Profit & Loss</div>
        {acts.filter(a=>a!=="Personal").map(a=>{const inc=txns.filter(t=>t.type==="income"&&t.businessActivity===a).reduce((s,t)=>s+t.amount,0);const exp=txns.filter(t=>t.type==="expense"&&t.businessActivity===a).reduce((s,t)=>s+t.amount,0);if(!inc&&!exp)return null;return<div key={a} style={{marginBottom:8}}><div style={{fontSize:11,color:"#64748b",fontWeight:600}}>{a}</div><div style={{display:"flex",gap:12,paddingLeft:8,fontSize:12}}><span className="mono" style={{color:"#34d399"}}>Inc {fmt(inc)}</span><span className="mono" style={{color:"#f87171"}}>Exp {fmt(exp)}</span><span className="mono" style={{color:inc-exp>=0?"#818cf8":"#f59e0b"}}>Net {fmt(inc-exp)}</span></div></div>;})}
        <div style={{borderTop:"1px solid #1e293b",marginTop:10,paddingTop:10}}>
          <R style={{marginBottom:4}}><span style={{fontWeight:600,fontSize:13}}>Total Income</span><span className="mono" style={{color:"#34d399"}}>{fmt(totInc)}</span></R>
          <R style={{marginBottom:4}}><span style={{fontWeight:600,fontSize:13}}>Total Expenses</span><span className="mono" style={{color:"#f87171"}}>{fmt(totExp)}</span></R>
          <div style={{background:totInc-totExp>=0?"#052e16":"#450a0a",borderRadius:8,padding:"10px 12px",marginTop:8,display:"flex",justifyContent:"space-between",fontWeight:700}}>
            <span>Net Profit / Loss</span><span className="mono" style={{color:totInc-totExp>=0?"#34d399":"#f87171"}}>{fmt(totInc-totExp)}</span>
          </div>
        </div>
      </div>
      <div className="card">
        <div style={{fontWeight:600,fontSize:14,marginBottom:14,color:"#94a3b8",borderBottom:"1px solid #1e293b",paddingBottom:10}}>Personal Drawings</div>
        <div className="mono" style={{fontSize:28,fontWeight:700,color:"#c084fc",marginBottom:14}}>{fmt(drT)}</div>
        {Object.entries(dr.reduce((m,t)=>{m[t.category]=(m[t.category]||0)+t.amount;return m;},{})).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=><R key={cat} style={{padding:"3px 0",fontSize:13}}><span style={{color:"#94a3b8"}}>{cat}</span><span className="mono" style={{color:"#c084fc"}}>{fmt(amt)}</span></R>)}
        {dr.length===0&&<div style={{color:"#475569",fontSize:13}}>No drawings yet.</div>}
      </div>
      <div className="card">
        <div style={{fontWeight:600,fontSize:14,marginBottom:14,color:"#94a3b8",borderBottom:"1px solid #1e293b",paddingBottom:10}}>Email Auto-Imports</div>
        <div className="mono" style={{fontSize:28,fontWeight:700,color:"#86efac",marginBottom:8}}>{emailTxns.length}</div>
        <div style={{fontSize:13,color:"#64748b",marginBottom:10}}>transactions from email</div>
        <R style={{fontSize:13}}><span style={{color:"#94a3b8"}}>Expenses</span><span className="mono" style={{color:"#f87171"}}>{fmt(emailTxns.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0))}</span></R>
        <R style={{fontSize:13}}><span style={{color:"#94a3b8"}}>Income</span><span className="mono" style={{color:"#34d399"}}>{fmt(emailTxns.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0))}</span></R>
      </div>
      <div className="card" style={{gridColumn:"1/-1"}}>
        <div style={{fontWeight:600,fontSize:14,marginBottom:14,color:"#94a3b8",borderBottom:"1px solid #1e293b",paddingBottom:10}}>Expenses by Category</div>
        {cats.map(([cat,amt])=><div key={cat} style={{marginBottom:8}}><R style={{marginBottom:3}}><span style={{fontSize:12,color:"#94a3b8"}}>{cat}</span><span className="mono" style={{fontSize:12,color:"#f87171"}}>{fmt(amt)}</span></R><div style={{background:"#1e293b",borderRadius:3,height:5,overflow:"hidden"}}><div style={{height:"100%",background:"#f87171",borderRadius:3,width:`${(amt/maxC)*100}%`}}/></div></div>)}
        {cats.length===0&&<div style={{color:"#475569",fontSize:13}}>No expenses yet.</div>}
      </div>
    </div>
  </div>);
}

// ── CLOUD BACKUP TAB (OneDrive) ───────────────────────────────────────────────
function CloudTab({sbCfg,setSbCfg,syncStatus,lastSync,onSync,onLoad,txns,setTxns,inbox,setInbox,accs,setAccs,acts,setActs,cats,setCats,smsNums,setSmsNums,emails,setEmails}){
  const[clientId,setClientId]=useState(sbCfg.clientId||"");
  const[connecting,setConnecting]=useState(false);
  const[showGuide,setShowGuide]=useState(false);
  const[versions,setVersions]=useState([]);
  const[loadingVer,setLoadingVer]=useState(false);
  const[exportPrev,setExportPrev]=useState(null);

  const dataSize=()=>(JSON.stringify({txns,inbox,accs,acts,cats,smsNums}).length/1024).toFixed(1)+"KB";

  const connect=async()=>{
    const resolvedClientId=(clientId||sbCfg.clientId||DEFAULT_MICROSOFT_CLIENT_ID||"").trim();
    if(!resolvedClientId){
      alert("Microsoft connector is not configured. Admin: set VITE_MICROSOFT_CLIENT_ID or enter Azure Application (Client) ID here.");
      return;
    }
    setConnecting(true);
    try{
      const account=await odLogin(resolvedClientId);
      const profile=await odGetProfile(resolvedClientId);
      setClientId(resolvedClientId);
      setSbCfg({clientId:resolvedClientId,email:profile.mail||profile.userPrincipalName,name:profile.displayName,enabled:true,needsReconnect:false});
      // Attempt first sync
      await onSync({});
    }catch(e){
      alert("Connection failed: "+e.message);
    }
    setConnecting(false);
  };

  const disconnect=async()=>{
    if(!window.confirm("Disconnect OneDrive? Your data stays in OneDrive — you can reconnect anytime."))return;
    try{if(sbCfg.clientId)await odSignOut(sbCfg.clientId);}catch{}
    setSbCfg({clientId:"",email:"",name:"",enabled:false});
  };

  const loadVersionHistory=async()=>{
    if(!sbCfg.clientId)return;
    setLoadingVer(true);
    try{const v=await odListVersions(sbCfg.clientId);setVersions(v);}
    catch{setVersions([]);}
    setLoadingVer(false);
  };

  const exportJSON=()=>{
    const payload={exportedAt:new Date().toISOString(),version:4,txns,inbox,accs,acts,cats,smsNums,emailAccounts:emails.map(a=>({...a,token:undefined}))};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);
    a.download=`ledgerai-backup-${today()}.json`;a.click();
  };

  const importJSON=(e)=>{
    const file=e.target.files?.[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{try{setExportPrev(JSON.parse(ev.target.result));}catch{alert("Invalid backup file.");}};
    reader.readAsText(file);e.target.value="";
  };

  const confirmImport=()=>{
    if(!exportPrev)return;
    if(exportPrev.txns)setTxns(exportPrev.txns);
    if(exportPrev.inbox)setInbox(exportPrev.inbox);
    if(exportPrev.accs)setAccs(exportPrev.accs);
    if(exportPrev.acts)setActs(exportPrev.acts);
    if(exportPrev.cats)setCats(exportPrev.cats);
    if(exportPrev.smsNums)setSmsNums(exportPrev.smsNums);
    if(exportPrev.emailAccounts)setEmails(exportPrev.emailAccounts.map(a=>({...a,token:undefined})));
    setExportPrev(null);
    alert("✓ Restored from backup.");
  };

  return(
    <div>
      <R style={{marginBottom:4}}>
        <div>
          <h2 className="h2" style={{marginBottom:2}}>☁ OneDrive Backup & Sync</h2>
          <div style={{fontSize:12,color:"#475569"}}>Your data lives in <b style={{color:"#818cf8"}}>your own Microsoft OneDrive</b> — you own it, you control it.</div>
        </div>
        {sbCfg.enabled&&<div style={{display:"flex",gap:8}}>
          <button className="btn sm ghost" onClick={onLoad}>↓ Restore from OneDrive</button>
          <button className="btn sm pri" onClick={()=>onSync({})}>↑ Sync Now</button>
        </div>}
      </R>

      {/* Why OneDrive banner */}
      <div style={{background:"#0d1a2e",border:"1px solid #3b82f6",borderRadius:10,padding:"12px 16px",marginTop:16,marginBottom:20,fontSize:13,color:"#93c5fd",display:"flex",gap:12,alignItems:"flex-start"}}>
        <span style={{fontSize:20,flexShrink:0}}>🔷</span>
        <div>
          <b style={{color:"#dbeafe"}}>Why OneDrive is the right choice for financial data</b>
          <div style={{marginTop:4,color:"#64748b",fontSize:12,lineHeight:1.8}}>
            Your data is saved as a JSON file in <b style={{color:"#94a3b8"}}>your own OneDrive</b> — nobody else can access it.
            Microsoft's 99.9% uptime SLA, end-to-end encryption at rest and in transit, 
            automatic version history (up to 500 versions), and GDPR compliance.
            Unlike Supabase or any third-party DB — <b style={{color:"#94a3b8"}}>you are the only owner</b>.
          </div>
        </div>
      </div>

      {/* Reconnect warning */}
      {sbCfg.needsReconnect&&(
        <div style={{background:"#450a0a",border:"1px solid #f87171",borderRadius:10,padding:"12px 16px",marginBottom:16,fontSize:13,color:"#fca5a5"}}>
          ⚠ Microsoft token expired — click <b>Reconnect</b> to restore auto-sync.
        </div>
      )}

      {/* Main status / connect card */}
      {sbCfg.enabled&&!sbCfg.needsReconnect?(
        <div style={{background:"#052e16",border:"1px solid #34d399",borderRadius:12,padding:"16px 20px",marginBottom:20}}>
          <R>
            <div style={{display:"flex",gap:14,alignItems:"center"}}>
              <div style={{width:44,height:44,borderRadius:22,background:"#064e3b",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>☁</div>
              <div>
                <div style={{fontWeight:700,fontSize:14,color:"#34d399"}}>Connected to OneDrive</div>
                <div style={{fontSize:12,color:"#475569",marginTop:2}}>
                  <b style={{color:"#6ee7b7"}}>{sbCfg.name}</b> · {sbCfg.email}
                </div>
                <div style={{fontSize:11,color:"#374151",marginTop:2}}>
                  {lastSync?`Last synced: ${fmtDT(lastSync)}`:"Not yet synced"} · {dataSize()} · {txns.length} transactions
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
              {syncStatus==="syncing"&&<span style={{fontSize:12,color:"#818cf8",animation:"spin 1s linear infinite",display:"inline-block"}}>⟳</span>}
              {syncStatus==="ok"&&<span style={{fontSize:12,color:"#34d399"}}>✓ Saved</span>}
              {syncStatus==="error"&&<span style={{fontSize:12,color:"#f87171"}}>⚠ Error</span>}
              <button className="btn sm dan" onClick={disconnect}>Disconnect</button>
            </div>
          </R>
          <div style={{marginTop:12,background:"#064e3b",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#6ee7b7"}}>
            📁 File location in your OneDrive: <span style={{fontFamily:"DM Mono",fontSize:11}}>/LedgerAI/ledgerai-data.json</span>
          </div>
        </div>
      ):(
        <div className="card" style={{marginBottom:20}}>
          <div style={{fontWeight:600,fontSize:14,color:"#94a3b8",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            Connect Microsoft OneDrive
            <button className="btn sm ghost" onClick={()=>setShowGuide(true)}>📖 Setup Guide (5 min)</button>
          </div>
          <div style={{background:"#0d1a2e",border:"1px solid #1e3a5f",borderRadius:8,padding:12,marginBottom:14,fontSize:13,color:"#93c5fd"}}>
            End users only need to click Sign in. App owner sets Microsoft connector once.
          </div>
          <label>Azure Application (Client) ID (admin only)</label>
          <input value={clientId} onChange={e=>setClientId(e.target.value)} placeholder={DEFAULT_MICROSOFT_CLIENT_ID?"Using deployment default. Optional override.":"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"}/>
          <div style={{fontSize:11,color:"#475569",marginTop:4}}>
            {DEFAULT_MICROSOFT_CLIENT_ID
              ?"Deployment default is configured. You can leave this blank."
              :"Optional if deployment default is set via VITE_MICROSOFT_CLIENT_ID. Otherwise paste from Azure Portal → App registrations → your app → Overview."}
          </div>
          {sbCfg.needsReconnect&&<div style={{fontSize:12,color:"#f59e0b",marginTop:8}}>⚠ Token expired — sign in again to restore sync.</div>}
          <button className="btn pri" style={{marginTop:14,width:"100%"}} onClick={connect} disabled={connecting||!(clientId||sbCfg.clientId||DEFAULT_MICROSOFT_CLIENT_ID||"").trim()}>
            {connecting?"🔗 Signing in to Microsoft…":"🔷 Sign in with Microsoft & Connect OneDrive"}
          </button>
          <div style={{fontSize:11,color:"#475569",marginTop:8,textAlign:"center"}}>
            A Microsoft sign-in popup will appear. Sign in with your Microsoft/Outlook account.
          </div>
        </div>
      )}

      <div className="g2" style={{gap:18}}>
        {/* Stats */}
        <div className="card">
          <div style={{fontWeight:600,fontSize:14,color:"#94a3b8",marginBottom:12}}>What's Stored in OneDrive</div>
          {[{l:"Transactions",v:txns.length,c:"#818cf8"},{l:"Pending Inbox",v:inbox.length,c:"#f59e0b"},{l:"Accounts",v:accs.length,c:"#34d399"},{l:"Business Activities",v:acts.length,c:"#c084fc"},{l:"SMS Numbers",v:smsNums.length,c:"#38bdf8"},{l:"Email Accounts",v:emails.length,c:"#86efac"}].map(s=>(
            <div key={s.l} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",fontSize:13,borderBottom:"1px solid #0d0f17"}}>
              <span style={{color:"#64748b"}}>{s.l}</span>
              <span className="mono" style={{color:s.c,fontWeight:600}}>{s.v}</span>
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",fontSize:12,marginTop:4}}>
            <span style={{color:"#475569"}}>Total data size</span>
            <span className="mono" style={{color:"#94a3b8"}}>{dataSize()}</span>
          </div>
        </div>

        {/* Version history */}
        <div className="card">
          <R style={{marginBottom:12}}>
            <div style={{fontWeight:600,fontSize:14,color:"#94a3b8"}}>🕐 Version History</div>
            {sbCfg.enabled&&<button className="btn sm ghost" onClick={loadVersionHistory} disabled={loadingVer}>{loadingVer?"Loading…":"Load History"}</button>}
          </R>
          {!sbCfg.enabled&&<div style={{fontSize:13,color:"#475569"}}>Connect OneDrive to view version history.</div>}
          {sbCfg.enabled&&versions.length===0&&!loadingVer&&<div style={{fontSize:13,color:"#475569"}}>Microsoft OneDrive automatically keeps up to 500 versions of your file. Click "Load History" to see them.</div>}
          {versions.map((v,i)=>(
            <div key={v.id} style={{display:"flex",gap:8,justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #0d0f17",fontSize:12}}>
              <span style={{color:"#64748b"}}>Version {versions.length-i}</span>
              <span style={{color:"#94a3b8"}}>{fmtDT(v.lastModifiedDateTime)}</span>
              <span style={{color:"#475569"}}>{v.size?Math.round(v.size/1024)+"KB":""}</span>
            </div>
          ))}
          {versions.length>0&&<div style={{fontSize:11,color:"#475569",marginTop:8}}>To restore a specific version: open OneDrive.com → find LedgerAI/ledgerai-data.json → Version history → Restore.</div>}
        </div>

        {/* Security info */}
        <div className="card">
          <div style={{fontWeight:600,fontSize:14,color:"#94a3b8",marginBottom:12}}>🔒 Security</div>
          {[
            ["Encryption at rest","AES-256, Microsoft managed"],
            ["Encryption in transit","TLS 1.3"],
            ["Access control","Only your Microsoft account"],
            ["Uptime SLA","99.9% (Microsoft)"],
            ["Compliance","GDPR, ISO 27001, SOC 2"],
            ["Version history","Up to 500 auto-versions"],
            ["Data residency","Your region (Microsoft DC)"],
          ].map(([k,v])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:12,borderBottom:"1px solid #0d0f17"}}>
              <span style={{color:"#64748b"}}>{k}</span>
              <span style={{color:"#34d399",fontSize:11}}>{v}</span>
            </div>
          ))}
        </div>

        {/* Manual backup */}
        <div className="card">
          <div style={{fontWeight:600,fontSize:14,color:"#94a3b8",marginBottom:8}}>📦 Manual JSON Backup</div>
          <div style={{fontSize:12,color:"#64748b",marginBottom:12}}>Extra offline copy — download anytime, restore anywhere, even without internet.</div>
          <button className="btn suc" style={{width:"100%",marginBottom:8}} onClick={exportJSON}>⬇ Download Backup ({today()})</button>
          <label style={{cursor:"pointer"}}>
            <div className="btn ghost" style={{width:"100%",textAlign:"center",fontSize:13}}>⬆ Restore from Backup File</div>
            <input type="file" accept=".json" style={{display:"none"}} onChange={importJSON}/>
          </label>
        </div>
      </div>

      {/* Why not iCloud box */}
      <div style={{background:"#0a0a0a",border:"1px solid #1e293b",borderRadius:10,padding:"14px 18px",marginTop:20,fontSize:13}}>
        <div style={{fontWeight:600,color:"#94a3b8",marginBottom:8}}>❓ Why not iCloud?</div>
        <div style={{color:"#475569",lineHeight:1.8}}>
          Apple intentionally does not provide an iCloud Drive API for web apps — only native iOS/macOS apps built with Apple's private SDKs can access iCloud. There is no workaround. 
          OneDrive works on every device including iPhone, iPad, Mac, Windows and Android, and is considered the enterprise-grade equivalent.
        </div>
      </div>

      {exportPrev&&(
        <div className="overlay">
          <div className="modal" style={{maxWidth:460}}>
            <div style={{fontSize:16,fontWeight:700,marginBottom:12}}>Confirm Restore</div>
            <div style={{fontSize:13,color:"#94a3b8",marginBottom:8}}>Backup from <b style={{color:"#f1f5f9"}}>{fmtDT(exportPrev.exportedAt)}</b></div>
            <div style={{background:"#0a0c12",borderRadius:8,padding:12,fontSize:13,color:"#64748b",marginBottom:16}}>
              {exportPrev.txns?.length||0} transactions · {exportPrev.accs?.length||0} accounts · {exportPrev.acts?.length||0} activities
            </div>
            <div style={{background:"#450a0a",border:"1px solid #f87171",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#fca5a5",marginBottom:16}}>
              ⚠ This will replace all current data. Cannot be undone.
            </div>
            <div style={{display:"flex",gap:10}}>
              <button className="btn ghost" onClick={()=>setExportPrev(null)} style={{flex:1}}>Cancel</button>
              <button className="btn dan" onClick={confirmImport} style={{flex:2}}>Yes, Restore</button>
            </div>
          </div>
        </div>
      )}

      {showGuide&&<AzureGuideModal onClose={()=>setShowGuide(false)}/>}
    </div>
  );
}

function AzureGuideModal({onClose}){
  const[step,setStep]=useState(0);
  const origin=typeof window!=="undefined"?window.location.origin:"https://accounts.niprasha.com";
  const steps=[
    {t:"Step 1 — Sign in to Azure Portal",c:<div><p style={{marginBottom:12,color:"#94a3b8"}}>Azure is Microsoft's cloud platform. App Registration is free — no Azure subscription or billing needed.</p><ol style={{paddingLeft:18,lineHeight:2.4,color:"#94a3b8"}}><li>Go to <a href="https://portal.azure.com" target="_blank" rel="noreferrer">portal.azure.com</a></li><li>Sign in with your Microsoft account (Outlook, Hotmail, or work/school account)</li><li>Search for <b style={{color:"#e2e8f0"}}>"App registrations"</b> in the top search bar</li><li>Click <b style={{color:"#e2e8f0"}}>+ New registration</b></li></ol></div>},
    {t:"Step 2 — Register the App",c:<div><ol style={{paddingLeft:18,lineHeight:2.4,color:"#94a3b8"}}><li><b style={{color:"#e2e8f0"}}>Name:</b> anything, e.g. "LedgerAI"</li><li><b style={{color:"#e2e8f0"}}>Supported account types:</b> Choose <b style={{color:"#e2e8f0"}}>"Personal Microsoft accounts only"</b> (or "any account" if work/school)</li><li><b style={{color:"#e2e8f0"}}>Redirect URI:</b> Select <b style={{color:"#e2e8f0"}}>Single-page application (SPA)</b> and enter:<br/><code style={{background:"#07090f",padding:"3px 10px",borderRadius:4,fontSize:11,display:"block",marginTop:4}}>{origin}</code></li><li>Click <b style={{color:"#e2e8f0"}}>Register</b></li></ol></div>},
    {t:"Step 3 — Copy your Client ID",c:<div><ol style={{paddingLeft:18,lineHeight:2.4,color:"#94a3b8"}}><li>After registering, you land on the app Overview page</li><li>Copy the <b style={{color:"#e2e8f0"}}>Application (client) ID</b> — it looks like:<br/><code style={{background:"#07090f",padding:"3px 8px",borderRadius:4,fontSize:11}}>xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx</code></li><li>That's all you need — no secrets, no passwords</li></ol><div style={{background:"#0d1a2e",border:"1px solid #3b82f6",borderRadius:8,padding:12,marginTop:14,fontSize:12,color:"#93c5fd"}}>💡 The client ID is safe to store — it's a public identifier, not a secret. MSAL uses the popup-based OAuth flow so no secret is needed.</div></div>},
    {t:"Step 4 — Connect in LedgerAI",c:<div><ol style={{paddingLeft:18,lineHeight:2.4,color:"#94a3b8"}}><li>Paste your Client ID in the Cloud tab</li><li>Click <b style={{color:"#e2e8f0"}}>🔷 Sign in with Microsoft</b></li><li>A Microsoft popup appears — sign in with your account</li><li>Grant permission to <b style={{color:"#e2e8f0"}}>read and write your files</b> (OneDrive)</li><li>Done — auto-sync starts immediately</li></ol><div style={{background:"#052e16",border:"1px solid #34d399",borderRadius:8,padding:12,marginTop:14,fontSize:12,color:"#86efac"}}>✅ Your data is now saved to <b>OneDrive/LedgerAI/ledgerai-data.json</b> — you can open this file directly in OneDrive.com or the OneDrive app anytime.</div></div>},
    {t:"Step 5 — Access from Any Device",c:<div><ol style={{paddingLeft:18,lineHeight:2.4,color:"#94a3b8"}}><li>On any new device: open LedgerAI → Cloud tab → paste the same Client ID</li><li>Click <b style={{color:"#e2e8f0"}}>Sign in with Microsoft</b> — same account</li><li>Click <b style={{color:"#e2e8f0"}}>↓ Restore from OneDrive</b></li><li>All your data loads instantly</li></ol><div style={{background:"#1a1a2e",border:"1px solid #818cf8",borderRadius:8,padding:12,marginTop:14,fontSize:12,color:"#c7d2fe"}}>💡 <b>The OneDrive app on your phone</b> shows the file directly. You can open it, read it, share it with your CA or accountant — it's just a JSON file in your own storage.</div></div>},
  ];
  return(
    <div className="overlay"><div className="modal" style={{maxWidth:560}}>
      <MH title="OneDrive Setup Guide" onClose={onClose}/>
      <div style={{display:"flex",gap:6,marginBottom:18,overflowX:"auto"}}>
        {steps.map((s,i)=><div key={i} onClick={()=>setStep(i)} style={{padding:"4px 14px",borderRadius:16,fontSize:12,fontWeight:700,cursor:"pointer",background:step===i?"#3b82f6":"#1e293b",color:step===i?"#fff":"#64748b",whiteSpace:"nowrap",flexShrink:0}}>{i+1}</div>)}
      </div>
      <div style={{fontWeight:700,fontSize:15,marginBottom:12,color:"#f1f5f9"}}>{steps[step].t}</div>
      <div style={{fontSize:13,lineHeight:1.8}}>{steps[step].c}</div>
      <div style={{display:"flex",gap:10,marginTop:20}}>
        <button className="btn ghost" onClick={()=>setStep(Math.max(0,step-1))} disabled={step===0} style={{flex:1}}>← Prev</button>
        {step<steps.length-1?<button className="btn" style={{flex:2,background:"#3b82f6",color:"#fff"}} onClick={()=>setStep(step+1)}>Next →</button>:<button className="btn suc" onClick={onClose} style={{flex:2}}>✓ Ready to connect!</button>}
      </div>
    </div></div>
  );
}
// ── SETTINGS ──────────────────────────────────────────────────────────────────
function SettingsTab({acts,setActs,cats,setCats}){
  const[newAct,setNewAct]=useState("");const[selAct,setSelAct]=useState(acts[0]||"");
  const[newCN,setNewCN]=useState("");const[newCD,setNewCD]=useState("");
  const[aiLoad,setAiLoad]=useState(false);const[aiSug,setAiSug]=useState(null);
  const savedAICfg=LS.get("ledger_ai_cfg",{endpoint:"",secret:"",model:DEFAULT_AI_MODEL});
  const[aiEndpoint,setAiEndpoint]=useState(savedAICfg.endpoint||"");
  const[aiSecret,setAiSecret]=useState(savedAICfg.secret||"");
  const[aiModel,setAiModel]=useState(savedAICfg.model||DEFAULT_AI_MODEL);
  const[aiStatus,setAiStatus]=useState("");
  const addAct=()=>{if(!newAct.trim())return;const n=newAct.trim();setActs(p=>[...p,n]);setCats(p=>({...p,[n]:["General","Marketing","Operations","Other"]}));setNewAct("");};
  const checkAI=async()=>{
    if(!newCN.trim())return;
    setAiLoad(true);
    const ex=(cats[selAct]||[]).join(", ");
    try{
      const raw=await callAI([{role:"user",content:`Indian biz owner wants expense category. Activity: "${selAct}", Existing: ${ex}\nNew: "${newCN}" desc: "${newCD}"\nReturn ONLY JSON: {"useExisting":false,"suggestedName":"","existingMatch":"","explanation":""}`}]);
      try{setAiSug(JSON.parse(raw.replace(/```json|```/g,"").trim()));}
      catch{setAiSug({useExisting:false,suggestedName:newCN,existingMatch:"",explanation:"AI returned invalid response. You can add category directly."});}
    }catch(e){
      setAiSug({useExisting:false,suggestedName:newCN,existingMatch:"",explanation:`AI unavailable: ${e.message||"backend not configured"}. You can still add category manually.`});
    }
    setAiLoad(false);
  };
  const addCat=n=>{if(!n||!selAct)return;setCats(p=>({...p,[selAct]:[...(p[selAct]||[]).filter(c=>c!==n),n]}));setNewCN("");setNewCD("");setAiSug(null);};
  const saveAICfg=()=>{
    LS.set("ledger_ai_cfg",{endpoint:(aiEndpoint||"").trim(),secret:(aiSecret||"").trim(),model:(aiModel||DEFAULT_AI_MODEL).trim()||DEFAULT_AI_MODEL});
    setAiStatus("Saved AI backend settings.");
  };
  const testAICfg=async()=>{
    saveAICfg();
    setAiStatus("Testing AI backend...");
    try{
      const out=await callAI([{role:"user",content:'Reply ONLY this JSON: {"ok":true}'}],120);
      setAiStatus(`AI backend OK: ${out.slice(0,120)}`);
    }catch(e){
      setAiStatus(`AI backend error: ${e.message||"unknown error"}`);
    }
  };
  return(<div>
    <h2 className="h2" style={{marginBottom:18}}>Settings</h2>
    <div className="card" style={{marginBottom:16}}>
      <div style={{fontWeight:600,fontSize:14,marginBottom:10,color:"#94a3b8"}}>AI Backend (Production)</div>
      <div style={{fontSize:12,color:"#64748b",lineHeight:1.8,marginBottom:10}}>
        LedgerAI should call your backend endpoint (not Anthropic directly from browser). This avoids API-key exposure and reduces sync failures.
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div style={{gridColumn:"1 / -1"}}>
          <label>AI Endpoint URL</label>
          <input value={aiEndpoint} onChange={e=>setAiEndpoint(e.target.value)} placeholder="https://ai.niprasha.com/extract"/>
        </div>
        <div>
          <label>Shared Key (Optional)</label>
          <input value={aiSecret} onChange={e=>setAiSecret(e.target.value)} placeholder="match backend header check"/>
        </div>
        <div>
          <label>Model</label>
          <input value={aiModel} onChange={e=>setAiModel(e.target.value)} placeholder={DEFAULT_AI_MODEL}/>
        </div>
      </div>
      <div style={{display:"flex",gap:8,marginTop:10}}>
        <button className="btn pri" onClick={saveAICfg}>Save AI Config</button>
        <button className="btn ghost" onClick={testAICfg}>Test AI Backend</button>
      </div>
      {aiStatus&&<div style={{fontSize:12,color:"#c7d2fe",marginTop:8}}>{aiStatus}</div>}
      <div style={{fontSize:11,color:"#475569",marginTop:8}}>If endpoint is empty or unreachable, email sync falls back to heuristic extraction with lower accuracy.</div>
    </div>
    <div className="g2" style={{gap:18}}>
      <div className="card">
        <div style={{fontWeight:600,fontSize:14,marginBottom:14,color:"#94a3b8"}}>Business Activities</div>
        {acts.map(a=><div key={a} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid #1a2438",fontSize:13}}><span>{a}</span>{!DEF_ACTS.includes(a)&&<button className="btn sm dan" onClick={()=>setActs(p=>p.filter(x=>x!==a))}>✕</button>}</div>)}
        <label style={{marginTop:14}}>Add New Activity</label>
        <input value={newAct} onChange={e=>setNewAct(e.target.value)} placeholder="e.g. Real Estate Consulting"/>
        <button className="btn pri" style={{marginTop:8,width:"100%"}} onClick={addAct}>+ Add Activity</button>
      </div>
      <div className="card">
        <div style={{fontWeight:600,fontSize:14,marginBottom:14,color:"#94a3b8"}}>Expense Categories</div>
        <label>Activity</label><select value={selAct} onChange={e=>setSelAct(e.target.value)}>{acts.map(a=><option key={a}>{a}</option>)}</select>
        <label>New Category Name</label><input value={newCN} onChange={e=>setNewCN(e.target.value)} placeholder="e.g. Conference Fees"/>
        <label>Description</label><input value={newCD} onChange={e=>setNewCD(e.target.value)} placeholder="Helps AI classify correctly"/>
        <button className="btn" style={{marginTop:8,width:"100%",background:"#0d0d2b",color:"#818cf8",border:"1px solid #818cf8"}} onClick={checkAI} disabled={aiLoad||!newCN.trim()}>{aiLoad?"🤖 Checking…":"🤖 Check with AI first"}</button>
        {aiSug&&<div style={{background:"#0a0a1e",border:"1px solid #1e293b",borderRadius:8,padding:12,marginTop:10}}>
          <div style={{fontSize:13,marginBottom:8}}>{aiSug.explanation}</div>
          {aiSug.useExisting?<div><div style={{fontSize:12,color:"#f59e0b",marginBottom:8}}>💡 "{aiSug.existingMatch}" covers this.</div><div style={{display:"flex",gap:8}}><button className="btn sm" style={{background:"#1e1b4b",color:"#818cf8"}} onClick={()=>setAiSug(null)}>Use Existing</button><button className="btn sm pri" onClick={()=>addCat(aiSug.suggestedName)}>Add as "{aiSug.suggestedName}"</button></div></div>
          :<button className="btn sm pri" onClick={()=>addCat(aiSug.suggestedName)}>+ Add "{aiSug.suggestedName}"</button>}
        </div>}
        {!aiSug&&newCN&&<button className="btn ghost" style={{marginTop:6,width:"100%"}} onClick={()=>addCat(newCN)}>Add without AI check</button>}
        {selAct&&<div style={{marginTop:14}}><div className="lxs" style={{marginBottom:8}}>Current Categories</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>{(cats[selAct]||[]).map(cat=><span key={cat} style={{background:"#1e293b",color:"#94a3b8",padding:"3px 10px",borderRadius:12,fontSize:12,display:"flex",alignItems:"center",gap:5}}>{cat}<span style={{cursor:"pointer",color:"#475569"}} onClick={()=>setCats(p=>({...p,[selAct]:(p[selAct]||[]).filter(c=>c!==cat)}))}>✕</span></span>)}</div>
        </div>}
      </div>
    </div>
  </div>);
}

// ── DAILY REVIEW ──────────────────────────────────────────────────────────────
function DailyTab({todayTxns,todInc,todExp,summary,sumLoad,getSummary,onEdit,onDelete,inbox}){
  const todInbox=inbox.filter(i=>i.date===today());
  return(<div>
    <R style={{marginBottom:18,gap:10}}>
      <h2 className="h2" style={{flex:1}}>Day Review — {fmtD(today())}</h2>
      <button className="btn sm pri" onClick={getSummary} disabled={sumLoad}>{sumLoad?"🤖 Generating…":"🤖 AI Summary"}</button>
    </R>
    {todInbox.length>0&&<div style={{background:"#0d0d2b",border:"1px solid #818cf8",borderRadius:10,padding:"12px 16px",marginBottom:18,fontSize:13,color:"#c7d2fe"}}>⏳ <b>{todInbox.length}</b> item(s) still in Inbox — approve or discard to complete today's review.</div>}
    {summary&&<div style={{background:"#0a0c1e",border:"1px solid #6366f1",borderRadius:12,padding:18,marginBottom:18}}><div style={{fontSize:10,color:"#818cf8",fontWeight:700,letterSpacing:".5px",marginBottom:8}}>✦ AI INSIGHT</div><div style={{fontSize:13,color:"#c7d2fe",lineHeight:1.8,whiteSpace:"pre-wrap"}}>{summary}</div></div>}
    <div className="g4" style={{marginBottom:18}}>
      {[{l:"Today Income",v:todInc,c:"#34d399"},{l:"Today Expense",v:todExp,c:"#f87171"},{l:"Net Today",v:todInc-todExp,c:todInc-todExp>=0?"#34d399":"#f87171"},{l:"Entries",v:todayTxns.length,c:"#818cf8",nf:true}].map(s=>(
        <div key={s.l} className="sc"><div className="lxs">{s.l}</div><div className="mono" style={{fontSize:22,color:s.c,marginTop:6}}>{s.nf?s.v:fmt(s.v)}</div></div>
      ))}
    </div>
    <div className="sh" style={{marginBottom:10}}>Today's Transactions</div>
    {todayTxns.length===0?<div className="card" style={{textAlign:"center",color:"#475569",padding:40}}>No transactions today.</div>:<TxTable txns={todayTxns} onEdit={onEdit} onDelete={onDelete}/>}
  </div>);
}

// ── ADD/EDIT MODAL ────────────────────────────────────────────────────────────
function AddModal({type,existing,acts,cats,accs,onSave,onClose}){
  const defaultAct=acts.includes("Personal")?"Personal":(acts[0]||"");
  const[form,setForm]=useState({
    type,date:today(),description:"",vendor:"",amount:"",
    businessActivity:type==="borrow"?defaultAct:(acts[0]||""),
    category:type==="borrow"?"Borrowed Cash":"",
    paymentMethod:type==="borrow"?"Cash":"UPI",
    accountId:"",liabilityAccountId:"",borrowSource:"",
    notes:"",
    ...existing
  });
  const[raw,setRaw]=useState("");const[imgB64,setImg]=useState(null);const[load,setLoad]=useState(false);const[sub,setSub]=useState("form");
  const fref=useRef();
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));
  const clist=cats[form.businessActivity]||["Other"];
  const assetAccs=accs.filter(a=>a.cls==="asset");
  const liabAccs=accs.filter(a=>a.cls==="liability");
  const setType=t=>setForm(p=>{
    if(t==="borrow"){
      const src=(p.borrowSource||p.vendor||"").trim();
      return {...p,type:t,businessActivity:defaultAct,category:"Borrowed Cash",paymentMethod:p.paymentMethod||"Cash",borrowSource:src,vendor:src||p.vendor};
    }
    const nextAct=p.businessActivity||acts[0]||"";
    const nextCats=cats[nextAct]||["Other"];
    const nextCat=p.category&&p.category!=="Borrowed Cash"?p.category:(nextCats[0]||"Other");
    return {...p,type:t,businessActivity:nextAct,category:nextCat};
  });
  const apply=r=>{if(!r)return;setForm(p=>({...p,description:r.description||p.description,vendor:r.vendor||p.vendor,amount:r.amount||p.amount,businessActivity:acts.includes(r.businessActivity)?r.businessActivity:p.businessActivity,category:r.category||p.category,date:r.date||p.date,paymentMethod:r.paymentMethod||p.paymentMethod,isNewCategory:r.isNewCategory||false,aiGenerated:true}));setSub("form");};
  const runText=async()=>{setLoad(true);apply(await aiClassify(raw,acts,cats,form.type));setLoad(false);};
  const runImg=async()=>{
    if(!imgB64)return;
    setLoad(true);
    const c2=Object.entries(cats).map(([a,cs])=>`${a}: ${cs.join(", ")}`).join("\n");
    try{
      const raw2=await callAI([{role:"user",content:[{type:"image",source:{type:"base64",media_type:"image/jpeg",data:imgB64}},{type:"text",text:`Extract expense. Activities: ${acts.join(", ")}\n${c2}\nReturn ONLY JSON: {"businessActivity":"","category":"","isNewCategory":false,"description":"","amount":0,"date":"YYYY-MM-DD","vendor":"","paymentMethod":""}`}]}],500);
      try{apply(JSON.parse(raw2.replace(/```json|```/g,"").trim()));}
      catch{alert("AI returned invalid JSON for invoice image.");}
    }catch(e){
      alert(`AI image extraction failed: ${e.message||"backend unavailable"}`);
    }
    setLoad(false);
  };
  const je=buildJE({...form,amount:Number(form.amount)||0},accs);
  return(
    <div className="overlay"><div className="modal">
      <R style={{marginBottom:14}}>
        <div style={{flex:1}}><div style={{display:"flex",gap:6,marginBottom:4}}>{["income","expense","borrow"].map(t=><button key={t} className={`btn sm ${form.type===t?(t==="income"?"suc":t==="expense"?"dan":""):"ghost"}`} style={form.type===t&&t==="borrow"?{background:"#f59e0b",color:"#fff"}:{}} onClick={()=>{setType(t);if(t==="borrow")setSub("form");}}>{t==="income"?"+ Income":t==="expense"?"− Expense":"↘ Borrowed"}</button>)}</div><div style={{fontSize:16,fontWeight:700}}>{existing?"Edit":"New"} {form.type==="income"?"Income":form.type==="expense"?"Expense":"Borrowed Cash"}</div></div>
        <button className="btn ghost" onClick={onClose} style={{fontSize:16,padding:"3px 10px"}}>✕</button>
      </R>
      {form.type!=="borrow"&&<div style={{display:"flex",gap:6,marginBottom:14,borderBottom:"1px solid #1e293b",paddingBottom:12}}>
        {[["form","📝 Manual"],["paste","📋 Text AI"],["invoice","📷 Invoice"]].map(([k,l])=><button key={k} className={`btn sm ${sub===k?"pri":"ghost"}`} onClick={()=>setSub(k)}>{l}</button>)}
      </div>}
      {form.type!=="borrow"&&sub==="paste"&&<><label>Paste receipt / SMS / email text</label><textarea rows={5} value={raw} onChange={e=>setRaw(e.target.value)} placeholder="Paste any receipt, bank SMS, Kite message…"/><button className="btn pri" style={{marginTop:10,width:"100%"}} onClick={runText} disabled={load||!raw.trim()}>{load?"🤖 Classifying…":"🤖 Auto-fill with AI"}</button></>}
      {form.type!=="borrow"&&sub==="invoice"&&<><label>Upload invoice image</label><input type="file" ref={fref} accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(!f)return;const rd=new FileReader();rd.onload=()=>setImg(rd.result.split(",")[1]);rd.readAsDataURL(f);}}/>{imgB64&&<img src={`data:image/jpeg;base64,${imgB64}`} style={{width:"100%",borderRadius:8,maxHeight:180,objectFit:"contain",background:"#0f172a",marginTop:8}} alt=""/>}<button className="btn pri" style={{marginTop:10,width:"100%"}} onClick={runImg} disabled={load||!imgB64}>{load?"🤖 Reading…":"🤖 Extract with AI"}</button></>}
      {sub==="form"&&<>
        {accs.length===0&&<div style={{background:"#450a0a",border:"1px solid #f87171",borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:12,color:"#fca5a5"}}>Add at least one account in the Accounts tab before saving transactions.</div>}
        {form.aiGenerated&&<div style={{background:"#0a0a1e",border:"1px solid #6366f1",borderRadius:8,padding:"7px 12px",marginBottom:10,fontSize:12,color:"#c7d2fe"}}>✨ AI auto-filled — review all fields</div>}
        {form.isNewCategory&&<div style={{background:"#0d0920",border:"1px solid #a855f7",borderRadius:8,padding:"5px 12px",marginBottom:8,fontSize:12,color:"#d8b4fe"}}>🆕 New category "{form.category}" will be created</div>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><label>Date</label><input type="date" value={form.date} onChange={e=>set("date",e.target.value)}/></div>
          <div><label>Amount (₹)</label><input type="number" value={form.amount} onChange={e=>set("amount",e.target.value)} placeholder="0"/></div>
        </div>
        {form.type!=="borrow"&&<><label>Business Activity</label><select value={form.businessActivity} onChange={e=>set("businessActivity",e.target.value)}>{acts.map(a=><option key={a}>{a}</option>)}</select></>}
        {form.type!=="borrow"&&<><label>Category</label><select value={form.category} onChange={e=>set("category",e.target.value)}>{clist.map(c=><option key={c}>{c}</option>)}</select></>}
        {form.type==="borrow"&&<><label>Borrowed From Source</label><input value={form.borrowSource||""} onChange={e=>set("borrowSource",e.target.value)} placeholder="e.g. Rahul, Family, NBFC, Friend"/></>}
        {form.type==="borrow"&&liabAccs.length>0&&<><label>Liability Account (Optional)</label><select value={form.liabilityAccountId||""} onChange={e=>set("liabilityAccountId",e.target.value)}><option value="">— Select liability source —</option>{liabAccs.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></>}
        {accs.length>0&&<><label>{form.type==="expense"?"Paid From Account":form.type==="income"?"Received In Account":"Received In Account (Cash/Bank)"}</label><select value={form.accountId||""} onChange={e=>set("accountId",e.target.value)}><option value="">— Select account —</option>{(form.type==="borrow"?assetAccs:accs).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></>}
        <label>Description</label><input value={form.description} onChange={e=>set("description",e.target.value)} placeholder="Brief description"/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><label>Vendor</label><input value={form.vendor||""} onChange={e=>set("vendor",e.target.value)} placeholder="Optional"/></div>
          <div><label>Payment Method</label><select value={form.paymentMethod} onChange={e=>set("paymentMethod",e.target.value)}>{PAY_METHODS.map(m=><option key={m}>{m}</option>)}</select></div>
        </div>
        <label>Notes</label><textarea rows={2} value={form.notes||""} onChange={e=>set("notes",e.target.value)} placeholder="Optional"/>
        {Number(form.amount)>0&&<div style={{marginTop:12,background:"#0a0c12",border:"1px solid #1e293b",borderRadius:8,padding:12}}><div className="lxs" style={{marginBottom:8}}>Journal Preview</div>
          {je.map((e,i)=><div key={i} style={{display:"grid",gridTemplateColumns:"1fr 90px 90px",gap:6,fontSize:12,color:"#94a3b8",padding:"2px 0"}}><span style={{color:e.dr>0?"#e2e8f0":"#64748b",paddingLeft:e.dr===0?16:0}}>{e.account}</span><span className="mono" style={{textAlign:"right",color:"#34d399"}}>{e.dr>0?fmt(e.dr):""}</span><span className="mono" style={{textAlign:"right",color:"#f87171"}}>{e.cr>0?fmt(e.cr):""}</span></div>)}
        </div>}
        <div style={{display:"flex",gap:10,marginTop:16}}>
          <button className="btn ghost" onClick={onClose} style={{flex:1}}>Cancel</button>
          <button className="btn pri" style={{flex:2}} onClick={()=>{
            if(!form.amount||isNaN(Number(form.amount)))return alert("Enter a valid amount");
            if(accs.length===0)return alert("Add at least one account in Accounts tab.");
            if(!form.accountId)return alert("Select which account this transaction used.");
            if(form.type==="borrow"&&!form.liabilityAccountId&&!(form.borrowSource||"").trim())return alert("Select liability account or enter borrowed source.");
            const amt=Number(form.amount);
            if(form.type==="borrow"){
              const src=(form.borrowSource||form.vendor||"").trim();
              const desc=(form.description||"").trim()||`Cash borrowed from ${src||"Other source"}`;
              onSave({...form,amount:amt,type:"borrow",description:desc,borrowSource:src,vendor:src||form.vendor||"",businessActivity:defaultAct,category:"Borrowed Cash",isNewCategory:false});
              return;
            }
            onSave({...form,amount:amt,type:form.type});
          }}>{existing?"Update Entry":`Save ${form.type==="income"?"Income":form.type==="expense"?"Expense":"Borrowed Cash"}`}</button>
        </div>
      </>}
    </div></div>
  );
}

// ── SHARED ────────────────────────────────────────────────────────────────────
function TxTable({txns,onEdit,onDelete}){
  if(!txns.length)return<div className="card" style={{textAlign:"center",color:"#475569",padding:30}}>No transactions.</div>;
  return(<div className="card" style={{padding:0,overflow:"hidden"}}>
    <div style={{display:"grid",gridTemplateColumns:"82px 1fr 130px 110px 100px 44px",gap:6,padding:"8px 14px",background:"#0a0c12",fontSize:10,color:"#475569",fontWeight:700,textTransform:"uppercase"}}>
      <span>Date</span><span>Description</span><span>Activity</span><span>Category</span><span>Amount</span><span/>
    </div>
    {txns.map(tx=>(
      <div key={tx.id} style={{display:"grid",gridTemplateColumns:"82px 1fr 130px 110px 100px 44px",gap:6,padding:"9px 14px",borderBottom:"1px solid #0d0f17",cursor:"pointer",fontSize:13}} onClick={()=>onEdit(tx)} onMouseEnter={e=>e.currentTarget.style.background="#0f1219"} onMouseLeave={e=>e.currentTarget.style.background=""}>
        <span style={{color:"#475569",fontFamily:"DM Mono",fontSize:11}}>{fmtD(tx.date)}</span>
        <div><div style={{fontWeight:500}}>{tx.description||tx.category}</div>
          <div style={{fontSize:11,color:"#475569",display:"flex",gap:5,marginTop:1,flexWrap:"wrap"}}>
            {tx.vendor&&<span>{tx.vendor}</span>}{tx.paymentMethod&&<span>· {tx.paymentMethod}</span>}{tx.accountName&&<span>· {tx.accountName}</span>}{tx.borrowSource&&<span>· from {tx.borrowSource}</span>}
            {tx.source==="email"&&<span style={{background:"#1a2010",color:"#86efac",padding:"0 4px",borderRadius:3,fontSize:10}}>📧</span>}
            {tx.source==="auto"&&<span style={{background:"#1e1b4b",color:"#818cf8",padding:"0 4px",borderRadius:3,fontSize:10}}>AI</span>}
            {tx.source==="statement"&&<span style={{background:"#052e16",color:"#34d399",padding:"0 4px",borderRadius:3,fontSize:10}}>Stmt</span>}
          </div>
        </div>
        <span style={{fontSize:11,color:tx.businessActivity==="Personal"?"#c084fc":"#64748b"}}>{tx.businessActivity}</span>
        <span style={{fontSize:11,color:"#64748b"}}>{tx.category}</span>
        <span className="mono" style={{fontWeight:700,color:tx.type==="income"?"#34d399":tx.type==="borrow"?"#f59e0b":"#f87171"}}>{tx.type==="income"?"+":tx.type==="borrow"?"↘":"−"}{fmt(tx.amount)}</span>
        <button className="btn sm dan" style={{padding:"2px 6px"}} onClick={e=>{e.stopPropagation();onDelete(tx.id);}}>✕</button>
      </div>
    ))}
  </div>);
}
const R=({children,style={}})=><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",...style}}>{children}</div>;
const MH=({title,onClose})=><R style={{marginBottom:16}}><div style={{fontSize:16,fontWeight:700}}>{title}</div><button className="btn ghost" onClick={onClose} style={{fontSize:16,padding:"2px 10px"}}>✕</button></R>;

const CSS=`
*{box-sizing:border-box;margin:0;padding:0}
::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:#07090f}::-webkit-scrollbar-thumb{background:#1e293b;border-radius:3px}
.card{background:#0f1624;border:1px solid #1a2438;border-radius:12px;padding:16px}
.sc{background:linear-gradient(135deg,#0f1624,#0a0d18);border:1px solid #1a2438;border-radius:12px;padding:16px}
nav{border-bottom:1px solid #1a2438;padding:0 18px;display:flex;align-items:center;gap:2px;overflow-x:auto;position:sticky;top:0;background:#07090f;z-index:60}
.logo{font-weight:800;font-size:16px;color:#818cf8;padding:14px 0;margin-right:14px;white-space:nowrap;letter-spacing:-0.5px}
.ni{padding:14px 11px;cursor:pointer;font-size:13px;font-weight:500;color:#64748b;transition:all .15s;white-space:nowrap;border-bottom:2px solid transparent}
.ni.a{color:#818cf8;border-bottom-color:#818cf8}.ni:hover:not(.a){color:#94a3b8}
.wrap{padding:20px;max-width:1400px;margin:0 auto}
.btn{border:none;border-radius:8px;padding:8px 18px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:500;transition:all .15s}
.btn.sm{padding:5px 12px;font-size:12px}
.btn.pri{background:#6366f1;color:#fff}.btn.pri:hover{background:#4f46e5}
.btn.suc{background:#10b981;color:#fff}.btn.suc:hover{background:#059669}
.btn.dan{background:#ef4444;color:#fff}.btn.dan:hover{background:#dc2626}
.btn.ghost{background:transparent;color:#94a3b8;border:1px solid #1e293b}.btn.ghost:hover{background:#1e293b;color:#e2e8f0}
.btn:disabled{opacity:.5;cursor:not-allowed}
.tag{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600}
.tincome{background:#052e16;color:#34d399}.texpense{background:#450a0a;color:#f87171}.tborrow{background:#422006;color:#f59e0b}
input,select,textarea{background:#0a0d18;border:1px solid #1a2438;border-radius:8px;color:#e2e8f0;font-family:inherit;padding:8px 12px;font-size:13px;width:100%;outline:none;transition:border .15s}
input:focus,select:focus,textarea:focus{border-color:#6366f1}
input[type=checkbox]{width:auto;height:auto;margin:0}
select option{background:#0a0d18}
label{font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px;margin-top:12px}
.lxs{font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.5px}
.mono{font-family:'DM Mono',monospace}
.h2{font-size:18px;font-weight:700;color:#f1f5f9;margin-bottom:16px}
.sh{font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.6px}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:100;display:flex;align-items:center;justify-content:center;padding:16px}
.modal{background:#0f1624;border:1px solid #1a2438;border-radius:16px;padding:22px;width:100%;max-width:580px;max-height:92vh;overflow-y:auto}
.g2{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}
.g4{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}
a{color:#818cf8}
@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
`;
