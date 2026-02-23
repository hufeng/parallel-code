import { createSignal, For, Show, createEffect } from 'solid-js';
import { Dialog } from './Dialog';
import { saveAgents } from '../store/agents';
import { store } from '../store/core';
import { theme } from '../lib/theme';
import type { AgentDef } from '../ipc/types';

interface AgentsDialogProps {
  open: boolean;
  onClose: () => void;
}

interface AgentFormData {
  id: string;
  name: string;
  command: string;
  args: string;
  resume_args: string;
  skip_permissions_args: string;
  description: string;
  enabled: boolean;
  base_id: string;
}

function createEmptyForm(): AgentFormData {
  return {
    id: '',
    name: '',
    command: '',
    args: '',
    resume_args: '',
    skip_permissions_args: '',
    description: '',
    enabled: true,
    base_id: '',
  };
}

function formToAgentDef(form: AgentFormData): AgentDef {
  return {
    id: form.id || crypto.randomUUID(),
    name: form.name,
    command: form.command,
    args: form.args
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    resume_args: form.resume_args
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    skip_permissions_args: form.skip_permissions_args
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    description: form.description,
    base_id: form.base_id || undefined,
    enabled: form.enabled,
  };
}

function agentDefToForm(agent: AgentDef, enabled: boolean): AgentFormData {
  return {
    id: agent.id,
    name: agent.name,
    command: agent.command,
    args: agent.args.join(', '),
    resume_args: agent.resume_args?.join(', ') || '',
    skip_permissions_args: agent.skip_permissions_args?.join(', ') || '',
    description: agent.description,
    enabled,
    base_id: agent.base_id || '',
  };
}

export function AgentsDialog(props: AgentsDialogProps) {
  const [agents, setAgents] = createSignal<AgentFormData[]>([]);
  const [editingAgent, setEditingAgent] = createSignal<AgentFormData | null>(null);
  const [showForm, setShowForm] = createSignal(false);
  const [error, setError] = createSignal('');

  // Get base agents for "Based on" dropdown
  const baseAgents = () => agents();

  function handleBaseAgentChange(baseId: string) {
    if (!baseId) {
      // Clear inherited fields when "None" is selected
      setEditingAgent((prev) =>
        prev
          ? {
              ...prev,
              base_id: '',
              resume_args: '',
              skip_permissions_args: '',
              description: '',
            }
          : null,
      );
      return;
    }

    const baseAgent = agents().find((a) => a.id === baseId);
    if (baseAgent) {
      setEditingAgent((prev) =>
        prev
          ? {
              ...prev,
              base_id: baseId,
              resume_args: baseAgent.resume_args,
              skip_permissions_args: baseAgent.skip_permissions_args,
              description: baseAgent.description,
            }
          : null,
      );
    }
  }

  // Load agents when dialog opens
  createEffect(() => {
    if (props.open) {
      const loaded = store.availableAgents.map((a) => agentDefToForm(a, true));
      setAgents(loaded);
      setEditingAgent(null);
      setShowForm(false);
      setError('');
    }
  });

  function handleAdd() {
    setEditingAgent(createEmptyForm());
    setShowForm(true);
    setError('');
  }

  function handleEdit(agent: AgentFormData) {
    setEditingAgent({ ...agent });
    setShowForm(true);
    setError('');
  }

  function handleDelete(id: string) {
    setAgents((prev) => prev.filter((a) => a.id !== id));
  }

  function handleToggleEnabled(id: string) {
    setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)));
  }

  function handleSaveForm() {
    const form = editingAgent();
    if (!form) return;

    // Validation
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    if (!form.command.trim()) {
      setError('Command is required');
      return;
    }

    const agentDef = formToAgentDef(form);

    setAgents((prev) => {
      const existing = prev.find((a) => a.id === form.id);
      if (existing) {
        return prev.map((a) => (a.id === form.id ? { ...form } : a));
      }
      return [...prev, { ...form, id: agentDef.id }];
    });

    setShowForm(false);
    setEditingAgent(null);
    setError('');
  }

  function handleCancelForm() {
    setShowForm(false);
    setEditingAgent(null);
    setError('');
  }

  async function handleSaveAll() {
    try {
      const agentDefs = agents().map((a) => formToAgentDef(a));
      await saveAgents(agentDefs);
      props.onClose();
    } catch (err) {
      setError(String(err));
    }
  }

  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      width="600px"
      zIndex={1100}
      panelStyle={{ 'max-width': 'calc(100vw - 32px)', padding: '24px', gap: '18px' }}
    >
      <div
        style={{
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'space-between',
        }}
      >
        <div style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
          <h2
            style={{
              margin: '0',
              'font-size': '16px',
              color: theme.fg,
              'font-weight': '600',
            }}
          >
            Manage Agents
          </h2>
          <span style={{ 'font-size': '12px', color: theme.fgMuted }}>
            Add, edit, or remove AI agents
          </span>
        </div>
        <button
          onClick={() => props.onClose()}
          style={{
            background: 'transparent',
            border: 'none',
            color: theme.fgMuted,
            cursor: 'pointer',
            'font-size': '18px',
            padding: '0 4px',
            'line-height': '1',
          }}
        >
          &times;
        </button>
      </div>

      <Show when={error()}>
        <div
          style={{
            'font-size': '12px',
            color: theme.error,
            background: `color-mix(in srgb, ${theme.error} 8%, transparent)`,
            padding: '8px 12px',
            'border-radius': '8px',
            border: `1px solid color-mix(in srgb, ${theme.error} 20%, transparent)`,
          }}
        >
          {error()}
        </div>
      </Show>

      <Show when={!showForm()}>
        {/* Agent list */}
        <div
          style={{
            display: 'flex',
            'flex-direction': 'column',
            gap: '8px',
            'max-height': '300px',
            overflow: 'auto',
          }}
        >
          <Show when={agents().length === 0}>
            <div
              style={{
                padding: '24px',
                'text-align': 'center',
                color: theme.fgMuted,
                'font-size': '13px',
              }}
            >
              No agents configured. Click "Add Agent" to add one.
            </div>
          </Show>
          <For each={agents()}>
            {(agent) => (
              <div
                style={{
                  display: 'flex',
                  'align-items': 'center',
                  gap: '12px',
                  padding: '12px',
                  background: theme.bgInput,
                  border: `1px solid ${theme.border}`,
                  'border-radius': '8px',
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    'align-items': 'center',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={agent.enabled}
                    onChange={() => handleToggleEnabled(agent.id)}
                    style={{ 'accent-color': theme.accent, cursor: 'pointer' }}
                  />
                </label>
                <div style={{ flex: '1', 'min-width': '0' }}>
                  <div
                    style={{
                      'font-size': '13px',
                      color: theme.fg,
                      'font-weight': '500',
                    }}
                  >
                    {agent.name}
                  </div>
                  <div
                    style={{
                      'font-size': '11px',
                      color: theme.fgMuted,
                      'font-family': "'JetBrains Mono', monospace",
                      overflow: 'hidden',
                      'text-overflow': 'ellipsis',
                      'white-space': 'nowrap',
                    }}
                  >
                    {agent.command} {agent.args}
                  </div>
                  <Show when={agent.description}>
                    <div
                      style={{
                        'font-size': '11px',
                        color: theme.fgSubtle,
                        'margin-top': '2px',
                      }}
                    >
                      {agent.description}
                    </div>
                  </Show>
                </div>
                <button
                  type="button"
                  onClick={() => handleEdit(agent)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: theme.fgMuted,
                    cursor: 'pointer',
                    padding: '4px 8px',
                    'font-size': '12px',
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(agent.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: theme.error,
                    cursor: 'pointer',
                    padding: '4px 8px',
                    'font-size': '12px',
                  }}
                >
                  Delete
                </button>
              </div>
            )}
          </For>
        </div>

        <button
          type="button"
          onClick={handleAdd}
          style={{
            padding: '8px 16px',
            background: theme.bgInput,
            border: `1px solid ${theme.border}`,
            'border-radius': '8px',
            color: theme.fg,
            cursor: 'pointer',
            'font-size': '13px',
            width: 'fit-content',
          }}
        >
          + Add Agent
        </button>
      </Show>

      <Show when={showForm()}>
        {/* Agent form */}
        <div
          style={{
            display: 'flex',
            'flex-direction': 'column',
            gap: '16px',
          }}
        >
          {/* Based on dropdown - only show for new agents */}
          <Show when={!editingAgent()?.id}>
            <div style={{ display: 'flex', 'flex-direction': 'column', gap: '6px' }}>
              <label
                style={{
                  'font-size': '11px',
                  color: theme.fgMuted,
                  'text-transform': 'uppercase',
                  'letter-spacing': '0.05em',
                }}
              >
                Based on (optional)
              </label>
              <select
                value={editingAgent()?.base_id || ''}
                onChange={(e) => handleBaseAgentChange(e.currentTarget.value)}
                style={{
                  background: theme.bgInput,
                  border: `1px solid ${theme.border}`,
                  'border-radius': '8px',
                  padding: '10px 14px',
                  color: theme.fg,
                  'font-size': '13px',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="">None</option>
                <For each={baseAgents()}>
                  {(agent) => <option value={agent.id}>{agent.name}</option>}
                </For>
              </select>
            </div>
          </Show>

          <div style={{ display: 'flex', 'flex-direction': 'column', gap: '6px' }}>
            <label
              style={{
                'font-size': '11px',
                color: theme.fgMuted,
                'text-transform': 'uppercase',
                'letter-spacing': '0.05em',
              }}
            >
              Name *
            </label>
            <input
              class="input-field"
              type="text"
              value={editingAgent()?.name || ''}
              onInput={(e) =>
                setEditingAgent((prev) => (prev ? { ...prev, name: e.currentTarget.value } : null))
              }
              placeholder="Claude Code"
              style={{
                background: theme.bgInput,
                border: `1px solid ${theme.border}`,
                'border-radius': '8px',
                padding: '10px 14px',
                color: theme.fg,
                'font-size': '13px',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', 'flex-direction': 'column', gap: '6px' }}>
            <label
              style={{
                'font-size': '11px',
                color: theme.fgMuted,
                'text-transform': 'uppercase',
                'letter-spacing': '0.05em',
              }}
            >
              Command *
            </label>
            <input
              class="input-field"
              type="text"
              value={editingAgent()?.command || ''}
              onInput={(e) =>
                setEditingAgent((prev) =>
                  prev ? { ...prev, command: e.currentTarget.value } : null,
                )
              }
              placeholder="claude"
              style={{
                background: theme.bgInput,
                border: `1px solid ${theme.border}`,
                'border-radius': '8px',
                padding: '10px 14px',
                color: theme.fg,
                'font-size': '13px',
                'font-family': "'JetBrains Mono', monospace",
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', 'flex-direction': 'column', gap: '6px' }}>
            <label
              style={{
                'font-size': '11px',
                color: theme.fgMuted,
                'text-transform': 'uppercase',
                'letter-spacing': '0.05em',
              }}
            >
              Args (comma-separated)
            </label>
            <input
              class="input-field"
              type="text"
              value={editingAgent()?.args || ''}
              onInput={(e) =>
                setEditingAgent((prev) => (prev ? { ...prev, args: e.currentTarget.value } : null))
              }
              placeholder=""
              style={{
                background: theme.bgInput,
                border: `1px solid ${theme.border}`,
                'border-radius': '8px',
                padding: '10px 14px',
                color: theme.fg,
                'font-size': '13px',
                'font-family': "'JetBrains Mono', monospace",
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', 'flex-direction': 'column', gap: '6px' }}>
            <label
              style={{
                'font-size': '11px',
                color: theme.fgMuted,
                'text-transform': 'uppercase',
                'letter-spacing': '0.05em',
              }}
            >
              Resume Args (comma-separated)
            </label>
            <input
              class="input-field"
              type="text"
              value={editingAgent()?.resume_args || ''}
              onInput={(e) =>
                setEditingAgent((prev) =>
                  prev ? { ...prev, resume_args: e.currentTarget.value } : null,
                )
              }
              placeholder="--continue"
              style={{
                background: theme.bgInput,
                border: `1px solid ${theme.border}`,
                'border-radius': '8px',
                padding: '10px 14px',
                color: theme.fg,
                'font-size': '13px',
                'font-family': "'JetBrains Mono', monospace",
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', 'flex-direction': 'column', gap: '6px' }}>
            <label
              style={{
                'font-size': '11px',
                color: theme.fgMuted,
                'text-transform': 'uppercase',
                'letter-spacing': '0.05em',
              }}
            >
              Skip Permissions Args (comma-separated)
            </label>
            <input
              class="input-field"
              type="text"
              value={editingAgent()?.skip_permissions_args || ''}
              onInput={(e) =>
                setEditingAgent((prev) =>
                  prev ? { ...prev, skip_permissions_args: e.currentTarget.value } : null,
                )
              }
              placeholder="--dangerously-skip-permissions"
              style={{
                background: theme.bgInput,
                border: `1px solid ${theme.border}`,
                'border-radius': '8px',
                padding: '10px 14px',
                color: theme.fg,
                'font-size': '13px',
                'font-family': "'JetBrains Mono', monospace",
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', 'flex-direction': 'column', gap: '6px' }}>
            <label
              style={{
                'font-size': '11px',
                color: theme.fgMuted,
                'text-transform': 'uppercase',
                'letter-spacing': '0.05em',
              }}
            >
              Description
            </label>
            <input
              class="input-field"
              type="text"
              value={editingAgent()?.description || ''}
              onInput={(e) =>
                setEditingAgent((prev) =>
                  prev ? { ...prev, description: e.currentTarget.value } : null,
                )
              }
              placeholder="Anthropic's Claude Code CLI agent"
              style={{
                background: theme.bgInput,
                border: `1px solid ${theme.border}`,
                'border-radius': '8px',
                padding: '10px 14px',
                color: theme.fg,
                'font-size': '13px',
                outline: 'none',
              }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              gap: '8px',
              'justify-content': 'flex-end',
              'padding-top': '8px',
            }}
          >
            <button
              type="button"
              onClick={handleCancelForm}
              style={{
                padding: '9px 18px',
                background: theme.bgInput,
                border: `1px solid ${theme.border}`,
                'border-radius': '8px',
                color: theme.fgMuted,
                cursor: 'pointer',
                'font-size': '13px',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveForm}
              style={{
                padding: '9px 20px',
                background: theme.accent,
                border: 'none',
                'border-radius': '8px',
                color: theme.accentText,
                cursor: 'pointer',
                'font-size': '13px',
                'font-weight': '500',
              }}
            >
              {editingAgent()?.id ? 'Update' : 'Add'} Agent
            </button>
          </div>
        </div>
      </Show>

      <Show when={!showForm()}>
        <div
          style={{
            display: 'flex',
            gap: '8px',
            'justify-content': 'flex-end',
            'padding-top': '4px',
          }}
        >
          <button
            type="button"
            onClick={() => props.onClose()}
            style={{
              padding: '9px 18px',
              background: theme.bgInput,
              border: `1px solid ${theme.border}`,
              'border-radius': '8px',
              color: theme.fgMuted,
              cursor: 'pointer',
              'font-size': '13px',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveAll}
            style={{
              padding: '9px 20px',
              background: theme.accent,
              border: 'none',
              'border-radius': '8px',
              color: theme.accentText,
              cursor: 'pointer',
              'font-size': '13px',
              'font-weight': '500',
            }}
          >
            Save Changes
          </button>
        </div>
      </Show>
    </Dialog>
  );
}
