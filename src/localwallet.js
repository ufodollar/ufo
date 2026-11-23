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
// 代价必须说清楚（UI 上也要说）：
//   这是一个**新地址**，跟用户手机里其他钱包的地址不是同一个。要发行
//   UFO，得先往这个地址转 USDT。清掉浏览器数据 = 私钥丢失，所以创建时
//   强制展示助记词，之后还可以用 PIN 重新导出。
//
// 为什么做成 EIP-1193：
//   tx.js 的设计是「钱包只接收预填好的 eth_sendTransaction，负责签名」。
//   只要本地钱包长得像一个 provider，App 其余部分一行都不用改 —— 包括
//   余额刷新、nonce 管理、回执轮询。
// ============================================================================

import { rpcCall } from './chain';

const STORE_KEY = 'ufo.local.wallet.v1';
// 「助记词已经抄下来了」的标记。它不参与签名，只用来决定要不要在界面上
// 继续提醒 —— 没抄的人一旦清了浏览器数据，这个钱包就再也回不来了。
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

// ---------------------------------------------------------------------------
// 存储
// ---------------------------------------------------------------------------
function read() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || obj.v !== 1 || !obj.address || !obj.ct) return null;
    return obj;
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

/** 地址是明文存的，用于界面显示，不涉及私钥 */
export function localAddress() {
  const o = read();
  return o ? o.address : null;
}

/** 助记词是否已经被用户确认抄写过 */
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
}

// ---------------------------------------------------------------------------
// 创建 / 导入 / 解锁
// ---------------------------------------------------------------------------
let session = null; // { wallet, address } —— 只在内存里，刷新即失效

function wordlistOk(phrase) {
  return typeof phrase === 'string' && phrase.trim().split(/\s+/).length >= 12;
}

/**
 * 生成新钱包。返回助记词 —— **只返回这一次**，之后只能靠 PIN 导出。
 * 调用方必须把它展示给用户并要求抄写。
 */
export async function createLocalWallet(pin, { mnemonic } = {}) {
  const { Wallet } = await import('ethers/wallet');
  let w;
  if (mnemonic) {
    if (!wordlistOk(mnemonic)) throw new Error('That recovery phrase does not look complete.');
    w = Wallet.fromPhrase(mnemonic.trim().replace(/\s+/g, ' '));
  } else {
    w = Wallet.createRandom();
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt);

  // 存助记词而不是裸私钥：用户还能把它导进 MetaMask / Trust，
  // 不至于被锁死在这个页面里。
  const secret = enc.encode(w.mnemonic.phrase);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, secret);

  write({
    v: 1,
    address: w.address,
    salt: toB64(salt),
    iv: toB64(iv),
    ct: toB64(ct),
    at: Date.now()
  });

  session = { wallet: w, address: w.address };
  return { address: w.address, mnemonic: w.mnemonic.phrase };
}

/** 用 PIN 解密，成功则建立内存会话 */
export async function unlockLocalWallet(pin) {
  const o = read();
  if (!o) throw new Error('No wallet on this browser yet.');

  const salt = fromB64(o.salt);
  const iv = fromB64(o.iv);
  const key = await deriveKey(pin, salt);

  let plain;
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, fromB64(o.ct));
  } catch (e) {
    // AES-GCM 的认证失败只会以这种方式暴露：口令错误就是这里抛。
    const err = new Error('Wrong PIN.');
    err.code = 'BAD_PIN';
    throw err;
  }

  const { Wallet } = await import('ethers/wallet');
  const phrase = dec.decode(plain);
  const w = Wallet.fromPhrase(phrase);
  session = { wallet: w, address: w.address };
  return { address: w.address };
}

/** 导出助记词（需要 PIN，UI 必须二次确认） */
export async function exportMnemonic(pin) {
  const o = read();
  if (!o) throw new Error('No wallet on this browser yet.');
  const key = await deriveKey(pin, fromB64(o.salt));
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(o.iv) }, key, fromB64(o.ct)
  );
  return dec.decode(plain);
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

  return {
    isLocalWallet: true,
    isMetaMask: false,

    async request({ method, params }) {
      if (!session) {
        const err = new Error('Wallet is locked.');
        err.code = 4100;
        throw err;
      }
      const { wallet } = session;

      switch (method) {
        case 'eth_requestAccounts':
        case 'eth_accounts':
          return [session.address];

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
          emit('accountsChanged', [session.address]);
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
  return { accounts: [session.address], provider: makeProvider() };
}

/** 页面刷新后重新回到已连接状态用：不弹 PIN，但 provider 是锁住的 */
export function restoreLocalWallet() {
  const addr = localAddress();
  if (!addr) return null;
  return { accounts: [addr], provider: makeProvider() };
}
