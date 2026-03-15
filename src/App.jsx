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
const NEW_ACTIVITY_DEFAULT_CATS = ["General","Marketing","Operations","Other"];
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

function normalizeCurrencyCode(value="",fallback=DEFAULT_BASE_CURRENCY){
  const raw=String(value||"").trim().toUpperCase();
  if(!raw)return fallback;
  if(CURRENCY_ALIASES[raw])return CURRENCY_ALIASES[raw];
  const letters=raw.replace(/[^A-Z]/g,"");
  if(CURRENCY_ALIASES[letters])return CURRENCY_ALIASES[letters];
  if(/^[A-Z]{3}$/.test(letters))return letters;
  return fallback;
}

function defaultCurrencyCfg(){
  return{baseCurrency:DEFAULT_BASE_CURRENCY};
}

function normalizeCurrencyCfg(cfg={}){
  return{
    baseCurrency:normalizeCurrencyCode(cfg?.baseCurrency||DEFAULT_BASE_CURRENCY,DEFAULT_BASE_CURRENCY),
  };
}

function loadCurrencyCfg(){
  return normalizeCurrencyCfg(LS.get(CURRENCY_CFG_KEY,defaultCurrencyCfg()));
}

function saveCurrencyCfgToStorage(cfg={}){
  const next=normalizeCurrencyCfg(cfg);
  LS.set(CURRENCY_CFG_KEY,next);
  return next;
}

function getBaseCurrency(){
  return loadCurrencyCfg().baseCurrency||DEFAULT_BASE_CURRENCY;
}

function roundMoney(value){
  const n=Number(value);
  if(!Number.isFinite(n))return 0;
  return Math.round(n*100)/100;
}

function normalizeFxDate(value=""){
  const raw=String(value||"").trim();
  if(ISO_DATE_RE.test(raw))return raw;
  const ts=Date.parse(raw);
  if(Number.isFinite(ts))return new Date(ts).toISOString().slice(0,10);
  return today();
}

function formatMoney(value,currency=getBaseCurrency()){
  const amount=Number(value)||0;
  const code=normalizeCurrencyCode(currency,DEFAULT_BASE_CURRENCY);
  try{
    return new Intl.NumberFormat("en-IN",{style:"currency",currency:code,minimumFractionDigits:Number.isInteger(amount)?0:2,maximumFractionDigits:2}).format(amount);
  }catch{
    return `${code} ${amount.toFixed(Number.isInteger(amount)?0:2)}`;
  }
}

function loadFxCache(){
  const raw=LS.get(FX_CACHE_KEY,{});
  return raw&&typeof raw==="object"&&!Array.isArray(raw)?raw:{};
}

function saveFxCache(cache={}){
  const entries=Object.entries(cache||{})
    .filter(([,v])=>v&&typeof v==="object")
    .sort((a,b)=>Date.parse(b[1]?.savedAt||"")-Date.parse(a[1]?.savedAt||""))
    .slice(0,FX_CACHE_MAX);
  const next=Object.fromEntries(entries);
  LS.set(FX_CACHE_KEY,next);
  return next;
}

function fxCacheKey(from="",to="",date=""){
  return `${normalizeCurrencyCode(from,"")}::${normalizeCurrencyCode(to,"")}::${normalizeFxDate(date)}`;
}

function identityFxResult(item={},baseCurrency=getBaseCurrency()){
  const from=normalizeCurrencyCode(item.from||item.currency||baseCurrency,baseCurrency);
  const to=normalizeCurrencyCode(item.to||item.baseCurrency||baseCurrency,baseCurrency);
  const requestedDate=normalizeFxDate(item.date||item.fxDate||today());
  return{
    id:String(item.id||""),
    amount:roundMoney(item.amount),
    from,
    to,
    requestedDate,
    rateDate:requestedDate,
    rate:1,
    converted:roundMoney(item.amount),
    provider:"identity",
  };
}

async function fetchDirectFxRate(item={}){
  const from=normalizeCurrencyCode(item.from||item.currency||"",DEFAULT_BASE_CURRENCY);
  const to=normalizeCurrencyCode(item.to||item.baseCurrency||"",DEFAULT_BASE_CURRENCY);
  const requestedDate=normalizeFxDate(item.date||item.fxDate||today());
  if(from===to)return identityFxResult({...item,from,to,date:requestedDate},to);
  const url=`https://api.frankfurter.dev/v1/${requestedDate}?base=${encodeURIComponent(from)}&symbols=${encodeURIComponent(to)}`;
  const data=await withTimeout(fetch(url,{headers:{Accept:"application/json"}}).then(async(r)=>{
    const txt=await r.text();
    let parsed={};
    try{parsed=JSON.parse(txt||"{}");}catch{}
    if(!r.ok)throw new Error(parsed?.message||txt?.slice?.(0,180)||`FX ${r.status}`);
    return parsed;
  }),12000,"FX conversion");
  const rate=Number(data?.rates?.[to]);
  if(!(rate>0))throw new Error(`FX rate unavailable for ${from}/${to}`);
  return{
    id:String(item.id||""),
    amount:roundMoney(item.amount),
    from,
    to,
    requestedDate,
    rateDate:String(data?.date||requestedDate),
    rate,
    converted:roundMoney((Number(item.amount)||0)*rate),
    provider:"ECB via Frankfurter",
  };
}

async function fetchFxConversions(items=[],cfg=loadAICfg()){
  const clean=(items||[]).map((item,idx)=>{
    const amount=Number(item?.amount);
    const from=normalizeCurrencyCode(item?.from||item?.currency||"",DEFAULT_BASE_CURRENCY);
    const to=normalizeCurrencyCode(item?.to||item?.baseCurrency||getBaseCurrency(),getBaseCurrency());
    if(!Number.isFinite(amount)||!from||!to)return null;
    return{
      id:String(item?.id||idx),
      amount,
      from,
      to,
      date:normalizeFxDate(item?.date||item?.fxDate||today()),
    };
  }).filter(Boolean);
  if(!clean.length)return[];

  const cached=loadFxCache();
  const results=new Map();
  const misses=[];
  clean.forEach(item=>{
    const key=fxCacheKey(item.from,item.to,item.date);
    const hit=cached[key];
    if(hit&&Number.isFinite(Number(hit?.rate))){
      results.set(item.id,{
        id:item.id,
        amount:roundMoney(item.amount),
        from:item.from,
        to:item.to,
        requestedDate:item.date,
        rateDate:String(hit.rateDate||item.date),
        rate:Number(hit.rate)||1,
        converted:roundMoney(item.amount*(Number(hit.rate)||1)),
        provider:String(hit.provider||"cache"),
      });
    }else{
      misses.push(item);
    }
  });

  if(misses.length){
    const endpoint=String(cfg?.endpoint||"").trim();
    const secret=String(cfg?.secret||"").trim();
    let fetched=[];
    if(endpoint){
      try{
        const url=aiCloudRetryUrl(endpoint,"/fx/convert");
        const ctrl=new AbortController();
        const timer=setTimeout(()=>ctrl.abort(),15000);
        try{
          const r=await fetch(url,{
            method:"POST",
            headers:{"Content-Type":"application/json",...(secret?{"x-ledgerai-key":secret}:{})},
            body:JSON.stringify({items:misses}),
            signal:ctrl.signal,
          });
          const txt=await r.text();
          let data={};
          try{data=JSON.parse(txt||"{}");}catch{}
          if(!r.ok)throw new Error(data?.error||txt?.slice?.(0,180)||`FX ${r.status}`);
          fetched=Array.isArray(data?.results)?data.results:[];
        }finally{
          clearTimeout(timer);
        }
      }catch{
        fetched=await Promise.all(misses.map(item=>fetchDirectFxRate(item)));
      }
    }else{
      fetched=await Promise.all(misses.map(item=>fetchDirectFxRate(item)));
    }
    const nextCache={...cached};
    fetched.forEach(row=>{
      const id=String(row?.id||"");
      if(!id)return;
      results.set(id,{
        id,
        amount:roundMoney(row.amount),
        from:normalizeCurrencyCode(row.from||"",DEFAULT_BASE_CURRENCY),
        to:normalizeCurrencyCode(row.to||"",getBaseCurrency()),
        requestedDate:normalizeFxDate(row.requestedDate||today()),
        rateDate:normalizeFxDate(row.rateDate||row.requestedDate||today()),
        rate:Number(row.rate)||1,
        converted:roundMoney(row.converted),
        provider:String(row.provider||"ECB via Frankfurter"),
      });
      nextCache[fxCacheKey(row.from,row.to,row.requestedDate||today())]={
        rate:Number(row.rate)||1,
        rateDate:normalizeFxDate(row.rateDate||row.requestedDate||today()),
        provider:String(row.provider||"ECB via Frankfurter"),
        savedAt:new Date().toISOString(),
      };
    });
    saveFxCache(nextCache);
  }

  return clean.map(item=>results.get(item.id)||identityFxResult(item,item.to));
}

async function convertMoneyRows(rows=[],{
  amountField="amount",
  originalField=amountField==="balance"?"originalBalance":"originalAmount",
  currencyField=amountField==="balance"?"accountCurrency":"currency",
  baseAmountField=amountField==="balance"?"balance":"baseAmount",
  baseCurrencyField=amountField==="balance"?"balanceBaseCurrency":"baseCurrency",
  fxDateField=amountField==="balance"?"balanceFxDate":"fxDate",
  fxRateField=amountField==="balance"?"balanceFxRate":"fxRate",
  fxRateDateField=amountField==="balance"?"balanceRateDate":"fxRateDate",
  fxSourceField=amountField==="balance"?"balanceFxSource":"fxSource",
  fallbackCurrency=getBaseCurrency(),
  baseCurrency=getBaseCurrency(),
  dateResolver=(row)=>row?.[fxDateField]||row?.date||today(),
}={}){
  const prepared=(rows||[]).map((row,idx)=>{
    const amount=Number(row?.[originalField]??row?.[amountField]??0);
    const currency=normalizeCurrencyCode(row?.[currencyField]||"",fallbackCurrency||LEGACY_DEFAULT_CURRENCY);
    return{
      idx,
      id:String(row?.id||row?._iid||`row-${idx}`),
      amount:Number.isFinite(amount)?amount:0,
      from:currency,
      to:baseCurrency,
      date:normalizeFxDate(dateResolver(row)),
      row,
    };
  });
  const converted=await fetchFxConversions(prepared.map(({id,amount,from,to,date})=>({id,amount,from,to,date})));
  const fxById=new Map(converted.map(item=>[String(item.id||""),item]));
  return prepared.map(item=>{
    const fx=fxById.get(item.id)||identityFxResult(item,baseCurrency);
    const originalAmount=roundMoney(item.amount);
    const convertedAmount=roundMoney(fx.converted);
    return{
      ...item.row,
      [currencyField]:item.from,
      [originalField]:originalAmount,
      [amountField]:convertedAmount,
      [baseAmountField]:convertedAmount,
      [baseCurrencyField]:baseCurrency,
      [fxDateField]:item.date,
      [fxRateField]:Number(fx.rate)||1,
      [fxRateDateField]:normalizeFxDate(fx.rateDate||item.date),
      [fxSourceField]:String(fx.provider||"ECB via Frankfurter"),
    };
  });
}

function currencyMetaLabel(entry={},baseCurrency=getBaseCurrency()){
  const source=normalizeCurrencyCode(entry?.currency||entry?.accountCurrency||"",baseCurrency);
  const original=Number(entry?.originalAmount??entry?.originalBalance);
  const baseAmount=Number(entry?.baseAmount??entry?.balance??entry?.amount);
  const rate=Number(entry?.fxRate??entry?.balanceFxRate);
  const rateDate=entry?.fxRateDate||entry?.balanceRateDate||entry?.fxDate||entry?.balanceFxDate||"";
  if(!Number.isFinite(original)||source===baseCurrency)return "";
  const parts=[`${formatMoney(original,source)} original`];
  if(Number.isFinite(baseAmount))parts.push(`→ ${formatMoney(baseAmount,baseCurrency)}`);
  if(Number.isFinite(rate)&&rate>0)parts.push(`@ ${rate.toFixed(4)}`);
  if(rateDate)parts.push(fmtD(rateDate));
  return parts.join(" ");
}

const fmt   = (n,currency=getBaseCurrency()) => formatMoney(n,currency);
const fmtD  = d  => d?new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}):"";
const fmtDT = d  => d?new Date(d).toLocaleString("en-IN",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}):"";
const amtClose=(a,b)=>Math.abs(a-b)<2;
const strSim=(a,b)=>{a=(a||"").toLowerCase();b=(b||"").toLowerCase();let m=0;for(let c of a)if(b.includes(c))m++;return m/Math.max(a.length,b.length,1);};
const LOCKED_OWNER_EMAIL = "akshaychouhan16803@gmail.com";
const DEFAULT_GOOGLE_CLIENT_ID = "975238186836-47bvtn56uhrlcbe11n1pe1h26qbor5s1.apps.googleusercontent.com";
const BLOCKED_MS_CLIENT_IDS = new Set([
  // This legacy app id is in a tenant that does not allow personal Microsoft accounts.
  "c44b4083-3bb0-49c1-b47d-974e53cbdf3c",
]);
const sanitizeMsClientId = (id="") => {
  const v = String(id || "").trim();
  return BLOCKED_MS_CLIENT_IDS.has(v) ? "" : v;
};
const DEFAULT_MICROSOFT_CLIENT_ID = sanitizeMsClientId(import.meta.env.VITE_MICROSOFT_CLIENT_ID || "");
const DEFAULT_AI_MODEL = "gpt-4.1-mini";
const DEFAULT_BASE_CURRENCY = "INR";
const LEGACY_DEFAULT_CURRENCY = "INR";
const AI_CFG_KEY = "ledger_ai_cfg";
const CURRENCY_CFG_KEY = "ledger_currency_cfg";
const FX_CACHE_KEY = "ledger_fx_cache_v1";
const EMAIL_SYNC_CACHE_VERSION = "v5";
const BACKUP_KEY = "ledger_backups";
const MAX_BACKUPS = 50;
const FX_CACHE_MAX = 800;
const AI_PENDING_EMAIL_KEY = "ledger_ai_pending_email";
const AI_PENDING_RESET_KEY = "ledger_ai_pending_reset_at";
const AI_CLOUD_CLIENT_KEY = "ledger_ai_cloud_client";
const AI_CLOUD_CLIENT_LEGACY_KEY = "ledger_ai_cloud_client_legacy";
const AI_RETRY_INTERVAL_MS = 30 * 60 * 1000;
const AI_RETRY_BATCH_SIZE = 20;
const AI_CLOUD_PULL_LIMIT = 40;
const DIAG_LOG_KEY = "ledger_diag_log_v1";
const DIAG_MAX_EVENTS = 400;
const DIAG_EXPORT_LIMIT = 180;
const DIAG_REPEAT_WINDOW_MS = 4000;
const REDACTED = "[redacted]";
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY_OPTIONS = ["INR","USD","EUR","GBP","AED","AUD","CAD","SGD","JPY","CNY","HKD","CHF"];
const CURRENCY_ALIASES = {
  "₹":"INR",
  "RS":"INR",
  "RS.":"INR",
  "RUPEE":"INR",
  "RUPEES":"INR",
  "INR":"INR",
  "$":"USD",
  "US$":"USD",
  "USD":"USD",
  "DOLLAR":"USD",
  "DOLLARS":"USD",
  "€":"EUR",
  "EUR":"EUR",
  "EURO":"EUR",
  "EUROS":"EUR",
  "£":"GBP",
  "GBP":"GBP",
  "POUND":"GBP",
  "POUNDS":"GBP",
  "AED":"AED",
  "DIRHAM":"AED",
  "DIRHAMS":"AED",
  "AUD":"AUD",
  "CAD":"CAD",
  "SGD":"SGD",
  "JPY":"JPY",
  "YEN":"JPY",
  "CNY":"CNY",
  "RMB":"CNY",
  "HKD":"HKD",
  "CHF":"CHF",
};

function aiPendingId(accountId="",msgId=""){
  return `${String(accountId||"").trim()}::${String(msgId||"").trim()}`;
}

function normalizeAiEndpointUrl(value=""){
  const raw=String(value||"").trim();
  if(!raw)return "";
  const prefixed=raw.startsWith("//")?`https:${raw}`:raw;
  const withScheme=/^https?:\/\//i.test(prefixed)?prefixed:`https://${prefixed}`;
  return withScheme.replace(/\/+$/,"");
}

function normalizeAICfg(cfg={}){
  const endpoint=normalizeAiEndpointUrl(cfg?.endpoint||"");
  const secret=String(cfg?.secret||"").trim();
  const model=String(cfg?.model||DEFAULT_AI_MODEL).trim()||DEFAULT_AI_MODEL;
  return {endpoint,secret,model};
}

function loadAICfg(){
  return normalizeAICfg(LS.get(AI_CFG_KEY,{endpoint:"",secret:"",model:DEFAULT_AI_MODEL}));
}

function saveAICfgToStorage(cfg={}){
  const next=normalizeAICfg(cfg);
  LS.set(AI_CFG_KEY,next);
  return next;
}

function normalizeAiPendingEntry(entry={}){
  const id = String(entry.id || aiPendingId(entry.accountId, entry.msgId) || gid());
  return {
    id,
    accountId: String(entry.accountId || ""),
    provider: String(entry.provider || "google").toLowerCase() === "microsoft" ? "microsoft" : "google",
    msgId: String(entry.msgId || ""),
    subject: String(entry.subject || ""),
    from: String(entry.from || ""),
    emailDate: String(entry.emailDate || ""),
    snippet: String(entry.snippet || ""),
    queuedAt: String(entry.queuedAt || new Date().toISOString()),
    lastTriedAt: String(entry.lastTriedAt || ""),
    attempts: Math.max(0, Number(entry.attempts) || 0),
    nextRetryAt: String(entry.nextRetryAt || new Date(Date.now() + AI_RETRY_INTERVAL_MS).toISOString()),
    lastError: String(entry.lastError || ""),
    cloudQueued: Boolean(entry.cloudQueued),
    cloudJobId: String(entry.cloudJobId || id),
  };
}

function getAiPendingResetAtMs(){
  const raw=String(LS.get(AI_PENDING_RESET_KEY,"")||"").trim();
  const ts=Date.parse(raw);
  return Number.isFinite(ts)?ts:0;
}

function isAiPendingStaleAfterReset(entry={}){
  const resetAtMs=getAiPendingResetAtMs();
  if(!resetAtMs)return false;
  const candidateTs=
    Date.parse(String(entry?.completedAt||""))
    || Date.parse(String(entry?.queuedAt||""))
    || Date.parse(String(entry?.lastTriedAt||""))
    || 0;
  return Number.isFinite(candidateTs)&&candidateTs>0&&candidateTs<resetAtMs;
}

function defaultCloudCfg(){
  return{
    clientId:sanitizeMsClientId(DEFAULT_MICROSOFT_CLIENT_ID||""),
    email:"",
    name:"",
    enabled:false,
    url:"",
    key:"",
    needsReconnect:false,
    lastError:"",
    lastErrorAt:"",
  };
}

function quickHash(str=""){
  let h=2166136261;
  for(let i=0;i<str.length;i++){
    h^=str.charCodeAt(i);
    h=Math.imul(h,16777619);
  }
  return (h>>>0).toString(36);
}

function getStableAiCloudClientId(){
  const owner=String(LOCKED_OWNER_EMAIL||"").trim().toLowerCase()||"ledgerai-owner";
  return `ledger-${quickHash(owner)}`;
}

function normalizeClientList(items=[]){
  return Array.from(new Set((items||[]).map(v=>String(v||"").trim()).filter(Boolean))).slice(0,6);
}

function getAiCloudClientIds(){
  const stableId=getStableAiCloudClientId();
  const savedId=String(LS.get(AI_CLOUD_CLIENT_KEY,"")||"").trim();
  const legacySaved=LS.get(AI_CLOUD_CLIENT_LEGACY_KEY,[]);
  const mergedLegacy=normalizeClientList([
    ...(Array.isArray(legacySaved)?legacySaved:[]),
    savedId&&savedId!==stableId?savedId:"",
  ]).filter(id=>id!==stableId);
  LS.set(AI_CLOUD_CLIENT_KEY,stableId);
  LS.set(AI_CLOUD_CLIENT_LEGACY_KEY,mergedLegacy);
  return [stableId,...mergedLegacy];
}

function getAiCloudClientId(){
  return getAiCloudClientIds()[0]||getStableAiCloudClientId();
}

function sanitizeEmailsForCloud(list=[]){
  return (list||[]).map(a=>({...a,token:undefined}));
}

function persistEmailsLocally(list=[]){
  return (list||[]).map(a=>({...a}));
}

function maskEmailForDiagnostics(value=""){
  const raw=String(value||"").trim();
  const at=raw.indexOf("@");
  if(at<=0)return raw?`${raw.slice(0,2)}***`:"";
  const local=raw.slice(0,at);
  const domain=raw.slice(at+1);
  const head=local.length<=2?local[0]||"":local.slice(0,2);
  return `${head}***@${domain}`;
}

function redactSensitiveText(value=""){
  let text=String(value??"");
  if(!text)return "";
  text=text.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi,"Bearer [redacted]");
  text=text.replace(/\b(?:sk|rk)-[A-Za-z0-9_-]{12,}\b/g,REDACTED);
  text=text.replace(/\beyJ[A-Za-z0-9._-]{20,}\b/g,"[redacted-jwt]");
  text=text.replace(/(x-ledgerai-key["']?\s*[:=]\s*["']?)[^"'\s,]+/gi,`$1${REDACTED}`);
  text=text.replace(/(authorization["']?\s*[:=]\s*["']?)[^"'\s,]+/gi,`$1${REDACTED}`);
  return text;
}

function sanitizeDiagnosticValue(value,depth=0,seen=new WeakSet()){
  if(value===null||value===undefined)return value;
  if(depth>4)return "[truncated]";
  if(value instanceof Error){
    return{
      name:String(value.name||"Error"),
      message:redactSensitiveText(value.message||""),
      stack:redactSensitiveText(String(value.stack||"")).split("\n").slice(0,8).join("\n"),
    };
  }
  const t=typeof value;
  if(t==="string")return redactSensitiveText(value).slice(0,1200);
  if(t==="number"||t==="boolean")return value;
  if(t==="function")return `[function ${value.name||"anonymous"}]`;
  if(Array.isArray(value)){
    const items=value.slice(0,12).map(v=>sanitizeDiagnosticValue(v,depth+1,seen));
    if(value.length>12)items.push(`[+${value.length-12} more]`);
    return items;
  }
  if(t==="object"){
    if(seen.has(value))return "[circular]";
    seen.add(value);
    const out={};
    const entries=Object.entries(value);
    for(const [idx,[k,v]] of entries.entries()){
      if(idx>=16){
        out.__truncated__=`+${entries.length-16} more`;
        break;
      }
      const key=String(k||"");
      if(/token|secret|password|authorization|cookie|api[_-]?key|shared[_-]?key/i.test(key)){
        out[key]=REDACTED;
      }else if(/(^|_)email$|mail|ownerEmail|userPrincipalName/i.test(key)&&typeof v==="string"){
        out[key]=maskEmailForDiagnostics(v);
      }else{
        out[key]=sanitizeDiagnosticValue(v,depth+1,seen);
      }
    }
    seen.delete(value);
    return out;
  }
  return redactSensitiveText(String(value)).slice(0,1200);
}

function formatDiagnosticArgs(args=[]){
  return redactSensitiveText(args.map(arg=>{
    if(arg instanceof Error)return arg.message||arg.name||"Error";
    if(typeof arg==="string")return arg;
    try{return JSON.stringify(sanitizeDiagnosticValue(arg));}
    catch{return String(arg);}
  }).join(" ")).slice(0,220);
}

function normalizeDiagnosticEntry(entry={}){
  const level=["info","warn","error"].includes(entry.level)?entry.level:"info";
  const scope=String(entry.scope||"app").trim().slice(0,40)||"app";
  const event=String(entry.event||"event").trim().slice(0,80)||"event";
  const message=redactSensitiveText(String(entry.message||event||"")).slice(0,220)||event;
  return{
    id:String(entry.id||gid()),
    ts:String(entry.ts||new Date().toISOString()),
    level,
    scope,
    event,
    accountId:String(entry.accountId||"").trim(),
    provider:String(entry.provider||"").trim(),
    message,
    context:sanitizeDiagnosticValue(entry.context||{}),
    repeat:Math.max(1,Number(entry.repeat)||1),
  };
}

function appendDiagnosticEntry(list=[],entry={}){
  const next=normalizeDiagnosticEntry(entry);
  const prev=Array.isArray(list)?list:[];
  const last=prev[prev.length-1];
  if(last&&last.level===next.level&&last.scope===next.scope&&last.event===next.event&&last.message===next.message&&last.accountId===next.accountId&&last.provider===next.provider){
    const delta=Math.abs(Date.parse(next.ts)-Date.parse(last.ts));
    if(Number.isFinite(delta)&&delta<=DIAG_REPEAT_WINDOW_MS){
      return [
        ...prev.slice(0,-1),
        {
          ...last,
          ts:next.ts,
          repeat:(last.repeat||1)+1,
          context:Object.keys(next.context||{}).length?next.context:last.context,
        },
      ];
    }
  }
  return [...prev,next].slice(-DIAG_MAX_EVENTS);
}

function loadDiagnostics(){
  const raw=LS.get(DIAG_LOG_KEY,[]);
  return Array.isArray(raw)?raw.map(item=>normalizeDiagnosticEntry(item)).slice(-DIAG_MAX_EVENTS):[];
}

function copyTextToClipboard(text=""){
  const value=String(text||"");
  if(!value)return Promise.resolve(false);
  if(navigator?.clipboard?.writeText){
    return navigator.clipboard.writeText(value).then(()=>true).catch(()=>false);
  }
  try{
    const ta=document.createElement("textarea");
    ta.value=value;
    ta.setAttribute("readonly","readonly");
    ta.style.position="fixed";
    ta.style.opacity="0";
    document.body.appendChild(ta);
    ta.select();
    const ok=document.execCommand("copy");
    document.body.removeChild(ta);
    return Promise.resolve(Boolean(ok));
  }catch{
    return Promise.resolve(false);
  }
}

function downloadJsonFile(filename,data){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=filename;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1500);
}

function safeOrigin(value=""){
  const raw=String(value||"").trim();
  if(!raw)return "";
  try{
    const url=new URL(raw);
    return `${url.origin}${url.pathname}`;
  }catch{
    return raw;
  }
}

function summarizeDiagnostics(entries=[]){
  return (entries||[]).reduce((acc,item)=>{
    const level=item?.level||"info";
    acc.total+=Number(item?.repeat)||1;
    if(level==="error")acc.errors+=Number(item?.repeat)||1;
    else if(level==="warn")acc.warnings+=Number(item?.repeat)||1;
    else acc.info+=Number(item?.repeat)||1;
    return acc;
  },{total:0,errors:0,warnings:0,info:0});
}

function buildSupportBundle({
  diagnostics=[],
  authCfg={},
  authUser=null,
  currencyCfg={},
  txns=[],
  inbox=[],
  accs=[],
  acts=[],
  smsNums=[],
  emails=[],
  sbCfg={},
  syncStatus="idle",
  lastSync="",
  aiPending=[],
  backups=[],
}={}){
  const aiCfg=loadAICfg();
  const counts=summarizeDiagnostics(diagnostics);
  const pendingRows=(aiPending||[]).map(normalizeAiPendingEntry);
  const pendingByAccount=pendingRows.reduce((map,row)=>{
    map[row.accountId]=(map[row.accountId]||0)+1;
    return map;
  },{});
  const latestBackups=[...(backups||[])].slice(-5).reverse().map(b=>({
    ts:String(b?.ts||""),
    reason:String(b?.reason||""),
    meta:sanitizeDiagnosticValue(b?.meta||{}),
  }));
  const emailAccounts=(emails||[]).map(item=>{
    const acc=hydrateEmailAccount(item);
    return{
      id:String(acc.id||""),
      provider:String(acc.provider||"google"),
      email:maskEmailForDiagnostics(acc.email||acc.label||""),
      connected:Boolean(acc.connected),
      userDisconnected:Boolean(acc.userDisconnected),
      reauthRequired:Boolean(acc.reauthRequired),
      firstSyncCompleted:Boolean(acc.firstSyncCompleted),
      syncFromDate:String(acc.syncFromDate||""),
      lastSync:String(acc.lastSync||""),
      lastAuthAt:String(acc.lastAuthAt||""),
      lastError:redactSensitiveText(String(acc.lastError||"")).slice(0,180),
      lastErrorAt:String(acc.lastErrorAt||""),
      pendingAi:pendingByAccount[acc.id]||0,
    };
  });
  return{
    exportedAt:new Date().toISOString(),
    diagnosticsVersion:1,
    app:{
      origin:window.location.origin,
      path:window.location.pathname,
      href:window.location.href,
      userAgent:navigator.userAgent,
      language:navigator.language||"",
      online:Boolean(navigator.onLine),
      visibility:document.visibilityState||"",
      timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone||"",
    },
    auth:{
      enabled:Boolean(authCfg?.enabled),
      signedIn:Boolean(authUser?.email),
      ownerEmail:maskEmailForDiagnostics(authCfg?.ownerEmail||""),
      userEmail:maskEmailForDiagnostics(authUser?.email||""),
    },
    dataCounts:{
      transactions:(txns||[]).length,
      inbox:(inbox||[]).length,
      inboxEmail:(inbox||[]).filter(i=>i?.source==="email").length,
      inboxSms:(inbox||[]).filter(i=>i?.source==="sms").length,
      accounts:(accs||[]).length,
      activities:(acts||[]).length,
      smsNumbers:(smsNums||[]).length,
      emailAccounts:emailAccounts.length,
      aiPending:pendingRows.length,
      backups:(backups||[]).length,
    },
    aiBackend:{
      configured:Boolean(aiCfg.endpoint),
      endpoint:safeOrigin(aiCfg.endpoint),
      sharedKeyConfigured:Boolean(aiCfg.secret),
      model:String(aiCfg.model||DEFAULT_AI_MODEL),
    },
    currency:{
      baseCurrency:normalizeCurrencyCode(currencyCfg?.baseCurrency||getBaseCurrency(),getBaseCurrency()),
      fxCacheEntries:Object.keys(loadFxCache()).length,
    },
    cloud:{
      enabled:Boolean(sbCfg?.enabled),
      needsReconnect:Boolean(sbCfg?.needsReconnect),
      syncStatus:String(syncStatus||"idle"),
      lastSync:String(lastSync||""),
      accountEmail:maskEmailForDiagnostics(sbCfg?.email||""),
      clientIdConfigured:Boolean((sbCfg?.clientId||DEFAULT_MICROSOFT_CLIENT_ID||"").trim()),
      lastError:redactSensitiveText(String(sbCfg?.lastError||"")).slice(0,180),
      lastErrorAt:String(sbCfg?.lastErrorAt||""),
    },
    email:{
      accounts:emailAccounts,
      pendingRetryRows:pendingRows.slice(0,40).map(row=>({
        id:row.id,
        accountId:row.accountId,
        provider:row.provider,
        msgId:row.msgId,
        emailDate:row.emailDate,
        attempts:row.attempts,
        nextRetryAt:row.nextRetryAt,
        lastTriedAt:row.lastTriedAt,
        lastError:redactSensitiveText(String(row.lastError||"")).slice(0,180),
        cloudQueued:Boolean(row.cloudQueued),
      })),
    },
    backups:latestBackups,
    diagnostics:{
      counts,
      recentEvents:(diagnostics||[]).slice(-DIAG_EXPORT_LIMIT),
    },
    notes:[
      "Secrets and tokens are redacted in this bundle.",
      "Emails are masked in support exports.",
      "Recent diagnostics are kept locally in browser storage until cleared.",
    ],
  };
}

function buildSupportReportText(bundle={}){
  const counts=bundle?.diagnostics?.counts||{total:0,errors:0,warnings:0,info:0};
  const lines=[
    "LedgerAI Support Report",
    `Exported: ${bundle.exportedAt||""}`,
    `URL: ${bundle?.app?.href||""}`,
    `Browser: ${bundle?.app?.userAgent||""}`,
    `Time zone: ${bundle?.app?.timeZone||""}`,
    `Online: ${bundle?.app?.online?"yes":"no"} | Visibility: ${bundle?.app?.visibility||""}`,
    "",
    `Auth: enabled=${bundle?.auth?.enabled?"yes":"no"} signedIn=${bundle?.auth?.signedIn?"yes":"no"} user=${bundle?.auth?.userEmail||""}`,
    `AI backend: configured=${bundle?.aiBackend?.configured?"yes":"no"} endpoint=${bundle?.aiBackend?.endpoint||""} sharedKey=${bundle?.aiBackend?.sharedKeyConfigured?"yes":"no"} model=${bundle?.aiBackend?.model||""}`,
    `Currency: base=${bundle?.currency?.baseCurrency||DEFAULT_BASE_CURRENCY} fxCache=${bundle?.currency?.fxCacheEntries||0}`,
    `Cloud: enabled=${bundle?.cloud?.enabled?"yes":"no"} reconnect=${bundle?.cloud?.needsReconnect?"yes":"no"} syncStatus=${bundle?.cloud?.syncStatus||"idle"} lastSync=${bundle?.cloud?.lastSync||""}`,
    `Data counts: txns=${bundle?.dataCounts?.transactions||0} inbox=${bundle?.dataCounts?.inbox||0} emailAccounts=${bundle?.dataCounts?.emailAccounts||0} aiPending=${bundle?.dataCounts?.aiPending||0}`,
    "",
    "Email accounts:",
    ...(bundle?.email?.accounts?.length?bundle.email.accounts.map(acc=>`- ${acc.provider} ${acc.email} connected=${acc.connected?"yes":"no"} reauth=${acc.reauthRequired?"yes":"no"} pendingAi=${acc.pendingAi||0} lastSync=${acc.lastSync||""}${acc.lastError?` lastError=${acc.lastError}`:""}`):["- none"]),
    "",
    `Diagnostics: total=${counts.total||0} errors=${counts.errors||0} warnings=${counts.warnings||0} info=${counts.info||0}`,
    "Recent events:",
    ...(bundle?.diagnostics?.recentEvents?.length?bundle.diagnostics.recentEvents.slice(-40).map(item=>{
      const repeat=(item?.repeat||1)>1?` x${item.repeat}`:"";
      const account=item?.accountId?` account=${item.accountId}`:"";
      return `- [${item.ts||""}] ${String(item.level||"info").toUpperCase()} ${item.scope||"app"}/${item.event||"event"}${account}: ${item.message||""}${repeat}`;
    }):["- none"]),
  ];
  return lines.join("\n");
}

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

function sanitizeEmailTransactions(items=[],ctx={}){
  if(!Array.isArray(items)||!items.length)return[];
  const activities=Array.isArray(ctx.acts)?ctx.acts:[];
  const categories=(ctx.cats&&typeof ctx.cats==="object")?ctx.cats:{};
  const fallbackAct=activities.includes("Personal")?"Personal":(activities[0]||"Personal");
  const fallbackCurrency=normalizeCurrencyCode(ctx.baseCurrency||getBaseCurrency(),getBaseCurrency());
  return items.map((x,idx)=>{
    const rawType=String(x?.type||"").trim().toLowerCase();
    if(!["income","expense","transfer"].includes(rawType))return null;
    const amount=Number(x?.amount);
    if(!(amount>0))return null;
    const requestedAct=String(x?.businessActivity||fallbackAct).trim();
    const businessActivity=activities.includes(requestedAct)?requestedAct:fallbackAct;
    const catList=categories[businessActivity]||[];
    const baseCategory=rawType==="transfer"?"Account Transfer":"Other";
    const requestedCategory=String(x?.category||"").trim();
    const category=requestedCategory||baseCategory;
    const subCategory=String(x?.subCategory||"").trim();
    const desc=String(x?.description||"").trim()||String(ctx.subject||`Email ${rawType}`).trim()||`${rawType} from email`;
    const vendor=String(x?.vendor||"").trim()||String(ctx.from||"").trim();
    const paymentMethod=String(x?.paymentMethod||"").trim()||(rawType==="transfer"?"Account Transfer":"");
    const date=String(x?.date||ctx.eDate||today()).trim();
    const accountName=String(x?.accountName||x?.fromAccountName||"").trim();
    const targetAccountName=String(x?.targetAccountName||x?.toAccountName||"").trim();
    const currency=normalizeCurrencyCode(x?.currency||x?.currencyCode||"",fallbackCurrency);
    const isNewCategory=rawType==="transfer"?false:(Boolean(x?.isNewCategory)||Boolean(category&&!catList.includes(category)));
    return{
      ...x,
      _aiIndex:idx,
      type:rawType,
      amount,
      originalAmount:roundMoney(Number(x?.originalAmount??amount)),
      currency,
      businessActivity,
      category,
      subCategory:subCategory.slice(0,120),
      isNewCategory,
      description:desc.slice(0,180),
      vendor:vendor.slice(0,140),
      trackVendor:Boolean(vendor),
      paymentMethod:paymentMethod.slice(0,80),
      date:date||today(),
      accountName:accountName.slice(0,120),
      targetAccountName:targetAccountName.slice(0,120),
    };
  }).filter(Boolean);
}

async function convertExtractedItemsToBaseCurrency(items=[],{
  baseCurrency=getBaseCurrency(),
  fallbackCurrency=baseCurrency,
  dateFallback=today(),
}={}){
  return convertMoneyRows(items,{
    baseCurrency:normalizeCurrencyCode(baseCurrency,getBaseCurrency()),
    fallbackCurrency:normalizeCurrencyCode(fallbackCurrency,baseCurrency),
    dateResolver:(row)=>row?.date||dateFallback,
  });
}

function isVendorTracked(entry={}){
  if(entry?.trackVendor===true)return true;
  if(entry?.trackVendor===false)return false;
  return Boolean(String(entry?.vendor||"").trim());
}

function normalizeTrackedVendor(entry={}){
  const vendor=String(entry?.vendor||"").trim();
  return{
    ...entry,
    vendor:vendor.slice(0,140),
    trackVendor:isVendorTracked({...entry,vendor}),
  };
}

function getAccountingValidationMessage(entry={},accs=[]){
  const tx=normalizeTrackedVendor(entry);
  const errors=[];
  const amt=Number(tx.amount);
  if(!(amt>0))errors.push("enter a valid amount");
  if(tx.type==="transfer"){
    if((accs||[]).length<2)errors.push("add at least two accounts before approving a transfer");
    if(!tx.accountId)errors.push("select the transfer from account");
    if(!tx.targetAccountId)errors.push("select the transfer to account");
    if(tx.accountId&&tx.targetAccountId&&tx.accountId===tx.targetAccountId)errors.push("choose different transfer from and to accounts");
  }else{
    if((accs||[]).length===0)errors.push("add at least one account before approving");
    if(!tx.accountId)errors.push(tx.type==="income"?"select the receiving account":"select the account used");
  }
  if(tx.type==="borrow"&&!tx.liabilityAccountId&&!(tx.borrowSource||"").trim())errors.push("select a liability account or enter the borrowed source");
  if(tx.type!=="transfer"&&tx.type!=="borrow"){
    if(!String(tx.businessActivity||"").trim())errors.push("select the business activity");
    if(!String(tx.category||"").trim())errors.push("select the category");
  }
  if(tx.trackVendor&&!String(tx.vendor||"").trim())errors.push("enter the vendor name or turn off vendor tracking");
  if(!errors.length)return "";
  return `Update the mandatory fields before saving or approving: ${errors.join(", ")}.`;
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
  if(msg.includes("ai_retry_required"))return "ai-retry";
  if(msg.includes("parse_failed"))return "parse";
  if(msg.includes("not configured")||msg.includes("missing openai_api_key")||msg.includes("missing anthropic_api_key"))return "config";
  if(msg.includes("unauthorized")||msg.includes("forbidden"))return "auth";
  if(msg.includes("replace is not a function")||msg.includes("invalid ai response")||msg.includes("ai response missing"))return "backend-format";
  if(status===401||status===403)return "auth";
  if(status===429)return "rate-limit";
  if(status>=500&&status<600)return "server";
  if(msg.includes("timed out"))return "timeout";
  if(msg.includes("network")||msg.includes("failed to fetch"))return "network";
  return status?`http-${status}`:"other";
}

function formatFailureSummary(reasons={}){
  const labels={auth:"auth","rate-limit":"rate limit",server:"server",timeout:"timeout",network:"network",config:"config","backend-format":"backend format","ai-retry":"ai retry",parse:"parse",other:"other"};
  const top=Object.entries(reasons).sort((a,b)=>b[1]-a[1]).slice(0,3);
  if(!top.length)return "";
  return top.map(([k,v])=>`${labels[k]||k}: ${v}`).join(", ");
}

function friendlyMicrosoftAuthError(err){
  const raw=String(err?.message||err?.errorCode||err||"Microsoft OAuth failed.");
  const msg=raw.toLowerCase();
  if(msg.includes("interaction_in_progress")){
    return "Microsoft sign-in is already open in another popup/tab. Close Microsoft login popups, then try Connect Outlook once.";
  }
  if(msg.includes("redirect_uri_mismatch")||msg.includes("aadsts50011")){
    return `Microsoft redirect URI mismatch. Add SPA redirect URI in Azure app: ${window.location.origin}`;
  }
  if(msg.includes("personal account")||msg.includes("work or school account")){
    return "This Azure app currently blocks personal Outlook accounts. In Azure App Registration → Authentication, set Supported account types to include Personal Microsoft accounts.";
  }
  if(msg.includes("aadsts700016")||msg.includes("invalid_client")){
    return "Azure client ID is invalid for this app or tenant. Recheck VITE_MICROSOFT_CLIENT_ID / Cloud connector client ID.";
  }
  if(msg.includes("user_cancelled")||msg.includes("popup_closed")||msg.includes("popup_window_error")){
    return "Microsoft sign-in was cancelled.";
  }
  return raw;
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

function buildJE(tx,accs=[]){
  const accName=id=>{const a=accs.find(x=>x.id===id);return a?.name||"";};
  const payAcc=()=>{if(tx.accountId){const n=accName(tx.accountId);if(n)return n;}return tx.paymentMethod==="Credit Card"?"Credit Card Payable":"Bank Account – Savings";};
  if(tx.type==="transfer"){
    const fromAcc=accName(tx.accountId)||"From Account";
    const toAcc=accName(tx.targetAccountId)||"To Account";
    return[{account:toAcc,dr:tx.amount,cr:0},{account:fromAcc,dr:0,cr:tx.amount}];
  }
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
  const normalizeAIText=(value)=>{
    if(typeof value==="string")return value;
    if(Array.isArray(value)){
      const joined=value.map(part=>{
        if(typeof part==="string")return part;
        if(part&&typeof part==="object"){
          return String(part.text||part.output_text||part.content||"");
        }
        return "";
      }).filter(Boolean).join("\n");
      return joined;
    }
    if(value&&typeof value==="object"){
      return String(value.text||value.output_text||value.content||"");
    }
    return "";
  };
  const cfg=loadAICfg();
  const endpoint=cfg.endpoint;
  const secret=cfg.secret;
  const model=cfg.model;
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
    const out=
      d.text
      ?? d.output_text
      ?? d.output
      ?? d.content?.[0]?.text
      ?? d.content
      ?? d.result?.content?.[0]?.text
      ?? d.result?.output_text
      ?? "";
    const normalized=normalizeAIText(out);
    if(typeof normalized!=="string")throw new Error("Invalid AI response format");
    return normalized;
  }catch(e){
    if(e?.name==="AbortError")throw new Error("AI request timed out");
    throw e;
  }finally{
    clearTimeout(timer);
  }
}
async function aiClassify(text,acts,cats,type="expense"){
  const c=Object.entries(cats).map(([a,cs])=>`${a}: ${cs.join(", ")}`).join("\n");
  const baseCurrency=getBaseCurrency();
  try{
    const raw=await callAI([{role:"user",content:`Classify this ${type} for bookkeeping.\nText: "${text.slice(0,800)}"\nActivities: ${acts.join(", ")}\nCategories:\n${c}\nDetect the transaction currency explicitly. Use ISO currency code like INR, USD, EUR, GBP, AED.\nLedger base currency: ${baseCurrency}\nReturn ONLY JSON: {"businessActivity":"","category":"","isNewCategory":false,"description":"","amount":null,"currency":"","date":"YYYY-MM-DD","vendor":"","paymentMethod":""}`}]);
    try{return JSON.parse(raw.replace(/```json|```/g,"").trim());}catch{return {};}
  }catch{return {};}
}
async function aiExtractBatch(text,acts,cats){
  const c=Object.entries(cats).map(([a,cs])=>`${a}: ${cs.join(", ")}`).join("\n");
  const baseCurrency=getBaseCurrency();
  try{
    const raw=await callAI([{role:"user",content:`Extract ALL financial transactions from text.\nText:\n${text.slice(0,3000)}\nActivities: ${acts.join(", ")}\nCategories:\n${c}\nDetect the original transaction currency explicitly for every row and return ISO currency code.\nLedger base currency: ${baseCurrency}\nReturn ONLY JSON array: [{"type":"expense|income","businessActivity":"","category":"","isNewCategory":false,"description":"","amount":0,"currency":"","date":"YYYY-MM-DD","vendor":"","paymentMethod":""}]`}],1400);
    try{const a=JSON.parse(raw.replace(/```json|```/g,"").trim());return Array.isArray(a)?a:[];}catch{return[];}
  }catch{return[];}
}
function buildAiEmailAnalysisMessages(subject,from,body,acts,cats,meta={}){
  const c=Object.entries(cats).map(([a,cs])=>`${a}: ${cs.join(", ")}`).join("\n");
  const accountList=Array.isArray(meta.accountNames)?meta.accountNames.filter(Boolean):[];
  const accountsLine=accountList.length?accountList.join(", "):"Unknown";
  const attachmentNames=(meta.attachmentNames||[]).slice(0,12).join(", ");
  const attachmentText=clipTextForAI((meta.attachmentText||"")+"",11000);
  const emailBody=clipTextForAI((body||"")+"",11000);
  const hasAttachment=meta.hasAttachment?"yes":"no";
  const baseCurrency=normalizeCurrencyCode(meta.baseCurrency||getBaseCurrency(),getBaseCurrency());
  return [{role:"user",content:`You are a cashflow extraction engine for bookkeeping.
Analyze this ENTIRE email body and ENTIRE attachment text.
You must decide cashflow directly from the content without relying on external rules.

Tasks:
1) Determine whether this email has real cash movement data.
2) Extract all transactions if present.
3) Transaction type can be expense, income, or transfer.
4) For transfer, populate accountName (from) and targetAccountName (to) when inferable.
5) If account cannot be inferred, keep accountName/targetAccountName blank and still extract.
6) Detect the original currency explicitly for every transaction and return ISO currency code such as INR, USD, EUR, GBP, AED.

Output status:
- "success" when at least one valid transaction is extracted.
- "no_transaction" when email was processed and contains no cash movement.
- "retry" when extraction failed due to unreadable/insufficient/processing issues.

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
Known ledger account names (optional):
${accountsLine}
Ledger base currency: ${baseCurrency}

Return ONLY JSON:
{
  "status": "success|no_transaction|retry",
  "reason": "",
  "transactions": [
    {"type":"expense|income|transfer","businessActivity":"","category":"","isNewCategory":false,"description":"","amount":0,"currency":"","date":"YYYY-MM-DD","vendor":"","paymentMethod":"","accountName":"","targetAccountName":""}
  ]
}`}];
}

function parseAiEmailAnalysisRaw(raw=""){
  try{
    const obj=JSON.parse(String(raw||"").replace(/```json|```/g,"").trim());
    const tx=Array.isArray(obj?.transactions)?obj.transactions:[];
    const statusRaw=String(obj?.status||"").toLowerCase();
    const status=statusRaw==="success"||statusRaw==="no_transaction"||statusRaw==="retry"?statusRaw:(tx.length?"success":"no_transaction");
    return{
      status,
      reason:String(obj?.reason||""),
      transactions:tx,
    };
  }catch{
    return{status:"retry",reason:"parse_failed",transactions:[]};
  }
}
async function aiAnalyzeEmail(subject,from,body,acts,cats,meta={}){
  const messages=buildAiEmailAnalysisMessages(subject,from,body,acts,cats,meta);
  const raw=await callAI(messages,1600);
  return parseAiEmailAnalysisRaw(raw);
}

function matchesAccountForReconciliation(tx={},accountId="",accountName=""){
  const id=String(accountId||"").trim();
  const name=String(accountName||"").trim();
  if(!id&&!name)return false;
  return String(tx?.accountId||"")===id
    || String(tx?.targetAccountId||"")===id
    || (name&&String(tx?.accountName||"")===name)
    || (name&&String(tx?.targetAccountName||"")===name);
}

function aiCloudRetryUrl(endpoint="",path="/"){
  const base=normalizeAiEndpointUrl(endpoint||"");
  if(!base)throw new Error("AI backend endpoint missing");
  const u=new URL(base);
  u.pathname=path;
  u.search="";
  return u.toString();
}

function aiCloudRetryHeaders(secret=""){
  return{
    "Content-Type":"application/json",
    ...(secret?{"x-ledgerai-key":secret}:{}),
  };
}

async function enqueueCloudAiRetryJob(job,cfg=loadAICfg()){
  const endpoint=String(cfg?.endpoint||"").trim();
  if(!endpoint)return{ok:false,error:"endpoint_missing"};
  const secret=String(cfg?.secret||"").trim();
  const url=aiCloudRetryUrl(endpoint,"/retry/enqueue");
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),15000);
  try{
    const r=await fetch(url,{
      method:"POST",
      headers:aiCloudRetryHeaders(secret),
      body:JSON.stringify(job||{}),
      signal:ctrl.signal,
    });
    const txt=await r.text();
    let data={};
    try{data=JSON.parse(txt||"{}");}catch{}
    if(!r.ok){
      const unsupported=r.status===404||r.status===405||r.status===501;
      return{ok:false,status:r.status,error:String(data?.error||txt||`HTTP ${r.status}`).slice(0,180),unsupported};
    }
    return{ok:true,data};
  }catch(err){
    const msg=String(err?.message||"cloud_retry_enqueue_failed");
    return{ok:false,error:msg.includes("aborted")?"cloud_retry_enqueue_timeout":msg.slice(0,180)};
  }finally{
    clearTimeout(timer);
  }
}

async function pullCloudAiRetryJobs(clientId,limit=AI_CLOUD_PULL_LIMIT,cfg=loadAICfg()){
  const endpoint=String(cfg?.endpoint||"").trim();
  if(!endpoint)return{ok:false,error:"endpoint_missing"};
  const secret=String(cfg?.secret||"").trim();
  const urlObj=new URL(aiCloudRetryUrl(endpoint,"/retry/pull"));
  urlObj.searchParams.set("clientId",String(clientId||"").trim());
  urlObj.searchParams.set("limit",String(Math.max(1,Math.min(Number(limit)||AI_CLOUD_PULL_LIMIT,200))));
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),15000);
  try{
    const r=await fetch(urlObj.toString(),{
      method:"GET",
      headers:secret?{"x-ledgerai-key":secret}:{},
      signal:ctrl.signal,
    });
    const txt=await r.text();
    let data={};
    try{data=JSON.parse(txt||"{}");}catch{}
    if(!r.ok){
      const unsupported=r.status===404||r.status===405||r.status===501;
      return{ok:false,status:r.status,error:String(data?.error||txt||`HTTP ${r.status}`).slice(0,180),unsupported};
    }
    const jobs=Array.isArray(data?.jobs)?data.jobs:[];
    return{ok:true,jobs,processedCount:Number(data?.processedCount)||0};
  }catch(err){
    const msg=String(err?.message||"cloud_retry_pull_failed");
    return{ok:false,error:msg.includes("aborted")?"cloud_retry_pull_timeout":msg.slice(0,180)};
  }finally{
    clearTimeout(timer);
  }
}
async function aiParseStatement(text,name,type,accountCurrency="",baseCurrency=getBaseCurrency()){
  try{
    const raw=await callAI([{role:"user",content:`Parse bank/card statement.\nAccount: ${name} (${type})\nAccount currency hint: ${accountCurrency||"unknown"}\nLedger base currency: ${baseCurrency}\nStatement text:\n${text.slice(0,7000)}\nDetect the currency for every transaction row and return ISO currency code.\nReturn ONLY JSON array: [{"date":"YYYY-MM-DD","description":"","amount":0,"currency":"","type":"debit|credit","reference":"","balance":null,"balanceCurrency":""}]`}],1800);
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

function arrayBufferToBinaryString(buffer){
  const bytes=new Uint8Array(buffer||new ArrayBuffer(0));
  const chunk=0x8000;
  let out="";
  for(let i=0;i<bytes.length;i+=chunk){
    out+=String.fromCharCode(...bytes.subarray(i,i+chunk));
  }
  return out;
}

function readFileAsText(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error(`Unable to read ${file?.name||"file"}`));
    reader.onload=()=>resolve(String(reader.result||""));
    reader.readAsText(file);
  });
}

function readFileAsArrayBuffer(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error(`Unable to read ${file?.name||"file"}`));
    reader.onload=()=>resolve(reader.result);
    reader.readAsArrayBuffer(file);
  });
}

async function readStatementFileText(file){
  const name=String(file?.name||"").toLowerCase();
  const type=String(file?.type||"").toLowerCase();
  if(type.startsWith("text/")||type.includes("json")||type.includes("xml")||type.includes("csv")||/\.(txt|csv|json|xml|html?|md|log)$/i.test(name)){
    return await readFileAsText(file);
  }
  const raw=await readFileAsArrayBuffer(file);
  return extractAttachmentTextByType(arrayBufferToBinaryString(raw),type,name);
}

function sanitizeStatementRows(rows=[],ctx={}){
  const fallbackCurrency=normalizeCurrencyCode(ctx.accountCurrency||ctx.baseCurrency||getBaseCurrency(),getBaseCurrency());
  return (rows||[]).map((row,idx)=>{
    const amount=Number(row?.amount);
    if(!(amount>0))return null;
    const rawType=String(row?.type||"").trim().toLowerCase();
    const type=rawType==="credit"?"credit":"debit";
    const date=String(row?.date||ctx.dateFallback||today()).trim()||today();
    const description=String(row?.description||row?.reference||`Statement ${type}`).trim()||`Statement ${type}`;
    return{
      ...row,
      _sid:String(row?._sid||`stmt-${idx}`),
      amount,
      originalAmount:roundMoney(Number(row?.originalAmount??amount)||amount),
      currency:normalizeCurrencyCode(row?.currency||row?.balanceCurrency||"",fallbackCurrency),
      balance:Number.isFinite(Number(row?.balance))?Number(row.balance):null,
      balanceCurrency:normalizeCurrencyCode(row?.balanceCurrency||row?.currency||"",fallbackCurrency),
      type,
      date,
      description:description.slice(0,220),
      reference:String(row?.reference||"").trim().slice(0,120),
    };
  }).filter(Boolean);
}

async function prepareStatementRows(rows=[],ctx={}){
  const sanitized=sanitizeStatementRows(rows,ctx);
  return await convertMoneyRows(sanitized,{
    baseCurrency:normalizeCurrencyCode(ctx.baseCurrency||getBaseCurrency(),getBaseCurrency()),
    fallbackCurrency:normalizeCurrencyCode(ctx.accountCurrency||ctx.baseCurrency||getBaseCurrency(),getBaseCurrency()),
    dateResolver:(row)=>row?.date||ctx.dateFallback||today(),
  });
}

function inDateRange(date="",from="",to=""){
  const value=String(date||"").trim();
  if(!value)return true;
  if(from&&value<from)return false;
  if(to&&value>to)return false;
  return true;
}

function reconciliationScore(statementRow={},ledgerTx={}){
  const days=Math.abs((Date.parse(statementRow?.date||"")-Date.parse(ledgerTx?.date||""))/86400000||0);
  const amountGap=Math.abs((Number(statementRow?.amount)||0)-(Number(ledgerTx?.amount)||0));
  const desc=strSim(statementRow?.description||"",ledgerTx?.description||ledgerTx?.category||"");
  return Math.max(0,(1/(1+days))*30 + Math.max(0,25-amountGap*4) + desc*45);
}

function buildReconciliationResult(statementRows=[],ledgerRows=[]){
  const unmatchedLedger=new Set((ledgerRows||[]).map(tx=>tx.id));
  const matched=[];
  const amountMismatches=[];
  const statementOnly=[];
  const ledgerOnly=[];

  (statementRows||[]).forEach((row,idx)=>{
    const candidates=(ledgerRows||[])
      .filter(tx=>unmatchedLedger.has(tx.id))
      .map(tx=>({
        tx,
        days:Math.abs((Date.parse(row.date||"")-Date.parse(tx.date||""))/86400000||0),
        amountGap:Math.abs((Number(row.amount)||0)-(Number(tx.amount)||0)),
        desc:strSim(row.description||"",tx.description||tx.category||""),
        score:reconciliationScore(row,tx),
      }))
      .filter(c=>c.days<=5||c.desc>=0.3)
      .sort((a,b)=>b.score-a.score);
    const best=candidates[0]||null;
    const txDirection=best?.tx?._reconSide||(best?.tx?.type==="income"?"credit":best?.tx?.type==="expense"||best?.tx?.type==="borrow"?"debit":"");
    const sameDirection=row.type===txDirection;
    if(best&&sameDirection&&best.amountGap<2&&best.days<=3){
      unmatchedLedger.delete(best.tx.id);
      matched.push({id:`match-${idx}`,statementRow:row,ledgerTx:best.tx,score:best.score});
      return;
    }
    if(best&&sameDirection&&best.days<=5&&best.desc>=0.25){
      unmatchedLedger.delete(best.tx.id);
      amountMismatches.push({id:`mismatch-${idx}`,statementRow:row,ledgerTx:best.tx,score:best.score,amountGap:best.amountGap,dayGap:best.days});
      return;
    }
    statementOnly.push({id:`stmt-${idx}`,statementRow:row});
  });

  (ledgerRows||[]).forEach(tx=>{
    if(unmatchedLedger.has(tx.id))ledgerOnly.push({id:`ledger-${tx.id}`,ledgerTx:tx});
  });

  return{
    matched,
    amountMismatches,
    statementOnly,
    ledgerOnly,
  };
}

// ── ONEDRIVE / MICROSOFT GRAPH HELPERS ────────────────────────────────────────
const GRAPH = "https://graph.microsoft.com/v1.0";
const OD_FILE = "LedgerAI/ledgerai-data.json";         // saved at OneDrive root/LedgerAI/
const OD_SCOPES = ["Files.ReadWrite", "User.Read"];
const MS_MAIL_SCOPES = ["Mail.Read", "User.Read"];
const MSAL_CDN = "https://alcdn.msauth.net/browser/2.38.2/js/msal-browser.min.js";
const MS_AUTHORITY = "https://login.microsoftonline.com/consumers";

let _msalApp = null;
let _msalClientId = null;
let _msalInteractionQueue = Promise.resolve();
let _msalRedirectHandled = false;

function queueMsalInteraction(task){
  const run = () => Promise.resolve().then(task);
  const next = _msalInteractionQueue.then(run, run);
  // Keep queue alive even when one interactive auth step fails.
  _msalInteractionQueue = next.catch(() => {});
  return next;
}

function isMsalInteractionInProgressError(err){
  const msg = String(err?.errorCode || err?.message || err || "");
  return msg.toLowerCase().includes("interaction_in_progress");
}

function clearStaleMsalInteractionState(clientId){
  const stores = [window.localStorage, window.sessionStorage].filter(Boolean);
  const lowerClient = String(clientId || "").toLowerCase();
  for (const store of stores) {
    const keysToDelete = [];
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (!k) continue;
      const lk = k.toLowerCase();
      if (!lk.includes("msal")) continue;
      if (!lk.includes("interaction.status")) continue;
      if (lowerClient && !lk.includes(lowerClient)) continue;
      keysToDelete.push(k);
    }
    keysToDelete.forEach((k) => store.removeItem(k));
  }
}

async function runMsalInteractive(msal, clientId, task){
  try{
    return await queueMsalInteraction(task);
  }catch(err){
    if(!isMsalInteractionInProgressError(err)) throw err;
    // Recover from stale interaction lock left in storage by interrupted auth popups.
    clearStaleMsalInteractionState(clientId);
    await new Promise((res)=>setTimeout(res,120));
    return queueMsalInteraction(task);
  }
}

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
      auth: { clientId, authority: MS_AUTHORITY, redirectUri: window.location.origin },
      cache: { cacheLocation: "localStorage", storeAuthStateInCookie: false },
    });
    await _msalApp.initialize();
    _msalRedirectHandled = false;
    _msalClientId = clientId;
  }
  if(!_msalRedirectHandled){
    try{ await _msalApp.handleRedirectPromise(); }catch{}
    _msalRedirectHandled = true;
  }
  return _msalApp;
}

async function odLogin(clientId) {
  const msal = await getMsal(clientId);
  const result = await runMsalInteractive(msal, clientId, () => msal.loginPopup({ scopes: OD_SCOPES }));
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
    const r = await runMsalInteractive(msal, clientId, () => msal.acquireTokenPopup({ scopes: OD_SCOPES, account: accounts[0] }));
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
  const login=await runMsalInteractive(msal, clientId, () => msal.loginPopup({scopes:MS_MAIL_SCOPES,prompt:"select_account"}));
  const account=login.account||pickMsAccount(msal,{});
  if(!account)throw new Error("Microsoft account not found after login");
  try{
    const tok=await msal.acquireTokenSilent({scopes:MS_MAIL_SCOPES,account});
    return{account,accessToken:tok.accessToken};
  }catch{
    const tok=await runMsalInteractive(msal, clientId, () => msal.acquireTokenPopup({scopes:MS_MAIL_SCOPES,account}));
    return{account,accessToken:tok.accessToken};
  }
}

async function msGetMailToken(clientId,accountHint,opts={}){
  const msal=await getMsal(clientId);
  const account=pickMsAccount(msal,accountHint);
  if(!account)throw new Error("Not signed in to Microsoft");
  const interactive=opts?.interactive!==false;
  try{
    const tok=await msal.acquireTokenSilent({scopes:MS_MAIL_SCOPES,account});
    return{account,accessToken:tok.accessToken};
  }catch(err){
    if(!interactive)throw err;
    const tok=await runMsalInteractive(msal, clientId, () => msal.acquireTokenPopup({scopes:MS_MAIL_SCOPES,account,prompt:"select_account"}));
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
function initOAuth(clientId,cb,opts={}){
  if(!window.google?.accounts?.oauth2){cb(new Error("Google Identity Services not loaded"),null);return;}
  const prompt=String(opts?.prompt ?? "").trim();
  const loginHint=(opts?.loginHint || "").trim();
  const req={};
  if(prompt)req.prompt=prompt;
  if(loginHint)req.login_hint=loginHint;
  window.google.accounts.oauth2.initTokenClient({
    client_id:clientId,
    scope:"https://www.googleapis.com/auth/gmail.readonly",
    callback:(r)=>{
      if(r?.error)cb(new Error(r.error),null);
      else cb(null,r);
    },
    error_callback:(e)=>{
      const code=e?.type||e?.error||"oauth_error";
      cb(new Error(code),null);
    },
  }).requestAccessToken(req);
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

async function msListAttachments(token,msgId){
  const url=`${GRAPH}/me/messages/${msgId}/attachments?$top=25&$select=id,name,contentType,size,isInline,@odata.type`;
  const d=await msGraphFetch(url,token);
  return Array.isArray(d?.value)?d.value:[];
}

async function msGetAttachment(token,msgId,attachmentId){
  return msGraphFetch(`${GRAPH}/me/messages/${msgId}/attachments/${attachmentId}`,token);
}

async function msAttachmentEvidenceText(token,msgId,attachments=[]){
  if(!Array.isArray(attachments)||!attachments.length)return "";
  let totalBytes=0;
  const keep=attachments
    .filter(a=>a?.id&&a?.isInline!==true)
    .filter(a=>(Number(a?.size)||0)<=8_000_000)
    .filter(a=>{
      if(totalBytes>12_000_000)return false;
      totalBytes+=(Number(a?.size)||0);
      return true;
    })
    .slice(0,8);
  if(!keep.length)return "";
  const chunks=[];
  for(const a of keep){
    try{
      const full=await withTimeout(msGetAttachment(token,msgId,a.id),18000,`Outlook attachment ${a.name||a.id}`);
      const kind=(full?.["@odata.type"]||"").toLowerCase();
      if(!kind.includes("fileattachment"))continue;
      const binary=decodeB64Binary(full?.contentBytes||"");
      const compact=extractAttachmentTextByType(binary,full?.contentType||a?.contentType||"",full?.name||a?.name||"");
      const hints=extractAttachmentMoneyHints(compact);
      const sample=clipTextForAI(compact,9000);
      if(sample)chunks.push(`[${full?.name||a?.name||"attachment"}] ${hints?`Amount hints: ${hints}. `:""}${sample}`);
    }catch(e){
      console.warn("Outlook attachment read skipped",a?.name||a?.id,e);
    }
  }
  return chunks.join("\n");
}

function msExtractBody(msg){
  const txt=(msg?.body?.content||msg?.bodyPreview||"")+"";
  return txt.replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
}

function hydrateEmailAccount(acc={}){
  const query=((acc.syncQuery||"")+"").trim();
  const provider=((acc.provider||"google")+"").toLowerCase()==="microsoft"?"microsoft":"google";
  const userDisconnected=Boolean(acc.userDisconnected);
  const inferredConnected=Boolean(
    acc.connected
    || (!userDisconnected && (
      acc.email
      || acc.firstSyncCompleted
      || acc.lastSync
      || acc.lastAuthAt
    ))
  );
  return{
    ...acc,
    provider,
    syncQuery:provider==="google"?(!query||query===LEGACY_GMAIL_QUERY?GMAIL_QUERY:query):query,
    maxEmails:Math.max(1,Math.min(Number(acc.maxEmails)||100,5000)),
    autoPost:acc.autoPost!==false,
    autoSyncHourly:acc.autoSyncHourly!==false,
    connected:inferredConnected,
    userDisconnected,
    firstSyncCompleted:Boolean(acc.firstSyncCompleted),
    syncFromDate:(acc.syncFromDate||"")+"",
    tokenExpiresAt:(acc.tokenExpiresAt||"")+"",
    lastAutoSyncAt:(acc.lastAutoSyncAt||"")+"",
    lastAuthAt:(acc.lastAuthAt||"")+"",
    reauthRequired:Boolean(acc.reauthRequired),
    msClientId:sanitizeMsClientId((acc.msClientId||"")+""),
    msAccountId:(acc.msAccountId||"")+"",
    msUsername:(acc.msUsername||"")+"",
  };
}

function mergeLoadedEmailsWithLocalTokens(remoteList=[],localList=[]){
  const locals=(localList||[]).map(a=>hydrateEmailAccount(a));
  return (remoteList||[]).map(item=>{
    const remote=hydrateEmailAccount(item);
    const remoteEmail=(remote.email||"").toLowerCase();
    const local=locals.find(a=>a.id===remote.id)
      || locals.find(a=>a.provider===remote.provider&&remoteEmail&&(a.email||"").toLowerCase()===remoteEmail);
    if(!local)return remote;
    return{
      ...remote,
      token:local.token||remote.token,
      tokenExpiresAt:local.tokenExpiresAt||remote.tokenExpiresAt||"",
      clientId:remote.clientId||local.clientId||"",
      msClientId:remote.msClientId||local.msClientId||"",
      msAccountId:remote.msAccountId||local.msAccountId||"",
      msUsername:remote.msUsername||local.msUsername||"",
      lastAuthAt:local.lastAuthAt||remote.lastAuthAt||"",
      reauthRequired:Boolean(remote.reauthRequired&&!local.token),
    };
  });
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
  const[currencyCfg,setCurrencyCfg]=useState(()=>loadCurrencyCfg());
  const[reconAccountId,setReconAccountId]=useState("");
  const[txns,setTxns]=useState(()=>LS.get("ledger_txns",[]));
  const[acts,setActs]=useState(()=>LS.get("ledger_acts",DEF_ACTS));
  const[cats,setCats]=useState(()=>LS.get("ledger_cats",DEF_CATS));
  const[accs,setAccs]=useState(()=>LS.get("ledger_accs",[]));
  const[inbox,setInbox]=useState(()=>LS.get("ledger_inbox",[]));
  const[emails,setEmails]=useState(()=>LS.get("ledger_emails",[]).map(a=>hydrateEmailAccount(a)));
  const[smsNums,setSmsNums]=useState(()=>LS.get("ledger_sms",[]));
  const[sbCfg,setSbCfg]=useState(()=>{
    const base=defaultCloudCfg();
    const saved=LS.get("ledger_odcfg",base); // reusing name for compat
    return{...base,...saved,clientId:sanitizeMsClientId((saved.clientId||base.clientId||"").trim())};
  });
  const setSbCfgAlias=v=>setSbCfg(typeof v==="function"?v:v);
  const[syncStatus,setSyncStatus]=useState("idle"); // idle|syncing|ok|error
  const[lastSync,setLastSync]=useState(()=>LS.get("ledger_lastsync",""));
  const syncTimer=useRef(null);
  const cloudSyncPauseUntilRef=useRef(0);
  const cloudAutoLoadTriedRef=useRef(false);
  const[showAdd,setShowAdd]=useState(false);
  const[addType,setAddType]=useState("expense");
  const[editTx,setEditTx]=useState(null);
  const[summary,setSummary]=useState("");
  const[sumLoad,setSumLoad]=useState(false);
  const[filter,setFilter]=useState({activity:"All",type:"All",from:"",to:""});
  const canUseAuthBypass=typeof window!=="undefined"&&(window.location.hostname==="localhost"||window.location.hostname==="127.0.0.1");
  const bypassActive=Boolean(authCfg.enabled&&authBypass&&canUseAuthBypass);
  const[backups,setBackups]=useState(()=>LS.get(BACKUP_KEY,[]));
  const[resetVersion,setResetVersion]=useState(0);
  const[diagnostics,setDiagnostics]=useState(()=>loadDiagnostics());
  const diagnosticsRef=useRef(diagnostics);

  useEffect(()=>{
    diagnosticsRef.current=diagnostics;
  },[diagnostics]);

  const addDiagnostic=useCallback((entry={})=>{
    setDiagnostics(prev=>appendDiagnosticEntry(prev,entry));
  },[]);

  const clearDiagnostics=useCallback(()=>{
    setDiagnostics([]);
  },[]);

  const setCloudIssue=useCallback((message="",patch={})=>{
    const detail=redactSensitiveText(String(message||"")).slice(0,180);
    setSbCfg(prev=>({
      ...prev,
      ...patch,
      lastError:detail,
      lastErrorAt:detail?new Date().toISOString():"",
    }));
  },[]);

  const buildBackupSnapshot=useCallback((reason="auto")=>{
    const payload={
      currencyCfg,
      txns,
      inbox,
      accs,
      acts,
      cats,
      smsNums,
      emails:persistEmailsLocally(emails),
    };
    const raw=JSON.stringify(payload);
    return{
      id:gid(),
      ts:new Date().toISOString(),
      reason,
      hash:quickHash(raw),
      meta:{
        txns:txns.length,
        inbox:inbox.length,
        accounts:accs.length,
        emails:emails.length,
        totalItems:txns.length+inbox.length+accs.length+emails.length+smsNums.length,
      },
      data:payload,
    };
  },[currencyCfg,txns,inbox,accs,acts,cats,smsNums,emails]);

  const pushBackupSnapshot=useCallback((reason="auto")=>{
    const snap=buildBackupSnapshot(reason);
    const prev=LS.get(BACKUP_KEY,[]);
    const last=prev[prev.length-1];
    if(last?.hash===snap.hash)return false;
    if(reason==="auto"&&snap.meta.totalItems===0&&Number(last?.meta?.totalItems||0)>0)return false;
    const next=[...prev,snap].slice(-MAX_BACKUPS);
    LS.set(BACKUP_KEY,next);
    setBackups(next);
    return true;
  },[buildBackupSnapshot]);

  const applyBaseCurrencyChange=useCallback(async(nextCurrency)=>{
    const nextBase=normalizeCurrencyCode(nextCurrency||currencyCfg.baseCurrency,DEFAULT_BASE_CURRENCY);
    const prevBase=normalizeCurrencyCode(currencyCfg.baseCurrency||DEFAULT_BASE_CURRENCY,DEFAULT_BASE_CURRENCY);
    if(nextBase===prevBase){
      saveCurrencyCfgToStorage({baseCurrency:nextBase});
      setCurrencyCfg({baseCurrency:nextBase});
      return{ok:true,baseCurrency:nextBase,changed:false};
    }
    try{
      const [nextTxns,nextInbox,nextAccs]=await Promise.all([
        convertMoneyRows(txns,{
          baseCurrency:nextBase,
          fallbackCurrency:prevBase||LEGACY_DEFAULT_CURRENCY,
          dateResolver:(row)=>row?.date||row?.fxDate||today(),
        }),
        convertMoneyRows(inbox,{
          baseCurrency:nextBase,
          fallbackCurrency:prevBase||LEGACY_DEFAULT_CURRENCY,
          dateResolver:(row)=>row?.date||row?.fxDate||today(),
        }),
        convertMoneyRows(accs,{
          amountField:"balance",
          originalField:"originalBalance",
          currencyField:"accountCurrency",
          baseAmountField:"balance",
          baseCurrencyField:"balanceBaseCurrency",
          fxDateField:"balanceFxDate",
          fxRateField:"balanceFxRate",
          fxRateDateField:"balanceRateDate",
          fxSourceField:"balanceFxSource",
          baseCurrency:nextBase,
          fallbackCurrency:prevBase||LEGACY_DEFAULT_CURRENCY,
          dateResolver:(row)=>row?.balanceFxDate||today(),
        }),
      ]);
      saveCurrencyCfgToStorage({baseCurrency:nextBase});
      setCurrencyCfg({baseCurrency:nextBase});
      setAccs(nextAccs);
      setInbox(nextInbox);
      setTxns(nextTxns.map(tx=>({...tx,journalEntries:buildJE(tx,nextAccs)})));
      addDiagnostic({level:"info",scope:"currency",event:"base_currency_changed",message:`Base currency changed from ${prevBase} to ${nextBase}.`,context:{from:prevBase,to:nextBase,transactions:nextTxns.length,inbox:nextInbox.length,accounts:nextAccs.length}});
      return{ok:true,baseCurrency:nextBase,changed:true};
    }catch(error){
      addDiagnostic({level:"error",scope:"currency",event:"base_currency_change_failed",message:error?.message||"Base currency change failed.",context:{from:prevBase,to:nextBase,error}});
      return{ok:false,error:error?.message||"Base currency change failed."};
    }
  },[currencyCfg.baseCurrency,txns,inbox,accs,addDiagnostic]);

  const restoreBackupSnapshot=useCallback((id)=>{
    const list=LS.get(BACKUP_KEY,[]);
    const snap=list.find(s=>s.id===id);
    if(!snap?.data){
      addDiagnostic({level:"warn",scope:"backup",event:"restore_snapshot_missing",message:"Backup restore failed because the snapshot was not found.",context:{snapshotId:id}});
      return false;
    }
    const d=snap.data;
    setCurrencyCfg(normalizeCurrencyCfg(d.currencyCfg||loadCurrencyCfg()));
    setTxns(Array.isArray(d.txns)?d.txns:[]);
    setInbox(Array.isArray(d.inbox)?d.inbox:[]);
    setAccs(Array.isArray(d.accs)?d.accs:[]);
    setActs(Array.isArray(d.acts)&&d.acts.length?d.acts:[...DEF_ACTS]);
    setCats(d.cats&&typeof d.cats==="object"?d.cats:JSON.parse(JSON.stringify(DEF_CATS)));
    setSmsNums(Array.isArray(d.smsNums)?d.smsNums:[]);
    setEmails(prev=>Array.isArray(d.emails)?mergeLoadedEmailsWithLocalTokens(d.emails,prev):[]);
    setSyncStatus("idle");
    setLastSync("");
    setSummary("");
    setSumLoad(false);
    setTab("dashboard");
    addDiagnostic({level:"info",scope:"backup",event:"restore_snapshot",message:"Local backup snapshot restored.",context:{snapshotId:id,reason:snap.reason||"",meta:sanitizeDiagnosticValue(snap.meta||{})}});
    return true;
  },[addDiagnostic]);

  const factoryReset=useCallback(()=>{
    const resetAt=new Date().toISOString();
    const preservedMsClientId=sanitizeMsClientId((sbCfg?.clientId||DEFAULT_MICROSOFT_CLIENT_ID||"").trim());
    const preservedCloudCfg={
      ...defaultCloudCfg(),
      ...(sbCfg||{}),
      clientId:preservedMsClientId,
      email:String(sbCfg?.email||""),
      name:String(sbCfg?.name||""),
      enabled:Boolean(sbCfg?.enabled&&preservedMsClientId),
      needsReconnect:Boolean(sbCfg?.needsReconnect),
    };
    const preservedAICfg=loadAICfg();
    const preservedCurrencyCfg=loadCurrencyCfg();
    const preservedEmails=(emails||[]).map(a=>({
      ...hydrateEmailAccount(a),
      reauthRequired:false,
    }));
    try{
      const preReset=buildBackupSnapshot("factory-reset-before-clear");
      LS.set("ledger_last_reset_backup",preReset);
      pushBackupSnapshot("factory-reset-before-clear");
      LS.set(AI_PENDING_RESET_KEY,resetAt);
      [
        "ledger_txns","ledger_acts","ledger_cats","ledger_accs","ledger_inbox",
        "ledger_sms","ledger_lastsync",
        AI_PENDING_EMAIL_KEY,
      ].forEach(k=>localStorage.removeItem(k));
      const purge=[];
      for(let i=0;i<localStorage.length;i++){
        const k=localStorage.key(i);
        if(!k)continue;
        if(k.startsWith(`proc_${EMAIL_SYNC_CACHE_VERSION}_`))purge.push(k);
      }
      purge.forEach(k=>localStorage.removeItem(k));
      if(preservedMsClientId)clearStaleMsalInteractionState(preservedMsClientId);
    }catch{}
    saveAICfgToStorage(preservedAICfg);
    saveCurrencyCfgToStorage(preservedCurrencyCfg);
    setCurrencyCfg(preservedCurrencyCfg);
    setTxns([]);
    setActs([...DEF_ACTS]);
    setCats(JSON.parse(JSON.stringify(DEF_CATS)));
    setAccs([]);
    setInbox([]);
    setEmails(preservedEmails);
    setSmsNums([]);
    setSbCfg(preservedCloudCfg);
    cloudSyncPauseUntilRef.current=Date.now()+30000;
    setSyncStatus("idle");
    setLastSync("");
    setSummary("");
    setSumLoad(false);
    setFilter({activity:"All",type:"All",from:"",to:""});
    setShowAdd(false);
    setEditTx(null);
    setAddType("expense");
    setTab("dashboard");
    setResetVersion(v=>v+1);
    setAuthBypass(false);
    setBackups(LS.get(BACKUP_KEY,[]));
    addDiagnostic({level:"warn",scope:"app",event:"factory_reset",message:"Factory reset completed. Connectors, AI settings, and currency settings were preserved.",context:{preservedEmails:(preservedEmails||[]).length,preservedCloud:Boolean(preservedCloudCfg?.enabled),preservedAiEndpoint:Boolean(preservedAICfg?.endpoint),baseCurrency:preservedCurrencyCfg?.baseCurrency||DEFAULT_BASE_CURRENCY}});
    alert("Reset complete. LedgerAI is now fresh. Email + cloud connectors were preserved.");
  },[addDiagnostic,buildBackupSnapshot,emails,pushBackupSnapshot,sbCfg]);

  const onGoogleCredential=useCallback((resp)=>{
    let payload=decodeGoogleCredential(resp?.credential||"");
    if(!payload?.email&&resp?.email){
      payload={
        email:String(resp.email||""),
        name:String(resp.name||resp.email||""),
        picture:String(resp.picture||""),
      };
    }
    if(!payload?.email){
      addDiagnostic({level:"warn",scope:"auth",event:"google_login_failed",message:"Google login failed because profile email was missing."});
      setAuthMsg("Google login failed. Please try again.");
      return;
    }
    const email=(payload.email||"").toLowerCase();
    const owner=LOCKED_OWNER_EMAIL.toLowerCase();
    if(owner!==email){
      addDiagnostic({level:"warn",scope:"auth",event:"owner_mismatch",message:"Google login was rejected because it did not match the locked owner account.",context:{email:payload.email}});
      setAuthMsg(`Access denied. This dashboard is locked to ${LOCKED_OWNER_EMAIL}.`);
      return;
    }
    setAuthCfg(p=>({...p,ownerEmail:LOCKED_OWNER_EMAIL}));
    setAuthUser({email:payload.email,name:payload.name||payload.email,picture:payload.picture||"",lastLoginAt:new Date().toISOString()});
    setAuthBypass(false);
    setAuthMsg("");
    addDiagnostic({level:"info",scope:"auth",event:"google_login_success",message:"Owner login succeeded.",context:{email:payload.email}});
  },[addDiagnostic]);

  const signOut=()=>{
    setAuthUser(null);
    try{window.google?.accounts?.id?.disableAutoSelect();}catch{}
    addDiagnostic({level:"info",scope:"auth",event:"sign_out",message:"User signed out of LedgerAI."});
  };

  // ── localStorage mirrors ─────────────────────────────────────────────────
  useEffect(()=>LS.set("ledger_auth_cfg",authCfg),[authCfg]);
  useEffect(()=>LS.set("ledger_auth_bypass",authBypass),[authBypass]);
  useEffect(()=>saveCurrencyCfgToStorage(currencyCfg),[currencyCfg]);
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
  useEffect(()=>LS.set("ledger_emails",persistEmailsLocally(emails)),[emails]);
  useEffect(()=>LS.set("ledger_sms",smsNums),[smsNums]);
  useEffect(()=>LS.set("ledger_odcfg",sbCfg),[sbCfg]);
  useEffect(()=>LS.set("ledger_lastsync",lastSync),[lastSync]);
  useEffect(()=>LS.set(DIAG_LOG_KEY,diagnostics),[diagnostics]);

  useEffect(()=>{
    const t=setTimeout(()=>{pushBackupSnapshot("auto");},1200);
    return()=>clearTimeout(t);
  },[txns,inbox,accs,acts,cats,smsNums,emails,pushBackupSnapshot]);

  useEffect(()=>{
    const owner=LOCKED_OWNER_EMAIL.toLowerCase();
    const current=(authUser?.email||"").toLowerCase();
    if(owner&&current&&owner!==current)setAuthUser(null);
  },[authUser]);
  useEffect(()=>{
    if(authBypass&&!canUseAuthBypass)setAuthBypass(false);
  },[authBypass,canUseAuthBypass]);
  useEffect(()=>{
    if(authCfg.ownerEmail!==LOCKED_OWNER_EMAIL)setAuthCfg(p=>({...p,ownerEmail:LOCKED_OWNER_EMAIL}));
  },[authCfg.ownerEmail]);

  useEffect(()=>{
    const onError=(event)=>{
      addDiagnostic({
        level:"error",
        scope:"window",
        event:"unhandled_error",
        message:event?.message||"Unhandled window error",
        context:{
          source:event?.filename||"",
          line:event?.lineno||0,
          column:event?.colno||0,
          error:event?.error||null,
        },
      });
    };
    const onRejection=(event)=>{
      addDiagnostic({
        level:"error",
        scope:"window",
        event:"unhandled_rejection",
        message:event?.reason?.message||String(event?.reason||"Unhandled promise rejection"),
        context:{reason:event?.reason||null},
      });
    };
    window.addEventListener("error",onError);
    window.addEventListener("unhandledrejection",onRejection);
    return()=>{
      window.removeEventListener("error",onError);
      window.removeEventListener("unhandledrejection",onRejection);
    };
  },[addDiagnostic]);

  useEffect(()=>{
    const baseError=console.error.bind(console);
    const baseWarn=console.warn.bind(console);
    console.error=(...args)=>{
      addDiagnostic({level:"error",scope:"console",event:"console.error",message:formatDiagnosticArgs(args),context:{args:sanitizeDiagnosticValue(args)}});
      baseError(...args);
    };
    console.warn=(...args)=>{
      addDiagnostic({level:"warn",scope:"console",event:"console.warn",message:formatDiagnosticArgs(args),context:{args:sanitizeDiagnosticValue(args)}});
      baseWarn(...args);
    };
    return()=>{
      console.error=baseError;
      console.warn=baseWarn;
    };
  },[addDiagnostic]);

  const makeSupportBundle=useCallback(()=>buildSupportBundle({
    diagnostics:diagnosticsRef.current,
    authCfg,
    authUser,
    currencyCfg,
    txns,
    inbox,
    accs,
    acts,
    smsNums,
    emails,
    sbCfg,
    syncStatus,
    lastSync,
    aiPending:LS.get(AI_PENDING_EMAIL_KEY,[]),
    backups,
  }),[authCfg,authUser,currencyCfg,txns,inbox,accs,acts,smsNums,emails,sbCfg,syncStatus,lastSync,backups]);

  // ── OneDrive sync helpers ────────────────────────────────────────────────
  const pushToCloud=useCallback(async(state={})=>{
    if(!sbCfg.enabled||!sbCfg.clientId)return;
    setSyncStatus("syncing");
    try{
      const payload={
        currencyCfg:state.currencyCfg??currencyCfg,
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
      setCloudIssue("");
      addDiagnostic({level:"info",scope:"cloud",event:"onedrive_sync_success",message:"OneDrive sync completed.",context:{txns:(payload.txns||[]).length,inbox:(payload.inbox||[]).length,accounts:(payload.accs||[]).length,emails:(payload.emails||[]).length,baseCurrency:payload.currencyCfg?.baseCurrency||currencyCfg.baseCurrency||DEFAULT_BASE_CURRENCY}});
      setTimeout(()=>setSyncStatus("idle"),3000);
    }catch(e){
      console.error("OneDrive sync error",e);
      setSyncStatus("error");
      setCloudIssue(e?.message||"OneDrive sync failed.");
      addDiagnostic({level:"error",scope:"cloud",event:"onedrive_sync_error",message:e?.message||"OneDrive sync failed.",context:{error:e}});
      // If token expired, mark as needing reconnect
      if(e.message.includes("Not signed in")||e.message.includes("401"))
        setSbCfg(p=>({...p,enabled:false,needsReconnect:true}));
    }
  },[addDiagnostic,sbCfg,txns,inbox,accs,acts,cats,smsNums,emails,currencyCfg,setCloudIssue]);

  const debouncedSync=useCallback((state={})=>{
    if(!sbCfg.enabled)return;
    if(Date.now()<cloudSyncPauseUntilRef.current)return;
    if(syncTimer.current)clearTimeout(syncTimer.current);
    syncTimer.current=setTimeout(()=>pushToCloud(state),3000);
  },[sbCfg.enabled,pushToCloud]);

  const loadFromCloud=useCallback(async()=>{
    if(!sbCfg.clientId)return;
    setSyncStatus("syncing");
    try{
      const d=await odLoad(sbCfg.clientId);
      if(!d){setSyncStatus("idle");return;}
      if(d.currencyCfg)setCurrencyCfg(normalizeCurrencyCfg(d.currencyCfg));
      if(d.txns)setTxns(d.txns);
      if(d.inbox)setInbox(d.inbox);
      if(d.accs)setAccs(d.accs);
      if(d.acts)setActs(d.acts);
      if(d.cats)setCats(d.cats);
      if(d.smsNums)setSmsNums(d.smsNums);
      if(d.emails)setEmails(prev=>mergeLoadedEmailsWithLocalTokens(d.emails,prev));
      setLastSync(new Date().toISOString());setSyncStatus("ok");
      setCloudIssue("");
      addDiagnostic({level:"info",scope:"cloud",event:"onedrive_load_success",message:"OneDrive restore completed.",context:{txns:(d?.txns||[]).length,inbox:(d?.inbox||[]).length,accounts:(d?.accs||[]).length,emails:(d?.emails||[]).length,baseCurrency:d?.currencyCfg?.baseCurrency||currencyCfg.baseCurrency||DEFAULT_BASE_CURRENCY}});
      setTimeout(()=>setSyncStatus("idle"),3000);
    }catch(e){
      console.error("OneDrive load error",e);
      setSyncStatus("error");
      setCloudIssue(e?.message||"OneDrive restore failed.");
      addDiagnostic({level:"error",scope:"cloud",event:"onedrive_load_error",message:e?.message||"OneDrive restore failed.",context:{error:e}});
      if(e?.message?.includes?.("Not signed in")||e?.message?.includes?.("401")){
        setSbCfg(p=>({...p,enabled:false,needsReconnect:true}));
      }
    }
  },[addDiagnostic,sbCfg,setSbCfg,currencyCfg.baseCurrency,setCloudIssue]);

  // Auto-load from cloud once when connected and local ledger is empty.
  useEffect(()=>{
    if(cloudAutoLoadTriedRef.current)return;
    if(!sbCfg.enabled||!sbCfg.clientId)return;
    const hasLocalData=Boolean(
      (txns?.length||0)
      ||(inbox?.length||0)
      ||(accs?.length||0)
      ||(acts?.length||0)>DEF_ACTS.length
      ||(emails?.length||0)
      ||(smsNums?.length||0)
    );
    if(hasLocalData){
      cloudAutoLoadTriedRef.current=true;
      return;
    }
    cloudAutoLoadTriedRef.current=true;
    loadFromCloud();
  },[sbCfg.enabled,sbCfg.clientId,txns,inbox,accs,acts,emails,smsNums,loadFromCloud]);

  // Auto-sync when data changes
  useEffect(()=>{debouncedSync({txns});},[txns]);
  useEffect(()=>{debouncedSync({inbox});},[inbox]);
  useEffect(()=>{debouncedSync({accs});},[accs]);
  useEffect(()=>{debouncedSync({currencyCfg});},[currencyCfg]);
  useEffect(()=>{debouncedSync({acts,cats});},[acts,cats]);

  const ensureCat=(act,cat)=>setCats(p=>({...p,[act]:(p[act]||[]).includes(cat)?p[act]:[...(p[act]||[]),cat]}));
  const addBusinessActivity=useCallback((name)=>{
    const n=String(name||"").trim();
    if(!n)return{ok:false,error:"Enter business activity name."};
    const existing=acts.find(a=>a.toLowerCase()===n.toLowerCase());
    const finalName=existing||n;
    if(!existing)setActs(p=>[...p,finalName]);
    setCats(p=>({...p,[finalName]:Array.isArray(p[finalName])&&p[finalName].length?p[finalName]:[...NEW_ACTIVITY_DEFAULT_CATS]}));
    return{
      ok:true,
      name:finalName,
      defaultCategory:(cats[finalName]&&cats[finalName][0])||NEW_ACTIVITY_DEFAULT_CATS[0],
    };
  },[acts,cats]);
  const renameBusinessActivity=useCallback((fromName,toName)=>{
    const oldName=String(fromName||"").trim();
    const nextName=String(toName||"").trim();
    if(!oldName||!nextName)return{ok:false,error:"Activity name is required."};
    if(oldName===nextName)return{ok:true,name:nextName};
    const duplicate=acts.find(a=>a.toLowerCase()===nextName.toLowerCase()&&a!==oldName);
    if(duplicate)return{ok:false,error:`"${duplicate}" already exists.`};
    setActs(prev=>prev.map(a=>a===oldName?nextName:a));
    setCats(prev=>{
      const oldCats=Array.isArray(prev[oldName])?prev[oldName]:[];
      const nextCats=Array.isArray(prev[nextName])?prev[nextName]:[];
      const merged=[...new Set([...(nextCats.length?nextCats:oldCats),...oldCats])];
      const {[oldName]:_ignored,...rest}=prev;
      return{
        ...rest,
        [nextName]:merged.length?merged:[...NEW_ACTIVITY_DEFAULT_CATS],
      };
    });
    setTxns(prev=>prev.map(t=>t.businessActivity===oldName?{...t,businessActivity:nextName}:t));
    setInbox(prev=>prev.map(i=>i.businessActivity===oldName?{...i,businessActivity:nextName}:i));
    setFilter(prev=>prev.activity===oldName?{...prev,activity:nextName}:prev);
    return{ok:true,name:nextName};
  },[acts]);
  const attachTxnCurrencyMeta=useCallback((entry={})=>{
    const amount=roundMoney(Number(entry?.amount)||0);
    const sourceCurrency=normalizeCurrencyCode(entry?.currency||entry?.baseCurrency||currencyCfg.baseCurrency,currencyCfg.baseCurrency);
    return{
      ...entry,
      currency:sourceCurrency,
      originalAmount:roundMoney(Number(entry?.originalAmount??amount)||amount),
      baseAmount:amount,
      baseCurrency:currencyCfg.baseCurrency,
      fxRate:Number(entry?.fxRate)||1,
      fxDate:normalizeFxDate(entry?.fxDate||entry?.date||today()),
      fxRateDate:normalizeFxDate(entry?.fxRateDate||entry?.fxDate||entry?.date||today()),
      fxSource:String(entry?.fxSource||"manual"),
    };
  },[currencyCfg.baseCurrency]);
  const addAccountFromModal=useCallback((a)=>{
    const currency=normalizeCurrencyCode(a?.accountCurrency||currencyCfg.baseCurrency,currencyCfg.baseCurrency);
    const created={
      ...a,
      id:gid(),
      accountCurrency:currency,
      originalBalance:roundMoney(Number(a?.originalBalance??a?.balance)||0),
      balance:roundMoney(Number(a?.balance)||0),
      balanceBaseCurrency:currencyCfg.baseCurrency,
      balanceFxRate:Number(a?.balanceFxRate)||1,
      balanceFxDate:normalizeFxDate(a?.balanceFxDate||today()),
      balanceRateDate:normalizeFxDate(a?.balanceRateDate||a?.balanceFxDate||today()),
      balanceFxSource:String(a?.balanceFxSource||"manual"),
    };
    setAccs(p=>[...p,created]);
    return created;
  },[currencyCfg.baseCurrency]);
  const saveTx=useCallback((tx)=>{
    const normalizedTx=attachTxnCurrencyMeta(normalizeTrackedVendor(tx));
    const isPendingInboxEdit=!tx.id&&Boolean(tx._iid);
    if(normalizedTx.isNewCategory&&!isPendingInboxEdit)ensureCat(normalizedTx.businessActivity,normalizedTx.category);
    const accName=normalizedTx.accountId?accs.find(a=>a.id===normalizedTx.accountId)?.name||"":normalizedTx.accountName||"";
    const liabName=normalizedTx.liabilityAccountId?accs.find(a=>a.id===normalizedTx.liabilityAccountId)?.name||"":normalizedTx.liabilityAccountName||"";
    const targetAccName=normalizedTx.targetAccountId?accs.find(a=>a.id===normalizedTx.targetAccountId)?.name||"":normalizedTx.targetAccountName||"";
    const {_iid,_ts,...txBase}=normalizedTx;
    if(isPendingInboxEdit){
      setInbox(p=>p.map(item=>item._iid===_iid?{
        ...item,
        ...txBase,
        accountName:accName,
        liabilityAccountName:liabName,
        targetAccountName:targetAccName,
        _iid:item._iid,
        _ts:item._ts,
      }:item));
      setShowAdd(false);
      setEditTx(null);
      return;
    }
    const je=buildJE(txBase,accs);
    const full={...txBase,accountName:accName,liabilityAccountName:liabName,targetAccountName:targetAccName,journalEntries:je};
    if(tx.id&&txns.find(t=>t.id===tx.id))setTxns(p=>p.map(t=>t.id===tx.id?full:t));
    else setTxns(p=>[{...full,id:gid(),createdAt:new Date().toISOString()},...p]);
    setShowAdd(false);setEditTx(null);
  },[txns,accs,attachTxnCurrencyMeta]);
  const delTx=id=>setTxns(p=>p.filter(t=>t.id!==id));
  const addInbox=items=>setInbox(p=>[...(items||[]).map(i=>({...attachTxnCurrencyMeta(i),_iid:gid(),_ts:Date.now()})),...p]);
  const approveInbox=item=>{
    const validationMsg=getAccountingValidationMessage(item,accs);
    if(validationMsg){
      alert(validationMsg);
      return;
    }
    if(item.isNewCategory)ensureCat(item.businessActivity,item.category);
    const {_iid,_ts,...itemBase}=attachTxnCurrencyMeta(normalizeTrackedVendor(item));
    const tx={...itemBase,id:gid(),createdAt:new Date().toISOString(),source:item.source||"auto"};
    const accName=tx.accountId?accs.find(a=>a.id===tx.accountId)?.name||"":tx.accountName||"";
    const liabName=tx.liabilityAccountId?accs.find(a=>a.id===tx.liabilityAccountId)?.name||"":tx.liabilityAccountName||"";
    const targetAccName=tx.targetAccountId?accs.find(a=>a.id===tx.targetAccountId)?.name||"":tx.targetAccountName||"";
    setTxns(p=>[{...tx,accountName:accName,liabilityAccountName:liabName,targetAccountName:targetAccName,journalEntries:buildJE(tx,accs)},...p]);
    setInbox(p=>p.filter(i=>i._iid!==item._iid));
  };
  const editInbox=item=>{setEditTx({...item,id:undefined});setAddType(item.type||"expense");setShowAdd(true);};
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
  const TABS=[["dashboard","Dashboard"],["transactions","Ledger"],["inbox",`Inbox${inbox.length?` (${inbox.length})`:""}`],["email",`Email${emails.length?` (${emails.length})`:""}`],["journal","Journal"],["accounts","Accounts"],["reconciliation","Reconciliation"],["reports","Reports"],["settings","Settings"],["daily","Day Review"]];

  if(authCfg.enabled&&!authCfg.googleClientId){
    return <AuthSetupScreen authCfg={authCfg} setAuthCfg={setAuthCfg}/>;
  }
  if(authCfg.enabled&&!authUser&&!bypassActive){
    return <AuthLoginScreen clientId={authCfg.googleClientId} ownerEmail={LOCKED_OWNER_EMAIL} onCredential={onGoogleCredential} authMsg={authMsg} allowTemporaryBypass={canUseAuthBypass} onBypass={()=>setAuthBypass(true)}/>;
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
        <button className="btn sm" style={{marginLeft:6,background:"#0ea5e9",color:"#fff"}} onClick={()=>{setAddType("transfer");setEditTx(null);setShowAdd(true);}}>⇄ Transfer</button>
      </nav>
      <div className="wrap">
        {tab==="dashboard"&&<DashTab byAct={byAct} totInc={totInc} totExp={totExp} todInc={todInc} todExp={todExp} txns={txns} todayTxns={todayTxns} inbox={inbox} emails={emails} onEdit={tx=>{setEditTx(tx);setAddType(tx.type);setShowAdd(true);}} onDelete={delTx}/>}
        {tab==="transactions"&&<LedgerTab txns={filtered} filter={filter} setFilter={setFilter} acts={acts} onEdit={tx=>{setEditTx(tx);setAddType(tx.type);setShowAdd(true);}} onDelete={delTx}/>}
        {tab==="inbox"&&<InboxTab inbox={inbox} addInbox={addInbox} acts={acts} cats={cats} onApprove={approveInbox} onEdit={editInbox} onDiscard={discardInbox}/>}
        <div style={{display:tab==="email"?"block":"none"}} aria-hidden={tab!=="email"}>
          <EmailTab emails={emails} setEmails={setEmails} inbox={inbox} addInbox={addInbox} acts={acts} cats={cats} accs={accs} defaultGoogleClientId={authCfg.googleClientId||DEFAULT_GOOGLE_CLIENT_ID} defaultMicrosoftClientId={sbCfg.clientId||DEFAULT_MICROSOFT_CLIENT_ID||""} addDiagnostic={addDiagnostic} resetVersion={resetVersion}/>
        </div>
        {tab==="journal"&&<JournalTab txns={txns}/>}
        {tab==="accounts"&&<AccountsTab accs={accs} setAccs={setAccs} onOpenReconciliation={(id)=>{setReconAccountId(id);setTab("reconciliation");}}/>}
        {tab==="reconciliation"&&<ReconciliationTab accs={accs} txns={txns} acts={acts} cats={cats} addInbox={addInbox} onEditLedger={tx=>{setEditTx(tx);setAddType(tx.type);setShowAdd(true);}} preselectedAccountId={reconAccountId}/>}
        {tab==="reports"&&<ReportsTab txns={txns} acts={acts} totInc={totInc} totExp={totExp}/>}
        {tab==="settings"&&<SettingsTab acts={acts} setActs={setActs} cats={cats} setCats={setCats} backups={backups} onBackupNow={()=>pushBackupSnapshot("manual")} onRestoreBackup={restoreBackupSnapshot} onFactoryReset={factoryReset} onRenameActivity={renameBusinessActivity} currencyCfg={currencyCfg} onSaveCurrencyCfg={applyBaseCurrencyChange} diagnostics={diagnostics} onClearDiagnostics={clearDiagnostics} buildSupportBundle={makeSupportBundle} addDiagnostic={addDiagnostic}/>}
        {tab==="cloud"&&<CloudTab sbCfg={sbCfg} setSbCfg={setSbCfg} syncStatus={syncStatus} lastSync={lastSync} onSync={pushToCloud} onLoad={loadFromCloud} txns={txns} setTxns={setTxns} inbox={inbox} setInbox={setInbox} accs={accs} setAccs={setAccs} acts={acts} setActs={setActs} cats={cats} setCats={setCats} smsNums={smsNums} setSmsNums={setSmsNums} emails={emails} setEmails={setEmails} addDiagnostic={addDiagnostic}/>}
        {tab==="daily"&&<DailyTab todayTxns={todayTxns} todInc={todInc} todExp={todExp} summary={summary} sumLoad={sumLoad} getSummary={async()=>{setSumLoad(true);setSummary(await aiSummarize(todayTxns));setSumLoad(false);}} onEdit={tx=>{setEditTx(tx);setAddType(tx.type);setShowAdd(true);}} onDelete={delTx}/>}
      </div>
      {showAdd&&<AddModal type={addType} existing={editTx} acts={acts} cats={cats} accs={accs} onAddAccount={addAccountFromModal} onAddActivity={addBusinessActivity} onSave={saveTx} onClose={()=>{setShowAdd(false);setEditTx(null);}}/>}
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
  const[manualBusy,setManualBusy]=useState(false);
  const[buttonRendered,setButtonRendered]=useState(false);

  const startFallbackLogin=useCallback(async()=>{
    if(!clientId)return;
    setLoginErr("");
    setManualBusy(true);
    try{
      await loadGoogleIdentityScript();
      if(!window.google?.accounts?.oauth2)throw new Error("Google OAuth not available in browser.");
      const token=await new Promise((resolve,reject)=>{
        const tc=window.google.accounts.oauth2.initTokenClient({
          client_id:clientId,
          scope:"openid email profile",
          callback:(resp)=>{
            if(resp?.error)return reject(new Error(resp.error));
            if(!resp?.access_token)return reject(new Error("No access token returned by Google."));
            resolve(resp.access_token);
          },
          error_callback:(err)=>reject(new Error(err?.type||err?.error||"oauth_error")),
        });
        tc.requestAccessToken({
          prompt:"select_account",
          login_hint:ownerEmail||LOCKED_OWNER_EMAIL,
        });
      });
      const r=await fetch("https://openidconnect.googleapis.com/v1/userinfo",{
        headers:{Authorization:`Bearer ${token}`},
      });
      if(!r.ok){
        const txt=await r.text();
        throw new Error(`Google profile fetch failed: ${r.status} ${txt?.slice?.(0,120)||""}`);
      }
      const profile=await r.json();
      if(!profile?.email)throw new Error("Google did not return account email.");
      onCredential({
        email:profile.email,
        name:profile.name||profile.email,
        picture:profile.picture||"",
      });
    }catch(e){
      const msg=String(e?.message||"Unable to sign in with Google.");
      if(msg.includes("popup_closed"))setLoginErr("Google sign-in popup was closed. Please try again.");
      else setLoginErr(msg);
    }finally{
      setManualBusy(false);
    }
  },[clientId,onCredential,ownerEmail]);

  useEffect(()=>{
    let alive=true;
    const mount=async()=>{
      if(!alive)return;
      setLoginErr("");
      setButtonRendered(false);
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
          setTimeout(()=>{
            if(!alive)return;
            const rendered=Boolean(btnRef.current&&btnRef.current.childElementCount>0);
            setButtonRendered(rendered);
            if(!rendered){
              setLoginErr("Google button did not load in this browser. Use the fallback sign-in button below.");
            }
          },250);
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
        {!loading&&(
          <button className="btn pri" style={{width:"100%",marginBottom:10}} disabled={manualBusy} onClick={startFallbackLogin}>
            {manualBusy?"Opening Google…":"Continue with Google"}
          </button>
        )}
        {!loading&&!buttonRendered&&(
          <div style={{fontSize:11,color:"#64748b",marginBottom:8}}>
            If popup does not open, allow popups for this site and disable strict content blockers for Google sign-in.
          </div>
        )}
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
function EmailTab({emails,setEmails,inbox,addInbox,acts,cats,accs,defaultGoogleClientId,defaultMicrosoftClientId,addDiagnostic=()=>{},resetVersion=0}){
  const[syncingIds,setSyncingIds]=useState({});
  const[syncProgress,setSyncProgress]=useState({});
  const[logs,setLogs]=useState({});
  const[toast,setToast]=useState("");
  const[connectBusy,setConnectBusy]=useState("");
  const[firstSyncPrompt,setFirstSyncPrompt]=useState(null); // {accId,fromDate,scanAll}
  const[pendingView,setPendingView]=useState({open:false,accountId:""});
  const[aiPending,setAiPending]=useState(()=>((LS.get(AI_PENDING_EMAIL_KEY,[])||[]).map(normalizeAiPendingEntry)).filter(e=>e.accountId&&e.msgId&&!isAiPendingStaleAfterReset(e)));
  const[retryBusy,setRetryBusy]=useState(false);
  const retryBusyRef=useRef(false);
  const retryLastRunRef=useRef(0);
  const cloudPullBusyRef=useRef(false);
  const cloudPullLastRunRef=useRef(0);
  const cloudRetryUnsupportedRef=useRef(false);
  const log=(id,msg)=>setLogs(p=>({...p,[id]:msg}));
  const setAccountIssue=(accId,message="",patch={})=>{
    const detail=redactSensitiveText(String(message||"")).slice(0,180);
    setEmails(prev=>prev.map(a=>a.id===accId?{
      ...a,
      ...patch,
      lastError:detail,
      lastErrorAt:detail?new Date().toISOString():"",
    }:a));
  };
  const clearAccountIssue=(accId,patch={})=>{
    setEmails(prev=>prev.map(a=>a.id===accId?{
      ...a,
      ...patch,
      lastError:"",
      lastErrorAt:"",
    }:a));
  };
  const googleClientId=(defaultGoogleClientId||DEFAULT_GOOGLE_CLIENT_ID||"").trim();
  const microsoftClientId=(defaultMicrosoftClientId||DEFAULT_MICROSOFT_CLIENT_ID||"").trim();
  const cloudRetryClientId=getAiCloudClientId();
  const providerOf=acc=>(((acc?.provider||"google")+"").toLowerCase()==="microsoft"?"microsoft":"google");
  const isSyncReady=(acc,{allowReauth=false}={})=>{
    if(!acc?.connected||acc?.userDisconnected)return false;
    if(!allowReauth&&acc?.reauthRequired)return false;
    const provider=providerOf(acc);
    if(provider==="microsoft")return Boolean((acc.msClientId||microsoftClientId||"").trim());
    return Boolean((acc.clientId||googleClientId||"").trim());
  };
  const emailInbox=inbox.filter(i=>i.source==="email").length;
  const connected=emails.filter(a=>{
    if(a?.userDisconnected)return false;
    const provider=providerOf(a);
    if(provider==="microsoft")return Boolean(a.connected);
    return Boolean(a.connected);
  }).length;
  const syncableAccounts=emails.filter(isSyncReady);
  const anySyncing=Object.values(syncingIds).some(Boolean);
  const connectingGoogle=connectBusy==="google";
  const connectingMicrosoft=connectBusy==="microsoft";
  const setSyncing=(id,val)=>setSyncingIds(p=>({...p,[id]:val}));
  const setProgress=(id,patch)=>setSyncProgress(p=>({...p,[id]:{...(p[id]||{}),...patch}}));
  const totalPendingAi=aiPending.length;
  const duePendingAi=aiPending.filter(row=>{
    if(row.cloudQueued)return false;
    const nextAt=Date.parse(row.nextRetryAt||"");
    return !Number.isFinite(nextAt)||nextAt<=Date.now();
  }).length;
  const pendingByAccount=aiPending.reduce((map,row)=>{
    map[row.accountId]=(map[row.accountId]||0)+1;
    return map;
  },{});
  const duePendingByAccount=aiPending.reduce((map,row)=>{
    if(row.cloudQueued)return map;
    const nextAt=Date.parse(row.nextRetryAt||"");
    if(!Number.isFinite(nextAt)||nextAt<=Date.now()){
      map[row.accountId]=(map[row.accountId]||0)+1;
    }
    return map;
  },{});
  const pendingRows=(aiPending||[])
    .map(normalizeAiPendingEntry)
    .sort((a,b)=>Date.parse(a.nextRetryAt||0)-Date.parse(b.nextRetryAt||0));
  const pendingRowsFiltered=pendingRows.filter(row=>!pendingView.accountId||row.accountId===pendingView.accountId);
  const pendingAccountName=id=>emails.find(a=>a.id===id)?.email||emails.find(a=>a.id===id)?.label||id;

  useEffect(()=>{
    LS.set(AI_PENDING_EMAIL_KEY,aiPending.map(normalizeAiPendingEntry));
  },[aiPending]);

  useEffect(()=>{
    if(!resetVersion)return;
    setAiPending([]);
    setPendingView({open:false,accountId:""});
    setRetryBusy(false);
    retryBusyRef.current=false;
    cloudPullBusyRef.current=false;
    cloudPullLastRunRef.current=0;
    retryLastRunRef.current=0;
    setLogs({});
    setSyncProgress({});
    setSyncingIds({});
    addDiagnostic({level:"info",scope:"email",event:"ai_pending_reset",message:"AI pending queue and email sync state cleared after factory reset."});
  },[resetVersion,addDiagnostic]);

  const markProcessedMessage=(accountId,msgId)=>{
    const key=`proc_${EMAIL_SYNC_CACHE_VERSION}_${accountId}`;
    const processed=new Set(LS.get(key,[]));
    processed.add(msgId);
    LS.set(key,[...processed].slice(-50000));
  };

  const enqueueAiPending=(entry={})=>{
    const normalized=normalizeAiPendingEntry(entry);
    if(!normalized.accountId||!normalized.msgId)return;
    setAiPending(prev=>{
      const idx=prev.findIndex(p=>p.id===normalized.id);
      if(idx>=0){
        const next=[...prev];
        next[idx]={...prev[idx],...normalized};
        return next;
      }
      return [normalized,...prev];
    });
  };

  const enqueueCloudRetryFromEvidence=async({acc,evidence,msgId,provider})=>{
    if(cloudRetryUnsupportedRef.current)return{ok:false,unsupported:true,error:"cloud_retry_unsupported"};
    if(!acc?.id||!msgId||!evidence)return{ok:false,error:"invalid_cloud_retry_payload"};
    const cfg=loadAICfg();
    if(!cfg.endpoint)return{ok:false,error:"ai_endpoint_missing"};
    const queuedAt=new Date().toISOString();
    const jobId=`${aiPendingId(acc.id,msgId)}-${quickHash(`${queuedAt}:${Math.random()}`)}`;
    const messages=buildAiEmailAnalysisMessages(
      evidence.subject||"",
      evidence.from||"",
      evidence.body||"",
      acts,
      cats,
      {
        attachmentNames:evidence.attachmentNames||[],
        attachmentText:evidence.attachmentText||"",
        hasAttachment:Boolean(evidence.hasAttachment),
        accountNames:accs.map(a=>a.name).filter(Boolean),
      },
    );
    const payload={
      jobId,
      clientId:cloudRetryClientId,
      accountId:String(acc.id||""),
      provider:String(provider||"google").toLowerCase()==="microsoft"?"microsoft":"google",
      msgId:String(msgId||""),
      rowId:aiPendingId(acc.id,msgId),
      subject:String(evidence.subject||""),
      from:String(evidence.from||""),
      emailDate:String(evidence.eDate||today()),
      model:String(cfg.model||DEFAULT_AI_MODEL).trim()||DEFAULT_AI_MODEL,
      max_tokens:1600,
      messages,
      queuedAt,
    };
    const out=await enqueueCloudAiRetryJob(payload,cfg);
    if(out?.unsupported){
      cloudRetryUnsupportedRef.current=true;
      addDiagnostic({level:"warn",scope:"email",event:"cloud_retry_unsupported",message:"Cloud AI retry is not supported by the current AI backend.",accountId:acc.id,provider,context:{msgId}});
    }
    if(out?.ok){
      addDiagnostic({level:"info",scope:"email",event:"cloud_retry_enqueued",message:"Cloud AI retry job was queued.",accountId:acc.id,provider,context:{msgId,jobId:out.jobId||""}});
    }else if(out?.error){
      addDiagnostic({level:"warn",scope:"email",event:"cloud_retry_enqueue_failed",message:out.error,accountId:acc.id,provider,context:{msgId}});
    }
    if(!out?.ok)return out;
    return{ok:true,jobId};
  };

  const pullCloudRetryResults=async({force=false}={})=>{
    if(cloudRetryUnsupportedRef.current)return;
    if(cloudPullBusyRef.current)return;
    const now=Date.now();
    if(!force&&now-cloudPullLastRunRef.current<45_000)return;
    cloudPullBusyRef.current=true;
    cloudPullLastRunRef.current=now;
    try{
      const clientIds=getAiCloudClientIds();
      const pulledJobs=[];
      const seenJobIds=new Set();
      for(const clientId of clientIds){
        const out=await pullCloudAiRetryJobs(clientId,AI_CLOUD_PULL_LIMIT,loadAICfg());
        if(!out?.ok){
          if(out?.unsupported)cloudRetryUnsupportedRef.current=true;
          if(out?.error){
            addDiagnostic({level:"warn",scope:"email",event:"cloud_retry_pull_failed",message:out.error,context:{clientId}});
          }
          continue;
        }
        const jobs=(out.jobs||[]).filter(j=>j&&j.accountId&&j.msgId);
        for(const job of jobs){
          const jobId=String(job.jobId||"");
          if(jobId&&seenJobIds.has(jobId))continue;
          if(jobId)seenJobIds.add(jobId);
          pulledJobs.push(job);
        }
      }
      const staleJobs=pulledJobs.filter(job=>isAiPendingStaleAfterReset(job));
      if(staleJobs.length){
        addDiagnostic({level:"info",scope:"email",event:"cloud_retry_stale_ignored",message:`Ignored ${staleJobs.length} stale cloud AI retry job(s) after factory reset.`,context:{jobs:staleJobs.length}});
      }
      const jobs=pulledJobs.filter(job=>!isAiPendingStaleAfterReset(job));
      if(!jobs.length)return;
      addDiagnostic({level:"info",scope:"email",event:"cloud_retry_pull_success",message:`Pulled ${jobs.length} completed cloud AI retry job(s).`,context:{jobs:jobs.length}});
      const rowIds=new Set();
      const cloudJobIds=new Set();
      const msgKeys=new Set();
      const queued=[];
      let recovered=0;
      for(const job of jobs){
        const accountId=String(job.accountId||"");
        const msgId=String(job.msgId||"");
        const provider=String(job.provider||"google").toLowerCase()==="microsoft"?"microsoft":"google";
        const subject=String(job.subject||"");
        const from=String(job.from||"");
        const eDate=String(job.emailDate||today())||today();
        const rowId=String(job.rowId||aiPendingId(accountId,msgId)||"");
        const cloudJobId=String(job.jobId||"");
        if(rowId)rowIds.add(rowId);
        if(cloudJobId)cloudJobIds.add(cloudJobId);
        msgKeys.add(`${accountId}::${msgId}`);
        markProcessedMessage(accountId,msgId);

        const parsed=parseAiEmailAnalysisRaw(String(job.outputText||""));
        if(String(parsed?.status||"").toLowerCase()!=="success")continue;
        const items=sanitizeEmailTransactions(Array.isArray(parsed?.transactions)?parsed.transactions:[],{
          acts,
          cats,
          eDate,
          subject,
          from,
        });
        if(!items.length)continue;
        recovered+=items.length;
        items.forEach(item=>queued.push({
          ...item,
          date:item.date||eDate||today(),
          source:"email",
          reviewStatus:"pending",
          emailProvider:provider,
          emailSubject:subject,
          emailFrom:from,
          emailAccountId:accountId,
          emailMsgId:msgId,
        }));
      }
      if(queued.length){
        addInbox(queued);
        setToast(`🤖 Cloud AI retry queued ${recovered} item(s) for review.`);
        addDiagnostic({level:"info",scope:"email",event:"cloud_retry_recovered",message:`Cloud AI retry recovered ${recovered} item(s).`,context:{items:recovered}});
      }
      setAiPending(prev=>prev.filter(p=>{
        const key=`${p.accountId}::${p.msgId}`;
        if(rowIds.has(p.id))return false;
        if(p.cloudJobId&&cloudJobIds.has(p.cloudJobId))return false;
        if(msgKeys.has(key))return false;
        return true;
      }));
    }finally{
      cloudPullBusyRef.current=false;
    }
  };

  useEffect(()=>{
    if(!toast)return;
    const t=setTimeout(()=>setToast(""),2600);
    return()=>clearTimeout(t);
  },[toast]);

  const gmailDate=(d)=>{
    if(!d)return"";
    try{return new Date(d).toISOString().slice(0,10).replace(/-/g,"/");}catch{return"";}
  };

  const requestGoogleToken=(clientId,opts={})=>new Promise((resolve,reject)=>{
    initOAuth(clientId,(err,res)=>err?reject(err):resolve(res),opts);
  });

  const googleTokenExpiryIso=(resp={})=>{
    const expiresInSec=Math.max(60,Number(resp?.expires_in)||3600);
    return new Date(Date.now()+expiresInSec*1000).toISOString();
  };

  const hasUsableGoogleToken=(acc={})=>{
    const token=String(acc?.token||"").trim();
    if(!token)return false;
    const expMs=Date.parse(acc?.tokenExpiresAt||"");
    // Legacy tokens without expiry metadata should be treated as stale.
    if(!Number.isFinite(expMs))return false;
    return expMs-Date.now()>60*1000;
  };

  const isGoogleAuthFailure=(msg="")=>{
    const lower=String(msg||"").toLowerCase();
    if(lower.includes("google_reauth_required"))return true;
    if(lower.includes("request had invalid authentication credentials"))return true;
    if(lower.includes("invalid credentials"))return true;
    if((lower.includes("gmail")||lower.includes("googleapis.com"))&&(lower.includes("401")||lower.includes("403")||lower.includes("unauthorized")||lower.includes("forbidden")))return true;
    return false;
  };

  const isMicrosoftAuthFailure=(msg="")=>{
    const lower=String(msg||"").toLowerCase();
    if(lower.includes("not signed in to microsoft"))return true;
    if((lower.includes("microsoft")||lower.includes("outlook")||lower.includes("graph.microsoft.com"))&&(lower.includes("401")||lower.includes("403")||lower.includes("unauthorized")||lower.includes("forbidden")))return true;
    return false;
  };

  const isDismissedAuthFlow=(msg="")=>{
    const lower=String(msg||"").toLowerCase();
    return lower.includes("popup_closed")
      || lower.includes("popup_window_error")
      || lower.includes("user_cancelled")
      || lower.includes("interaction_in_progress");
  };

  const setGoogleSession=(accId,patch={})=>{
    setEmails(prev=>prev.map(a=>a.id===accId?{...a,...patch,connected:true,userDisconnected:false,reauthRequired:false}:a));
  };

  const ensureGoogleToken=async(acc,{interactive=false}={})=>{
    const resolvedClientId=(acc?.clientId||googleClientId||"").trim();
    if(!resolvedClientId)throw new Error("Google OAuth is not configured for this app yet.");
    const loginHint=(acc?.email||"").trim();
    if(hasUsableGoogleToken(acc))return acc.token;
    const applyToken=(resp={})=>{
      const token=resp?.access_token||"";
      if(!token)return "";
      setGoogleSession(acc.id,{
        token,
        tokenExpiresAt:googleTokenExpiryIso(resp),
        clientId:resolvedClientId,
        lastAuthAt:new Date().toISOString(),
      });
      return token;
    };
    const trySilentRefresh=async()=>{
      const silentResp=await requestGoogleToken(resolvedClientId,{prompt:"none",loginHint});
      const token=applyToken(silentResp);
      if(!token)throw new Error("google_silent_refresh_unavailable:no_token");
      return token;
    };
    if(!interactive){
      // Background flows: allow only silent Google refresh (never popup).
      try{
        return await trySilentRefresh();
      }catch(err){
        const lower=String(err?.message||"").toLowerCase();
        const needsReauth=
          lower.includes("consent")
          || lower.includes("access_denied")
          || lower.includes("invalid_grant")
          || lower.includes("login_required")
          || lower.includes("interaction_required")
          || lower.includes("unauthorized_client");
        if(needsReauth)throw new Error(`google_reauth_required:${lower}`);
        throw new Error("google_silent_refresh_unavailable:no_cached_token");
      }
    }
    let silentErr=null;
    try{
      return await trySilentRefresh();
    }catch(err){
      // Silent refresh can fail in background tabs or when browser blocks third-party cookies.
      silentErr=err;
    }
    try{
      const interactiveResp=await requestGoogleToken(resolvedClientId,{prompt:"",loginHint});
      const token=applyToken(interactiveResp);
      if(!token)throw new Error("google_token_missing");
      return token;
    }catch(interactiveErr){
      const lower=String(interactiveErr?.message||"").toLowerCase();
      const needsConsent=lower.includes("consent")||lower.includes("access_denied");
      if(!needsConsent)throw interactiveErr;
      const consentResp=await requestGoogleToken(resolvedClientId,{prompt:"consent",loginHint});
      const token=applyToken(consentResp);
      if(!token)throw new Error("google_token_missing");
      return token;
    }
  };

  const connectGoogleAccount=async(existing=null)=>{
    if(connectBusy)return;
    if(!googleClientId){alert("Google OAuth is not configured for this app yet.");return;}
    if(!window.google?.accounts?.oauth2){alert("Google Identity Services loading… please wait a moment and try again.");return;}
    setConnectBusy("google");
    addDiagnostic({level:"info",scope:"auth",event:"gmail_connect_started",message:"Starting Gmail OAuth flow.",accountId:existing?.id||"",provider:"google"});
    try{
      let authResp;
      const loginHint=(existing?.email||"").trim();
      try{
        authResp=await requestGoogleToken(googleClientId,{prompt:"select_account",loginHint});
      }catch(e){
        const lower=String(e?.message||"").toLowerCase();
        const needsConsent=lower.includes("consent")||lower.includes("access_denied");
        if(!needsConsent)throw e;
        authResp=await requestGoogleToken(googleClientId,{prompt:"consent",loginHint});
      }
      const token=authResp?.access_token||"";
      if(!token)throw new Error("google_token_missing");
      const profile=await gmailGetProfile(token);
      const mail=(profile.emailAddress||"").trim();
      if(!mail)throw new Error("Google did not return email address.");
      setEmails(prev=>{
        const next=[...prev];
        const ix=existing
          ?next.findIndex(a=>a.id===existing.id)
          :next.findIndex(a=>providerOf(a)==="google"&&(a.email||"").toLowerCase()===mail.toLowerCase());
        const base=hydrateEmailAccount({id:gid(),provider:"google",label:mail.split("@")[0],email:mail,syncQuery:GMAIL_QUERY,maxEmails:100,autoPost:false,enabled:true,firstSyncCompleted:false,syncFromDate:"",autoSyncHourly:true});
        if(ix>=0){
          const cur=hydrateEmailAccount(next[ix]);
          next[ix]={...cur,provider:"google",email:mail,token,tokenExpiresAt:googleTokenExpiryIso(authResp),connected:true,userDisconnected:false,reauthRequired:false,enabled:true,clientId:googleClientId,autoSyncHourly:cur.autoSyncHourly!==false,lastAuthAt:new Date().toISOString(),lastError:"",lastErrorAt:""};
        }else{
          next.unshift({...base,token,tokenExpiresAt:googleTokenExpiryIso(authResp),connected:true,userDisconnected:false,reauthRequired:false,clientId:googleClientId,lastAuthAt:new Date().toISOString(),lastError:"",lastErrorAt:""});
        }
        return next;
      });
      setToast(`✅ Gmail connected: ${mail}`);
      addDiagnostic({level:"info",scope:"auth",event:"gmail_connect_success",message:"Gmail account connected.",provider:"google",context:{email:mail,existing:Boolean(existing?.id)}});
    }catch(err){
      const msg=String(err?.message||"");
      addDiagnostic({level:"error",scope:"auth",event:"gmail_connect_failed",message:msg||"Gmail OAuth failed.",accountId:existing?.id||"",provider:"google",context:{error:err}});
      if(existing?.id)setAccountIssue(existing.id,msg);
      if(msg.includes("access_denied")){
        alert("Access denied by Google OAuth. Add your email as a Test User in Google Auth Platform, or publish the OAuth app to production.");
      }else if(msg.includes("redirect_uri_mismatch")){
        alert(`OAuth error: redirect_uri_mismatch\n\nAdd this in Google OAuth:\nOrigin: ${window.location.origin}\nRedirect URIs: ${window.location.origin} and ${window.location.origin}/`);
      }else if(msg.includes("popup_window_error")||msg.includes("popup_closed")){
        alert("Google sign-in was cancelled.");
      }else alert(`OAuth error: ${msg}`);
    }finally{
      setConnectBusy("");
    }
  };

  const connectMicrosoftAccount=async(existing=null)=>{
    if(connectBusy)return;
    const msClient=sanitizeMsClientId((existing?.msClientId||microsoftClientId||DEFAULT_MICROSOFT_CLIENT_ID||"").trim());
    if(!msClient){
      alert("Outlook connector is not configured with your Azure app Client ID yet. Open Cloud tab and set your own Azure Application (client) ID once.");
      return;
    }
    setConnectBusy("microsoft");
    addDiagnostic({level:"info",scope:"auth",event:"outlook_connect_started",message:"Starting Outlook OAuth flow.",accountId:existing?.id||"",provider:"microsoft"});
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
        const base=hydrateEmailAccount({id:gid(),provider:"microsoft",label:mail.split("@")[0],email:mail,syncQuery:"",maxEmails:100,autoPost:false,autoSyncHourly:true,enabled:true,firstSyncCompleted:false,syncFromDate:"",msClientId:msClient,msAccountId:account.homeAccountId||"",msUsername:account.username||mail});
        if(ix>=0){
          const cur=hydrateEmailAccount(next[ix]);
          next[ix]={...cur,provider:"microsoft",email:mail,token:login.accessToken,connected:true,userDisconnected:false,reauthRequired:false,enabled:true,autoSyncHourly:cur.autoSyncHourly!==false,msClientId:msClient,msAccountId:account.homeAccountId||cur.msAccountId||"",msUsername:account.username||cur.msUsername||mail,lastAuthAt:new Date().toISOString(),lastError:"",lastErrorAt:""};
        }else{
          next.unshift({...base,token:login.accessToken,connected:true,userDisconnected:false,reauthRequired:false,lastAuthAt:new Date().toISOString(),lastError:"",lastErrorAt:""});
        }
        return next;
      });
      setToast(`✅ Outlook connected: ${mail}`);
      addDiagnostic({level:"info",scope:"auth",event:"outlook_connect_success",message:"Outlook account connected.",provider:"microsoft",context:{email:mail,existing:Boolean(existing?.id)}});
    }catch(e){
      addDiagnostic({level:"error",scope:"auth",event:"outlook_connect_failed",message:e?.message||"Outlook OAuth failed.",accountId:existing?.id||"",provider:"microsoft",context:{error:e}});
      if(existing?.id)setAccountIssue(existing.id,e?.message||"Outlook OAuth failed.");
      alert(`Microsoft OAuth error: ${friendlyMicrosoftAuthError(e)}`);
    }finally{
      setConnectBusy("");
    }
  };

  const connectAccount=(provider,existing=null)=>{
    if(connectBusy)return;
    if(provider==="microsoft"){connectMicrosoftAccount(existing);return;}
    connectGoogleAccount(existing);
  };

  const disconnectAccount=(acc)=>{
    const provider=providerOf(acc);
    setEmails(prev=>prev.map(a=>a.id===acc.id?{...a,token:null,connected:false,userDisconnected:true,reauthRequired:false,lastError:"",lastErrorAt:""}:a));
    setToast(`${provider==="microsoft"?"Outlook":"Gmail"} disconnected: ${acc.email||acc.label||"account"}`);
    addDiagnostic({level:"info",scope:"email",event:"account_disconnected",message:`${provider==="microsoft"?"Outlook":"Gmail"} account disconnected.`,accountId:acc.id,provider,context:{email:acc.email||acc.label||""}});
  };

  const removeAccount=(acc)=>{
    if(!window.confirm(`Remove ${acc.email||acc.label||"this account"} from Email Integration?`))return;
    setEmails(prev=>prev.filter(a=>a.id!==acc.id));
    setAiPending(prev=>prev.filter(p=>p.accountId!==acc.id));
    addDiagnostic({level:"warn",scope:"email",event:"account_removed",message:"Email account removed from integration.",accountId:acc.id,provider:providerOf(acc),context:{email:acc.email||acc.label||""}});
  };

  const fetchMessageEvidence=async(provider,token,msgId)=>{
    let subject="";let from="";let rawDate="";let body="";
    let hasAttachment=false;let attachmentNames=[];let attachmentText="";
    if(provider==="microsoft"){
      const full=await withTimeout(msGetMessage(token,msgId),20000,"Outlook message fetch");
      subject=full.subject||"";
      const addr=full.from?.emailAddress?.address||"";
      const name=full.from?.emailAddress?.name||"";
      from=name&&addr?`${name} <${addr}>`:(addr||name||"");
      rawDate=full.receivedDateTime||"";
      body=msExtractBody(full);
      hasAttachment=Boolean(full.hasAttachments);
      if(hasAttachment){
        const attachmentMeta=await withTimeout(msListAttachments(token,msgId),18000,"Outlook attachment list");
        attachmentNames=attachmentMeta.map(a=>a?.name).filter(Boolean);
        hasAttachment=attachmentNames.length>0;
        if(hasAttachment){
          attachmentText=await msAttachmentEvidenceText(token,msgId,attachmentMeta);
        }
      }
    }else{
      const full=await withTimeout(gmailGetMessage(token,msgId),20000,"Gmail message fetch");
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
        attachmentText=await gmailAttachmentEvidenceText(token,msgId,attachmentMeta);
      }
    }
    const parsedDate=rawDate?new Date(rawDate):null;
    const eDate=parsedDate&&!Number.isNaN(parsedDate.getTime())?parsedDate.toISOString().slice(0,10):today();
    return{
      subject,
      from,
      rawDate,
      body,
      hasAttachment,
      attachmentNames,
      attachmentText,
      eDate,
    };
  };

  const analyzeMessageEvidence=async(evidence)=>{
    const baseCurrency=getBaseCurrency();
    const aiResult=await withTimeout(
      aiAnalyzeEmail(
        evidence.subject||"",
        evidence.from||"",
        evidence.body||"",
        acts,
        cats,
        {
          attachmentNames:evidence.attachmentNames||[],
          attachmentText:evidence.attachmentText||"",
          hasAttachment:Boolean(evidence.hasAttachment),
          accountNames:accs.map(a=>a.name).filter(Boolean),
          baseCurrency,
        },
      ),
      35000,
      "AI mail analysis",
    );
    if(String(aiResult?.status||"").toLowerCase()==="retry"){
      throw new Error(`ai_retry_required: ${aiResult?.reason||"unknown"}`);
    }
    let items=Array.isArray(aiResult.transactions)?aiResult.transactions:[];
    items=sanitizeEmailTransactions(items,{
      acts,
      cats,
      baseCurrency,
      eDate:evidence.eDate||today(),
      subject:evidence.subject||"",
      from:evidence.from||"",
    });
    if(String(aiResult?.status||"").toLowerCase()!=="success")return[];
    if(!Array.isArray(items)||!items.length)return[];
    return await convertExtractedItemsToBaseCurrency(items,{
      baseCurrency,
      fallbackCurrency:baseCurrency,
      dateFallback:evidence.eDate||today(),
    });
  };

  const runSync=async(acc,opts={})=>{
    const provider=providerOf(acc);
    const interactive=opts.interactive===true;
    const silent=opts.silent===true;
    const msClient=sanitizeMsClientId((acc?.msClientId||microsoftClientId||"").trim());
    if(provider==="microsoft"&&!msClient){
      if(!silent)alert("Outlook connector is not configured with your Azure app Client ID yet. Open Cloud tab and set your own Azure Application (client) ID once.");
      return;
    }
    const scanAll=opts.scanAll===true;
    const fromDate=(opts.fromDate||acc.syncFromDate||"").trim();
    const markFirst=opts.markFirstSync===true;
    setSyncing(acc.id,true);
    setProgress(acc.id,{phase:"fetching",processed:0,total:0,remaining:0,matched:0,newCount:0,found:0,pending:0});
    addDiagnostic({level:"info",scope:"email",event:"sync_started",message:`${provider==="microsoft"?"Outlook":"Gmail"} sync started.`,accountId:acc.id,provider,context:{scanAll,interactive,silent,fromDate}});
    try{
      const requestedMax=scanAll?50000:Math.max(1,Math.min(Number(acc.maxEmails)||100,5000));
      let token=acc.token||"";
      let messages=[];
      if(provider==="microsoft"){
        let auth;
        try{
          auth=await msGetMailToken(msClient,{homeAccountId:acc.msAccountId,username:acc.msUsername||acc.email},{interactive});
        }catch(msAuthErr){
          if(!interactive)throw msAuthErr;
          const login=await msLoginMail(msClient);
          auth={account:login.account||{},accessToken:login.accessToken};
        }
        token=auth.accessToken;
        const msAcc=auth.account||{};
        setEmails(prev=>prev.map(a=>a.id===acc.id?{...a,token,connected:true,userDisconnected:false,reauthRequired:false,msClientId:msClient,msAccountId:msAcc.homeAccountId||a.msAccountId||"",msUsername:msAcc.username||a.msUsername||a.email||""}:a));
        log(acc.id,scanAll?`Scanning Outlook mailbox from ${fromDate||"beginning"}…`:"Fetching Outlook email list…");
        messages=await msListMessages(token,requestedMax,fromDate);
      }else{
        token=await ensureGoogleToken(acc,{interactive});
        const baseQuery=(acc.syncQuery||GMAIL_QUERY||"in:anywhere").trim();
        const qParts=[baseQuery];
        if(fromDate&&gmailDate(fromDate))qParts.push(`after:${gmailDate(fromDate)}`);
        const finalQuery=qParts.join(" ").trim();
        log(acc.id,scanAll?`Scanning Gmail mailbox from ${fromDate||"beginning"}…`:"Fetching Gmail email list…");
        messages=await gmailListMessages(token,finalQuery,requestedMax);
      }
      if(!messages.length){
        log(acc.id,"✓ No matching emails found.");
        clearAccountIssue(acc.id);
        addDiagnostic({level:"info",scope:"email",event:"sync_no_messages",message:"No matching emails were found for sync.",accountId:acc.id,provider,context:{scanAll,fromDate}});
        setProgress(acc.id,{phase:"done",processed:0,total:0,remaining:0,matched:0,newCount:0,found:0,pending:0});
        setSyncing(acc.id,false);
        return;
      }
      const processedKey=`proc_${EMAIL_SYNC_CACHE_VERSION}_${acc.id}`;
      const processed=new Set(LS.get(processedKey,[]));
      const fresh=messages.filter(m=>!processed.has(m.id));
      if(!fresh.length){
        log(acc.id,"✓ All emails already processed.");
        clearAccountIssue(acc.id);
        addDiagnostic({level:"info",scope:"email",event:"sync_no_new_messages",message:"All matching emails were already processed.",accountId:acc.id,provider,context:{matched:messages.length}});
        setProgress(acc.id,{phase:"done",processed:0,total:0,remaining:0,matched:messages.length,newCount:0,found:0,pending:0});
        setSyncing(acc.id,false);
        return;
      }
      const toProcess=scanAll?fresh:fresh.slice(0,Math.max(1,Math.min(Number(acc.maxEmails)||100,5000)));
      // Fail fast on AI backend misconfiguration so we don't enqueue every email as config-failed.
      try{
        await withTimeout(
          callAI([{role:"user",content:'Reply ONLY this JSON: {"ok":true}'}],60),
          12000,
          "AI backend preflight",
        );
      }catch(preErr){
        if(classifySyncError(preErr)==="config"){
          throw new Error(`ai_config_error: ${String(preErr?.message||"AI backend not configured")}`);
        }
      }
      setProgress(acc.id,{phase:"processing",processed:0,total:toProcess.length,remaining:toProcess.length,matched:messages.length,newCount:fresh.length,found:0,failed:0,skipped:0,pending:0,failureReasons:{}});
      const found=[];let done=0;let failed=0;let skipped=0;let pendingQueued=0;
      const failureReasons={};
      let lastProgressTs=0;
      const flushProgress=(force=false)=>{
        const now=Date.now();
        if(!force&&now-lastProgressTs<250&&done<toProcess.length)return;
        lastProgressTs=now;
        const statusParts=[`Processed ${done}/${toProcess.length} emails`,`found ${found.length}`];
        if(failed>0)statusParts.push(`failed ${failed}`);
        if(skipped>0)statusParts.push(`skipped ${skipped}`);
        if(pendingQueued>0)statusParts.push(`pending AI retry ${pendingQueued}`);
        const failureSummary=formatFailureSummary(failureReasons);
        if(failureSummary)statusParts.push(failureSummary);
        log(acc.id,`${statusParts.join(" · ")}…`);
        setProgress(acc.id,{phase:"processing",processed:done,total:toProcess.length,remaining:Math.max(0,toProcess.length-done),matched:messages.length,newCount:fresh.length,found:found.length,failed,skipped,pending:pendingQueued,failureReasons:{...failureReasons}});
      };
      const processMessage=async(msg)=>{
        let evidence=null;
        try{
          evidence=await fetchMessageEvidence(provider,token,msg.id);
          const items=await analyzeMessageEvidence(evidence);
          if(!items.length){
            skipped++;
            processed.add(msg.id);
            return;
          }
          items.forEach(item=>found.push({...item,date:item.date||evidence.eDate||today(),source:"email",emailProvider:provider,emailSubject:evidence.subject||"",emailFrom:evidence.from||"",emailAccountId:acc.id,emailMsgId:msg.id}));
          processed.add(msg.id);
        }catch(e){
          const reason=classifySyncError(e);
          if(reason==="config"){
            throw new Error(`ai_config_error: ${String(e?.message||"AI backend config issue")}`);
          }
          let cloudQueued=false;
          let cloudJobId="";
          if(evidence){
            try{
              const cloud=await enqueueCloudRetryFromEvidence({acc,evidence,msgId:msg.id,provider});
              cloudQueued=Boolean(cloud?.ok);
              cloudJobId=String(cloud?.jobId||"");
            }catch{}
          }
          failed++;
          pendingQueued++;
          failureReasons[reason]=(failureReasons[reason]||0)+1;
          const nowIso=new Date().toISOString();
          const nextRetry=cloudQueued
            ? new Date(Date.now()+Math.max(AI_RETRY_INTERVAL_MS,2*60*60*1000)).toISOString()
            : new Date(Date.now()+AI_RETRY_INTERVAL_MS).toISOString();
          enqueueAiPending({
            id:aiPendingId(acc.id,msg.id),
            accountId:acc.id,
            provider,
            msgId:msg.id,
            subject:evidence?.subject||msg?.subject||"",
            from:evidence?.from||msg?.from?.emailAddress?.address||"",
            emailDate:evidence?.eDate||"",
            snippet:(evidence?.body||"").slice(0,220),
            queuedAt:nowIso,
            lastTriedAt:nowIso,
            attempts:1,
            nextRetryAt:nextRetry,
            lastError:cloudQueued?"queued_cloud_retry":String(e?.message||reason||"processing_failed").slice(0,180),
            cloudQueued,
            cloudJobId:cloudJobId||aiPendingId(acc.id,msg.id),
          });
          processed.add(msg.id);
          console.error(e);
        }finally{
          done++;
          flushProgress();
        }
      };
      const maxParallel=Math.max(1,Math.min(provider==="microsoft"?6:5,toProcess.length));
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
      const valid=deduped.filter(i=>i.amount>0&&(i.type==="income"||i.type==="expense"||i.type==="transfer"));
      const syncStamp=new Date().toISOString();
      setEmails(prev=>prev.map(a=>a.id===acc.id?{
        ...a,
        connected:true,
        userDisconnected:false,
        reauthRequired:false,
        lastSync:syncStamp,
        lastCount:valid.length,
        firstSyncCompleted:a.firstSyncCompleted||markFirst,
        syncFromDate:fromDate||a.syncFromDate||"",
        lastAutoSyncAt:opts.auto===true?syncStamp:(a.lastAutoSyncAt||""),
        msClientId:provider==="microsoft"?(a.msClientId||msClient):a.msClientId,
        lastError:"",
        lastErrorAt:"",
      }:a));
      if(!valid.length){
        if(failed===toProcess.length&&!pendingQueued){
          log(acc.id,"⚠ Sync finished, but all emails failed extraction. Check network/auth and retry.");
          setAccountIssue(acc.id,"All emails failed extraction during sync.");
          addDiagnostic({level:"error",scope:"email",event:"sync_all_failed",message:"Sync completed but every email failed extraction.",accountId:acc.id,provider,context:{matched:messages.length,total:toProcess.length,failed,skipped,pendingQueued,failureReasons}});
          setProgress(acc.id,{phase:"error",processed:toProcess.length,total:toProcess.length,remaining:0,matched:messages.length,newCount:fresh.length,found:0,failed,skipped,pending:pendingQueued,failureReasons:{...failureReasons}});
          setSyncing(acc.id,false);
          return;
        }
        log(acc.id,`✓ Done — no cashflow transaction found.${failed?` Failed: ${failed}.`:""}${skipped?` Skipped: ${skipped}.`:""}${pendingQueued?` Pending AI retry: ${pendingQueued}.`:""}`);
        clearAccountIssue(acc.id);
        addDiagnostic({level:failed>0?"warn":"info",scope:"email",event:"sync_completed_no_transactions",message:"Sync completed with no cashflow transactions.",accountId:acc.id,provider,context:{matched:messages.length,total:toProcess.length,failed,skipped,pendingQueued,failureReasons}});
        setProgress(acc.id,{phase:"done",processed:toProcess.length,total:toProcess.length,remaining:0,matched:messages.length,newCount:fresh.length,found:0,failed,skipped,pending:pendingQueued,failureReasons:{...failureReasons}});
        setSyncing(acc.id,false);
        return;
      }
      const queued=valid.map(i=>({...i,source:"email",reviewStatus:"pending"}));
      addInbox(queued);
      log(acc.id,`AI found ${valid.length} transaction item(s). Added to Review queue.${pendingQueued?` Pending AI retry: ${pendingQueued}.`:""}`);
      clearAccountIssue(acc.id);
      addDiagnostic({level:"info",scope:"email",event:"sync_completed",message:`Sync completed and queued ${valid.length} transaction item(s).`,accountId:acc.id,provider,context:{matched:messages.length,total:toProcess.length,queued:valid.length,failed,skipped,pendingQueued,failureReasons}});
      setProgress(acc.id,{phase:"done",processed:toProcess.length,total:toProcess.length,remaining:0,matched:messages.length,newCount:fresh.length,found:valid.length,failed,skipped,pending:pendingQueued,failureReasons:{...failureReasons}});
      setToast(`📥 ${valid.length} item(s) queued for review.`);
    }catch(e){
      const msg=String(e.message||"");
      if(provider==="google"&&msg.includes("google_silent_refresh_unavailable")){
        log(acc.id,"ℹ Gmail auto-sync is paused until browser allows a silent token refresh. Keep this tab active or click Sync once.");
        setAccountIssue(acc.id,"Google silent refresh unavailable. Manual reconnect may be needed.");
        addDiagnostic({level:"warn",scope:"email",event:"google_silent_refresh_unavailable",message:"Google silent refresh is unavailable for background sync.",accountId:acc.id,provider,context:{error:e}});
        setProgress(acc.id,{phase:"done",pending:0});
      }else if(msg.includes("ai_config_error")){
        const detail=msg.replace("ai_config_error:","").trim();
        log(acc.id,`⚠ AI backend config issue: ${detail}`);
        setAccountIssue(acc.id,detail);
        addDiagnostic({level:"error",scope:"ai",event:"ai_config_error",message:detail||"AI backend config issue.",accountId:acc.id,provider,context:{error:e}});
        if(!silent)alert(`AI backend config issue:\n${detail}\n\nGo to Settings → AI Backend and click Test AI Backend.`);
        setProgress(acc.id,{phase:"error",pending:0,failureReasons:{config:1}});
      }else if(provider==="google"&&isGoogleAuthFailure(msg)){
        log(acc.id,"⚠ Google session needs refresh. Click Connect Gmail once to re-authorize if sync keeps failing.");
        setAccountIssue(acc.id,"Google session needs refresh.",{token:null,connected:true,userDisconnected:false,reauthRequired:true});
        addDiagnostic({level:"warn",scope:"auth",event:"gmail_reauth_required",message:"Google session needs refresh.",accountId:acc.id,provider,context:{error:e}});
        if(interactive&&!silent)alert("Google session needs refresh. Click Connect Gmail once, then sync will continue automatically.");
      }else if(provider==="microsoft"&&isMicrosoftAuthFailure(msg)){
        log(acc.id,provider==="microsoft"?"⚠ Microsoft session expired — reconnect required.":"⚠ Token expired — reconnect required.");
        setAccountIssue(acc.id,"Microsoft session expired. Reconnect required.",{token:null,connected:true,userDisconnected:false,reauthRequired:true});
        addDiagnostic({level:"warn",scope:"auth",event:"outlook_reauth_required",message:"Microsoft session expired and requires reconnect.",accountId:acc.id,provider,context:{error:e}});
      }else{
        log(acc.id,"Error: "+msg);
        setAccountIssue(acc.id,msg);
        addDiagnostic({level:"error",scope:"email",event:"sync_failed",message:msg||"Email sync failed.",accountId:acc.id,provider,context:{error:e,scanAll,interactive,silent}});
        setProgress(acc.id,{phase:"error",pending:0});
      }
    }
    setSyncing(acc.id,false);
  };

  const startSync=(acc,scanAll=false)=>{
    if(acc?.reauthRequired){
      alert(`Reconnect this ${providerOf(acc)==="microsoft"?"Outlook":"Gmail"} account first, then sync will resume normally.`);
      return;
    }
    if(!isSyncReady(acc)){alert(`Connect this ${providerOf(acc)==="microsoft"?"Outlook":"Gmail"} account first.`);return;}
    if(!acc.firstSyncCompleted){
      const d=acc.syncFromDate||new Date(Date.now()-90*24*60*60*1000).toISOString().slice(0,10);
      setFirstSyncPrompt({accId:acc.id,fromDate:d,scanAll:true});
      return;
    }
    runSync(acc,{scanAll,interactive:true});
  };

  const runPendingAiRetry=async({force=false}={})=>{
    const now=Date.now();
    if(retryBusyRef.current)return;
    if(!force&&now-retryLastRunRef.current<15000)return;
    if(force)await pullCloudRetryResults({force:true});
    const retryRows=(aiPending||[])
      .map(normalizeAiPendingEntry)
      .filter(row=>row.accountId&&row.msgId)
      .filter(row=>!row.cloudQueued)
      .filter(row=>force||(()=>{
        const nextAt=Date.parse(row.nextRetryAt||"");
        return !Number.isFinite(nextAt)||nextAt<=Date.now();
      })())
      .slice(0,force?1000:AI_RETRY_BATCH_SIZE);
    if(!retryRows.length)return;
    retryBusyRef.current=true;
    setRetryBusy(true);
    retryLastRunRef.current=now;
    let recovered=0;
    const retryAccountCache=new Map();
    const retryAccountErrors=new Map();
    try{
      for(const row of retryRows){
        const accRaw=retryAccountCache.get(row.accountId)||emails.find(a=>a.id===row.accountId);
        if(!accRaw){
          setAiPending(prev=>prev.filter(p=>p.id!==row.id));
          continue;
        }
        const acc=hydrateEmailAccount(accRaw);
        const provider=providerOf(acc);
        const blockedError=retryAccountErrors.get(acc.id);
        if(blockedError){
          setAiPending(prev=>prev.map(p=>p.id===row.id?{
            ...p,
            nextRetryAt:new Date(Date.now()+AI_RETRY_INTERVAL_MS).toISOString(),
            lastTriedAt:new Date().toISOString(),
            lastError:String(blockedError||"auth_retry_blocked").slice(0,180),
          }:p));
          continue;
        }
        if(!isSyncReady(acc,{allowReauth:force})){
          setAiPending(prev=>prev.map(p=>p.id===row.id?{
            ...p,
            nextRetryAt:new Date(Date.now()+AI_RETRY_INTERVAL_MS).toISOString(),
            lastTriedAt:new Date().toISOString(),
            lastError:"account_not_connected",
          }:p));
          continue;
        }
        let evidence=null;
        try{
          let token=acc.token||"";
          if(provider==="microsoft"){
            const msClient=sanitizeMsClientId((acc.msClientId||microsoftClientId||"").trim());
            if(!msClient)throw new Error("microsoft_client_missing");
            token=String(retryAccountCache.get(acc.id)?.token||"").trim();
            if(!token){
              const auth=await msGetMailToken(msClient,{homeAccountId:acc.msAccountId,username:acc.msUsername||acc.email},{interactive:force});
              token=auth.accessToken;
              const msAcc=auth.account||{};
              const nextAcc={
                ...acc,
                token,
                connected:true,
                userDisconnected:false,
                reauthRequired:false,
                msClientId:msClient,
                msAccountId:msAcc.homeAccountId||acc.msAccountId||"",
                msUsername:msAcc.username||acc.msUsername||acc.email||"",
              };
              retryAccountCache.set(acc.id,nextAcc);
              setEmails(prev=>prev.map(a=>a.id===acc.id?{
                ...a,
                token,
                connected:true,
                userDisconnected:false,
                reauthRequired:false,
                msClientId:msClient,
                msAccountId:msAcc.homeAccountId||a.msAccountId||"",
                msUsername:msAcc.username||a.msUsername||a.email||"",
              }:a));
            }
          }else{
            token=await ensureGoogleToken(acc,{interactive:force});
            retryAccountCache.set(acc.id,{
              ...acc,
              token,
              tokenExpiresAt:new Date(Date.now()+55*60*1000).toISOString(),
              connected:true,
              userDisconnected:false,
              reauthRequired:false,
            });
          }
          evidence=await fetchMessageEvidence(provider,token,row.msgId);
          const items=await analyzeMessageEvidence(evidence);
          markProcessedMessage(acc.id,row.msgId);
          setAiPending(prev=>prev.filter(p=>p.id!==row.id));
          if(!items.length)continue;
          const queued=items.map(item=>({
            ...item,
            date:item.date||evidence.eDate||today(),
            source:"email",
            reviewStatus:"pending",
            emailProvider:provider,
            emailSubject:evidence.subject||"",
            emailFrom:evidence.from||"",
            emailAccountId:acc.id,
            emailMsgId:row.msgId,
          }));
          if(queued.length){
            recovered+=queued.length;
            addInbox(queued);
            log(acc.id,`🤖 AI retry recovered ${queued.length} item(s) from pending queue.`);
            clearAccountIssue(acc.id);
            addDiagnostic({level:"info",scope:"email",event:"ai_retry_recovered",message:`AI retry recovered ${queued.length} item(s).`,accountId:acc.id,provider,context:{items:queued.length,msgId:row.msgId}});
          }
        }catch(err){
          const msg=String(err?.message||"unknown_error");
          const lower=msg.toLowerCase();
          let cloudQueued=false;
          let cloudJobId=String(row.cloudJobId||"");
          if(evidence){
            try{
              const cloud=await enqueueCloudRetryFromEvidence({acc,evidence,msgId:row.msgId,provider});
              cloudQueued=Boolean(cloud?.ok);
              if(cloudQueued)cloudJobId=String(cloud?.jobId||cloudJobId||"");
            }catch{}
          }
          if(provider==="google"&&isGoogleAuthFailure(lower)){
            retryAccountErrors.set(acc.id,msg);
            setAccountIssue(acc.id,"Google session needs refresh.",{token:null,connected:true,userDisconnected:false,reauthRequired:true});
          }else if(provider==="microsoft"&&isMicrosoftAuthFailure(lower)){
            retryAccountErrors.set(acc.id,msg);
            setAccountIssue(acc.id,"Microsoft session expired. Reconnect required.",{token:null,connected:true,userDisconnected:false,reauthRequired:true});
          }else if(force&&isDismissedAuthFlow(lower)){
            retryAccountErrors.set(acc.id,msg);
          }
          addDiagnostic({level:"warn",scope:"email",event:"ai_retry_failed",message:msg.slice(0,180),accountId:acc.id,provider,context:{msgId:row.msgId,cloudQueued}});
          const nextRetry=cloudQueued
            ? new Date(Date.now()+Math.max(AI_RETRY_INTERVAL_MS,2*60*60*1000)).toISOString()
            : new Date(Date.now()+AI_RETRY_INTERVAL_MS).toISOString();
          setAiPending(prev=>prev.map(p=>p.id===row.id?{
            ...p,
            attempts:(Number(p.attempts)||0)+1,
            nextRetryAt:nextRetry,
            lastTriedAt:new Date().toISOString(),
            lastError:cloudQueued?"queued_cloud_retry":msg.slice(0,180),
            cloudQueued:cloudQueued||Boolean(p.cloudQueued),
            cloudJobId:cloudJobId||p.cloudJobId||p.id,
          }:p));
        }
      }
      if(recovered>0)setToast(`🤖 AI retry queued ${recovered} item(s) for review.`);
    }finally{
      retryBusyRef.current=false;
      setRetryBusy(false);
      retryLastRunRef.current=Date.now();
      pullCloudRetryResults({force:false}).catch(()=>{});
    }
  };

  useEffect(()=>{
    const runAutoSync=()=>{
      pullCloudRetryResults({force:false}).catch(()=>{});
      runPendingAiRetry({force:false}).catch(()=>{});
      if(Object.values(syncingIds).some(Boolean))return;
      const now=Date.now();
      const due=emails
        .map(hydrateEmailAccount)
        .filter(acc=>isSyncReady(acc))
        .filter(acc=>acc.firstSyncCompleted)
        .filter(acc=>acc.autoSyncHourly!==false)
        .filter(acc=>{
          const last=Date.parse(acc.lastAutoSyncAt||acc.lastSync||"");
          if(!Number.isFinite(last))return true;
          return (now-last)>=60*60*1000;
        });
      if(!due.length)return;
      due.forEach(acc=>{
        log(acc.id,"⏱ Hourly auto-sync started (new emails only)...");
        setEmails(prev=>prev.map(a=>a.id===acc.id?{...a,lastAutoSyncAt:new Date().toISOString()}:a));
        runSync(acc,{scanAll:false,auto:true,interactive:false,silent:true});
      });
    };
    const onVisible=()=>{
      if(document.visibilityState==="visible")runAutoSync();
    };
    const t=setInterval(runAutoSync,60*1000);
    const kick=setTimeout(runAutoSync,3000);
    window.addEventListener("focus",runAutoSync);
    window.addEventListener("online",runAutoSync);
    document.addEventListener("visibilitychange",onVisible);
    return()=>{
      clearInterval(t);
      clearTimeout(kick);
      window.removeEventListener("focus",runAutoSync);
      window.removeEventListener("online",runAutoSync);
      document.removeEventListener("visibilitychange",onVisible);
    };
  },[emails,syncingIds,aiPending]);

  return(
    <div>
      <R style={{marginBottom:10}}>
        <h2 className="h2" style={{flex:1}}>Email Integration</h2>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button className="btn sm suc" disabled={Boolean(connectBusy)} onClick={()=>connectAccount("google",null)}>
            {connectingGoogle?"⏳ Connecting Gmail…":"+ Connect Gmail Account"}
          </button>
          <button className="btn sm pri" disabled={Boolean(connectBusy)} onClick={()=>connectAccount("microsoft",null)}>
            {connectingMicrosoft?"⏳ Connecting Outlook…":"+ Connect Outlook Account"}
          </button>
        </div>
      </R>

      {toast&&<div style={{background:"#052e16",border:"1px solid #34d399",borderRadius:10,padding:"10px 12px",fontSize:12,color:"#86efac",marginBottom:12}}>{toast}</div>}

      <div className="card" style={{marginBottom:14,background:"linear-gradient(135deg,#10192d,#0a1220)"}}>
        <R>
          <div style={{fontSize:13,color:"#94a3b8"}}>
            Connected accounts: <b style={{color:"#e2e8f0"}}>{connected}</b> / {emails.length}
            {emailInbox>0&&<span style={{marginLeft:10,color:"#f59e0b"}}>· {emailInbox} items pending in Inbox</span>}
            {totalPendingAi>0&&<button className="btn sm ghost" style={{marginLeft:10,padding:"2px 8px",fontSize:12,color:"#c4b5fd",borderColor:"#3b2f66"}} onClick={()=>setPendingView({open:true,accountId:""})}>AI retry queue: {totalPendingAi}{duePendingAi>0?` (due ${duePendingAi})`:""}</button>}
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"flex-end"}}>
            {totalPendingAi>0&&<button className="btn sm ghost" disabled={Boolean(connectBusy)} onClick={()=>setPendingView({open:true,accountId:""})}>📋 View AI Pending</button>}
            {totalPendingAi>0&&<button className="btn sm ghost" disabled={retryBusy||Boolean(connectBusy)} onClick={()=>runPendingAiRetry({force:true})}>{retryBusy?"⏳ Retrying AI…":"🤖 Retry AI Pending"}</button>}
            {syncableAccounts.length>0&&<button className="btn sm pri" disabled={anySyncing||Boolean(connectBusy)} onClick={()=>syncableAccounts.forEach(a=>startSync(a,false))}>{anySyncing?"⏳ Syncing…":"🔄 Sync All Accounts"}</button>}
          </div>
        </R>
      </div>

      {emails.length===0&&(
          <div className="card" style={{textAlign:"center",padding:56,background:"linear-gradient(135deg,#0f1624,#081122)"}}>
            <div style={{fontSize:42,marginBottom:12}}>📬</div>
            <div style={{fontSize:20,fontWeight:700,marginBottom:8}}>Connect your first email account</div>
            <div style={{fontSize:13,color:"#64748b",marginBottom:20}}>Choose Gmail or Outlook, sign in, grant permissions, then sync from a start date.</div>
            <div style={{display:"flex",justifyContent:"center",gap:10}}>
            <button className="btn suc" disabled={Boolean(connectBusy)} onClick={()=>connectAccount("google",null)}>{connectingGoogle?"⏳ Connecting Gmail…":"+ Connect Gmail Account"}</button>
            <button className="btn pri" disabled={Boolean(connectBusy)} onClick={()=>connectAccount("microsoft",null)}>{connectingMicrosoft?"⏳ Connecting Outlook…":"+ Connect Outlook Account"}</button>
            </div>
          </div>
      )}

      {emails.map(rawAcc=>{
        const acc=hydrateEmailAccount(rawAcc);
        const provider=providerOf(acc);
        const providerLabel=provider==="microsoft"?"Outlook":"Gmail";
        const linked=Boolean(acc.connected)&&!acc.userDisconnected;
        const needsReauth=Boolean(acc.reauthRequired)&&linked;
        return(
        <div key={acc.id} className="card" style={{marginBottom:12,background:linked?"linear-gradient(135deg,#0f1c36,#0b1530)":"#0f1624"}}>
          <R style={{marginBottom:8}}>
            <div style={{display:"flex",gap:12,alignItems:"center",flex:1,minWidth:0}}>
              <div style={{width:40,height:40,borderRadius:20,display:"flex",alignItems:"center",justifyContent:"center",background:linked?"#052e16":"#1a1a2e"}}>{linked?"✅":provider==="microsoft"?"Ⓜ️":"📧"}</div>
              <div style={{minWidth:0}}>
                <div style={{fontWeight:700,fontSize:15,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{acc.email||acc.label||"Email account"}</div>
                <div style={{fontSize:12,color:"#64748b"}}>
                  <span>{providerLabel} · </span>
                  {linked&&!needsReauth&&<span style={{color:"#34d399"}}>Connected</span>}
                  {linked&&needsReauth&&<span style={{color:"#f59e0b"}}>Connected · re-auth needed</span>}
                  {!linked&&<span style={{color:"#f87171"}}>Disconnected</span>}
                  {acc.firstSyncCompleted&&acc.syncFromDate&&<span> · first synced from {fmtD(acc.syncFromDate)}</span>}
                  {acc.lastSync&&<span> · last sync {fmtDT(acc.lastSync)}</span>}
                  {pendingByAccount[acc.id]>0&&(
                    <button className="btn sm ghost" style={{marginLeft:8,padding:"2px 8px",fontSize:11,color:"#c4b5fd",borderColor:"#3b2f66"}} onClick={()=>setPendingView({open:true,accountId:acc.id})}>
                      AI retry pending {pendingByAccount[acc.id]}{duePendingByAccount[acc.id]?` (due ${duePendingByAccount[acc.id]})`:""}
                    </button>
                  )}
                </div>
                {acc.lastError&&<div style={{fontSize:11,color:"#fca5a5",marginTop:4}}>
                  Last issue{acc.lastErrorAt?` · ${fmtDT(acc.lastErrorAt)}`:""}: {acc.lastError}
                </div>}
              </div>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {(!linked||needsReauth)&&<button className="btn sm pri" disabled={Boolean(connectBusy)} onClick={()=>connectAccount(provider,acc)}>
                {provider==="google"&&connectingGoogle?"⏳ Connecting Gmail…":provider==="microsoft"&&connectingMicrosoft?"⏳ Connecting Outlook…":needsReauth?`Reconnect ${providerLabel}`:`Connect ${providerLabel}`}
              </button>}
              {linked&&!needsReauth&&<button className="btn sm" style={{background:"#1a2234",color:"#818cf8"}} disabled={Boolean(syncingIds[acc.id])} onClick={()=>startSync(acc,false)}>{syncingIds[acc.id]?"⏳ Syncing…":"🔄 Sync"}</button>}
              {linked&&!needsReauth&&<button className="btn sm ghost" disabled={Boolean(syncingIds[acc.id])} onClick={()=>setFirstSyncPrompt({accId:acc.id,fromDate:acc.syncFromDate||new Date(Date.now()-180*24*60*60*1000).toISOString().slice(0,10),scanAll:true})}>🧠 Scan From Date</button>}
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
                  {syncProgress[acc.id].phase==="processing"&&`Processed ${syncProgress[acc.id].processed||0}/${syncProgress[acc.id].total||0}${syncProgress[acc.id].failed?` · failed ${syncProgress[acc.id].failed}`:""}${syncProgress[acc.id].skipped?` · skipped ${syncProgress[acc.id].skipped}`:""}${syncProgress[acc.id].pending?` · pending AI ${syncProgress[acc.id].pending}`:""}`}
                  {syncProgress[acc.id].phase==="review"&&`Scan complete. ${syncProgress[acc.id].found||0} item(s) awaiting review.${syncProgress[acc.id].pending?` Pending AI retry: ${syncProgress[acc.id].pending}.`:""}`}
                  {syncProgress[acc.id].phase==="done"&&`Sync completed.${Number(syncProgress[acc.id].found)>0?` ${syncProgress[acc.id].found} transaction(s) in review queue.`:""}${syncProgress[acc.id].pending?` Pending AI retry: ${syncProgress[acc.id].pending}.`:""}`}
                  {syncProgress[acc.id].phase==="error"&&`Sync failed.${syncProgress[acc.id].pending?` Pending AI retry: ${syncProgress[acc.id].pending}.`:""}`}
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
              {(Number(syncProgress[acc.id].failed)>0||Number(syncProgress[acc.id].skipped)>0||Number(syncProgress[acc.id].pending)>0)&&<div style={{marginTop:6,fontSize:11,color:"#64748b"}}>Failed = processing/API error. Skipped = AI found no financial transaction. Pending AI = retry queue (next attempt in 30m).</div>}
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
                <div>
                  <label style={{display:"block",marginBottom:8}}>Auto sync</label>
                  <label style={{display:"flex",gap:8,alignItems:"center",fontSize:13,color:"#94a3b8"}}>
                    <input type="checkbox" checked={acc.autoSyncHourly!==false} onChange={e=>setEmails(p=>p.map(a=>a.id===acc.id?{...a,autoSyncHourly:e.target.checked}:a))}/>
                    Run every hour (new emails only)
                  </label>
                </div>
              </div>
              {provider==="microsoft"&&<div style={{fontSize:11,color:"#64748b",marginTop:8}}>Outlook sync scans inbox messages from selected date. Search query is only for Gmail.</div>}
              <div style={{fontSize:11,color:"#64748b",marginTop:8}}>All extracted transactions go to Inbox review queue. Approve/Reject/Edit from Inbox or Day Review.</div>
            </div>
          )}
        </div>
      )})}

      {pendingView.open&&(
        <div className="overlay"><div className="modal" style={{maxWidth:1020}}>
          <MH title={`AI Pending Retry (${pendingRowsFiltered.length})`} onClose={()=>setPendingView({open:false,accountId:""})}/>
          <div style={{fontSize:12,color:"#94a3b8",marginBottom:10}}>
            Emails listed below were not fully processed by AI yet. They stay here and retry automatically every 30 minutes until processing succeeds.
          </div>
          {pendingView.accountId&&<div style={{fontSize:12,color:"#c4b5fd",marginBottom:10}}>Filtered account: {pendingAccountName(pendingView.accountId)}</div>}
          {pendingRowsFiltered.length===0?(
            <div className="card" style={{textAlign:"center",padding:26,color:"#64748b"}}>No pending retry items.</div>
          ):(
            <div style={{maxHeight:"56vh",overflowY:"auto",border:"1px solid #1e293b",borderRadius:10}}>
              {pendingRowsFiltered.map(row=>{
                const nextAt=Date.parse(row.nextRetryAt||"");
                const due=!Number.isFinite(nextAt)||nextAt<=Date.now();
                return(
                  <div key={row.id} style={{padding:"10px 12px",borderBottom:"1px solid #1e293b",background:due?"#0f172a":"transparent"}}>
                    <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap",marginBottom:4}}>
                      <div style={{fontSize:13,fontWeight:600,color:"#e2e8f0"}}>{row.subject||"(No subject captured)"}</div>
                      <div style={{fontSize:11,color:due?"#fbbf24":"#64748b"}}>{due?"Due now":`Next retry ${fmtDT(row.nextRetryAt)}`}</div>
                    </div>
                    <div style={{fontSize:12,color:"#94a3b8",display:"flex",gap:10,flexWrap:"wrap"}}>
                      <span>{row.provider==="microsoft"?"Outlook":"Gmail"} · {pendingAccountName(row.accountId)}</span>
                      {row.from&&<span>From: {row.from}</span>}
                      {row.emailDate&&<span>Email date: {fmtD(row.emailDate)}</span>}
                      <span>Attempts: {row.attempts||0}</span>
                      <span>Message ID: {row.msgId}</span>
                    </div>
                    <div style={{fontSize:11,color:"#fca5a5",marginTop:6}}>Reason: {row.lastError||"unknown_error"}</div>
                    {row.snippet&&<div style={{fontSize:11,color:"#64748b",marginTop:4,lineHeight:1.6}}>{row.snippet.slice(0,260)}</div>}
                  </div>
                );
              })}
            </div>
          )}
          <div style={{display:"flex",gap:10,marginTop:12}}>
            <button className="btn ghost" style={{flex:1}} onClick={()=>setPendingView({open:false,accountId:""})}>Close</button>
            <button className="btn pri" style={{flex:2}} disabled={retryBusy||Boolean(connectBusy)||pendingRowsFiltered.length===0} onClick={()=>runPendingAiRetry({force:true})}>{retryBusy?"⏳ Retrying AI…":"🤖 Retry Pending Now"}</button>
          </div>
        </div></div>
      )}

      {firstSyncPrompt&&<EmailFirstSyncModal value={firstSyncPrompt.fromDate} onClose={()=>setFirstSyncPrompt(null)} onStart={(fromDate)=>{
        const acc=emails.find(a=>a.id===firstSyncPrompt.accId);
        if(acc)runSync(acc,{scanAll:firstSyncPrompt.scanAll,fromDate,markFirstSync:!acc.firstSyncCompleted,interactive:true});
        setFirstSyncPrompt(null);
      }}/>}
    </div>
  );
}

function EmailFirstSyncModal({value,onClose,onStart}){
  const[fromDate,setFromDate]=useState(value||new Date(Date.now()-90*24*60*60*1000).toISOString().slice(0,10));
  return(
    <div className="overlay"><div className="modal" style={{maxWidth:520}}>
      <MH title="First Sync Date" onClose={onClose}/>
      <div style={{fontSize:13,color:"#94a3b8",lineHeight:1.7,marginBottom:10}}>
        Choose the starting date. LedgerAI will scan all emails from this date to today and use AI to extract cashflow transactions.
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
    const rowType=i.type==="income"?"income":i.type==="transfer"?"transfer":"expense";
    return{...i,type:rowType,businessActivity:act,category:cat,subCategory:i.subCategory||"",date:i.date||today(),amount:Number(i.amount)||0,description:i.description||i.vendor||cat,paymentMethod:i.paymentMethod||""};
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
              <div><label>Type</label><select value={r.type} onChange={e=>update(i,{type:e.target.value})}><option value="expense">Expense</option><option value="income">Income</option><option value="transfer">Transfer</option></select></div>
              <div><label>Date</label><input type="date" value={r.date||""} onChange={e=>update(i,{date:e.target.value})}/></div>
              <div><label>Amount</label><input type="number" value={r.amount||""} onChange={e=>update(i,{amount:Number(e.target.value)})}/></div>
              <div><label>Business</label><select value={r.businessActivity||acts[0]||""} onChange={e=>update(i,{businessActivity:e.target.value,category:cats[e.target.value]?.[0]||r.category||"Other"})}>{acts.map(a=><option key={a} value={a}>{a}</option>)}</select></div>
              <div><label>Category</label><input list={`cat-${i}`} value={r.category||""} onChange={e=>update(i,{category:e.target.value})}/><datalist id={`cat-${i}`}>{(cats[r.businessActivity]||[]).map(c=><option key={c} value={c}/>)}</datalist></div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr auto",gap:8,alignItems:"end"}}>
              <div><label>Description</label><input value={r.description||""} onChange={e=>update(i,{description:e.target.value})}/></div>
              <div><label>Sub Category</label><input value={r.subCategory||""} onChange={e=>update(i,{subCategory:e.target.value})} placeholder="Optional"/></div>
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
        <option value="All">All Types</option><option value="income">Income</option><option value="expense">Expense</option><option value="transfer">Transfer</option><option value="borrow">Borrowed Cash</option>
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
  const runBatch=async()=>{
    if(!bulk.trim())return;
    setLoading(true);
    try{
      const raw=await aiExtractBatch(bulk,acts,cats);
      const sanitized=sanitizeEmailTransactions(raw,{
        acts,
        cats,
        baseCurrency:getBaseCurrency(),
        eDate:today(),
        subject:"Manual paste",
        from:"",
      });
      const converted=await convertExtractedItemsToBaseCurrency(sanitized,{
        baseCurrency:getBaseCurrency(),
        fallbackCurrency:getBaseCurrency(),
        dateFallback:today(),
      });
      addInbox(converted.map(i=>({...i,type:i.type||"expense"})));
      setBulk("");
    }finally{
      setLoading(false);
    }
  };
  const todItems=inbox.filter(i=>i.date===today());
  const oldItems=inbox.filter(i=>i.date!==today());
  const emailItems=inbox.filter(i=>i.source==="email");
  const approveAll=(items=[])=>items.forEach(onApprove);
  const rejectAll=(items=[])=>{
    if(!items.length)return;
    if(!window.confirm(`Reject ${items.length} queued item(s)?`))return;
    items.forEach(i=>onDiscard(i._iid));
  };
  return(<div>
    <h2 className="h2" style={{marginBottom:4}}>Inbox — Review & Approve</h2>
    <p style={{fontSize:13,color:"#64748b",marginBottom:18}}>Transactions from email auto-import or statement reconciliation appear here before entering the ledger.</p>
    {emailItems.length>0&&<div style={{background:"#052e16",border:"1px solid #34d399",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#86efac"}}>📧 <b>{emailItems.length}</b> transaction(s) auto-extracted from email — review below.</div>}
    <div className="card" style={{marginBottom:22}}>
      <div style={{fontWeight:600,fontSize:14,marginBottom:10,color:"#94a3b8"}}>📥 Manual Paste (Email / Bank Alert Text)</div>
      <textarea rows={4} value={bulk} onChange={e=>setBulk(e.target.value)} placeholder="Paste email body, invoice text, or bank alert text…"/>
      <button className="btn pri" style={{marginTop:10,width:"100%"}} onClick={runBatch} disabled={loading||!bulk.trim()}>{loading?"🤖 Extracting…":"🤖 Extract & Queue for Review"}</button>
    </div>
    {inbox.length>0&&(
      <R style={{marginBottom:10}}>
        <div className="sh" style={{margin:0}}>Pending Queue ({inbox.length})</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button className="btn sm suc" onClick={()=>approveAll(inbox)}>✓ Accept All</button>
          <button className="btn sm dan" onClick={()=>rejectAll(inbox)}>✕ Reject All</button>
        </div>
      </R>
    )}
    {inbox.length===0&&<div className="card" style={{textAlign:"center",color:"#475569",padding:40}}>No pending items. Sync email accounts or paste messages above.</div>}
    {todItems.length>0&&<><R style={{marginBottom:10}}><div className="sh">Today ({todItems.length})</div><div style={{display:"flex",gap:8}}><button className="btn sm suc" onClick={()=>approveAll(todItems)}>✓ Accept All Today</button><button className="btn sm dan" onClick={()=>rejectAll(todItems)}>✕ Reject All Today</button></div></R>{todItems.map(item=><ICard key={item._iid} item={item} onApprove={onApprove} onEdit={onEdit} onDiscard={onDiscard}/>)}</>}
    {oldItems.length>0&&<><div className="sh" style={{marginTop:20,marginBottom:10}}>Older ({oldItems.length})</div>{oldItems.map(item=><ICard key={item._iid} item={item} onApprove={onApprove} onEdit={onEdit} onDiscard={onDiscard}/>)}</>}
  </div>);
}

function ICard({item,onApprove,onEdit,onDiscard}){
  const[ex,setEx]=useState(false);
  const typeColor=item.type==="income"?"#34d399":item.type==="borrow"?"#f59e0b":item.type==="transfer"?"#38bdf8":"#f87171";
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
          <div style={{fontSize:12,color:"#475569"}}>
            {item.businessActivity} · {item.category}{item.subCategory?` · ${item.subCategory}`:""}
            {item.vendor?` · ${item.vendor}`:""}
            {item.paymentMethod?` · ${item.paymentMethod}`:""}
            {item.type==="transfer"&&item.accountName&&item.targetAccountName?` · ${item.accountName} → ${item.targetAccountName}`:(item.accountName?` · ${item.accountName}`:"")}
            {item.borrowSource?` · Borrowed from ${item.borrowSource}`:""}
          </div>
          {currencyMetaLabel(item)&&<div style={{fontSize:11,color:"#64748b",marginTop:4}}>{currencyMetaLabel(item)}</div>}
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
            {currencyMetaLabel(tx)&&<span style={{fontSize:10,color:"#94a3b8"}}>{currencyMetaLabel(tx)}</span>}
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
function AccountsTab({accs,setAccs,onOpenReconciliation=()=>{}}){
  const[showForm,setShowForm]=useState(false);
  const[editAccId,setEditAccId]=useState(null);
  const assets=accs.filter(a=>a.cls==="asset");
  const liabs=accs.filter(a=>a.cls==="liability");
  const editAcc=accs.find(a=>a.id===editAccId)||null;
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
            <div style={{flex:1}}>
              <div style={{fontWeight:500,fontSize:14}}>{acc.name}</div>
              <div style={{fontSize:12,color:"#475569"}}>{acc.typeName}{acc.bank?` · ${acc.bank}`:""}{acc.number?` · ···${acc.number.slice(-4)}`:""}{acc.accountCurrency?` · ${acc.accountCurrency}`:""}</div>
              {currencyMetaLabel(acc)&&<div style={{fontSize:11,color:"#64748b",marginTop:4}}>{currencyMetaLabel(acc)}</div>}
            </div>
            <div className="mono" style={{fontSize:16,fontWeight:700,color:c,marginRight:12}}>{fmt(acc.balance||0)}</div>
            <button className="btn sm" style={{background:"#0f172a",color:"#93c5fd",marginRight:6}} onClick={()=>setEditAccId(acc.id)}>✏️ Edit Balance</button>
            <button className="btn sm" style={{background:"#1a2234",color:"#818cf8",marginRight:6}} onClick={()=>onOpenReconciliation(acc.id)}>📂 Reconcile</button>
            <button className="btn sm dan" onClick={()=>setAccs(p=>p.filter(a=>a.id!==acc.id))}>✕</button>
          </R></div>
        ))}
      </div>
    ))}
    {showForm&&<AddAccModal onSave={a=>{setAccs(p=>[...p,{...a,id:gid()}]);setShowForm(false);}} onClose={()=>setShowForm(false)}/>}
    {editAcc&&<EditAccBalanceModal account={editAcc} onSave={patch=>{setAccs(p=>p.map(a=>a.id===editAcc.id?{...a,...patch}:a));setEditAccId(null);}} onClose={()=>setEditAccId(null)}/>}
  </div>);
}

function AddAccModal({onSave,onClose}){
  const baseCurrency=getBaseCurrency();
  const[f,setF]=useState({name:"",type:"savings",number:"",bank:"",balance:"",accountCurrency:baseCurrency});
  const[busy,setBusy]=useState(false);
  const t=ACC_TYPES.find(x=>x.key===f.type)||ACC_TYPES[0];
  const submit=async()=>{
    if(!f.name)return alert("Enter account name");
    setBusy(true);
    try{
      const accountCurrency=normalizeCurrencyCode(f.accountCurrency||baseCurrency,baseCurrency);
      const amount=Number(f.balance)||0;
      const [converted]=await convertMoneyRows([{
        balance:amount,
        originalBalance:amount,
        accountCurrency,
      }],{
        amountField:"balance",
        originalField:"originalBalance",
        currencyField:"accountCurrency",
        baseAmountField:"balance",
        baseCurrencyField:"balanceBaseCurrency",
        fxDateField:"balanceFxDate",
        fxRateField:"balanceFxRate",
        fxRateDateField:"balanceRateDate",
        fxSourceField:"balanceFxSource",
        baseCurrency,
        fallbackCurrency:accountCurrency,
        dateResolver:()=>today(),
      });
      await onSave({
        ...f,
        cls:t.cls,
        typeName:t.label,
        accountCurrency,
        balance:converted?.balance??amount,
        originalBalance:converted?.originalBalance??amount,
        balanceBaseCurrency:converted?.balanceBaseCurrency||baseCurrency,
        balanceFxRate:converted?.balanceFxRate||1,
        balanceFxDate:converted?.balanceFxDate||today(),
        balanceRateDate:converted?.balanceRateDate||today(),
        balanceFxSource:converted?.balanceFxSource||"manual",
      });
    }finally{
      setBusy(false);
    }
  };
  return(<div className="overlay"><div className="modal" style={{maxWidth:440}}>
    <MH title="Add Account" onClose={onClose}/>
    <label>Account Type</label><select value={f.type} onChange={e=>setF(p=>({...p,type:e.target.value}))}>{ACC_TYPES.map(x=><option key={x.key} value={x.key}>{x.label} ({x.cls})</option>)}</select>
    <label>Account Name</label><input value={f.name} onChange={e=>setF(p=>({...p,name:e.target.value}))} placeholder="e.g. HDFC Savings"/>
    <label>Bank / Institution</label><input value={f.bank} onChange={e=>setF(p=>({...p,bank:e.target.value}))} placeholder="HDFC, Zerodha…"/>
    <label>Account Number (last 4)</label><input value={f.number} onChange={e=>setF(p=>({...p,number:e.target.value}))} placeholder="Optional"/>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      <div><label>Account Currency</label><select value={f.accountCurrency} onChange={e=>setF(p=>({...p,accountCurrency:e.target.value}))}>{CURRENCY_OPTIONS.map(code=><option key={code} value={code}>{code}</option>)}</select></div>
      <div><label>Opening Balance</label><input type="number" value={f.balance} onChange={e=>setF(p=>({...p,balance:e.target.value}))} placeholder="0"/></div>
    </div>
    <div style={{fontSize:11,color:"#64748b",marginTop:8}}>LedgerAI converts the entered balance into {baseCurrency} for reporting while keeping the account currency as a reconciliation hint.</div>
    <div style={{display:"flex",gap:10,marginTop:18}}>
      <button className="btn ghost" onClick={onClose} style={{flex:1}}>Cancel</button>
      <button className="btn pri" style={{flex:2}} onClick={submit} disabled={busy}>{busy?"Saving…":"Add Account"}</button>
    </div>
  </div></div>);
}

function EditAccBalanceModal({account,onSave,onClose}){
  const baseCurrency=getBaseCurrency();
  const[balance,setBalance]=useState(String(account.originalBalance??account.balance??0));
  const[currency,setCurrency]=useState(normalizeCurrencyCode(account.accountCurrency||baseCurrency,baseCurrency));
  const[busy,setBusy]=useState(false);
  const save=async()=>{
    setBusy(true);
    try{
      const amount=Number(balance)||0;
      const [converted]=await convertMoneyRows([{
        balance:amount,
        originalBalance:amount,
        accountCurrency:currency,
      }],{
        amountField:"balance",
        originalField:"originalBalance",
        currencyField:"accountCurrency",
        baseAmountField:"balance",
        baseCurrencyField:"balanceBaseCurrency",
        fxDateField:"balanceFxDate",
        fxRateField:"balanceFxRate",
        fxRateDateField:"balanceRateDate",
        fxSourceField:"balanceFxSource",
        baseCurrency,
        fallbackCurrency:currency,
        dateResolver:()=>today(),
      });
      await onSave({
        balance:converted?.balance??amount,
        originalBalance:converted?.originalBalance??amount,
        accountCurrency:currency,
        balanceBaseCurrency:converted?.balanceBaseCurrency||baseCurrency,
        balanceFxRate:converted?.balanceFxRate||1,
        balanceFxDate:converted?.balanceFxDate||today(),
        balanceRateDate:converted?.balanceRateDate||today(),
        balanceFxSource:converted?.balanceFxSource||"manual",
      });
    }finally{
      setBusy(false);
    }
  };
  return(<div className="overlay"><div className="modal" style={{maxWidth:420}}>
    <MH title={`Edit Balance: ${account.name}`} onClose={onClose}/>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      <div><label>Account Currency</label><select value={currency} onChange={e=>setCurrency(e.target.value)}>{CURRENCY_OPTIONS.map(code=><option key={code} value={code}>{code}</option>)}</select></div>
      <div><label>Updated Balance</label><input type="number" value={balance} onChange={e=>setBalance(e.target.value)} placeholder="0"/></div>
    </div>
    <div style={{fontSize:11,color:"#64748b",marginTop:8}}>Displayed account balance is converted into {baseCurrency} for reports and reconciliation.</div>
    <div style={{display:"flex",gap:10,marginTop:18}}>
      <button className="btn ghost" onClick={onClose} style={{flex:1}}>Cancel</button>
      <button className="btn pri" style={{flex:2}} onClick={save} disabled={busy}>{busy?"Saving…":"Save Balance"}</button>
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

function ReconciliationIssueEditorModal({account,row,acts,cats,onClose,onSave}){
  const baseCurrency=getBaseCurrency();
  const defaultAct=acts.includes("Personal")?"Personal":(acts[0]||"");
  const initialAct=acts.includes(row?.businessActivity)?row.businessActivity:defaultAct;
  const[form,setForm]=useState({
    type:row?.type==="credit"?"income":"expense",
    date:row?.date||today(),
    description:row?.description||"",
    originalAmount:row?.originalAmount??row?.amount??0,
    currency:normalizeCurrencyCode(row?.currency||baseCurrency,baseCurrency),
    businessActivity:initialAct,
    category:row?.category||cats[initialAct]?.[0]||"Other",
    subCategory:row?.subCategory||"",
    vendor:row?.vendor||"",
    paymentMethod:row?.paymentMethod||account?.typeName||"",
  });
  const[busy,setBusy]=useState(false);
  const clist=cats[form.businessActivity]||["Other"];
  const save=async()=>{
    setBusy(true);
    try{
      const [converted]=await convertExtractedItemsToBaseCurrency([{
        type:form.type,
        date:form.date,
        description:form.description,
        amount:Number(form.originalAmount)||0,
        originalAmount:Number(form.originalAmount)||0,
        currency:form.currency,
        businessActivity:form.businessActivity,
        category:form.category,
        subCategory:form.subCategory,
        vendor:form.vendor,
        trackVendor:Boolean(form.vendor),
        paymentMethod:form.paymentMethod||account?.typeName||"",
      }],{
        baseCurrency,
        fallbackCurrency:form.currency||baseCurrency,
        dateFallback:form.date||today(),
      });
      onSave({
        ...converted,
        accountId:account?.id||"",
        accountName:account?.name||"",
        source:"statement",
      });
    }finally{
      setBusy(false);
    }
  };
  return(
    <div className="overlay"><div className="modal" style={{maxWidth:720}}>
      <MH title="Edit Reconciliation Item" onClose={onClose}/>
      <div style={{fontSize:12,color:"#64748b",lineHeight:1.8,marginBottom:10}}>Adjust the statement item before sending it to Inbox. Amount entered here is the original statement amount; LedgerAI will convert it into {baseCurrency} in the background.</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
        <div><label>Type</label><select value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))}><option value="expense">Expense</option><option value="income">Income</option></select></div>
        <div><label>Date</label><input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}/></div>
        <div><label>Original Amount</label><input type="number" value={form.originalAmount} onChange={e=>setForm(p=>({...p,originalAmount:e.target.value}))}/></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div><label>Original Currency</label><select value={form.currency} onChange={e=>setForm(p=>({...p,currency:e.target.value}))}>{CURRENCY_OPTIONS.map(code=><option key={code} value={code}>{code}</option>)}</select></div>
        <div><label>Payment Method</label><input value={form.paymentMethod||""} onChange={e=>setForm(p=>({...p,paymentMethod:e.target.value}))} placeholder={account?.typeName||"Optional"}/></div>
      </div>
      <label>Description</label><input value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div><label>Business Activity</label><select value={form.businessActivity} onChange={e=>setForm(p=>({...p,businessActivity:e.target.value,category:cats[e.target.value]?.[0]||p.category||"Other"}))}>{acts.map(a=><option key={a} value={a}>{a}</option>)}</select></div>
        <div><label>Category</label><input list="recon-cats" value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))}/><datalist id="recon-cats">{clist.map(c=><option key={c} value={c}/>)}</datalist></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div><label>Sub Category</label><input value={form.subCategory||""} onChange={e=>setForm(p=>({...p,subCategory:e.target.value}))}/></div>
        <div><label>Vendor</label><input value={form.vendor||""} onChange={e=>setForm(p=>({...p,vendor:e.target.value}))}/></div>
      </div>
      <div style={{display:"flex",gap:10,marginTop:16}}>
        <button className="btn ghost" style={{flex:1}} onClick={onClose}>Cancel</button>
        <button className="btn pri" style={{flex:2}} onClick={save} disabled={busy}>{busy?"Converting…":"Save & Queue to Inbox"}</button>
      </div>
    </div></div>
  );
}

function ReconciliationTab({accs,txns,acts,cats,addInbox,onEditLedger,preselectedAccountId=""}){
  const baseCurrency=getBaseCurrency();
  const[accountId,setAccountId]=useState(preselectedAccountId||accs[0]?.id||"");
  const[fromDate,setFromDate]=useState(()=>new Date(Date.now()-30*24*60*60*1000).toISOString().slice(0,10));
  const[toDate,setToDate]=useState(today());
  const[sourceText,setSourceText]=useState("");
  const[sourceLabel,setSourceLabel]=useState("");
  const[busy,setBusy]=useState(false);
  const[fileBusy,setFileBusy]=useState(false);
  const[status,setStatus]=useState("");
  const[result,setResult]=useState(null);
  const[editorRow,setEditorRow]=useState(null);
  const hiddenIssuesRef=useRef(new Set());
  const account=accs.find(a=>a.id===accountId)||null;

  useEffect(()=>{
    if(preselectedAccountId)setAccountId(preselectedAccountId);
  },[preselectedAccountId]);

  useEffect(()=>{
    if(!accountId&&accs[0]?.id)setAccountId(accs[0].id);
  },[accountId,accs]);

  const loadStatementFile=async(file)=>{
    if(!file)return;
    setFileBusy(true);
    try{
      const text=await readStatementFileText(file);
      setSourceText(text);
      setSourceLabel(file.name||"Uploaded statement");
      setStatus(`Loaded statement file: ${file.name||"statement"}`);
    }catch(error){
      setStatus(error?.message||"Unable to read statement file.");
    }finally{
      setFileBusy(false);
    }
  };

  const queueStatementRow=(row)=>{
    if(!account)return;
    const txType=row.type==="credit"||row.type==="income"?"income":"expense";
    addInbox([{
      type:txType,
      date:row.date,
      description:row.description,
      amount:row.amount,
      originalAmount:row.originalAmount??row.amount,
      currency:row.currency||baseCurrency,
      baseAmount:row.baseAmount??row.amount,
      baseCurrency:row.baseCurrency||baseCurrency,
      fxRate:row.fxRate||1,
      fxDate:row.fxDate||row.date,
      fxRateDate:row.fxRateDate||row.date,
      fxSource:row.fxSource||"",
      vendor:row.vendor||"",
      trackVendor:Boolean(row.vendor),
      businessActivity:row.businessActivity||(acts.includes("Personal")?"Personal":(acts[0]||"")),
      category:row.category||"Other",
      subCategory:row.subCategory||"",
      paymentMethod:row.paymentMethod||account.typeName||"",
      accountId:account.id,
      accountName:account.name,
      source:"statement",
    }]);
    setStatus(`Queued "${row.description}" to Inbox for review.`);
  };

  const hideIssue=(id)=>{
    hiddenIssuesRef.current.add(id);
    setResult(prev=>prev?{...prev}:prev);
  };

  const runReconciliation=async()=>{
    if(!account)return alert("Select an account first.");
    if(!fromDate||!toDate)return alert("Select statement period.");
    if(!sourceText.trim())return alert("Upload or paste the statement first.");
    setBusy(true);
    setStatus("Parsing statement and reconciling...");
    hiddenIssuesRef.current=new Set();
    try{
      const parsed=await aiParseStatement(sourceText,account.name,account.typeName,account.accountCurrency||baseCurrency,baseCurrency);
      const prepared=await prepareStatementRows(parsed,{
        accountCurrency:account.accountCurrency||baseCurrency,
        baseCurrency,
        dateFallback:fromDate||today(),
      });
      const statementRows=prepared.filter(row=>inDateRange(row.date,fromDate,toDate));
      const ledgerRows=(txns||[])
        .filter(tx=>matchesAccountForReconciliation(tx,account.id,account.name))
        .filter(tx=>inDateRange(tx.date,fromDate,toDate));
      const ledgerRowsWithSide=ledgerRows.map(tx=>{
        const isOutgoing=String(tx.accountId||"")===account.id||String(tx.accountName||"")===account.name;
        const isIncoming=String(tx.targetAccountId||"")===account.id||String(tx.targetAccountName||"")===account.name;
        const reconSide=tx.type==="transfer"
          ? (isIncoming&&!isOutgoing?"credit":"debit")
          : tx.type==="income"
            ? "credit"
            : "debit";
        return{...tx,_reconSide:reconSide};
      });
      const next=buildReconciliationResult(statementRows,ledgerRowsWithSide);
      setResult({
        ...next,
        statementRows,
        ledgerRows:ledgerRowsWithSide,
        accountId:account.id,
        accountName:account.name,
      });
      setStatus(`Matched ${next.matched.length}. Statement only ${next.statementOnly.length}. Ledger only ${next.ledgerOnly.length}. Amount mismatches ${next.amountMismatches.length}.`);
    }catch(error){
      setStatus(error?.message||"Reconciliation failed.");
      setResult(null);
    }finally{
      setBusy(false);
    }
  };

  const visibleIssues=(items=[])=>items.filter(item=>!hiddenIssuesRef.current.has(item.id));
  const statementOnly=visibleIssues(result?.statementOnly||[]);
  const ledgerOnly=visibleIssues(result?.ledgerOnly||[]);
  const mismatches=visibleIssues(result?.amountMismatches||[]);
  const matched=result?.matched||[];

  return(<div>
    <R style={{marginBottom:18,gap:10,flexWrap:"wrap"}}>
      <h2 className="h2" style={{flex:1}}>Reconciliation</h2>
      <div style={{fontSize:12,color:"#64748b"}}>All statement values are converted and shown in {baseCurrency}.</div>
    </R>
    <div className="card" style={{marginBottom:18}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
        <div><label>Account</label><select value={accountId} onChange={e=>setAccountId(e.target.value)}><option value="">Select account</option>{accs.map(acc=><option key={acc.id} value={acc.id}>{acc.name}</option>)}</select></div>
        <div><label>Statement From</label><input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)}/></div>
        <div><label>Statement To</label><input type="date" value={toDate} onChange={e=>setToDate(e.target.value)}/></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,alignItems:"end",marginTop:12}}>
        <div>
          <label>Upload Statement</label>
          <input type="file" accept=".csv,.txt,.pdf,.json,.xml,.log,.html" onChange={e=>loadStatementFile(e.target.files?.[0])}/>
        </div>
        <button className="btn ghost" onClick={()=>{setSourceText("");setSourceLabel("");setResult(null);setStatus("");}} disabled={busy||fileBusy}>Clear Statement</button>
      </div>
      {sourceLabel&&<div style={{fontSize:11,color:"#94a3b8",marginTop:8}}>Loaded source: {sourceLabel}</div>}
      <label>Statement Text</label>
      <textarea rows={8} value={sourceText} onChange={e=>setSourceText(e.target.value)} placeholder="Upload a file or paste bank / card / wallet statement text here…"/>
      <div style={{display:"flex",gap:10,marginTop:12}}>
        <button className="btn pri" onClick={runReconciliation} disabled={busy||fileBusy||!accountId||!sourceText.trim()}>{busy?"Reconciling…":"Run Reconciliation"}</button>
      </div>
      {status&&<div style={{fontSize:12,color:"#c7d2fe",marginTop:8}}>{status}</div>}
    </div>

    {result&&<div className="g4" style={{marginBottom:18}}>
      {[{l:"Matched",v:matched.length,c:"#34d399"},{l:"Amount Mismatch",v:mismatches.length,c:"#f59e0b"},{l:"Statement Only",v:statementOnly.length,c:"#38bdf8"},{l:"Ledger Only",v:ledgerOnly.length,c:"#f87171"}].map(card=>(
        <div key={card.l} className="sc"><div className="lxs">{card.l}</div><div className="mono" style={{fontSize:22,color:card.c,marginTop:6}}>{card.v}</div></div>
      ))}
    </div>}

    {mismatches.length>0&&<div className="card" style={{marginBottom:16}}>
      <div className="sh" style={{marginBottom:10}}>Amount Mismatches</div>
      {mismatches.map(issue=>(
        <div key={issue.id} style={{border:"1px solid #3f2d0d",borderRadius:10,padding:12,marginBottom:10,background:"#17110a"}}>
          <div style={{fontWeight:600,marginBottom:6}}>{issue.statementRow.description}</div>
          <div style={{fontSize:12,color:"#94a3b8",lineHeight:1.8}}>
            Statement: {fmt(issue.statementRow.amount)} on {fmtD(issue.statementRow.date)}{currencyMetaLabel(issue.statementRow,baseCurrency)?` · ${currencyMetaLabel(issue.statementRow,baseCurrency)}`:""}
            <br/>
            Ledger: {fmt(issue.ledgerTx.amount)} on {fmtD(issue.ledgerTx.date)} · {issue.ledgerTx.description||issue.ledgerTx.category}
          </div>
          <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
            <button className="btn sm pri" onClick={()=>setEditorRow(issue.statementRow)}>Edit Statement Item</button>
            <button className="btn sm ghost" onClick={()=>onEditLedger?.(issue.ledgerTx)}>Edit Ledger Entry</button>
            <button className="btn sm" style={{background:"#052e16",color:"#34d399"}} onClick={()=>queueStatementRow(issue.statementRow)}>Queue Statement to Inbox</button>
            <button className="btn sm ghost" onClick={()=>hideIssue(issue.id)}>Hide</button>
          </div>
        </div>
      ))}
    </div>}

    {statementOnly.length>0&&<div className="card" style={{marginBottom:16}}>
      <div className="sh" style={{marginBottom:10}}>In Statement But Not In Ledger</div>
      {statementOnly.map(issue=>(
        <div key={issue.id} style={{border:"1px solid #0d2f3f",borderRadius:10,padding:12,marginBottom:10,background:"#09131a"}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
            <div>
              <div style={{fontWeight:600}}>{issue.statementRow.description}</div>
              <div style={{fontSize:12,color:"#94a3b8",marginTop:4}}>
                {fmtD(issue.statementRow.date)} · {fmt(issue.statementRow.amount)}
                {currencyMetaLabel(issue.statementRow,baseCurrency)?` · ${currencyMetaLabel(issue.statementRow,baseCurrency)}`:""}
              </div>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <button className="btn sm pri" onClick={()=>setEditorRow(issue.statementRow)}>Edit & Queue</button>
              <button className="btn sm" style={{background:"#052e16",color:"#34d399"}} onClick={()=>queueStatementRow(issue.statementRow)}>Queue As-Is</button>
              <button className="btn sm ghost" onClick={()=>hideIssue(issue.id)}>Hide</button>
            </div>
          </div>
        </div>
      ))}
    </div>}

    {ledgerOnly.length>0&&<div className="card" style={{marginBottom:16}}>
      <div className="sh" style={{marginBottom:10}}>In Ledger But Not In Statement</div>
      {ledgerOnly.map(issue=>(
        <div key={issue.id} style={{border:"1px solid #3f1010",borderRadius:10,padding:12,marginBottom:10,background:"#150505"}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
            <div>
              <div style={{fontWeight:600}}>{issue.ledgerTx.description||issue.ledgerTx.category}</div>
              <div style={{fontSize:12,color:"#94a3b8",marginTop:4}}>
                {fmtD(issue.ledgerTx.date)} · {fmt(issue.ledgerTx.amount)}
                {currencyMetaLabel(issue.ledgerTx,baseCurrency)?` · ${currencyMetaLabel(issue.ledgerTx,baseCurrency)}`:""}
              </div>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <button className="btn sm ghost" onClick={()=>onEditLedger?.(issue.ledgerTx)}>Edit Ledger Entry</button>
              <button className="btn sm ghost" onClick={()=>hideIssue(issue.id)}>Hide</button>
            </div>
          </div>
        </div>
      ))}
    </div>}

    {matched.length>0&&<div className="card">
      <div className="sh" style={{marginBottom:10}}>Matched Transactions</div>
      {matched.slice(0,30).map(pair=>(
        <div key={pair.id} style={{display:"flex",justifyContent:"space-between",gap:10,padding:"8px 0",borderBottom:"1px solid #1e293b",fontSize:12}}>
          <span style={{color:"#94a3b8"}}>{fmtD(pair.statementRow.date)} · {pair.statementRow.description}</span>
          <span className="mono" style={{color:"#34d399"}}>{fmt(pair.statementRow.amount)}</span>
        </div>
      ))}
      {matched.length>30&&<div style={{fontSize:11,color:"#64748b",marginTop:8}}>Showing first 30 matched rows.</div>}
    </div>}

    {editorRow&&<ReconciliationIssueEditorModal account={account} row={editorRow} acts={acts} cats={cats} onClose={()=>setEditorRow(null)} onSave={(nextRow)=>{queueStatementRow(nextRow);setEditorRow(null);}}/>}
  </div>);
}

// ── REPORTS ───────────────────────────────────────────────────────────────────
function ReportsTab({txns,acts,totInc,totExp}){
  const dr=txns.filter(t=>t.type==="expense"&&t.businessActivity==="Personal");
  const drT=dr.reduce((s,t)=>s+t.amount,0);
  const catMap={};txns.filter(t=>t.type==="expense").forEach(t=>{catMap[t.category]=(catMap[t.category]||0)+t.amount;});
  const cats=Object.entries(catMap).sort((a,b)=>b[1]-a[1]);
  const maxC=cats[0]?.[1]||1;
  const vendorMap={};
  txns
    .filter(t=>t.type==="expense"&&isVendorTracked(t)&&String(t.vendor||"").trim())
    .forEach(t=>{
      const key=String(t.vendor||"").trim();
      vendorMap[key]=(vendorMap[key]||0)+Number(t.amount||0);
    });
  const vendors=Object.entries(vendorMap).sort((a,b)=>b[1]-a[1]);
  const maxV=vendors[0]?.[1]||1;
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
      <div className="card" style={{gridColumn:"1/-1"}}>
        <div style={{fontWeight:600,fontSize:14,marginBottom:14,color:"#94a3b8",borderBottom:"1px solid #1e293b",paddingBottom:10}}>Expenses by Vendor</div>
        {vendors.map(([vendor,amt])=><div key={vendor} style={{marginBottom:8}}><R style={{marginBottom:3}}><span style={{fontSize:12,color:"#94a3b8"}}>{vendor}</span><span className="mono" style={{fontSize:12,color:"#f59e0b"}}>{fmt(amt)}</span></R><div style={{background:"#1e293b",borderRadius:3,height:5,overflow:"hidden"}}><div style={{height:"100%",background:"#f59e0b",borderRadius:3,width:`${(amt/maxV)*100}%`}}/></div></div>)}
        {vendors.length===0&&<div style={{color:"#475569",fontSize:13}}>No tracked vendor expenses yet.</div>}
      </div>
    </div>
  </div>);
}

// ── CLOUD BACKUP TAB (OneDrive) ───────────────────────────────────────────────
function CloudTab({sbCfg,setSbCfg,syncStatus,lastSync,onSync,onLoad,txns,setTxns,inbox,setInbox,accs,setAccs,acts,setActs,cats,setCats,smsNums,setSmsNums,emails,setEmails,addDiagnostic=()=>{}}){
  const[clientId,setClientId]=useState(sbCfg.clientId||"");
  const[connecting,setConnecting]=useState(false);
  const[showGuide,setShowGuide]=useState(false);
  const[versions,setVersions]=useState([]);
  const[loadingVer,setLoadingVer]=useState(false);
  const[exportPrev,setExportPrev]=useState(null);

  const dataSize=()=>(JSON.stringify({txns,inbox,accs,acts,cats,smsNums}).length/1024).toFixed(1)+"KB";

  const connect=async()=>{
    const resolvedClientId=sanitizeMsClientId((clientId||sbCfg.clientId||DEFAULT_MICROSOFT_CLIENT_ID||"").trim());
    if(!resolvedClientId){
      addDiagnostic({level:"warn",scope:"cloud",event:"onedrive_connect_missing_client_id",message:"OneDrive connect was attempted without a Microsoft client ID."});
      alert("Microsoft connector is not configured. Paste your own Azure Application (client) ID here once.");
      return;
    }
    // Persist client ID even if auth popup fails, so Email->Connect Outlook can still use it.
    setSbCfg(p=>({...p,clientId:resolvedClientId,lastError:"",lastErrorAt:""}));
    setConnecting(true);
    addDiagnostic({level:"info",scope:"cloud",event:"onedrive_connect_started",message:"Starting OneDrive OAuth flow."});
    try{
      const account=await odLogin(resolvedClientId);
      const profile=await odGetProfile(resolvedClientId);
      setClientId(resolvedClientId);
      setSbCfg({clientId:resolvedClientId,email:profile.mail||profile.userPrincipalName,name:profile.displayName,enabled:true,needsReconnect:false,lastError:"",lastErrorAt:""});
      addDiagnostic({level:"info",scope:"cloud",event:"onedrive_connect_success",message:"OneDrive account connected.",context:{email:profile.mail||profile.userPrincipalName||""}});
      // Attempt first sync
      await onSync({});
    }catch(e){
      setSbCfg(p=>({...p,lastError:redactSensitiveText(String(e?.message||"Connection failed.")).slice(0,180),lastErrorAt:new Date().toISOString()}));
      addDiagnostic({level:"error",scope:"cloud",event:"onedrive_connect_failed",message:e?.message||"OneDrive connection failed.",context:{error:e}});
      alert("Connection failed: "+e.message);
    }
    setConnecting(false);
  };

  const disconnect=async()=>{
    if(!window.confirm("Disconnect OneDrive? Your data stays in OneDrive — you can reconnect anytime."))return;
    try{if(sbCfg.clientId)await odSignOut(sbCfg.clientId);}catch{}
    setSbCfg({clientId:"",email:"",name:"",enabled:false,needsReconnect:false,lastError:"",lastErrorAt:""});
    addDiagnostic({level:"info",scope:"cloud",event:"onedrive_disconnect",message:"OneDrive was disconnected."});
  };

  const loadVersionHistory=async()=>{
    if(!sbCfg.clientId)return;
    setLoadingVer(true);
    try{
      const v=await odListVersions(sbCfg.clientId);
      setVersions(v);
      addDiagnostic({level:"info",scope:"cloud",event:"onedrive_version_history_loaded",message:`Loaded ${v.length} OneDrive file version(s).`,context:{versions:v.length}});
    }
    catch(e){
      setVersions([]);
      addDiagnostic({level:"warn",scope:"cloud",event:"onedrive_version_history_failed",message:e?.message||"Unable to load OneDrive version history.",context:{error:e}});
    }
    setLoadingVer(false);
  };

  const exportJSON=()=>{
    const payload={exportedAt:new Date().toISOString(),version:4,txns,inbox,accs,acts,cats,smsNums,emailAccounts:emails.map(a=>({...a,token:undefined}))};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);
    a.download=`ledgerai-backup-${today()}.json`;a.click();
    addDiagnostic({level:"info",scope:"backup",event:"manual_backup_exported",message:"Manual JSON backup was downloaded.",context:{txns:txns.length,inbox:inbox.length,accounts:accs.length}});
  };

  const importJSON=(e)=>{
    const file=e.target.files?.[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{
      try{
        setExportPrev(JSON.parse(ev.target.result));
        addDiagnostic({level:"info",scope:"backup",event:"manual_backup_selected",message:"Backup file selected for restore review.",context:{file:file.name||"",size:file.size||0}});
      }catch{
        addDiagnostic({level:"warn",scope:"backup",event:"manual_backup_invalid",message:"Selected backup file was invalid JSON.",context:{file:file.name||"",size:file.size||0}});
        alert("Invalid backup file.");
      }
    };
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
    if(exportPrev.emailAccounts)setEmails(prev=>mergeLoadedEmailsWithLocalTokens(exportPrev.emailAccounts,prev));
    setExportPrev(null);
    addDiagnostic({level:"warn",scope:"backup",event:"manual_backup_restored",message:"Manual backup file restored into the app.",context:{txns:exportPrev.txns?.length||0,inbox:exportPrev.inbox?.length||0,accounts:exportPrev.accs?.length||0}});
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
      {sbCfg.lastError&&(
        <div style={{background:"#1f0b12",border:"1px solid #7f1d1d",borderRadius:10,padding:"12px 16px",marginBottom:16,fontSize:12,color:"#fda4af"}}>
          Last cloud issue{sbCfg.lastErrorAt?` · ${fmtDT(sbCfg.lastErrorAt)}`:""}: {sbCfg.lastError}
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
function SettingsTab({acts,setActs,cats,setCats,backups,onBackupNow,onRestoreBackup,onFactoryReset,onRenameActivity,currencyCfg=defaultCurrencyCfg(),onSaveCurrencyCfg=async()=>({ok:true}),diagnostics=[],onClearDiagnostics=()=>{},buildSupportBundle=()=>null,addDiagnostic=()=>{}}){
  const[newAct,setNewAct]=useState("");const[selAct,setSelAct]=useState(acts[0]||"");
  const[newCN,setNewCN]=useState("");const[newCD,setNewCD]=useState("");
  const[aiLoad,setAiLoad]=useState(false);const[aiSug,setAiSug]=useState(null);
  const[resetOpen,setResetOpen]=useState(false);
  const[resetText,setResetText]=useState("");
  const[safetyStatus,setSafetyStatus]=useState("");
  const[diagStatus,setDiagStatus]=useState("");
  const[restoreId,setRestoreId]=useState("");
  const savedAICfg=loadAICfg();
  const[aiEndpoint,setAiEndpoint]=useState(savedAICfg.endpoint||"");
  const[aiSecret,setAiSecret]=useState(savedAICfg.secret||"");
  const[aiModel,setAiModel]=useState(savedAICfg.model||DEFAULT_AI_MODEL);
  const[aiStatus,setAiStatus]=useState("");
  const[selectedBaseCurrency,setSelectedBaseCurrency]=useState(normalizeCurrencyCode(currencyCfg?.baseCurrency||DEFAULT_BASE_CURRENCY,DEFAULT_BASE_CURRENCY));
  const[currencyStatus,setCurrencyStatus]=useState("");
  const[currencyBusy,setCurrencyBusy]=useState(false);
  const diagCounts=summarizeDiagnostics(diagnostics);
  const recentDiagnostics=[...(diagnostics||[])].slice(-18).reverse();
  const addAct=()=>{if(!newAct.trim())return;const n=newAct.trim();setActs(p=>[...p,n]);setCats(p=>({...p,[n]:[...NEW_ACTIVITY_DEFAULT_CATS]}));setNewAct("");};
  const renameAct=(act)=>{
    const next=window.prompt("Rename business activity",act);
    if(next===null)return;
    const target=next.trim();
    if(!target)return alert("Activity name cannot be empty.");
    if(onRenameActivity){
      const res=onRenameActivity(act,target);
      if(!res?.ok)alert(res?.error||"Unable to rename activity.");
      return;
    }
    setActs(p=>p.map(x=>x===act?target:x));
  };
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
  useEffect(()=>{
    saveAICfgToStorage({endpoint:aiEndpoint,secret:aiSecret,model:aiModel});
  },[aiEndpoint,aiSecret,aiModel]);
  useEffect(()=>{
    setSelectedBaseCurrency(normalizeCurrencyCode(currencyCfg?.baseCurrency||DEFAULT_BASE_CURRENCY,DEFAULT_BASE_CURRENCY));
  },[currencyCfg?.baseCurrency]);
  const saveAICfg=()=>{
    saveAICfgToStorage({endpoint:aiEndpoint,secret:aiSecret,model:aiModel});
    setAiStatus("Saved AI backend settings.");
    addDiagnostic({level:"info",scope:"ai",event:"ai_config_saved",message:"AI backend settings were saved.",context:{endpoint:safeOrigin(aiEndpoint),sharedKeyConfigured:Boolean(aiSecret),model:aiModel||DEFAULT_AI_MODEL}});
  };
  const saveBaseCurrency=async()=>{
    setCurrencyBusy(true);
    setCurrencyStatus("Saving base currency...");
    try{
      const res=await onSaveCurrencyCfg(normalizeCurrencyCode(selectedBaseCurrency,DEFAULT_BASE_CURRENCY));
      if(res?.ok){
        setCurrencyStatus(res?.changed===false?`Base currency remains ${normalizeCurrencyCode(selectedBaseCurrency,DEFAULT_BASE_CURRENCY)}.`:`Base currency saved as ${normalizeCurrencyCode(selectedBaseCurrency,DEFAULT_BASE_CURRENCY)}.`);
      }else{
        setCurrencyStatus(res?.error||"Unable to save base currency.");
      }
    }finally{
      setCurrencyBusy(false);
    }
  };
  const testAICfg=async()=>{
    saveAICfg();
    setAiStatus("Testing AI backend...");
    try{
      const out=await callAI([{role:"user",content:'Reply ONLY this JSON: {"ok":true}'}],120);
      setAiStatus(`AI backend OK: ${out.slice(0,120)}`);
      addDiagnostic({level:"info",scope:"ai",event:"ai_backend_test_success",message:"AI backend test succeeded.",context:{endpoint:safeOrigin(aiEndpoint),model:aiModel||DEFAULT_AI_MODEL}});
    }catch(e){
      setAiStatus(`AI backend error: ${e.message||"unknown error"}`);
      addDiagnostic({level:"error",scope:"ai",event:"ai_backend_test_failed",message:e?.message||"AI backend test failed.",context:{endpoint:safeOrigin(aiEndpoint),model:aiModel||DEFAULT_AI_MODEL,error:e}});
    }
  };
  const canReset=resetText.trim().toLowerCase()==="reset";
  const doReset=()=>{
    if(!canReset)return;
    onFactoryReset?.();
    setResetText("");
    setResetOpen(false);
  };
  const latestBackups=[...(backups||[])].slice(-12).reverse();
  useEffect(()=>{
    if(!restoreId&&latestBackups[0]?.id)setRestoreId(latestBackups[0].id);
  },[latestBackups,restoreId]);
  const copySupportReport=async()=>{
    const bundle=buildSupportBundle?.();
    if(!bundle){
      setDiagStatus("Support bundle unavailable.");
      return;
    }
    const ok=await copyTextToClipboard(buildSupportReportText(bundle));
    setDiagStatus(ok?"Support report copied to clipboard.":"Unable to copy support report.");
    if(ok)addDiagnostic({level:"info",scope:"support",event:"support_report_copied",message:"Support report copied to clipboard."});
  };
  const downloadSupportBundle=()=>{
    const bundle=buildSupportBundle?.();
    if(!bundle){
      setDiagStatus("Support bundle unavailable.");
      return;
    }
    downloadJsonFile(`ledgerai-support-${today()}.json`,bundle);
    setDiagStatus("Support bundle downloaded.");
    addDiagnostic({level:"info",scope:"support",event:"support_bundle_downloaded",message:"Support bundle downloaded from Settings."});
  };
  const clearSupportLogs=()=>{
    if(!window.confirm("Clear all stored diagnostics logs? This removes recent support history from this browser."))return;
    onClearDiagnostics?.();
    setDiagStatus("Diagnostics cleared from this browser.");
  };
  const restoreSelected=()=>{
    if(!restoreId){setSafetyStatus("Select a backup snapshot first.");return;}
    if(!window.confirm("Restore selected snapshot? Current data will be replaced."))return;
    const ok=onRestoreBackup?.(restoreId);
    setSafetyStatus(ok?"Backup restored successfully.":"Backup restore failed.");
    addDiagnostic({level:ok?"warn":"error",scope:"backup",event:"snapshot_restore_action",message:ok?"Backup snapshot restored from Settings.":"Backup snapshot restore failed from Settings.",context:{snapshotId:restoreId}});
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
      <div style={{fontSize:11,color:"#475569",marginTop:8}}>Email sync uses AI-only processing for body + attachments. If AI cannot process an email, it stays in AI Pending Retry until resolved.</div>
    </div>
    <div className="card" style={{marginBottom:16}}>
      <div style={{fontWeight:600,fontSize:14,marginBottom:10,color:"#94a3b8"}}>Currency & FX</div>
      <div style={{fontSize:12,color:"#64748b",lineHeight:1.8,marginBottom:10}}>
        LedgerAI detects source currency from emails, receipts, SMS, and statements, then converts everything into your base currency using daily FX rates. Changing base currency will rebase the amounts already stored in this browser and cloud snapshot.
      </div>
      <label>Base Currency</label>
      <select value={selectedBaseCurrency} onChange={e=>setSelectedBaseCurrency(e.target.value)}>
        {CURRENCY_OPTIONS.map(code=><option key={code} value={code}>{code}</option>)}
      </select>
      <button className="btn pri" style={{marginTop:10}} onClick={saveBaseCurrency} disabled={currencyBusy}>{currencyBusy?"Saving…":"Save Base Currency"}</button>
      {currencyStatus&&<div style={{fontSize:12,color:"#c7d2fe",marginTop:8}}>{currencyStatus}</div>}
      <div style={{fontSize:11,color:"#475569",marginTop:8}}>Current base currency: {normalizeCurrencyCode(currencyCfg?.baseCurrency||DEFAULT_BASE_CURRENCY,DEFAULT_BASE_CURRENCY)}. Foreign-currency metadata is kept in the background for support and reconciliation.</div>
    </div>
    <div className="card" style={{marginBottom:16,background:"linear-gradient(135deg,#0f172a,#09111f)"}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",marginBottom:10,flexWrap:"wrap"}}>
        <div>
          <div style={{fontWeight:700,fontSize:14,color:"#dbeafe"}}>Diagnostics & Support</div>
          <div style={{fontSize:12,color:"#64748b",lineHeight:1.7,marginTop:4}}>
            LedgerAI now keeps a persistent, redacted diagnostics trail in this browser so you can send support logs without reproducing the bug from memory.
          </div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button className="btn ghost" onClick={copySupportReport}>Copy Support Report</button>
          <button className="btn pri" onClick={downloadSupportBundle}>Download Support Bundle</button>
          <button className="btn sm dan" onClick={clearSupportLogs}>Clear Logs</button>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:10,marginBottom:12}}>
        {[
          ["Events",diagCounts.total,"#c7d2fe"],
          ["Errors",diagCounts.errors,"#fca5a5"],
          ["Warnings",diagCounts.warnings,"#fcd34d"],
          ["Info",diagCounts.info,"#86efac"],
        ].map(([label,value,color])=>(
          <div key={label} style={{background:"#0a0f1d",border:"1px solid #1e293b",borderRadius:10,padding:"10px 12px"}}>
            <div style={{fontSize:11,color:"#64748b",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>{label}</div>
            <div style={{fontSize:18,fontWeight:700,color}}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{fontSize:11,color:"#475569",marginBottom:10}}>
        Support bundle includes runtime state, connector status, AI settings status, pending retry summary, and recent diagnostics events. Tokens and secrets are redacted automatically.
      </div>
      {diagStatus&&<div style={{fontSize:12,color:"#c7d2fe",marginBottom:10}}>{diagStatus}</div>}
      <div style={{fontSize:11,fontWeight:700,color:"#64748b",marginBottom:8,textTransform:"uppercase",letterSpacing:".5px"}}>Recent Events</div>
      {recentDiagnostics.length===0?(
        <div style={{fontSize:12,color:"#475569"}}>No diagnostics recorded yet. Once you connect, sync, test AI, or hit an error, entries will appear here.</div>
      ):(
        <div style={{maxHeight:260,overflowY:"auto",border:"1px solid #1e293b",borderRadius:10}}>
          {recentDiagnostics.map(item=>(
            <div key={item.id} style={{padding:"10px 12px",borderBottom:"1px solid #1e293b",background:item.level==="error"?"#1f0b12":item.level==="warn"?"#1f1505":"transparent"}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap",marginBottom:4}}>
                <div style={{fontSize:12,fontWeight:700,color:item.level==="error"?"#fca5a5":item.level==="warn"?"#fcd34d":"#c7d2fe"}}>
                  {String(item.level||"info").toUpperCase()} · {item.scope}/{item.event}
                </div>
                <div style={{fontSize:11,color:"#64748b"}}>{fmtDT(item.ts)}{(item.repeat||1)>1?` · x${item.repeat}`:""}</div>
              </div>
              <div style={{fontSize:12,color:"#e2e8f0",lineHeight:1.6}}>{item.message}</div>
              {(item.accountId||item.provider)&&<div style={{fontSize:11,color:"#64748b",marginTop:4}}>
                {item.accountId&&<span>Account: {item.accountId}</span>}{item.accountId&&item.provider&&<span> · </span>}{item.provider&&<span>Provider: {item.provider}</span>}
              </div>}
            </div>
          ))}
        </div>
      )}
    </div>
    <div className="g2" style={{gap:18}}>
      <div className="card">
        <div style={{fontWeight:600,fontSize:14,marginBottom:14,color:"#94a3b8"}}>Business Activities</div>
        {acts.map(a=><div key={a} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid #1a2438",fontSize:13}}>
          <span>{a}</span>
          <div style={{display:"flex",gap:6}}>
            <button className="btn sm ghost" style={{padding:"2px 8px"}} onClick={()=>renameAct(a)}>✎</button>
            {!DEF_ACTS.includes(a)&&<button className="btn sm dan" onClick={()=>setActs(p=>p.filter(x=>x!==a))}>✕</button>}
          </div>
        </div>)}
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
    <div className="card" style={{marginTop:18}}>
      <div style={{fontWeight:700,fontSize:14,color:"#94a3b8",marginBottom:8}}>Data Protection</div>
      <div style={{fontSize:12,color:"#64748b",lineHeight:1.8,marginBottom:12}}>
        LedgerAI now creates automatic local snapshots so app updates do not erase your working data.
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
        <button className="btn ghost" onClick={()=>{
          const ok=onBackupNow?.();
          setSafetyStatus(ok?"Backup created.":"No data change since last snapshot.");
          addDiagnostic({level:ok?"info":"warn",scope:"backup",event:"manual_snapshot_created",message:ok?"Manual local snapshot created.":"Manual local snapshot skipped because nothing changed."});
        }}>Create Backup Now</button>
      </div>
      {latestBackups.length>0?(
        <>
          <label>Restore Snapshot</label>
          <select value={restoreId} onChange={e=>setRestoreId(e.target.value)}>
            <option value="">Select snapshot</option>
            {latestBackups.map(s=><option key={s.id} value={s.id}>{`${fmtDT(s.ts)} · ${s.reason||"auto"} · txns ${s?.meta?.txns||0} · inbox ${s?.meta?.inbox||0}`}</option>)}
          </select>
          <button className="btn sm dan" style={{marginTop:8}} onClick={restoreSelected}>Restore Selected Snapshot</button>
        </>
      ):<div style={{fontSize:12,color:"#475569"}}>No snapshots yet. A snapshot is created automatically after edits.</div>}
      {safetyStatus&&<div style={{fontSize:12,color:"#c7d2fe",marginTop:8}}>{safetyStatus}</div>}
    </div>
    <div className="card" style={{marginTop:18,border:"1px solid #7f1d1d",background:"#22090b"}}>
      <div style={{fontWeight:700,fontSize:14,color:"#fca5a5",marginBottom:8}}>Danger Zone</div>
      <div style={{fontSize:12,color:"#fda4af",lineHeight:1.8,marginBottom:12}}>
        Factory Reset clears transactions, inbox queue, accounts, and sync caches. Email connectors, AI backend settings, and OneDrive connector settings are preserved.
      </div>
      <button className="btn dan" onClick={()=>setResetOpen(true)}>Reset Dashboard</button>
    </div>
    {resetOpen&&(
      <div className="overlay">
        <div className="modal" style={{maxWidth:520}}>
          <MH title="Factory Reset" onClose={()=>{setResetOpen(false);setResetText("");}}/>
          <div style={{fontSize:13,color:"#fca5a5",lineHeight:1.8,marginBottom:10}}>
            This will permanently remove current ledger data (transactions, inbox, accounts, sync caches) while keeping connected email/cloud configuration.
          </div>
          <div style={{fontSize:12,color:"#94a3b8",marginBottom:8}}>
            Type <code style={{background:"#0a0c12",padding:"2px 6px",borderRadius:4}}>reset</code> and press <b>Enter</b> to confirm.
          </div>
          <input
            autoFocus
            value={resetText}
            onChange={e=>setResetText(e.target.value)}
            placeholder="type reset"
            onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();doReset();}}}
          />
          <div style={{display:"flex",gap:10,marginTop:14}}>
            <button className="btn ghost" style={{flex:1}} onClick={()=>{setResetOpen(false);setResetText("");}}>Cancel</button>
            <button className="btn dan" style={{flex:2,opacity:canReset?1:0.55}} disabled={!canReset} onClick={doReset}>Reset Now</button>
          </div>
        </div>
      </div>
    )}
  </div>);
}

// ── DAILY REVIEW ──────────────────────────────────────────────────────────────
function DailyTab({todayTxns,todInc,todExp,summary,sumLoad,getSummary,onEdit,onDelete}){
  return(<div>
    <R style={{marginBottom:18,gap:10}}>
      <h2 className="h2" style={{flex:1}}>Day Review — {fmtD(today())}</h2>
      <button className="btn sm pri" onClick={getSummary} disabled={sumLoad}>{sumLoad?"🤖 Generating…":"🤖 AI Summary"}</button>
    </R>
    <div className="g4" style={{marginBottom:18}}>
      {[{l:"Today Income",v:todInc,c:"#34d399"},{l:"Today Expense",v:todExp,c:"#f87171"},{l:"Net Today",v:todInc-todExp,c:todInc-todExp>=0?"#34d399":"#f87171"},{l:"Entries",v:todayTxns.length,c:"#818cf8",nf:true}].map(s=>(
        <div key={s.l} className="sc"><div className="lxs">{s.l}</div><div className="mono" style={{fontSize:22,color:s.c,marginTop:6}}>{s.nf?s.v:fmt(s.v)}</div></div>
      ))}
    </div>
    {summary&&<div style={{background:"#0a0c1e",border:"1px solid #6366f1",borderRadius:12,padding:18,marginBottom:18}}><div style={{fontSize:10,color:"#818cf8",fontWeight:700,letterSpacing:".5px",marginBottom:8}}>✦ AI INSIGHT</div><div style={{fontSize:13,color:"#c7d2fe",lineHeight:1.8,whiteSpace:"pre-wrap"}}>{summary}</div></div>}
    <div className="sh" style={{marginBottom:10}}>Today's Transactions</div>
    {todayTxns.length===0?<div className="card" style={{textAlign:"center",color:"#475569",padding:40}}>No transactions today.</div>:<TxTable txns={todayTxns} onEdit={onEdit} onDelete={onDelete}/>}
  </div>);
}

// ── ADD/EDIT MODAL ────────────────────────────────────────────────────────────
function AddModal({type,existing,acts,cats,accs,onAddAccount,onAddActivity,onSave,onClose}){
  const defaultAct=acts.includes("Personal")?"Personal":(acts[0]||"");
  const baseCurrency=getBaseCurrency();
  const[form,setForm]=useState({
    type,date:today(),description:"",vendor:"",amount:"",
    currency:baseCurrency,
    originalAmount:"",
    baseAmount:"",
    baseCurrency,
    fxRate:1,
    fxDate:today(),
    fxRateDate:today(),
    fxSource:"",
    trackVendor:Boolean(existing?.trackVendor ?? existing?.vendor),
    businessActivity:type==="borrow"||type==="transfer"?defaultAct:(acts[0]||""),
    category:type==="borrow"?"Borrowed Cash":type==="transfer"?"Account Transfer":"",
    subCategory:"",
    paymentMethod:type==="borrow"?"Cash":type==="transfer"?"Account Transfer":"UPI",
    accountId:"",targetAccountId:"",liabilityAccountId:"",borrowSource:"",
    notes:"",
    ...existing
  });
  const[raw,setRaw]=useState("");const[imgB64,setImg]=useState(null);const[load,setLoad]=useState(false);const[sub,setSub]=useState("form");
  const[showQuickAct,setShowQuickAct]=useState(false);
  const[quickActName,setQuickActName]=useState("");
  const[showQuickAcc,setShowQuickAcc]=useState(false);
  const[quickAcc,setQuickAcc]=useState({name:"",type:"savings",number:"",bank:"",balance:""});
  const fref=useRef();
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));
  const setAmountValue=v=>setForm(p=>{
    const foreign=normalizeCurrencyCode(p.currency||baseCurrency,baseCurrency)!==baseCurrency;
    return{
      ...p,
      amount:v,
      baseAmount:v,
      originalAmount:foreign?v:(p.originalAmount||v),
      ...(foreign?{
        currency:baseCurrency,
        fxRate:1,
        fxDate:p.date||today(),
        fxRateDate:p.date||today(),
        fxSource:"manual override",
      }:{}),
    };
  });
  const clist=cats[form.businessActivity]||["Other"];
  const assetAccs=accs.filter(a=>a.cls==="asset");
  const liabAccs=accs.filter(a=>a.cls==="liability");
  const quickType=ACC_TYPES.find(x=>x.key===quickAcc.type)||ACC_TYPES[0];
  const legacyBorrowEnabled=form.type==="borrow"||existing?.type==="borrow";
  const tabTypes=["income","expense","transfer",...(legacyBorrowEnabled?["borrow"]:[])];
  const addQuickAccount=()=>{
    if(!onAddAccount)return;
    if(!quickAcc.name.trim())return alert("Enter account name");
    const created=onAddAccount({
      name:quickAcc.name.trim(),
      type:quickAcc.type,
      number:(quickAcc.number||"").trim(),
      bank:(quickAcc.bank||"").trim(),
      balance:Number(quickAcc.balance)||0,
      cls:quickType.cls,
      typeName:quickType.label,
    });
    const newId=created?.id||"";
    if(newId){
      setForm(p=>{
        if(p.type!=="transfer")return {...p,accountId:p.accountId||newId};
        if(!p.accountId)return {...p,accountId:newId};
        if(!p.targetAccountId)return {...p,targetAccountId:newId};
        return p;
      });
    }
    setQuickAcc({name:"",type:"savings",number:"",bank:"",balance:""});
    setShowQuickAcc(false);
  };
  const addQuickActivity=()=>{
    const name=quickActName.trim();
    if(!name)return alert("Enter business activity name.");
    if(!onAddActivity)return;
    const created=onAddActivity(name);
    if(!created?.ok)return alert(created?.error||"Unable to add business activity.");
    if(form.type!=="borrow"&&form.type!=="transfer"){
      const defaultCategory=created.defaultCategory||NEW_ACTIVITY_DEFAULT_CATS[0];
      setForm(p=>({...p,businessActivity:created.name||name,category:defaultCategory}));
    }
    setQuickActName("");
    setShowQuickAct(false);
  };
  const setType=t=>setForm(p=>{
    if(t==="borrow"){
      const src=(p.borrowSource||p.vendor||"").trim();
      return {...p,type:t,businessActivity:defaultAct,category:"Borrowed Cash",subCategory:"",paymentMethod:p.paymentMethod||"Cash",borrowSource:src,vendor:src||p.vendor,trackVendor:false};
    }
    if(t==="transfer"){
      const desc=(p.description||"").trim()||"Account transfer";
      return {...p,type:t,businessActivity:defaultAct,category:"Account Transfer",subCategory:"",paymentMethod:"Account Transfer",description:desc,liabilityAccountId:"",borrowSource:"",vendor:"",trackVendor:false};
    }
    const nextAct=p.businessActivity||acts[0]||"";
    const nextCats=cats[nextAct]||["Other"];
    const nextCat=p.category&&p.category!=="Borrowed Cash"?p.category:(nextCats[0]||"Other");
    return {...p,type:t,businessActivity:nextAct,category:nextCat};
  });
  const apply=async(r)=>{
    if(!r)return;
    const normalized={
      ...r,
      type:form.type,
      date:r.date||form.date||today(),
      amount:Number(r.amount)||0,
      currency:normalizeCurrencyCode(r.currency||baseCurrency,baseCurrency),
    };
    const [converted]=await convertExtractedItemsToBaseCurrency([normalized],{
      baseCurrency,
      fallbackCurrency:baseCurrency,
      dateFallback:normalized.date||today(),
    });
    setForm(p=>({
      ...p,
      description:converted?.description||r.description||p.description,
      vendor:converted?.vendor||r.vendor||p.vendor,
      trackVendor:typeof converted?.trackVendor==="boolean"?converted.trackVendor:(typeof r.trackVendor==="boolean"?r.trackVendor:(p.trackVendor||Boolean((converted?.vendor||r.vendor||p.vendor)||""))),
      amount:converted?.amount??r.amount??p.amount,
      originalAmount:converted?.originalAmount??r.amount??p.originalAmount,
      baseAmount:converted?.baseAmount??converted?.amount??r.amount??p.baseAmount,
      currency:converted?.currency||normalizeCurrencyCode(r.currency||p.currency||baseCurrency,baseCurrency),
      baseCurrency:converted?.baseCurrency||baseCurrency,
      fxRate:converted?.fxRate??p.fxRate,
      fxDate:converted?.fxDate||converted?.date||p.fxDate,
      fxRateDate:converted?.fxRateDate||p.fxRateDate,
      fxSource:converted?.fxSource||p.fxSource,
      businessActivity:acts.includes(converted?.businessActivity||r.businessActivity)?(converted?.businessActivity||r.businessActivity):p.businessActivity,
      category:converted?.category||r.category||p.category,
      subCategory:converted?.subCategory||r.subCategory||p.subCategory||"",
      date:converted?.date||r.date||p.date,
      paymentMethod:converted?.paymentMethod||r.paymentMethod||p.paymentMethod,
      isNewCategory:converted?.isNewCategory||r.isNewCategory||false,
      aiGenerated:true,
    }));
    setSub("form");
  };
  const runText=async()=>{setLoad(true);try{await apply(await aiClassify(raw,acts,cats,form.type));}finally{setLoad(false);}};
  const runImg=async()=>{
    if(!imgB64)return;
    setLoad(true);
    const c2=Object.entries(cats).map(([a,cs])=>`${a}: ${cs.join(", ")}`).join("\n");
    try{
      const raw2=await callAI([{role:"user",content:[{type:"image",source:{type:"base64",media_type:"image/jpeg",data:imgB64}},{type:"text",text:`Extract expense for bookkeeping. Activities: ${acts.join(", ")}\n${c2}\nDetect the original currency explicitly and return ISO currency code. Ledger base currency: ${baseCurrency}\nReturn ONLY JSON: {"businessActivity":"","category":"","isNewCategory":false,"description":"","amount":0,"currency":"","date":"YYYY-MM-DD","vendor":"","paymentMethod":""}`}]}],500);
      try{await apply(JSON.parse(raw2.replace(/```json|```/g,"").trim()));}
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
        <div style={{flex:1}}>
          <div style={{display:"flex",gap:6,marginBottom:4,flexWrap:"wrap"}}>
            {tabTypes.map(t=><button key={t} className={`btn sm ${form.type===t?(t==="income"?"suc":t==="expense"?"dan":""):"ghost"}`} style={form.type===t&&t==="borrow"?{background:"#f59e0b",color:"#fff"}:form.type===t&&t==="transfer"?{background:"#0ea5e9",color:"#fff"}:{}} onClick={()=>{setType(t);if(t==="borrow"||t==="transfer")setSub("form");}}>
              {t==="income"?"+ Income":t==="expense"?"− Expense":t==="transfer"?"⇄ Transfer":"↘ Borrowed"}
            </button>)}
          </div>
          <div style={{fontSize:16,fontWeight:700}}>
            {existing?"Edit":"New"} {form.type==="income"?"Income":form.type==="expense"?"Expense":form.type==="transfer"?"Transfer":"Borrowed Cash"}
          </div>
        </div>
        <button className="btn ghost" onClick={onClose} style={{fontSize:16,padding:"3px 10px"}}>✕</button>
      </R>
      {(form.type==="income"||form.type==="expense")&&<div style={{display:"flex",gap:6,marginBottom:14,borderBottom:"1px solid #1e293b",paddingBottom:12}}>
        {[["form","📝 Manual"],["paste","📋 Text AI"],["invoice","📷 Invoice"]].map(([k,l])=><button key={k} className={`btn sm ${sub===k?"pri":"ghost"}`} onClick={()=>setSub(k)}>{l}</button>)}
      </div>}
      {(form.type==="income"||form.type==="expense")&&sub==="paste"&&<><label>Paste receipt / SMS / email text</label><textarea rows={5} value={raw} onChange={e=>setRaw(e.target.value)} placeholder="Paste any receipt, bank SMS, Kite message…"/><button className="btn pri" style={{marginTop:10,width:"100%"}} onClick={runText} disabled={load||!raw.trim()}>{load?"🤖 Classifying…":"🤖 Auto-fill with AI"}</button></>}
      {(form.type==="income"||form.type==="expense")&&sub==="invoice"&&<><label>Upload invoice image</label><input type="file" ref={fref} accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(!f)return;const rd=new FileReader();rd.onload=()=>setImg(rd.result.split(",")[1]);rd.readAsDataURL(f);}}/>{imgB64&&<img src={`data:image/jpeg;base64,${imgB64}`} style={{width:"100%",borderRadius:8,maxHeight:180,objectFit:"contain",background:"#0f172a",marginTop:8}} alt=""/>}<button className="btn pri" style={{marginTop:10,width:"100%"}} onClick={runImg} disabled={load||!imgB64}>{load?"🤖 Reading…":"🤖 Extract with AI"}</button></>}
      {sub==="form"&&<>
        {accs.length===0&&<div style={{background:"#450a0a",border:"1px solid #f87171",borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:12,color:"#fca5a5"}}>{form.type==="transfer"?"Add at least two accounts (From/To) before saving transfers.":"Add at least one account in the Accounts tab before saving transactions."}</div>}
        {form.aiGenerated&&<div style={{background:"#0a0a1e",border:"1px solid #6366f1",borderRadius:8,padding:"7px 12px",marginBottom:10,fontSize:12,color:"#c7d2fe"}}>✨ AI auto-filled — review all fields</div>}
        {form.isNewCategory&&<div style={{background:"#0d0920",border:"1px solid #a855f7",borderRadius:8,padding:"5px 12px",marginBottom:8,fontSize:12,color:"#d8b4fe"}}>🆕 New category "{form.category}" will be created</div>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><label>Date</label><input type="date" value={form.date} onChange={e=>set("date",e.target.value)}/></div>
          <div><label>{`Amount (${baseCurrency})`}</label><input type="number" value={form.amount} onChange={e=>setAmountValue(e.target.value)} placeholder="0"/></div>
        </div>
        {currencyMetaLabel(form,baseCurrency)&&<div style={{fontSize:11,color:"#94a3b8",marginTop:8}}>{currencyMetaLabel(form,baseCurrency)}</div>}
        {form.type!=="borrow"&&form.type!=="transfer"&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:2}}>
            <label style={{margin:0}}>Business Activity</label>
            <button className="btn sm ghost" type="button" onClick={()=>setShowQuickAct(s=>!s)}>{showQuickAct?"Hide":"+ Add Activity"}</button>
          </div>
          <select value={form.businessActivity} onChange={e=>set("businessActivity",e.target.value)}>{acts.map(a=><option key={a}>{a}</option>)}</select>
          {showQuickAct&&<div style={{background:"#0a0c12",border:"1px solid #1e293b",borderRadius:8,padding:12,marginTop:8}}>
            <label>New Business Activity</label>
            <input value={quickActName} onChange={e=>setQuickActName(e.target.value)} placeholder="e.g. Advisory Services"/>
            <button className="btn pri" type="button" style={{marginTop:10,width:"100%"}} onClick={addQuickActivity}>Add Activity</button>
          </div>}
        </>}
        {form.type!=="borrow"&&form.type!=="transfer"&&<><label>Category</label><select value={form.category} onChange={e=>set("category",e.target.value)}>{clist.map(c=><option key={c}>{c}</option>)}</select></>}
        {form.type!=="borrow"&&form.type!=="transfer"&&<><label>Sub Category</label><input value={form.subCategory||""} onChange={e=>set("subCategory",e.target.value)} placeholder="Optional"/></>}
        {form.type==="borrow"&&<><label>Borrowed From Source</label><input value={form.borrowSource||""} onChange={e=>set("borrowSource",e.target.value)} placeholder="e.g. Rahul, Family, NBFC, Friend"/></>}
        {form.type==="borrow"&&liabAccs.length>0&&<><label>Liability Account (Optional)</label><select value={form.liabilityAccountId||""} onChange={e=>set("liabilityAccountId",e.target.value)}><option value="">— Select liability source —</option>{liabAccs.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></>}
        {form.type==="transfer"&&<>
          <label>Transfer From Account</label>
          <select value={form.accountId||""} onChange={e=>set("accountId",e.target.value)}>
            <option value="">— Select source account —</option>
            {accs.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <label>Transfer To Account</label>
          <select value={form.targetAccountId||""} onChange={e=>set("targetAccountId",e.target.value)}>
            <option value="">— Select destination account —</option>
            {accs.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}>
            <div style={{fontSize:12,color:"#94a3b8"}}>Need a new account? Add it here.</div>
            <button className="btn sm ghost" type="button" onClick={()=>setShowQuickAcc(s=>!s)}>{showQuickAcc?"Hide":"+ Quick Add Account"}</button>
          </div>
          {showQuickAcc&&<div style={{background:"#0a0c12",border:"1px solid #1e293b",borderRadius:8,padding:12,marginTop:8}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div><label>Account Type</label><select value={quickAcc.type} onChange={e=>setQuickAcc(p=>({...p,type:e.target.value}))}>{ACC_TYPES.map(x=><option key={x.key} value={x.key}>{x.label} ({x.cls})</option>)}</select></div>
              <div><label>Account Name</label><input value={quickAcc.name} onChange={e=>setQuickAcc(p=>({...p,name:e.target.value}))} placeholder="e.g. Rahul / New Wallet"/></div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginTop:8}}>
              <div><label>Bank / Institution</label><input value={quickAcc.bank} onChange={e=>setQuickAcc(p=>({...p,bank:e.target.value}))} placeholder="Optional"/></div>
              <div><label>Last 4</label><input value={quickAcc.number} onChange={e=>setQuickAcc(p=>({...p,number:e.target.value}))} placeholder="Optional"/></div>
              <div><label>{`Opening Balance (${baseCurrency})`}</label><input type="number" value={quickAcc.balance} onChange={e=>setQuickAcc(p=>({...p,balance:e.target.value}))} placeholder="0"/></div>
            </div>
            <button className="btn pri" type="button" style={{marginTop:10,width:"100%"}} onClick={addQuickAccount}>Add Account</button>
          </div>}
        </>}
        {form.type!=="transfer"&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:2}}>
            <label style={{margin:0}}>{form.type==="expense"?"Paid From Account":form.type==="income"?"Received In Account":"Received In Account (Cash/Bank)"}</label>
            <button className="btn sm ghost" type="button" onClick={()=>setShowQuickAcc(s=>!s)}>{showQuickAcc?"Hide":"+ Add Account"}</button>
          </div>
          <select value={form.accountId||""} onChange={e=>set("accountId",e.target.value)}>
            <option value="">— Select account —</option>
            {(form.type==="borrow"?assetAccs:accs).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          {showQuickAcc&&<div style={{background:"#0a0c12",border:"1px solid #1e293b",borderRadius:8,padding:12,marginTop:8}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div><label>Account Type</label><select value={quickAcc.type} onChange={e=>setQuickAcc(p=>({...p,type:e.target.value}))}>{ACC_TYPES.map(x=><option key={x.key} value={x.key}>{x.label} ({x.cls})</option>)}</select></div>
              <div><label>Account Name</label><input value={quickAcc.name} onChange={e=>setQuickAcc(p=>({...p,name:e.target.value}))} placeholder="e.g. New Bank / Friend"/></div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginTop:8}}>
              <div><label>Bank / Institution</label><input value={quickAcc.bank} onChange={e=>setQuickAcc(p=>({...p,bank:e.target.value}))} placeholder="Optional"/></div>
              <div><label>Last 4</label><input value={quickAcc.number} onChange={e=>setQuickAcc(p=>({...p,number:e.target.value}))} placeholder="Optional"/></div>
              <div><label>{`Opening Balance (${baseCurrency})`}</label><input type="number" value={quickAcc.balance} onChange={e=>setQuickAcc(p=>({...p,balance:e.target.value}))} placeholder="0"/></div>
            </div>
            <button className="btn pri" type="button" style={{marginTop:10,width:"100%"}} onClick={addQuickAccount}>Add Account</button>
          </div>}
        </>}
        <label>Description</label><input value={form.description} onChange={e=>set("description",e.target.value)} placeholder="Brief description"/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div>
            <label>Vendor</label>
            <input value={form.vendor||""} onChange={e=>set("vendor",e.target.value)} placeholder={form.trackVendor?"Vendor name required":"Optional"}/>
          </div>
          <div><label>Payment Method</label><select value={form.paymentMethod} onChange={e=>set("paymentMethod",e.target.value)}>{PAY_METHODS.map(m=><option key={m}>{m}</option>)}</select></div>
        </div>
        {(form.type==="income"||form.type==="expense")&&<div style={{marginTop:10}}>
          <label style={{display:"flex",gap:8,alignItems:"center",fontSize:13,color:"#94a3b8",textTransform:"none",letterSpacing:0,marginTop:0}}>
            <input type="checkbox" checked={Boolean(form.trackVendor)} onChange={e=>set("trackVendor",e.target.checked)}/>
            Track this vendor in vendor-wise reports
          </label>
          <div style={{fontSize:11,color:"#64748b",marginTop:6}}>
            If enabled, vendor name becomes mandatory and the expense can appear in vendor-wise reporting. If disabled, vendor remains optional and is excluded from vendor-wise reports.
          </div>
        </div>}
        <label>Notes</label><textarea rows={2} value={form.notes||""} onChange={e=>set("notes",e.target.value)} placeholder="Optional"/>
        {Number(form.amount)>0&&<div style={{marginTop:12,background:"#0a0c12",border:"1px solid #1e293b",borderRadius:8,padding:12}}><div className="lxs" style={{marginBottom:8}}>Journal Preview</div>
          {je.map((e,i)=><div key={i} style={{display:"grid",gridTemplateColumns:"1fr 90px 90px",gap:6,fontSize:12,color:"#94a3b8",padding:"2px 0"}}><span style={{color:e.dr>0?"#e2e8f0":"#64748b",paddingLeft:e.dr===0?16:0}}>{e.account}</span><span className="mono" style={{textAlign:"right",color:"#34d399"}}>{e.dr>0?fmt(e.dr):""}</span><span className="mono" style={{textAlign:"right",color:"#f87171"}}>{e.cr>0?fmt(e.cr):""}</span></div>)}
        </div>}
        <div style={{display:"flex",gap:10,marginTop:16}}>
          <button className="btn ghost" onClick={onClose} style={{flex:1}}>Cancel</button>
          <button className="btn pri" style={{flex:2}} onClick={()=>{
            const amt=Number(form.amount);
            const sourceCurrency=normalizeCurrencyCode(form.currency||baseCurrency,baseCurrency);
            const currencyPatch={
              currency:sourceCurrency,
              originalAmount:roundMoney(Number(form.originalAmount??amt)||amt),
              baseAmount:roundMoney(amt),
              baseCurrency,
              fxRate:Number(form.fxRate)||1,
              fxDate:normalizeFxDate(form.fxDate||form.date||today()),
              fxRateDate:normalizeFxDate(form.fxRateDate||form.fxDate||form.date||today()),
              fxSource:String(form.fxSource||"manual"),
            };
            const validationMsg=getAccountingValidationMessage({...form,amount:amt},accs);
            if(validationMsg)return alert(validationMsg);
            if(form.type==="transfer"){
              const fromName=accs.find(a=>a.id===form.accountId)?.name||"Source";
              const toName=accs.find(a=>a.id===form.targetAccountId)?.name||"Destination";
              const desc=(form.description||"").trim()||`Transfer: ${fromName} → ${toName}`;
              onSave({...form,...currencyPatch,amount:amt,type:"transfer",description:desc,businessActivity:defaultAct,category:"Account Transfer",paymentMethod:"Account Transfer",isNewCategory:false,vendor:form.vendor||""});
              return;
            }
            if(form.type==="borrow"){
              const src=(form.borrowSource||form.vendor||"").trim();
              const desc=(form.description||"").trim()||`Cash borrowed from ${src||"Other source"}`;
              onSave({...form,...currencyPatch,amount:amt,type:"borrow",description:desc,borrowSource:src,vendor:src||form.vendor||"",businessActivity:defaultAct,category:"Borrowed Cash",isNewCategory:false});
              return;
            }
            onSave({...form,...currencyPatch,amount:amt,type:form.type});
          }}>{existing?"Update Entry":`Save ${form.type==="income"?"Income":form.type==="expense"?"Expense":form.type==="transfer"?"Transfer":"Borrowed Cash"}`}</button>
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
            {tx.subCategory&&<span>{tx.subCategory}</span>}
            {tx.vendor&&<span>{tx.vendor}</span>}
            {tx.paymentMethod&&<span>· {tx.paymentMethod}</span>}
            {tx.type==="transfer"
              ? <span>· {tx.accountName||"From"} → {tx.targetAccountName||"To"}</span>
              : tx.accountName&&<span>· {tx.accountName}</span>}
            {tx.borrowSource&&<span>· from {tx.borrowSource}</span>}
            {currencyMetaLabel(tx)&&<span>· {currencyMetaLabel(tx)}</span>}
            {tx.source==="email"&&<span style={{background:"#1a2010",color:"#86efac",padding:"0 4px",borderRadius:3,fontSize:10}}>📧</span>}
            {tx.source==="auto"&&<span style={{background:"#1e1b4b",color:"#818cf8",padding:"0 4px",borderRadius:3,fontSize:10}}>AI</span>}
            {tx.source==="statement"&&<span style={{background:"#052e16",color:"#34d399",padding:"0 4px",borderRadius:3,fontSize:10}}>Stmt</span>}
          </div>
        </div>
        <span style={{fontSize:11,color:tx.businessActivity==="Personal"?"#c084fc":"#64748b"}}>{tx.businessActivity}</span>
        <span style={{fontSize:11,color:"#64748b"}}>{tx.category}{tx.subCategory?` / ${tx.subCategory}`:""}</span>
        <span className="mono" style={{fontWeight:700,color:tx.type==="income"?"#34d399":tx.type==="borrow"?"#f59e0b":tx.type==="transfer"?"#38bdf8":"#f87171"}}>{tx.type==="income"?"+":tx.type==="borrow"?"↘":tx.type==="transfer"?"⇄":"−"}{fmt(tx.amount)}</span>
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
.tincome{background:#052e16;color:#34d399}.texpense{background:#450a0a;color:#f87171}.tborrow{background:#422006;color:#f59e0b}.ttransfer{background:#082f49;color:#38bdf8}
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
