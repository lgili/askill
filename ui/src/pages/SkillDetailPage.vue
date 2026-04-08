<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { useSkillexStore } from "../store";

const route  = useRoute();
const store  = useSkillexStore();

const skillId = computed(() => (typeof route.params.skillId === "string" ? route.params.skillId : ""));
const detail  = computed(() => store.state.detail);

async function loadCurrentSkill() {
  if (!skillId.value) return;
  await store.loadSkillDetail(skillId.value);
}

watch(skillId, () => void loadCurrentSkill());
onMounted(() => void loadCurrentSkill());
</script>

<template>
  <section class="page-column">

    <!-- Hero panel -->
    <div class="panel">
      <div class="detail-topbar">
        <button class="button button-ghost" type="button" @click="store.navigateHome()">
          <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
          Catalog
        </button>
        <p class="section-label">Skill detail</p>
      </div>

      <div v-if="detail" class="detail-hero">
        <div>
          <p class="eyebrow">Skill</p>
          <h2>{{ detail.skill.name }}</h2>
          <p class="detail-description">{{ detail.skill.description }}</p>
        </div>
        <div class="detail-actions">
          <button class="button button-secondary" type="button" @click="store.updateSkill(detail.skill.id)">
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Update
          </button>
          <button class="button button-ghost" type="button" @click="store.syncNow()">Sync</button>
          <button
            v-if="!detail.skill.installed"
            class="button button-primary"
            type="button"
            @click="store.installSkill(detail.skill)"
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Instalar
          </button>
          <button
            v-else
            class="button button-danger"
            type="button"
            @click="store.removeSkill(detail.skill.id)"
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
            Remover
          </button>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="store.state.detailLoading" class="empty-state panel">
      <div style="width:28px;height:28px;border-radius:50%;border:2px solid rgba(16,185,129,0.15);border-top-color:var(--accent);animation:spin 700ms linear infinite;"></div>
      <strong>Carregando detalhes...</strong>
    </div>

    <template v-else-if="detail">

      <!-- Metadata grid -->
      <div class="panel">
        <div class="detail-metadata-grid">
          <article class="metadata-card">
            <span>Skill ID</span>
            <strong style="font-family:monospace;font-size:0.82rem;">{{ detail.skill.id }}</strong>
          </article>
          <article class="metadata-card">
            <span>Source</span>
            <strong>{{ detail.skill.source.label || detail.skill.source.repo }}</strong>
          </article>
          <article class="metadata-card">
            <span>Version</span>
            <strong style="font-family:monospace;">v{{ detail.skill.version }}</strong>
          </article>
          <article class="metadata-card">
            <span>Installed</span>
            <strong :style="detail.skill.installed ? 'color:var(--accent)' : 'color:var(--text-muted)'">
              {{ detail.skill.installed ? "✓ Yes" : "No" }}
            </strong>
          </article>
        </div>

        <!-- Tags + compat -->
        <div class="detail-chip-sections">
          <div>
            <p class="section-label" style="margin:0 0 8px;display:block;">Tags</p>
            <div class="chip-row">
              <span v-for="tag in detail.skill.tags" :key="tag" class="chip">{{ tag }}</span>
              <span v-if="detail.skill.tags.length === 0" style="font-size:0.8rem;color:var(--text-dim)">—</span>
            </div>
          </div>
          <div>
            <p class="section-label" style="margin:0 0 8px;display:block;">Compatibility</p>
            <div class="chip-row">
              <span v-for="adapter in detail.skill.compatibility" :key="adapter" class="chip chip-accent">
                {{ adapter }}
              </span>
              <span v-if="detail.skill.compatibility.length === 0" style="font-size:0.8rem;color:var(--text-dim)">—</span>
            </div>
          </div>
        </div>
      </div>

      <!-- SKILL.md -->
      <div class="panel">
        <div class="panel-head">
          <div class="panel-head-title">
            <p class="eyebrow">Instructions</p>
            <h2>SKILL.md</h2>
            <p>Content rendered by the backend.</p>
          </div>
        </div>

        <div v-if="detail.instructionsError" class="error-card" style="margin:0 20px 20px;">
          <strong>Instructions unavailable</strong>
          <p>{{ detail.instructionsError }}</p>
        </div>

        <article v-else class="markdown-body" v-html="detail.instructionsHtml"></article>
      </div>

    </template>

  </section>
</template>
