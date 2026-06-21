/* Capisco IDE kit — chrome: TitleBar, draggable tool bars, StatusBar.
   Tools open a flyout on whichever bar their icon lives; workspace buttons
   (Agents / Editor / Git / Terminal) are fixed and switch the workspace. */

const DS = () => window.CapiscoDesignSystem_026f1e || {};

function TitleBar({ theme, onToggleTheme }) {
  const { IconButton } = DS();
  return (
    <div className="titlebar">
      <div className="tb-traffic"><span className="tl tl-r" /><span className="tl tl-y" /><span className="tl tl-g" /></div>
      <img className="tb-mark" src="../../assets/capisco-mark.svg" width="18" height="18" alt="" />
      <button className="tb-chip">capisco<Icon name="chevron-down" size={13} /></button>
      <button className="tb-chip tb-branch"><Icon name="git-branch" size={13} />feat/worktree-teardown<Icon name="chevron-down" size={13} /></button>
      <div className="tb-spacer" />
      <IconButton icon={<Icon name="play" size={15} />} title="Run" />
      <button className="tb-chip tb-run">Dev<Icon name="chevron-down" size={13} /></button>
      <IconButton icon={<Icon name="search" size={15} />} title="Search everywhere" />
      <IconButton icon={<Icon name={theme === 'light' ? 'moon' : 'sun'} size={15} />} title="Toggle theme" onClick={onToggleTheme} />
      <IconButton icon={<Icon name="ellipsis" size={15} />} title="More" />
      <IconButton icon={<Icon name="settings" size={15} />} title="Settings" />
    </div>
  );
}

/* Registry of draggable tools (each opens a side flyout). */
const TOOLS = {
  explorer: { icon: 'files', label: 'Explorer' },
  changes: { icon: 'file-diff', label: 'Changes' },
  commit: { icon: 'git-compare', label: 'Commit' },
  pr: { icon: 'git-pull-request', label: 'PR' },
  tasks: { icon: 'list-checks', label: 'Tasks' },
  search: { icon: 'search', label: 'Search' },
  structure: { icon: 'list-tree', label: 'Structure' },
  data: { icon: 'database', label: 'Data' },
  services: { icon: 'container', label: 'Services' },
  alerts: { icon: 'bell', label: 'Alerts' },
  inspect: { icon: 'scan-search', label: 'Inspect' },
};

function ToolBtn({ id, region, index, active, onSelect, onMove }) {
  const t = TOOLS[id];
  const [over, setOver] = React.useState(false);
  const [menu, setMenu] = React.useState(false);
  const targets = [['lefttop', 'Top of left bar', 'panel-top'], ['leftbottom', 'Bottom of left bar', 'panel-bottom'], ['right', 'Right bar', 'panel-right']];
  const side = region === 'right' ? 'right' : 'left';
  return (
    <div className="ab-itemwrap">
      <button
        className={'ab-item' + (active ? ' active' : '') + (over ? ' ab-over' : '')}
        title={t.label} draggable
        onClick={onSelect}
        onContextMenu={(e) => { e.preventDefault(); setMenu((m) => !m); }}
        onDragStart={(e) => { e.dataTransfer.setData('cap-tool', id); e.dataTransfer.effectAllowed = 'move'; }}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setOver(false); const d = e.dataTransfer.getData('cap-tool'); if (d && d !== id) onMove(d, region, index); }}
      >
        <Icon name={t.icon} size={18} />
        <span className="ab-label">{t.label}</span>
      </button>
      {menu && (
        <>
          <div className="menu-scrim" onClick={() => setMenu(false)} onContextMenu={(e) => { e.preventDefault(); setMenu(false); }} />
          <div className={'ab-menu ' + side}>
            <div className="ab-menu-head">Move “{t.label}”</div>
            {targets.filter(([r]) => r !== region).map(([r, label, icon]) => (
              <button key={r} className="ab-menu-item" onClick={() => { setMenu(false); onMove(id, r, 99); }}><Icon name={icon} size={13} />{label}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* A left-bar item: a tool OR the Terminal toggle. Draggable + a drop target
   that inserts the dragged item immediately before it. */
function LeftItem({ id, group, active, terminalOpen, onSelect, onToggleTerm, onDropBefore }) {
  const isTerm = id === '__terminal__';
  const t = isTerm ? { icon: 'square-terminal', label: 'Terminal' } : TOOLS[id];
  const [over, setOver] = React.useState(false);
  return (
    <div className="ab-itemwrap"
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const d = e.dataTransfer.getData('cap-tool'); if (d && d !== id) onDropBefore(d, group, id); }}>
      <button
        className={'ab-item' + ((active || (isTerm && terminalOpen)) ? ' active' : '') + (over ? ' ab-over' : '')}
        title={t.label} draggable
        onClick={isTerm ? onToggleTerm : onSelect}
        onDragStart={(e) => { e.dataTransfer.setData('cap-tool', id); e.dataTransfer.effectAllowed = 'move'; }}>
        <Icon name={t.icon} size={18} />
        <span className="ab-label">{t.label}</span>
      </button>
    </div>
  );
}

/* Left bar: a single ordered list of tools + the Terminal toggle. Whatever sits
   ABOVE Terminal opens in the top pane, BELOW it in the bottom pane. Terminal is
   itself draggable, so its position sets the split boundary. */
function ActivityBar({ leftTop, leftBottom, topActive, botActive, onSelect, onToggleTerm, onReorder, terminalOpen }) {
  const item = (id, group) => (
    <LeftItem key={id} id={id} group={group}
      active={id === topActive || id === botActive}
      terminalOpen={terminalOpen}
      onSelect={() => onSelect(id)}
      onToggleTerm={onToggleTerm}
      onDropBefore={onReorder} />
  );
  return (
    <div className="activitybar left">
      {leftTop.map((id) => item(id, 'top'))}
      <div className="ab-fill"
        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('ab-filldrop'); }}
        onDragLeave={(e) => e.currentTarget.classList.remove('ab-filldrop')}
        onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('ab-filldrop'); const d = e.dataTransfer.getData('cap-tool'); if (d) onReorder(d, 'top', null); }} />
      {leftBottom.map((id) => item(id, 'bottom'))}
      <div className={'ab-fillbottom' + (leftBottom.length ? ' filled' : '')}
        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('ab-filldrop'); }}
        onDragLeave={(e) => e.currentTarget.classList.remove('ab-filldrop')}
        onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('ab-filldrop'); const d = e.dataTransfer.getData('cap-tool'); if (d) onReorder(d, 'bottom', null); }} />
    </div>
  );
}

/* Right bar: fixed workspace toggles + a top tool group, fill, bottom tool group. */
function RightRail({ mode, onMode, rightTop, rightBottom, topActive, botActive, onSelect, onReorder }) {
  const item = (id, group) => (
    <LeftItem key={id} id={id} group={group}
      active={id === topActive || id === botActive}
      onSelect={() => onSelect(id)} onDropBefore={onReorder} />
  );
  return (
    <div className="activitybar right">
      <div className="ab-top-fixed">
        <button className={'ab-item' + (mode === 'agents' ? ' active' : '')} title="Agents" onClick={() => onMode('agents')}><Icon name="bot" size={18} /><span className="ab-label">Agents</span></button>
        <button className={'ab-item' + (mode === 'chat' ? ' active' : '')} title="Chat" onClick={() => onMode('chat')}><Icon name="message-square" size={18} /><span className="ab-label">Chat</span></button>
        <button className={'ab-item' + (mode === 'editor' ? ' active' : '')} title="Editor" onClick={() => onMode('editor')}><Icon name="square-code" size={18} /><span className="ab-label">Editor</span></button>
        <button className={'ab-item' + (mode === 'git' ? ' active' : '')} title="Git" onClick={() => onMode('git')}><Icon name="git-graph" size={18} /><span className="ab-label">Git</span></button>
        <button className={'ab-item' + (mode === 'tasks' ? ' active' : '')} title="Tasks" onClick={() => onMode('tasks')}><Icon name="kanban" size={18} /><span className="ab-label">Tasks</span></button>
      </div>
      <div className="ab-div" />
      {rightTop.map((id) => item(id, 'rtop'))}
      <div className="ab-fill"
        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('ab-filldrop'); }}
        onDragLeave={(e) => e.currentTarget.classList.remove('ab-filldrop')}
        onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('ab-filldrop'); const d = e.dataTransfer.getData('cap-tool'); if (d) onReorder(d, 'rtop', null); }} />
      {rightBottom.map((id) => item(id, 'rbot'))}
      <div className={'ab-fillbottom' + (rightBottom.length ? ' filled' : '')}
        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('ab-filldrop'); }}
        onDragLeave={(e) => e.currentTarget.classList.remove('ab-filldrop')}
        onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('ab-filldrop'); const d = e.dataTransfer.getData('cap-tool'); if (d) onReorder(d, 'rbot', null); }} />
    </div>
  );
}

function StatusBar({ mode }) {
  return (
    <div className="statusbar">
      <span className="sb-crumb">
        {mode === 'agents' ? 'agents › Claude › Implement worktree teardown'
          : mode === 'git' ? 'git › activity · this week'
          : mode === 'tasks' ? 'tasks › sprint 24'
          : mode === 'diff' ? 'diff › src › core › worktree.ts'
          : 'capisco › src › core › broker.ts'}
      </span>
      <div className="tb-spacer" />
      <span className="sb-item">TypeScript 5.4</span>
      <span className="sb-item"><Icon name="git-branch" size={12} />feat/worktree-teardown <span className="up">↑2</span></span>
      <span className="sb-item">Blame: matze 2d ago</span>
      <span className="sb-item">Ln 24, Col 8</span>
      <span className="sb-item">LF</span>
      <span className="sb-item">UTF-8</span>
      <span className="sb-item sb-brand"><Icon name="check" size={12} color="var(--accent)" />capisco</span>
    </div>
  );
}

Object.assign(window, { TitleBar, ActivityBar, RightRail, StatusBar, TOOLS });
