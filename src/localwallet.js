// ============================================================================
// 浏览器内钱包（local wallet）
// ----------------------------------------------------------------------------
// 为什么需要它：
//   手机浏览器里没有 window.ethereum，要把手机里的钱包 App 拉起来就必须离开
//   浏览器；而用户要的是「授权弹窗出现在网页里，全程不切 App」。这两件事
//   在移动端无法同时成立 —— 私钥在 App 里，签名确认框就必须由 App 渲染。
//
//   唯一能做到「弹窗在网页里」的形态，是私钥本身就在这个网页里。所以这里
//   生成一个本地钱包，用用户设置的 6 位 PIN 加密后存在 localStorage，签名在
//   浏览器内完成。用户看到的就是一个网页弹框，点确认，交易就发出去了。
//
// 为什么是裸私钥而不是助记词：
//   这个钱包只服务一件事 —— 在网页里签发行/销毁两笔交易。助记词的额外价值
//   是「一个种子派生无数地址」，而这里要的是「一个地址、一把钥匙、能导出来」。
//   裸私钥更短、更容易手抄，任何钱包都能直接导入，也不会让用户误以为这是一
//   个可以当主钱包用的 HD 钱包。
//
// 多账户：
//   一个 PIN 保护一个 vault，vault 里挂 N 个账户，每个账户各自一条密文。
//   PIN 只在解锁时派生一次密钥（PBKDF2 21 万轮，很贵），之后切账户用内存里
//   的 CryptoKey 解对应那条密文，不需要再输 PIN。刷新页面后内存清空，必须
//   重新输一次 PIN —— 这是刻意的：解密后的私钥绝不留到磁盘。
//
// 为什么做成 EIP-1193：
//   tx.js 的设计是「钱包只接收预填好的 eth_sendTransaction，负责签名」。
//   只要本地钱包长得像一个 provider，App 其余部分一行都不用改 —— 包括
//   余额刷新、nonce 管理、回执轮询。
// ============================================================================

import { rpcCall } from './chain';

// 沿用 v1 的键名：老用户存的是助记词版本，读出来能当场迁移成私钥版本，
// 换键名等于把他们钱包丢在原地。
const STORE_KEY = 'ufo.local.wallet.v1';
// 「私钥已经保存过」的标记。它不参与签名，只用来决定要不要在界面上继续提醒。
const BACKUP_KEY = 'ufo.local.backedUp';
const PBKDF2_ROUNDS = 210000;
const CHAIN_ID = 56;
const CHAIN_HEX = '0x38';

// ---------------------------------------------------------------------------
// 编解码小工具
// ---------------------------------------------------------------------------
const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(bytes) {
  let s = '';
  const b = new Uint8Array(bytes);
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}

function fromB64(str) {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function toHex(bytes) {
  let s = '0x';
  const b = new Uint8Array(bytes);
  for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, '0');
  return s;
}

function randHex(nbytes) {
  return toHex(crypto.getRandomValues(new Uint8Array(nbytes))).slice(2);
}

async function deriveKey(pin, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ROUNDS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function badPin() {
  const err = new Error('Wrong PIN.');
  err.code = 'BAD_PIN';
  return err;
}

// ---------------------------------------------------------------------------
// 存储
// ---------------------------------------------------------------------------
// v2 布局：
//   { v: 2, salt, active, nextNo, accounts: [{ id, no, address, iv, ct, at }] }
// salt 是 vault 级的：同一个 PIN + 同一把 salt 派生出同一把密钥，
// 每个账户只用自己的 iv，不必每次切账户都跑一遍 21 万轮 PBKDF2。
//
// no 是账户的**永久编号**：创建时分配，写进记录，之后永不改、永不复用。
// 它不能由数组下标推导 —— 删掉账户 1 之后，账户 2 的下标会变成 0，
// 用下标渲染就会让同一个账户改名叫「账户 1」，授权、对账、客服沟通全部错位。
// 编号出现空洞（1、3）是正常的，银行账号、数据库自增主键都是这个语义。
// nextNo 单调递增，删除后也不回退，保证编号不被新账户复用。
function normalizeNos(o) {
  let dirty = false;
  let max = 0;
  o.accounts.forEach((a) => {
    if (Number.isInteger(a.no) && a.no > 0) max = Math.max(max, a.no);
  });

  let seq = max;
  o.accounts.forEach((a) => {
    if (!(Number.isInteger(a.no) && a.no > 0)) {
      // 老记录（本字段上线前创建的）按当时的存储顺序补号，补完即固定。
      seq += 1;
      a.no = seq;
      dirty = true;
    }
  });

  if (!Number.isInteger(o.nextNo) || o.nextNo <= max) {
    o.nextNo = max + 1;
    dirty = true;
  }
  return dirty;
}

// 存储写不进去时的兜底：Safari 无痕模式、部分 WebView 的「只读 localStorage」、
// 以及配额写满，都会让 setItem 抛 QuotaExceededError。钱在链上，账户在本机，
// 这种情况下「切了但没记住」远好过「点了没反应」—— 至少本次会话是对的，
// 刷新后回到上一个账户，而不是把人卡死在切换按钮上。
let memActive = null;

function read() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o) return null;

    if (o.v === 2 && Array.isArray(o.accounts) && o.accounts.length && o.salt) {
      if (memActive && o.accounts.some((a) => a.id === memActive)) o.active = memActive;
      else if (!o.accounts.some((a) => a.id === o.active)) o.active = o.accounts[0].id;
      // 一次性补号，之后就是只读。写回失败（无痕模式 / 配额满）不能影响读取，
      // 否则一个存储错误就等于「钱包不见了」。
      if (normalizeNos(o)) {
        try { write(o); } catch (e) { /* 下次再补 */ }
      }
      return o;
    }

    // v1（助记词版）：先包成 v2 的形状让上层照常读，等第一次解锁时再真迁移。
    if (o.v === 1 && o.address && o.ct && o.salt && o.iv) {
      return {
        v: 2,
        salt: o.salt,
        active: 'legacy',
        nextNo: 2,
        accounts: [{ id: 'legacy', no: 1, address: o.address, iv: o.iv, ct: o.ct, at: o.at, mnemonic: true }],
        legacy: true
      };
    }
    return null;
  } catch (e) {
    return null;
  }
}

function write(obj) {
  localStorage.setItem(STORE_KEY, JSON.stringify(obj));
}

/** 是否已经创建过（只看本地有没有记录，不需要 PIN） */
export function hasLocalWallet() {
  return !!read();
}

/** 当前账户地址（明文存的，只用于界面显示） */
export function localAddress() {
  const o = read();
  if (!o) return null;
  const a = o.accounts.find((x) => x.id === o.active) || o.accounts[0];
  return a ? a.address : null;
}

/** 账户列表（只有地址与永久编号，没有密钥）。按编号升序，与存储顺序无关。 */
export function localAccounts() {
  const o = read();
  if (!o) return [];
  return o.accounts
    .map((a) => ({ id: a.id, no: a.no, address: a.address }))
    .sort((x, y) => x.no - y.no);
}

/** 某个账户的永久编号。找不到时返回 null，调用方不要拿下标兜底。 */
export function accountNo(id) {
  const o = read();
  if (!o) return null;
  const a = o.accounts.find((x) => x.id === (id || o.active));
  return a ? a.no : null;
}

export function activeAccountId() {
  const o = read();
  return o ? o.active : null;
}

/** 私钥是否已经被用户保存过 */
export function hasBackedUp() {
  try { return localStorage.getItem(BACKUP_KEY) === '1'; } catch (e) { return false; }
}

export function markBackedUp() {
  try { localStorage.setItem(BACKUP_KEY, '1'); } catch (e) { /* 无痕模式 */ }
}

/** 彻底删除（私钥无法恢复，UI 必须二次确认） */
export function destroyLocalWallet() {
  try { localStorage.removeItem(STORE_KEY); } catch (e) { /* noop */ }
  try { localStorage.removeItem(BACKUP_KEY); } catch (e) { /* noop */ }
  session = null;
  memActive = null;
}

// ---------------------------------------------------------------------------
// 会话：只在内存里，刷新即失效
// ---------------------------------------------------------------------------
// key 是 PBKDF2 派生出的 AES-GCM CryptoKey（extractable = false）。
// cache 是已解密的账户：切账户时免去重复解密，但绝不落盘。
let session = null; // { key, salt, cache: { [id]: Wallet }, active }

async function decryptWallet(acct, key) {
  const { Wallet } = await import('ethers/wallet');
  let plain;
  try {
    plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(acct.iv) }, key, fromB64(acct.ct)
    );
  } catch (e) {
    // AES-GCM 认证失败只会以这种方式暴露：PIN 不对就是这里抛。
    throw badPin();
  }
  const text = dec.decode(plain);
  // v1 账户里存的是 12 个词，迁移后才是私钥
  return acct.mnemonic ? Wallet.fromPhrase(text.trim()) : new Wallet(text);
}

async function encryptPrivateKey(privateKey, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(privateKey));
  return { iv: toB64(iv), ct: toB64(ct) };
}

/**
 * 用 PIN 打开 vault。成功返回 { key, store }（store 可能是刚迁移出来的）。
 * 失败抛 BAD_PIN，或 NO_WALLET。
 */
async function openVault(pin) {
  const store = read();
  if (!store) {
    const err = new Error('No wallet on this browser yet.');
    err.code = 'NO_WALLET';
    throw err;
  }

  const key = await deriveKey(String(pin || ''), fromB64(store.salt));

  if (!store.legacy) {
    const acct = store.accounts.find((a) => a.id === store.active) || store.accounts[0];
    await decryptWallet(acct, key); // 只为验证 PIN
    return { key, store };
  }

  // ---- v1 → v2 迁移：解出助记词，取出私钥，用新 iv 重新加密 ----
  const legacy = store.accounts[0];
  const w = await decryptWallet(legacy, key);
  const packed = await encryptPrivateKey(w.privateKey, key);
  const newId = legacy.id === 'legacy' ? randHex(8) : legacy.id;
  const migrated = {
    v: 2,
    salt: store.salt,
    active: newId,
    nextNo: 2,
    accounts: [{
      id: newId,
      no: legacy.no || 1,
      address: w.address,
      iv: packed.iv,
      ct: packed.ct,
      at: legacy.at || Date.now()
    }]
  };
  write(migrated);
  return { key, store: migrated };
}

function startSession(key, store) {
  session = { key, salt: store.salt, cache: {}, active: store.active };
  return session;
}

/** 把一个已构造好的 Wallet 挂到 vault 上（新建和导入共用） */
async function attachAccount(w, pin) {
  const store = read();
  let key;
  let salt;

  if (session) {
    // 已解锁：直接用内存里的密钥，不用再输 PIN
    key = session.key;
    salt = store ? store.salt : null;
  } else if (store) {
    const opened = await openVault(pin);
    key = opened.key;
    salt = opened.store.salt;
  } else {
    // 全新 vault：这一次的 PIN 就是以后的开锁密码
    if (String(pin || '').length < 6) {
      const err = new Error('Set a 6-digit PIN first.');
      err.code = 'NO_PIN';
      throw err;
    }
    const raw = crypto.getRandomValues(new Uint8Array(16));
    salt = toB64(raw);
    key = await deriveKey(String(pin), raw);
  }

  // openVault 迁移时已经把 v2 记录写回去了，这里读到的就是最新形状。
  const base = read() || { v: 2, salt, accounts: [], active: null, nextNo: 1 };

  // 地址不是另起的随机串：它由这把私钥经 secp256k1 公钥 + keccak256 推导。
  // 这里显式再验一次，防止以后有人为了「快一点」把地址和私钥分开生成 ——
  // 那样得到的是一把打不开任何地址的私钥，用户资产会直接打进去再也拿不出来。
  const { Wallet: Check } = await import('ethers/wallet');
  if (new Check(w.privateKey).address !== w.address) {
    throw new Error('Key and address do not match.');
  }

  const packed = await encryptPrivateKey(w.privateKey, key);
  // 编号同时受 nextNo 与「现有最大编号」约束：即使记录被外部改过，
  // 也不会出现两个账户共用一个编号。
  const maxNo = base.accounts.reduce((m, a) => (Number.isInteger(a.no) && a.no > m ? a.no : m), 0);
  const no = Math.max(base.nextNo || 1, maxNo + 1);
  const acct = {
    id: randHex(8),
    no,
    address: w.address,
    iv: packed.iv,
    ct: packed.ct,
    at: Date.now()
  };

  const next = {
    v: 2,
    salt: base.salt || salt,
    accounts: base.accounts.concat([acct]),
    active: acct.id,
    // 编号只增不减：删掉的号不会发给下一个新账户。
    nextNo: no + 1
  };
  write(next);

  if (!session) startSession(key, next);
  session.cache[acct.id] = w;
  session.active = acct.id;
  memActive = acct.id;

  return { id: acct.id, address: w.address, privateKey: w.privateKey };
}

function makeRandomWallet(Wallet) {
  // 32 字节随机数就是一把 secp256k1 私钥；极小概率越界，越界就重摇。
  for (let i = 0; i < 8; i++) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    try {
      return new Wallet(toHex(bytes));
    } catch (e) { /* 非法标量，重来 */ }
  }
  throw new Error('Could not generate a key on this device.');
}

// ---------------------------------------------------------------------------
// 创建 / 导入 / 解锁 / 切账户 / 导出
// ---------------------------------------------------------------------------

/**
 * 生成一个新账户（私钥类型）。
 * 返回 { address, privateKey, id } —— 私钥只在这一次和「查看私钥」时出现。
 * 已经有 vault 且已解锁时 pin 可以不传；否则必须传 PIN。
 */
export async function createLocalWallet(pin) {
  const { Wallet } = await import('ethers/wallet');
  return attachAccount(makeRandomWallet(Wallet), pin);
}

/** 导入已有的私钥（0x 开头可省略，必须是 64 位十六进制） */
export async function importLocalWallet(privateKey, pin) {
  const { Wallet } = await import('ethers/wallet');
  const hex = String(privateKey || '').trim().replace(/^0x/i, '').replace(/\s+/g, '');
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    const err = new Error('A private key is 64 hex characters.');
    err.code = 'BAD_KEY';
    throw err;
  }

  let w;
  try {
    w = new Wallet('0x' + hex);
  } catch (e) {
    const err = new Error('That private key is not valid.');
    err.code = 'BAD_KEY';
    throw err;
  }

  const store = read();
  if (store && store.accounts.some((a) => a.address.toLowerCase() === w.address.toLowerCase())) {
    const err = new Error('This account is already in your wallet.');
    err.code = 'DUP';
    throw err;
  }

  return attachAccount(w, pin);
}

/** 用 PIN 解密，成功则建立内存会话 */
export async function unlockLocalWallet(pin) {
  const { key, store } = await openVault(pin);
  const s = startSession(key, store);
  const acct = store.accounts.find((a) => a.id === store.active) || store.accounts[0];
  const w = await decryptWallet(acct, key);
  s.cache[acct.id] = w;
  memActive = acct.id;
  return { address: w.address, id: acct.id, no: acct.no };
}

/**
 * 删除一个账户（只删本机的密文，链上资产不受影响）。
 * 删掉最后一个账户等于删掉整个钱包。
 */
export function removeAccount(id) {
  const store = read();
  if (!store) return { removed: false, remaining: 0 };
  if (!store.accounts.some((a) => a.id === id)) {
    return { removed: false, remaining: store.accounts.length };
  }

  const accounts = store.accounts.filter((a) => a.id !== id);
  if (session) delete session.cache[id];

  if (!accounts.length) {
    destroyLocalWallet();
    return { removed: true, remaining: 0, empty: true };
  }

  const active = store.active === id ? accounts[0].id : store.active;
  // nextNo 原样带走：删除账户不能让编号回退，否则新账户会顶替旧名字。
  try { write({ v: 2, salt: store.salt, nextNo: store.nextNo, accounts, active }); } catch (e) { /* 见 memActive */ }
  if (session) session.active = active;
  memActive = active;
  return { removed: true, remaining: accounts.length, active };
}

/**
 * 切到另一个账户。已解锁时不需要 PIN；未解锁会抛 4100。
 *
 * 顺序是刻意的：先解密（这一步可能因为密钥缺失/损坏而失败），成功之后才改
 * session 与存储。反过来的话，一次解密失败就会留下「存储指向新账户、内存
 * 仍是旧账户」的分裂状态，之后每一次签名都会报「钱包已锁定」，重启才恢复。
 */
export async function switchAccount(id) {
  if (!session) {
    const err = new Error('Enter your PIN to switch accounts.');
    err.code = 4100;
    throw err;
  }
  const store = read();
  if (!store) {
    const err = new Error('No wallet on this browser yet.');
    err.code = 'NO_WALLET';
    throw err;
  }
  const acct = store.accounts.find((a) => a.id === id);
  if (!acct) throw new Error('Unknown account.');

  let w = session.cache[id];
  if (!w) {
    w = await decryptWallet(acct, session.key);
    session.cache[id] = w;
  }
  if (w.address.toLowerCase() !== acct.address.toLowerCase()) {
    // 密文和地址对不上：不是这个账户的钥匙。宁可报错，也不能让签名落到别的地址上。
    throw new Error('This account could not be opened on this device.');
  }

  session.active = id;
  memActive = id;
  store.active = id;
  try {
    write(store);
  } catch (e) {
    // 写入失败不回滚：本次会话已经切了，刷新后会回到原账户并重新输 PIN。
    console.warn('[ufo] could not persist the active account:', e && e.message);
  }
  return { id, address: w.address, no: acct.no };
}

/** 当前会话锁定的账户 id（内存），供 UI 在存储不可写时也能拿到正确值 */
export function sessionActive() {
  return session ? session.active : null;
}

/**
 * 查看 / 导出私钥。**每次都要输 PIN**：这是唯一能拿到明文私钥的入口，
 * 不能因为「已经解锁」就放行 —— 解锁是持续状态，看私钥是一次性动作。
 */
export async function exportPrivateKey(pin, id) {
  const store = read();
  if (!store) {
    const err = new Error('No wallet on this browser yet.');
    err.code = 'NO_WALLET';
    throw err;
  }
  const key = await deriveKey(String(pin || ''), fromB64(store.salt));
  const acct = store.accounts.find((a) => a.id === (id || store.active)) || store.accounts[0];
  const w = await decryptWallet(acct, key);
  return w.privateKey;
}

export function lockLocalWallet() {
  session = null;
}

export function isUnlocked() {
  return !!session;
}

// ---------------------------------------------------------------------------
// EIP-1193 provider
// ---------------------------------------------------------------------------
// 只实现 App 实际会用到的方法。tx.js 已经把 nonce / gas / gasPrice 全部算好，
// 所以这里不需要 RPC 回查，签名、广播、返回 hash 就结束。
function makeProvider() {
  const listeners = {};

  const emit = (event, payload) => {
    (listeners[event] || []).forEach((fn) => { try { fn(payload); } catch (e) { /* noop */ } });
  };

  // 当前账户的 Wallet。缓存里没有就按需解一次 —— 删掉当前账户后
  // 新的当前账户还没解过，不解就会让签名报「wallet is locked」。
  const activeWallet = async () => {
    if (!session) return null;
    const cached = session.cache[session.active];
    if (cached) return cached;

    const store = read();
    const acct = store && store.accounts.find((a) => a.id === session.active);
    if (!acct) return null;
    const w = await decryptWallet(acct, session.key);
    session.cache[session.active] = w;
    return w;
  };

  return {
    isLocalWallet: true,
    isMetaMask: false,

    async request({ method, params }) {
      if (!session) {
        const err = new Error('Wallet is locked.');
        err.code = 4100;
        throw err;
      }
      const wallet = await activeWallet();
      if (!wallet) {
        const err = new Error('Wallet is locked.');
        err.code = 4100;
        throw err;
      }

      switch (method) {
        case 'eth_requestAccounts':
        case 'eth_accounts':
          return [wallet.address];

        case 'eth_chainId':
          return CHAIN_HEX;

        case 'net_version':
          return String(CHAIN_ID);

        case 'wallet_switchEthereumChain':
        case 'wallet_addEthereumChain':
          // 只有一个网络，切换请求直接视为成功
          return null;

        case 'personal_sign': {
          // 参数顺序两家不一致：有的是 [data, address]，有的是 [address, data]
          const a = params[0];
          const b = params[1];
          const msgHex = /^0x[0-9a-fA-F]*$/.test(a) ? a : b;
          const who = /^0x[0-9a-fA-F]{40}$/.test(a) ? a : b;
          assertSameAccount(who, wallet.address);
          return wallet.signMessage(new Uint8Array(fromB64Hex(msgHex)));
        }

        case 'eth_signTypedData_v4': {
          const { TypedDataEncoder } = await import('ethers/hash');
          const typed = typeof params[1] === 'string' ? JSON.parse(params[1]) : params[1];
          const { domain, types, message } = typed;
          // ethers 不接受自定义的 EIP712Domain 字段定义
          const clean = Object.assign({}, types);
          delete clean.EIP712Domain;
          const digest = TypedDataEncoder.hash(domain, clean, message);
          return wallet.signingKey.sign(digest).serialized;
        }

        case 'eth_sendTransaction': {
          const tx = params[0] || {};
          // 切账户之后最容易出的错，是页面还拿着旧地址去签新账户的余额：
          // 签名会成功，但花的是另一个地址的钱。这里直接拦下来。
          assertSameAccount(tx.from, wallet.address);
          const raw = await wallet.signTransaction({
            to: tx.to,
            data: tx.data || tx.input || '0x',
            value: tx.value ? BigInt(tx.value) : 0n,
            nonce: tx.nonce ? Number(BigInt(tx.nonce)) : undefined,
            gasLimit: tx.gas ? BigInt(tx.gas) : undefined,
            gasPrice: tx.gasPrice ? BigInt(tx.gasPrice) : undefined,
            chainId: CHAIN_ID
          });
          const hash = await rpcCall('eth_sendRawTransaction', [raw]);
          emit('accountsChanged', [wallet.address]);
          return hash;
        }

        default:
          throw new Error(`Local wallet does not support ${method}.`);
      }
    },

    on(event, fn) {
      (listeners[event] = listeners[event] || []).push(fn);
    },

    removeListener(event, fn) {
      listeners[event] = (listeners[event] || []).filter((x) => x !== fn);
    }
  };
}

function assertSameAccount(from, actual) {
  if (!from) return; // 交易没带 from 时以当前账户为准
  if (String(from).toLowerCase() !== String(actual).toLowerCase()) {
    throw new Error('This request is for a different account. Switch back and try again.');
  }
}

function fromB64Hex(hex) {
  const h = String(hex || '').replace(/^0x/, '');
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
  return out;
}

/**
 * 建立连接：已经解锁就直接给 provider，否则先解锁。
 * 返回的形态和注入式钱包一致，useWallet 那边不需要区分。
 */
export async function connectLocalWallet(pin) {
  if (!session) await unlockLocalWallet(pin);
  return { accounts: [localAddress()], provider: makeProvider() };
}

/** 页面刷新后重新回到已连接状态用：不弹 PIN，但 provider 是锁住的 */
export function restoreLocalWallet() {
  const addr = localAddress();
  if (!addr) return null;
  return { accounts: [addr], provider: makeProvider() };
}
