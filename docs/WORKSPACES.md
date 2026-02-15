# Workspaces and X-Workspace-Id

## Overview

HyperShift is multi-tenant: all runs, usage, and audit logs are scoped by **workspace**. The orchestrator identifies the workspace from the **`X-Workspace-Id`** HTTP header (or `X-Org-Id`). If no header is sent, the default workspace `ws-default` is used.

## How workspaces are created

- **Dashboard signup:** When a user signs up, the dashboard calls the orchestrator `POST /workspaces` with a name (e.g. "My Workspace"). The orchestrator creates a new workspace and returns its `id`. The dashboard stores this id in its own database and associates the user with that workspace (as admin). All subsequent API calls from the dashboard send `X-Workspace-Id: <id>` and `X-User-Id: <email>` so runs and usage are scoped correctly.
- **CLI / API:** When using the REST API or CLI, set the header explicitly:
  - `X-Workspace-Id: ws-xxx` (or `X-Org-Id`)
  - Optionally `X-User-Id` or `X-Actor` for audit.

## Mapping

| Source                    | Workspace id source                                   |
| ------------------------- | ----------------------------------------------------- |
| Dashboard (logged in)     | Session: user’s current workspace id                  |
| Dashboard (not logged in) | N/A (user must log in)                                |
| CLI                       | Env `HYPERSHIFT_WORKSPACE_ID` or default `ws-default` |
| REST API                  | Request header `X-Workspace-Id` or `X-Org-Id`         |

The **workspace id** is the same id used in the orchestrator store (and in the dashboard’s Workspace table). One workspace has one id; usage limits (free/pro) and run counts are per workspace.
