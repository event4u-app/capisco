import { PermissionPrompt } from "./permission-prompt";

export const Default = () => (
  <div className="max-w-sm">
    <PermissionPrompt command="Bash(rm -rf .worktrees/tmp)" />
  </div>
);

export const ReadScope = () => (
  <div className="max-w-sm">
    <PermissionPrompt
      command="Read(src/core/**, *.ts)"
      scopes={["Once", "This session", "Deny"]}
    />
  </div>
);

export const WithCredentialReference = () => (
  <div className="max-w-sm">
    <PermissionPrompt
      command="Query(staging-db, SELECT …)"
      scopes={["Once", "This session", "Deny"]}
      credentialRef="staging-admin"
      credentialNote="Secret shown as a reference, never its value."
      prodNote="Production datasources are read-only — per-command approval only, no “allow permanently”."
    />
  </div>
);
