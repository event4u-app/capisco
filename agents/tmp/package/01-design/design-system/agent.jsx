/* Capisco IDE kit — Agents workspace (session tabs + full-width chat) + flyout. */

const AGENTS_LIST = ['Claude Sonnet', 'Claude Opus', 'GPT-5', 'Local'];

/* Composer model selector — choose the model, nothing else. */
function ModelPicker({ value, onChange }) {
  const [open, setOpen] = React.useState(false);
  return (
    <span className="model-pick-wrap">
      <button className="model-pick" onClick={() => setOpen((v) => !v)}>{value}<Icon name="chevron-down" size={12} /></button>
      {open &&
      <>
          <div className="menu-scrim" onClick={() => setOpen(false)} />
          <div className="model-menu up">
            {AGENTS_LIST.map((m) =>
          <button key={m} className={'model-opt' + (m === value ? ' active' : '')} onClick={() => {onChange(m);setOpen(false);}}>
                {m}{m === value && <Icon name="check" size={12} color="var(--accent)" />}
              </button>
          )}
          </div>
        </>
      }
    </span>);

}

/* "+" new session — pick the agent first, then a session is created. */
function NewSessionButton({ onCreate }) {
  const [open, setOpen] = React.useState(false);
  return (
    <span className="new-session-wrap">
      <button className="session-add" title="New session" onClick={() => setOpen((v) => !v)}><Icon name="plus" size={15} /></button>
      {open &&
      <>
          <div className="menu-scrim" onClick={() => setOpen(false)} />
          <div className="model-menu down">
            <div className="menu-head">New session with…</div>
            {AGENTS_LIST.map((m) =>
          <button key={m} className="model-opt" onClick={() => {onCreate(m);setOpen(false);}}>{m}</button>
          )}
          </div>
        </>
      }
    </span>);

}

function SessionTab({ s, active, onClick }) {
  const { StatusDot, ModelBadge } = window.CapiscoDesignSystem_026f1e;
  return (
    <div className={'session-tab' + (active ? ' active' : '')} onClick={onClick}>
      <StatusDot status={s.status} />
      <ModelBadge tone={active ? 'accent' : 'neutral'}>{s.model}</ModelBadge>
      <span className="st-title">{s.title}</span>
      <span className="st-meta">{s.meta}</span>
    </div>);

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
    </div>);

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
      </>);

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
      </>);

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
      </>);

  }
  return (
    <div className="chat-empty">
      <Icon name="sparkles" size={24} color="var(--text-tertiary)" />
      <div className="ce-title">New session · {session.model}</div>
      <div className="ce-sub">Describe a task to start the agent.</div>
    </div>);

}

function AgentWorkspace({ onOpenFile }) {
  const { Input, IconButton } = window.CapiscoDesignSystem_026f1e;
  const [active, setActive] = React.useState('s1');
  const [diffOpen, setDiffOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [backend, setBackend] = React.useState('api');
  const [token, setToken] = React.useState('');
  const [model, setModel] = React.useState('Claude Sonnet');
  const [extra, setExtra] = React.useState([]);
  const sessions = [...window.SESSIONS, ...extra];
  const cur = sessions.find((s) => s.id === active) || sessions[0];
  const createSession = (agent) => {
    const id = 'n' + (extra.length + 1);
    setExtra((e) => [...e, { id, model: agent.split(' ')[0], title: 'New session', meta: 'idle', status: 'idle' }]);
    setActive(id);
  };

  return (
    <div className="agent-workspace">
      <div className="session-tabbar">
        <div className="session-tabs">
          {sessions.map((s) =>
          <SessionTab key={s.id} s={s} active={active === s.id} onClick={() => setActive(s.id)} />
          )}
        </div>
        <NewSessionButton onCreate={createSession} />
        <button className={'session-gear' + (settingsOpen ? ' active' : '')} title="Agent backend settings" onClick={() => setSettingsOpen((v) => !v)}>
          <Icon name="settings" size={15} />
        </button>
      </div>

      {cur.subs &&
      <div className="subagent-row">
          <span className="branch-stub">└</span>
          {cur.subs.map((sub) => {
          const { StatusDot } = window.CapiscoDesignSystem_026f1e;
          return (
            <span key={sub.id} className="subagent-chip">
                <StatusDot status={sub.status} size={7} />
                {sub.title}<span className="sub-meta">{sub.meta}</span>
              </span>);

        })}
        </div>
      }

      <div className="chat">
        <div className="chat-inner">
          <Transcript session={cur} diffOpen={diffOpen} onToggleDiff={() => setDiffOpen(!diffOpen)} onOpenFile={onOpenFile} />
        </div>
      </div>

      <div className="composer">
        <div className="composer-inner">
          <Input
            mono
            placeholder="Message Capisco…"
            leading={<ModelPicker value={model} onChange={setModel} />}
            trailing={<IconButton size={24} icon={<Icon name="arrow-up" size={15} color="var(--accent)" />} title="Send" />} />
          
          <div className="agent-footer">
            <span>{backend === 'api' ? 'API · ' + (token ? 'token set' : 'no token') : 'CLI · claude 1.4.2'}</span>
            <span className="sep">·</span> Tokens: 6.5k <span className="sep">·</span> Cost: $0.04 <span className="sep">·</span> running 2m49s
          </div>
        </div>
      </div>

      {settingsOpen &&
      <AgentSettings
        backend={backend} setBackend={setBackend}
        token={token} setToken={setToken}
        onClose={() => setSettingsOpen(false)} />

      }
    </div>);

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

      {backend === 'api' ?
      <div className="as-body">
          <label className="as-label">Provider</label>
          <button className="as-select">Anthropic · Claude<Icon name="chevron-down" size={13} color="var(--text-secondary)" /></button>
          <label className="as-label">API token</label>
          <Input mono type="password" placeholder="sk-ant-…" value={token} onChange={(e) => setToken(e.target.value)} />
          <div className="as-note"><Icon name="lock" size={11} color="var(--text-tertiary)" />Stored in your OS keychain.</div>
          <Button variant="primary" size="md" style={{ width: '100%', marginTop: 2 }} onClick={onClose}>Save</Button>
        </div> :

      <div className="as-body">
          <div className="as-detected"><Icon name="circle-check" size={14} color="var(--success)" />claude 1.4.2 detected</div>
          <div className="as-path">/usr/local/bin/claude</div>
          <div className="as-note">Capisco shells out to your installed CLI. No token stored.</div>
          <Button variant="default" size="md" style={{ width: '100%', marginTop: 2 }}>Re-detect CLI</Button>
        </div>
      }
    </div>);

}

/* Alerts / Inspect flyout — overlays the right of the workspace; pinnable. */
function Flyout({ kind, pinned, onPin, onClose }) {
  const { IconButton } = window.CapiscoDesignSystem_026f1e;
  const isAlerts = kind === 'alerts';
  const items = isAlerts ? window.ALERTS : window.INSPECTIONS;
  return (
    <div className="flyout">
      <div className="flyout-head">
        <span className="caps">{isAlerts ? 'Alerts' : 'Inspections'}</span>
        <div className="ph-actions">
          <IconButton size={22} active={pinned} icon={<Icon name="pin" size={13} />} title="Pin" onClick={onPin} />
          <IconButton size={22} icon={<Icon name="x" size={14} />} title="Close" onClick={onClose} />
        </div>
      </div>
      <div className="flyout-body">
        {items.map((a, i) =>
        <div key={i} className="alert-item">
            <span className={'alert-dot sev-' + a.sev} />
            <div className="alert-text">
              <div className="alert-title">{a.title}</div>
              <div className="alert-sub">{a.sub}</div>
            </div>
          </div>
        )}
      </div>
    </div>);

}

Object.assign(window, { AgentWorkspace, AgentSettings, Flyout });