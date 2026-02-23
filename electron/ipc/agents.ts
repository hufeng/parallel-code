import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';

interface AgentDef {
  id: string;
  name: string;
  command: string;
  args: string[];
  resume_args: string[];
  skip_permissions_args: string[];
  description: string;
}

const DEFAULT_AGENTS: AgentDef[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    command: 'claude',
    args: [],
    resume_args: ['--continue'],
    skip_permissions_args: ['--dangerously-skip-permissions'],
    description: "Anthropic's Claude Code CLI",
  },
  {
    id: 'codex',
    name: 'Codex CLI',
    command: 'codex',
    args: [],
    resume_args: ['resume', '--last'],
    skip_permissions_args: ['--full-auto'],
    description: "OpenAI's Codex CLI",
  },
  {
    id: 'gemini',
    name: 'Gemini CLI',
    command: 'gemini',
    args: [],
    resume_args: ['--resume', 'latest'],
    skip_permissions_args: ['--yolo'],
    description: "Google's Gemini CLI",
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    command: 'opencode',
    args: [],
    resume_args: ['continue'],
    skip_permissions_args: ['--yes'],
    description: 'OpenCode CLI',
  },
];

function getConfigDir(): string {
  return path.join(os.homedir(), '.config', 'parallel-code');
}

function getAgentsPath(): string {
  return path.join(getConfigDir(), 'settings.json');
}

function loadAgentsFromFile(): AgentDef[] {
  const agentsPath = getAgentsPath();
  if (!fs.existsSync(agentsPath)) {
    // First run: write default agents to settings.json
    saveAgentsToFile(DEFAULT_AGENTS);
    return DEFAULT_AGENTS;
  }
  try {
    const content = fs.readFileSync(agentsPath, 'utf8');
    const parsed = JSON.parse(content);
    // Handle both formats: array or { agents: array }
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (parsed.agents && Array.isArray(parsed.agents)) {
      return parsed.agents;
    }
    return DEFAULT_AGENTS;
  } catch {
    return DEFAULT_AGENTS;
  }
}

function saveAgentsToFile(agents: AgentDef[]): void {
  const agentsPath = getAgentsPath();
  const dir = path.dirname(agentsPath);
  fs.mkdirSync(dir, { recursive: true });
  const data = { agents };
  fs.writeFileSync(agentsPath, JSON.stringify(data, null, 2), 'utf8');
}

export function listAgents(): AgentDef[] {
  return loadAgentsFromFile();
}

export function saveAgents(agents: AgentDef[]): void {
  saveAgentsToFile(agents);
}
