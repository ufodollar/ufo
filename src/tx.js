// ============================================================================
// 交易层
// ----------------------------------------------------------------------------
// 设计原则：**读和写彻底分开**。
//
// 读：走 chain.js 的公共 RPC（eth_call / eth_getTransactionCount / eth_gasPrice
//     / eth_estimateGas / eth_getTransactionReceipt）。
// 写：钱包只接收一笔「参数已经填好」的 eth_sendTransaction，负责签名。
//
// 为什么不能像以前那样直接 new BrowserProvider(walletProvider)：
//   ethers 的 BrowserProvider 在发交易前会自动补全 nonce、gasPrice、gasLimit，
//   这三个都要向钱包请求 eth_getTransactionCount / eth_gasPrice /
//   eth_estimateGas，tx.wait() 还会轮询 eth_getTransactionReceipt。
//   注入式钱包（MetaMask、Trust）这些都支持，但 OKX Connect 只代理签名类方法，
//   一旦走 BrowserProvider 就整条链路报「method not supported」。
//
//   把参数全部预取好，各家钱包的行为就一致了：都只做一次签名。
//
// ethers 仍然保留，但只用它的 Interface 做 ABI 编码/解码 —— 这部分只依赖
// 纯计算，不需要 Provider，也不参与首屏。
// ============================================================================

import { formatUnits, parseUnits } from './units';
import { CONFIG } from './config';
import { rpcCall } from './chain';

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

const CHAIN_ID_HEX = '0x38';
const CONFIRM_TIMEOUT_MS = 180000;
const POLL_INTERVAL_MS = 2000;

let libPromise = null;

function loadLibs() {
  if (!libPromise) {
    // 只拉 ABI 子模块（约 90KB），不碰 providers / contract / wallet
    libPromise = import('ethers/abi')
      .then((m) => ({ Interface: m.Interface }))
      .catch((e) => { libPromise = null; throw e; });
  }
  return libPromise;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 输入框里的金额 → 最小单位。末尾小数点会让解析失败，先清掉。 */
export function toWei(input) {
  const clean = String(input == null ? '' : input).replace(/\.$/, '');
  return parseUnits(clean || '0', 18);
}

/** 读一个 view 函数，返回解码后的第一个值 */
async function readView(iface, to, fn, args = []) {
  const data = iface.encodeFunctionData(fn, args);
  const hex = await rpcCall('eth_call', [{ to, data }, 'latest']);
  if (!hex || hex === '0x') throw new Error(`empty result from ${fn}`);
  return iface.decodeFunctionResult(fn, hex)[0];
}

/**
 * 等回执。不用 tx.wait()：那要走钱包的 eth_getTransactionReceipt，
 * OKX Connect 不支持。公共 RPC 轮询结果一致，还不受钱包限流影响。
 */
async function waitReceipt(hash) {
  const started = Date.now();
  while (Date.now() - started < CONFIRM_TIMEOUT_MS) {
    let receipt = null;
    try {
      receipt = await rpcCall('eth_getTransactionReceipt', [hash]);
    } catch (e) { /* 单次网络抖动不算失败，继续轮询 */ }

    if (receipt) {
      if (receipt.status === '0x0') {
        const err = new Error('Transaction reverted on chain.');
        err.hash = hash;
        throw err;
      }
      return receipt;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  const err = new Error('Transaction sent but not confirmed within 3 minutes.');
  err.hash = hash;
  throw err;
}

/**
 * 发一笔交易：参数全部由公共 RPC 算好，只让钱包签名。
 * 这样无论注入式钱包还是 OKX Connect，走的都是同一条路径。
 *
 * nonceFloor：approve 与主交易是连续两笔，第二笔必须严格大于第一笔。
 * 公共 RPC 的 pending nonce 在刚出块的瞬间可能还是旧值，直接采信会拿到
 * 同一个 nonce —— 后发的那笔会把前一笔替换掉，表现为「approve 成功但
 * deposit 永远 pending」。所以由调用方传一个下界，取两者较大值。
 */
async function sendTx(walletProvider, { from, to, data, nonceFloor = 0 }) {
  const [nonce, gasPrice, gasEstimate] = await Promise.all([
    rpcCall('eth_getTransactionCount', [from, 'pending']),
    rpcCall('eth_gasPrice', []),
    rpcCall('eth_estimateGas', [{ from, to, data, value: '0x0' }])
  ]);

  // 留 20% 余量：估算与实际执行之间状态可能微变，out of gas 的代价是白付手续费
  const gasLimit = (BigInt(gasEstimate) * 12n) / 10n;

  const rpcNonce = Number(BigInt(nonce));
  const useNonce = Math.max(rpcNonce, nonceFloor);

  const tx = {
    from,
    to,
    data,
    nonce: '0x' + useNonce.toString(16),
    gasPrice,
    gas: '0x' + gasLimit.toString(16),
    chainId: CHAIN_ID_HEX
  };

  const hash = await walletProvider.request({ method: 'eth_sendTransaction', params: [tx] });
  if (!hash) throw new Error('Wallet returned no transaction hash.');
  const receipt = await waitReceipt(hash);
  return { hash, receipt, nonce: useNonce };
}

/**
 * 提交一笔发行或销毁。
 * 返回 { hash, paid, received }，金额已按链上事件校正。
 * onStage(text) 用来更新按钮上方的进度文案。
 */
export async function submitSwap({ walletProvider, owner, tokenAddress, amountWei, isBuy, onStage }) {
  const { Interface } = await loadLibs();
  const vaultIface = new Interface(VAULT_ABI);
  const erc20Iface = new Interface(ERC20_ABI);

  // gas 预检。低于 0.0005 BNB 时发出去也大概率失败，
  // 不如在签名前就说清楚，省掉一次「App 弹窗 → 报错 → 回网页」。
  //
  // 三件事彼此无关（余额、是否暂停、授权额度），并发问出去。
  // 串行问要多花两个来回，在手机上就是大半秒。
  const [bnbHex, isPaused, allowance] = await Promise.all([
    rpcCall('eth_getBalance', [owner, 'latest']),
    readView(vaultIface, CONFIG.VAULT_ADDRESS, 'paused'),
    isBuy
      ? readView(erc20Iface, tokenAddress, 'allowance', [owner, CONFIG.VAULT_ADDRESS])
      : Promise.resolve(0n)
  ]);

  if (Number(BigInt(bnbHex)) / 1e18 < 0.0005) {
    throw new Error('Insufficient BNB for gas.');
  }

  if (isPaused) {
    throw new Error('The vault is currently paused for maintenance. Please try again later.');
  }

  let hash = '';
  let receipt = null;
  let paid = parseFloat(formatUnits(amountWei, 18)).toFixed(6);
  let received = null;
  // 本次流程用到的 nonce 下界，见 sendTx 的注释
  let nonceFloor = 0;

  if (isBuy) {
    if (allowance < amountWei) {
      onStage('Approving…');
      // 按本次额度精确授权，不申请无限授权
      const approved = await sendTx(walletProvider, {
        from: owner,
        to: tokenAddress,
        data: erc20Iface.encodeFunctionData('approve', [CONFIG.VAULT_ADDRESS, amountWei])
      });
      nonceFloor = approved.nonce + 1;
    }

    onStage('Swapping…');
    ({ hash, receipt } = await sendTx(walletProvider, {
      from: owner,
      to: CONFIG.VAULT_ADDRESS,
      data: vaultIface.encodeFunctionData('deposit', [tokenAddress, amountWei]),
      nonceFloor
    }));

    for (const log of receipt.logs || []) {
      try {
        const parsed = vaultIface.parseLog({ topics: log.topics, data: log.data });
        if (parsed && parsed.name === 'Deposited') {
          received = parseFloat(formatUnits(parsed.args.ufoAmount, 18)).toFixed(6);
          paid = parseFloat(formatUnits(parsed.args.amount, 18)).toFixed(6);
          break;
        }
      } catch (e) { /* 别的合约的 log，跳过 */ }
    }
  } else {
    onStage('Redeeming…');
    ({ hash, receipt } = await sendTx(walletProvider, {
      from: owner,
      to: CONFIG.VAULT_ADDRESS,
      data: vaultIface.encodeFunctionData('withdraw', [tokenAddress, amountWei])
    }));

    for (const log of receipt.logs || []) {
      try {
        const parsed = vaultIface.parseLog({ topics: log.topics, data: log.data });
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

/** 用户开始输金额就把 ABI 模块拉下来，点按钮时不用等下载 */
export function prefetchTxLibs() {
  loadLibs().catch(() => {});
}
