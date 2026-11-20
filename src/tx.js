// ============================================================================
// 交易层：只有真正要签名时才加载 ethers
// ----------------------------------------------------------------------------
// 读链走 chain.js 的裸 JSON-RPC，写链才需要 ABI 编码、receipt 解析、错误解码
// 这些体面活 —— 这部分交给 ethers，但它被隔离在动态 chunk 里，
// 不参与首屏。用户输入金额时就开始预取，点下按钮通常已经就绪。
// ============================================================================

import { formatUnits, formatEther, parseUnits } from './units';
import { CONFIG } from './config';

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)'
];

const VAULT_ABI = [
  'function deposit(address tokenAddress, uint256 amount)',
  'function withdraw(address tokenAddress, uint256 ufoAmount)',
  'function getExchangeRate() view returns (uint256)',
  'function getPrice(address tokenAddress) view returns (uint256)',
  'function paused() view returns (bool)',
  'event Deposited(address indexed user, address indexed token, uint256 amount, uint256 ufoAmount, uint256 feeAmount)',
  'event Withdrawn(address indexed user, address indexed token, uint256 ufoAmount, uint256 amount, uint256 feeAmount)'
];

let libPromise = null;

function loadLibs() {
  if (!libPromise) {
    libPromise = Promise.all([import('ethers/providers'), import('ethers/contract')])
      .then(([providers, contract]) => ({ BrowserProvider: providers.BrowserProvider, Contract: contract.Contract }))
      .catch((e) => { libPromise = null; throw e; });
  }
  return libPromise;
}

/** 输入框里的金额 → 最小单位。末尾小数点会让 parseUnits 抛错，先清掉。 */
export function toWei(input) {
  const clean = String(input == null ? '' : input).replace(/\.$/, '');
  return parseUnits(clean || '0', 18);
}

/**
 * 提交一笔 swap / redeem。
 * 返回 { hash, paid, received }，金额已按链上事件校正。
 * onStage(text) 用来更新按钮上方的进度文案。
 */
export async function submitSwap({ walletProvider, owner, tokenAddress, amountWei, isBuy, onStage }) {
  const { BrowserProvider, Contract } = await loadLibs();

  const provider = new BrowserProvider(walletProvider);

  const bnb = await provider.getBalance(owner);
  if (parseFloat(formatEther(bnb)) < 0.0005) {
    throw new Error('Insufficient BNB for gas.');
  }

  const signer = await provider.getSigner();
  const vault = new Contract(CONFIG.VAULT_ADDRESS, VAULT_ABI, signer);

  if (await vault.paused()) {
    throw new Error('The vault is currently paused for maintenance. Please try again later.');
  }

  let hash = '';
  let receipt = null;
  let paid = parseFloat(formatUnits(amountWei, 18)).toFixed(6);
  let received = null;

  if (isBuy) {
    const token = new Contract(tokenAddress, ERC20_ABI, signer);
    const allowance = await token.allowance(owner, CONFIG.VAULT_ADDRESS);
    if (allowance < amountWei) {
      onStage('Approving…');
      // 按本次额度精确授权，不申请无限授权
      const approveTx = await token.approve(CONFIG.VAULT_ADDRESS, amountWei);
      await approveTx.wait();
    }
    onStage('Swapping…');
    const tx = await vault.deposit(tokenAddress, amountWei);
    hash = tx.hash;
    receipt = await tx.wait();

    for (const log of receipt.logs) {
      try {
        const parsed = vault.interface.parseLog(log);
        if (parsed && parsed.name === 'Deposited') {
          received = parseFloat(formatUnits(parsed.args.ufoAmount, 18)).toFixed(6);
          paid = parseFloat(formatUnits(parsed.args.amount, 18)).toFixed(6);
          break;
        }
      } catch (e) { /* 别的合约的 log，跳过 */ }
    }
  } else {
    onStage('Redeeming…');
    const tx = await vault.withdraw(tokenAddress, amountWei);
    hash = tx.hash;
    receipt = await tx.wait();

    for (const log of receipt.logs) {
      try {
        const parsed = vault.interface.parseLog(log);
        if (parsed && parsed.name === 'Withdrawn') {
          received = parseFloat(formatUnits(parsed.args.amount, 18)).toFixed(6);
          paid = parseFloat(formatUnits(parsed.args.ufoAmount, 18)).toFixed(6);
          break;
        }
      } catch (e) { /* 同上 */ }
    }
  }

  return { hash, paid, received };
}

/** 用户开始输金额就把 ethers 拉下来，点按钮时不用等下载 */
export function prefetchTxLibs() {
  loadLibs().catch(() => {});
}
