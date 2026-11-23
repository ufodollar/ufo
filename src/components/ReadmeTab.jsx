import React, { useState } from 'react';
import GuideTab from './GuideTab';
import RulesTab from './RulesTab';
import { skyBtn } from '../ui';

/* ============================================================
   Readme — Guide 与 Rules 的合并页
   ------------------------------------------------------------
   两份内容各自是按条引用的条款，合并成「一页 + 顶部切换」
   而不是把条款揉在一起：引用时仍然说「Guide §2.1」，
   翻页成本只有一个点击。

   切换按钮做成 segmented control，而不是两个普通 tab ——
   下面这两块内容属于同一份文档的两个部分，视觉上要能看出来。
   ============================================================ */

const SEG = {
  guide: 'Guide',
  rules: 'Rules'
};

export default function ReadmeTab() {
  const [part, setPart] = useState('guide');

  return (
    <div style={{ marginTop: '10px' }}>
      <div style={{ display: 'flex', gap: '6px', padding: '4px', background: '#fff',
                    border: '1px solid #e2e8f0', borderRadius: '14px',
                    boxShadow: '0 2px 10px rgba(15,23,42,0.04)' }}>
        {Object.keys(SEG).map((key) => {
          const on = part === key;
          return (
            <button
              key={key}
              onClick={() => setPart(key)}
              aria-pressed={on}
              style={{
                ...skyBtn('sm', { soft: !on }),
                flex: 1, height: '36px', borderRadius: '11px',
                transition: 'background 0.15s, color 0.15s'
              }}
            >
              {SEG[key]}
            </button>
          );
        })}
      </div>

      {part === 'guide' ? <GuideTab /> : <RulesTab />}
    </div>
  );
}
