/* Capisco IDE kit — chrome: TitleBar, left ActivityBar, RightRail, StatusBar. */

const DS = () => window.CapiscoDesignSystem_026f1e || {};

function TitleBar({ theme, onToggleTheme }) {
  const { IconButton } = DS();
  return (
    <div className="titlebar">
      <div className="tb-traffic"><span className="tl tl-r" /><span className="tl tl-y" /><span className="tl tl-g" /></div>
      <img className="tb-mark" src="../../assets/capisco-mark.svg" width="18" height="18" alt="" />
      <button className="tb-chip">capisco<Icon name="chevron-down" size={13} /></button>
      <button className="tb-chip tb-branch"><Icon name="git-branch" size={13} />main<Icon name="chevron-down" size={13} /></button>
      <div className="tb-spacer" />
      <IconButton icon={<Icon name="play" size={15} />} title="Run" />
      <button className="tb-chip tb-run">Dev<Icon name="chevron-down" size={13} /></button>
      <IconButton icon={<Icon name="search" size={15} />} title="Search everywhere" />
      <IconButton icon={<Icon name={theme === 'light' ? 'moon' : 'sun'} size={15} />} title="Toggle theme" onClick={onToggleTheme} />
      <IconButton icon={<Icon name="ellipsis" size={15} />} title="More" />
      <IconButton icon={<Icon name="settings" size={15} />} title="Settings" />
    </div>);

}

const LEFT_NAV = [
{ id: 'explorer', icon: 'files', label: 'Explorer' },
{ id: 'commit', icon: 'git-compare', label: 'Commit' },
{ id: 'pr', icon: 'git-pull-request', label: 'PR' },
{ id: 'tasks', icon: 'list-checks', label: 'Tasks' },
{ id: 'search', icon: 'search', label: 'Search' },
{ id: 'structure', icon: 'list-tree', label: 'Structure' },
{ id: 'data', icon: 'database', label: 'Data' },
{ id: 'services', icon: 'container', label: 'Services' }];


function ActivityBar({ items, active, onSelect }) {
  return (
    <div className="activitybar left">
      {items.map((it) =>
      <button key={it.id} className={'ab-item' + (active === it.id ? ' active' : '')} title={it.label} onClick={() => onSelect(it.id)}>
          <Icon name={it.icon} size={18} />
          <span className="ab-label">{it.label}</span>
        </button>
      )}
    </div>);

}

/* Far-right rail: workspace toggle (Agents / Editor) + flyout buttons (Alerts / Inspect). */
function RightRail({ mode, onMode, flyout, onFlyout }) {
  const Item = ({ icon, label, active, onClick }) =>
  <button className={'ab-item' + (active ? ' active' : '')} title={label} onClick={onClick}>
      <Icon name={icon} size={18} />
      <span className="ab-label">{label}</span>
    </button>;

  return (
    <div className="activitybar right">
      <Item icon="bot" label="Agents" active={mode === 'agents'} onClick={() => onMode('agents')} />
      <Item icon="square-code" label="Editor" active={mode === 'editor'} onClick={() => onMode('editor')} />
      <Item icon="git-graph" label="Git" active={mode === 'git'} onClick={() => onMode('git')} />
      <div className="ab-div" />
      <Item icon="bell" label="Alerts" active={flyout === 'alerts'} onClick={() => onFlyout('alerts')} />
      <Item icon="scan-search" label="Inspect" active={flyout === 'inspect'} onClick={() => onFlyout('inspect')} />
    </div>);

}

function StatusBar({ mode }) {
  return (
    <div className="statusbar">
      <span className="sb-crumb">
        {mode === 'agents' ?
        'agents › Claude › Implement worktree teardown' :
        mode === 'git' ?
        'git › activity · this week' :
        'capisco › src › core › broker.ts'}
      </span>
      <div className="tb-spacer" />
      <span className="sb-item">TypeScript 5.4</span>
      <span className="sb-item"><Icon name="git-branch" size={12} />main <span className="up">↑2</span></span>
      <span className="sb-item">Blame: matze 2d ago</span>
      <span className="sb-item">Ln 24, Col 8</span>
      <span className="sb-item">LF</span>
      <span className="sb-item">UTF-8</span>
      <span className="sb-item sb-brand"><Icon name="check" size={12} color="var(--accent)" />capisco</span>
    </div>);

}

Object.assign(window, { TitleBar, ActivityBar, RightRail, StatusBar, LEFT_NAV });