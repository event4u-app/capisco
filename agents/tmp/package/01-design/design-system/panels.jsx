/* Capisco IDE kit — left panel (multi-project Explorer + Work Stash) and Terminal. */

function ProjectRoot({ p, onToggle }) {
  return (
    <div className={'proj-root' + (p.selected ? ' selected' : '')} onClick={onToggle}>
      <span className="tw-chevron">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: p.expanded ? 'rotate(90deg)' : 'none' }}><path d="m9 18 6-6-6-6" /></svg>
      </span>
      <Icon name="folder" size={15} color="var(--text-secondary)" />
      <span className="proj-name">{p.name}</span>
      <span className="proj-path">— {p.path}</span>
      <span className="proj-branch">
        <Icon name="git-branch" size={11} color="var(--text-tertiary)" />
        {p.branch}{p.tracking ? <span className="proj-track">{p.tracking}</span> : null}
      </span>
    </div>);

}

function FileExplorer() {
  const { TreeRow, GitMarker, IconButton } = window.CapiscoDesignSystem_026f1e;
  const [open, setOpen] = React.useState(() => Object.fromEntries(window.PROJECTS.map((p) => [p.id, p.expanded])));
  const [scratchOpen, setScratchOpen] = React.useState(true);
  const toggle = (id) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  return (
    <div className="explorer">
      <div className="panel-head">
        <span className="caps">Project<Icon name="chevron-down" size={12} color="var(--text-tertiary)" style={{ marginLeft: 4 }} /></span>
        <div className="ph-actions">
          <IconButton size={22} icon={<Icon name="plus" size={14} />} title="Add project to workspace" />
          <IconButton size={22} icon={<Icon name="list-collapse" size={14} />} title="Collapse all" />
          <IconButton size={22} icon={<Icon name="refresh-cw" size={13} />} title="Refresh" />
        </div>
      </div>
      <div className="tree">
        {window.PROJECTS.map((p) =>
        <React.Fragment key={p.id}>
            <ProjectRoot p={{ ...p, expanded: open[p.id] }} onToggle={() => toggle(p.id)} />
            {open[p.id] && p.files.map((n, i) =>
          <TreeRow
            key={i}
            depth={n.depth}
            expandable={n.expandable}
            expanded={n.expanded}
            active={n.active}
            muted={n.muted}
            icon={<FileIcon ext={n.ext} open={n.expanded} />}
            label={n.name}
            trailing={n.git ? <GitMarker status={n.git} /> : null} />

          )}
          </React.Fragment>
        )}

        <TreeRow depth={0} expandable expanded={false} icon={<Icon name="library" size={15} color="var(--text-secondary)" />} label="External Libraries" muted />

        <TreeRow
          depth={0}
          expandable
          expanded={scratchOpen}
          onClick={() => setScratchOpen((v) => !v)}
          icon={<Icon name="history" size={15} color="var(--accent)" />}
          label="Scratches and Consoles" />
        
        {scratchOpen && window.SCRATCH.map((s, i) =>
        <TreeRow key={i} depth={1} icon={<FileIcon ext={s.ext} />} label={s.name} />
        )}
      </div>
    </div>);

}

/* Work Stash — Local Changes (grouped by project) + Shelf, switchable via tabs. */
function WorkStash({ onOpenDiff }) {
  const { TreeRow, GitMarker, IconButton, Button, Input } = window.CapiscoDesignSystem_026f1e;
  const [tab, setTab] = React.useState('changes');
  return (
    <div className="workstash">
      <div className="ws-tabs">
        <button className={'ws-tab' + (tab === 'changes' ? ' active' : '')} onClick={() => setTab('changes')}>Local Changes</button>
        <button className={'ws-tab' + (tab === 'shelf' ? ' active' : '')} onClick={() => setTab('shelf')}>Shelf</button>
        <div className="tb-spacer" />
        <IconButton size={22} icon={<Icon name="refresh-cw" size={13} />} title="Refresh" />
        <IconButton size={22} icon={<Icon name="ellipsis" size={14} />} title="More" />
      </div>

      {tab === 'changes' ?
      <>
          <div className="ws-scroll">
            <div className="ws-subhead"><Icon name="chevron-down" size={12} color="var(--text-secondary)" />Changes<span className="ws-count">{window.CHANGE_GROUPS.reduce((n, g) => n + g.files.length, 0)}</span></div>
            {window.CHANGE_GROUPS.map((g, gi) =>
          <React.Fragment key={gi}>
                <div className="ws-group-head">
                  <Icon name="chevron-down" size={11} color="var(--text-tertiary)" />
                  <span className="ws-group-name">{g.project}</span>
                  <span className="ws-group-branch">{g.branch}</span>
                </div>
                {g.files.map((c, i) =>
            <TreeRow
              key={i}
              depth={1}
              icon={<FileIcon ext={c.ext} />}
              label={c.name}
              onClick={() => onOpenDiff && onOpenDiff(c.name)}
              trailing={<span className="ws-row-meta"><span className="ws-path">{c.path}</span><GitMarker status={c.git} /></span>} />

            )}
              </React.Fragment>
          )}
          </div>
          <div className="ws-commit">
            <Input placeholder="Commit message…" inputStyle={{ fontSize: '12px' }} />
            <div className="ws-commit-actions">
              <Button variant="primary" size="md" style={{ flex: 1 }}><Icon name="check" size={14} />Commit</Button>
              <Button variant="default" size="md">Commit and Push…</Button>
            </div>
          </div>
        </> :

      <div className="ws-scroll">
          {window.SHELF.map((s, i) =>
        <div key={i} className="shelf-row">
              <Icon name="inbox" size={14} color="var(--text-secondary)" />
              <div className="shelf-text">
                <div className="shelf-name">{s.name}</div>
                <div className="shelf-meta">{s.meta}</div>
              </div>
            </div>
        )}
        </div>
      }
    </div>);

}

const TERM_TABS = ['Local', 'Py2Ts', 'Evidence'];

/* Minimal placeholder for left-rail views not built out in this mock. */
function PanelPlaceholder({ title }) {
  return (
    <div className="panel-placeholder">
      <Icon name="package-open" size={24} color="var(--text-tertiary)" />
      <div className="pp-title">{title}</div>
      <div className="pp-sub">Not wired in this mock</div>
    </div>);

}

function Terminal() {
  const { IconButton } = window.CapiscoDesignSystem_026f1e;
  const [active, setActive] = React.useState('Evidence');
  return (
    <div className="terminal">
      <div className="term-tabbar">
        <div className="term-tools">
          <IconButton size={22} icon={<Icon name="square-terminal" size={14} />} title="Terminal" />
          <IconButton size={22} icon={<Icon name="trash-2" size={13} />} title="Kill" />
        </div>
        <div className="term-tabs">
          {TERM_TABS.map((t) =>
          <button key={t} className={'term-tab' + (t === active ? ' active' : '')} onClick={() => setActive(t)}>{t}</button>
          )}
          <button className="term-tab term-add" title="New terminal"><Icon name="plus" size={13} /></button>
        </div>
      </div>
      <div className="term-body">
        <div className="t-line"><span className="t-prompt">~/dev/capisco ❯</span> pnpm test core/broker</div>
        <div className="t-line t-dim">$ vitest run src/core/broker.test.ts</div>
        <div className="t-line"><span className="t-ok">✓</span> broker · grants scoped capability once <span className="t-dim">(4 ms)</span></div>
        <div className="t-line"><span className="t-ok">✓</span> broker · denies revoked principal <span className="t-dim">(2 ms)</span></div>
        <div className="t-line"><span className="t-ok">✓</span> broker · escalates to prompt on unknown scope <span className="t-dim">(6 ms)</span></div>
        <div className="t-line t-dim">Test Files  1 passed (1)</div>
        <div className="t-line"><span className="t-ok">✓</span> 3 passed <span className="t-dim">· 312ms</span></div>
        <div className="t-line"><span className="t-prompt">~/dev/capisco ❯</span> <span className="t-caret" /></div>
      </div>
    </div>);

}

Object.assign(window, { FileExplorer, WorkStash, Terminal, PanelPlaceholder });