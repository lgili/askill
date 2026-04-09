<script setup lang="ts">
import { computed, ref } from "vue";
import SkillCard from "../components/SkillCard.vue";
import { useSkillexStore } from "../store";

const store = useSkillexStore();
const selectedCategory = ref("all");

const CATEGORIES = [
  { id: "all",         name: "Todas",       icon: "✦" },
  { id: "code",        name: "Code",        icon: "💻" },
  { id: "engineering", name: "Engineering", icon: "⚡" },
  { id: "workflow",    name: "Workflow",    icon: "🌿" },
  { id: "testing",     name: "Testing",     icon: "🧪" },
  { id: "security",    name: "Security",    icon: "🛡️" },
  { id: "devops",      name: "DevOps",      icon: "🐳" },
  { id: "research",    name: "Research",    icon: "🔍" },
  { id: "tools",       name: "Tools",       icon: "🔧" },
];

function inferCategory(id: string, tags: string[]): string {
  const all = [id, ...tags].map(s => s.toLowerCase()).join(" ");
  // Research: Wikipedia, ArXiv, PubMed, web search, web scraping
  if (/wikipedia|arxiv|pubmed|ncbi|duckduckgo|web-search|web-scraper|research-wikipedia|research-arxiv|research-pubmed/.test(all)) return "research";
  // Engineering: power electronics, circuits, numerical solvers, waveform analysis, schematics
  if (/simulation|mna|z-domain|magnetics|mosfet|igbt|waveform|fft|thd|newton-raphson|psim|schematic|netlist|altium|datasheet|curve-digitization|semiconductor/.test(all)) return "engineering";
  // Code: programming languages and code-quality skills
  if (/typescript|python|cpp-pro|c-pro|code-review|error-handling/.test(all)) return "code";
  if (/git|commit|workflow|branch/.test(all)) return "workflow";
  if (/test|jest|tdd|vitest|spec/.test(all))  return "testing";
  if (/security|owasp|audit|guard/.test(all)) return "security";
  if (/docker|devops|ci|cd|helm/.test(all))   return "devops";
  if (/pdf|extraction|document|scraper|tool|docs|web/.test(all)) return "tools";
  return "other";
}

function categoryCount(catId: string): number {
  if (catId === "all") return store.state.catalog?.skills.length ?? 0;
  return (store.state.catalog?.skills ?? []).filter(s => inferCategory(s.id, s.tags) === catId).length;
}

const visibleSkills = computed(() => {
  const base = store.filteredSkills.value;
  if (selectedCategory.value === "all") return base;
  return base.filter(s => inferCategory(s.id, s.tags) === selectedCategory.value);
});
</script>

<template>
  <section class="page-column">

    <!-- Hero panel -->
    <div class="panel">
      <div class="panel-head">
        <div class="panel-head-title">
          <p class="eyebrow">Discovery</p>
          <h2>Marketplace</h2>
          <p>Habilidades validadas para o seu agente de IA.</p>
        </div>
      </div>

      <!-- Stats row -->
      <div class="catalog-overview">
        <article class="overview-card">
          <span>Visible</span>
          <strong>{{ visibleSkills.length }}</strong>
        </article>
        <article class="overview-card">
          <span>Sources</span>
          <strong>{{ store.state.catalog?.sources.length ?? 0 }}</strong>
        </article>
        <article class="overview-card">
          <span>Instaladas</span>
          <strong>{{ store.state.dashboard?.installed.length ?? 0 }}</strong>
        </article>
      </div>

      <!-- Category pills -->
      <div class="category-pills">
        <button
          v-for="cat in CATEGORIES"
          :key="cat.id"
          class="category-pill"
          :class="{ active: selectedCategory === cat.id }"
          type="button"
          @click="selectedCategory = cat.id"
        >
          <span>{{ cat.icon }}</span>
          {{ cat.name }}
          <span v-if="cat.id !== 'all'" class="category-pill-count">
            {{ categoryCount(cat.id) }}
          </span>
        </button>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="visibleSkills.length === 0" class="empty-state">
      <svg width="40" height="40" fill="none" stroke="currentColor" viewBox="0 0 24 24"
           style="color:var(--text-dim);margin-bottom:4px;">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
      </svg>
      <strong>Nenhuma skill encontrada</strong>
      <p>Tente outro filtro ou adicione uma source na sidebar.</p>
    </div>

    <!-- Grid -->
    <div v-else class="catalog-grid">
      <SkillCard
        v-for="skill in visibleSkills"
        :key="skill.id"
        :skill="skill"
        :on-open="store.navigateToSkill"
        :on-install="store.installSkill"
        :on-remove="store.removeSkill"
      />
    </div>

  </section>
</template>
