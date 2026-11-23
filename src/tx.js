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
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)'
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

// PancakeSwap V2 Router02。不涉及 UFO 的币对直接在这里成交。
const ROUTER_ADDRESS = '0x10ED43C718714eb63d5aA57B78B54704E256024E';

const ROUTER_ABI = [
  'function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[])',
  'function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline)',
  'function swapExactETHForTokensSupportingFeeOnTransferTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline)',
  'function swapExactTokensForETHSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline)'
];

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
export function toWei(input, decimals = 18) {
  const clean = String(input == null ? '' : input).replace(/\.$/, '');
  return parseUnits(clean || '0', decimals);
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
async function sendTx(walletProvider, { from, to, data, value = 0n, nonceFloor = 0 }) {
  const valueHex = '0x' + BigInt(value).toString(16);
  const [nonce, gasPrice, gasEstimate] = await Promise.all([
    rpcCall('eth_getTransactionCount', [from, 'pending']),
    rpcCall('eth_gasPrice', []),
    rpcCall('eth_estimateGas', [{ from, to, data, value: valueHex }])
  ]);

  // 留 20% 余量：估算与实际执行之间状态可能微变，out of gas 的代价是白付手续费
  const gasLimit = (BigInt(gasEstimate) * 12n) / 10n;

  const rpcNonce = Number(BigInt(nonce));
  const useNonce = Math.max(rpcNonce, nonceFloor);

  const tx = {
    from,
    to,
    data,
    value: valueHex,
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
  const [bnbHex, isPaused, allowance, walletChain] = await Promise.all([
    rpcCall('eth_getBalance', [owner, 'latest']),
    readView(vaultIface, CONFIG.VAULT_ADDRESS, 'paused'),
    isBuy
      ? readView(erc20Iface, tokenAddress, 'allowance', [owner, CONFIG.VAULT_ADDRESS])
      : Promise.resolve(0n),
    // 最后一道闸。UI 已经按 chainIssue 禁用了按钮，但两种情况会漏：
    //   1. 用户在切链结果回来之前就点了；
    //   2. 钱包中途被切到别的网络，而它不推送 chainChanged（OKX Connect 就不推）。
    // 问这一句和其它三个请求并发，不额外花时间。读不到 chainId 的钱包放行 ——
    // 少数老钱包不实现该方法，不能因此拦住正常交易。
    walletProvider.request({ method: 'eth_chainId' }).catch(() => null)
  ]);

  if (walletChain && String(walletChain).toLowerCase() !== CHAIN_ID_HEX) {
    throw new Error('Your wallet is on a different network. Switch to BNB Smart Chain and try again.');
  }

  if (Number(BigInt(bnbHex)) / 1e18 < 0.0005) {
    throw new Error('Insufficient BNB for gas.');
  }

  if (isPaused) {
    throw new Error('The vault is currently paused for maintenance. Please try again later.');
  }

  let hash = '';
  let receipt = null;
  // 初值只作为事件解析失败时的兜底：买的时候知道付出的是 amountWei（USDT），
  // 卖的时候 amountWei 是 UFO 数量，不能拿来当「已支付」——旧代码两个分支
  // 共用这一行，卖出且日志解析失败时会把 UFO 数量显示成美元金额。
  let paid = isBuy ? parseFloat(formatUnits(amountWei, 18)).toFixed(6) : '0.000000';
  let received = '0.000000';
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

/**
 * 走 PancakeSwap 的兑换：不涉及 UFO 的币对都从这里成交。
 *
 * 与金库那条路的区别：
 *   · 价格由 Router 的储备决定，不是 NAV；
 *   · BNB 是原生币，进出都要分别用 swapExactETHForTokens / swapExactTokensForETH，
 *     路径里写的是 WBNB，value 才是真的 BNB；
 *   · 用 *SupportingFeeOnTransferTokens 系列：收转账税的代币不会因为
 *     「实际到账少于报价」而整笔 revert，用户至少能换出来，只是数量少一点。
 *
 * 参数全部预先算好（路径、最小到账、deadline），钱包只签一次名。
 */
export async function submitPancakeSwap({
  walletProvider, owner, payToken, receiveToken,
  amountWei, path, minOutWei, inDecimals = 18, outDecimals = 18, onStage
}) {
  if (!path || path.length < 2) throw new Error('No swap route for this pair.');

  const { Interface } = await loadLibs();
  const erc20 = new Interface(ERC20_ABI);
  const router = new Interface(ROUTER_ABI);

  const nativeIn = payToken.symbol === 'BNB' || payToken.native === true;
  const nativeOut = receiveToken.symbol === 'BNB' || receiveToken.native === true;
  const amount = BigInt(amountWei);
  if (amount <= 0n) throw new Error('Enter an amount greater than zero.');

  // gas 预检与网络检查：与金库那条路同样的两道闸，理由见 submitSwap
  const [bnbHex, allowance, walletChain] = await Promise.all([
    rpcCall('eth_getBalance', [owner, 'latest']),
    nativeIn
      ? Promise.resolve(null)
      : readView(erc20, payToken.address, 'allowance', [owner, ROUTER_ADDRESS]),
    walletProvider.request({ method: 'eth_chainId' }).catch(() => null)
  ]);

  if (walletChain && String(walletChain).toLowerCase() !== CHAIN_ID_HEX) {
    throw new Error('Your wallet is on a different network. Switch to BNB Smart Chain and try again.');
  }
  if (Number(BigInt(bnbHex)) / 1e18 < 0.0005) {
    throw new Error('Insufficient BNB for gas.');
  }

  let nonceFloor = 0;
  if (!nativeIn && allowance < amount) {
    onStage('Approving…');
    const approved = await sendTx(walletProvider, {
      from: owner,
      to: payToken.address,
      data: erc20.encodeFunctionData('approve', [ROUTER_ADDRESS, amount])
    });
    nonceFloor = approved.nonce + 1;
  }

  const deadline = Math.floor(Date.now() / 1000) + 1200;
  const minOut = BigInt(minOutWei);

  let data;
  if (nativeIn) {
    data = router.encodeFunctionData('swapExactETHForTokensSupportingFeeOnTransferTokens', [
      minOut, path, owner, deadline
    ]);
  } else if (nativeOut) {
    data = router.encodeFunctionData('swapExactTokensForETHSupportingFeeOnTransferTokens', [
      amount, minOut, path, owner, deadline
    ]);
  } else {
    data = router.encodeFunctionData('swapExactTokensForTokensSupportingFeeOnTransferTokens', [
      amount, minOut, path, owner, deadline
    ]);
  }

  onStage('Swapping…');
  const { hash, receipt } = await sendTx(walletProvider, {
    from: owner,
    to: ROUTER_ADDRESS,
    data,
    value: nativeIn ? amount : 0n,
    nonceFloor
  });

  // 到账数量按日志里转给本人的 Transfer 求和。报价与实际成交之间可能因为
  // 池子变动或转账税有差额，历史记录里应该写真实到账，不是报价。
  let received = null;
  if (!nativeOut && receiveToken.address) {
    let sum = 0n;
    for (const log of receipt.logs || []) {
      if (String(log.address || '').toLowerCase() !== receiveToken.address.toLowerCase()) continue;
      try {
        const parsed = erc20.parseLog({ topics: log.topics, data: log.data });
        if (parsed && parsed.name === 'Transfer' && String(parsed.args[1]).toLowerCase() === owner.toLowerCase()) {
          sum += parsed.args[2];
        }
      } catch (e) { /* 不是 Transfer，跳过 */ }
    }
    if (sum > 0n) received = parseFloat(formatUnits(sum, outDecimals)).toFixed(6);
  }

  return { hash, paid: parseFloat(formatUnits(amount, inDecimals)).toFixed(6), received };
}

/** 用户开始输金额就把 ABI 模块拉下来，点按钮时不用等下载 */
export function prefetchTxLibs() {
  loadLibs().catch(() => {});
}

/**
 * 收款地址校验。返回校验和格式（EIP-55）。
 * 只做正则是不够的：混合大小写的地址如果 checksum 不对，说明抄错了字符，
 * 但形如 0x + 40 位仍然是合法的「格式」。这种地址能把钱打进一个
 * 谁都没有私钥的位置，必须在签名前拦下。
 */
export async function normalizeAddress(input) {
  const t = String(input == null ? '' : input).trim();
  if (!t) throw new Error('Enter a recipient address.');
  if (!/^0x[0-9a-fA-F]{40}$/.test(t)) {
    throw new Error('A BSC address is 0x followed by 40 hex characters.');
  }
  const { getAddress } = await import('ethers/address');
  try {
    return getAddress(t);
  } catch (e) {
    throw new Error('That address has an invalid checksum — check it character by character.');
  }
}

/**
 * 转账。原生币（BNB）与 BEP-20 代币走同一条路径：参数由公共 RPC 算好，
 * 钱包只签名。与兑换不同，这里没有 approve —— transfer 是代币合约的直接调用。
 *
 * 余额在签名前先查：用户点完按钮才发现「余额不足」，在手机上等于白跑一趟。
 */
export async function sendTransfer({ walletProvider, owner, token, to, amountWei }) {
  const { Interface } = await loadLibs();
  const erc20 = new Interface(ERC20_ABI);
  const native = !token || token.symbol === 'BNB' || token.native === true;

  const amount = BigInt(amountWei);
  if (amount <= 0n) throw new Error('Enter an amount greater than zero.');

  const data = native ? '0x' : erc20.encodeFunctionData('transfer', [to, amount]);
  const value = native ? amount : 0n;

  const [bnbHex, tokenHex] = await Promise.all([
    rpcCall('eth_getBalance', [owner, 'latest']),
    native
      ? Promise.resolve(null)
      : rpcCall('eth_call', [
          { to: token.address, data: erc20.encodeFunctionData('balanceOf', [owner]) },
          'latest'
        ])
  ]);

  if (native) {
    if (BigInt(bnbHex || '0x0') < value) throw new Error('Not enough BNB.');
  } else if (tokenHex && tokenHex !== '0x') {
    // 读不到余额（'0x'）时不要在这里猜，交给链上估算 gas 去判定 ——
    // 直接 BigInt('0x') 只会抛一句用户看不懂的转换错误。
    if (BigInt(tokenHex) < amount) {
      const err = new Error(`Not enough ${token.symbol}.`);
      err.code = 'INSUFFICIENT_TOKEN';
      throw err;
    }
  }

  let sent;
  try {
    sent = await sendTx(walletProvider, {
      from: owner,
      to: native ? to : token.address,
      data,
      value
    });
  } catch (e) {
    const msg = String((e && e.message) || e);
    if (/insufficient funds|exceeds balance|gas required exceeds/i.test(msg)) {
      throw new Error('Not enough BNB to cover the amount and gas.');
    }
    if (/execution reverted|revert/i.test(msg)) {
      throw new Error('The transfer would fail on chain. Check the amount and the recipient.');
    }
    throw e;
  }

  return { hash: sent.hash, receipt: sent.receipt };
}
