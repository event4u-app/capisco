/* @ds-bundle: {"format":3,"namespace":"CapiscoDesignSystem_026f1e","components":[{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"Input","sourcePath":"components/core/Input.jsx"},{"name":"EditorTab","sourcePath":"components/ide/EditorTab.jsx"},{"name":"PermissionPrompt","sourcePath":"components/ide/PermissionPrompt.jsx"},{"name":"ToolAction","sourcePath":"components/ide/ToolAction.jsx"},{"name":"TreeRow","sourcePath":"components/ide/TreeRow.jsx"},{"name":"GitMarker","sourcePath":"components/indicators/GitMarker.jsx"},{"name":"ModelBadge","sourcePath":"components/indicators/ModelBadge.jsx"},{"name":"StatusDot","sourcePath":"components/indicators/StatusDot.jsx"}],"sourceHashes":{"agent.jsx":"97f37454ad82","chrome.jsx":"68877ac341b1","components/core/Button.jsx":"28593341aa9b","components/core/IconButton.jsx":"cc5843997797","components/core/Input.jsx":"02f16f2ae171","components/ide/EditorTab.jsx":"c3a17507a10b","components/ide/PermissionPrompt.jsx":"20e5f37b2ede","components/ide/ToolAction.jsx":"ca027dc86470","components/ide/TreeRow.jsx":"3d7deefa7bd9","components/indicators/GitMarker.jsx":"55dfe12c741c","components/indicators/ModelBadge.jsx":"9aaac6f7737a","components/indicators/StatusDot.jsx":"1294e550df0a","panels.jsx":"e9a2dc91ff50","ui_kits/capisco-ide/agent.jsx":"7ef123ca9aff","ui_kits/capisco-ide/charts.jsx":"bc423edd4e1a","ui_kits/capisco-ide/chrome.jsx":"5990609ae5c2","ui_kits/capisco-ide/editor.jsx":"4e5e7cb49433","ui_kits/capisco-ide/panels.jsx":"82ae7dcb0e24","ui_kits/capisco-ide/shared.jsx":"cd382631a14e","ui_kits/capisco-ide/views.jsx":"d823affbf5ed"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.CapiscoDesignSystem_026f1e = window.CapiscoDesignSystem_026f1e || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// agent.jsx
try { (() => {
/* Capisco IDE kit — Agents workspace (session tabs + full-width chat) + flyout. */

const AGENTS_LIST = ['Claude Sonnet', 'Claude Opus', 'GPT-5', 'Local'];

/* Composer model selector — choose the model, nothing else. */
function ModelPicker({
  value,
  onChange
}) {
  const [open, setOpen] = React.useState(false);
  return /*#__PURE__*/React.createElement("span", {
    className: "model-pick-wrap"
  }, /*#__PURE__*/React.createElement("button", {
    className: "model-pick",
    onClick: () => setOpen(v => !v),
    "data-comment-anchor": "a9f6616bb2-button-10-7"
  }, value, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-down",
    size: 12
  })), open && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "menu-scrim",
    onClick: () => setOpen(false)
  }), /*#__PURE__*/React.createElement("div", {
    className: "model-menu up"
  }, AGENTS_LIST.map(m => /*#__PURE__*/React.createElement("button", {
    key: m,
    className: 'model-opt' + (m === value ? ' active' : ''),
    onClick: () => {
      onChange(m);
      setOpen(false);
    }
  }, m, m === value && /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 12,
    color: "var(--accent)"
  }))))));
}

/* "+" new session — pick the agent first, then a session is created. */
function NewSessionButton({
  onCreate
}) {
  const [open, setOpen] = React.useState(false);
  return /*#__PURE__*/React.createElement("span", {
    className: "new-session-wrap"
  }, /*#__PURE__*/React.createElement("button", {
    className: "session-add",
    title: "New session",
    onClick: () => setOpen(v => !v)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 15
  })), open && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "menu-scrim",
    onClick: () => setOpen(false)
  }), /*#__PURE__*/React.createElement("div", {
    className: "model-menu down"
  }, /*#__PURE__*/React.createElement("div", {
    className: "menu-head"
  }, "New session with\u2026"), AGENTS_LIST.map(m => /*#__PURE__*/React.createElement("button", {
    key: m,
    className: "model-opt",
    onClick: () => {
      onCreate(m);
      setOpen(false);
    }
  }, m)))));
}
function SessionTab({
  s,
  active,
  onClick
}) {
  const {
    StatusDot,
    ModelBadge
  } = window.CapiscoDesignSystem_026f1e;
  return /*#__PURE__*/React.createElement("div", {
    className: 'session-tab' + (active ? ' active' : ''),
    onClick: onClick
  }, /*#__PURE__*/React.createElement(StatusDot, {
    status: s.status
  }), /*#__PURE__*/React.createElement(ModelBadge, {
    tone: active ? 'accent' : 'neutral'
  }, s.model), /*#__PURE__*/React.createElement("span", {
    className: "st-title"
  }, s.title), /*#__PURE__*/React.createElement("span", {
    className: "st-meta"
  }, s.meta));
}
function Msg({
  role,
  who,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: 'msg msg-' + role
  }, /*#__PURE__*/React.createElement("div", {
    className: "msg-role"
  }, who || (role === 'user' ? 'You' : 'Claude')), /*#__PURE__*/React.createElement("div", {
    className: "msg-body"
  }, children), /*#__PURE__*/React.createElement("div", {
    className: "msg-actions"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "rotate-ccw",
    size: 13,
    color: "var(--text-tertiary)"
  }), /*#__PURE__*/React.createElement(Icon, {
    name: "copy",
    size: 13,
    color: "var(--text-tertiary)"
  }), /*#__PURE__*/React.createElement(Icon, {
    name: "git-branch",
    size: 13,
    color: "var(--text-tertiary)"
  })));
}
function Transcript({
  session,
  diffOpen,
  onToggleDiff,
  onOpenFile
}) {
  const {
    ToolAction,
    PermissionPrompt
  } = window.CapiscoDesignSystem_026f1e;
  if (session.id === 's1') {
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Msg, {
      role: "user"
    }, "Tear down the worktree when a session ends, and free its allocated port."), /*#__PURE__*/React.createElement(Msg, {
      role: "agent"
    }, "I'll add a ", /*#__PURE__*/React.createElement("code", null, "teardown()"), " to ", /*#__PURE__*/React.createElement("code", null, "Worktree"), " and call it from", ' ', /*#__PURE__*/React.createElement("code", null, "SessionTree.dispose()"), ". First, the edit:"), /*#__PURE__*/React.createElement(ToolAction, {
      kind: "Edit",
      target: "src/core/worktree.ts",
      added: 12,
      removed: 4,
      expanded: diffOpen,
      onToggle: onToggleDiff,
      onOpen: () => onOpenFile && onOpenFile('worktree.ts')
    }, /*#__PURE__*/React.createElement("div", {
      className: "diff-add"
    }, "+  async teardown() ", '{'), /*#__PURE__*/React.createElement("div", {
      className: "diff-add"
    }, "+    await this.broker.release(this.port);"), /*#__PURE__*/React.createElement("div", {
      className: "diff-add"
    }, "+    await rm(this.dir, ", '{', " recursive: true ", '}', ");"), /*#__PURE__*/React.createElement("div", {
      className: "diff-del"
    }, "-    // TODO: free port")), /*#__PURE__*/React.createElement(Msg, {
      role: "agent"
    }, "Now removing the temp worktree directory:"), /*#__PURE__*/React.createElement(PermissionPrompt, {
      command: "Bash(rm -rf .worktrees/tmp)",
      label: "Approval required"
    }));
  }
  if (session.id === 's2') {
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Msg, {
      role: "user"
    }, "Refactor the broker so grants are immutable once issued."), /*#__PURE__*/React.createElement(Msg, {
      role: "agent",
      who: "GPT-5"
    }, "Plan: freeze the ", /*#__PURE__*/React.createElement("code", null, "Grant"), " record on issue and route revocations through a", ' ', /*#__PURE__*/React.createElement("code", null, "tombstone"), " set. Want me to keep the existing ", /*#__PURE__*/React.createElement("code", null, "Map"), " API?"), /*#__PURE__*/React.createElement(Msg, {
      role: "user"
    }, "Yes, keep the API. Session is idle until you confirm."));
  }
  if (session.id === 's3') {
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Msg, {
      role: "user"
    }, "Where is the port allocated for a worktree?"), /*#__PURE__*/React.createElement(Msg, {
      role: "agent",
      who: "Local"
    }, "Searching the workspace for ", /*#__PURE__*/React.createElement("code", null, "allocatePort"), " and ", /*#__PURE__*/React.createElement("code", null, "this.port"), " \u2026"), /*#__PURE__*/React.createElement(ToolAction, {
      kind: "Search",
      target: "\"where is port allocated?\" \xB7 7 hits",
      onOpen: () => onOpenFile && onOpenFile('worktree.ts')
    }), /*#__PURE__*/React.createElement(PermissionPrompt, {
      command: "Read(src/core/**, *.ts)",
      label: "Approval required",
      scopes: ['Once', 'This session', 'Deny']
    }));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "chat-empty"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: 24,
    color: "var(--text-tertiary)"
  }), /*#__PURE__*/React.createElement("div", {
    className: "ce-title"
  }, "New session \xB7 ", session.model), /*#__PURE__*/React.createElement("div", {
    className: "ce-sub"
  }, "Describe a task to start the agent."));
}
function AgentWorkspace({
  onOpenFile
}) {
  const {
    Input,
    IconButton
  } = window.CapiscoDesignSystem_026f1e;
  const [active, setActive] = React.useState('s1');
  const [diffOpen, setDiffOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [backend, setBackend] = React.useState('api');
  const [token, setToken] = React.useState('');
  const [model, setModel] = React.useState('Claude Sonnet');
  const [extra, setExtra] = React.useState([]);
  const sessions = [...window.SESSIONS, ...extra];
  const cur = sessions.find(s => s.id === active) || sessions[0];
  const createSession = agent => {
    const id = 'n' + (extra.length + 1);
    setExtra(e => [...e, {
      id,
      model: agent.split(' ')[0],
      title: 'New session',
      meta: 'idle',
      status: 'idle'
    }]);
    setActive(id);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "agent-workspace"
  }, /*#__PURE__*/React.createElement("div", {
    className: "session-tabbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "session-tabs"
  }, sessions.map(s => /*#__PURE__*/React.createElement(SessionTab, {
    key: s.id,
    s: s,
    active: active === s.id,
    onClick: () => setActive(s.id)
  }))), /*#__PURE__*/React.createElement(NewSessionButton, {
    onCreate: createSession
  }), /*#__PURE__*/React.createElement("button", {
    className: 'session-gear' + (settingsOpen ? ' active' : ''),
    title: "Agent backend settings",
    onClick: () => setSettingsOpen(v => !v)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "settings",
    size: 15
  }))), cur.subs && /*#__PURE__*/React.createElement("div", {
    className: "subagent-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "branch-stub"
  }, "\u2514"), cur.subs.map(sub => {
    const {
      StatusDot
    } = window.CapiscoDesignSystem_026f1e;
    return /*#__PURE__*/React.createElement("span", {
      key: sub.id,
      className: "subagent-chip"
    }, /*#__PURE__*/React.createElement(StatusDot, {
      status: sub.status,
      size: 7
    }), sub.title, /*#__PURE__*/React.createElement("span", {
      className: "sub-meta"
    }, sub.meta));
  })), /*#__PURE__*/React.createElement("div", {
    className: "chat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "chat-inner"
  }, /*#__PURE__*/React.createElement(Transcript, {
    session: cur,
    diffOpen: diffOpen,
    onToggleDiff: () => setDiffOpen(!diffOpen),
    onOpenFile: onOpenFile
  }))), /*#__PURE__*/React.createElement("div", {
    className: "composer"
  }, /*#__PURE__*/React.createElement("div", {
    className: "composer-inner"
  }, /*#__PURE__*/React.createElement(Input, {
    mono: true,
    placeholder: "Message Capisco\u2026",
    leading: /*#__PURE__*/React.createElement(ModelPicker, {
      value: model,
      onChange: setModel
    }),
    trailing: /*#__PURE__*/React.createElement(IconButton, {
      size: 24,
      icon: /*#__PURE__*/React.createElement(Icon, {
        name: "arrow-up",
        size: 15,
        color: "var(--accent)"
      }),
      title: "Send"
    })
  }), /*#__PURE__*/React.createElement("div", {
    className: "agent-footer"
  }, /*#__PURE__*/React.createElement("span", null, backend === 'api' ? 'API · ' + (token ? 'token set' : 'no token') : 'CLI · claude 1.4.2'), /*#__PURE__*/React.createElement("span", {
    className: "sep"
  }, "\xB7"), " Tokens: 6.5k ", /*#__PURE__*/React.createElement("span", {
    className: "sep"
  }, "\xB7"), " Cost: $0.04 ", /*#__PURE__*/React.createElement("span", {
    className: "sep"
  }, "\xB7"), " running 2m49s"))), settingsOpen && /*#__PURE__*/React.createElement(AgentSettings, {
    backend: backend,
    setBackend: setBackend,
    token: token,
    setToken: setToken,
    onClose: () => setSettingsOpen(false)
  }));
}

/* Agent backend settings popover — API client (with token) or installed CLI. */
function AgentSettings({
  backend,
  setBackend,
  token,
  setToken,
  onClose
}) {
  const {
    Input,
    Button
  } = window.CapiscoDesignSystem_026f1e;
  return /*#__PURE__*/React.createElement("div", {
    className: "agent-settings"
  }, /*#__PURE__*/React.createElement("div", {
    className: "as-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "caps"
  }, "Agent backend"), /*#__PURE__*/React.createElement("button", {
    className: "as-close",
    title: "Close",
    onClick: onClose
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 14,
    color: "var(--text-secondary)"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "as-seg"
  }, /*#__PURE__*/React.createElement("button", {
    className: 'as-opt' + (backend === 'api' ? ' active' : ''),
    onClick: () => setBackend('api')
  }, "API client"), /*#__PURE__*/React.createElement("button", {
    className: 'as-opt' + (backend === 'cli' ? ' active' : ''),
    onClick: () => setBackend('cli')
  }, "Installed CLI")), backend === 'api' ? /*#__PURE__*/React.createElement("div", {
    className: "as-body"
  }, /*#__PURE__*/React.createElement("label", {
    className: "as-label"
  }, "Provider"), /*#__PURE__*/React.createElement("button", {
    className: "as-select"
  }, "Anthropic \xB7 Claude", /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-down",
    size: 13,
    color: "var(--text-secondary)"
  })), /*#__PURE__*/React.createElement("label", {
    className: "as-label"
  }, "API token"), /*#__PURE__*/React.createElement(Input, {
    mono: true,
    type: "password",
    placeholder: "sk-ant-\u2026",
    value: token,
    onChange: e => setToken(e.target.value)
  }), /*#__PURE__*/React.createElement("div", {
    className: "as-note"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "lock",
    size: 11,
    color: "var(--text-tertiary)"
  }), "Stored in your OS keychain."), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "md",
    style: {
      width: '100%',
      marginTop: 2
    },
    onClick: onClose
  }, "Save")) : /*#__PURE__*/React.createElement("div", {
    className: "as-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "as-detected"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "circle-check",
    size: 14,
    color: "var(--success)"
  }), "claude 1.4.2 detected"), /*#__PURE__*/React.createElement("div", {
    className: "as-path"
  }, "/usr/local/bin/claude"), /*#__PURE__*/React.createElement("div", {
    className: "as-note"
  }, "Capisco shells out to your installed CLI. No token stored."), /*#__PURE__*/React.createElement(Button, {
    variant: "default",
    size: "md",
    style: {
      width: '100%',
      marginTop: 2
    }
  }, "Re-detect CLI")));
}

/* Alerts / Inspect flyout — overlays the right of the workspace; pinnable. */
function Flyout({
  kind,
  pinned,
  onPin,
  onClose
}) {
  const {
    IconButton
  } = window.CapiscoDesignSystem_026f1e;
  const isAlerts = kind === 'alerts';
  const items = isAlerts ? window.ALERTS : window.INSPECTIONS;
  return /*#__PURE__*/React.createElement("div", {
    className: "flyout"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flyout-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "caps"
  }, isAlerts ? 'Alerts' : 'Inspections'), /*#__PURE__*/React.createElement("div", {
    className: "ph-actions"
  }, /*#__PURE__*/React.createElement(IconButton, {
    size: 22,
    active: pinned,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "pin",
      size: 13
    }),
    title: "Pin",
    onClick: onPin
  }), /*#__PURE__*/React.createElement(IconButton, {
    size: 22,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "x",
      size: 14
    }),
    title: "Close",
    onClick: onClose
  }))), /*#__PURE__*/React.createElement("div", {
    className: "flyout-body"
  }, items.map((a, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "alert-item"
  }, /*#__PURE__*/React.createElement("span", {
    className: 'alert-dot sev-' + a.sev
  }), /*#__PURE__*/React.createElement("div", {
    className: "alert-text"
  }, /*#__PURE__*/React.createElement("div", {
    className: "alert-title"
  }, a.title), /*#__PURE__*/React.createElement("div", {
    className: "alert-sub"
  }, a.sub))))));
}
Object.assign(window, {
  AgentWorkspace,
  AgentSettings,
  Flyout
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "agent.jsx", error: String((e && e.message) || e) }); }

// chrome.jsx
try { (() => {
/* Capisco IDE kit — chrome: TitleBar, left ActivityBar, RightRail, StatusBar. */

const DS = () => window.CapiscoDesignSystem_026f1e || {};
function TitleBar({
  theme,
  onToggleTheme
}) {
  const {
    IconButton
  } = DS();
  return /*#__PURE__*/React.createElement("div", {
    className: "titlebar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tb-traffic"
  }, /*#__PURE__*/React.createElement("span", {
    className: "tl tl-r"
  }), /*#__PURE__*/React.createElement("span", {
    className: "tl tl-y"
  }), /*#__PURE__*/React.createElement("span", {
    className: "tl tl-g"
  })), /*#__PURE__*/React.createElement("img", {
    className: "tb-mark",
    src: "../../assets/capisco-mark.svg",
    width: "18",
    height: "18",
    alt: ""
  }), /*#__PURE__*/React.createElement("button", {
    className: "tb-chip"
  }, "capisco", /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-down",
    size: 13
  })), /*#__PURE__*/React.createElement("button", {
    className: "tb-chip tb-branch"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "git-branch",
    size: 13
  }), "main", /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-down",
    size: 13
  })), /*#__PURE__*/React.createElement("div", {
    className: "tb-spacer"
  }), /*#__PURE__*/React.createElement(IconButton, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "play",
      size: 15
    }),
    title: "Run"
  }), /*#__PURE__*/React.createElement("button", {
    className: "tb-chip tb-run"
  }, "Dev", /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-down",
    size: 13
  })), /*#__PURE__*/React.createElement(IconButton, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "search",
      size: 15
    }),
    title: "Search everywhere"
  }), /*#__PURE__*/React.createElement(IconButton, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: theme === 'light' ? 'moon' : 'sun',
      size: 15
    }),
    title: "Toggle theme",
    onClick: onToggleTheme
  }), /*#__PURE__*/React.createElement(IconButton, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "ellipsis",
      size: 15
    }),
    title: "More"
  }), /*#__PURE__*/React.createElement(IconButton, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "settings",
      size: 15
    }),
    title: "Settings"
  }));
}
const LEFT_NAV = [{
  id: 'explorer',
  icon: 'files',
  label: 'Explorer'
}, {
  id: 'commit',
  icon: 'git-compare',
  label: 'Commit'
}, {
  id: 'pr',
  icon: 'git-pull-request',
  label: 'PR'
}, {
  id: 'tasks',
  icon: 'list-checks',
  label: 'Tasks'
}, {
  id: 'search',
  icon: 'search',
  label: 'Search'
}, {
  id: 'structure',
  icon: 'list-tree',
  label: 'Structure'
}, {
  id: 'data',
  icon: 'database',
  label: 'Data'
}, {
  id: 'services',
  icon: 'container',
  label: 'Services'
}];
function ActivityBar({
  items,
  active,
  onSelect
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "activitybar left",
    "data-comment-anchor": "166af5ebaa-div-37-5"
  }, items.map(it => /*#__PURE__*/React.createElement("button", {
    key: it.id,
    className: 'ab-item' + (active === it.id ? ' active' : ''),
    title: it.label,
    onClick: () => onSelect(it.id)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: it.icon,
    size: 18
  }), /*#__PURE__*/React.createElement("span", {
    className: "ab-label"
  }, it.label))));
}

/* Far-right rail: workspace toggle (Agents / Editor) + flyout buttons (Alerts / Inspect). */
function RightRail({
  mode,
  onMode,
  flyout,
  onFlyout
}) {
  const Item = ({
    icon,
    label,
    active,
    onClick
  }) => /*#__PURE__*/React.createElement("button", {
    className: 'ab-item' + (active ? ' active' : ''),
    title: label,
    onClick: onClick
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 18
  }), /*#__PURE__*/React.createElement("span", {
    className: "ab-label"
  }, label));
  return /*#__PURE__*/React.createElement("div", {
    className: "activitybar right"
  }, /*#__PURE__*/React.createElement(Item, {
    icon: "bot",
    label: "Agents",
    active: mode === 'agents',
    onClick: () => onMode('agents')
  }), /*#__PURE__*/React.createElement(Item, {
    icon: "square-code",
    label: "Editor",
    active: mode === 'editor',
    onClick: () => onMode('editor')
  }), /*#__PURE__*/React.createElement(Item, {
    icon: "git-graph",
    label: "Git",
    active: mode === 'git',
    onClick: () => onMode('git')
  }), /*#__PURE__*/React.createElement("div", {
    className: "ab-div"
  }), /*#__PURE__*/React.createElement(Item, {
    icon: "bell",
    label: "Alerts",
    active: flyout === 'alerts',
    onClick: () => onFlyout('alerts')
  }), /*#__PURE__*/React.createElement(Item, {
    icon: "scan-search",
    label: "Inspect",
    active: flyout === 'inspect',
    onClick: () => onFlyout('inspect')
  }));
}
function StatusBar({
  mode
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "statusbar"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sb-crumb"
  }, mode === 'agents' ? 'agents › Claude › Implement worktree teardown' : mode === 'git' ? 'git › activity · this week' : 'capisco › src › core › broker.ts'), /*#__PURE__*/React.createElement("div", {
    className: "tb-spacer"
  }), /*#__PURE__*/React.createElement("span", {
    className: "sb-item"
  }, "TypeScript 5.4"), /*#__PURE__*/React.createElement("span", {
    className: "sb-item"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "git-branch",
    size: 12
  }), "main ", /*#__PURE__*/React.createElement("span", {
    className: "up"
  }, "\u21912")), /*#__PURE__*/React.createElement("span", {
    className: "sb-item"
  }, "Blame: matze 2d ago"), /*#__PURE__*/React.createElement("span", {
    className: "sb-item"
  }, "Ln 24, Col 8"), /*#__PURE__*/React.createElement("span", {
    className: "sb-item"
  }, "LF"), /*#__PURE__*/React.createElement("span", {
    className: "sb-item"
  }, "UTF-8"), /*#__PURE__*/React.createElement("span", {
    className: "sb-item sb-brand"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 12,
    color: "var(--accent)"
  }), "capisco"));
}
Object.assign(window, {
  TitleBar,
  ActivityBar,
  RightRail,
  StatusBar,
  LEFT_NAV
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "chrome.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Capisco Button — flat, dense IDE button.
 * variant: 'default' (subtle, bordered) | 'primary' (teal fill) | 'ghost' (no chrome)
 * size: 'sm' (24px) | 'md' (28px)
 */
function Button({
  variant = 'default',
  size = 'sm',
  disabled = false,
  children,
  onClick,
  style = {},
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [active, setActive] = React.useState(false);
  const base = {
    fontFamily: 'var(--font-sans)',
    fontSize: size === 'md' ? 'var(--fs-base)' : 'var(--fs-small)',
    fontWeight: 'var(--fw-medium)',
    lineHeight: 1,
    height: size === 'md' ? 'var(--control-h-md)' : 'var(--control-h)',
    padding: size === 'md' ? '0 14px' : '0 10px',
    borderRadius: 'var(--radius-1)',
    border: '1px solid transparent',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    cursor: disabled ? 'default' : 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    transition: 'background .12s ease, border-color .12s ease, color .12s ease',
    opacity: disabled ? 0.45 : 1,
    transform: active && !disabled ? 'translateY(0.5px)' : 'none'
  };
  const variants = {
    default: {
      background: hover && !disabled ? 'var(--bg-hover)' : 'transparent',
      borderColor: 'var(--border)',
      color: 'var(--text-primary)'
    },
    primary: {
      background: hover && !disabled ? 'var(--accent-hover)' : 'var(--accent)',
      borderColor: 'transparent',
      color: 'var(--text-on-accent)',
      fontWeight: 'var(--fw-semibold)'
    },
    ghost: {
      background: hover && !disabled ? 'var(--bg-hover)' : 'transparent',
      borderColor: 'transparent',
      color: 'var(--text-secondary)'
    }
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    disabled: disabled,
    onClick: disabled ? undefined : onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setActive(false);
    },
    onMouseDown: () => setActive(true),
    onMouseUp: () => setActive(false),
    style: {
      ...base,
      ...variants[variant],
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Capisco IconButton — square, monochrome icon control.
 * Used in toolbars, activity bars, panel headers, hover-row actions.
 * Pass any element as `icon` (an <i data-lucide> node, an <svg>, or a glyph).
 * `active` gives the JetBrains selected look (lighter bg + teal edge strip).
 */
function IconButton({
  icon,
  active = false,
  edge = 'left',
  // which side the active accent strip sits on
  size = 28,
  title,
  disabled = false,
  onClick,
  style = {},
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const strip = active ? {
    boxShadow: `inset ${edge === 'right' ? '-' : ''}var(--accent-strip-w) 0 0 0 var(--accent)`
  } : {};
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    title: title,
    disabled: disabled,
    onClick: disabled ? undefined : onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      width: size,
      height: size,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: 'none',
      borderRadius: 'var(--radius-1)',
      background: active ? 'var(--accent-tint)' : hover && !disabled ? 'var(--bg-hover)' : 'transparent',
      color: active ? 'var(--accent)' : 'var(--text-secondary)',
      cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.4 : 1,
      transition: 'background .12s ease, color .12s ease',
      ...strip,
      ...style
    }
  }, rest), icon);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/core/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Capisco Input — sunken field used in search, terminal command line,
 * the agent message composer, and settings.
 * Optional `leading` / `trailing` slots for icons or a send button.
 */
function Input({
  value,
  defaultValue,
  placeholder,
  leading,
  trailing,
  mono = false,
  disabled = false,
  onChange,
  style = {},
  inputStyle = {},
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      height: 'var(--control-h-md)',
      padding: '0 8px',
      background: 'var(--surface-input)',
      border: `1px solid ${focus ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: 'var(--radius-1)',
      transition: 'border-color .12s ease',
      opacity: disabled ? 0.5 : 1,
      ...style
    }
  }, leading && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      color: 'var(--text-tertiary)',
      flexShrink: 0
    }
  }, leading), /*#__PURE__*/React.createElement("input", _extends({
    value: value,
    defaultValue: defaultValue,
    placeholder: placeholder,
    disabled: disabled,
    onChange: onChange,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      flex: 1,
      minWidth: 0,
      border: 'none',
      outline: 'none',
      background: 'transparent',
      color: 'var(--text-primary)',
      fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
      fontSize: mono ? 'var(--fs-code)' : 'var(--fs-small)',
      ...inputStyle
    }
  }, rest)), trailing && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      flexShrink: 0
    }
  }, trailing));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Input.jsx", error: String((e && e.message) || e) }); }

// components/ide/EditorTab.jsx
try { (() => {
/**
 * Capisco EditorTab — one tab in the editor tab strip.
 * Active tab adopts the editor background (#1E1F22) so it "merges" with the
 * editor below, plus a 1px teal strip on top. Inactive tabs read gray.
 * Pinned tabs show a pin glyph instead of the hover close (x) and sit narrower.
 */
function EditorTab({
  icon,
  label,
  active = false,
  pinned = false,
  dirty = false,
  onSelect,
  onClose,
  style = {}
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    onClick: onSelect,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      height: 'var(--tabbar-h)',
      padding: pinned ? '0 8px 0 10px' : '0 8px 0 12px',
      maxWidth: '200px',
      background: active ? 'var(--bg-editor)' : 'transparent',
      color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--fs-small)',
      cursor: 'pointer',
      borderRight: '1px solid var(--border)',
      boxShadow: active ? 'inset 0 var(--accent-strip-w) 0 0 var(--accent)' : 'none',
      userSelect: 'none',
      whiteSpace: 'nowrap',
      transition: 'background var(--dur-fast) var(--ease-standard)',
      ...style
    }
  }, icon && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      flexShrink: 0
    }
  }, icon), /*#__PURE__*/React.createElement("span", {
    style: {
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      width: 14,
      justifyContent: 'center',
      flexShrink: 0
    }
  }, pinned ? /*#__PURE__*/React.createElement("svg", {
    width: "11",
    height: "11",
    viewBox: "0 0 24 24",
    fill: "var(--text-tertiary)",
    stroke: "none"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 2 4 10l5 1 1 5 8-8-2-2-2 2-2-6z"
  })) : hover ? /*#__PURE__*/React.createElement("svg", {
    onClick: e => {
      e.stopPropagation();
      onClose && onClose();
    },
    width: "13",
    height: "13",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--text-secondary)",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M18 6 6 18M6 6l12 12"
  })) : dirty ? /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: 'var(--text-secondary)'
    }
  }) : null));
}
Object.assign(__ds_scope, { EditorTab });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/ide/EditorTab.jsx", error: String((e && e.message) || e) }); }

// components/ide/PermissionPrompt.jsx
try { (() => {
/**
 * Capisco PermissionPrompt — the Capability-Broker approval block.
 * The signature Capisco moment: an agent requests a capability and the human
 * grants or denies scope. Teal-outlined, calm — never alarmist red.
 */
function PermissionPrompt({
  command,
  label = 'Approval required',
  scopes = ['Once', 'This session', 'Deny'],
  onGrant,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      border: '1px solid var(--accent-muted)',
      borderRadius: 'var(--radius-2)',
      background: 'var(--accent-tint)',
      padding: '10px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '7px'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "13",
    height: "13",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--accent)",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("rect", {
    x: "5",
    y: "11",
    width: "14",
    height: "10",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 11V7a4 4 0 0 1 8 0v4"
  })), /*#__PURE__*/React.createElement("code", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: '12px',
      color: 'var(--text-primary)',
      background: 'var(--bg-raised)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-1)',
      padding: '1px 6px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, command)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--fs-small)',
      color: 'var(--text-secondary)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '6px'
    }
  }, scopes.map((s, i) => /*#__PURE__*/React.createElement(__ds_scope.Button, {
    key: s,
    variant: i === 0 ? 'primary' : i === scopes.length - 1 ? 'ghost' : 'default',
    size: "sm",
    onClick: () => onGrant && onGrant(s)
  }, s))));
}
Object.assign(__ds_scope, { PermissionPrompt });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/ide/PermissionPrompt.jsx", error: String((e && e.message) || e) }); }

// components/ide/ToolAction.jsx
try { (() => {
/**
 * Capisco ToolAction — a single tool invocation surfaced inside a session
 * transcript, e.g. an edit, a file read, a command. Collapsible header row
 * with a name, a target path (mono), and an optional +adds / −dels diffstat.
 */
function ToolAction({
  kind = 'Edit',
  target,
  added,
  removed,
  expanded = false,
  onToggle,
  onOpen,
  children,
  style = {}
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-1)',
      background: 'var(--bg-raised)',
      overflow: 'hidden',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: onToggle,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      height: '26px',
      padding: '0 8px',
      cursor: onToggle ? 'pointer' : 'default',
      background: hover && onToggle ? 'var(--bg-hover)' : 'transparent',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--fs-small)'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--text-secondary)",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      flexShrink: 0,
      transform: expanded ? 'rotate(90deg)' : 'none',
      transition: 'transform var(--dur-fast) var(--ease-standard)'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "m9 18 6-6-6-6"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-primary)',
      fontWeight: 'var(--fw-medium)'
    }
  }, kind), target && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: '12px',
      color: 'var(--text-secondary)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      flex: 1,
      minWidth: 0
    }
  }, target), (added != null || removed != null) && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: '12px',
      flexShrink: 0,
      display: 'inline-flex',
      gap: '6px'
    }
  }, added != null && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--success)'
    }
  }, "+", added), removed != null && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--error)'
    }
  }, "\u2212", removed)), onOpen && /*#__PURE__*/React.createElement("button", {
    type: "button",
    title: "Open in editor",
    onClick: e => {
      e.stopPropagation();
      onOpen();
    },
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '20px',
      height: '20px',
      padding: 0,
      marginLeft: '2px',
      flexShrink: 0,
      border: 'none',
      background: 'transparent',
      cursor: 'pointer',
      color: hover ? 'var(--accent)' : 'var(--text-tertiary)',
      transition: 'color var(--dur-fast) var(--ease-standard)'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "13",
    height: "13",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M15 3h6v6"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M10 14 21 3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"
  })))), expanded && children && /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--border)',
      padding: '6px 8px',
      fontFamily: 'var(--font-mono)',
      fontSize: '12px',
      lineHeight: 'var(--lh-code)',
      color: 'var(--text-secondary)'
    }
  }, children));
}
Object.assign(__ds_scope, { ToolAction });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/ide/ToolAction.jsx", error: String((e && e.message) || e) }); }

// components/ide/TreeRow.jsx
try { (() => {
/**
 * Capisco TreeRow — a single row in the file-explorer tree (or any tree).
 * Handles indentation, an expand chevron for folders, a type icon, the label,
 * and an optional trailing slot (e.g. a <GitMarker/>).
 * Active row: lighter bg + 2px teal strip on the left edge.
 */
function TreeRow({
  depth = 0,
  expandable = false,
  expanded = false,
  icon,
  label,
  active = false,
  muted = false,
  trailing,
  onClick,
  style = {}
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      height: 'var(--row-h)',
      paddingRight: '8px',
      paddingLeft: `${4 + depth * 14}px`,
      background: active ? 'var(--accent-tint)' : hover ? 'var(--bg-hover)' : 'transparent',
      color: muted ? 'var(--text-tertiary)' : active ? 'var(--text-primary)' : 'var(--text-primary)',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--fs-small)',
      cursor: 'pointer',
      userSelect: 'none',
      boxShadow: active ? 'inset var(--accent-strip-w) 0 0 0 var(--accent)' : 'none',
      whiteSpace: 'nowrap',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 12,
      flexShrink: 0,
      display: 'inline-flex',
      justifyContent: 'center',
      color: 'var(--text-secondary)'
    }
  }, expandable && /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      transform: expanded ? 'rotate(90deg)' : 'none',
      transition: 'transform var(--dur-fast) var(--ease-standard)'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "m9 18 6-6-6-6"
  }))), icon && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      flexShrink: 0
    }
  }, icon), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, label), trailing && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      flexShrink: 0
    }
  }, trailing));
}
Object.assign(__ds_scope, { TreeRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/ide/TreeRow.jsx", error: String((e && e.message) || e) }); }

// components/indicators/GitMarker.jsx
try { (() => {
/**
 * Capisco GitMarker — single-letter VCS status glyph shown at the right edge
 * of a changed file row. Dezent: just the colored letter, no chip.
 * status: 'M' modified | 'A' added | 'D' deleted | 'U' untracked
 */
function GitMarker({
  status = 'M',
  style = {}
}) {
  const colors = {
    M: 'var(--git-modified)',
    A: 'var(--git-added)',
    D: 'var(--git-deleted)',
    U: 'var(--git-untracked)'
  };
  return /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: '11px',
      fontWeight: 'var(--fw-semibold)',
      color: colors[status] || 'var(--text-secondary)',
      lineHeight: 1,
      ...style
    }
  }, status);
}
Object.assign(__ds_scope, { GitMarker });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/indicators/GitMarker.jsx", error: String((e && e.message) || e) }); }

// components/indicators/ModelBadge.jsx
try { (() => {
/**
 * Capisco ModelBadge — tiny monochrome label naming the model behind a session.
 * Calm by default (gray, bordered). Set `tone="accent"` only to spotlight one.
 */
function ModelBadge({
  children,
  tone = 'neutral',
  style = {}
}) {
  const tones = {
    neutral: {
      color: 'var(--text-secondary)',
      borderColor: 'var(--border)',
      background: 'transparent'
    },
    accent: {
      color: 'var(--accent)',
      borderColor: 'var(--accent-muted)',
      background: 'var(--accent-tint)'
    }
  };
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      height: '16px',
      padding: '0 5px',
      fontFamily: 'var(--font-sans)',
      fontSize: '10.5px',
      fontWeight: 'var(--fw-medium)',
      letterSpacing: '0.01em',
      borderRadius: 'var(--radius-1)',
      border: '1px solid',
      whiteSpace: 'nowrap',
      ...tones[tone],
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { ModelBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/indicators/ModelBadge.jsx", error: String((e && e.message) || e) }); }

// components/indicators/StatusDot.jsx
try { (() => {
/**
 * Capisco StatusDot — session / process state indicator.
 * status: 'running' (green, softly pulsing) | 'idle' (hollow gray)
 *       | 'waiting' (teal, half-filled — needs approval) | 'error' (red) | 'done' (green)
 */
function StatusDot({
  status = 'idle',
  size = 8,
  style = {}
}) {
  const map = {
    running: {
      color: 'var(--success)',
      fill: true,
      pulse: true
    },
    waiting: {
      color: 'var(--accent)',
      fill: 'half',
      pulse: false
    },
    idle: {
      color: 'var(--text-tertiary)',
      fill: false,
      pulse: false
    },
    error: {
      color: 'var(--error)',
      fill: true,
      pulse: false
    },
    done: {
      color: 'var(--success)',
      fill: true,
      pulse: false
    }
  };
  const s = map[status] || map.idle;
  const common = {
    width: size,
    height: size,
    borderRadius: 'var(--radius-pill)',
    flexShrink: 0,
    display: 'inline-block',
    boxSizing: 'border-box'
  };
  let look;
  if (s.fill === 'half') {
    // half-filled: teal ring with a teal left half — reads as "partway / waiting"
    look = {
      border: `1.5px solid ${s.color}`,
      background: `linear-gradient(90deg, ${s.color} 0 50%, transparent 50% 100%)`
    };
  } else if (s.fill) {
    look = {
      background: s.color
    };
  } else {
    look = {
      border: `1.5px solid ${s.color}`,
      background: 'transparent'
    };
  }
  return /*#__PURE__*/React.createElement("span", {
    title: status,
    style: {
      ...common,
      ...look,
      animation: s.pulse ? 'capisco-pulse 1.6s var(--ease-standard) infinite' : 'none',
      ...style
    }
  });
}
Object.assign(__ds_scope, { StatusDot });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/indicators/StatusDot.jsx", error: String((e && e.message) || e) }); }

// panels.jsx
try { (() => {
/* Capisco IDE kit — left panel (multi-project Explorer + Work Stash) and Terminal. */

function ProjectRoot({
  p,
  onToggle
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: 'proj-root' + (p.selected ? ' selected' : ''),
    onClick: onToggle
  }, /*#__PURE__*/React.createElement("span", {
    className: "tw-chevron"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      transform: p.expanded ? 'rotate(90deg)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "m9 18 6-6-6-6"
  }))), /*#__PURE__*/React.createElement(Icon, {
    name: "folder",
    size: 15,
    color: "var(--text-secondary)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "proj-name"
  }, p.name), /*#__PURE__*/React.createElement("span", {
    className: "proj-path"
  }, "\u2014 ", p.path), /*#__PURE__*/React.createElement("span", {
    className: "proj-branch"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "git-branch",
    size: 11,
    color: "var(--text-tertiary)"
  }), p.branch, p.tracking ? /*#__PURE__*/React.createElement("span", {
    className: "proj-track"
  }, p.tracking) : null));
}
function FileExplorer() {
  const {
    TreeRow,
    GitMarker,
    IconButton
  } = window.CapiscoDesignSystem_026f1e;
  const [open, setOpen] = React.useState(() => Object.fromEntries(window.PROJECTS.map(p => [p.id, p.expanded])));
  const [scratchOpen, setScratchOpen] = React.useState(true);
  const toggle = id => setOpen(o => ({
    ...o,
    [id]: !o[id]
  }));
  return /*#__PURE__*/React.createElement("div", {
    className: "explorer"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "caps"
  }, "Project", /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-down",
    size: 12,
    color: "var(--text-tertiary)",
    style: {
      marginLeft: 4
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "ph-actions"
  }, /*#__PURE__*/React.createElement(IconButton, {
    size: 22,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "plus",
      size: 14
    }),
    title: "Add project to workspace"
  }), /*#__PURE__*/React.createElement(IconButton, {
    size: 22,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "list-collapse",
      size: 14
    }),
    title: "Collapse all"
  }), /*#__PURE__*/React.createElement(IconButton, {
    size: 22,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "refresh-cw",
      size: 13
    }),
    title: "Refresh"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "tree"
  }, window.PROJECTS.map(p => /*#__PURE__*/React.createElement(React.Fragment, {
    key: p.id
  }, /*#__PURE__*/React.createElement(ProjectRoot, {
    p: {
      ...p,
      expanded: open[p.id]
    },
    onToggle: () => toggle(p.id)
  }), open[p.id] && p.files.map((n, i) => /*#__PURE__*/React.createElement(TreeRow, {
    key: i,
    depth: n.depth,
    expandable: n.expandable,
    expanded: n.expanded,
    active: n.active,
    muted: n.muted,
    icon: /*#__PURE__*/React.createElement(FileIcon, {
      ext: n.ext,
      open: n.expanded
    }),
    label: n.name,
    trailing: n.git ? /*#__PURE__*/React.createElement(GitMarker, {
      status: n.git
    }) : null
  })))), /*#__PURE__*/React.createElement(TreeRow, {
    depth: 0,
    expandable: true,
    expanded: false,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "library",
      size: 15,
      color: "var(--text-secondary)"
    }),
    label: "External Libraries",
    muted: true
  }), /*#__PURE__*/React.createElement(TreeRow, {
    depth: 0,
    expandable: true,
    expanded: scratchOpen,
    onClick: () => setScratchOpen(v => !v),
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "history",
      size: 15,
      color: "var(--accent)"
    }),
    label: "Scratches and Consoles"
  }), scratchOpen && window.SCRATCH.map((s, i) => /*#__PURE__*/React.createElement(TreeRow, {
    key: i,
    depth: 1,
    icon: /*#__PURE__*/React.createElement(FileIcon, {
      ext: s.ext
    }),
    label: s.name
  }))));
}

/* Work Stash — Local Changes (grouped by project) + Shelf, switchable via tabs. */
function WorkStash({
  onOpenDiff
}) {
  const {
    TreeRow,
    GitMarker,
    IconButton,
    Button,
    Input
  } = window.CapiscoDesignSystem_026f1e;
  const [tab, setTab] = React.useState('changes');
  return /*#__PURE__*/React.createElement("div", {
    className: "workstash"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ws-tabs"
  }, /*#__PURE__*/React.createElement("button", {
    className: 'ws-tab' + (tab === 'changes' ? ' active' : ''),
    onClick: () => setTab('changes')
  }, "Local Changes"), /*#__PURE__*/React.createElement("button", {
    className: 'ws-tab' + (tab === 'shelf' ? ' active' : ''),
    onClick: () => setTab('shelf')
  }, "Shelf"), /*#__PURE__*/React.createElement("div", {
    className: "tb-spacer"
  }), /*#__PURE__*/React.createElement(IconButton, {
    size: 22,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "refresh-cw",
      size: 13
    }),
    title: "Refresh"
  }), /*#__PURE__*/React.createElement(IconButton, {
    size: 22,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "ellipsis",
      size: 14
    }),
    title: "More"
  })), tab === 'changes' ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "ws-scroll"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ws-subhead"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-down",
    size: 12,
    color: "var(--text-secondary)"
  }), "Changes", /*#__PURE__*/React.createElement("span", {
    className: "ws-count"
  }, window.CHANGE_GROUPS.reduce((n, g) => n + g.files.length, 0))), window.CHANGE_GROUPS.map((g, gi) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: gi
  }, /*#__PURE__*/React.createElement("div", {
    className: "ws-group-head"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-down",
    size: 11,
    color: "var(--text-tertiary)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "ws-group-name"
  }, g.project), /*#__PURE__*/React.createElement("span", {
    className: "ws-group-branch"
  }, g.branch)), g.files.map((c, i) => /*#__PURE__*/React.createElement(TreeRow, {
    key: i,
    depth: 1,
    icon: /*#__PURE__*/React.createElement(FileIcon, {
      ext: c.ext
    }),
    label: c.name,
    onClick: () => onOpenDiff && onOpenDiff(c.name),
    trailing: /*#__PURE__*/React.createElement("span", {
      className: "ws-row-meta"
    }, /*#__PURE__*/React.createElement("span", {
      className: "ws-path"
    }, c.path), /*#__PURE__*/React.createElement(GitMarker, {
      status: c.git
    }))
  }))))), /*#__PURE__*/React.createElement("div", {
    className: "ws-commit"
  }, /*#__PURE__*/React.createElement(Input, {
    placeholder: "Commit message\u2026",
    inputStyle: {
      fontSize: '12px'
    },
    "data-comment-anchor": "89ddac31ec-input-113-13"
  }), /*#__PURE__*/React.createElement("div", {
    className: "ws-commit-actions"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "md",
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 14
  }), "Commit"), /*#__PURE__*/React.createElement(Button, {
    variant: "default",
    size: "md"
  }, "Commit and Push\u2026")))) : /*#__PURE__*/React.createElement("div", {
    className: "ws-scroll"
  }, window.SHELF.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "shelf-row"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "inbox",
    size: 14,
    color: "var(--text-secondary)"
  }), /*#__PURE__*/React.createElement("div", {
    className: "shelf-text"
  }, /*#__PURE__*/React.createElement("div", {
    className: "shelf-name"
  }, s.name), /*#__PURE__*/React.createElement("div", {
    className: "shelf-meta"
  }, s.meta))))));
}
const TERM_TABS = ['Local', 'Py2Ts', 'Evidence'];

/* Minimal placeholder for left-rail views not built out in this mock. */
function PanelPlaceholder({
  title
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "panel-placeholder"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "package-open",
    size: 24,
    color: "var(--text-tertiary)"
  }), /*#__PURE__*/React.createElement("div", {
    className: "pp-title"
  }, title), /*#__PURE__*/React.createElement("div", {
    className: "pp-sub"
  }, "Not wired in this mock"));
}
function Terminal() {
  const {
    IconButton
  } = window.CapiscoDesignSystem_026f1e;
  const [active, setActive] = React.useState('Evidence');
  return /*#__PURE__*/React.createElement("div", {
    className: "terminal"
  }, /*#__PURE__*/React.createElement("div", {
    className: "term-tabbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "term-tools"
  }, /*#__PURE__*/React.createElement(IconButton, {
    size: 22,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "square-terminal",
      size: 14
    }),
    title: "Terminal"
  }), /*#__PURE__*/React.createElement(IconButton, {
    size: 22,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "trash-2",
      size: 13
    }),
    title: "Kill"
  })), /*#__PURE__*/React.createElement("div", {
    className: "term-tabs"
  }, TERM_TABS.map(t => /*#__PURE__*/React.createElement("button", {
    key: t,
    className: 'term-tab' + (t === active ? ' active' : ''),
    onClick: () => setActive(t)
  }, t)), /*#__PURE__*/React.createElement("button", {
    className: "term-tab term-add",
    title: "New terminal"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 13
  })))), /*#__PURE__*/React.createElement("div", {
    className: "term-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "t-line"
  }, /*#__PURE__*/React.createElement("span", {
    className: "t-prompt"
  }, "~/dev/capisco \u276F"), " pnpm test core/broker"), /*#__PURE__*/React.createElement("div", {
    className: "t-line t-dim"
  }, "$ vitest run src/core/broker.test.ts"), /*#__PURE__*/React.createElement("div", {
    className: "t-line"
  }, /*#__PURE__*/React.createElement("span", {
    className: "t-ok"
  }, "\u2713"), " broker \xB7 grants scoped capability once ", /*#__PURE__*/React.createElement("span", {
    className: "t-dim"
  }, "(4 ms)")), /*#__PURE__*/React.createElement("div", {
    className: "t-line"
  }, /*#__PURE__*/React.createElement("span", {
    className: "t-ok"
  }, "\u2713"), " broker \xB7 denies revoked principal ", /*#__PURE__*/React.createElement("span", {
    className: "t-dim"
  }, "(2 ms)")), /*#__PURE__*/React.createElement("div", {
    className: "t-line"
  }, /*#__PURE__*/React.createElement("span", {
    className: "t-ok"
  }, "\u2713"), " broker \xB7 escalates to prompt on unknown scope ", /*#__PURE__*/React.createElement("span", {
    className: "t-dim"
  }, "(6 ms)")), /*#__PURE__*/React.createElement("div", {
    className: "t-line t-dim"
  }, "Test Files  1 passed (1)"), /*#__PURE__*/React.createElement("div", {
    className: "t-line"
  }, /*#__PURE__*/React.createElement("span", {
    className: "t-ok"
  }, "\u2713"), " 3 passed ", /*#__PURE__*/React.createElement("span", {
    className: "t-dim"
  }, "\xB7 312ms")), /*#__PURE__*/React.createElement("div", {
    className: "t-line"
  }, /*#__PURE__*/React.createElement("span", {
    className: "t-prompt"
  }, "~/dev/capisco \u276F"), " ", /*#__PURE__*/React.createElement("span", {
    className: "t-caret"
  }))));
}
Object.assign(window, {
  FileExplorer,
  WorkStash,
  Terminal,
  PanelPlaceholder
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "panels.jsx", error: String((e && e.message) || e) }); }

// ui_kits/capisco-ide/agent.jsx
try { (() => {
/* Capisco IDE kit — Agents workspace (session tabs + full-width chat) + flyout. */

const AGENTS_LIST = ['Opus 4.8', 'Sonnet 4.8', 'Haiku 4.8', 'GPT-5', 'Local'];
const EFFORT_LEVELS = ['Minimal', 'Low', 'Medium', 'High', 'Higher', 'Max'];
const PLAN = [{
  label: '5-hour limit',
  right: '0%',
  pct: 0,
  color: 'var(--text-tertiary)'
}, {
  label: 'Weekly · all models',
  right: 'resets Jun 19 · 93%',
  pct: 93,
  color: 'var(--warning)'
}, {
  label: 'Sonnet only',
  right: 'resets Jun 19 · 8%',
  pct: 8,
  color: 'var(--accent)'
}, {
  label: 'Usage credits',
  right: '$1,735.15 of $2,000.00',
  pct: 87,
  color: 'var(--warning)'
}];

/* Small circular usage ring (data viz, not decoration). */
function BudgetRing({
  pct = 87,
  size = 16
}) {
  const r = 6,
    c = 2 * Math.PI * r;
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 16 16"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "8",
    cy: "8",
    r: r,
    fill: "none",
    stroke: "var(--border-strong)",
    strokeWidth: "2"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "8",
    cy: "8",
    r: r,
    fill: "none",
    stroke: "var(--warning)",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeDasharray: c,
    strokeDashoffset: c * (1 - pct / 100),
    transform: "rotate(-90 8 8)"
  }));
}

/* Composer control bar — model · effort · budget, under the chat (Claude-Desktop style). */
function ComposerBar({
  model,
  setModel,
  effort,
  setEffort,
  statusText,
  used,
  budget,
  setBudget
}) {
  const [panel, setPanel] = React.useState(null);
  const toggle = p => setPanel(x => x === p ? null : p);
  const fmtK = n => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : String(n);
  const ratio = budget > 0 ? used / budget : 0;
  const tone = ratio < 0.6 ? 'ok' : ratio < 0.85 ? 'warn' : 'crit';
  const toneColor = tone === 'ok' ? 'var(--success)' : tone === 'warn' ? 'var(--warning)' : 'var(--error)';
  const presets = [100000, 150000, 200000, 300000];
  return /*#__PURE__*/React.createElement("div", {
    className: "composer-bar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cb-stats"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cb-ctl-wrap"
  }, /*#__PURE__*/React.createElement("button", {
    className: 'cb-meter ' + tone + (panel === 'ctx' ? ' active' : ''),
    title: "Context budget \u2014 green \u2192 orange \u2192 red",
    onClick: () => toggle('ctx')
  }, /*#__PURE__*/React.createElement(Icon, {
    name: tone === 'crit' ? 'triangle-alert' : 'gauge',
    size: 13,
    color: toneColor
  }), /*#__PURE__*/React.createElement("span", {
    className: "cb-meter-val",
    style: {
      color: toneColor
    }
  }, fmtK(used), "/", fmtK(budget)), /*#__PURE__*/React.createElement("span", {
    className: "cb-meter-bar"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: Math.min(100, ratio * 100) + '%',
      background: toneColor
    }
  }))), panel === 'ctx' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "menu-scrim",
    onClick: () => setPanel(null)
  }), /*#__PURE__*/React.createElement("div", {
    className: "ctx-pop cb-pop"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bp-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "caps"
  }, "Context budget"), /*#__PURE__*/React.createElement("span", {
    className: "ctx-pct",
    style: {
      color: toneColor
    }
  }, Math.round(ratio * 100), "%")), /*#__PURE__*/React.createElement("div", {
    className: "ctx-row"
  }, "Warn at ", /*#__PURE__*/React.createElement("b", null, fmtK(budget)), " tokens \xB7 ", fmtK(used), " used"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    className: "ctx-range",
    min: "50000",
    max: "400000",
    step: "10000",
    value: budget,
    onChange: e => setBudget(+e.target.value),
    style: {
      background: `linear-gradient(90deg, var(--accent) 0 ${(budget - 50000) / 350000 * 100}%, var(--bg-raised) ${(budget - 50000) / 350000 * 100}% 100%)`,
      height: '4px',
      borderRadius: '999px'
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "ctx-presets"
  }, presets.map(v => /*#__PURE__*/React.createElement("button", {
    key: v,
    className: 'ctx-preset' + (budget === v ? ' active' : ''),
    onClick: () => setBudget(v)
  }, fmtK(v)))), /*#__PURE__*/React.createElement("div", {
    className: "ctx-note"
  }, "Turns green, then orange, then red as the session fills. At red we suggest a fresh session to save tokens.")))), /*#__PURE__*/React.createElement("span", {
    className: "cb-statline"
  }, statusText)), /*#__PURE__*/React.createElement("div", {
    className: "cb-controls"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cb-ctl-wrap"
  }, /*#__PURE__*/React.createElement("button", {
    className: 'cb-ctl' + (panel === 'model' ? ' active' : ''),
    onClick: () => toggle('model')
  }, model, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-down",
    size: 11
  })), panel === 'model' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "menu-scrim",
    onClick: () => setPanel(null)
  }), /*#__PURE__*/React.createElement("div", {
    className: "model-menu cb-pop"
  }, AGENTS_LIST.map(m => /*#__PURE__*/React.createElement("button", {
    key: m,
    className: 'model-opt' + (m === model ? ' active' : ''),
    onClick: () => {
      setModel(m);
      setPanel(null);
    }
  }, m, m === model && /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 12,
    color: "var(--accent)"
  })))))), /*#__PURE__*/React.createElement("span", {
    className: "cb-ctl-wrap"
  }, /*#__PURE__*/React.createElement("button", {
    className: 'cb-ctl cb-tune' + (panel === 'tune' ? ' active' : ''),
    title: "Effort \xB7 plan \xB7 usage",
    onClick: () => toggle('tune')
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sliders-horizontal",
    size: 14
  })), panel === 'tune' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "menu-scrim",
    onClick: () => setPanel(null)
  }), /*#__PURE__*/React.createElement("div", {
    className: "tune-pop cb-pop"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tune-sec"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ep-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ep-title"
  }, "Effort ", /*#__PURE__*/React.createElement("b", null, EFFORT_LEVELS[effort]))), /*#__PURE__*/React.createElement("div", {
    className: "ep-ends"
  }, /*#__PURE__*/React.createElement("span", null, "Faster"), /*#__PURE__*/React.createElement("span", null, "Smarter")), /*#__PURE__*/React.createElement("div", {
    className: "ep-slider"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ep-track"
  }), [0, 1, 2, 3, 4, 5].map(i => /*#__PURE__*/React.createElement("button", {
    key: i,
    className: 'ep-dot' + (i === effort ? ' thumb' : '') + (i === 5 ? ' last' : ''),
    style: {
      left: i / 5 * 100 + '%'
    },
    onClick: () => setEffort(i)
  })))), /*#__PURE__*/React.createElement("div", {
    className: "tune-sec tune-plan"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bp-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "caps"
  }, "Plan usage")), PLAN.map((p, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "bp-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bp-line"
  }, /*#__PURE__*/React.createElement("span", {
    className: "bp-label"
  }, p.label), /*#__PURE__*/React.createElement("span", {
    className: "bp-right"
  }, p.right)), /*#__PURE__*/React.createElement("div", {
    className: "bp-bar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bp-fill",
    style: {
      width: p.pct + '%',
      background: p.color
    }
  }))))))))));
}

/* Composer model selector — choose the model, nothing else. */
function ModelPicker({
  value,
  onChange
}) {
  const [open, setOpen] = React.useState(false);
  return /*#__PURE__*/React.createElement("span", {
    className: "model-pick-wrap"
  }, /*#__PURE__*/React.createElement("button", {
    className: "model-pick",
    onClick: () => setOpen(v => !v)
  }, value, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-down",
    size: 12
  })), open && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "menu-scrim",
    onClick: () => setOpen(false)
  }), /*#__PURE__*/React.createElement("div", {
    className: "model-menu up"
  }, AGENTS_LIST.map(m => /*#__PURE__*/React.createElement("button", {
    key: m,
    className: 'model-opt' + (m === value ? ' active' : ''),
    onClick: () => {
      onChange(m);
      setOpen(false);
    }
  }, m, m === value && /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 12,
    color: "var(--accent)"
  }))))));
}

/* "+" new session — pick the agent first, then a session is created. */
function NewSessionButton({
  onCreate
}) {
  const [open, setOpen] = React.useState(false);
  return /*#__PURE__*/React.createElement("span", {
    className: "new-session-wrap"
  }, /*#__PURE__*/React.createElement("button", {
    className: "session-add",
    title: "New session",
    onClick: () => setOpen(v => !v)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 15
  })), open && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "menu-scrim",
    onClick: () => setOpen(false)
  }), /*#__PURE__*/React.createElement("div", {
    className: "model-menu down"
  }, /*#__PURE__*/React.createElement("div", {
    className: "menu-head"
  }, "New session with\u2026"), AGENTS_LIST.map(m => /*#__PURE__*/React.createElement("button", {
    key: m,
    className: "model-opt",
    onClick: () => {
      onCreate(m);
      setOpen(false);
    }
  }, m)))));
}
function SessionTab({
  s,
  active,
  onClick,
  onClose
}) {
  const {
    StatusDot,
    ModelBadge
  } = window.CapiscoDesignSystem_026f1e;
  return /*#__PURE__*/React.createElement("div", {
    className: 'session-tab' + (active ? ' active' : ''),
    onClick: onClick
  }, /*#__PURE__*/React.createElement(StatusDot, {
    status: s.status
  }), /*#__PURE__*/React.createElement(ModelBadge, {
    tone: active ? 'accent' : 'neutral'
  }, s.model), /*#__PURE__*/React.createElement("span", {
    className: "st-title"
  }, s.title), /*#__PURE__*/React.createElement("span", {
    className: "st-meta"
  }, s.meta), /*#__PURE__*/React.createElement("span", {
    className: "st-x",
    title: "Close session",
    onClick: e => {
      e.stopPropagation();
      onClose && onClose();
    }
  }, "\xD7"));
}
function Msg({
  role,
  who,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: 'msg msg-' + role
  }, /*#__PURE__*/React.createElement("div", {
    className: "msg-role"
  }, who || (role === 'user' ? 'You' : 'Claude')), /*#__PURE__*/React.createElement("div", {
    className: "msg-body"
  }, children), /*#__PURE__*/React.createElement("div", {
    className: "msg-actions"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "rotate-ccw",
    size: 13,
    color: "var(--text-tertiary)"
  }), /*#__PURE__*/React.createElement(Icon, {
    name: "copy",
    size: 13,
    color: "var(--text-tertiary)"
  }), /*#__PURE__*/React.createElement(Icon, {
    name: "git-branch",
    size: 13,
    color: "var(--text-tertiary)"
  })));
}
function Transcript({
  session,
  diffOpen,
  onToggleDiff,
  onOpenFile
}) {
  const {
    ToolAction,
    PermissionPrompt
  } = window.CapiscoDesignSystem_026f1e;
  if (session.id === 's1') {
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Msg, {
      role: "user"
    }, "Tear down the worktree when a session ends, and free its allocated port."), /*#__PURE__*/React.createElement(Msg, {
      role: "agent"
    }, "I'll add a ", /*#__PURE__*/React.createElement("code", null, "teardown()"), " to ", /*#__PURE__*/React.createElement("code", null, "Worktree"), " and call it from", ' ', /*#__PURE__*/React.createElement("code", null, "SessionTree.dispose()"), ". First, the edit:"), /*#__PURE__*/React.createElement(ToolAction, {
      kind: "Edit",
      target: "src/core/worktree.ts",
      added: 12,
      removed: 4,
      expanded: diffOpen,
      onToggle: onToggleDiff,
      onOpen: () => onOpenFile && onOpenFile('worktree.ts')
    }, /*#__PURE__*/React.createElement("div", {
      className: "diff-add"
    }, "+  async teardown() ", '{'), /*#__PURE__*/React.createElement("div", {
      className: "diff-add"
    }, "+    await this.broker.release(this.port);"), /*#__PURE__*/React.createElement("div", {
      className: "diff-add"
    }, "+    await rm(this.dir, ", '{', " recursive: true ", '}', ");"), /*#__PURE__*/React.createElement("div", {
      className: "diff-del"
    }, "-    // TODO: free port")), /*#__PURE__*/React.createElement(Msg, {
      role: "agent"
    }, "Now removing the temp worktree directory:"), /*#__PURE__*/React.createElement(PermissionPrompt, {
      command: "Bash(rm -rf .worktrees/tmp)",
      label: "Approval required"
    }));
  }
  if (session.id === 's2') {
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Msg, {
      role: "user"
    }, "Refactor the broker so grants are immutable once issued."), /*#__PURE__*/React.createElement(Msg, {
      role: "agent",
      who: "GPT-5"
    }, "Plan: freeze the ", /*#__PURE__*/React.createElement("code", null, "Grant"), " record on issue and route revocations through a", ' ', /*#__PURE__*/React.createElement("code", null, "tombstone"), " set. Want me to keep the existing ", /*#__PURE__*/React.createElement("code", null, "Map"), " API?"), /*#__PURE__*/React.createElement(Msg, {
      role: "user"
    }, "Yes, keep the API. Session is idle until you confirm."));
  }
  if (session.id === 's3') {
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Msg, {
      role: "user"
    }, "Where is the port allocated for a worktree?"), /*#__PURE__*/React.createElement(Msg, {
      role: "agent",
      who: "Local"
    }, "Searching the workspace for ", /*#__PURE__*/React.createElement("code", null, "allocatePort"), " and ", /*#__PURE__*/React.createElement("code", null, "this.port"), " \u2026"), /*#__PURE__*/React.createElement(ToolAction, {
      kind: "Search",
      target: "\"where is port allocated?\" \xB7 7 hits",
      onOpen: () => onOpenFile && onOpenFile('worktree.ts')
    }), /*#__PURE__*/React.createElement(PermissionPrompt, {
      command: "Read(src/core/**, *.ts)",
      label: "Approval required",
      scopes: ['Once', 'This session', 'Deny']
    }));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "chat-empty"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: 24,
    color: "var(--text-tertiary)"
  }), /*#__PURE__*/React.createElement("div", {
    className: "ce-title"
  }, "New session \xB7 ", session.model), /*#__PURE__*/React.createElement("div", {
    className: "ce-sub"
  }, "Describe a task to start the agent."));
}
function AgentWorkspace({
  onOpenFile,
  kind = 'agents'
}) {
  const isChat = kind === 'chat';
  const seed = isChat ? window.CHAT_SESSIONS : window.SESSIONS;
  const {
    Input,
    IconButton
  } = window.CapiscoDesignSystem_026f1e;
  const [active, setActive] = React.useState(seed[0].id);
  const [diffOpen, setDiffOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [backend, setBackend] = React.useState('api');
  const [token, setToken] = React.useState('');
  const [autoRoute, setAutoRoute] = React.useState(false);
  const [terse, setTerse] = React.useState(true);
  const [terseLevel, setTerseLevel] = React.useState('Full');
  const [model, setModel] = React.useState(isChat ? 'Sonnet 4.8' : 'Opus 4.8');
  const [effort, setEffort] = React.useState(3);
  const [budget, setBudget] = React.useState(200000);
  const [used] = React.useState(isChat ? 38000 : 172000);
  const [ctxDismiss, setCtxDismiss] = React.useState(false);
  const ratio = used / budget;
  const ctxCritical = ratio >= 0.85 && !ctxDismiss;
  const [extra, setExtra] = React.useState([]);
  const [closed, setClosed] = React.useState([]);
  const sessions = [...seed, ...extra].filter(s => !closed.includes(s.id));
  const cur = sessions.find(s => s.id === active) || sessions[0];
  const createSession = agent => {
    const id = 'n' + (extra.length + 1);
    setExtra(e => [...e, {
      id,
      model: agent.split(' ')[0],
      title: isChat ? 'New chat' : 'New session',
      meta: 'idle',
      status: 'idle'
    }]);
    setActive(id);
  };
  const closeSession = id => {
    const remaining = sessions.filter(s => s.id !== id);
    setExtra(e => e.filter(x => x.id !== id));
    setClosed(c => c.includes(id) ? c : [...c, id]);
    if (active === id && remaining.length) setActive(remaining[0].id);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "agent-workspace"
  }, /*#__PURE__*/React.createElement("div", {
    className: "session-tabbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "session-tabs"
  }, sessions.map(s => /*#__PURE__*/React.createElement(SessionTab, {
    key: s.id,
    s: s,
    active: active === s.id,
    onClick: () => setActive(s.id),
    onClose: () => closeSession(s.id)
  }))), /*#__PURE__*/React.createElement(NewSessionButton, {
    onCreate: createSession
  }), /*#__PURE__*/React.createElement("button", {
    className: 'session-gear' + (settingsOpen ? ' active' : ''),
    title: isChat ? 'Chat settings' : 'Agent backend settings',
    onClick: () => setSettingsOpen(v => !v)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "settings",
    size: 15
  }))), !isChat && cur.subs && /*#__PURE__*/React.createElement("div", {
    className: "subagent-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "branch-stub"
  }, "\u2514"), cur.subs.map(sub => {
    const {
      StatusDot
    } = window.CapiscoDesignSystem_026f1e;
    return /*#__PURE__*/React.createElement("span", {
      key: sub.id,
      className: "subagent-chip"
    }, /*#__PURE__*/React.createElement(StatusDot, {
      status: sub.status,
      size: 7
    }), sub.title, /*#__PURE__*/React.createElement("span", {
      className: "sub-meta"
    }, sub.meta));
  })), /*#__PURE__*/React.createElement("div", {
    className: "chat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "chat-inner"
  }, isChat ? /*#__PURE__*/React.createElement(ChatTranscript, {
    session: cur
  }) : /*#__PURE__*/React.createElement(Transcript, {
    session: cur,
    diffOpen: diffOpen,
    onToggleDiff: () => setDiffOpen(!diffOpen),
    onOpenFile: onOpenFile
  }))), /*#__PURE__*/React.createElement("div", {
    className: "composer"
  }, /*#__PURE__*/React.createElement("div", {
    className: "composer-inner"
  }, ctxCritical && /*#__PURE__*/React.createElement("div", {
    className: "ctx-banner"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "triangle-alert",
    size: 16,
    color: "var(--error)"
  }), /*#__PURE__*/React.createElement("div", {
    className: "ctx-banner-text"
  }, /*#__PURE__*/React.createElement("b", null, "Session is ", Math.round(ratio * 100), "% of its token budget."), " Long sessions cost more and dull responses \u2014 start a fresh one to keep it lean."), /*#__PURE__*/React.createElement("div", {
    className: "ctx-banner-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "ctx-btn ctx-btn-primary",
    onClick: () => {
      createSession(model);
      setCtxDismiss(true);
    }
  }, "New session"), /*#__PURE__*/React.createElement("button", {
    className: "ctx-btn",
    onClick: () => setCtxDismiss(true)
  }, "Keep going"))), /*#__PURE__*/React.createElement(Input, {
    mono: true,
    placeholder: "Message Capisco\u2026",
    trailing: /*#__PURE__*/React.createElement(IconButton, {
      size: 24,
      icon: /*#__PURE__*/React.createElement(Icon, {
        name: "arrow-up",
        size: 15,
        color: "var(--accent)"
      }),
      title: "Send"
    })
  }), /*#__PURE__*/React.createElement(ComposerBar, {
    model: model,
    setModel: setModel,
    effort: effort,
    setEffort: setEffort,
    used: used,
    budget: budget,
    setBudget: setBudget,
    statusText: isChat ? (backend === 'api' ? 'API' : 'CLI · claude 1.4.2') + ' · quick chat · no tools' : (backend === 'api' ? 'API' : 'CLI · claude 1.4.2') + ' · $0.04 · running 2m49s'
  }))), settingsOpen && /*#__PURE__*/React.createElement(AgentSettings, {
    backend: backend,
    setBackend: setBackend,
    token: token,
    setToken: setToken,
    autoRoute: autoRoute,
    setAutoRoute: setAutoRoute,
    terse: terse,
    setTerse: setTerse,
    terseLevel: terseLevel,
    setTerseLevel: setTerseLevel,
    onClose: () => setSettingsOpen(false)
  }));
}

/* Agent backend settings popover — API client (with token) or installed CLI. */
function AgentSettings({
  backend,
  setBackend,
  token,
  setToken,
  onClose,
  autoRoute,
  setAutoRoute,
  terse,
  setTerse,
  terseLevel,
  setTerseLevel
}) {
  const {
    Input,
    Button
  } = window.CapiscoDesignSystem_026f1e;
  return /*#__PURE__*/React.createElement("div", {
    className: "agent-settings"
  }, /*#__PURE__*/React.createElement("div", {
    className: "as-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "caps"
  }, "Agent backend"), /*#__PURE__*/React.createElement("button", {
    className: "as-close",
    title: "Close",
    onClick: onClose
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 14,
    color: "var(--text-secondary)"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "as-seg"
  }, /*#__PURE__*/React.createElement("button", {
    className: 'as-opt' + (backend === 'api' ? ' active' : ''),
    onClick: () => setBackend('api')
  }, "API client"), /*#__PURE__*/React.createElement("button", {
    className: 'as-opt' + (backend === 'cli' ? ' active' : ''),
    onClick: () => setBackend('cli')
  }, "Installed CLI")), backend === 'api' ? /*#__PURE__*/React.createElement("div", {
    className: "as-body"
  }, /*#__PURE__*/React.createElement("label", {
    className: "as-label"
  }, "Provider"), /*#__PURE__*/React.createElement("button", {
    className: "as-select"
  }, "Anthropic \xB7 Claude", /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-down",
    size: 13,
    color: "var(--text-secondary)"
  })), /*#__PURE__*/React.createElement("label", {
    className: "as-label"
  }, "API token"), /*#__PURE__*/React.createElement(Input, {
    mono: true,
    type: "password",
    placeholder: "sk-ant-\u2026",
    value: token,
    onChange: e => setToken(e.target.value)
  }), /*#__PURE__*/React.createElement("div", {
    className: "as-note"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "lock",
    size: 11,
    color: "var(--text-tertiary)"
  }), "Stored in your OS keychain."), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "md",
    style: {
      width: '100%',
      marginTop: 2
    },
    onClick: onClose
  }, "Save")) : /*#__PURE__*/React.createElement("div", {
    className: "as-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "as-detected"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "circle-check",
    size: 14,
    color: "var(--success)"
  }), "claude 1.4.2 detected"), /*#__PURE__*/React.createElement("div", {
    className: "as-path"
  }, "/usr/local/bin/claude"), /*#__PURE__*/React.createElement("div", {
    className: "as-note"
  }, "Capisco shells out to your installed CLI. No token stored."), /*#__PURE__*/React.createElement(Button, {
    variant: "default",
    size: "md",
    style: {
      width: '100%',
      marginTop: 2
    }
  }, "Re-detect CLI")), /*#__PURE__*/React.createElement("div", {
    className: "as-sec"
  }, /*#__PURE__*/React.createElement("span", {
    className: "caps"
  }, "Token economy"), /*#__PURE__*/React.createElement("div", {
    className: "as-toggle"
  }, /*#__PURE__*/React.createElement("div", {
    className: "as-toggle-main"
  }, /*#__PURE__*/React.createElement("button", {
    className: 'as-switch' + (autoRoute ? ' on' : ''),
    role: "switch",
    "aria-checked": autoRoute,
    onClick: () => setAutoRoute(!autoRoute)
  }, /*#__PURE__*/React.createElement("span", {
    className: "as-knob"
  })), /*#__PURE__*/React.createElement("div", {
    className: "as-toggle-text"
  }, /*#__PURE__*/React.createElement("div", {
    className: "as-toggle-title"
  }, "Auto model routing"), /*#__PURE__*/React.createElement("div", {
    className: "as-toggle-sub"
  }, "Mechanical sub-tasks run on a smaller model; escalates if quality checks fail. Off by default.")))), /*#__PURE__*/React.createElement("div", {
    className: "as-toggle"
  }, /*#__PURE__*/React.createElement("div", {
    className: "as-toggle-main"
  }, /*#__PURE__*/React.createElement("button", {
    className: 'as-switch' + (terse ? ' on' : ''),
    role: "switch",
    "aria-checked": terse,
    onClick: () => setTerse(!terse)
  }, /*#__PURE__*/React.createElement("span", {
    className: "as-knob"
  })), /*#__PURE__*/React.createElement("div", {
    className: "as-toggle-text"
  }, /*#__PURE__*/React.createElement("div", {
    className: "as-toggle-title"
  }, "Terse mode ", /*#__PURE__*/React.createElement("span", {
    className: "as-tag"
  }, "Caveman")), /*#__PURE__*/React.createElement("div", {
    className: "as-toggle-sub"
  }, "Shorter replies, fewer output tokens. Never touches facts, diffs, or broker prompts. On by default."))), terse && /*#__PURE__*/React.createElement("div", {
    className: "trow-seg as-level"
  }, ['Lite', 'Full', 'Ultra'].map(l => /*#__PURE__*/React.createElement("button", {
    key: l,
    className: 'trow-opt' + (terseLevel === l ? ' active' : ''),
    onClick: () => setTerseLevel(l)
  }, l))))));
}

/* Alerts / Inspect tool panel — rendered as a side flyout (pin handled by host). */
function FlyoutPanel({
  kind
}) {
  const isAlerts = kind === 'alerts';
  const items = isAlerts ? window.ALERTS : window.INSPECTIONS;
  return /*#__PURE__*/React.createElement("div", {
    className: "explorer"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "caps"
  }, isAlerts ? 'Alerts' : 'Inspections')), /*#__PURE__*/React.createElement("div", {
    className: "flyout-body"
  }, items.map((a, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "alert-item"
  }, /*#__PURE__*/React.createElement("span", {
    className: 'alert-dot sev-' + a.sev
  }), /*#__PURE__*/React.createElement("div", {
    className: "alert-text"
  }, /*#__PURE__*/React.createElement("div", {
    className: "alert-title"
  }, a.title), /*#__PURE__*/React.createElement("div", {
    className: "alert-sub"
  }, a.sub))))));
}

/* Chat workspace — a single lightweight conversation with Capisco.
   No session-tree, no subagents, no tool actions: a plain assistant chat. */
function ChatTranscript({
  session
}) {
  if (session.id === 'c2') {
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Msg, {
      role: "user"
    }, "Explain the session-tree in one paragraph."), /*#__PURE__*/React.createElement(Msg, {
      role: "agent"
    }, "A session is one model thread. Subagents are child sessions that share the parent's worktree-workspace, so they see the same files and grants but run their own context. The tree lets you fan out work and still review it in one place."));
  }
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Msg, {
    role: "user"
  }, "How does the capability broker decide when to prompt me?"), /*#__PURE__*/React.createElement(Msg, {
    role: "agent"
  }, "It checks the requested ", /*#__PURE__*/React.createElement("code", null, "(principal, capability, scope)"), " against existing grants. A cached ", /*#__PURE__*/React.createElement("code", null, "session"), " grant passes silently; anything broader \u2014 or a", ' ', /*#__PURE__*/React.createElement("code", null, "production"), " datasource, or a secret \u2014 always escalates to a prompt."), /*#__PURE__*/React.createElement(Msg, {
    role: "user"
  }, "Can I pre-approve read-only shell for this session?"), /*#__PURE__*/React.createElement(Msg, {
    role: "agent"
  }, "Yes \u2014 grant ", /*#__PURE__*/React.createElement("code", null, "Bash(read-only)"), " at ", /*#__PURE__*/React.createElement("code", null, "session"), " scope from the next prompt. Writes and network still escalate per-command."));
}

/* Chat workspace — same component as Agents, different system (no tools/subagents). */
function ChatWorkspace() {
  return /*#__PURE__*/React.createElement(AgentWorkspace, {
    kind: "chat"
  });
}
Object.assign(window, {
  AgentWorkspace,
  ChatWorkspace,
  ChatTranscript,
  AgentSettings,
  FlyoutPanel
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/capisco-ide/agent.jsx", error: String((e && e.message) || e) }); }

// ui_kits/capisco-ide/charts.jsx
try { (() => {
/* Capisco IDE kit — lightweight SVG charts for the Git dashboard. */

/* Smooth-ish line chart over weekly data, with x-axis labels. */
function LineChart({
  data,
  labels,
  color = 'var(--accent)',
  height = 150,
  fmt = v => v
}) {
  const W = 640,
    H = height,
    pad = {
      l: 38,
      r: 10,
      t: 12,
      b: 22
    };
  const max = Math.max(...data),
    min = Math.min(0, ...data);
  const span = max - min || 1;
  const x = i => pad.l + i * (W - pad.l - pad.r) / (data.length - 1);
  const y = v => pad.t + (1 - (v - min) / span) * (H - pad.t - pad.b);
  const pts = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const ticks = [max, min + span * 0.5, min];
  return /*#__PURE__*/React.createElement("svg", {
    className: "chart",
    viewBox: `0 0 ${W} ${H}`,
    preserveAspectRatio: "none"
  }, ticks.map((t, i) => {
    const yy = pad.t + (1 - (t - min) / span) * (H - pad.t - pad.b);
    return /*#__PURE__*/React.createElement("g", {
      key: i
    }, /*#__PURE__*/React.createElement("line", {
      x1: pad.l,
      x2: W - pad.r,
      y1: yy,
      y2: yy,
      stroke: "var(--border)",
      strokeWidth: "1",
      vectorEffect: "non-scaling-stroke"
    }), /*#__PURE__*/React.createElement("text", {
      x: pad.l - 6,
      y: yy + 3,
      className: "chart-axis",
      textAnchor: "end"
    }, fmt(Math.round(t))));
  }), /*#__PURE__*/React.createElement("polyline", {
    points: pts,
    fill: "none",
    stroke: color,
    strokeWidth: "2",
    vectorEffect: "non-scaling-stroke",
    strokeLinejoin: "round",
    strokeLinecap: "round"
  }), data.map((v, i) => /*#__PURE__*/React.createElement("circle", {
    key: i,
    cx: x(i),
    cy: y(v),
    r: "2.5",
    fill: "var(--surface-editor)",
    stroke: color,
    strokeWidth: "1.5",
    vectorEffect: "non-scaling-stroke"
  })), labels.map((l, i) => i % 2 === 0 && /*#__PURE__*/React.createElement("text", {
    key: i,
    x: x(i),
    y: H - 6,
    className: "chart-axis",
    textAnchor: "middle"
  }, l)));
}

/* Donut chart for category split. */
function Donut({
  segments,
  size = 150
}) {
  const total = segments.reduce((n, s) => n + s.value, 0);
  const r = 54,
    c = 2 * Math.PI * r;
  let acc = 0;
  return /*#__PURE__*/React.createElement("div", {
    className: "donut-wrap"
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 160 160",
    width: size,
    height: size
  }, /*#__PURE__*/React.createElement("g", {
    transform: "rotate(-90 80 80)"
  }, segments.map((s, i) => {
    const len = c * s.value / total;
    const el = /*#__PURE__*/React.createElement("circle", {
      key: i,
      cx: "80",
      cy: "80",
      r: r,
      fill: "none",
      stroke: s.color,
      strokeWidth: "22",
      strokeDasharray: `${len} ${c - len}`,
      strokeDashoffset: -acc
    });
    acc += len;
    return el;
  }))), /*#__PURE__*/React.createElement("div", {
    className: "donut-legend"
  }, segments.map(s => /*#__PURE__*/React.createElement("span", {
    key: s.label,
    className: "dl-item"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dl-dot",
    style: {
      background: s.color
    }
  }), s.label, " ", /*#__PURE__*/React.createElement("b", null, Math.round(s.value / total * 100), "%")))));
}

/* DORA-style metric card. */
function MetricCard({
  m
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "mc"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mc-top"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mc-label"
  }, m.label), m.tier && /*#__PURE__*/React.createElement("span", {
    className: 'mc-tier tier-' + m.tier.toLowerCase()
  }, m.tier)), /*#__PURE__*/React.createElement("div", {
    className: "mc-val"
  }, m.value, m.delta && /*#__PURE__*/React.createElement("span", {
    className: 'mc-delta ' + (m.good ? 'good' : 'bad')
  }, m.delta)), /*#__PURE__*/React.createElement("div", {
    className: "mc-sub"
  }, m.sub));
}

/* Card shell with the reference toolbar (image / download / expand / bookmark). */
function ChartCard({
  title,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "cc"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cc-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cc-title"
  }, title), /*#__PURE__*/React.createElement("div", {
    className: "cc-tools"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "image",
    size: 14,
    color: "var(--text-tertiary)"
  }), /*#__PURE__*/React.createElement(Icon, {
    name: "download",
    size: 14,
    color: "var(--text-tertiary)"
  }), /*#__PURE__*/React.createElement(Icon, {
    name: "maximize-2",
    size: 14,
    color: "var(--text-tertiary)"
  }), /*#__PURE__*/React.createElement(Icon, {
    name: "bookmark",
    size: 14,
    color: "var(--text-tertiary)"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "cc-body"
  }, children));
}

/* Working-times heatmap: 7 days × 24h. Green = core hours, red = off-hours/weekend. */
function Heatmap({
  grid,
  coreStart,
  coreEnd
}) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return /*#__PURE__*/React.createElement("div", {
    className: "hm"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hm-row hm-hours"
  }, /*#__PURE__*/React.createElement("span", {
    className: "hm-day"
  }), Array.from({
    length: 24
  }, (_, h) => {
    const off = h < coreStart || h >= coreEnd;
    return /*#__PURE__*/React.createElement("span", {
      key: h,
      className: 'hm-h' + (off ? ' off' : '')
    }, h, "h");
  })), grid.map((row, d) => {
    const weekend = d >= 5;
    return /*#__PURE__*/React.createElement("div", {
      className: "hm-row",
      key: d
    }, /*#__PURE__*/React.createElement("span", {
      className: 'hm-day' + (weekend ? ' off' : '')
    }, days[d]), row.map((v, h) => {
      const off = weekend || h < coreStart || h >= coreEnd;
      const base = off ? '231,76,60' : '46,168,90';
      const op = 0.16 + v * 0.84;
      return /*#__PURE__*/React.createElement("span", {
        key: h,
        className: "hm-cell",
        title: `${days[d]} ${h}:00 · ${Math.round(v * 100)}%`,
        style: {
          background: `rgba(${base},${off ? Math.max(0.16, v) : op})`
        }
      });
    }));
  }));
}

/* Burndown: ideal (dashed) vs actual (solid, stops at today). */
function BurndownChart({
  ideal,
  actual,
  height = 200,
  accent = "var(--accent)"
}) {
  const W = 640,
    H = height,
    pad = {
      l: 34,
      r: 12,
      t: 12,
      b: 24
    };
  const n = ideal.length;
  const max = Math.max(...ideal, ...actual.filter(v => v != null));
  const x = i => pad.l + i * (W - pad.l - pad.r) / (n - 1);
  const y = v => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const idealPts = ideal.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const actualPts = actual.map((v, i) => v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`).filter(Boolean).join(" ");
  const lastIdx = actual.reduce((a, v, i) => v != null ? i : a, 0);
  const ticks = [max, max / 2, 0];
  return /*#__PURE__*/React.createElement("svg", {
    className: "chart",
    viewBox: `0 0 ${W} ${H}`,
    preserveAspectRatio: "none"
  }, ticks.map((t, i) => {
    const yy = pad.t + (1 - t / max) * (H - pad.t - pad.b);
    return /*#__PURE__*/React.createElement("g", {
      key: i
    }, /*#__PURE__*/React.createElement("line", {
      x1: pad.l,
      x2: W - pad.r,
      y1: yy,
      y2: yy,
      stroke: "var(--border)",
      strokeWidth: "1",
      vectorEffect: "non-scaling-stroke"
    }), /*#__PURE__*/React.createElement("text", {
      x: pad.l - 6,
      y: yy + 3,
      className: "chart-axis",
      textAnchor: "end"
    }, Math.round(t)));
  }), /*#__PURE__*/React.createElement("polyline", {
    points: idealPts,
    fill: "none",
    stroke: "var(--text-tertiary)",
    strokeWidth: "1.5",
    strokeDasharray: "4 4",
    vectorEffect: "non-scaling-stroke"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: actualPts,
    fill: "none",
    stroke: accent,
    strokeWidth: "2",
    vectorEffect: "non-scaling-stroke",
    strokeLinejoin: "round",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: x(lastIdx),
    cy: y(actual[lastIdx]),
    r: "3",
    fill: accent
  }), ideal.map((_, i) => i % 2 === 0 && /*#__PURE__*/React.createElement("text", {
    key: i,
    x: x(i),
    y: H - 7,
    className: "chart-axis",
    textAnchor: "middle"
  }, "d", i)));
}
Object.assign(window, {
  LineChart,
  BurndownChart,
  Donut,
  MetricCard,
  ChartCard,
  Heatmap
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/capisco-ide/charts.jsx", error: String((e && e.message) || e) }); }

// ui_kits/capisco-ide/chrome.jsx
try { (() => {
/* Capisco IDE kit — chrome: TitleBar, draggable tool bars, StatusBar.
   Tools open a flyout on whichever bar their icon lives; workspace buttons
   (Agents / Editor / Git / Terminal) are fixed and switch the workspace. */

const DS = () => window.CapiscoDesignSystem_026f1e || {};
function TitleBar({
  theme,
  onToggleTheme
}) {
  const {
    IconButton
  } = DS();
  return /*#__PURE__*/React.createElement("div", {
    className: "titlebar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tb-traffic"
  }, /*#__PURE__*/React.createElement("span", {
    className: "tl tl-r"
  }), /*#__PURE__*/React.createElement("span", {
    className: "tl tl-y"
  }), /*#__PURE__*/React.createElement("span", {
    className: "tl tl-g"
  })), /*#__PURE__*/React.createElement("img", {
    className: "tb-mark",
    src: "../../assets/capisco-mark.svg",
    width: "18",
    height: "18",
    alt: ""
  }), /*#__PURE__*/React.createElement("button", {
    className: "tb-chip"
  }, "capisco", /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-down",
    size: 13
  })), /*#__PURE__*/React.createElement("button", {
    className: "tb-chip tb-branch"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "git-branch",
    size: 13
  }), "feat/worktree-teardown", /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-down",
    size: 13
  })), /*#__PURE__*/React.createElement("div", {
    className: "tb-spacer"
  }), /*#__PURE__*/React.createElement(IconButton, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "play",
      size: 15
    }),
    title: "Run"
  }), /*#__PURE__*/React.createElement("button", {
    className: "tb-chip tb-run"
  }, "Dev", /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-down",
    size: 13
  })), /*#__PURE__*/React.createElement(IconButton, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "search",
      size: 15
    }),
    title: "Search everywhere"
  }), /*#__PURE__*/React.createElement(IconButton, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: theme === 'light' ? 'moon' : 'sun',
      size: 15
    }),
    title: "Toggle theme",
    onClick: onToggleTheme
  }), /*#__PURE__*/React.createElement(IconButton, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "ellipsis",
      size: 15
    }),
    title: "More"
  }), /*#__PURE__*/React.createElement(IconButton, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "settings",
      size: 15
    }),
    title: "Settings"
  }));
}

/* Registry of draggable tools (each opens a side flyout). */
const TOOLS = {
  explorer: {
    icon: 'files',
    label: 'Explorer'
  },
  changes: {
    icon: 'file-diff',
    label: 'Changes'
  },
  commit: {
    icon: 'git-compare',
    label: 'Commit'
  },
  pr: {
    icon: 'git-pull-request',
    label: 'PR'
  },
  tasks: {
    icon: 'list-checks',
    label: 'Tasks'
  },
  search: {
    icon: 'search',
    label: 'Search'
  },
  structure: {
    icon: 'list-tree',
    label: 'Structure'
  },
  data: {
    icon: 'database',
    label: 'Data'
  },
  services: {
    icon: 'container',
    label: 'Services'
  },
  alerts: {
    icon: 'bell',
    label: 'Alerts'
  },
  inspect: {
    icon: 'scan-search',
    label: 'Inspect'
  }
};
function ToolBtn({
  id,
  region,
  index,
  active,
  onSelect,
  onMove
}) {
  const t = TOOLS[id];
  const [over, setOver] = React.useState(false);
  const [menu, setMenu] = React.useState(false);
  const targets = [['lefttop', 'Top of left bar', 'panel-top'], ['leftbottom', 'Bottom of left bar', 'panel-bottom'], ['right', 'Right bar', 'panel-right']];
  const side = region === 'right' ? 'right' : 'left';
  return /*#__PURE__*/React.createElement("div", {
    className: "ab-itemwrap"
  }, /*#__PURE__*/React.createElement("button", {
    className: 'ab-item' + (active ? ' active' : '') + (over ? ' ab-over' : ''),
    title: t.label,
    draggable: true,
    onClick: onSelect,
    onContextMenu: e => {
      e.preventDefault();
      setMenu(m => !m);
    },
    onDragStart: e => {
      e.dataTransfer.setData('cap-tool', id);
      e.dataTransfer.effectAllowed = 'move';
    },
    onDragOver: e => {
      e.preventDefault();
      setOver(true);
    },
    onDragLeave: () => setOver(false),
    onDrop: e => {
      e.preventDefault();
      e.stopPropagation();
      setOver(false);
      const d = e.dataTransfer.getData('cap-tool');
      if (d && d !== id) onMove(d, region, index);
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: t.icon,
    size: 18
  }), /*#__PURE__*/React.createElement("span", {
    className: "ab-label"
  }, t.label)), menu && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "menu-scrim",
    onClick: () => setMenu(false),
    onContextMenu: e => {
      e.preventDefault();
      setMenu(false);
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: 'ab-menu ' + side
  }, /*#__PURE__*/React.createElement("div", {
    className: "ab-menu-head"
  }, "Move \u201C", t.label, "\u201D"), targets.filter(([r]) => r !== region).map(([r, label, icon]) => /*#__PURE__*/React.createElement("button", {
    key: r,
    className: "ab-menu-item",
    onClick: () => {
      setMenu(false);
      onMove(id, r, 99);
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 13
  }), label)))));
}

/* A left-bar item: a tool OR the Terminal toggle. Draggable + a drop target
   that inserts the dragged item immediately before it. */
function LeftItem({
  id,
  group,
  active,
  terminalOpen,
  onSelect,
  onToggleTerm,
  onDropBefore
}) {
  const isTerm = id === '__terminal__';
  const t = isTerm ? {
    icon: 'square-terminal',
    label: 'Terminal'
  } : TOOLS[id];
  const [over, setOver] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    className: "ab-itemwrap",
    onDragOver: e => {
      e.preventDefault();
      setOver(true);
    },
    onDragLeave: () => setOver(false),
    onDrop: e => {
      e.preventDefault();
      setOver(false);
      const d = e.dataTransfer.getData('cap-tool');
      if (d && d !== id) onDropBefore(d, group, id);
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: 'ab-item' + (active || isTerm && terminalOpen ? ' active' : '') + (over ? ' ab-over' : ''),
    title: t.label,
    draggable: true,
    onClick: isTerm ? onToggleTerm : onSelect,
    onDragStart: e => {
      e.dataTransfer.setData('cap-tool', id);
      e.dataTransfer.effectAllowed = 'move';
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: t.icon,
    size: 18
  }), /*#__PURE__*/React.createElement("span", {
    className: "ab-label"
  }, t.label)));
}

/* Left bar: a single ordered list of tools + the Terminal toggle. Whatever sits
   ABOVE Terminal opens in the top pane, BELOW it in the bottom pane. Terminal is
   itself draggable, so its position sets the split boundary. */
function ActivityBar({
  leftTop,
  leftBottom,
  topActive,
  botActive,
  onSelect,
  onToggleTerm,
  onReorder,
  terminalOpen
}) {
  const item = (id, group) => /*#__PURE__*/React.createElement(LeftItem, {
    key: id,
    id: id,
    group: group,
    active: id === topActive || id === botActive,
    terminalOpen: terminalOpen,
    onSelect: () => onSelect(id),
    onToggleTerm: onToggleTerm,
    onDropBefore: onReorder
  });
  return /*#__PURE__*/React.createElement("div", {
    className: "activitybar left"
  }, leftTop.map(id => item(id, 'top')), /*#__PURE__*/React.createElement("div", {
    className: "ab-fill",
    onDragOver: e => {
      e.preventDefault();
      e.currentTarget.classList.add('ab-filldrop');
    },
    onDragLeave: e => e.currentTarget.classList.remove('ab-filldrop'),
    onDrop: e => {
      e.preventDefault();
      e.currentTarget.classList.remove('ab-filldrop');
      const d = e.dataTransfer.getData('cap-tool');
      if (d) onReorder(d, 'top', null);
    }
  }), leftBottom.map(id => item(id, 'bottom')), /*#__PURE__*/React.createElement("div", {
    className: 'ab-fillbottom' + (leftBottom.length ? ' filled' : ''),
    onDragOver: e => {
      e.preventDefault();
      e.currentTarget.classList.add('ab-filldrop');
    },
    onDragLeave: e => e.currentTarget.classList.remove('ab-filldrop'),
    onDrop: e => {
      e.preventDefault();
      e.currentTarget.classList.remove('ab-filldrop');
      const d = e.dataTransfer.getData('cap-tool');
      if (d) onReorder(d, 'bottom', null);
    }
  }));
}

/* Right bar: fixed workspace toggles + a top tool group, fill, bottom tool group. */
function RightRail({
  mode,
  onMode,
  rightTop,
  rightBottom,
  topActive,
  botActive,
  onSelect,
  onReorder
}) {
  const item = (id, group) => /*#__PURE__*/React.createElement(LeftItem, {
    key: id,
    id: id,
    group: group,
    active: id === topActive || id === botActive,
    onSelect: () => onSelect(id),
    onDropBefore: onReorder
  });
  return /*#__PURE__*/React.createElement("div", {
    className: "activitybar right"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ab-top-fixed"
  }, /*#__PURE__*/React.createElement("button", {
    className: 'ab-item' + (mode === 'agents' ? ' active' : ''),
    title: "Agents",
    onClick: () => onMode('agents')
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "bot",
    size: 18
  }), /*#__PURE__*/React.createElement("span", {
    className: "ab-label"
  }, "Agents")), /*#__PURE__*/React.createElement("button", {
    className: 'ab-item' + (mode === 'chat' ? ' active' : ''),
    title: "Chat",
    onClick: () => onMode('chat')
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "message-square",
    size: 18
  }), /*#__PURE__*/React.createElement("span", {
    className: "ab-label"
  }, "Chat")), /*#__PURE__*/React.createElement("button", {
    className: 'ab-item' + (mode === 'editor' ? ' active' : ''),
    title: "Editor",
    onClick: () => onMode('editor')
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "square-code",
    size: 18
  }), /*#__PURE__*/React.createElement("span", {
    className: "ab-label"
  }, "Editor")), /*#__PURE__*/React.createElement("button", {
    className: 'ab-item' + (mode === 'git' ? ' active' : ''),
    title: "Git",
    onClick: () => onMode('git')
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "git-graph",
    size: 18
  }), /*#__PURE__*/React.createElement("span", {
    className: "ab-label"
  }, "Git")), /*#__PURE__*/React.createElement("button", {
    className: 'ab-item' + (mode === 'tasks' ? ' active' : ''),
    title: "Tasks",
    onClick: () => onMode('tasks')
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "kanban",
    size: 18
  }), /*#__PURE__*/React.createElement("span", {
    className: "ab-label"
  }, "Tasks"))), /*#__PURE__*/React.createElement("div", {
    className: "ab-div"
  }), rightTop.map(id => item(id, 'rtop')), /*#__PURE__*/React.createElement("div", {
    className: "ab-fill",
    onDragOver: e => {
      e.preventDefault();
      e.currentTarget.classList.add('ab-filldrop');
    },
    onDragLeave: e => e.currentTarget.classList.remove('ab-filldrop'),
    onDrop: e => {
      e.preventDefault();
      e.currentTarget.classList.remove('ab-filldrop');
      const d = e.dataTransfer.getData('cap-tool');
      if (d) onReorder(d, 'rtop', null);
    }
  }), rightBottom.map(id => item(id, 'rbot')), /*#__PURE__*/React.createElement("div", {
    className: 'ab-fillbottom' + (rightBottom.length ? ' filled' : ''),
    onDragOver: e => {
      e.preventDefault();
      e.currentTarget.classList.add('ab-filldrop');
    },
    onDragLeave: e => e.currentTarget.classList.remove('ab-filldrop'),
    onDrop: e => {
      e.preventDefault();
      e.currentTarget.classList.remove('ab-filldrop');
      const d = e.dataTransfer.getData('cap-tool');
      if (d) onReorder(d, 'rbot', null);
    }
  }));
}
function StatusBar({
  mode
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "statusbar"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sb-crumb"
  }, mode === 'agents' ? 'agents › Claude › Implement worktree teardown' : mode === 'git' ? 'git › activity · this week' : mode === 'tasks' ? 'tasks › sprint 24' : mode === 'diff' ? 'diff › src › core › worktree.ts' : 'capisco › src › core › broker.ts'), /*#__PURE__*/React.createElement("div", {
    className: "tb-spacer"
  }), /*#__PURE__*/React.createElement("span", {
    className: "sb-item"
  }, "TypeScript 5.4"), /*#__PURE__*/React.createElement("span", {
    className: "sb-item"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "git-branch",
    size: 12
  }), "feat/worktree-teardown ", /*#__PURE__*/React.createElement("span", {
    className: "up"
  }, "\u21912")), /*#__PURE__*/React.createElement("span", {
    className: "sb-item"
  }, "Blame: matze 2d ago"), /*#__PURE__*/React.createElement("span", {
    className: "sb-item"
  }, "Ln 24, Col 8"), /*#__PURE__*/React.createElement("span", {
    className: "sb-item"
  }, "LF"), /*#__PURE__*/React.createElement("span", {
    className: "sb-item"
  }, "UTF-8"), /*#__PURE__*/React.createElement("span", {
    className: "sb-item sb-brand"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 12,
    color: "var(--accent)"
  }), "capisco"));
}
Object.assign(window, {
  TitleBar,
  ActivityBar,
  RightRail,
  StatusBar,
  TOOLS
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/capisco-ide/chrome.jsx", error: String((e && e.message) || e) }); }

// ui_kits/capisco-ide/editor.jsx
try { (() => {
/* Capisco IDE kit — EditorArea: tab strip + highlighted code + autocomplete. */

// token span helpers (classes defined in index.html)
const K = ({
  children
}) => /*#__PURE__*/React.createElement("span", {
  className: "kw"
}, children);
const C = ({
  children
}) => /*#__PURE__*/React.createElement("span", {
  className: "ctl"
}, children);
const S = ({
  children
}) => /*#__PURE__*/React.createElement("span", {
  className: "str"
}, children);
const N = ({
  children
}) => /*#__PURE__*/React.createElement("span", {
  className: "num"
}, children);
const Cm = ({
  children
}) => /*#__PURE__*/React.createElement("span", {
  className: "com"
}, children);
const F = ({
  children
}) => /*#__PURE__*/React.createElement("span", {
  className: "fn"
}, children);
const T = ({
  children
}) => /*#__PURE__*/React.createElement("span", {
  className: "ty"
}, children);
const P = ({
  children
}) => /*#__PURE__*/React.createElement("span", {
  className: "prop"
}, children);
const O = ({
  children
}) => /*#__PURE__*/React.createElement("span", {
  className: "op"
}, children);
const B1 = ({
  children
}) => /*#__PURE__*/React.createElement("span", {
  className: "b1"
}, children);
const B2 = ({
  children
}) => /*#__PURE__*/React.createElement("span", {
  className: "b2"
}, children);
const B3 = ({
  children
}) => /*#__PURE__*/React.createElement("span", {
  className: "b3"
}, children);
const Ind = () => /*#__PURE__*/React.createElement("span", {
  className: "indent"
});
const Inlay = ({
  children
}) => /*#__PURE__*/React.createElement("span", {
  className: "inlay"
}, children);
function Line({
  num,
  git,
  active,
  blame,
  presence,
  pres,
  onPresence,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: 'code-line' + (active ? ' active' : '') + (presence ? ' has-presence' : '')
  }, pres && /*#__PURE__*/React.createElement("span", {
    className: 'pres-bar' + (pres === 'top' ? ' pres-top' : '') + (pres === 'bottom' ? ' pres-bottom' : '')
  }), presence && /*#__PURE__*/React.createElement("span", {
    className: "line-presence",
    title: presence.who + ' has live changes here',
    onClick: onPresence
  }, presence.init), /*#__PURE__*/React.createElement("span", {
    className: 'gutter' + (git ? ' g-' + git : '')
  }, num), /*#__PURE__*/React.createElement("span", {
    className: "code"
  }, children, blame && /*#__PURE__*/React.createElement("span", {
    className: "blame"
  }, blame)));
}
function LivePresence({
  onClose
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "menu-scrim",
    onClick: onClose
  }), /*#__PURE__*/React.createElement("div", {
    className: "live-pop"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lp-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "aw-av on"
  }, "ma"), /*#__PURE__*/React.createElement("div", {
    className: "lp-id"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lp-who"
  }, "mara"), /*#__PURE__*/React.createElement("div", {
    className: "lp-meta"
  }, "feat/capability-cache \xB7 #1283 \xB7 2m ago")), /*#__PURE__*/React.createElement("button", {
    className: "lp-x",
    onClick: onClose
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 14,
    color: "var(--text-secondary)"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "lp-diff"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dv-uline del"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dv-ln"
  }, "16"), /*#__PURE__*/React.createElement("span", {
    className: "dv-sign"
  }, "\u2212"), /*#__PURE__*/React.createElement("span", {
    className: "dv-code"
  }, '  if (this.grants.get(key) === "session") return true;')), /*#__PURE__*/React.createElement("div", {
    className: "dv-uline add"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dv-ln"
  }, "16"), /*#__PURE__*/React.createElement("span", {
    className: "dv-sign"
  }, "+"), /*#__PURE__*/React.createElement("span", {
    className: "dv-code"
  }, '  if (this.cache.has(key)) return this.cache.get(key);')), /*#__PURE__*/React.createElement("div", {
    className: "dv-uline add"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dv-ln"
  }, "17"), /*#__PURE__*/React.createElement("span", {
    className: "dv-sign"
  }, "+"), /*#__PURE__*/React.createElement("span", {
    className: "dv-code"
  }, '  const hit = this.grants.get(key) === "session";'))), /*#__PURE__*/React.createElement("div", {
    className: "lp-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "aw-btn aw-cp"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "git-branch-plus",
    size: 13
  }), "Cherry-pick this block"))));
}
function Autocomplete() {
  const items = [{
    sym: 'm',
    name: 'prompt',
    hint: '(p, c): Promise<boolean>',
    sel: true
  }, {
    sym: 'm',
    name: 'promptUser',
    hint: '(msg): Promise<boolean>'
  }, {
    sym: 'f',
    name: 'grants',
    hint: 'Map<string, Scope>'
  }, {
    sym: 'p',
    name: 'registry',
    hint: 'Registry'
  }, {
    sym: 'm',
    name: 'revoke',
    hint: '(key): void'
  }];
  return /*#__PURE__*/React.createElement("div", {
    className: "autocomplete"
  }, items.map(it => /*#__PURE__*/React.createElement("div", {
    key: it.name,
    className: 'ac-item' + (it.sel ? ' sel' : '')
  }, /*#__PURE__*/React.createElement("span", {
    className: 'ac-sym ac-' + it.sym
  }, it.sym), /*#__PURE__*/React.createElement("span", {
    className: "ac-name"
  }, it.name), /*#__PURE__*/React.createElement("span", {
    className: "ac-hint"
  }, it.hint))));
}
function TabStrip({
  tabs,
  active,
  onSelect
}) {
  const {
    EditorTab
  } = window.CapiscoDesignSystem_026f1e;
  const [rows, setRows] = React.useState(() => Number(localStorage.getItem('capisco-tabrows')) || 1);
  const [menu, setMenu] = React.useState(false);
  const setRowsP = n => {
    setRows(n);
    localStorage.setItem('capisco-tabrows', n);
  };
  const multi = rows > 1;
  return /*#__PURE__*/React.createElement("div", {
    className: "tab-strip"
  }, /*#__PURE__*/React.createElement("div", {
    className: 'tab-scroll' + (multi ? ' multi' : ' single'),
    style: multi ? {
      maxHeight: `calc(${rows} * var(--tabbar-h))`
    } : null
  }, tabs.map(t => /*#__PURE__*/React.createElement(EditorTab, {
    key: t.name,
    icon: /*#__PURE__*/React.createElement(FileIcon, {
      ext: t.ext
    }),
    label: t.name,
    pinned: t.pinned,
    dirty: t.dirty,
    active: active === t.name,
    onSelect: () => onSelect(t.name)
  }))), /*#__PURE__*/React.createElement("div", {
    className: "tab-overflow-wrap"
  }, /*#__PURE__*/React.createElement("button", {
    className: 'tab-overflow' + (menu ? ' active' : ''),
    title: "Show all tabs",
    onClick: () => setMenu(m => !m)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-down",
    size: 15
  })), menu && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "menu-scrim",
    onClick: () => setMenu(false)
  }), /*#__PURE__*/React.createElement("div", {
    className: "tab-menu"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tab-menu-rows"
  }, /*#__PURE__*/React.createElement("span", null, "Tab rows"), /*#__PURE__*/React.createElement("div", {
    className: "trow-seg"
  }, [1, 2, 3].map(n => /*#__PURE__*/React.createElement("button", {
    key: n,
    className: 'trow-opt' + (rows === n ? ' active' : ''),
    onClick: () => setRowsP(n)
  }, n)))), /*#__PURE__*/React.createElement("div", {
    className: "tab-menu-list"
  }, tabs.map(t => /*#__PURE__*/React.createElement("button", {
    key: t.name,
    className: 'tab-menu-item' + (active === t.name ? ' active' : ''),
    onClick: () => {
      onSelect(t.name);
      setMenu(false);
    }
  }, /*#__PURE__*/React.createElement(FileIcon, {
    ext: t.ext
  }), /*#__PURE__*/React.createElement("span", {
    className: "tmi-name"
  }, t.name), t.pinned && /*#__PURE__*/React.createElement(Icon, {
    name: "pin",
    size: 11,
    color: "var(--text-tertiary)"
  }), t.dirty && /*#__PURE__*/React.createElement("span", {
    className: "tmi-dirty"
  }))))))));
}
function EditorArea() {
  const [active, setActive] = React.useState('broker.ts');
  const [livePop, setLivePop] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    className: "editor-area"
  }, /*#__PURE__*/React.createElement(TabStrip, {
    tabs: window.TABS,
    active: active,
    onSelect: setActive
  }), /*#__PURE__*/React.createElement("div", {
    className: "code-pane"
  }, /*#__PURE__*/React.createElement(Line, {
    num: 1,
    git: "add"
  }, /*#__PURE__*/React.createElement(Cm, null, '// capability broker — grants scoped access to agent principals')), /*#__PURE__*/React.createElement(Line, {
    num: 2
  }), /*#__PURE__*/React.createElement(Line, {
    num: 3
  }, /*#__PURE__*/React.createElement(K, null, "import"), " ", /*#__PURE__*/React.createElement(B1, null, '{'), " ", /*#__PURE__*/React.createElement(T, null, "Capability"), /*#__PURE__*/React.createElement(O, null, ","), " ", /*#__PURE__*/React.createElement(T, null, "Principal"), /*#__PURE__*/React.createElement(O, null, ","), " ", /*#__PURE__*/React.createElement(T, null, "Scope"), " ", /*#__PURE__*/React.createElement(B1, null, '}'), " ", /*#__PURE__*/React.createElement(K, null, "from"), " ", /*#__PURE__*/React.createElement(S, null, "\"./types\""), /*#__PURE__*/React.createElement(O, null, ";")), /*#__PURE__*/React.createElement(Line, {
    num: 4
  }), /*#__PURE__*/React.createElement(Line, {
    num: 5,
    git: "add"
  }, /*#__PURE__*/React.createElement(K, null, "export"), " ", /*#__PURE__*/React.createElement(K, null, "class"), " ", /*#__PURE__*/React.createElement(T, null, "Broker"), " ", /*#__PURE__*/React.createElement(B1, null, '{')), /*#__PURE__*/React.createElement(Line, {
    num: 6
  }, /*#__PURE__*/React.createElement(Ind, null), /*#__PURE__*/React.createElement(K, null, "private"), " ", /*#__PURE__*/React.createElement(P, null, "grants"), " ", /*#__PURE__*/React.createElement(O, null, "="), " ", /*#__PURE__*/React.createElement(K, null, "new"), " ", /*#__PURE__*/React.createElement(F, null, "Map"), /*#__PURE__*/React.createElement(B2, null, '<'), /*#__PURE__*/React.createElement(T, null, "string"), /*#__PURE__*/React.createElement(O, null, ","), " ", /*#__PURE__*/React.createElement(T, null, "Scope"), /*#__PURE__*/React.createElement(B2, null, '>'), /*#__PURE__*/React.createElement(B3, null, "()"), /*#__PURE__*/React.createElement(O, null, ";")), /*#__PURE__*/React.createElement(Line, {
    num: 7
  }), /*#__PURE__*/React.createElement(Line, {
    num: 8
  }, /*#__PURE__*/React.createElement(Ind, null), /*#__PURE__*/React.createElement(F, null, "constructor"), /*#__PURE__*/React.createElement(B2, null, "("), /*#__PURE__*/React.createElement(K, null, "private"), " ", /*#__PURE__*/React.createElement(P, null, "registry"), /*#__PURE__*/React.createElement(O, null, ":"), " ", /*#__PURE__*/React.createElement(T, null, "Registry"), /*#__PURE__*/React.createElement(B2, null, ")"), " ", /*#__PURE__*/React.createElement(B3, null, '{}')), /*#__PURE__*/React.createElement(Line, {
    num: 9
  }), /*#__PURE__*/React.createElement(Line, {
    num: 10,
    git: "add"
  }, /*#__PURE__*/React.createElement(Ind, null), /*#__PURE__*/React.createElement(K, null, "async"), " ", /*#__PURE__*/React.createElement(F, null, "checkCapability"), /*#__PURE__*/React.createElement(B2, null, "(")), /*#__PURE__*/React.createElement(Line, {
    num: 11,
    git: "add"
  }, /*#__PURE__*/React.createElement(Ind, null), /*#__PURE__*/React.createElement(Ind, null), /*#__PURE__*/React.createElement(V, null, "principal"), /*#__PURE__*/React.createElement(O, null, ":"), " ", /*#__PURE__*/React.createElement(T, null, "Principal"), /*#__PURE__*/React.createElement(O, null, ",")), /*#__PURE__*/React.createElement(Line, {
    num: 12,
    git: "add"
  }, /*#__PURE__*/React.createElement(Ind, null), /*#__PURE__*/React.createElement(Ind, null), /*#__PURE__*/React.createElement(V, null, "capability"), /*#__PURE__*/React.createElement(O, null, ":"), " ", /*#__PURE__*/React.createElement(T, null, "Capability"), /*#__PURE__*/React.createElement(O, null, ",")), /*#__PURE__*/React.createElement(Line, {
    num: 13,
    git: "add"
  }, /*#__PURE__*/React.createElement(Ind, null), /*#__PURE__*/React.createElement(Ind, null), /*#__PURE__*/React.createElement(V, null, "scope"), /*#__PURE__*/React.createElement(O, null, ":"), " ", /*#__PURE__*/React.createElement(T, null, "Scope"), " ", /*#__PURE__*/React.createElement(O, null, "="), " ", /*#__PURE__*/React.createElement(S, null, "\"once\""), /*#__PURE__*/React.createElement(O, null, ",")), /*#__PURE__*/React.createElement(Line, {
    num: 14
  }, /*#__PURE__*/React.createElement(Ind, null), /*#__PURE__*/React.createElement(B2, null, ")"), /*#__PURE__*/React.createElement(O, null, ":"), " ", /*#__PURE__*/React.createElement(T, null, "Promise"), /*#__PURE__*/React.createElement(B3, null, '<'), /*#__PURE__*/React.createElement(T, null, "boolean"), /*#__PURE__*/React.createElement(B3, null, '>'), " ", /*#__PURE__*/React.createElement(B2, null, '{')), /*#__PURE__*/React.createElement(Line, {
    num: 15
  }, /*#__PURE__*/React.createElement(Ind, null), /*#__PURE__*/React.createElement(Ind, null), /*#__PURE__*/React.createElement(K, null, "const"), " ", /*#__PURE__*/React.createElement(V, null, "key"), " ", /*#__PURE__*/React.createElement(O, null, "="), " ", /*#__PURE__*/React.createElement(S, null, '`${principal.id}:${capability.name}`'), /*#__PURE__*/React.createElement(O, null, ";")), /*#__PURE__*/React.createElement(Line, {
    num: 16,
    pres: "top",
    presence: {
      init: 'ma',
      who: 'mara'
    },
    onPresence: () => setLivePop(v => !v)
  }, /*#__PURE__*/React.createElement(Ind, null), /*#__PURE__*/React.createElement(Ind, null), /*#__PURE__*/React.createElement(C, null, "if"), " ", /*#__PURE__*/React.createElement(B3, null, "("), /*#__PURE__*/React.createElement(K, null, "this"), /*#__PURE__*/React.createElement(O, null, "."), /*#__PURE__*/React.createElement(P, null, "grants"), /*#__PURE__*/React.createElement(O, null, "."), /*#__PURE__*/React.createElement(F, null, "get"), /*#__PURE__*/React.createElement(B1, null, "("), /*#__PURE__*/React.createElement(Inlay, null, "key:"), /*#__PURE__*/React.createElement(V, null, "key"), /*#__PURE__*/React.createElement(B1, null, ")"), " ", /*#__PURE__*/React.createElement(O, null, "==="), " ", /*#__PURE__*/React.createElement(S, null, "\"session\""), /*#__PURE__*/React.createElement(B3, null, ")"), " ", /*#__PURE__*/React.createElement(C, null, "return"), " ", /*#__PURE__*/React.createElement(N, null, "true"), /*#__PURE__*/React.createElement(O, null, ";")), /*#__PURE__*/React.createElement(Line, {
    num: 17,
    pres: "bottom"
  }), /*#__PURE__*/React.createElement(Line, {
    num: 18,
    active: true,
    git: "mod",
    blame: "matze, 28 Nov 2025 \xB7 feat: add worktree teardown"
  }, /*#__PURE__*/React.createElement(Ind, null), /*#__PURE__*/React.createElement(Ind, null), /*#__PURE__*/React.createElement(K, null, "const"), " ", /*#__PURE__*/React.createElement(V, null, "granted"), " ", /*#__PURE__*/React.createElement(O, null, "="), " ", /*#__PURE__*/React.createElement(K, null, "await"), " ", /*#__PURE__*/React.createElement(K, null, "this"), /*#__PURE__*/React.createElement(O, null, "."), /*#__PURE__*/React.createElement(F, null, "prompt"), /*#__PURE__*/React.createElement("span", {
    className: "caret-host"
  }, /*#__PURE__*/React.createElement(B3, null, "("), /*#__PURE__*/React.createElement(Inlay, null, "principal:"), /*#__PURE__*/React.createElement(V, null, "principal"), /*#__PURE__*/React.createElement(O, null, ","), " ", /*#__PURE__*/React.createElement(Inlay, null, "capability:"), /*#__PURE__*/React.createElement(V, null, "capability"), /*#__PURE__*/React.createElement(B3, null, ")")), /*#__PURE__*/React.createElement(O, null, ";")), /*#__PURE__*/React.createElement(Line, {
    num: 19
  }, /*#__PURE__*/React.createElement(Ind, null), /*#__PURE__*/React.createElement(Ind, null), /*#__PURE__*/React.createElement(C, null, "if"), " ", /*#__PURE__*/React.createElement(B3, null, "("), /*#__PURE__*/React.createElement(V, null, "granted"), /*#__PURE__*/React.createElement(B3, null, ")"), " ", /*#__PURE__*/React.createElement(K, null, "this"), /*#__PURE__*/React.createElement(O, null, "."), /*#__PURE__*/React.createElement(P, null, "grants"), /*#__PURE__*/React.createElement(O, null, "."), /*#__PURE__*/React.createElement(F, null, "set"), /*#__PURE__*/React.createElement(B1, null, "("), /*#__PURE__*/React.createElement(Inlay, null, "key:"), /*#__PURE__*/React.createElement(V, null, "key"), /*#__PURE__*/React.createElement(O, null, ","), " ", /*#__PURE__*/React.createElement(Inlay, null, "value:"), /*#__PURE__*/React.createElement(V, null, "scope"), /*#__PURE__*/React.createElement(B1, null, ")"), /*#__PURE__*/React.createElement(O, null, ";")), /*#__PURE__*/React.createElement(Line, {
    num: 20
  }, /*#__PURE__*/React.createElement(Ind, null), /*#__PURE__*/React.createElement(Ind, null), /*#__PURE__*/React.createElement(C, null, "return"), " ", /*#__PURE__*/React.createElement(V, null, "granted"), /*#__PURE__*/React.createElement(O, null, ";")), /*#__PURE__*/React.createElement(Line, {
    num: 21
  }, /*#__PURE__*/React.createElement(Ind, null), /*#__PURE__*/React.createElement(B2, null, '}')), /*#__PURE__*/React.createElement(Line, {
    num: 22
  }, /*#__PURE__*/React.createElement(B1, null, '}')), /*#__PURE__*/React.createElement(Autocomplete, null), livePop && /*#__PURE__*/React.createElement(LivePresence, {
    onClose: () => setLivePop(false)
  })));
}
const V = ({
  children
}) => /*#__PURE__*/React.createElement("span", {
  className: "var"
}, children);
Object.assign(window, {
  EditorArea
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/capisco-ide/editor.jsx", error: String((e && e.message) || e) }); }

// ui_kits/capisco-ide/panels.jsx
try { (() => {
/* Capisco IDE kit — left panel (multi-project Explorer + Work Stash) and Terminal. */

function ProjectRoot({
  p,
  onToggle
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: 'proj-root' + (p.selected ? ' selected' : ''),
    onClick: onToggle
  }, /*#__PURE__*/React.createElement("span", {
    className: "tw-chevron"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      transform: p.expanded ? 'rotate(90deg)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "m9 18 6-6-6-6"
  }))), /*#__PURE__*/React.createElement(Icon, {
    name: "folder",
    size: 15,
    color: "var(--text-secondary)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "proj-name"
  }, p.name), /*#__PURE__*/React.createElement("span", {
    className: "proj-path"
  }, "\u2014 ", p.path), /*#__PURE__*/React.createElement("span", {
    className: "proj-branch"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "git-branch",
    size: 11,
    color: "var(--text-tertiary)"
  }), p.branch, p.tracking ? /*#__PURE__*/React.createElement("span", {
    className: "proj-track"
  }, p.tracking) : null));
}
function FileExplorer() {
  const {
    TreeRow,
    GitMarker,
    IconButton
  } = window.CapiscoDesignSystem_026f1e;
  const [open, setOpen] = React.useState(() => Object.fromEntries(window.PROJECTS.map(p => [p.id, p.expanded])));
  const [scratchOpen, setScratchOpen] = React.useState(true);
  const toggle = id => setOpen(o => ({
    ...o,
    [id]: !o[id]
  }));
  return /*#__PURE__*/React.createElement("div", {
    className: "explorer"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "caps"
  }, "Project", /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-down",
    size: 12,
    color: "var(--text-tertiary)",
    style: {
      marginLeft: 4
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "ph-actions"
  }, /*#__PURE__*/React.createElement(IconButton, {
    size: 22,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "plus",
      size: 14
    }),
    title: "Add project to workspace"
  }), /*#__PURE__*/React.createElement(IconButton, {
    size: 22,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "list-collapse",
      size: 14
    }),
    title: "Collapse all"
  }), /*#__PURE__*/React.createElement(IconButton, {
    size: 22,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "refresh-cw",
      size: 13
    }),
    title: "Refresh"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "tree"
  }, window.PROJECTS.map(p => /*#__PURE__*/React.createElement(React.Fragment, {
    key: p.id
  }, /*#__PURE__*/React.createElement(ProjectRoot, {
    p: {
      ...p,
      expanded: open[p.id]
    },
    onToggle: () => toggle(p.id)
  }), open[p.id] && p.files.map((n, i) => /*#__PURE__*/React.createElement(TreeRow, {
    key: i,
    depth: n.depth,
    expandable: n.expandable,
    expanded: n.expanded,
    active: n.active,
    muted: n.muted,
    icon: /*#__PURE__*/React.createElement(FileIcon, {
      ext: n.ext,
      open: n.expanded
    }),
    label: n.name,
    trailing: n.git ? /*#__PURE__*/React.createElement(GitMarker, {
      status: n.git
    }) : null
  })))), /*#__PURE__*/React.createElement(TreeRow, {
    depth: 0,
    expandable: true,
    expanded: false,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "library",
      size: 15,
      color: "var(--text-secondary)"
    }),
    label: "External Libraries",
    muted: true
  }), /*#__PURE__*/React.createElement(TreeRow, {
    depth: 0,
    expandable: true,
    expanded: scratchOpen,
    onClick: () => setScratchOpen(v => !v),
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "history",
      size: 15,
      color: "var(--accent)"
    }),
    label: "Scratches and Consoles"
  }), scratchOpen && window.SCRATCH.map((s, i) => /*#__PURE__*/React.createElement(TreeRow, {
    key: i,
    depth: 1,
    icon: /*#__PURE__*/React.createElement(FileIcon, {
      ext: s.ext
    }),
    label: s.name
  }))));
}

/* Work Stash — Local Changes (grouped by project) + Shelf, switchable via tabs. */
function WorkStash({
  onOpenDiff
}) {
  const {
    TreeRow,
    GitMarker,
    IconButton,
    Button,
    Input
  } = window.CapiscoDesignSystem_026f1e;
  const [tab, setTab] = React.useState('changes');
  return /*#__PURE__*/React.createElement("div", {
    className: "workstash"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ws-tabs"
  }, /*#__PURE__*/React.createElement("button", {
    className: 'ws-tab' + (tab === 'changes' ? ' active' : ''),
    onClick: () => setTab('changes')
  }, "Local Changes"), /*#__PURE__*/React.createElement("button", {
    className: 'ws-tab' + (tab === 'shelf' ? ' active' : ''),
    onClick: () => setTab('shelf')
  }, "Shelf"), /*#__PURE__*/React.createElement("div", {
    className: "tb-spacer"
  }), /*#__PURE__*/React.createElement(IconButton, {
    size: 22,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "refresh-cw",
      size: 13
    }),
    title: "Refresh"
  }), /*#__PURE__*/React.createElement(IconButton, {
    size: 22,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "ellipsis",
      size: 14
    }),
    title: "More"
  })), tab === 'changes' ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "ws-scroll"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ws-subhead"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-down",
    size: 12,
    color: "var(--text-secondary)"
  }), "Changes", /*#__PURE__*/React.createElement("span", {
    className: "ws-count"
  }, window.CHANGE_GROUPS.reduce((n, g) => n + g.files.length, 0))), window.CHANGE_GROUPS.map((g, gi) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: gi
  }, /*#__PURE__*/React.createElement("div", {
    className: "ws-group-head"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-down",
    size: 11,
    color: "var(--text-tertiary)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "ws-group-name"
  }, g.project), /*#__PURE__*/React.createElement("span", {
    className: "ws-group-branch"
  }, g.branch)), g.files.map((c, i) => /*#__PURE__*/React.createElement(TreeRow, {
    key: i,
    depth: 1,
    icon: /*#__PURE__*/React.createElement(FileIcon, {
      ext: c.ext
    }),
    label: c.name,
    onClick: () => onOpenDiff && onOpenDiff(c.name),
    trailing: /*#__PURE__*/React.createElement("span", {
      className: "ws-row-meta"
    }, /*#__PURE__*/React.createElement("span", {
      className: "ws-path"
    }, c.path), /*#__PURE__*/React.createElement(GitMarker, {
      status: c.git
    }))
  }))))), /*#__PURE__*/React.createElement("div", {
    className: "ws-commit"
  }, /*#__PURE__*/React.createElement("textarea", {
    className: "ws-commit-msg",
    placeholder: "Commit message\u2026",
    defaultValue: ""
  }), /*#__PURE__*/React.createElement("div", {
    className: "ws-commit-actions"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "md",
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 14
  }), "Commit"), /*#__PURE__*/React.createElement(Button, {
    variant: "default",
    size: "md"
  }, "Commit and Push\u2026")))) : /*#__PURE__*/React.createElement("div", {
    className: "ws-scroll"
  }, window.SHELF.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "shelf-row"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "inbox",
    size: 14,
    color: "var(--text-secondary)"
  }), /*#__PURE__*/React.createElement("div", {
    className: "shelf-text"
  }, /*#__PURE__*/React.createElement("div", {
    className: "shelf-name"
  }, s.name), /*#__PURE__*/React.createElement("div", {
    className: "shelf-meta"
  }, s.meta))))));
}
const TERM_TABS = ['Local', 'Py2Ts', 'Evidence'];

/* Minimal placeholder for left-rail views not built out in this mock. */
function PanelPlaceholder({
  title
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "panel-placeholder"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "package-open",
    size: 24,
    color: "var(--text-tertiary)"
  }), /*#__PURE__*/React.createElement("div", {
    className: "pp-title"
  }, title), /*#__PURE__*/React.createElement("div", {
    className: "pp-sub"
  }, "Not wired in this mock"));
}
function Terminal() {
  const {
    IconButton
  } = window.CapiscoDesignSystem_026f1e;
  const [tabs, setTabs] = React.useState(TERM_TABS);
  const [active, setActive] = React.useState('Evidence');
  const close = t => {
    setTabs(ts => ts.filter(x => x !== t));
    setActive(a => a === t ? tabs.find(x => x !== t) || '' : a);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "terminal"
  }, /*#__PURE__*/React.createElement("div", {
    className: "term-tabbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "term-tools"
  }, /*#__PURE__*/React.createElement("span", {
    className: "term-label"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "square-terminal",
    size: 14,
    color: "var(--text-secondary)"
  })), /*#__PURE__*/React.createElement(IconButton, {
    size: 22,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "trash-2",
      size: 13
    }),
    title: "Kill"
  })), /*#__PURE__*/React.createElement("div", {
    className: "term-tabs"
  }, tabs.map(t => /*#__PURE__*/React.createElement("button", {
    key: t,
    className: 'term-tab' + (t === active ? ' active' : ''),
    onClick: () => setActive(t)
  }, t, /*#__PURE__*/React.createElement("span", {
    className: "term-x",
    title: "Close",
    onClick: e => {
      e.stopPropagation();
      close(t);
    }
  }, "\xD7"))), /*#__PURE__*/React.createElement("button", {
    className: "term-tab term-add",
    title: "New terminal"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 13
  })))), /*#__PURE__*/React.createElement("div", {
    className: "term-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "t-line"
  }, /*#__PURE__*/React.createElement("span", {
    className: "t-prompt"
  }, "~/dev/capisco \u276F"), " pnpm test core/broker"), /*#__PURE__*/React.createElement("div", {
    className: "t-line t-dim"
  }, "$ vitest run src/core/broker.test.ts"), /*#__PURE__*/React.createElement("div", {
    className: "t-line"
  }, /*#__PURE__*/React.createElement("span", {
    className: "t-ok"
  }, "\u2713"), " broker \xB7 grants scoped capability once ", /*#__PURE__*/React.createElement("span", {
    className: "t-dim"
  }, "(4 ms)")), /*#__PURE__*/React.createElement("div", {
    className: "t-line"
  }, /*#__PURE__*/React.createElement("span", {
    className: "t-ok"
  }, "\u2713"), " broker \xB7 denies revoked principal ", /*#__PURE__*/React.createElement("span", {
    className: "t-dim"
  }, "(2 ms)")), /*#__PURE__*/React.createElement("div", {
    className: "t-line"
  }, /*#__PURE__*/React.createElement("span", {
    className: "t-ok"
  }, "\u2713"), " broker \xB7 escalates to prompt on unknown scope ", /*#__PURE__*/React.createElement("span", {
    className: "t-dim"
  }, "(6 ms)")), /*#__PURE__*/React.createElement("div", {
    className: "t-line t-dim"
  }, "Test Files  1 passed (1)"), /*#__PURE__*/React.createElement("div", {
    className: "t-line"
  }, /*#__PURE__*/React.createElement("span", {
    className: "t-ok"
  }, "\u2713"), " 3 passed ", /*#__PURE__*/React.createElement("span", {
    className: "t-dim"
  }, "\xB7 312ms")), /*#__PURE__*/React.createElement("div", {
    className: "t-line"
  }, /*#__PURE__*/React.createElement("span", {
    className: "t-prompt"
  }, "~/dev/capisco \u276F"), " ", /*#__PURE__*/React.createElement("span", {
    className: "t-caret"
  }))));
}
Object.assign(window, {
  FileExplorer,
  WorkStash,
  Terminal,
  PanelPlaceholder
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/capisco-ide/panels.jsx", error: String((e && e.message) || e) }); }

// ui_kits/capisco-ide/shared.jsx
try { (() => {
/* Capisco IDE kit — shared helpers, icons, sample content. */

// Safe Lucide icon: React owns the <span>, lucide mutates inner HTML only.
function Icon({
  name,
  size = 16,
  color,
  style = {}
}) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || !window.lucide) return;
    el.innerHTML = '<i data-lucide="' + name + '"></i>';
    window.lucide.createIcons();
  }, [name]);
  return /*#__PURE__*/React.createElement("span", {
    ref: ref,
    className: "lc",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: size,
      height: size,
      color,
      flexShrink: 0,
      ...style
    }
  });
}
function FileIcon({
  ext,
  open
}) {
  if (ext === 'dir') return /*#__PURE__*/React.createElement(Icon, {
    name: open ? 'folder-open' : 'folder',
    size: 15,
    color: "var(--text-secondary)"
  });
  const map = {
    ts: {
      name: 'file-code',
      color: 'var(--syn-type)'
    },
    rs: {
      name: 'file-code',
      color: 'var(--syn-number)'
    },
    json: {
      name: 'braces',
      color: 'var(--syn-keyword)'
    },
    md: {
      name: 'file-text',
      color: 'var(--text-secondary)'
    }
  };
  const m = map[ext] || {
    name: 'file',
    color: 'var(--text-secondary)'
  };
  return /*#__PURE__*/React.createElement(Icon, {
    name: m.name,
    size: 15,
    color: m.color
  });
}

// ---- Multi-project workspace: several repos loaded side-by-side so the
//      agent has them all as context, plus a global scratch tree. ----
const PROJECTS = [{
  id: 'core',
  name: 'capisco-core',
  path: '~/dev/capisco/core',
  branch: 'feat/worktree-teardown',
  tracking: '↓3',
  expanded: true,
  selected: true,
  files: [{
    depth: 1,
    ext: 'dir',
    name: 'src',
    expandable: true,
    expanded: true
  }, {
    depth: 2,
    ext: 'dir',
    name: 'core',
    expandable: true,
    expanded: true
  }, {
    depth: 3,
    ext: 'ts',
    name: 'worktree.ts',
    git: 'M'
  }, {
    depth: 3,
    ext: 'ts',
    name: 'session-tree.ts',
    git: 'M'
  }, {
    depth: 3,
    ext: 'ts',
    name: 'broker.ts',
    git: 'A',
    active: true
  }, {
    depth: 2,
    ext: 'dir',
    name: 'providers',
    expandable: true
  }, {
    depth: 1,
    ext: 'json',
    name: 'package.json'
  }]
}, {
  id: 'tauri',
  name: 'capisco-tauri',
  path: '~/dev/capisco/tauri',
  branch: 'main',
  tracking: '↑2',
  expanded: false,
  files: [{
    depth: 1,
    ext: 'dir',
    name: 'src',
    expandable: true
  }, {
    depth: 1,
    ext: 'rs',
    name: 'main.rs',
    git: 'M'
  }]
}];

// Global scratch tree (shared across all loaded projects)
const SCRATCH = [{
  ext: 'ts',
  name: 'scratch_1.ts'
}, {
  ext: 'md',
  name: 'broker-notes.md'
}, {
  ext: 'json',
  name: 'response_42.json'
}];

// ---- Editor tabs ----
const TABS = [{
  ext: 'ts',
  name: 'worktree.ts',
  pinned: true
}, {
  ext: 'ts',
  name: 'broker.ts'
}, {
  ext: 'ts',
  name: 'session-tree.ts'
}, {
  ext: 'md',
  name: 'README.md',
  dirty: true
}, {
  ext: 'ts',
  name: 'language-pack.ts'
}, {
  ext: 'ts',
  name: 'task-provider.ts'
}, {
  ext: 'rs',
  name: 'main.rs'
}, {
  ext: 'json',
  name: 'package.json'
}, {
  ext: 'ts',
  name: 'ListProjectsControllerTest.ts'
}];

// ---- Work Stash · Local Changes (grouped by project) + Shelf ----
const CHANGE_GROUPS = [{
  project: 'capisco-core',
  branch: 'feat/worktree-teardown',
  files: [{
    ext: 'ts',
    name: 'worktree.ts',
    path: 'core',
    git: 'M'
  }, {
    ext: 'ts',
    name: 'broker.ts',
    path: 'core',
    git: 'A'
  }, {
    ext: 'ts',
    name: 'broker.test.ts',
    path: 'core',
    git: 'A'
  }]
}, {
  project: 'capisco-tauri',
  branch: 'main',
  files: [{
    ext: 'rs',
    name: 'main.rs',
    path: 'src',
    git: 'M'
  }]
}];
const SHELF = [{
  name: 'client-api-integration',
  meta: '2 files · 2h ago'
}, {
  name: 'port-allocator spike',
  meta: '1 file · yesterday'
}, {
  name: 'local-model provider',
  meta: '4 files · 3d ago'
}];

// ---- Agent sessions (top-level, with subagents) ----
const SESSIONS = [{
  id: 's1',
  model: 'Claude',
  status: 'running',
  title: 'Implement worktree teardown',
  meta: '2m 49s · 6.5k ↓',
  subs: [{
    id: 's1a',
    model: 'Claude',
    status: 'running',
    title: 'Subagent · write tests',
    meta: '0m 31s · 1.2k ↓'
  }]
}, {
  id: 's2',
  model: 'GPT-5',
  status: 'idle',
  title: 'Refactor broker grant model',
  meta: 'idle · 18k ↓'
}, {
  id: 's3',
  model: 'Local',
  status: 'waiting',
  title: 'Search: "where is port allocated?"',
  meta: 'waiting'
}];

// ---- Chat sessions (lightweight, no subagents / tools) ----
const CHAT_SESSIONS = [{
  id: 'c1',
  model: 'Sonnet',
  status: 'idle',
  title: 'How does the broker decide?',
  meta: '1.1k ↓'
}, {
  id: 'c2',
  model: 'Sonnet',
  status: 'idle',
  title: 'Explain the session-tree',
  meta: '0.8k ↓'
}];

// ---- Flyout content ----
const ALERTS = [{
  sev: 'waiting',
  title: 'Local session needs approval',
  sub: 'Bash(rm -rf .worktrees/tmp)'
}, {
  sev: 'success',
  title: '3 tests passed',
  sub: 'core/broker.test.ts · 312ms'
}, {
  sev: 'warning',
  title: 'Unused import in broker.ts',
  sub: 'Scope is never used · Ln 3'
}, {
  sev: 'idle',
  title: 'GPT-5 session idle 4m',
  sub: 'Refactor broker grant model'
}];
const INSPECTIONS = [{
  sev: 'warning',
  title: 'broker.ts — 1 weak warning',
  sub: 'Prefer const over let · Ln 18'
}, {
  sev: 'success',
  title: 'worktree.ts — clean',
  sub: 'No problems found'
}, {
  sev: 'idle',
  title: 'Typecheck',
  sub: 'tsc --noEmit · passing'
}];

// ---- PR / Forge board ("whose turn is it?") ----
const PRS = {
  yourTurn: [{
    title: 'Add capability scope cache',
    repo: 'capisco-core',
    author: 'mara',
    age: '3h',
    status: 'review',
    stale: false
  }, {
    title: 'Port allocator: avoid TOCTOU',
    repo: 'capisco-tauri',
    author: 'jdev',
    age: '9d',
    status: 'review',
    stale: true
  }],
  awaiting: [{
    title: 'Worktree teardown + port release',
    repo: 'capisco-core',
    author: 'you',
    age: '1h',
    status: 'open',
    reviewers: 'mara, kai'
  }, {
    title: 'Session-tree token aggregation',
    repo: 'capisco-core',
    author: 'you',
    age: '2d',
    status: 'changes',
    reviewers: 'mara'
  }]
};

// ---- Git dashboard (local-first personal metrics) ----
const GIT_STATS = {
  commits: 47,
  prsOpened: 6,
  prsMerged: 4,
  added: 3128,
  removed: 1407,
  langs: [{
    name: 'TypeScript',
    pct: 62,
    color: 'var(--syn-type)'
  }, {
    name: 'Rust',
    pct: 21,
    color: 'var(--syn-number)'
  }, {
    name: 'CSS',
    pct: 11,
    color: 'var(--syn-keyword)'
  }, {
    name: 'Markdown',
    pct: 6,
    color: 'var(--text-secondary)'
  }],
  activity: [3, 7, 5, 9, 12, 6, 8],
  days: ['M', 'T', 'W', 'T', 'F', 'S', 'S']
};

// ---- Global search (ripgrep-style) ----
const SEARCH = {
  query: 'checkCapability',
  files: [{
    path: 'src/core/broker.ts',
    hits: [{
      ln: 18,
      before: 'const granted = await this.',
      match: 'checkCapability',
      after: '(principal, cap);'
    }, {
      ln: 42,
      before: '  if (await this.',
      match: 'checkCapability',
      after: '(p, c)) {'
    }]
  }, {
    path: 'src/core/session-tree.ts',
    hits: [{
      ln: 91,
      before: 'broker.',
      match: 'checkCapability',
      after: '(agent, cap)'
    }]
  }]
};

// ---- Structure (symbols of the active file) ----
const STRUCTURE = [{
  kind: 'C',
  name: 'Broker',
  depth: 0
}, {
  kind: 'p',
  name: 'grants: Map<string, Scope>',
  depth: 1
}, {
  kind: 'm',
  name: 'constructor(registry)',
  depth: 1
}, {
  kind: 'm',
  name: 'checkCapability(principal, cap, scope)',
  depth: 1
}, {
  kind: 'm',
  name: 'prompt(principal, cap)',
  depth: 1
}, {
  kind: 'm',
  name: 'release(port)',
  depth: 1
}, {
  kind: 'I',
  name: 'Capability',
  depth: 0
}, {
  kind: 'E',
  name: 'Scope',
  depth: 0
}];

// ---- Datasource explorer (prod read-only invariant) ----
const DATASOURCES = [{
  name: 'local',
  engine: 'postgres',
  env: 'local',
  tables: ['users', 'sessions', 'grants', 'worktrees']
}, {
  name: 'staging',
  engine: 'postgres',
  env: 'staging',
  tables: ['users', 'sessions', 'grants']
}, {
  name: 'prod',
  engine: 'postgres',
  env: 'production',
  readonly: true,
  tables: ['users', 'sessions', 'grants', 'audit_log']
}, {
  name: 'cache',
  engine: 'redis',
  env: 'local',
  tables: ['keys']
}];

// ---- Git dashboard: weekly series + DORA + working-times heatmap ----
const GIT_WEEKS = ['23 Mar', '30 Mar', '06 Apr', '13 Apr', '20 Apr', '27 Apr', '04 May', '11 May', '18 May', '25 May', '01 Jun', '08 Jun', '15 Jun'];
const GIT_SERIES = {
  commits: [102, 64, 196, 455, 470, 432, 590, 695, 448, 675, 712, 540, 210],
  prsMerged: [45, 26, 9, 27, 20, 8, 62, 89, 51, 120, 157, 158, 47],
  loc: [370, 118, 12, 205, 135, 128, 165, 200, 970, 1040, 225, 375, 90],
  reviews: [8, 2, 0, 0, 2, 1, 6, 3, 9, 1, 11, 3, 0],
  cycleTime: [186, 57, 54, 68, 55, 156, 162, 42, 79, 40, 8, 13, 31]
};
const GIT_DORA = [{
  label: 'Lead Time for Changes',
  value: '61.4 h',
  tier: 'High',
  delta: '↓74.1%',
  good: true,
  sub: 'Avg. time from first commit to merge'
}, {
  label: 'Deployment Frequency',
  value: '74.5 / wk',
  tier: 'Elite',
  delta: '↑410.3%',
  good: true,
  sub: 'PRs merged per week (proxy)'
}, {
  label: 'Change Failure Rate',
  value: '3 %',
  tier: 'Elite',
  delta: '↓41.2%',
  good: true,
  sub: 'Merged with failed CI checks'
}];
const PR_CATEGORIES = [{
  label: 'Planned',
  value: 64,
  color: 'var(--accent)'
}, {
  label: 'Unplanned',
  value: 36,
  color: 'var(--git-modified)'
}];

// ---- Detailed PRs for the loaded projects (GitHub-like) ----
const GIT_PRS = [{
  num: 1284,
  title: 'Worktree teardown frees its allocated port',
  repo: 'capisco-core',
  branch: 'feat/worktree-teardown',
  author: 'you',
  draft: false,
  days: 1,
  checks: 'passing',
  comments: 4,
  add: 128,
  del: 47,
  labels: ['feature', 'core'],
  reviews: [{
    who: 'mara',
    state: 'approved'
  }, {
    who: 'kai',
    state: 'pending'
  }]
}, {
  num: 1280,
  title: 'Session resume from store',
  repo: 'capisco-core',
  branch: 'feat/session-resume',
  author: 'you',
  draft: false,
  days: 5,
  checks: 'failing',
  comments: 9,
  add: 540,
  del: 120,
  labels: ['feature'],
  reviews: [{
    who: 'mara',
    state: 'changes'
  }]
}, {
  num: 1276,
  title: 'Port allocator avoids TOCTOU',
  repo: 'capisco-tauri',
  branch: 'fix/port-allocator',
  author: 'you',
  draft: true,
  days: 2,
  checks: 'pending',
  comments: 1,
  add: 64,
  del: 18,
  labels: ['bug'],
  reviews: []
}, {
  num: 1271,
  title: 'CI: cache pnpm store between runs',
  repo: 'capisco-core',
  branch: 'chore/ci-cache',
  author: 'you',
  draft: false,
  days: 8,
  checks: 'passing',
  comments: 0,
  add: 60,
  del: 12,
  labels: ['chore'],
  reviews: []
}, {
  num: 1283,
  title: 'Capability scope cache',
  repo: 'capisco-core',
  branch: 'feat/capability-cache',
  author: 'mara',
  draft: false,
  days: 0,
  checks: 'passing',
  comments: 2,
  add: 210,
  del: 30,
  labels: ['feature'],
  reviews: [{
    who: 'you',
    state: 'pending'
  }],
  requested: true
}, {
  num: 1279,
  title: 'Broker grant model perf pass',
  repo: 'capisco-tauri',
  branch: 'perf/broker-grant',
  author: 'jdev',
  draft: false,
  days: 9,
  checks: 'passing',
  comments: 6,
  add: 96,
  del: 140,
  labels: ['perf'],
  reviews: [{
    who: 'you',
    state: 'pending'
  }, {
    who: 'mara',
    state: 'approved'
  }],
  reviewedByMe: true
}, {
  num: 1268,
  title: 'Docs: capability broker overview',
  repo: 'capisco-core',
  branch: 'docs/broker',
  author: 'sam',
  draft: false,
  days: 2,
  checks: 'passing',
  comments: 1,
  add: 80,
  del: 4,
  labels: ['docs'],
  reviews: [{
    who: 'you',
    state: 'pending'
  }],
  requested: true
}, {
  num: 1255,
  title: 'Refactor session store internals',
  repo: 'capisco-core',
  branch: 'refactor/session-store',
  author: 'lea',
  draft: false,
  days: 12,
  checks: 'passing',
  comments: 14,
  add: 820,
  del: 610,
  labels: ['refactor'],
  reviews: [{
    who: 'mara',
    state: 'approved'
  }]
}];
const LABEL_COLORS = {
  feature: 'var(--accent)',
  core: 'var(--syn-control)',
  bug: 'var(--error)',
  perf: 'var(--warning)',
  chore: 'var(--text-tertiary)',
  docs: 'var(--success)',
  refactor: 'var(--syn-keyword)'
};
// 7 days × 24 hours activity (0..1), deterministic. Core hours dense, off-hours sparse.
const WORK_HEATMAP = (() => {
  const grid = [];
  for (let d = 0; d < 7; d++) {
    const weekend = d >= 5;
    const row = [];
    for (let h = 0; h < 24; h++) {
      const n = (d * 31 + h * 17) % 11 / 11; // 0..0.9 deterministic
      const core = h >= 8 && h < 18;
      let v = 0;
      if (weekend) v = n > 0.84 ? 0.3 : 0;else if (core) v = 0.55 + (1 - Math.abs(13 - h) / 6) * 0.35 + n * 0.1;else if (h >= 18 && h < 22) v = n > 0.5 ? 0.18 + n * 0.3 : 0;else if (h >= 6 && h < 8) v = n > 0.55 ? 0.22 : 0;else v = n > 0.88 ? 0.25 : 0;
      row.push(Math.min(1, +v.toFixed(2)));
    }
    grid.push(row);
  }
  return grid;
})();

// ---- Docker / container management (ctop-like), grouped by loaded project ----
const CONTAINER_GROUPS = [{
  project: 'capisco-core',
  services: [{
    name: 'web',
    image: 'node:22',
    status: 'running',
    cpu: 34,
    mem: '412 MB',
    memPct: 41,
    ports: '5173→5173',
    uptime: '2h 14m'
  }, {
    name: 'postgres',
    image: 'postgres:16',
    status: 'running',
    cpu: 2,
    mem: '96 MB',
    memPct: 10,
    ports: '5432→5432',
    uptime: '3d'
  }, {
    name: 'traefik',
    image: 'traefik:v3',
    status: 'running',
    cpu: 1,
    mem: '48 MB',
    memPct: 5,
    ports: '80, 443',
    uptime: '3d'
  }, {
    name: 'playwright',
    image: 'playwright:1.49',
    status: 'exited',
    cpu: 0,
    mem: '0 MB',
    memPct: 0,
    ports: '—',
    uptime: '—'
  }]
}, {
  project: 'capisco-tauri',
  services: [{
    name: 'tauri-build',
    image: 'rust:1.81',
    status: 'running',
    cpu: 8,
    mem: '128 MB',
    memPct: 13,
    ports: '—',
    uptime: '2h 14m'
  }, {
    name: 'redis',
    image: 'redis:7',
    status: 'running',
    cpu: 1,
    mem: '24 MB',
    memPct: 3,
    ports: '6379→6379',
    uptime: '2h 14m'
  }]
}];

// ---- Task board (Jira / Linear) ----
const TASKS = {
  progress: [{
    id: 'CAP-142',
    title: 'Worktree teardown frees its port',
    type: 'feature',
    points: 3
  }],
  review: [{
    id: 'CAP-139',
    title: 'Capability scope cache',
    type: 'feature',
    points: 3
  }],
  todo: [{
    id: 'CAP-148',
    title: 'Broker: immutable grants once issued',
    type: 'feature',
    points: 5
  }, {
    id: 'CAP-151',
    title: 'Port allocator avoids TOCTOU',
    type: 'bug',
    points: 2
  }, {
    id: 'CAP-153',
    title: 'Session resume from store',
    type: 'feature',
    points: 8
  }]
};

// ---- Tickets dashboard (Jira / Linear), richer model for the Tasks workspace ----
const SPRINT = {
  name: 'Sprint 24',
  day: 6,
  days: 10,
  committed: 52,
  done: 19
};
// status: backlog | todo | progress | review | testing | done
const TICKETS = [{
  id: 'CAP-142',
  title: 'Worktree teardown frees its allocated port',
  type: 'feature',
  points: 3,
  status: 'progress',
  who: 'you',
  mine: true,
  epic: 'broker',
  branch: '#1284',
  sub: '2/3'
}, {
  id: 'CAP-151',
  title: 'Port allocator avoids TOCTOU race',
  type: 'bug',
  points: 2,
  status: 'progress',
  who: 'you',
  mine: true,
  epic: 'broker',
  branch: '#1276'
}, {
  id: 'CAP-139',
  title: 'Capability scope cache',
  type: 'feature',
  points: 3,
  status: 'review',
  who: 'you',
  mine: true,
  epic: 'broker',
  branch: '#1283'
}, {
  id: 'CAP-160',
  title: 'Session-tree token aggregation',
  type: 'feature',
  points: 5,
  status: 'testing',
  who: 'you',
  mine: true,
  epic: 'sessions',
  sub: '4/4'
}, {
  id: 'CAP-148',
  title: 'Broker: immutable grants once issued',
  type: 'feature',
  points: 5,
  status: 'todo',
  who: 'mara',
  epic: 'broker'
}, {
  id: 'CAP-153',
  title: 'Session resume from store',
  type: 'feature',
  points: 8,
  status: 'todo',
  who: 'kai',
  epic: 'sessions'
}, {
  id: 'CAP-155',
  title: 'Provider registry hot-reload',
  type: 'feature',
  points: 5,
  status: 'todo',
  who: 'you',
  mine: true,
  epic: 'sessions'
}, {
  id: 'CAP-149',
  title: 'Datasource: prod read-only guard',
  type: 'feature',
  points: 3,
  status: 'review',
  who: 'lea',
  epic: 'sessions',
  branch: '#1271'
}, {
  id: 'CAP-150',
  title: 'Flaky test: broker escalation',
  type: 'bug',
  points: 1,
  status: 'testing',
  who: 'jdev',
  epic: 'broker'
}, {
  id: 'CAP-131',
  title: 'Terminal: renameable tabs',
  type: 'feature',
  points: 2,
  status: 'done',
  who: 'you',
  mine: true,
  epic: 'shell'
}, {
  id: 'CAP-128',
  title: 'Activity bar drag-and-dock',
  type: 'feature',
  points: 3,
  status: 'done',
  who: 'mara',
  epic: 'shell'
}, {
  id: 'CAP-126',
  title: 'Diff view: split / unified',
  type: 'feature',
  points: 5,
  status: 'done',
  who: 'you',
  mine: true,
  epic: 'shell'
}, {
  id: 'CAP-162',
  title: 'Worktree GC on crash',
  type: 'chore',
  points: 3,
  status: 'backlog',
  who: '—',
  epic: 'broker'
}, {
  id: 'CAP-164',
  title: 'Telemetry opt-in screen',
  type: 'feature',
  points: 5,
  status: 'backlog',
  who: '—',
  epic: 'shell'
}];
const TICKET_EPICS = [{
  id: 'broker',
  label: 'Worktree & Capability Broker'
}, {
  id: 'sessions',
  label: 'Sessions & Providers'
}, {
  id: 'shell',
  label: 'IDE Shell'
}];
const TICKET_COLUMNS = [{
  id: 'backlog',
  label: 'Backlog'
}, {
  id: 'todo',
  label: 'To do'
}, {
  id: 'progress',
  label: 'In Progress'
}, {
  id: 'review',
  label: 'Review'
}, {
  id: 'testing',
  label: 'Testing'
}, {
  id: 'done',
  label: 'Done'
}];
// Burndown: remaining story points per sprint day (idx 0..10). null = future.
const BURNDOWN = {
  ideal: [52, 46.8, 41.6, 36.4, 31.2, 26, 20.8, 15.6, 10.4, 5.2, 0],
  team: [52, 50, 47, 44, 41, 36, 33, null, null, null, null],
  // private: just your committed points (18 total)
  myIdeal: [18, 16.2, 14.4, 12.6, 10.8, 9, 7.2, 5.4, 3.6, 1.8, 0],
  mine: [18, 18, 15, 13, 11, 8, 6, null, null, null, null]
};

// ---- Tasks dashboard extras (WIP, reviews, throughput) ----
const TEAM_WIP = [{
  who: 'you',
  wip: 2,
  limit: 3
}, {
  who: 'mara',
  wip: 1,
  limit: 3
}, {
  who: 'kai',
  wip: 1,
  limit: 3
}, {
  who: 'jdev',
  wip: 1,
  limit: 2
}, {
  who: 'lea',
  wip: 1,
  limit: 3
}];
// per sprint day (idx 0..6 so far)
const MY_WIP_SERIES = [1, 2, 2, 3, 2, 2, 2];
const REVIEWS_GIVEN = [1, 0, 2, 1, 3, 1, 2];
const THROUGHPUT = [0, 1, 1, 2, 1, 3, 2]; // tickets closed / day
const TASK_TYPE_SPLIT = [{
  label: 'Feature',
  value: 9,
  color: 'var(--accent)'
}, {
  label: 'Bug',
  value: 3,
  color: 'var(--error)'
}, {
  label: 'Chore',
  value: 2,
  color: 'var(--text-tertiary)'
}];

// ---- File diff (side-by-side), sample for worktree.ts ----
const DIFF = {
  file: 'src/core/worktree.ts',
  added: 8,
  removed: 1,
  rows: [{
    l: {
      n: 16,
      t: '  async dispose() {'
    },
    r: {
      n: 16,
      t: '  async dispose() {'
    },
    k: 'ctx'
  }, {
    l: {
      n: 17,
      t: '    this.watcher.close();'
    },
    r: {
      n: 17,
      t: '    this.watcher.close();'
    },
    k: 'ctx'
  }, {
    l: null,
    r: {
      n: 18,
      t: '    await this.teardown();'
    },
    k: 'add'
  }, {
    l: {
      n: 18,
      t: '  }'
    },
    r: {
      n: 19,
      t: '  }'
    },
    k: 'ctx'
  }, {
    l: null,
    r: {
      n: 20,
      t: ''
    },
    k: 'add'
  }, {
    l: null,
    r: {
      n: 21,
      t: '  async teardown() {'
    },
    k: 'add'
  }, {
    l: null,
    r: {
      n: 22,
      t: '    await this.broker.release(this.port);'
    },
    k: 'add'
  }, {
    l: {
      n: 19,
      t: '    // TODO: free the port'
    },
    r: null,
    k: 'del'
  }, {
    l: null,
    r: {
      n: 23,
      t: '    await rm(this.dir, { recursive: true });'
    },
    k: 'add'
  }, {
    l: null,
    r: {
      n: 24,
      t: '  }'
    },
    k: 'add'
  }, {
    l: {
      n: 20,
      t: '}'
    },
    r: {
      n: 25,
      t: '}'
    },
    k: 'ctx'
  }]
};

// ---- Changes vs a base branch (branch comparison) ----
// ---- Changes vs a base branch (branch comparison) ----
// The current branch (feat/worktree-teardown) already has an open PR (#1284),
// so the default base is its PR TARGET. Without a PR it'd be the PARENT it
// branched from. Any other branch is selectable via the searchable dropdown.
const CHANGES_HAS_PR = true;
const COMPARE_BRANCHES = [{
  id: 'develop',
  name: 'develop',
  role: 'target'
},
// PR target
{
  id: 'main',
  name: 'main',
  role: 'parent'
},
// branched from
{
  id: 'release/1.4',
  name: 'release/1.4'
}, {
  id: 'release/1.3',
  name: 'release/1.3'
}, {
  id: 'feat/session-resume',
  name: 'feat/session-resume'
}, {
  id: 'feat/capability-cache',
  name: 'feat/capability-cache'
}, {
  id: 'fix/port-allocator',
  name: 'fix/port-allocator'
}, {
  id: 'chore/ci-cache',
  name: 'chore/ci-cache'
}];
const CHANGESET = [{
  ext: 'ts',
  name: 'worktree.ts',
  path: 'src/core',
  git: 'M',
  add: 12,
  del: 4
}, {
  ext: 'ts',
  name: 'broker.ts',
  path: 'src/core',
  git: 'A',
  add: 96,
  del: 0
}, {
  ext: 'ts',
  name: 'session-tree.ts',
  path: 'src/core',
  git: 'M',
  add: 24,
  del: 8
}, {
  ext: 'rs',
  name: 'main.rs',
  path: 'src-tauri',
  git: 'M',
  add: 6,
  del: 2
}, {
  ext: 'json',
  name: 'package.json',
  path: '.',
  git: 'M',
  add: 2,
  del: 1
}];

// ---- Team awareness (git.live-style): who is working where ----
const AWARENESS = [{
  who: 'mara',
  branch: 'feat/capability-cache',
  pr: '#1283',
  act: 'editing broker.ts',
  when: '2m ago',
  files: ['broker.ts', 'registry.ts'],
  status: 'active',
  overlap: 'broker.ts'
}, {
  who: 'jdev',
  branch: 'perf/broker-grant',
  pr: '#1279',
  act: 'pushed 3 commits',
  when: '18m ago',
  files: ['broker.ts'],
  status: 'active',
  overlap: 'broker.ts'
}, {
  who: 'kai',
  branch: 'feat/session-resume',
  pr: '#1280',
  act: 'opened a PR',
  when: '1h ago',
  files: ['session-tree.ts'],
  status: 'idle'
}, {
  who: 'lea',
  branch: 'refactor/session-store',
  pr: '#1255',
  act: 'left 2 comments',
  when: '3h ago',
  files: ['session-store.ts'],
  status: 'idle'
}];
Object.assign(window, {
  Icon,
  FileIcon,
  PROJECTS,
  SCRATCH,
  TABS,
  CHANGE_GROUPS,
  SHELF,
  SESSIONS,
  CHAT_SESSIONS,
  ALERTS,
  INSPECTIONS,
  PRS,
  GIT_STATS,
  SEARCH,
  STRUCTURE,
  DATASOURCES,
  GIT_WEEKS,
  GIT_SERIES,
  GIT_DORA,
  PR_CATEGORIES,
  WORK_HEATMAP,
  CONTAINER_GROUPS,
  SPRINT,
  TICKETS,
  TICKET_COLUMNS,
  TICKET_EPICS,
  BURNDOWN,
  CHANGES_HAS_PR,
  TEAM_WIP,
  MY_WIP_SERIES,
  REVIEWS_GIVEN,
  THROUGHPUT,
  TASK_TYPE_SPLIT,
  TASKS,
  DIFF,
  GIT_PRS,
  LABEL_COLORS,
  COMPARE_BRANCHES,
  CHANGESET,
  AWARENESS
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/capisco-ide/shared.jsx", error: String((e && e.message) || e) }); }

// ui_kits/capisco-ide/views.jsx
try { (() => {
/* Capisco IDE kit — left-panel provider views: PR, Git dashboard, Search, Structure, Data. */

/* ---------- PR / Forge board ("whose turn is it?") ---------- */
function PRRow({
  pr
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "pr-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: 'pr-dot pr-' + pr.status
  }), /*#__PURE__*/React.createElement("div", {
    className: "pr-main"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pr-title"
  }, pr.title, pr.stale && /*#__PURE__*/React.createElement("span", {
    className: "pr-stale"
  }, "stale")), /*#__PURE__*/React.createElement("div", {
    className: "pr-meta"
  }, pr.repo, " \xB7 @", pr.author, " \xB7 ", pr.age, pr.reviewers ? ' · ' + pr.reviewers : '')));
}
function PRPanel() {
  const {
    IconButton
  } = window.CapiscoDesignSystem_026f1e;
  return /*#__PURE__*/React.createElement("div", {
    className: "explorer"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "caps"
  }, "Pull Requests"), /*#__PURE__*/React.createElement("div", {
    className: "ph-actions"
  }, /*#__PURE__*/React.createElement(IconButton, {
    size: 22,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "filter",
      size: 13
    }),
    title: "Filter"
  }), /*#__PURE__*/React.createElement(IconButton, {
    size: 22,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "refresh-cw",
      size: 13
    }),
    title: "Refresh"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "tree"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sec-head"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "circle-alert",
    size: 12,
    color: "var(--warning)"
  }), "Your turn", /*#__PURE__*/React.createElement("span", {
    className: "sec-count"
  }, window.PRS.yourTurn.length)), window.PRS.yourTurn.map((pr, i) => /*#__PURE__*/React.createElement(PRRow, {
    key: i,
    pr: pr
  })), /*#__PURE__*/React.createElement("div", {
    className: "sec-head sec-head-2"
  }, "Awaiting others", /*#__PURE__*/React.createElement("span", {
    className: "sec-count"
  }, window.PRS.awaiting.length)), window.PRS.awaiting.map((pr, i) => /*#__PURE__*/React.createElement(PRRow, {
    key: i,
    pr: pr
  }))));
}

/* ---------- Git dashboard (local-first personal metrics) ---------- */
function GitDashboard() {
  const {
    IconButton
  } = window.CapiscoDesignSystem_026f1e;
  const g = window.GIT_STATS;
  const [range, setRange] = React.useState('Week');
  const maxA = Math.max(...g.activity);
  return /*#__PURE__*/React.createElement("div", {
    className: "explorer"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "caps"
  }, "Git \xB7 Activity"), /*#__PURE__*/React.createElement("div", {
    className: "ph-actions"
  }, /*#__PURE__*/React.createElement(IconButton, {
    size: 22,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "refresh-cw",
      size: 13
    }),
    title: "Refresh"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "gd-scroll"
  }, /*#__PURE__*/React.createElement("div", {
    className: "gd-range"
  }, ['Day', 'Week', 'Month'].map(r => /*#__PURE__*/React.createElement("button", {
    key: r,
    className: 'gd-rbtn' + (r === range ? ' active' : ''),
    onClick: () => setRange(r)
  }, r))), /*#__PURE__*/React.createElement("div", {
    className: "gd-stats"
  }, /*#__PURE__*/React.createElement("div", {
    className: "gd-stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "gd-val"
  }, g.commits), /*#__PURE__*/React.createElement("div", {
    className: "gd-lab"
  }, "Commits")), /*#__PURE__*/React.createElement("div", {
    className: "gd-stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "gd-val"
  }, g.prsOpened, " / ", g.prsMerged), /*#__PURE__*/React.createElement("div", {
    className: "gd-lab"
  }, "PRs open / merged"))), /*#__PURE__*/React.createElement("div", {
    className: "gd-lines"
  }, /*#__PURE__*/React.createElement("span", {
    className: "gd-add"
  }, "+", g.added.toLocaleString()), /*#__PURE__*/React.createElement("span", {
    className: "gd-del"
  }, "\u2212", g.removed.toLocaleString()), /*#__PURE__*/React.createElement("span", {
    className: "gd-lab"
  }, "lines")), /*#__PURE__*/React.createElement("div", {
    className: "gd-section"
  }, "Languages"), g.langs.map(l => /*#__PURE__*/React.createElement("div", {
    className: "gd-lang",
    key: l.name
  }, /*#__PURE__*/React.createElement("div", {
    className: "gd-lang-top"
  }, /*#__PURE__*/React.createElement("span", null, l.name), /*#__PURE__*/React.createElement("span", {
    className: "gd-pct"
  }, l.pct, "%")), /*#__PURE__*/React.createElement("div", {
    className: "gd-bar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "gd-fill",
    style: {
      width: l.pct + '%',
      background: l.color
    }
  })))), /*#__PURE__*/React.createElement("div", {
    className: "gd-section"
  }, "Commits / day"), /*#__PURE__*/React.createElement("div", {
    className: "gd-chart"
  }, g.activity.map((v, i) => /*#__PURE__*/React.createElement("div", {
    className: "gd-col",
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    className: "gd-coltrack"
  }, /*#__PURE__*/React.createElement("div", {
    className: "gd-colfill",
    style: {
      height: v / maxA * 100 + '%'
    }
  })), /*#__PURE__*/React.createElement("span", {
    className: "gd-day"
  }, g.days[i])))), /*#__PURE__*/React.createElement("div", {
    className: "gd-note"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "info",
    size: 11,
    color: "var(--text-tertiary)"
  }), "Activity, not performance \xB7 stays on this machine")));
}

/* ---------- Global search (ripgrep) ---------- */
function SearchPanel() {
  const {
    Input
  } = window.CapiscoDesignSystem_026f1e;
  const s = window.SEARCH;
  const total = s.files.reduce((n, f) => n + f.hits.length, 0);
  return /*#__PURE__*/React.createElement("div", {
    className: "explorer"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sp-head"
  }, /*#__PURE__*/React.createElement(Input, {
    mono: true,
    leading: /*#__PURE__*/React.createElement(Icon, {
      name: "search",
      size: 14,
      color: "var(--text-tertiary)"
    }),
    defaultValue: s.query
  }), /*#__PURE__*/React.createElement(Input, {
    mono: true,
    leading: /*#__PURE__*/React.createElement(Icon, {
      name: "replace",
      size: 14,
      color: "var(--text-tertiary)"
    }),
    placeholder: "Replace\u2026",
    style: {
      marginTop: 6
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "sp-summary"
  }, total, " results in ", s.files.length, " files")), /*#__PURE__*/React.createElement("div", {
    className: "sp-scroll"
  }, s.files.map((f, i) => /*#__PURE__*/React.createElement("div", {
    className: "sp-file",
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    className: "sp-fpath"
  }, /*#__PURE__*/React.createElement(FileIcon, {
    ext: "ts"
  }), /*#__PURE__*/React.createElement("span", {
    className: "sp-fname"
  }, f.path), /*#__PURE__*/React.createElement("span", {
    className: "sec-count"
  }, f.hits.length)), f.hits.map((h, j) => /*#__PURE__*/React.createElement("div", {
    className: "sp-hit",
    key: j
  }, /*#__PURE__*/React.createElement("span", {
    className: "sp-ln"
  }, h.ln), /*#__PURE__*/React.createElement("span", {
    className: "sp-code"
  }, h.before, /*#__PURE__*/React.createElement("mark", {
    className: "sp-mark"
  }, h.match), h.after)))))));
}

/* ---------- Structure (symbols outline) ---------- */
function StructurePanel() {
  const {
    IconButton
  } = window.CapiscoDesignSystem_026f1e;
  return /*#__PURE__*/React.createElement("div", {
    className: "explorer"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "caps"
  }, "Structure \xB7 broker.ts"), /*#__PURE__*/React.createElement("div", {
    className: "ph-actions"
  }, /*#__PURE__*/React.createElement(IconButton, {
    size: 22,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "arrow-down-up",
      size: 13
    }),
    title: "Sort"
  }), /*#__PURE__*/React.createElement(IconButton, {
    size: 22,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "list-collapse",
      size: 14
    }),
    title: "Collapse"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "tree"
  }, window.STRUCTURE.map((sym, i) => /*#__PURE__*/React.createElement("div", {
    className: "struct-row",
    key: i,
    style: {
      paddingLeft: 8 + sym.depth * 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: 'sym sym-' + sym.kind
  }, sym.kind), /*#__PURE__*/React.createElement("span", {
    className: "struct-name"
  }, sym.name)))));
}

/* ---------- Datasource explorer (prod read-only invariant) ---------- */
function DataConn({
  ds
}) {
  const {
    TreeRow
  } = window.CapiscoDesignSystem_026f1e;
  const [open, setOpen] = React.useState(ds.env !== 'production');
  const envColor = ds.env === 'production' ? 'var(--warning)' : ds.env === 'staging' ? 'var(--accent)' : 'var(--text-secondary)';
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "ds-conn",
    onClick: () => setOpen(v => !v)
  }, /*#__PURE__*/React.createElement("span", {
    className: "tw-chevron"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      transform: open ? 'rotate(90deg)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "m9 18 6-6-6-6"
  }))), /*#__PURE__*/React.createElement(Icon, {
    name: ds.engine === 'redis' ? 'database-zap' : 'database',
    size: 14,
    color: envColor
  }), /*#__PURE__*/React.createElement("span", {
    className: "ds-name"
  }, ds.name), /*#__PURE__*/React.createElement("span", {
    className: "ds-engine"
  }, ds.engine), ds.readonly && /*#__PURE__*/React.createElement("span", {
    className: "ds-ro"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "lock",
    size: 10,
    color: "var(--warning)"
  }), "read-only")), open && ds.tables.map((t, i) => /*#__PURE__*/React.createElement(TreeRow, {
    key: i,
    depth: 1,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "table-2",
      size: 14,
      color: "var(--text-secondary)"
    }),
    label: t,
    trailing: ds.readonly ? /*#__PURE__*/React.createElement(Icon, {
      name: "lock",
      size: 11,
      color: "var(--text-tertiary)"
    }) : null
  })));
}
function DataPanel() {
  const {
    IconButton
  } = window.CapiscoDesignSystem_026f1e;
  return /*#__PURE__*/React.createElement("div", {
    className: "explorer"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "caps"
  }, "Database"), /*#__PURE__*/React.createElement("div", {
    className: "ph-actions"
  }, /*#__PURE__*/React.createElement(IconButton, {
    size: 22,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "plus",
      size: 14
    }),
    title: "New connection"
  }), /*#__PURE__*/React.createElement(IconButton, {
    size: 22,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "refresh-cw",
      size: 13
    }),
    title: "Refresh"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "tree"
  }, window.DATASOURCES.map((ds, i) => /*#__PURE__*/React.createElement(DataConn, {
    key: i,
    ds: ds
  }))));
}

/* ---------- Detailed PR list (GitHub-like), used by the Git workspace ---------- */
function PRItem({
  pr,
  reReview,
  overdueTab
}) {
  const LC = window.LABEL_COLORS;
  const checks = {
    passing: {
      icon: 'circle-check',
      color: 'var(--success)',
      t: 'checks passing'
    },
    failing: {
      icon: 'circle-x',
      color: 'var(--error)',
      t: 'checks failing'
    },
    pending: {
      icon: 'circle-dot',
      color: 'var(--warning)',
      t: 'checks running'
    }
  }[pr.checks];
  const od = !pr.draft && pr.days > 3;
  const stateColor = pr.draft ? 'var(--text-tertiary)' : 'var(--accent)';
  const initials = w => w === 'you' ? 'me' : w.slice(0, 2);
  const rev = {
    approved: 'var(--success)',
    changes: 'var(--error)',
    pending: 'var(--text-tertiary)'
  };
  return /*#__PURE__*/React.createElement("div", {
    className: 'ghpr' + (reReview ? ' ghpr-hl' : '')
  }, /*#__PURE__*/React.createElement("span", {
    className: "ghpr-state",
    title: pr.draft ? 'draft' : 'open'
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "git-pull-request",
    size: 16,
    color: stateColor
  })), /*#__PURE__*/React.createElement("div", {
    className: "ghpr-main"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ghpr-titleline"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ghpr-title"
  }, pr.title), /*#__PURE__*/React.createElement("span", {
    className: "ghpr-num"
  }, "#", pr.num), pr.draft && /*#__PURE__*/React.createElement("span", {
    className: "ghpr-tag ghpr-draft"
  }, "draft"), reReview && /*#__PURE__*/React.createElement("span", {
    className: "ghpr-tag ghpr-re"
  }, "you reviewed before"), (overdueTab || od) && !pr.draft && /*#__PURE__*/React.createElement("span", {
    className: "ghpr-tag ghpr-od"
  }, pr.days, "d ready")), /*#__PURE__*/React.createElement("div", {
    className: "ghpr-meta"
  }, pr.repo, " ", /*#__PURE__*/React.createElement("span", {
    className: "ghpr-branch"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "git-branch",
    size: 11
  }), pr.branch), " \xB7 opened ", pr.days, "d ago by @", pr.author), /*#__PURE__*/React.createElement("div", {
    className: "ghpr-labels"
  }, pr.labels.map(l => /*#__PURE__*/React.createElement("span", {
    key: l,
    className: "ghpr-label",
    style: {
      color: LC[l] || 'var(--text-secondary)',
      borderColor: LC[l] || 'var(--border)'
    }
  }, l)))), /*#__PURE__*/React.createElement("div", {
    className: "ghpr-side"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ghpr-checks",
    title: checks.t
  }, /*#__PURE__*/React.createElement(Icon, {
    name: checks.icon,
    size: 13,
    color: checks.color
  })), /*#__PURE__*/React.createElement("div", {
    className: "ghpr-revs"
  }, pr.reviews.map((r, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "ghpr-av",
    title: r.who + ' · ' + r.state,
    style: {
      borderColor: rev[r.state]
    }
  }, initials(r.who)))), /*#__PURE__*/React.createElement("div", {
    className: "ghpr-stats"
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(Icon, {
    name: "message-square",
    size: 12
  }), pr.comments), /*#__PURE__*/React.createElement("span", {
    className: "gd-add"
  }, "+", pr.add), /*#__PURE__*/React.createElement("span", {
    className: "gd-del"
  }, "\u2212", pr.del))));
}
function PRList({
  list,
  highlightReReview,
  overdue,
  empty
}) {
  if (!list.length) return /*#__PURE__*/React.createElement("div", {
    className: "ghpr-empty"
  }, empty);
  return /*#__PURE__*/React.createElement("div", {
    className: "ghpr-list"
  }, list.map(p => /*#__PURE__*/React.createElement(PRItem, {
    key: p.num,
    pr: p,
    reReview: highlightReReview && p.reviewedByMe,
    overdueTab: overdue
  })));
}

/* ---------- Git workspace (center, full-width activity dashboard) ---------- */
function GitWorkspace() {
  const {
    LineChart,
    Donut,
    MetricCard,
    ChartCard,
    Heatmap
  } = window;
  const g = window.GIT_STATS,
    S = window.GIT_SERIES,
    W = window.GIT_WEEKS;
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
  const pad = n => String(n).padStart(2, '0');
  const PRS = window.GIT_PRS;
  const mine = PRS.filter(p => p.author === 'you');
  const review = PRS.filter(p => p.requested || p.reviewedByMe);
  const overdue = PRS.filter(p => !p.draft && p.days > 3);
  const isActivity = tab === 'overview' || tab === 'activity' || tab === 'working';
  return /*#__PURE__*/React.createElement("div", {
    className: "git-workspace"
  }, /*#__PURE__*/React.createElement("div", {
    className: "gitw-inner"
  }, /*#__PURE__*/React.createElement("div", {
    className: "gitw-head"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "gitw-title"
  }, "Git Dashboard"), /*#__PURE__*/React.createElement("div", {
    className: "gitw-filter"
  }, /*#__PURE__*/React.createElement("div", {
    className: "gd-range gitw-range"
  }, presets.map(r => /*#__PURE__*/React.createElement("button", {
    key: r,
    className: 'gd-rbtn' + (r === range ? ' active' : ''),
    onClick: () => setRange(r)
  }, r)), /*#__PURE__*/React.createElement("div", {
    className: "gitw-custom-wrap"
  }, /*#__PURE__*/React.createElement("button", {
    className: 'gd-rbtn gd-custom' + (customActive ? ' active' : ''),
    onClick: () => setCustomOpen(o => !o)
  }, customActive && range !== 'Custom' ? range : 'Custom', /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-down",
    size: 12
  })), customOpen && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "menu-scrim",
    onClick: () => setCustomOpen(false)
  }), /*#__PURE__*/React.createElement("div", {
    className: "date-pop"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dp-presets"
  }, ['Today', 'Yesterday', 'This week', 'Last week', 'This month', 'Last month', 'This year'].map(p => /*#__PURE__*/React.createElement("button", {
    key: p,
    className: 'dp-preset' + (range === p ? ' active' : ''),
    onClick: () => {
      setRange(p);
      setCustomOpen(false);
    }
  }, p))), /*#__PURE__*/React.createElement("div", {
    className: "dp-custom"
  }, /*#__PURE__*/React.createElement("label", null, "From"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: from,
    onChange: e => {
      setFrom(e.target.value);
      setRange('Custom');
    }
  }), /*#__PURE__*/React.createElement("label", null, "To"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: to,
    onChange: e => {
      setTo(e.target.value);
      setRange('Custom');
    }
  })))))))), /*#__PURE__*/React.createElement("div", {
    className: "gitw-tabs"
  }, [['mine', 'My PRs', mine.length], ['review', 'Review Requested', review.length], ['overdue', 'Overdue', overdue.length], ['team', 'Team', window.AWARENESS.length], ['overview', 'Overview'], ['activity', 'Activity'], ['working', 'Working Times']].map(([id, label, count]) => /*#__PURE__*/React.createElement("button", {
    key: id,
    className: 'gitw-tab' + (tab === id ? ' active' : ''),
    onClick: () => setTab(id)
  }, label, count != null && /*#__PURE__*/React.createElement("span", {
    className: "gitw-tcount"
  }, count)))), tab === 'mine' && /*#__PURE__*/React.createElement(PRList, {
    list: mine,
    empty: "No open PRs in your projects."
  }), tab === 'review' && /*#__PURE__*/React.createElement(PRList, {
    list: review,
    highlightReReview: true,
    empty: "No reviews awaiting you."
  }), tab === 'overdue' && /*#__PURE__*/React.createElement(PRList, {
    list: overdue,
    overdue: true,
    empty: "Nothing overdue \u2014 nice."
  }), tab === 'team' && /*#__PURE__*/React.createElement(TeamTab, null), tab === 'overview' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "mc-row"
  }, window.GIT_DORA.map((m, i) => /*#__PURE__*/React.createElement(MetricCard, {
    key: i,
    m: m
  }))), /*#__PURE__*/React.createElement("div", {
    className: "gitw-cols"
  }, /*#__PURE__*/React.createElement(ChartCard, {
    title: "Cycle Time Trend"
  }, /*#__PURE__*/React.createElement(LineChart, {
    data: S.cycleTime,
    labels: W,
    color: "var(--accent)",
    height: 170
  })), /*#__PURE__*/React.createElement(ChartCard, {
    title: "PR Categories"
  }, /*#__PURE__*/React.createElement(Donut, {
    segments: window.PR_CATEGORIES
  })))), tab === 'activity' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "gd-stats gitw-stats"
  }, /*#__PURE__*/React.createElement("div", {
    className: "gd-stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "gd-val"
  }, g.commits), /*#__PURE__*/React.createElement("div", {
    className: "gd-lab"
  }, "Commits")), /*#__PURE__*/React.createElement("div", {
    className: "gd-stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "gd-val"
  }, g.prsOpened, " / ", g.prsMerged), /*#__PURE__*/React.createElement("div", {
    className: "gd-lab"
  }, "PRs open / merged")), /*#__PURE__*/React.createElement("div", {
    className: "gd-stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "gd-val gitw-lines"
  }, /*#__PURE__*/React.createElement("span", {
    className: "gd-add"
  }, "+", g.added.toLocaleString()), " ", /*#__PURE__*/React.createElement("span", {
    className: "gd-del"
  }, "\u2212", g.removed.toLocaleString())), /*#__PURE__*/React.createElement("div", {
    className: "gd-lab"
  }, "Lines changed"))), /*#__PURE__*/React.createElement("div", {
    className: "gitw-cols"
  }, /*#__PURE__*/React.createElement(ChartCard, {
    title: "Commits per week"
  }, /*#__PURE__*/React.createElement(LineChart, {
    data: S.commits,
    labels: W,
    height: 150
  })), /*#__PURE__*/React.createElement(ChartCard, {
    title: "PRs merged per week"
  }, /*#__PURE__*/React.createElement(LineChart, {
    data: S.prsMerged,
    labels: W,
    height: 150
  })), /*#__PURE__*/React.createElement(ChartCard, {
    title: "Lines changed per week"
  }, /*#__PURE__*/React.createElement(LineChart, {
    data: S.loc,
    labels: W,
    height: 150,
    fmt: v => v + 'k'
  })), /*#__PURE__*/React.createElement(ChartCard, {
    title: "Reviews given per week"
  }, /*#__PURE__*/React.createElement(LineChart, {
    data: S.reviews,
    labels: W,
    height: 150
  }))), /*#__PURE__*/React.createElement("div", {
    className: "gitw-cols"
  }, /*#__PURE__*/React.createElement(ChartCard, {
    title: "Languages"
  }, g.langs.map(l => /*#__PURE__*/React.createElement("div", {
    className: "gd-lang",
    key: l.name
  }, /*#__PURE__*/React.createElement("div", {
    className: "gd-lang-top"
  }, /*#__PURE__*/React.createElement("span", null, l.name), /*#__PURE__*/React.createElement("span", {
    className: "gd-pct"
  }, l.pct, "%")), /*#__PURE__*/React.createElement("div", {
    className: "gd-bar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "gd-fill",
    style: {
      width: l.pct + '%',
      background: l.color
    }
  }))))), /*#__PURE__*/React.createElement(ChartCard, {
    title: "Commits / day"
  }, /*#__PURE__*/React.createElement("div", {
    className: "gd-chart"
  }, g.activity.map((v, i) => /*#__PURE__*/React.createElement("div", {
    className: "gd-col",
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    className: "gd-coltrack"
  }, /*#__PURE__*/React.createElement("div", {
    className: "gd-colfill",
    style: {
      height: v / maxA * 100 + '%'
    }
  })), /*#__PURE__*/React.createElement("span", {
    className: "gd-day"
  }, g.days[i]))))))), tab === 'working' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "wt-controls"
  }, /*#__PURE__*/React.createElement("span", {
    className: "wt-lab"
  }, "Working hours"), /*#__PURE__*/React.createElement("select", {
    className: "wt-sel",
    value: coreStart,
    onChange: e => setCoreStart(+e.target.value)
  }, Array.from({
    length: 24
  }, (_, h) => /*#__PURE__*/React.createElement("option", {
    key: h,
    value: h
  }, pad(h), ":00"))), /*#__PURE__*/React.createElement("span", {
    className: "wt-dash"
  }, "\u2013"), /*#__PURE__*/React.createElement("select", {
    className: "wt-sel",
    value: coreEnd,
    onChange: e => setCoreEnd(+e.target.value)
  }, Array.from({
    length: 24
  }, (_, i) => i + 1).map(h => /*#__PURE__*/React.createElement("option", {
    key: h,
    value: h
  }, pad(h), ":00"))), /*#__PURE__*/React.createElement("span", {
    className: "wt-hint"
  }, "Activity outside these hours shows red.")), /*#__PURE__*/React.createElement(ChartCard, {
    title: "Activity heatmap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wt-sub"
  }, "Commits (author time), PR reviews & creation, Jira / Linear activity. Darker = more activity."), /*#__PURE__*/React.createElement(Heatmap, {
    grid: window.WORK_HEATMAP,
    coreStart: coreStart,
    coreEnd: coreEnd
  }), /*#__PURE__*/React.createElement("div", {
    className: "wt-legend"
  }, /*#__PURE__*/React.createElement("span", {
    className: "wt-leg"
  }, /*#__PURE__*/React.createElement("span", {
    className: "wt-sw",
    style: {
      background: 'rgba(46,168,90,0.85)'
    }
  }), "Core hours (", pad(coreStart), ":00\u2013", pad(coreEnd), ":00)"), /*#__PURE__*/React.createElement("span", {
    className: "wt-leg"
  }, /*#__PURE__*/React.createElement("span", {
    className: "wt-sw",
    style: {
      background: 'rgba(231,76,60,0.85)'
    }
  }), "Off-hours / weekend")))), /*#__PURE__*/React.createElement("div", {
    className: "gd-note"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "info",
    size: 11,
    color: "var(--text-tertiary)"
  }), "Activity, not performance \xB7 stays on this machine \xB7 never compared across people")));
}
function DiffView({
  onClose
}) {
  const d = window.DIFF;
  const [split, setSplit] = React.useState(true);
  return /*#__PURE__*/React.createElement("div", {
    className: "diffview"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dv-head"
  }, /*#__PURE__*/React.createElement(FileIcon, {
    ext: "ts"
  }), /*#__PURE__*/React.createElement("span", {
    className: "dv-file"
  }, d.file), /*#__PURE__*/React.createElement("span", {
    className: "dv-stat"
  }, /*#__PURE__*/React.createElement("span", {
    className: "gd-add"
  }, "+", d.added), " ", /*#__PURE__*/React.createElement("span", {
    className: "gd-del"
  }, "\u2212", d.removed)), /*#__PURE__*/React.createElement("div", {
    className: "tb-spacer"
  }), /*#__PURE__*/React.createElement("div", {
    className: "dv-toggle"
  }, /*#__PURE__*/React.createElement("button", {
    className: split ? 'active' : '',
    onClick: () => setSplit(true)
  }, "Split"), /*#__PURE__*/React.createElement("button", {
    className: !split ? 'active' : '',
    onClick: () => setSplit(false)
  }, "Unified")), /*#__PURE__*/React.createElement("button", {
    className: "dv-close",
    title: "Close diff",
    onClick: onClose
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 15,
    color: "var(--text-secondary)"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "dv-body"
  }, split ? /*#__PURE__*/React.createElement("div", {
    className: "dv-split"
  }, d.rows.map((row, i) => /*#__PURE__*/React.createElement("div", {
    className: "dv-line",
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    className: 'dv-cell' + (row.k === 'del' ? ' del' : row.k === 'add' && !row.l ? ' filler' : '')
  }, row.l ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    className: "dv-ln"
  }, row.l.n), /*#__PURE__*/React.createElement("span", {
    className: "dv-code"
  }, row.l.t)) : /*#__PURE__*/React.createElement("span", {
    className: "dv-ln"
  })), /*#__PURE__*/React.createElement("div", {
    className: 'dv-cell' + (row.k === 'add' ? ' add' : row.k === 'del' && !row.r ? ' filler' : '')
  }, row.r ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    className: "dv-ln"
  }, row.r.n), /*#__PURE__*/React.createElement("span", {
    className: "dv-code"
  }, row.r.t)) : /*#__PURE__*/React.createElement("span", {
    className: "dv-ln"
  }))))) : /*#__PURE__*/React.createElement("div", {
    className: "dv-unified"
  }, d.rows.map((row, i) => {
    const ln = row.k === 'add' ? row.r.n : row.l.n;
    const text = row.k === 'add' ? row.r.t : row.l.t;
    const sign = row.k === 'add' ? '+' : row.k === 'del' ? '−' : ' ';
    return /*#__PURE__*/React.createElement("div", {
      className: 'dv-uline ' + row.k,
      key: i
    }, /*#__PURE__*/React.createElement("span", {
      className: "dv-ln"
    }, ln), /*#__PURE__*/React.createElement("span", {
      className: "dv-sign"
    }, sign), /*#__PURE__*/React.createElement("span", {
      className: "dv-code"
    }, text));
  }))));
}

/* ---------- Docker / container management (ctop-like), grouped by project ---------- */
function ContainerRow({
  c
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "ct-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: 'ct-dot ct-' + c.status
  }), /*#__PURE__*/React.createElement("div", {
    className: "ct-main"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ct-top"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ct-name"
  }, c.name), /*#__PURE__*/React.createElement("span", {
    className: "ct-image"
  }, c.image)), /*#__PURE__*/React.createElement("div", {
    className: "ct-meta"
  }, c.status === 'exited' ? 'exited' : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("b", null, c.cpu, "%"), " cpu \xB7 ", c.mem, " \xB7 ", c.ports)), c.status === 'running' && /*#__PURE__*/React.createElement("div", {
    className: "ct-bar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ct-fill",
    style: {
      width: c.cpu + '%'
    }
  }))), /*#__PURE__*/React.createElement("button", {
    className: "ct-console",
    title: c.status === 'running' ? 'Open console (exec -it)' : 'Start'
  }, /*#__PURE__*/React.createElement(Icon, {
    name: c.status === 'running' ? 'square-terminal' : 'play',
    size: 14,
    color: "var(--text-secondary)"
  })));
}
function ContainerPanel() {
  const {
    IconButton
  } = window.CapiscoDesignSystem_026f1e;
  const [collapsed, setCollapsed] = React.useState({});
  const toggle = p => setCollapsed(c => ({
    ...c,
    [p]: !c[p]
  }));
  return /*#__PURE__*/React.createElement("div", {
    className: "explorer"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "caps"
  }, "Services"), /*#__PURE__*/React.createElement("div", {
    className: "ph-actions"
  }, /*#__PURE__*/React.createElement(IconButton, {
    size: 22,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "play",
      size: 13
    }),
    title: "Start all"
  }), /*#__PURE__*/React.createElement(IconButton, {
    size: 22,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "refresh-cw",
      size: 13
    }),
    title: "Refresh"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "tree"
  }, window.CONTAINER_GROUPS.map((g, gi) => {
    const running = g.services.filter(s => s.status === 'running').length;
    const open = !collapsed[g.project];
    return /*#__PURE__*/React.createElement("div", {
      key: gi
    }, /*#__PURE__*/React.createElement("div", {
      className: "ws-group",
      onClick: () => toggle(g.project)
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "chevron-down",
      size: 12,
      color: "var(--text-secondary)",
      style: {
        transform: open ? 'none' : 'rotate(-90deg)'
      }
    }), /*#__PURE__*/React.createElement(Icon, {
      name: "folder",
      size: 13,
      color: "var(--text-secondary)"
    }), /*#__PURE__*/React.createElement("span", {
      className: "ws-group-name"
    }, g.project), /*#__PURE__*/React.createElement("span", {
      className: "ct-grpcount"
    }, running, "/", g.services.length, " up")), open && g.services.map((c, i) => /*#__PURE__*/React.createElement(ContainerRow, {
      key: i,
      c: c
    })));
  })));
}

/* ---------- Task board (Jira / Linear) ---------- */
function TaskRow({
  t
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "task-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: 'task-type tt-' + t.type
  }, t.type === 'bug' ? 'B' : 'F'), /*#__PURE__*/React.createElement("div", {
    className: "task-main"
  }, /*#__PURE__*/React.createElement("div", {
    className: "task-title"
  }, t.title), /*#__PURE__*/React.createElement("div", {
    className: "task-meta"
  }, t.id, " \xB7 ", t.points, " pts")), /*#__PURE__*/React.createElement("button", {
    className: "task-run",
    title: "Start in a worktree"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "play",
    size: 13,
    color: "var(--accent)"
  })));
}
function TaskPanel() {
  const {
    IconButton
  } = window.CapiscoDesignSystem_026f1e;
  const T = window.TASKS;
  return /*#__PURE__*/React.createElement("div", {
    className: "explorer"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "caps"
  }, "Tasks \xB7 Sprint 24"), /*#__PURE__*/React.createElement("div", {
    className: "ph-actions"
  }, /*#__PURE__*/React.createElement(IconButton, {
    size: 22,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "filter",
      size: 13
    }),
    title: "Filter"
  }), /*#__PURE__*/React.createElement(IconButton, {
    size: 22,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "refresh-cw",
      size: 13
    }),
    title: "Refresh"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "tree"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sec-head"
  }, "In Progress", /*#__PURE__*/React.createElement("span", {
    className: "sec-count"
  }, T.progress.length)), T.progress.map(t => /*#__PURE__*/React.createElement(TaskRow, {
    key: t.id,
    t: t
  })), /*#__PURE__*/React.createElement("div", {
    className: "sec-head sec-head-2"
  }, "In Review", /*#__PURE__*/React.createElement("span", {
    className: "sec-count"
  }, T.review.length)), T.review.map(t => /*#__PURE__*/React.createElement(TaskRow, {
    key: t.id,
    t: t
  })), /*#__PURE__*/React.createElement("div", {
    className: "sec-head sec-head-2"
  }, "To do", /*#__PURE__*/React.createElement("span", {
    className: "sec-count"
  }, T.todo.length)), T.todo.map(t => /*#__PURE__*/React.createElement(TaskRow, {
    key: t.id,
    t: t
  }))));
}

/* ---------- Changes vs a base branch ---------- */
function ChangesPanel({
  onOpenDiff
}) {
  const {
    TreeRow,
    GitMarker,
    IconButton
  } = window.CapiscoDesignSystem_026f1e;
  const branches = window.COMPARE_BRANCHES;
  const defaultRole = window.CHANGES_HAS_PR ? 'target' : 'parent';
  const initial = (branches.find(b => b.role === defaultRole) || branches[0]).id;
  const [base, setBase] = React.useState(initial);
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const cur = branches.find(b => b.id === base) || branches[0];
  const filtered = branches.filter(b => b.name.toLowerCase().includes(q.toLowerCase()));
  const cs = window.CHANGESET;
  const tot = cs.reduce((a, c) => ({
    add: a.add + c.add,
    del: a.del + c.del
  }), {
    add: 0,
    del: 0
  });
  return /*#__PURE__*/React.createElement("div", {
    className: "explorer"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "caps"
  }, "Changes"), /*#__PURE__*/React.createElement("div", {
    className: "ph-actions"
  }, /*#__PURE__*/React.createElement(IconButton, {
    size: 22,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "refresh-cw",
      size: 13
    }),
    title: "Refresh"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "ch-compare"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ch-combo"
  }, /*#__PURE__*/React.createElement("button", {
    className: "ch-sel",
    onClick: () => {
      setOpen(o => !o);
      setQ('');
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ch-selname"
  }, cur.name), cur.role && /*#__PURE__*/React.createElement("span", {
    className: "ch-role"
  }, cur.role), /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-down",
    size: 12,
    color: "var(--text-tertiary)"
  })), open && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "menu-scrim",
    onClick: () => setOpen(false)
  }), /*#__PURE__*/React.createElement("div", {
    className: "ch-pop"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ch-search"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 12,
    color: "var(--text-tertiary)"
  }), /*#__PURE__*/React.createElement("input", {
    autoFocus: true,
    placeholder: "Find branch\u2026",
    value: q,
    onChange: e => setQ(e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    className: "ch-opts"
  }, filtered.map(b => /*#__PURE__*/React.createElement("button", {
    key: b.id,
    className: 'ch-opt' + (b.id === base ? ' active' : ''),
    onClick: () => {
      setBase(b.id);
      setOpen(false);
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "git-branch",
    size: 12,
    color: "var(--text-tertiary)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "ch-optname"
  }, b.name), b.role && /*#__PURE__*/React.createElement("span", {
    className: "ch-role"
  }, b.role), b.id === base && /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 12,
    color: "var(--accent)"
  }))), !filtered.length && /*#__PURE__*/React.createElement("div", {
    className: "ch-noopt"
  }, "No branches match"))))), /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-right",
    size: 12,
    color: "var(--text-tertiary)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "ch-cur",
    title: "feat/worktree-teardown"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "git-branch",
    size: 11,
    color: "var(--accent)"
  }), "current")), /*#__PURE__*/React.createElement("div", {
    className: "ch-summary"
  }, cs.length, " files changed \xB7 ", /*#__PURE__*/React.createElement("span", {
    className: "gd-add"
  }, "+", tot.add), " ", /*#__PURE__*/React.createElement("span", {
    className: "gd-del"
  }, "\u2212", tot.del)), /*#__PURE__*/React.createElement("div", {
    className: "tree"
  }, cs.map((c, i) => /*#__PURE__*/React.createElement(TreeRow, {
    key: i,
    depth: 0,
    icon: /*#__PURE__*/React.createElement(FileIcon, {
      ext: c.ext
    }),
    label: c.name,
    onClick: () => onOpenDiff && onOpenDiff(c.name),
    trailing: /*#__PURE__*/React.createElement("span", {
      className: "ch-row-meta"
    }, /*#__PURE__*/React.createElement("span", {
      className: "ch-stat"
    }, /*#__PURE__*/React.createElement("span", {
      className: "gd-add"
    }, "+", c.add), " ", /*#__PURE__*/React.createElement("span", {
      className: "gd-del"
    }, "\u2212", c.del)), /*#__PURE__*/React.createElement(GitMarker, {
      status: c.git
    }))
  }))));
}

/* ---------- Team awareness (git.live-style) ---------- */
function AwarenessRow({
  a,
  by
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "aw-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: 'aw-av' + (a.status === 'active' ? ' on' : '')
  }, a.who.slice(0, 2)), /*#__PURE__*/React.createElement("div", {
    className: "aw-main"
  }, /*#__PURE__*/React.createElement("div", {
    className: "aw-top"
  }, /*#__PURE__*/React.createElement("b", null, a.who), " ", /*#__PURE__*/React.createElement("span", {
    className: "aw-act"
  }, a.act), " ", /*#__PURE__*/React.createElement("span", {
    className: "aw-when"
  }, "\xB7 ", a.when)), /*#__PURE__*/React.createElement("div", {
    className: "aw-where"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: by === 'pr' ? 'git-pull-request' : 'git-branch',
    size: 11,
    color: "var(--accent)"
  }), by === 'pr' ? a.pr + ' · ' + a.branch : a.branch), /*#__PURE__*/React.createElement("div", {
    className: "aw-files"
  }, a.files.map(f => /*#__PURE__*/React.createElement("span", {
    key: f,
    className: 'aw-file' + (a.overlap === f ? ' clash' : '')
  }, f))), a.overlap && /*#__PURE__*/React.createElement("div", {
    className: "aw-warn"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "triangle-alert",
    size: 11,
    color: "var(--warning)"
  }), "overlaps your uncommitted ", a.overlap)), /*#__PURE__*/React.createElement("div", {
    className: "aw-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "aw-btn",
    title: "View their diff"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "eye",
    size: 13,
    color: "var(--text-secondary)"
  })), /*#__PURE__*/React.createElement("button", {
    className: "aw-btn aw-cp",
    title: "Cherry-pick their changes"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "git-branch-plus",
    size: 13
  }), "Cherry-pick")));
}
function TeamTab() {
  const aw = window.AWARENESS;
  const [by, setBy] = React.useState('pr');
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "team-bar"
  }, /*#__PURE__*/React.createElement("span", {
    className: "team-hint"
  }, "Who's working where \u2014 live across open work"), /*#__PURE__*/React.createElement("div", {
    className: "as-seg team-seg"
  }, /*#__PURE__*/React.createElement("button", {
    className: 'as-opt' + (by === 'pr' ? ' active' : ''),
    onClick: () => setBy('pr')
  }, "By PR"), /*#__PURE__*/React.createElement("button", {
    className: 'as-opt' + (by === 'branch' ? ' active' : ''),
    onClick: () => setBy('branch')
  }, "By branch"))), /*#__PURE__*/React.createElement("div", {
    className: "aw-list"
  }, aw.map((a, i) => /*#__PURE__*/React.createElement(AwarenessRow, {
    key: i,
    a: a,
    by: by
  }))));
}

/* ---------- Tasks workspace (Jira / Linear dashboard, center) ---------- */
function TicketCard({
  t,
  compact,
  onOpen
}) {
  const typeTag = {
    feature: 'F',
    bug: 'B',
    chore: 'C'
  }[t.type] || 'F';
  return /*#__PURE__*/React.createElement("div", {
    className: 'tkt' + (compact ? ' tkt-compact' : ''),
    onClick: () => onOpen && onOpen(t)
  }, /*#__PURE__*/React.createElement("div", {
    className: "tkt-top"
  }, /*#__PURE__*/React.createElement("span", {
    className: 'task-type tt-' + t.type
  }, typeTag), /*#__PURE__*/React.createElement("span", {
    className: "tkt-id"
  }, t.id), t.mine && /*#__PURE__*/React.createElement("span", {
    className: "tkt-mine"
  }, "mine"), /*#__PURE__*/React.createElement("span", {
    className: "tkt-pts"
  }, t.points)), /*#__PURE__*/React.createElement("div", {
    className: "tkt-title"
  }, t.title), !compact && /*#__PURE__*/React.createElement("div", {
    className: "tkt-who"
  }, /*#__PURE__*/React.createElement("span", {
    className: "tkt-av"
  }, t.who === 'you' ? 'me' : t.who === '—' ? '·' : t.who.slice(0, 2)), t.who));
}

/* Linear-style board card: id + avatar, type icon + title, labels, footer (PR / subtasks). */
function LinearCard({
  t,
  onOpen
}) {
  const typeColor = {
    feature: 'var(--accent)',
    bug: 'var(--error)',
    chore: 'var(--text-tertiary)'
  }[t.type];
  const av = t.who === 'you' ? 'me' : t.who === '—' ? '·' : t.who.slice(0, 2);
  return /*#__PURE__*/React.createElement("div", {
    className: "lc-card",
    onClick: () => onOpen && onOpen(t)
  }, /*#__PURE__*/React.createElement("div", {
    className: "lc-top"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lc-id"
  }, t.id), /*#__PURE__*/React.createElement("span", {
    className: "lc-av",
    title: t.who
  }, av)), /*#__PURE__*/React.createElement("div", {
    className: "lc-title"
  }, t.title), /*#__PURE__*/React.createElement("div", {
    className: "lc-labels"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lc-pri"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "bar-chart-3",
    size: 11,
    color: "var(--text-tertiary)"
  })), /*#__PURE__*/React.createElement("span", {
    className: "lc-label",
    style: {
      color: typeColor,
      borderColor: typeColor
    }
  }, t.type), t.mine && /*#__PURE__*/React.createElement("span", {
    className: "lc-label lc-mine"
  }, "mine")), (t.branch || t.sub) && /*#__PURE__*/React.createElement("div", {
    className: "lc-foot"
  }, t.branch && /*#__PURE__*/React.createElement("span", {
    className: "lc-pr"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "git-pull-request",
    size: 11,
    color: "var(--text-tertiary)"
  }), t.branch), t.sub && /*#__PURE__*/React.createElement("span", {
    className: "lc-sub"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "circle-dashed",
    size: 11,
    color: "var(--text-tertiary)"
  }), t.sub), /*#__PURE__*/React.createElement("span", {
    className: "lc-pts"
  }, t.points)));
}

/* ---------- Ticket detail (opens in its own tab) ---------- */
function TicketDetail({
  t,
  onOpenTicket
}) {
  const {
    Button,
    Input
  } = window.CapiscoDesignSystem_026f1e;
  const [editing, setEditing] = React.useState(false);
  const [desc, setDesc] = React.useState('When a session ends, the worktree must be torn down and its allocated port released back to the broker pool. Currently the port leaks on crash.\n\nAcceptance:\n• teardown() releases the port\n• temp worktree dir is removed\n• covered by a test');
  const [comments, setComments] = React.useState([{
    who: 'mara',
    when: '2d ago',
    text: 'Make sure release() is idempotent — dispose() can run twice on crash recovery.'
  }, {
    who: 'you',
    when: '1d ago',
    text: 'Good catch. Added a guard + a test for double-dispose.'
  }]);
  const [draft, setDraft] = React.useState('');
  const statusLabel = {
    backlog: 'Backlog',
    todo: 'To do',
    progress: 'In Progress',
    review: 'Review',
    testing: 'Testing',
    done: 'Done'
  }[t.status];
  const typeColor = {
    feature: 'var(--accent)',
    bug: 'var(--error)',
    chore: 'var(--text-tertiary)'
  }[t.type];
  const addComment = () => {
    if (!draft.trim()) return;
    setComments(c => [...c, {
      who: 'you',
      when: 'now',
      text: draft.trim()
    }]);
    setDraft('');
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "git-workspace"
  }, /*#__PURE__*/React.createElement("div", {
    className: "gitw-inner td-inner"
  }, /*#__PURE__*/React.createElement("div", {
    className: "td-bc"
  }, "tasks ", /*#__PURE__*/React.createElement("span", {
    className: "sep"
  }, "\u203A"), " ", t.id), /*#__PURE__*/React.createElement("div", {
    className: "td-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "td-main"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "td-title"
  }, t.title), /*#__PURE__*/React.createElement("div", {
    className: "td-sub"
  }, /*#__PURE__*/React.createElement("span", {
    className: "td-id"
  }, t.id), " \xB7 opened by @", t.who === 'you' ? 'you' : t.who, " \xB7 ", window.SPRINT.name), /*#__PURE__*/React.createElement("div", {
    className: "td-section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "td-sechead"
  }, "Description", /*#__PURE__*/React.createElement("button", {
    className: "td-edit",
    onClick: () => setEditing(v => !v)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: editing ? 'check' : 'pencil',
    size: 12
  }), editing ? 'Save' : 'Edit')), editing ? /*#__PURE__*/React.createElement("textarea", {
    className: "td-descedit",
    value: desc,
    onChange: e => setDesc(e.target.value)
  }) : /*#__PURE__*/React.createElement("div", {
    className: "td-desc"
  }, desc.split('\n').map((l, i) => /*#__PURE__*/React.createElement("p", {
    key: i
  }, l || '\u00a0')))), /*#__PURE__*/React.createElement("div", {
    className: "td-section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "td-sechead"
  }, "Activity \xB7 ", comments.length, " comments"), /*#__PURE__*/React.createElement("div", {
    className: "td-comments"
  }, comments.map((c, i) => /*#__PURE__*/React.createElement("div", {
    className: "td-comment",
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "td-cav"
  }, c.who === 'you' ? 'me' : c.who.slice(0, 2)), /*#__PURE__*/React.createElement("div", {
    className: "td-cbody"
  }, /*#__PURE__*/React.createElement("div", {
    className: "td-cmeta"
  }, /*#__PURE__*/React.createElement("b", null, c.who), " \xB7 ", c.when), /*#__PURE__*/React.createElement("div", {
    className: "td-ctext"
  }, c.text))))), /*#__PURE__*/React.createElement("div", {
    className: "td-compose"
  }, /*#__PURE__*/React.createElement("textarea", {
    placeholder: "Write a comment\u2026",
    value: draft,
    onChange: e => setDraft(e.target.value),
    onKeyDown: e => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addComment();
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "td-composeactions"
  }, /*#__PURE__*/React.createElement("span", {
    className: "td-hint"
  }, "\u2318\u21B5 to send"), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "md",
    onClick: addComment
  }, "Comment"))))), /*#__PURE__*/React.createElement("aside", {
    className: "td-side"
  }, /*#__PURE__*/React.createElement("div", {
    className: "td-field"
  }, /*#__PURE__*/React.createElement("label", null, "Status"), /*#__PURE__*/React.createElement("div", {
    className: "td-val"
  }, /*#__PURE__*/React.createElement("span", {
    className: 'tk-actdot st-' + t.status
  }), statusLabel)), /*#__PURE__*/React.createElement("div", {
    className: "td-field"
  }, /*#__PURE__*/React.createElement("label", null, "Assignee"), /*#__PURE__*/React.createElement("div", {
    className: "td-val"
  }, /*#__PURE__*/React.createElement("span", {
    className: "td-cav sm"
  }, t.who === 'you' ? 'me' : t.who.slice(0, 2)), t.who)), /*#__PURE__*/React.createElement("div", {
    className: "td-field"
  }, /*#__PURE__*/React.createElement("label", null, "Type"), /*#__PURE__*/React.createElement("div", {
    className: "td-val"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lc-label",
    style: {
      color: typeColor,
      borderColor: typeColor
    }
  }, t.type))), /*#__PURE__*/React.createElement("div", {
    className: "td-field"
  }, /*#__PURE__*/React.createElement("label", null, "Points"), /*#__PURE__*/React.createElement("div", {
    className: "td-val"
  }, t.points)), /*#__PURE__*/React.createElement("div", {
    className: "td-field"
  }, /*#__PURE__*/React.createElement("label", null, "Epic"), /*#__PURE__*/React.createElement("div", {
    className: "td-val"
  }, (window.TICKET_EPICS.find(e => e.id === t.epic) || {}).label || '—')), t.branch && /*#__PURE__*/React.createElement("div", {
    className: "td-field"
  }, /*#__PURE__*/React.createElement("label", null, "Pull request"), /*#__PURE__*/React.createElement("div", {
    className: "td-val td-link"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "git-pull-request",
    size: 12,
    color: "var(--accent)"
  }), t.branch)), t.sub && /*#__PURE__*/React.createElement("div", {
    className: "td-field"
  }, /*#__PURE__*/React.createElement("label", null, "Sub-tasks"), /*#__PURE__*/React.createElement("div", {
    className: "td-val"
  }, t.sub)), /*#__PURE__*/React.createElement("div", {
    className: "td-actions"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "md",
    style: {
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "git-branch-plus",
    size: 13
  }), "Create branch"), /*#__PURE__*/React.createElement(Button, {
    variant: "default",
    size: "md",
    style: {
      width: '100%',
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "git-branch",
    size: 13
  }), "Start in a worktree"))))));
}
function TaskDashboard() {
  const [open, setOpen] = React.useState([]); // open ticket ids
  const [view, setView] = React.useState('overview');
  const openTicket = t => {
    setOpen(o => o.includes(t.id) ? o : [...o, t.id]);
    setView(t.id);
  };
  const closeTicket = id => {
    setOpen(o => o.filter(x => x !== id));
    setView(v => v === id ? 'overview' : v);
  };
  const byId = id => window.TICKETS.find(t => t.id === id);
  return /*#__PURE__*/React.createElement("div", {
    className: "tk-workspace"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tk-tabbar"
  }, /*#__PURE__*/React.createElement("button", {
    className: 'tk-tab' + (view === 'overview' ? ' active' : ''),
    onClick: () => setView('overview')
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "layout-dashboard",
    size: 13
  }), "Overview"), open.map(id => /*#__PURE__*/React.createElement("button", {
    key: id,
    className: 'tk-tab' + (view === id ? ' active' : ''),
    onClick: () => setView(id)
  }, /*#__PURE__*/React.createElement("span", {
    className: "tk-tabid"
  }, id), /*#__PURE__*/React.createElement("span", {
    className: "tk-tabx",
    title: "Close",
    onClick: e => {
      e.stopPropagation();
      closeTicket(id);
    }
  }, "\xD7")))), /*#__PURE__*/React.createElement("div", {
    className: "tk-tabbody"
  }, view === 'overview' ? /*#__PURE__*/React.createElement(TaskOverview, {
    onOpenTicket: openTicket
  }) : /*#__PURE__*/React.createElement(TicketDetail, {
    t: byId(view),
    onOpenTicket: openTicket
  })));
}
function TaskOverview({
  onOpenTicket
}) {
  const {
    BurndownChart,
    ChartCard,
    LineChart,
    Donut,
    MetricCard
  } = window;
  const T = window.TICKETS,
    COLS = window.TICKET_COLUMNS,
    S = window.SPRINT,
    B = window.BURNDOWN;
  const [tab, setTab] = React.useState('board');
  const mine = T.filter(t => t.mine);
  const active = T.filter(t => t.mine && ['progress', 'review', 'testing'].includes(t.status));
  const pct = Math.round(S.done / S.committed * 100);
  const myCommitted = mine.reduce((a, t) => a + t.points, 0);
  const myDone = mine.filter(t => t.status === 'done').reduce((a, t) => a + t.points, 0);
  const myWip = T.filter(t => t.mine && t.status === 'progress').length;
  const reviewReq = T.filter(t => t.status === 'review' && !t.mine).length + 2;
  return /*#__PURE__*/React.createElement("div", {
    className: "git-workspace"
  }, /*#__PURE__*/React.createElement("div", {
    className: "gitw-inner gitw-wide"
  }, /*#__PURE__*/React.createElement("div", {
    className: "gitw-head"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "gitw-title"
  }, "Tasks \xB7 ", S.name), /*#__PURE__*/React.createElement("div", {
    className: "tk-sprintmeta"
  }, "Day ", S.day, "/", S.days, " \xB7 ", S.done, "/", S.committed, " pts \xB7 ", pct, "%")), /*#__PURE__*/React.createElement("div", {
    className: "gitw-tabs"
  }, [['board', 'Board'], ['mine', 'My Tickets', mine.length], ['active', 'Active', active.length], ['burndown', 'Insights']].map(([id, label, count]) => /*#__PURE__*/React.createElement("button", {
    key: id,
    className: 'gitw-tab' + (tab === id ? ' active' : ''),
    onClick: () => setTab(id)
  }, label, count != null && /*#__PURE__*/React.createElement("span", {
    className: "gitw-tcount"
  }, count)))), tab === 'board' && /*#__PURE__*/React.createElement("div", {
    className: "lb"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lb-head"
  }, COLS.map(c => {
    const cnt = T.filter(t => t.status === c.id).length;
    return /*#__PURE__*/React.createElement("div", {
      className: "lb-col-h",
      key: c.id
    }, /*#__PURE__*/React.createElement("span", {
      className: 'tk-actdot st-' + c.id
    }), c.label, /*#__PURE__*/React.createElement("span", {
      className: "lb-colcount"
    }, cnt));
  })), window.TICKET_EPICS.map(ep => {
    const epItems = T.filter(t => t.epic === ep.id);
    if (!epItems.length) return null;
    return /*#__PURE__*/React.createElement("div", {
      className: "lb-lane",
      key: ep.id
    }, /*#__PURE__*/React.createElement("div", {
      className: "lb-lanehead"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "chevron-down",
      size: 12,
      color: "var(--text-secondary)"
    }), /*#__PURE__*/React.createElement(Icon, {
      name: "layers",
      size: 12,
      color: "var(--text-tertiary)"
    }), ep.label, /*#__PURE__*/React.createElement("span", {
      className: "lb-colcount"
    }, epItems.length)), /*#__PURE__*/React.createElement("div", {
      className: "lb-row"
    }, COLS.map(c => /*#__PURE__*/React.createElement("div", {
      className: "lb-cell",
      key: c.id
    }, epItems.filter(t => t.status === c.id).map(t => /*#__PURE__*/React.createElement(LinearCard, {
      key: t.id,
      t: t,
      onOpen: onOpenTicket
    }))))));
  })), tab === 'mine' && /*#__PURE__*/React.createElement("div", {
    className: "tk-cols tk-cols-3"
  }, COLS.filter(c => mine.some(t => t.status === c.id)).map(c => {
    const items = mine.filter(t => t.status === c.id);
    const pts = items.reduce((a, t) => a + t.points, 0);
    return /*#__PURE__*/React.createElement("div", {
      className: "tk-actgroup",
      key: c.id
    }, /*#__PURE__*/React.createElement("div", {
      className: "tk-acthead"
    }, /*#__PURE__*/React.createElement("span", {
      className: 'tk-actdot st-' + c.id
    }), c.label, /*#__PURE__*/React.createElement("span", {
      className: "tk-colcount"
    }, items.length, " \xB7 ", pts, "p")), items.map(t => /*#__PURE__*/React.createElement(TicketCard, {
      key: t.id,
      t: t,
      onOpen: onOpenTicket
    })));
  })), tab === 'active' && /*#__PURE__*/React.createElement("div", {
    className: "tk-cols tk-cols-3"
  }, ['progress', 'review', 'testing'].map(st => {
    const items = active.filter(t => t.status === st);
    const label = {
      progress: 'In Progress',
      review: 'Review',
      testing: 'Testing'
    }[st];
    return /*#__PURE__*/React.createElement("div", {
      className: "tk-actgroup",
      key: st
    }, /*#__PURE__*/React.createElement("div", {
      className: "tk-acthead"
    }, /*#__PURE__*/React.createElement("span", {
      className: 'tk-actdot st-' + st
    }), label, /*#__PURE__*/React.createElement("span", {
      className: "tk-colcount"
    }, items.length)), items.length ? items.map(t => /*#__PURE__*/React.createElement(TicketCard, {
      key: t.id,
      t: t,
      onOpen: onOpenTicket
    })) : /*#__PURE__*/React.createElement("div", {
      className: "tk-empty"
    }, "Nothing here"));
  })), tab === 'burndown' && /*#__PURE__*/React.createElement("div", {
    className: "tk-insights"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mc-row mc-row-4"
  }, /*#__PURE__*/React.createElement(MetricCard, {
    m: {
      label: 'My WIP',
      value: myWip + ' / 3',
      sub: 'In progress vs your limit',
      tier: myWip > 3 ? 'Low' : 'High'
    }
  }), /*#__PURE__*/React.createElement(MetricCard, {
    m: {
      label: 'Throughput',
      value: '12 pts',
      sub: 'Closed this week',
      delta: '↑ 2',
      good: true
    }
  }), /*#__PURE__*/React.createElement(MetricCard, {
    m: {
      label: 'Reviews requested',
      value: String(reviewReq),
      sub: 'Awaiting your review'
    }
  }), /*#__PURE__*/React.createElement(MetricCard, {
    m: {
      label: 'Avg cycle time',
      value: '61 h',
      sub: 'First commit → merge',
      delta: '↓ 12%',
      good: true
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "gitw-cols"
  }, /*#__PURE__*/React.createElement(ChartCard, {
    title: "Sprint burndown"
  }, /*#__PURE__*/React.createElement(BurndownChart, {
    ideal: B.ideal,
    actual: B.team
  }), /*#__PURE__*/React.createElement("div", {
    className: "bd-legend"
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    className: "bd-sw bd-ideal"
  }), "Ideal"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    className: "bd-sw bd-actual"
  }), "Remaining (", S.committed - S.done, " of ", S.committed, ")"))), /*#__PURE__*/React.createElement(ChartCard, {
    title: "My burndown"
  }, /*#__PURE__*/React.createElement(BurndownChart, {
    ideal: B.myIdeal,
    actual: B.mine,
    accent: "var(--syn-control)"
  }), /*#__PURE__*/React.createElement("div", {
    className: "bd-legend"
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    className: "bd-sw bd-ideal"
  }), "Ideal"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    className: "bd-sw bd-actual bd-mine"
  }), "Remaining (", myCommitted - myDone, " of ", myCommitted, ")")))), /*#__PURE__*/React.createElement("div", {
    className: "gitw-cols"
  }, /*#__PURE__*/React.createElement(ChartCard, {
    title: "My WIP over sprint"
  }, /*#__PURE__*/React.createElement(LineChart, {
    data: window.MY_WIP_SERIES,
    labels: ['d0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6'],
    height: 140
  }), /*#__PURE__*/React.createElement("div", {
    className: "bd-legend"
  }, /*#__PURE__*/React.createElement("span", {
    className: "tk-wiphint"
  }, "WIP limit 3 \u2014 keep flow steady, avoid context-switching"))), /*#__PURE__*/React.createElement(ChartCard, {
    title: "Team WIP"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wip-bars"
  }, window.TEAM_WIP.map(w => /*#__PURE__*/React.createElement("div", {
    className: "wip-row",
    key: w.who
  }, /*#__PURE__*/React.createElement("span", {
    className: "wip-who"
  }, w.who === 'you' ? 'you' : w.who), /*#__PURE__*/React.createElement("div", {
    className: "wip-track"
  }, /*#__PURE__*/React.createElement("div", {
    className: 'wip-fill' + (w.wip > w.limit ? ' over' : ''),
    style: {
      width: w.wip / w.limit * 100 + '%'
    }
  })), /*#__PURE__*/React.createElement("span", {
    className: "wip-val"
  }, w.wip, "/", w.limit)))))), /*#__PURE__*/React.createElement("div", {
    className: "gitw-cols"
  }, /*#__PURE__*/React.createElement(ChartCard, {
    title: "Reviews given / day"
  }, /*#__PURE__*/React.createElement(LineChart, {
    data: window.REVIEWS_GIVEN,
    labels: ['d0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6'],
    height: 140,
    color: "var(--warning)"
  })), /*#__PURE__*/React.createElement(ChartCard, {
    title: "Throughput (tickets closed / day)"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tp-bars"
  }, window.THROUGHPUT.map((v, i) => /*#__PURE__*/React.createElement("div", {
    className: "tp-col",
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    className: "tp-track"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tp-fill",
    style: {
      height: v / 3 * 100 + '%'
    }
  })), /*#__PURE__*/React.createElement("span", {
    className: "tp-day"
  }, "d", i))))), /*#__PURE__*/React.createElement(ChartCard, {
    title: "Work type split"
  }, /*#__PURE__*/React.createElement(Donut, {
    segments: window.TASK_TYPE_SPLIT,
    size: 130
  }))))));
}
Object.assign(window, {
  PRItem,
  PRList,
  PRPanel,
  GitDashboard,
  GitWorkspace,
  SearchPanel,
  StructurePanel,
  DataPanel,
  ContainerPanel,
  TaskPanel,
  TaskDashboard,
  TaskOverview,
  TicketDetail,
  DiffView,
  ChangesPanel,
  AwarenessRow,
  TeamTab
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/capisco-ide/views.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.EditorTab = __ds_scope.EditorTab;

__ds_ns.PermissionPrompt = __ds_scope.PermissionPrompt;

__ds_ns.ToolAction = __ds_scope.ToolAction;

__ds_ns.TreeRow = __ds_scope.TreeRow;

__ds_ns.GitMarker = __ds_scope.GitMarker;

__ds_ns.ModelBadge = __ds_scope.ModelBadge;

__ds_ns.StatusDot = __ds_scope.StatusDot;

})();
