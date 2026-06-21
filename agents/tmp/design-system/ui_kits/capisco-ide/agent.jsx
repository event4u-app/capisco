/* Capisco IDE kit — Agents workspace (session tabs + full-width chat) + flyout. */

const AGENTS_LIST = ['Opus 4.8', 'Sonnet 4.8', 'Haiku 4.8', 'GPT-5', 'Local'];
const EFFORT_LEVELS = ['Minimal', 'Low', 'Medium', 'High', 'Higher', 'Max'];
const PLAN = [
  { label: '5-hour limit', right: '0%', pct: 0, color: 'var(--text-tertiary)' },
  { label: 'Weekly · all models', right: 'resets Jun 19 · 93%', pct: 93, color: 'var(--warning)' },
  { label: 'Sonnet only', right: 'resets Jun 19 · 8%', pct: 8, color: 'var(--accent)' },
  { label: 'Usage credits', right: '$1,735.15 of $2,000.00', pct: 87, color: 'var(--warning)' },
];

/* Small circular usage ring (data viz, not decoration). */
function BudgetRing({ pct = 87, size = 16 }) {
  const r = 6, c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 16 16">
      <circle cx="8" cy="8" r={r} fill="none" stroke="var(--border-strong)" strokeWidth="2" />
      <circle cx="8" cy="8" r={r} fill="none" stroke="var(--warning)" strokeWidth="2" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform="rotate(-90 8 8)" />
    </svg>
  );
}

/* Composer control bar — model · effort · budget, under the chat (Claude-Desktop style). */
function ComposerBar({ model, setModel, effort, setEffort, statusText, used, budget, setBudget }) {
  const [panel, setPanel] = React.useState(null);
  const toggle = (p) => setPanel((x) => (x === p ? null : p));
  const fmtK = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : String(n));
  const ratio = budget > 0 ? used / budget : 0;
  const tone = ratio < 0.6 ? 'ok' : ratio < 0.85 ? 'warn' : 'crit';
  const toneColor = tone === 'ok' ? 'var(--success)' : tone === 'warn' ? 'var(--warning)' : 'var(--error)';
  const presets = [100000, 150000, 200000, 300000];
  return (
    <div className="composer-bar">
      <div className="cb-stats">
        <span className="cb-ctl-wrap">
          <button className={'cb-meter ' + tone + (panel === 'ctx' ? ' active' : '')} title="Context budget — green → orange → red" onClick={() => toggle('ctx')}>
            <Icon name={tone === 'crit' ? 'triangle-alert' : 'gauge'} size={13} color={toneColor} />
            <span className="cb-meter-val" style={{ color: toneColor }}>{fmtK(used)}/{fmtK(budget)}</span>
            <span className="cb-meter-bar"><span style={{ width: Math.min(100, ratio * 100) + '%', background: toneColor }} /></span>
          </button>
          {panel === 'ctx' && (
            <>
              <div className="menu-scrim" onClick={() => setPanel(null)} />
              <div className="ctx-pop cb-pop">
                <div className="bp-head"><span className="caps">Context budget</span><span className="ctx-pct" style={{ color: toneColor }}>{Math.round(ratio * 100)}%</span></div>
                <div className="ctx-row">Warn at <b>{fmtK(budget)}</b> tokens · {fmtK(used)} used</div>
                <input type="range" className="ctx-range" min="50000" max="400000" step="10000" value={budget} onChange={(e) => setBudget(+e.target.value)} />
                <div className="ctx-presets">
                  {presets.map((v) => <button key={v} className={'ctx-preset' + (budget === v ? ' active' : '')} onClick={() => setBudget(v)}>{fmtK(v)}</button>)}
                </div>
                <div className="ctx-note">Turns green, then orange, then red as the session fills. At red we suggest a fresh session to save tokens.</div>
              </div>
            </>
          )}
        </span>
        <span className="cb-statline">{statusText}</span>
      </div>
      <div className="cb-controls">
        <span className="cb-ctl-wrap">
          <button className={'cb-ctl' + (panel === 'model' ? ' active' : '')} onClick={() => toggle('model')}>{model}<Icon name="chevron-down" size={11} /></button>
          {panel === 'model' && (
            <>
              <div className="menu-scrim" onClick={() => setPanel(null)} />
              <div className="model-menu cb-pop">
                {AGENTS_LIST.map((m) => (
                  <button key={m} className={'model-opt' + (m === model ? ' active' : '')} onClick={() => { setModel(m); setPanel(null); }}>
                    {m}{m === model && <Icon name="check" size={12} color="var(--accent)" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </span>

        <span className="cb-ctl-wrap">
          <button className={'cb-ctl cb-pill' + (panel === 'effort' ? ' active' : '')} onClick={() => toggle('effort')}>{EFFORT_LEVELS[effort]}</button>
          {panel === 'effort' && (
            <>
              <div className="menu-scrim" onClick={() => setPanel(null)} />
              <div className="effort-pop cb-pop">
                <div className="ep-head"><span className="ep-title">Effort <b>{EFFORT_LEVELS[effort]}</b></span><Icon name="circle-help" size={14} color="var(--text-tertiary)" /></div>
                <div className="ep-ends"><span>Faster</span><span>Smarter</span></div>
                <div className="ep-slider">
                  <div className="ep-track" />
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <button key={i} className={'ep-dot' + (i === effort ? ' thumb' : '') + (i === 5 ? ' last' : '')} style={{ left: (i / 5 * 100) + '%' }} onClick={() => setEffort(i)} />
                  ))}
                </div>
              </div>
            </>
          )}
        </span>

        <span className="cb-ctl-wrap">
          <button className={'cb-ring' + (panel === 'budget' ? ' active' : '')} title="Plan usage" onClick={() => toggle('budget')}><BudgetRing pct={87} /></button>
          {panel === 'budget' && (
            <>
              <div className="menu-scrim" onClick={() => setPanel(null)} />
              <div className="budget-pop cb-pop">
                <div className="bp-head"><span className="caps">Plan usage</span><Icon name="arrow-right" size={14} color="var(--text-tertiary)" /></div>
                {PLAN.map((p, i) => (
                  <div key={i} className="bp-row">
                    <div className="bp-line"><span className="bp-label">{p.label}</span><span className="bp-right">{p.right}</span></div>
                    <div className="bp-bar"><div className="bp-fill" style={{ width: p.pct + '%', background: p.color }} /></div>
                  </div>
                ))}
              </div>
            </>
          )}
        </span>
      </div>
    </div>
  );
}

/* Composer model selector — choose the model, nothing else. */
function ModelPicker({ value, onChange }) {
  const [open, setOpen] = React.useState(false);
  return (
    <span className="model-pick-wrap">
      <button className="model-pick" onClick={() => setOpen((v) => !v)}>{value}<Icon name="chevron-down" size={12} /></button>
      {open && (
        <>
          <div className="menu-scrim" onClick={() => setOpen(false)} />
          <div className="model-menu up">
            {AGENTS_LIST.map((m) => (
              <button key={m} className={'model-opt' + (m === value ? ' active' : '')} onClick={() => { onChange(m); setOpen(false); }}>
                {m}{m === value && <Icon name="check" size={12} color="var(--accent)" />}
              </button>
            ))}
          </div>
        </>
      )}
    </span>
  );
}

/* "+" new session — pick the agent first, then a session is created. */
function NewSessionButton({ onCreate }) {
  const [open, setOpen] = React.useState(false);
  return (
    <span className="new-session-wrap">
      <button className="session-add" title="New session" onClick={() => setOpen((v) => !v)}><Icon name="plus" size={15} /></button>
      {open && (
        <>
          <div className="menu-scrim" onClick={() => setOpen(false)} />
          <div className="model-menu down">
            <div className="menu-head">New session with…</div>
            {AGENTS_LIST.map((m) => (
              <button key={m} className="model-opt" onClick={() => { onCreate(m); setOpen(false); }}>{m}</button>
            ))}
          </div>
        </>
      )}
    </span>
  );
}

function SessionTab({ s, active, onClick, onClose }) {
  const { StatusDot, ModelBadge } = window.CapiscoDesignSystem_026f1e;
  return (
    <div className={'session-tab' + (active ? ' active' : '')} onClick={onClick}>
      <StatusDot status={s.status} />
      <ModelBadge tone={active ? 'accent' : 'neutral'}>{s.model}</ModelBadge>
      <span className="st-title">{s.title}</span>
      <span className="st-meta">{s.meta}</span>
      <span className="st-x" title="Close session" onClick={(e) => { e.stopPropagation(); onClose && onClose(); }}>×</span>
    </div>
  );
}

function Msg({ role, who, children }) {
  return (
    <div className={'msg msg-' + role}>
      <div className="msg-role">{who || (role === 'user' ? 'You' : 'Claude')}</div>
      <div className="msg-body">{children}</div>
      <div className="msg-actions">
        <Icon name="rotate-ccw" size={13} color="var(--text-tertiary)" />
        <Icon name="copy" size={13} color="var(--text-tertiary)" />
        <Icon name="git-branch" size={13} color="var(--text-tertiary)" />
      </div>
    </div>
  );
}

function Transcript({ session, diffOpen, onToggleDiff, onOpenFile }) {
  const { ToolAction, PermissionPrompt } = window.CapiscoDesignSystem_026f1e;
  if (session.id === 's1') {
    return (
      <>
        <Msg role="user">Tear down the worktree when a session ends, and free its allocated port.</Msg>
        <Msg role="agent">
          I'll add a <code>teardown()</code> to <code>Worktree</code> and call it from
          {' '}<code>SessionTree.dispose()</code>. First, the edit:
        </Msg>
        <ToolAction kind="Edit" target="src/core/worktree.ts" added={12} removed={4} expanded={diffOpen} onToggle={onToggleDiff} onOpen={() => onOpenFile && onOpenFile('worktree.ts')}>
          <div className="diff-add">+  async teardown() {'{'}</div>
          <div className="diff-add">+    await this.broker.release(this.port);</div>
          <div className="diff-add">+    await rm(this.dir, {'{'} recursive: true {'}'});</div>
          <div className="diff-del">-    // TODO: free port</div>
        </ToolAction>
        <Msg role="agent">Now removing the temp worktree directory:</Msg>
        <PermissionPrompt command="Bash(rm -rf .worktrees/tmp)" label="Approval required" />
      </>
    );
  }
  if (session.id === 's2') {
    return (
      <>
        <Msg role="user">Refactor the broker so grants are immutable once issued.</Msg>
        <Msg role="agent" who="GPT-5">
          Plan: freeze the <code>Grant</code> record on issue and route revocations through a
          {' '}<code>tombstone</code> set. Want me to keep the existing <code>Map</code> API?
        </Msg>
        <Msg role="user">Yes, keep the API. Session is idle until you confirm.</Msg>
      </>
    );
  }
  if (session.id === 's3') {
    return (
      <>
        <Msg role="user">Where is the port allocated for a worktree?</Msg>
        <Msg role="agent" who="Local">
          Searching the workspace for <code>allocatePort</code> and <code>this.port</code> …
        </Msg>
        <ToolAction kind="Search" target='"where is port allocated?" · 7 hits' onOpen={() => onOpenFile && onOpenFile('worktree.ts')} />
        <PermissionPrompt command="Read(src/core/**, *.ts)" label="Approval required" scopes={['Once', 'This session', 'Deny']} />
      </>
    );
  }
  return (
    <div className="chat-empty">
      <Icon name="sparkles" size={24} color="var(--text-tertiary)" />
      <div className="ce-title">New session · {session.model}</div>
      <div className="ce-sub">Describe a task to start the agent.</div>
    </div>
  );
}

function AgentWorkspace({ onOpenFile, kind = 'agents' }) {
  const isChat = kind === 'chat';
  const seed = isChat ? window.CHAT_SESSIONS : window.SESSIONS;
  const { Input, IconButton } = window.CapiscoDesignSystem_026f1e;
  const [active, setActive] = React.useState(seed[0].id);
  const [diffOpen, setDiffOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [backend, setBackend] = React.useState('api');
  const [token, setToken] = React.useState('');
  const [model, setModel] = React.useState(isChat ? 'Sonnet 4.8' : 'Opus 4.8');
  const [effort, setEffort] = React.useState(3);
  const [budget, setBudget] = React.useState(200000);
  const [used] = React.useState(isChat ? 38000 : 172000);
  const [ctxDismiss, setCtxDismiss] = React.useState(false);
  const ratio = used / budget;
  const ctxCritical = ratio >= 0.85 && !ctxDismiss;
  const [extra, setExtra] = React.useState([]);
  const [closed, setClosed] = React.useState([]);
  const sessions = [...seed, ...extra].filter((s) => !closed.includes(s.id));
  const cur = sessions.find((s) => s.id === active) || sessions[0];
  const createSession = (agent) => {
    const id = 'n' + (extra.length + 1);
    setExtra((e) => [...e, { id, model: agent.split(' ')[0], title: isChat ? 'New chat' : 'New session', meta: 'idle', status: 'idle' }]);
    setActive(id);
  };
  const closeSession = (id) => {
    const remaining = sessions.filter((s) => s.id !== id);
    setExtra((e) => e.filter((x) => x.id !== id));
    setClosed((c) => (c.includes(id) ? c : [...c, id]));
    if (active === id && remaining.length) setActive(remaining[0].id);
  };

  return (
    <div className="agent-workspace">
      <div className="session-tabbar">
        <div className="session-tabs">
          {sessions.map((s) => (
            <SessionTab key={s.id} s={s} active={active === s.id} onClick={() => setActive(s.id)} onClose={() => closeSession(s.id)} />
          ))}
        </div>
        <NewSessionButton onCreate={createSession} />
        <button className={'session-gear' + (settingsOpen ? ' active' : '')} title={isChat ? 'Chat settings' : 'Agent backend settings'} onClick={() => setSettingsOpen((v) => !v)}>
          <Icon name="settings" size={15} />
        </button>
      </div>

      {!isChat && cur.subs && (
        <div className="subagent-row">
          <span className="branch-stub">└</span>
          {cur.subs.map((sub) => {
            const { StatusDot } = window.CapiscoDesignSystem_026f1e;
            return (
              <span key={sub.id} className="subagent-chip">
                <StatusDot status={sub.status} size={7} />
                {sub.title}<span className="sub-meta">{sub.meta}</span>
              </span>
            );
          })}
        </div>
      )}

      <div className="chat">
        <div className="chat-inner">
          {isChat
            ? <ChatTranscript session={cur} />
            : <Transcript session={cur} diffOpen={diffOpen} onToggleDiff={() => setDiffOpen(!diffOpen)} onOpenFile={onOpenFile} />}
        </div>
      </div>

      <div className="composer">
        <div className="composer-inner">
          {ctxCritical && (
            <div className="ctx-banner">
              <Icon name="triangle-alert" size={16} color="var(--error)" />
              <div className="ctx-banner-text"><b>Session is {Math.round(ratio * 100)}% of its token budget.</b> Long sessions cost more and dull responses — start a fresh one to keep it lean.</div>
              <div className="ctx-banner-actions">
                <button className="ctx-btn ctx-btn-primary" onClick={() => { createSession(model); setCtxDismiss(true); }}>New session</button>
                <button className="ctx-btn" onClick={() => setCtxDismiss(true)}>Keep going</button>
              </div>
            </div>
          )}
          <Input
            mono
            placeholder="Message Capisco…"
            trailing={<IconButton size={24} icon={<Icon name="arrow-up" size={15} color="var(--accent)" />} title="Send" />}
          />
          <ComposerBar
            model={model} setModel={setModel}
            effort={effort} setEffort={setEffort}
            used={used} budget={budget} setBudget={setBudget}
            statusText={isChat
              ? (backend === 'api' ? 'API' : 'CLI · claude 1.4.2') + ' · quick chat · no tools'
              : (backend === 'api' ? 'API' : 'CLI · claude 1.4.2') + ' · $0.04 · running 2m49s'}
          />
        </div>
      </div>

      {settingsOpen && (
        <AgentSettings
          backend={backend} setBackend={setBackend}
          token={token} setToken={setToken}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

/* Agent backend settings popover — API client (with token) or installed CLI. */
function AgentSettings({ backend, setBackend, token, setToken, onClose }) {
  const { Input, Button } = window.CapiscoDesignSystem_026f1e;
  return (
    <div className="agent-settings">
      <div className="as-head">
        <span className="caps">Agent backend</span>
        <button className="as-close" title="Close" onClick={onClose}><Icon name="x" size={14} color="var(--text-secondary)" /></button>
      </div>
      <div className="as-seg">
        <button className={'as-opt' + (backend === 'api' ? ' active' : '')} onClick={() => setBackend('api')}>API client</button>
        <button className={'as-opt' + (backend === 'cli' ? ' active' : '')} onClick={() => setBackend('cli')}>Installed CLI</button>
      </div>

      {backend === 'api' ? (
        <div className="as-body">
          <label className="as-label">Provider</label>
          <button className="as-select">Anthropic · Claude<Icon name="chevron-down" size={13} color="var(--text-secondary)" /></button>
          <label className="as-label">API token</label>
          <Input mono type="password" placeholder="sk-ant-…" value={token} onChange={(e) => setToken(e.target.value)} />
          <div className="as-note"><Icon name="lock" size={11} color="var(--text-tertiary)" />Stored in your OS keychain.</div>
          <Button variant="primary" size="md" style={{ width: '100%', marginTop: 2 }} onClick={onClose}>Save</Button>
        </div>
      ) : (
        <div className="as-body">
          <div className="as-detected"><Icon name="circle-check" size={14} color="var(--success)" />claude 1.4.2 detected</div>
          <div className="as-path">/usr/local/bin/claude</div>
          <div className="as-note">Capisco shells out to your installed CLI. No token stored.</div>
          <Button variant="default" size="md" style={{ width: '100%', marginTop: 2 }}>Re-detect CLI</Button>
        </div>
      )}
    </div>
  );
}

/* Alerts / Inspect tool panel — rendered as a side flyout (pin handled by host). */
function FlyoutPanel({ kind }) {
  const isAlerts = kind === 'alerts';
  const items = isAlerts ? window.ALERTS : window.INSPECTIONS;
  return (
    <div className="explorer">
      <div className="panel-head"><span className="caps">{isAlerts ? 'Alerts' : 'Inspections'}</span></div>
      <div className="flyout-body">
        {items.map((a, i) => (
          <div key={i} className="alert-item">
            <span className={'alert-dot sev-' + a.sev} />
            <div className="alert-text">
              <div className="alert-title">{a.title}</div>
              <div className="alert-sub">{a.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Chat workspace — a single lightweight conversation with Capisco.
   No session-tree, no subagents, no tool actions: a plain assistant chat. */
function ChatTranscript({ session }) {
  if (session.id === 'c2') {
    return (
      <>
        <Msg role="user">Explain the session-tree in one paragraph.</Msg>
        <Msg role="agent">A session is one model thread. Subagents are child sessions that share
          the parent's worktree-workspace, so they see the same files and grants but run their own
          context. The tree lets you fan out work and still review it in one place.</Msg>
      </>
    );
  }
  return (
    <>
      <Msg role="user">How does the capability broker decide when to prompt me?</Msg>
      <Msg role="agent">
        It checks the requested <code>(principal, capability, scope)</code> against existing grants.
        A cached <code>session</code> grant passes silently; anything broader — or a
        {' '}<code>production</code> datasource, or a secret — always escalates to a prompt.
      </Msg>
      <Msg role="user">Can I pre-approve read-only shell for this session?</Msg>
      <Msg role="agent">Yes — grant <code>Bash(read-only)</code> at <code>session</code> scope from
        the next prompt. Writes and network still escalate per-command.</Msg>
    </>
  );
}

/* Chat workspace — same component as Agents, different system (no tools/subagents). */
function ChatWorkspace() {
  return <AgentWorkspace kind="chat" />;
}

Object.assign(window, { AgentWorkspace, ChatWorkspace, ChatTranscript, AgentSettings, FlyoutPanel });
