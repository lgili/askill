<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useSkillexStore } from "./store";

const store = useSkillexStore();
const route = useRoute();

const sourceRepo  = ref("");
const sourceRef   = ref("");
const sourceLabel = ref("");

const dashboard         = computed(() => store.state.dashboard);
const catalog           = computed(() => store.state.catalog);
const recentSyncTargets = computed(() => store.recentSyncTargets.value);

const ADAPTERS = [
  { value: "claude",   label: "Claude",   icon: "🤖" },
  { value: "cursor",   label: "Cursor",   icon: "⚡" },
  { value: "copilot",  label: "Copilot",  icon: "🐙" },
  { value: "cline",    label: "Cline",    icon: "🔵" },
  { value: "codex",    label: "Codex",    icon: "🧠" },
  { value: "gemini",   label: "Gemini",   icon: "✨" },
  { value: "windsurf", label: "Windsurf", icon: "🏄" },
];

const activeAdapterInfo = computed(() => {
  const id = store.state.syncAdapter;
  return ADAPTERS.find(a => a.value === id) ?? { value: id, label: id || "Auto", icon: "🔧" };
});

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

async function handleAddSource() {
  const repo = sourceRepo.value.trim();
  if (!repo) return;
  await store.addSource({
    repo,
    ref: sourceRef.value.trim() || undefined,
    label: sourceLabel.value.trim() || undefined,
  });
  sourceRepo.value  = "";
  sourceRef.value   = "";
  sourceLabel.value = "";
}

watch(
  () => route.query.scope,
  (value) => {
    if (value === "global" || value === "local") void store.setScope(value);
  },
);

onMounted(async () => {
  const routeSkillId = typeof route.params.skillId === "string" ? route.params.skillId : null;
  await store.initialize(routeSkillId);
});
</script>

<template>
  <div class="app-shell">

    <!-- decorative background -->
    <div class="shell-background">
      <div class="shell-glow shell-glow-left"></div>
      <div class="shell-glow shell-glow-right"></div>
      <div class="shell-grid"></div>
    </div>

    <!-- ── Sidebar ─────────────────────────────────────────────────────── -->
    <aside class="sidebar">
      <!-- Logo -->
      <div class="sidebar-logo">
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
        </svg>
        skillex<span class="accent-dot">.</span>
      </div>

      <!-- Nav -->
      <nav class="sidebar-nav">
        <p class="nav-section-label">Explorar</p>

        <button class="nav-btn" :class="{ active: $route.name === 'catalog' }"
                type="button" @click="store.navigateHome()">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          Marketplace
        </button>

        <button class="nav-btn" type="button"
                :class="{ active: false }"
                @click="store.navigateHome()">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
          Instaladas
          <span v-if="(dashboard?.installed.length ?? 0) > 0" class="nav-badge">
            {{ dashboard?.installed.length }}
          </span>
        </button>

        <p class="nav-section-label">Workspace</p>

        <p class="nav-section-label" style="font-size:9px;margin-top:8px;margin-bottom:4px;color:var(--text-dim)">
          Adapters detectados
        </p>
        <div style="padding: 0 10px 8px; display:flex; flex-wrap:wrap; gap:5px;">
          <span v-for="a in (dashboard?.adapters.detected ?? [])" :key="a" class="chip chip-accent" style="height:22px;font-size:10px;">
            {{ a }}
          </span>
          <span v-if="(dashboard?.adapters.detected.length ?? 0) === 0"
                style="font-size:11px;color:var(--text-dim);padding:2px 0">
            Nenhum
          </span>
        </div>

        <p class="nav-section-label" style="font-size:9px;margin-bottom:4px;color:var(--text-dim)">
          Sources ({{ dashboard?.sources.length ?? 0 }})
        </p>

        <!-- inline source add -->
        <form style="padding:0 10px 8px;display:grid;gap:5px;" @submit.prevent="handleAddSource">
          <input v-model="sourceRepo" type="text" placeholder="owner/repo"
                 style="width:100%;padding:6px 8px;border:1px solid rgba(63,63,70,0.5);border-radius:8px;background:rgba(9,9,11,0.6);color:#f4f4f5;font-size:11px;outline:none;" />
          <button class="button button-primary" type="submit"
                  style="min-height:28px;padding:0 10px;font-size:11px;width:100%;">
            + Add source
          </button>
        </form>

        <div style="padding:0 10px 8px;display:grid;gap:4px;">
          <div v-for="src in (dashboard?.sources ?? [])" :key="src.repo"
               style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;border-radius:8px;background:rgba(39,39,42,0.4);border:1px solid rgba(63,63,70,0.3);">
            <div>
              <p style="margin:0;font-size:11px;font-weight:600;color:var(--text)">{{ src.label || src.repo }}</p>
              <p style="margin:2px 0 0;font-size:10px;color:var(--text-dim);font-family:monospace;">@{{ src.ref }}</p>
            </div>
            <button type="button" @click="store.removeSource(src.repo)"
                    style="padding:3px 6px;font-size:10px;border:1px solid rgba(248,113,113,0.2);border-radius:6px;background:transparent;color:var(--danger);cursor:pointer;">
              ×
            </button>
          </div>
          <p v-if="(dashboard?.sources.length ?? 0) === 0"
             style="font-size:11px;color:var(--text-dim);padding:2px 0">
            No sources.
          </p>
        </div>

        <!-- sync history -->
        <p class="nav-section-label" style="font-size:9px;margin-bottom:4px;color:var(--text-dim)">Sync history</p>
        <div style="padding:0 10px 8px;display:grid;gap:4px;">
          <div v-for="sync in recentSyncTargets.slice(0,3)" :key="`${sync.adapter}-${sync.syncedAt}`"
               style="padding:6px 8px;border-radius:8px;background:rgba(39,39,42,0.4);border:1px solid rgba(63,63,70,0.3);">
            <div style="display:flex;justify-content:space-between;gap:6px;">
              <span style="font-size:11px;font-weight:600;color:var(--text)">{{ sync.adapter }}</span>
              <span style="font-size:10px;color:var(--text-dim)">{{ formatDate(sync.syncedAt) }}</span>
            </div>
            <p style="margin:2px 0 0;font-size:10px;color:var(--text-dim);font-family:monospace;word-break:break-all;">
              {{ sync.targetPath }}
            </p>
          </div>
          <p v-if="recentSyncTargets.length === 0"
             style="font-size:11px;color:var(--text-dim);padding:2px 0">
            Nenhum sync ainda.
          </p>
        </div>
      </nav>

      <!-- Footer — active adapter -->
      <div class="sidebar-footer">
        <div class="adapter-badge">
          <span class="adapter-badge-icon">{{ activeAdapterInfo.icon }}</span>
          <div class="adapter-badge-info">
            <p class="adapter-badge-label">Agente ativo</p>
            <p class="adapter-badge-name">{{ activeAdapterInfo.label }}</p>
          </div>
          <span class="adapter-badge-dot"></span>
        </div>
        <div class="sidebar-meta">
          <span style="font-family:monospace">v{{ catalog?.formatVersion ? `0.2.4` : `0.2.4` }}</span>
          <span>{{ store.state.scope }}</span>
        </div>
      </div>
    </aside>

    <!-- ── Main column ──────────────────────────────────────────────────── -->
    <div class="main-col">

      <!-- Topbar -->
      <header class="topbar">
        <!-- Search -->
        <div class="search-shell">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input
            :value="store.state.searchQuery"
            type="search"
            placeholder="Buscar skills..."
            @input="store.setSearchQuery(($event.target as HTMLInputElement).value)"
          />
          <span class="search-kbd">⌘K</span>
        </div>

        <!-- Scope toggle -->
        <div class="toggle-group">
          <button class="toggle-btn" :class="{ active: store.state.scope === 'local' }"
                  type="button" @click="store.setScope('local')">
            📁 Local
          </button>
          <button class="toggle-btn" :class="{ active: store.state.scope === 'global' }"
                  type="button" @click="store.setScope('global')">
            🌍 Global
          </button>
        </div>

        <div class="topbar-divider"></div>

        <!-- Adapter toggle -->
        <div class="toggle-group">
          <button
            v-for="a in ADAPTERS"
            :key="a.value"
            class="adapter-toggle-btn"
            :class="{ active: store.state.syncAdapter === a.value }"
            :title="a.label"
            type="button"
            @click="store.setSyncAdapter(a.value)"
          >
            {{ a.icon }}
          </button>
        </div>

        <div class="topbar-divider"></div>

        <!-- Actions -->
        <div class="topbar-actions">
          <button class="button button-ghost" type="button" @click="store.refreshAll()">
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Refresh
          </button>
          <button class="button button-secondary" type="button" @click="store.updateSkill()">
            Update
          </button>
          <button class="button button-primary" type="button" @click="store.syncNow()">
            Sync now
          </button>
        </div>
      </header>

      <!-- Notice banner -->
      <div v-if="store.state.notice" class="status-banner" :data-tone="store.state.notice.tone">
        {{ store.state.notice.message }}
      </div>

      <!-- Page content -->
      <div class="workspace-layout">
        <RouterView />
      </div>
    </div>

    <!-- Toast -->
    <transition name="toast">
      <div v-if="store.state.toast.visible" class="toast" :data-tone="store.state.toast.tone">
        <div class="toast-content">
          <div class="toast-icon">
            <svg v-if="store.state.toast.tone === 'success'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <svg v-else fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div class="toast-text">
            <strong>{{ store.state.toast.tone === "error" ? "Error" : "Done" }}</strong>
            <span>{{ store.state.toast.message }}</span>
          </div>
        </div>
        <div class="toast-bar"></div>
      </div>
    </transition>

    <!-- Busy overlay -->
    <div v-if="store.state.busyLabel" class="busy-overlay">
      <div class="busy-card">
        <div class="busy-spinner"></div>
        <strong>{{ store.state.busyLabel }}</strong>
        <span>Aguarde...</span>
      </div>
    </div>

  </div>
</template>
