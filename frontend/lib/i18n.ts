export type Locale = 'es' | 'en' | 'pt'

export const localeLabels: Record<Locale, string> = { es: 'Español', en: 'English', pt: 'Português' }

const translations = {
  es: { summary: 'Resumen', runs: 'Runs', fleet: 'Flota', calendar: 'Calendario', issues: 'Incidencias', map: 'Mapa', analytics: 'Analíticas', news: 'Noticias', settings: 'Ajustes', help: 'Ayuda', chat: 'Chat', operations: 'Operaciones', workspace: 'Workspace', goodMorning: 'Buenos días, Alex', search: 'Buscar runs, rutas...', chatTeam: 'Chat del equipo', dateLocale: 'es-MX', activeRuns: 'Runs activos', eta: 'ETA medio', costKm: 'Coste / km', networkHealth: 'Salud de la red', excellent: 'Excelente', review: 'Revisar decisiones', allControl: 'Todo bajo control.' },
  en: { summary: 'Overview', runs: 'Runs', fleet: 'Fleet', calendar: 'Calendar', issues: 'Issues', map: 'Map', analytics: 'Analytics', news: 'News', settings: 'Settings', help: 'Help', chat: 'Chat', operations: 'Operations', workspace: 'Workspace', goodMorning: 'Good morning, Alex', search: 'Search runs, routes...', chatTeam: 'Team chat', dateLocale: 'en-US', activeRuns: 'Active runs', eta: 'Average ETA', costKm: 'Cost / km', networkHealth: 'Network health', excellent: 'Excellent', review: 'Review decisions', allControl: 'Everything under control.' },
  pt: { summary: 'Resumo', runs: 'Runs', fleet: 'Frota', calendar: 'Calendário', issues: 'Incidentes', map: 'Mapa', analytics: 'Análises', news: 'Notícias', settings: 'Configurações', help: 'Ajuda', chat: 'Chat', operations: 'Operações', workspace: 'Workspace', goodMorning: 'Bom dia, Alex', search: 'Buscar runs, rotas...', chatTeam: 'Chat da equipe', dateLocale: 'pt-BR', activeRuns: 'Runs ativos', eta: 'ETA médio', costKm: 'Custo / km', networkHealth: 'Saúde da rede', excellent: 'Excelente', review: 'Revisar decisões', allControl: 'Tudo sob controle.' },
} as const

export type TranslationKey = keyof typeof translations.es
export function getTranslations(locale: Locale) { return translations[locale] }
