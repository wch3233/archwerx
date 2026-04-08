// RETROFIT: Node 4

function exportMarkdown(blueprint) {
  const lines = [];
  lines.push(`# ArchWerx Blueprint — ${blueprint.description || 'Untitled'}`);
  lines.push(`**ID:** ${blueprint.id}`);
  lines.push(`**Date:** ${blueprint.updatedAt || new Date().toISOString()}`);
  lines.push('');

  for (const entry of blueprint.architectHistory || []) {
    if (entry.type === 'architect_layer') {
      lines.push('---');
      lines.push('');
      lines.push(entry.content || '');
      lines.push('');
    } else if (entry.type === 'critic_review') {
      lines.push('---');
      lines.push('');
      lines.push(`### Critic Review — ${entry.label || entry.criticId}`);
      lines.push('');
      lines.push(entry.content || '');
      lines.push('');
    }
  }

  return lines.join('\n');
}

function downloadFile(filename, content) {
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function BlueprintExport({ blueprint }) {
  if (!blueprint) return null;

  function handleExport() {
    const md = exportMarkdown(blueprint);
    const title = (blueprint.description || 'untitled')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 40);
    const date = new Date().toISOString().slice(0, 10);
    downloadFile(`archwerx-${title}-${date}.md`, md);
  }

  return (
    <button
      onClick={handleExport}
      className="px-4 py-2 rounded-md bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm font-medium transition-colors cursor-pointer flex items-center gap-2"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
      </svg>
      Export Markdown
    </button>
  );
}
