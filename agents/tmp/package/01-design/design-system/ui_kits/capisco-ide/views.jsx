/* Capisco IDE kit — left-panel provider views: PR, Git dashboard, Search, Structure, Data. */

/* ---------- PR / Forge board ("whose turn is it?") ---------- */
function PRRow({ pr }) {
  return (
    <div className="pr-row">
      <span className={'pr-dot pr-' + pr.status} />
      <div className="pr-main">
        <div className="pr-title">{pr.title}{pr.stale && <span className="pr-stale">stale</span>}</div>
        <div className="pr-meta">{pr.repo} · @{pr.author} · {pr.age}{pr.reviewers ? ' · ' + pr.reviewers : ''}</div>
      </div>
    </div>
  );
}

function PRPanel() {
  const { IconButton } = window.CapiscoDesignSystem_026f1e;
  return (
    <div className="explorer">
      <div className="panel-head">
        <span className="caps">Pull Requests</span>
        <div className="ph-actions">
          <IconButton size={22} icon={<Icon name="filter" size={13} />} title="Filter" />
          <IconButton size={22} icon={<Icon name="refresh-cw" size={13} />} title="Refresh" />
        </div>
      </div>
      <div className="tree">
        <div className="sec-head"><Icon name="circle-alert" size={12} color="var(--warning)" />Your turn<span className="sec-count">{window.PRS.yourTurn.length}</span></div>
        {window.PRS.yourTurn.map((pr, i) => <PRRow key={i} pr={pr} />)}
        <div className="sec-head sec-head-2">Awaiting others<span className="sec-count">{window.PRS.awaiting.length}</span></div>
        {window.PRS.awaiting.map((pr, i) => <PRRow key={i} pr={pr} />)}
      </div>
    </div>
  );
}

/* ---------- Git dashboard (local-first personal metrics) ---------- */
function GitDashboard() {
  const { IconButton } = window.CapiscoDesignSystem_026f1e;
  const g = window.GIT_STATS;
  const [range, setRange] = React.useState('Week');
  const maxA = Math.max(...g.activity);
  return (
    <div className="explorer">
      <div className="panel-head">
        <span className="caps">Git · Activity</span>
        <div className="ph-actions">
          <IconButton size={22} icon={<Icon name="refresh-cw" size={13} />} title="Refresh" />
        </div>
      </div>
      <div className="gd-scroll">
        <div className="gd-range">
          {['Day', 'Week', 'Month'].map((r) => (
            <button key={r} className={'gd-rbtn' + (r === range ? ' active' : '')} onClick={() => setRange(r)}>{r}</button>
          ))}
        </div>
        <div className="gd-stats">
          <div className="gd-stat"><div className="gd-val">{g.commits}</div><div className="gd-lab">Commits</div></div>
          <div className="gd-stat"><div className="gd-val">{g.prsOpened} / {g.prsMerged}</div><div className="gd-lab">PRs open / merged</div></div>
        </div>
        <div className="gd-lines">
          <span className="gd-add">+{g.added.toLocaleString()}</span>
          <span className="gd-del">−{g.removed.toLocaleString()}</span>
          <span className="gd-lab">lines</span>
        </div>

        <div className="gd-section">Languages</div>
        {g.langs.map((l) => (
          <div className="gd-lang" key={l.name}>
            <div className="gd-lang-top"><span>{l.name}</span><span className="gd-pct">{l.pct}%</span></div>
            <div className="gd-bar"><div className="gd-fill" style={{ width: l.pct + '%', background: l.color }} /></div>
          </div>
        ))}

        <div className="gd-section">Commits / day</div>
        <div className="gd-chart">
          {g.activity.map((v, i) => (
            <div className="gd-col" key={i}>
              <div className="gd-coltrack"><div className="gd-colfill" style={{ height: (v / maxA * 100) + '%' }} /></div>
              <span className="gd-day">{g.days[i]}</span>
            </div>
          ))}
        </div>
        <div className="gd-note"><Icon name="info" size={11} color="var(--text-tertiary)" />Activity, not performance · stays on this machine</div>
      </div>
    </div>
  );
}

/* ---------- Global search (ripgrep) ---------- */
function SearchPanel() {
  const { Input } = window.CapiscoDesignSystem_026f1e;
  const s = window.SEARCH;
  const total = s.files.reduce((n, f) => n + f.hits.length, 0);
  return (
    <div className="explorer">
      <div className="sp-head">
        <Input mono leading={<Icon name="search" size={14} color="var(--text-tertiary)" />} defaultValue={s.query} />
        <Input mono leading={<Icon name="replace" size={14} color="var(--text-tertiary)" />} placeholder="Replace…" style={{ marginTop: 6 }} />
        <div className="sp-summary">{total} results in {s.files.length} files</div>
      </div>
      <div className="sp-scroll">
        {s.files.map((f, i) => (
          <div className="sp-file" key={i}>
            <div className="sp-fpath"><FileIcon ext="ts" /><span className="sp-fname">{f.path}</span><span className="sec-count">{f.hits.length}</span></div>
            {f.hits.map((h, j) => (
              <div className="sp-hit" key={j}>
                <span className="sp-ln">{h.ln}</span>
                <span className="sp-code">{h.before}<mark className="sp-mark">{h.match}</mark>{h.after}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Structure (symbols outline) ---------- */
function StructurePanel() {
  const { IconButton } = window.CapiscoDesignSystem_026f1e;
  return (
    <div className="explorer">
      <div className="panel-head">
        <span className="caps">Structure · broker.ts</span>
        <div className="ph-actions">
          <IconButton size={22} icon={<Icon name="arrow-down-up" size={13} />} title="Sort" />
          <IconButton size={22} icon={<Icon name="list-collapse" size={14} />} title="Collapse" />
        </div>
      </div>
      <div className="tree">
        {window.STRUCTURE.map((sym, i) => (
          <div className="struct-row" key={i} style={{ paddingLeft: 8 + sym.depth * 14 }}>
            <span className={'sym sym-' + sym.kind}>{sym.kind}</span>
            <span className="struct-name">{sym.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Datasource explorer (prod read-only invariant) ---------- */
function DataConn({ ds }) {
  const { TreeRow } = window.CapiscoDesignSystem_026f1e;
  const [open, setOpen] = React.useState(ds.env !== 'production');
  const envColor = ds.env === 'production' ? 'var(--warning)' : ds.env === 'staging' ? 'var(--accent)' : 'var(--text-secondary)';
  return (
    <>
      <div className="ds-conn" onClick={() => setOpen((v) => !v)}>
        <span className="tw-chevron">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(90deg)' : 'none' }}><path d="m9 18 6-6-6-6" /></svg>
        </span>
        <Icon name={ds.engine === 'redis' ? 'database-zap' : 'database'} size={14} color={envColor} />
        <span className="ds-name">{ds.name}</span>
        <span className="ds-engine">{ds.engine}</span>
        {ds.readonly && <span className="ds-ro"><Icon name="lock" size={10} color="var(--warning)" />read-only</span>}
      </div>
      {open && ds.tables.map((t, i) => (
        <TreeRow key={i} depth={1} icon={<Icon name="table-2" size={14} color="var(--text-secondary)" />} label={t}
          trailing={ds.readonly ? <Icon name="lock" size={11} color="var(--text-tertiary)" /> : null} />
      ))}
    </>
  );
}

function DataPanel() {
  const { IconButton } = window.CapiscoDesignSystem_026f1e;
  return (
    <div className="explorer">
      <div className="panel-head">
        <span className="caps">Database</span>
        <div className="ph-actions">
          <IconButton size={22} icon={<Icon name="plus" size={14} />} title="New connection" />
          <IconButton size={22} icon={<Icon name="refresh-cw" size={13} />} title="Refresh" />
        </div>
      </div>
      <div className="tree">
        {window.DATASOURCES.map((ds, i) => <DataConn key={i} ds={ds} />)}
      </div>
    </div>
  );
}

/* ---------- Detailed PR list (GitHub-like), used by the Git workspace ---------- */
function PRItem({ pr, reReview, overdueTab }) {
  const LC = window.LABEL_COLORS;
  const checks = { passing: { icon: 'circle-check', color: 'var(--success)', t: 'checks passing' }, failing: { icon: 'circle-x', color: 'var(--error)', t: 'checks failing' }, pending: { icon: 'circle-dot', color: 'var(--warning)', t: 'checks running' } }[pr.checks];
  const od = !pr.draft && pr.days > 3;
  const stateColor = pr.draft ? 'var(--text-tertiary)' : 'var(--accent)';
  const initials = (w) => (w === 'you' ? 'me' : w.slice(0, 2));
  const rev = { approved: 'var(--success)', changes: 'var(--error)', pending: 'var(--text-tertiary)' };
  return (
    <div className={'ghpr' + (reReview ? ' ghpr-hl' : '')}>
      <span className="ghpr-state" title={pr.draft ? 'draft' : 'open'}><Icon name="git-pull-request" size={16} color={stateColor} /></span>
      <div className="ghpr-main">
        <div className="ghpr-titleline">
          <span className="ghpr-title">{pr.title}</span>
          <span className="ghpr-num">#{pr.num}</span>
          {pr.draft && <span className="ghpr-tag ghpr-draft">draft</span>}
          {reReview && <span className="ghpr-tag ghpr-re">you reviewed before</span>}
          {(overdueTab || od) && !pr.draft && <span className="ghpr-tag ghpr-od">{pr.days}d ready</span>}
        </div>
        <div className="ghpr-meta">{pr.repo} <span className="ghpr-branch"><Icon name="git-branch" size={11} />{pr.branch}</span> · opened {pr.days}d ago by @{pr.author}</div>
        <div className="ghpr-labels">{pr.labels.map((l) => <span key={l} className="ghpr-label" style={{ color: LC[l] || 'var(--text-secondary)', borderColor: LC[l] || 'var(--border)' }}>{l}</span>)}</div>
      </div>
      <div className="ghpr-side">
        <span className="ghpr-checks" title={checks.t}><Icon name={checks.icon} size={13} color={checks.color} /></span>
        <div className="ghpr-revs">{pr.reviews.map((r, i) => <span key={i} className="ghpr-av" title={r.who + ' · ' + r.state} style={{ borderColor: rev[r.state] }}>{initials(r.who)}</span>)}</div>
        <div className="ghpr-stats"><span><Icon name="message-square" size={12} />{pr.comments}</span><span className="gd-add">+{pr.add}</span><span className="gd-del">−{pr.del}</span></div>
      </div>
    </div>
  );
}

function PRList({ list, highlightReReview, overdue, empty }) {
  if (!list.length) return <div className="ghpr-empty">{empty}</div>;
  return <div className="ghpr-list">{list.map((p) => <PRItem key={p.num} pr={p} reReview={highlightReReview && p.reviewedByMe} overdueTab={overdue} />)}</div>;
}

/* ---------- Git workspace (center, full-width activity dashboard) ---------- */
function GitWorkspace() {
  const { LineChart, Donut, MetricCard, ChartCard, Heatmap } = window;
  const g = window.GIT_STATS, S = window.GIT_SERIES, W = window.GIT_WEEKS;
  const [tab, setTab] = React.useState('mine');
  const [range, setRange] = React.useState('Week');
  const [coreStart, setCoreStart] = React.useState(9);
  const [coreEnd, setCoreEnd] = React.useState(17);
  const [from, setFrom] = React.useState('2026-03-24');
  const [to, setTo] = React.useState('2026-06-16');
  const [customOpen, setCustomOpen] = React.useState(false);
  const presets = ['All', 'Day', 'Week', 'Month'];
  const customActive = !presets.includes(range);
  const maxA = Math.max(...g.activity);
  const pad = (n) => String(n).padStart(2, '0');
  const PRS = window.GIT_PRS;
  const mine = PRS.filter((p) => p.author === 'you');
  const review = PRS.filter((p) => p.requested || p.reviewedByMe);
  const overdue = PRS.filter((p) => !p.draft && p.days > 3);
  const isActivity = tab === 'overview' || tab === 'activity' || tab === 'working';

  return (
    <div className="git-workspace">
      <div className="gitw-inner">
        <div className="gitw-head">
          <h2 className="gitw-title">Git Dashboard</h2>
          <div className="gitw-filter">
            <div className="gd-range gitw-range">
              {presets.map((r) => (
                <button key={r} className={'gd-rbtn' + (r === range ? ' active' : '')} onClick={() => setRange(r)}>{r}</button>
              ))}
              <div className="gitw-custom-wrap">
                <button className={'gd-rbtn gd-custom' + (customActive ? ' active' : '')} onClick={() => setCustomOpen((o) => !o)}>
                  {customActive && range !== 'Custom' ? range : 'Custom'}<Icon name="chevron-down" size={12} />
                </button>
                {customOpen && (
                  <>
                    <div className="menu-scrim" onClick={() => setCustomOpen(false)} />
                    <div className="date-pop">
                      <div className="dp-presets">
                        {['Today', 'Yesterday', 'This week', 'Last week', 'This month', 'Last month', 'This year'].map((p) => (
                          <button key={p} className={'dp-preset' + (range === p ? ' active' : '')} onClick={() => { setRange(p); setCustomOpen(false); }}>{p}</button>
                        ))}
                      </div>
                      <div className="dp-custom">
                        <label>From</label><input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setRange('Custom'); }} />
                        <label>To</label><input type="date" value={to} onChange={(e) => { setTo(e.target.value); setRange('Custom'); }} />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="gitw-tabs">
          {[['mine', 'My PRs', mine.length], ['review', 'Review Requested', review.length], ['overdue', 'Overdue', overdue.length], ['team', 'Team', window.AWARENESS.length], ['overview', 'Overview'], ['activity', 'Activity'], ['working', 'Working Times']].map(([id, label, count]) => (
            <button key={id} className={'gitw-tab' + (tab === id ? ' active' : '')} onClick={() => setTab(id)}>{label}{count != null && <span className="gitw-tcount">{count}</span>}</button>
          ))}
        </div>

        {tab === 'mine' && <PRList list={mine} empty="No open PRs in your projects." />}
        {tab === 'review' && <PRList list={review} highlightReReview empty="No reviews awaiting you." />}
        {tab === 'overdue' && <PRList list={overdue} overdue empty="Nothing overdue — nice." />}
        {tab === 'team' && <TeamTab />}

        {tab === 'overview' && (
          <>
            <div className="mc-row">{window.GIT_DORA.map((m, i) => <MetricCard key={i} m={m} />)}</div>
            <div className="gitw-cols">
              <ChartCard title="Cycle Time Trend"><LineChart data={S.cycleTime} labels={W} color="var(--accent)" height={170} /></ChartCard>
              <ChartCard title="PR Categories"><Donut segments={window.PR_CATEGORIES} /></ChartCard>
            </div>
          </>
        )}

        {tab === 'activity' && (
          <>
            <div className="gd-stats gitw-stats">
              <div className="gd-stat"><div className="gd-val">{g.commits}</div><div className="gd-lab">Commits</div></div>
              <div className="gd-stat"><div className="gd-val">{g.prsOpened} / {g.prsMerged}</div><div className="gd-lab">PRs open / merged</div></div>
              <div className="gd-stat"><div className="gd-val gitw-lines"><span className="gd-add">+{g.added.toLocaleString()}</span> <span className="gd-del">−{g.removed.toLocaleString()}</span></div><div className="gd-lab">Lines changed</div></div>
            </div>
            <div className="gitw-cols">
              <ChartCard title="Commits per week"><LineChart data={S.commits} labels={W} height={150} /></ChartCard>
              <ChartCard title="PRs merged per week"><LineChart data={S.prsMerged} labels={W} height={150} /></ChartCard>
              <ChartCard title="Lines changed per week"><LineChart data={S.loc} labels={W} height={150} fmt={(v) => v + 'k'} /></ChartCard>
              <ChartCard title="Reviews given per week"><LineChart data={S.reviews} labels={W} height={150} /></ChartCard>
            </div>
            <div className="gitw-cols">
              <ChartCard title="Languages">
                {g.langs.map((l) => (
                  <div className="gd-lang" key={l.name}>
                    <div className="gd-lang-top"><span>{l.name}</span><span className="gd-pct">{l.pct}%</span></div>
                    <div className="gd-bar"><div className="gd-fill" style={{ width: l.pct + '%', background: l.color }} /></div>
                  </div>
                ))}
              </ChartCard>
              <ChartCard title="Commits / day">
                <div className="gd-chart">
                  {g.activity.map((v, i) => (
                    <div className="gd-col" key={i}>
                      <div className="gd-coltrack"><div className="gd-colfill" style={{ height: (v / maxA * 100) + '%' }} /></div>
                      <span className="gd-day">{g.days[i]}</span>
                    </div>
                  ))}
                </div>
              </ChartCard>
            </div>
          </>
        )}

        {tab === 'working' && (
          <>
            <div className="wt-controls">
              <span className="wt-lab">Working hours</span>
              <select className="wt-sel" value={coreStart} onChange={(e) => setCoreStart(+e.target.value)}>
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{pad(h)}:00</option>)}
              </select>
              <span className="wt-dash">–</span>
              <select className="wt-sel" value={coreEnd} onChange={(e) => setCoreEnd(+e.target.value)}>
                {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => <option key={h} value={h}>{pad(h)}:00</option>)}
              </select>
              <span className="wt-hint">Activity outside these hours shows red.</span>
            </div>
            <ChartCard title="Activity heatmap">
              <div className="wt-sub">Commits (author time), PR reviews &amp; creation, Jira / Linear activity. Darker = more activity.</div>
              <Heatmap grid={window.WORK_HEATMAP} coreStart={coreStart} coreEnd={coreEnd} />
              <div className="wt-legend">
                <span className="wt-leg"><span className="wt-sw" style={{ background: 'rgba(46,168,90,0.85)' }} />Core hours ({pad(coreStart)}:00–{pad(coreEnd)}:00)</span>
                <span className="wt-leg"><span className="wt-sw" style={{ background: 'rgba(231,76,60,0.85)' }} />Off-hours / weekend</span>
              </div>
            </ChartCard>
          </>
        )}

        <div className="gd-note"><Icon name="info" size={11} color="var(--text-tertiary)" />Activity, not performance · stays on this machine · never compared across people</div>
      </div>
    </div>
  );
}

function DiffView({ onClose }) {
  const d = window.DIFF;
  const [split, setSplit] = React.useState(true);
  return (
    <div className="diffview">
      <div className="dv-head">
        <FileIcon ext="ts" />
        <span className="dv-file">{d.file}</span>
        <span className="dv-stat"><span className="gd-add">+{d.added}</span> <span className="gd-del">−{d.removed}</span></span>
        <div className="tb-spacer" />
        <div className="dv-toggle">
          <button className={split ? 'active' : ''} onClick={() => setSplit(true)}>Split</button>
          <button className={!split ? 'active' : ''} onClick={() => setSplit(false)}>Unified</button>
        </div>
        <button className="dv-close" title="Close diff" onClick={onClose}><Icon name="x" size={15} color="var(--text-secondary)" /></button>
      </div>
      <div className="dv-body">
        {split ? (
          <div className="dv-split">
            {d.rows.map((row, i) => (
              <div className="dv-line" key={i}>
                <div className={'dv-cell' + (row.k === 'del' ? ' del' : (row.k === 'add' && !row.l ? ' filler' : ''))}>
                  {row.l ? <><span className="dv-ln">{row.l.n}</span><span className="dv-code">{row.l.t}</span></> : <span className="dv-ln" />}
                </div>
                <div className={'dv-cell' + (row.k === 'add' ? ' add' : (row.k === 'del' && !row.r ? ' filler' : ''))}>
                  {row.r ? <><span className="dv-ln">{row.r.n}</span><span className="dv-code">{row.r.t}</span></> : <span className="dv-ln" />}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="dv-unified">
            {d.rows.map((row, i) => {
              const ln = row.k === 'add' ? row.r.n : row.l.n;
              const text = row.k === 'add' ? row.r.t : row.l.t;
              const sign = row.k === 'add' ? '+' : row.k === 'del' ? '−' : ' ';
              return (
                <div className={'dv-uline ' + row.k} key={i}>
                  <span className="dv-ln">{ln}</span><span className="dv-sign">{sign}</span><span className="dv-code">{text}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Docker / container management (ctop-like), grouped by project ---------- */
function ContainerRow({ c }) {
  return (
    <div className="ct-row">
      <span className={'ct-dot ct-' + c.status} />
      <div className="ct-main">
        <div className="ct-top"><span className="ct-name">{c.name}</span><span className="ct-image">{c.image}</span></div>
        <div className="ct-meta">{c.status === 'exited' ? 'exited' : <><b>{c.cpu}%</b> cpu · {c.mem} · {c.ports}</>}</div>
        {c.status === 'running' && <div className="ct-bar"><div className="ct-fill" style={{ width: c.cpu + '%' }} /></div>}
      </div>
      <button className="ct-console" title={c.status === 'running' ? 'Open console (exec -it)' : 'Start'}>
        <Icon name={c.status === 'running' ? 'square-terminal' : 'play'} size={14} color="var(--text-secondary)" />
      </button>
    </div>
  );
}

function ContainerPanel() {
  const { IconButton } = window.CapiscoDesignSystem_026f1e;
  const [collapsed, setCollapsed] = React.useState({});
  const toggle = (p) => setCollapsed((c) => ({ ...c, [p]: !c[p] }));
  return (
    <div className="explorer">
      <div className="panel-head">
        <span className="caps">Services</span>
        <div className="ph-actions">
          <IconButton size={22} icon={<Icon name="play" size={13} />} title="Start all" />
          <IconButton size={22} icon={<Icon name="refresh-cw" size={13} />} title="Refresh" />
        </div>
      </div>
      <div className="tree">
        {window.CONTAINER_GROUPS.map((g, gi) => {
          const running = g.services.filter((s) => s.status === 'running').length;
          const open = !collapsed[g.project];
          return (
            <div key={gi}>
              <div className="ws-group" onClick={() => toggle(g.project)}>
                <Icon name="chevron-down" size={12} color="var(--text-secondary)" style={{ transform: open ? 'none' : 'rotate(-90deg)' }} />
                <Icon name="folder" size={13} color="var(--text-secondary)" />
                <span className="ws-group-name">{g.project}</span>
                <span className="ct-grpcount">{running}/{g.services.length} up</span>
              </div>
              {open && g.services.map((c, i) => <ContainerRow key={i} c={c} />)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Task board (Jira / Linear) ---------- */
function TaskRow({ t }) {
  return (
    <div className="task-row">
      <span className={'task-type tt-' + t.type}>{t.type === 'bug' ? 'B' : 'F'}</span>
      <div className="task-main">
        <div className="task-title">{t.title}</div>
        <div className="task-meta">{t.id} · {t.points} pts</div>
      </div>
      <button className="task-run" title="Start in a worktree"><Icon name="play" size={13} color="var(--accent)" /></button>
    </div>
  );
}

function TaskPanel() {
  const { IconButton } = window.CapiscoDesignSystem_026f1e;
  const T = window.TASKS;
  return (
    <div className="explorer">
      <div className="panel-head">
        <span className="caps">Tasks · Sprint 24</span>
        <div className="ph-actions">
          <IconButton size={22} icon={<Icon name="filter" size={13} />} title="Filter" />
          <IconButton size={22} icon={<Icon name="refresh-cw" size={13} />} title="Refresh" />
        </div>
      </div>
      <div className="tree">
        <div className="sec-head">In Progress<span className="sec-count">{T.progress.length}</span></div>
        {T.progress.map((t) => <TaskRow key={t.id} t={t} />)}
        <div className="sec-head sec-head-2">In Review<span className="sec-count">{T.review.length}</span></div>
        {T.review.map((t) => <TaskRow key={t.id} t={t} />)}
        <div className="sec-head sec-head-2">To do<span className="sec-count">{T.todo.length}</span></div>
        {T.todo.map((t) => <TaskRow key={t.id} t={t} />)}
      </div>
    </div>
  );
}

/* ---------- Changes vs a base branch ---------- */
function ChangesPanel({ onOpenDiff }) {
  const { TreeRow, GitMarker, IconButton } = window.CapiscoDesignSystem_026f1e;
  const branches = window.COMPARE_BRANCHES;
  const defaultRole = window.CHANGES_HAS_PR ? 'target' : 'parent';
  const initial = (branches.find((b) => b.role === defaultRole) || branches[0]).id;
  const [base, setBase] = React.useState(initial);
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const cur = branches.find((b) => b.id === base) || branches[0];
  const filtered = branches.filter((b) => b.name.toLowerCase().includes(q.toLowerCase()));
  const cs = window.CHANGESET;
  const tot = cs.reduce((a, c) => ({ add: a.add + c.add, del: a.del + c.del }), { add: 0, del: 0 });
  return (
    <div className="explorer">
      <div className="panel-head">
        <span className="caps">Changes</span>
        <div className="ph-actions">
          <IconButton size={22} icon={<Icon name="refresh-cw" size={13} />} title="Refresh" />
        </div>
      </div>
      <div className="ch-compare">
        <div className="ch-combo">
          <button className="ch-sel" onClick={() => { setOpen((o) => !o); setQ(''); }}>
            <span className="ch-selname">{cur.name}</span>
            {cur.role && <span className="ch-role">{cur.role}</span>}
            <Icon name="chevron-down" size={12} color="var(--text-tertiary)" />
          </button>
          {open && (
            <>
              <div className="menu-scrim" onClick={() => setOpen(false)} />
              <div className="ch-pop">
                <div className="ch-search">
                  <Icon name="search" size={12} color="var(--text-tertiary)" />
                  <input autoFocus placeholder="Find branch…" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                <div className="ch-opts">
                  {filtered.map((b) => (
                    <button key={b.id} className={'ch-opt' + (b.id === base ? ' active' : '')} onClick={() => { setBase(b.id); setOpen(false); }}>
                      <Icon name="git-branch" size={12} color="var(--text-tertiary)" />
                      <span className="ch-optname">{b.name}</span>
                      {b.role && <span className="ch-role">{b.role}</span>}
                      {b.id === base && <Icon name="check" size={12} color="var(--accent)" />}
                    </button>
                  ))}
                  {!filtered.length && <div className="ch-noopt">No branches match</div>}
                </div>
              </div>
            </>
          )}
        </div>
        <Icon name="arrow-right" size={12} color="var(--text-tertiary)" />
        <span className="ch-cur" title="feat/worktree-teardown"><Icon name="git-branch" size={11} color="var(--accent)" />current</span>
      </div>
      <div className="ch-summary">{cs.length} files changed · <span className="gd-add">+{tot.add}</span> <span className="gd-del">−{tot.del}</span></div>
      <div className="tree">
        {cs.map((c, i) => (
          <TreeRow
            key={i}
            depth={0}
            icon={<FileIcon ext={c.ext} />}
            label={c.name}
            onClick={() => onOpenDiff && onOpenDiff(c.name)}
            trailing={<span className="ch-row-meta"><span className="ch-stat"><span className="gd-add">+{c.add}</span> <span className="gd-del">−{c.del}</span></span><GitMarker status={c.git} /></span>}
          />
        ))}
      </div>
    </div>
  );
}

/* ---------- Team awareness (git.live-style) ---------- */
function AwarenessRow({ a, by }) {
  return (
    <div className="aw-row">
      <span className={'aw-av' + (a.status === 'active' ? ' on' : '')}>{a.who.slice(0, 2)}</span>
      <div className="aw-main">
        <div className="aw-top"><b>{a.who}</b> <span className="aw-act">{a.act}</span> <span className="aw-when">· {a.when}</span></div>
        <div className="aw-where"><Icon name={by === 'pr' ? 'git-pull-request' : 'git-branch'} size={11} color="var(--accent)" />{by === 'pr' ? a.pr + ' · ' + a.branch : a.branch}</div>
        <div className="aw-files">{a.files.map((f) => <span key={f} className={'aw-file' + (a.overlap === f ? ' clash' : '')}>{f}</span>)}</div>
        {a.overlap && <div className="aw-warn"><Icon name="triangle-alert" size={11} color="var(--warning)" />overlaps your uncommitted {a.overlap}</div>}
      </div>
      <div className="aw-actions">
        <button className="aw-btn" title="View their diff"><Icon name="eye" size={13} color="var(--text-secondary)" /></button>
        <button className="aw-btn aw-cp" title="Cherry-pick their changes"><Icon name="git-branch-plus" size={13} />Cherry-pick</button>
      </div>
    </div>
  );
}

function TeamTab() {
  const aw = window.AWARENESS;
  const [by, setBy] = React.useState('pr');
  return (
    <>
      <div className="team-bar">
        <span className="team-hint">Who's working where — live across open work</span>
        <div className="as-seg team-seg">
          <button className={'as-opt' + (by === 'pr' ? ' active' : '')} onClick={() => setBy('pr')}>By PR</button>
          <button className={'as-opt' + (by === 'branch' ? ' active' : '')} onClick={() => setBy('branch')}>By branch</button>
        </div>
      </div>
      <div className="aw-list">{aw.map((a, i) => <AwarenessRow key={i} a={a} by={by} />)}</div>
    </>
  );
}

/* ---------- Tasks workspace (Jira / Linear dashboard, center) ---------- */
function TicketCard({ t, compact, onOpen }) {
  const typeTag = { feature: 'F', bug: 'B', chore: 'C' }[t.type] || 'F';
  return (
    <div className={'tkt' + (compact ? ' tkt-compact' : '')} onClick={() => onOpen && onOpen(t)}>
      <div className="tkt-top">
        <span className={'task-type tt-' + t.type}>{typeTag}</span>
        <span className="tkt-id">{t.id}</span>
        {t.mine && <span className="tkt-mine">mine</span>}
        <span className="tkt-pts">{t.points}</span>
      </div>
      <div className="tkt-title">{t.title}</div>
      {!compact && <div className="tkt-who"><span className="tkt-av">{t.who === 'you' ? 'me' : (t.who === '—' ? '·' : t.who.slice(0, 2))}</span>{t.who}</div>}
    </div>
  );
}

/* Linear-style board card: id + avatar, type icon + title, labels, footer (PR / subtasks). */
function LinearCard({ t, onOpen }) {
  const typeColor = { feature: 'var(--accent)', bug: 'var(--error)', chore: 'var(--text-tertiary)' }[t.type];
  const av = t.who === 'you' ? 'me' : (t.who === '—' ? '·' : t.who.slice(0, 2));
  return (
    <div className="lc-card" onClick={() => onOpen && onOpen(t)}>
      <div className="lc-top">
        <span className="lc-id">{t.id}</span>
        <span className="lc-av" title={t.who}>{av}</span>
      </div>
      <div className="lc-title">{t.title}</div>
      <div className="lc-labels">
        <span className="lc-pri"><Icon name="bar-chart-3" size={11} color="var(--text-tertiary)" /></span>
        <span className="lc-label" style={{ color: typeColor, borderColor: typeColor }}>{t.type}</span>
        {t.mine && <span className="lc-label lc-mine">mine</span>}
      </div>
      {(t.branch || t.sub) && (
        <div className="lc-foot">
          {t.branch && <span className="lc-pr"><Icon name="git-pull-request" size={11} color="var(--text-tertiary)" />{t.branch}</span>}
          {t.sub && <span className="lc-sub"><Icon name="circle-dashed" size={11} color="var(--text-tertiary)" />{t.sub}</span>}
          <span className="lc-pts">{t.points}</span>
        </div>
      )}
    </div>
  );
}

/* ---------- Ticket detail (opens in its own tab) ---------- */
function TicketDetail({ t, onOpenTicket }) {
  const { Button, Input } = window.CapiscoDesignSystem_026f1e;
  const [editing, setEditing] = React.useState(false);
  const [desc, setDesc] = React.useState(
    'When a session ends, the worktree must be torn down and its allocated port released back to the broker pool. Currently the port leaks on crash.\n\nAcceptance:\n• teardown() releases the port\n• temp worktree dir is removed\n• covered by a test'
  );
  const [comments, setComments] = React.useState([
    { who: 'mara', when: '2d ago', text: 'Make sure release() is idempotent — dispose() can run twice on crash recovery.' },
    { who: 'you', when: '1d ago', text: 'Good catch. Added a guard + a test for double-dispose.' },
  ]);
  const [draft, setDraft] = React.useState('');
  const statusLabel = { backlog: 'Backlog', todo: 'To do', progress: 'In Progress', review: 'Review', testing: 'Testing', done: 'Done' }[t.status];
  const typeColor = { feature: 'var(--accent)', bug: 'var(--error)', chore: 'var(--text-tertiary)' }[t.type];
  const addComment = () => { if (!draft.trim()) return; setComments((c) => [...c, { who: 'you', when: 'now', text: draft.trim() }]); setDraft(''); };

  return (
    <div className="git-workspace">
      <div className="gitw-inner td-inner">
        <div className="td-bc">tasks <span className="sep">›</span> {t.id}</div>
        <div className="td-grid">
          <div className="td-main">
            <h2 className="td-title">{t.title}</h2>
            <div className="td-sub"><span className="td-id">{t.id}</span> · opened by @{t.who === 'you' ? 'you' : t.who} · {window.SPRINT.name}</div>

            <div className="td-section">
              <div className="td-sechead">Description<button className="td-edit" onClick={() => setEditing((v) => !v)}><Icon name={editing ? 'check' : 'pencil'} size={12} />{editing ? 'Save' : 'Edit'}</button></div>
              {editing
                ? <textarea className="td-descedit" value={desc} onChange={(e) => setDesc(e.target.value)} />
                : <div className="td-desc">{desc.split('\n').map((l, i) => <p key={i}>{l || '\u00a0'}</p>)}</div>}
            </div>

            <div className="td-section">
              <div className="td-sechead">Activity · {comments.length} comments</div>
              <div className="td-comments">
                {comments.map((c, i) => (
                  <div className="td-comment" key={i}>
                    <span className="td-cav">{c.who === 'you' ? 'me' : c.who.slice(0, 2)}</span>
                    <div className="td-cbody">
                      <div className="td-cmeta"><b>{c.who}</b> · {c.when}</div>
                      <div className="td-ctext">{c.text}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="td-compose">
                <textarea placeholder="Write a comment…" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addComment(); }} />
                <div className="td-composeactions">
                  <span className="td-hint">⌘↵ to send</span>
                  <Button variant="primary" size="md" onClick={addComment}>Comment</Button>
                </div>
              </div>
            </div>
          </div>

          <aside className="td-side">
            <div className="td-field"><label>Status</label><div className="td-val"><span className={'tk-actdot st-' + t.status} />{statusLabel}</div></div>
            <div className="td-field"><label>Assignee</label><div className="td-val"><span className="td-cav sm">{t.who === 'you' ? 'me' : t.who.slice(0, 2)}</span>{t.who}</div></div>
            <div className="td-field"><label>Type</label><div className="td-val"><span className="lc-label" style={{ color: typeColor, borderColor: typeColor }}>{t.type}</span></div></div>
            <div className="td-field"><label>Points</label><div className="td-val">{t.points}</div></div>
            <div className="td-field"><label>Epic</label><div className="td-val">{(window.TICKET_EPICS.find((e) => e.id === t.epic) || {}).label || '—'}</div></div>
            {t.branch && <div className="td-field"><label>Pull request</label><div className="td-val td-link"><Icon name="git-pull-request" size={12} color="var(--accent)" />{t.branch}</div></div>}
            {t.sub && <div className="td-field"><label>Sub-tasks</label><div className="td-val">{t.sub}</div></div>}
            <div className="td-actions">
              <Button variant="primary" size="md" style={{ width: '100%' }}><Icon name="git-branch-plus" size={13} />Create branch</Button>
              <Button variant="default" size="md" style={{ width: '100%', marginTop: 6 }}><Icon name="git-branch" size={13} />Start in a worktree</Button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function TaskDashboard() {
  const [open, setOpen] = React.useState([]);   // open ticket ids
  const [view, setView] = React.useState('overview');
  const openTicket = (t) => { setOpen((o) => (o.includes(t.id) ? o : [...o, t.id])); setView(t.id); };
  const closeTicket = (id) => {
    setOpen((o) => o.filter((x) => x !== id));
    setView((v) => (v === id ? 'overview' : v));
  };
  const byId = (id) => window.TICKETS.find((t) => t.id === id);
  return (
    <div className="tk-workspace">
      <div className="tk-tabbar">
        <button className={'tk-tab' + (view === 'overview' ? ' active' : '')} onClick={() => setView('overview')}>
          <Icon name="layout-dashboard" size={13} />Overview
        </button>
        {open.map((id) => (
          <button key={id} className={'tk-tab' + (view === id ? ' active' : '')} onClick={() => setView(id)}>
            <span className="tk-tabid">{id}</span>
            <span className="tk-tabx" title="Close" onClick={(e) => { e.stopPropagation(); closeTicket(id); }}>×</span>
          </button>
        ))}
      </div>
      <div className="tk-tabbody">
        {view === 'overview' ? <TaskOverview onOpenTicket={openTicket} />
          : <TicketDetail t={byId(view)} onOpenTicket={openTicket} />}
      </div>
    </div>
  );
}

function TaskOverview({ onOpenTicket }) {
  const { BurndownChart, ChartCard, LineChart, Donut, MetricCard } = window;
  const T = window.TICKETS, COLS = window.TICKET_COLUMNS, S = window.SPRINT, B = window.BURNDOWN;
  const [tab, setTab] = React.useState('board');
  const mine = T.filter((t) => t.mine);
  const active = T.filter((t) => t.mine && ['progress', 'review', 'testing'].includes(t.status));
  const pct = Math.round((S.done / S.committed) * 100);
  const myCommitted = mine.reduce((a, t) => a + t.points, 0);
  const myDone = mine.filter((t) => t.status === 'done').reduce((a, t) => a + t.points, 0);
  const myWip = T.filter((t) => t.mine && t.status === 'progress').length;
  const reviewReq = T.filter((t) => t.status === 'review' && !t.mine).length + 2;

  return (
    <div className="git-workspace">
      <div className="gitw-inner gitw-wide">
        <div className="gitw-head">
          <h2 className="gitw-title">Tasks · {S.name}</h2>
          <div className="tk-sprintmeta">Day {S.day}/{S.days} · {S.done}/{S.committed} pts · {pct}%</div>
        </div>

        <div className="gitw-tabs">
          {[['board', 'Board'], ['mine', 'My Tickets', mine.length], ['active', 'Active', active.length], ['burndown', 'Insights']].map(([id, label, count]) => (
            <button key={id} className={'gitw-tab' + (tab === id ? ' active' : '')} onClick={() => setTab(id)}>{label}{count != null && <span className="gitw-tcount">{count}</span>}</button>
          ))}
        </div>

        {tab === 'board' && (
          <div className="lb">
            <div className="lb-head">
              {COLS.map((c) => {
                const cnt = T.filter((t) => t.status === c.id).length;
                return <div className="lb-col-h" key={c.id}><span className={'tk-actdot st-' + c.id} />{c.label}<span className="lb-colcount">{cnt}</span></div>;
              })}
            </div>
            {window.TICKET_EPICS.map((ep) => {
              const epItems = T.filter((t) => t.epic === ep.id);
              if (!epItems.length) return null;
              return (
                <div className="lb-lane" key={ep.id}>
                  <div className="lb-lanehead"><Icon name="chevron-down" size={12} color="var(--text-secondary)" /><Icon name="layers" size={12} color="var(--text-tertiary)" />{ep.label}<span className="lb-colcount">{epItems.length}</span></div>
                  <div className="lb-row">
                    {COLS.map((c) => (
                      <div className="lb-cell" key={c.id}>
                        {epItems.filter((t) => t.status === c.id).map((t) => <LinearCard key={t.id} t={t} onOpen={onOpenTicket} />)}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'mine' && (
          <div className="tk-cols tk-cols-3">
            {COLS.filter((c) => mine.some((t) => t.status === c.id)).map((c) => {
              const items = mine.filter((t) => t.status === c.id);
              const pts = items.reduce((a, t) => a + t.points, 0);
              return (
                <div className="tk-actgroup" key={c.id}>
                  <div className="tk-acthead"><span className={'tk-actdot st-' + c.id} />{c.label}<span className="tk-colcount">{items.length} · {pts}p</span></div>
                  {items.map((t) => <TicketCard key={t.id} t={t} onOpen={onOpenTicket} />)}
                </div>
              );
            })}
          </div>
        )}

        {tab === 'active' && (
          <div className="tk-cols tk-cols-3">
            {['progress', 'review', 'testing'].map((st) => {
              const items = active.filter((t) => t.status === st);
              const label = { progress: 'In Progress', review: 'Review', testing: 'Testing' }[st];
              return (
                <div className="tk-actgroup" key={st}>
                  <div className="tk-acthead"><span className={'tk-actdot st-' + st} />{label}<span className="tk-colcount">{items.length}</span></div>
                  {items.length ? items.map((t) => <TicketCard key={t.id} t={t} onOpen={onOpenTicket} />) : <div className="tk-empty">Nothing here</div>}
                </div>
              );
            })}
          </div>
        )}

        {tab === 'burndown' && (
          <div className="tk-insights">
            <div className="mc-row mc-row-4">
              <MetricCard m={{ label: 'My WIP', value: myWip + ' / 3', sub: 'In progress vs your limit', tier: myWip > 3 ? 'Low' : 'High' }} />
              <MetricCard m={{ label: 'Throughput', value: '12 pts', sub: 'Closed this week', delta: '↑ 2', good: true }} />
              <MetricCard m={{ label: 'Reviews requested', value: String(reviewReq), sub: 'Awaiting your review' }} />
              <MetricCard m={{ label: 'Avg cycle time', value: '61 h', sub: 'First commit → merge', delta: '↓ 12%', good: true }} />
            </div>

            <div className="gitw-cols">
              <ChartCard title="Sprint burndown">
                <BurndownChart ideal={B.ideal} actual={B.team} />
                <div className="bd-legend"><span><span className="bd-sw bd-ideal" />Ideal</span><span><span className="bd-sw bd-actual" />Remaining ({S.committed - S.done} of {S.committed})</span></div>
              </ChartCard>
              <ChartCard title="My burndown">
                <BurndownChart ideal={B.myIdeal} actual={B.mine} accent="var(--syn-control)" />
                <div className="bd-legend"><span><span className="bd-sw bd-ideal" />Ideal</span><span><span className="bd-sw bd-actual bd-mine" />Remaining ({myCommitted - myDone} of {myCommitted})</span></div>
              </ChartCard>
            </div>

            <div className="gitw-cols">
              <ChartCard title="My WIP over sprint">
                <LineChart data={window.MY_WIP_SERIES} labels={['d0','d1','d2','d3','d4','d5','d6']} height={140} />
                <div className="bd-legend"><span className="tk-wiphint">WIP limit 3 — keep flow steady, avoid context-switching</span></div>
              </ChartCard>
              <ChartCard title="Team WIP">
                <div className="wip-bars">
                  {window.TEAM_WIP.map((w) => (
                    <div className="wip-row" key={w.who}>
                      <span className="wip-who">{w.who === 'you' ? 'you' : w.who}</span>
                      <div className="wip-track">
                        <div className={'wip-fill' + (w.wip > w.limit ? ' over' : '')} style={{ width: (w.wip / w.limit * 100) + '%' }} />
                      </div>
                      <span className="wip-val">{w.wip}/{w.limit}</span>
                    </div>
                  ))}
                </div>
              </ChartCard>
            </div>

            <div className="gitw-cols">
              <ChartCard title="Reviews given / day">
                <LineChart data={window.REVIEWS_GIVEN} labels={['d0','d1','d2','d3','d4','d5','d6']} height={140} color="var(--warning)" />
              </ChartCard>
              <ChartCard title="Throughput (tickets closed / day)">
                <div className="tp-bars">
                  {window.THROUGHPUT.map((v, i) => (
                    <div className="tp-col" key={i}>
                      <div className="tp-track"><div className="tp-fill" style={{ height: (v / 3 * 100) + '%' }} /></div>
                      <span className="tp-day">d{i}</span>
                    </div>
                  ))}
                </div>
              </ChartCard>
              <ChartCard title="Work type split">
                <Donut segments={window.TASK_TYPE_SPLIT} size={130} />
              </ChartCard>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { PRItem, PRList, PRPanel, GitDashboard, GitWorkspace, SearchPanel, StructurePanel, DataPanel, ContainerPanel, TaskPanel, TaskDashboard, TaskOverview, TicketDetail, DiffView, ChangesPanel, AwarenessRow, TeamTab });
