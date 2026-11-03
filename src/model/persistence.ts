import type { Project } from './types';

const INDEX_KEY = 'planta:index';
const LAST_KEY = 'planta:last';
const projKey = (id: string) => `planta:project:${id}`;

export interface ProjectMeta {
  id: string;
  name: string;
  updatedAt: number;
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
function safeRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function listProjects(): ProjectMeta[] {
  try {
    const raw = safeGet(INDEX_KEY);
    const list = raw ? (JSON.parse(raw) as ProjectMeta[]) : [];
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function saveProject(p: Project): boolean {
  const ok = safeSet(projKey(p.id), JSON.stringify(p));
  if (!ok) return false;
  const list = listProjects().filter((m) => m.id !== p.id);
  list.push({ id: p.id, name: p.name, updatedAt: p.updatedAt });
  safeSet(INDEX_KEY, JSON.stringify(list));
  safeSet(LAST_KEY, p.id);
  return true;
}

export function loadProject(id: string): Project | null {
  try {
    const raw = safeGet(projKey(id));
    if (!raw) return null;
    return validateProject(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function deleteProject(id: string) {
  safeRemove(projKey(id));
  safeSet(INDEX_KEY, JSON.stringify(listProjects().filter((m) => m.id !== id)));
}

export function lastProjectId(): string | null {
  return safeGet(LAST_KEY);
}

/** Validação mínima para arquivos importados. */
export function validateProject(data: unknown): Project {
  const p = data as Project;
  if (!p || typeof p !== 'object' || !Array.isArray(p.floors) || !p.floors.length) {
    throw new Error('Arquivo inválido: não parece um projeto do Planta.');
  }
  for (const f of p.floors) {
    f.walls ??= [];
    f.openings ??= [];
    f.rooms ??= [];
    f.furniture ??= [];
    f.dimensions ??= [];
    f.height ??= 280;
    f.elevation ??= 0;
  }
  p.settings = Object.assign({ gridCm: 10, snap: true, wallHeight: 280, wallThickness: 15 }, p.settings ?? {});
  p.name ||= 'Projeto importado';
  p.version = 1;
  return p;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function slug(s: string) {
  return (
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'projeto'
  );
}
