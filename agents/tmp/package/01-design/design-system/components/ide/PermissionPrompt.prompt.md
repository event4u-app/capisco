Capisco's signature interaction — the capability broker. An agent requests a capability; the human grants scope or denies. Teal-outlined and calm, never alarmist.

```jsx
<PermissionPrompt
  command="Bash(rm -rf .worktrees/tmp)"
  label="Approval required"
  scopes={['Once', 'This session', 'Deny']}
  onGrant={(scope) => …}
/>
```

The first scope renders as `primary` (teal), the last as `ghost` (deny/cancel), the middle as `default`.
