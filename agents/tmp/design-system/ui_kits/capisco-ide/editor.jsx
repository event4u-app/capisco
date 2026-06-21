/* Capisco IDE kit — EditorArea: tab strip + highlighted code + autocomplete. */

// token span helpers (classes defined in index.html)
const K = ({ children }) => <span className="kw">{children}</span>;
const C = ({ children }) => <span className="ctl">{children}</span>;
const S = ({ children }) => <span className="str">{children}</span>;
const N = ({ children }) => <span className="num">{children}</span>;
const Cm = ({ children }) => <span className="com">{children}</span>;
const F = ({ children }) => <span className="fn">{children}</span>;
const T = ({ children }) => <span className="ty">{children}</span>;
const P = ({ children }) => <span className="prop">{children}</span>;
const O = ({ children }) => <span className="op">{children}</span>;
const B1 = ({ children }) => <span className="b1">{children}</span>;
const B2 = ({ children }) => <span className="b2">{children}</span>;
const B3 = ({ children }) => <span className="b3">{children}</span>;
const Ind = () => <span className="indent" />;
const Inlay = ({ children }) => <span className="inlay">{children}</span>;

function Line({ num, git, active, blame, presence, pres, onPresence, children }) {
  return (
    <div className={'code-line' + (active ? ' active' : '') + (presence ? ' has-presence' : '')}>
      {pres && <span className={'pres-bar' + (pres === 'top' ? ' pres-top' : '') + (pres === 'bottom' ? ' pres-bottom' : '')} />}
      {presence && <span className="line-presence" title={presence.who + ' has live changes here'} onClick={onPresence}>{presence.init}</span>}
      <span className={'gutter' + (git ? ' g-' + git : '')}>{num}</span>
      <span className="code">{children}{blame && <span className="blame">{blame}</span>}</span>
    </div>
  );
}

function LivePresence({ onClose }) {
  return (
    <>
      <div className="menu-scrim" onClick={onClose} />
      <div className="live-pop">
        <div className="lp-head">
          <span className="aw-av on">ma</span>
          <div className="lp-id"><div className="lp-who">mara</div><div className="lp-meta">feat/capability-cache · #1283 · 2m ago</div></div>
          <button className="lp-x" onClick={onClose}><Icon name="x" size={14} color="var(--text-secondary)" /></button>
        </div>
        <div className="lp-diff">
          <div className="dv-uline del"><span className="dv-ln">16</span><span className="dv-sign">−</span><span className="dv-code">{'  if (this.grants.get(key) === "session") return true;'}</span></div>
          <div className="dv-uline add"><span className="dv-ln">16</span><span className="dv-sign">+</span><span className="dv-code">{'  if (this.cache.has(key)) return this.cache.get(key);'}</span></div>
          <div className="dv-uline add"><span className="dv-ln">17</span><span className="dv-sign">+</span><span className="dv-code">{'  const hit = this.grants.get(key) === "session";'}</span></div>
        </div>
        <div className="lp-actions"><button className="aw-btn aw-cp"><Icon name="git-branch-plus" size={13} />Cherry-pick this block</button></div>
      </div>
    </>
  );
}

function Autocomplete() {
  const items = [
    { sym: 'm', name: 'prompt', hint: '(p, c): Promise<boolean>', sel: true },
    { sym: 'm', name: 'promptUser', hint: '(msg): Promise<boolean>' },
    { sym: 'f', name: 'grants', hint: 'Map<string, Scope>' },
    { sym: 'p', name: 'registry', hint: 'Registry' },
    { sym: 'm', name: 'revoke', hint: '(key): void' },
  ];
  return (
    <div className="autocomplete">
      {items.map((it) => (
        <div key={it.name} className={'ac-item' + (it.sel ? ' sel' : '')}>
          <span className={'ac-sym ac-' + it.sym}>{it.sym}</span>
          <span className="ac-name">{it.name}</span>
          <span className="ac-hint">{it.hint}</span>
        </div>
      ))}
    </div>
  );
}

function TabStrip({ tabs, active, onSelect }) {
  const { EditorTab } = window.CapiscoDesignSystem_026f1e;
  const [rows, setRows] = React.useState(() => Number(localStorage.getItem('capisco-tabrows')) || 1);
  const [menu, setMenu] = React.useState(false);
  const setRowsP = (n) => { setRows(n); localStorage.setItem('capisco-tabrows', n); };
  const multi = rows > 1;
  return (
    <div className="tab-strip">
      <div className={'tab-scroll' + (multi ? ' multi' : ' single')}
        style={multi ? { maxHeight: `calc(${rows} * var(--tabbar-h))` } : null}>
        {tabs.map((t) => (
          <EditorTab key={t.name} icon={<FileIcon ext={t.ext} />} label={t.name}
            pinned={t.pinned} dirty={t.dirty} active={active === t.name} onSelect={() => onSelect(t.name)} />
        ))}
      </div>
      <div className="tab-overflow-wrap">
        <button className={'tab-overflow' + (menu ? ' active' : '')} title="Show all tabs" onClick={() => setMenu((m) => !m)}>
          <Icon name="chevron-down" size={15} />
        </button>
        {menu && (
          <>
            <div className="menu-scrim" onClick={() => setMenu(false)} />
            <div className="tab-menu">
              <div className="tab-menu-rows">
                <span>Tab rows</span>
                <div className="trow-seg">
                  {[1, 2, 3].map((n) => (
                    <button key={n} className={'trow-opt' + (rows === n ? ' active' : '')} onClick={() => setRowsP(n)}>{n}</button>
                  ))}
                </div>
              </div>
              <div className="tab-menu-list">
                {tabs.map((t) => (
                  <button key={t.name} className={'tab-menu-item' + (active === t.name ? ' active' : '')} onClick={() => { onSelect(t.name); setMenu(false); }}>
                    <FileIcon ext={t.ext} />
                    <span className="tmi-name">{t.name}</span>
                    {t.pinned && <Icon name="pin" size={11} color="var(--text-tertiary)" />}
                    {t.dirty && <span className="tmi-dirty" />}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EditorArea() {
  const [active, setActive] = React.useState('broker.ts');
  const [livePop, setLivePop] = React.useState(false);
  return (
    <div className="editor-area">
      <TabStrip tabs={window.TABS} active={active} onSelect={setActive} />

      <div className="code-pane">
        <Line num={1} git="add"><Cm>{'// capability broker — grants scoped access to agent principals'}</Cm></Line>
        <Line num={2}></Line>
        <Line num={3}><K>import</K> <B1>{'{'}</B1> <T>Capability</T><O>,</O> <T>Principal</T><O>,</O> <T>Scope</T> <B1>{'}'}</B1> <K>from</K> <S>"./types"</S><O>;</O></Line>
        <Line num={4}></Line>
        <Line num={5} git="add"><K>export</K> <K>class</K> <T>Broker</T> <B1>{'{'}</B1></Line>
        <Line num={6}><Ind /><K>private</K> <P>grants</P> <O>=</O> <K>new</K> <F>Map</F><B2>{'<'}</B2><T>string</T><O>,</O> <T>Scope</T><B2>{'>'}</B2><B3>()</B3><O>;</O></Line>
        <Line num={7}></Line>
        <Line num={8}><Ind /><F>constructor</F><B2>(</B2><K>private</K> <P>registry</P><O>:</O> <T>Registry</T><B2>)</B2> <B3>{'{}'}</B3></Line>
        <Line num={9}></Line>
        <Line num={10} git="add"><Ind /><K>async</K> <F>checkCapability</F><B2>(</B2></Line>
        <Line num={11} git="add"><Ind /><Ind /><V>principal</V><O>:</O> <T>Principal</T><O>,</O></Line>
        <Line num={12} git="add"><Ind /><Ind /><V>capability</V><O>:</O> <T>Capability</T><O>,</O></Line>
        <Line num={13} git="add"><Ind /><Ind /><V>scope</V><O>:</O> <T>Scope</T> <O>=</O> <S>"once"</S><O>,</O></Line>
        <Line num={14}><Ind /><B2>)</B2><O>:</O> <T>Promise</T><B3>{'<'}</B3><T>boolean</T><B3>{'>'}</B3> <B2>{'{'}</B2></Line>
        <Line num={15}><Ind /><Ind /><K>const</K> <V>key</V> <O>=</O> <S>{'`${principal.id}:${capability.name}`'}</S><O>;</O></Line>
        <Line num={16} pres="top" presence={{ init: 'ma', who: 'mara' }} onPresence={() => setLivePop((v) => !v)}><Ind /><Ind /><C>if</C> <B3>(</B3><K>this</K><O>.</O><P>grants</P><O>.</O><F>get</F><B1>(</B1><Inlay>key:</Inlay><V>key</V><B1>)</B1> <O>===</O> <S>"session"</S><B3>)</B3> <C>return</C> <N>true</N><O>;</O></Line>
        <Line num={17} pres="bottom"></Line>
        <Line num={18} active git="mod" blame="matze, 28 Nov 2025 · feat: add worktree teardown"><Ind /><Ind /><K>const</K> <V>granted</V> <O>=</O> <K>await</K> <K>this</K><O>.</O><F>prompt</F><span className="caret-host"><B3>(</B3><Inlay>principal:</Inlay><V>principal</V><O>,</O> <Inlay>capability:</Inlay><V>capability</V><B3>)</B3></span><O>;</O></Line>
        <Line num={19}><Ind /><Ind /><C>if</C> <B3>(</B3><V>granted</V><B3>)</B3> <K>this</K><O>.</O><P>grants</P><O>.</O><F>set</F><B1>(</B1><Inlay>key:</Inlay><V>key</V><O>,</O> <Inlay>value:</Inlay><V>scope</V><B1>)</B1><O>;</O></Line>
        <Line num={20}><Ind /><Ind /><C>return</C> <V>granted</V><O>;</O></Line>
        <Line num={21}><Ind /><B2>{'}'}</B2></Line>
        <Line num={22}><B1>{'}'}</B1></Line>
        <Autocomplete />
        {livePop && <LivePresence onClose={() => setLivePop(false)} />}
      </div>
    </div>
  );
}

const V = ({ children }) => <span className="var">{children}</span>;

Object.assign(window, { EditorArea });
