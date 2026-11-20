// 数值单位换算。
// 这里手写而不是从 ethers 里拿，是因为 ethers 的 utils 子模块会连带
// abi/crypto（约 200KB）一起进首屏，而 formatUnits 本身只有十来行。
// 首屏要显示价格和余额，所以这两个函数必须在主包里、且必须足够小。

export function formatUnits(value, decimals = 18) {
  const v = BigInt(value);
  const negative = v < 0n;
  const abs = negative ? -v : v;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const rest = (abs % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  return (negative ? '-' : '') + whole.toString() + (rest ? '.' + rest : '');
}

export const formatEther = (value) => formatUnits(value, 18);

/**
 * 把用户输入的小数变成最小单位整数。
 * 与 ethers 的 parseUnits 有一处刻意不同：小数位超出精度时截断而不是抛错。
 * 输入框允许粘贴 18 位以上小数，抛错会让界面在预览阶段就炸掉。
 */
export function parseUnits(input, decimals = 18) {
  const s = String(input == null ? '' : input).trim();
  if (!/^\d*(\.\d*)?$/.test(s) || s === '' || s === '.') {
    throw new Error('invalid amount');
  }
  const [whole, frac = ''] = s.split('.');
  const padded = (frac + '0'.repeat(decimals)).slice(0, decimals);
  return BigInt((whole || '0') + padded);
}
