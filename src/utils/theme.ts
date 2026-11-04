import techImg from '../assets/images/toss_tech_slate_1791946093123.jpg';

export type TossThemeMode = 'tech';

export interface ThemeConfig {
  id: TossThemeMode;
  name: string;
  shortName: string;
  badge: string;
  desc: string;
  previewImg: string;

  // App & Layout
  appBg: string;
  appText: string;
  appMutedText: string;

  // Header & TopNav
  navBg: string;
  navBorder: string;
  navTabActive: string;
  navTabInactive: string;
  navPillBg: string;
  navPillBorder: string;

  // Cards & Panels
  cardBg: string;
  cardBorder: string;
  cardRadius: string;
  cardShadow: string;
  cardHeaderBg: string;
  cardHeaderBorder: string;
  cardTitleColor: string;
  cardSubtitleColor: string;

  // Data Tables
  tableBorder: string;
  tableHeaderBg: string;
  tableHeaderTextColor: string;
  tableHeaderSubBg: string;
  tableHeaderSubTextColor: string;
  tableRowBg: string;
  tableRowAltBg: string;
  tableRowHover: string;
  tableCellTextColor: string;
  tableCellBorder: string;
  subRowBg: string;
  subRowBorder: string;
  subRowBadge: string;

  // Accents & Buttons
  accentColor: string;
  btnPrimary: string;
  btnSecondary: string;

  // Status Badges
  badgeOk: string;
  badgeWarn: string;
  badgeInfo: string;

  // Gantt Chart
  ganttContainerBg: string;
  ganttHeaderBg: string;
  ganttTrackBg: string;
  ganttGridBorder: string;
  ganttTextColor: string;
}

export const THEME_CONFIGS: Record<TossThemeMode, ThemeConfig> = {
  tech: {
    id: 'tech',
    name: '토스 테크 슬레이트',
    shortName: '테크 슬레이트',
    badge: '고밀도 · Tech Slate',
    desc: '반도체 공정 엔지니어링 실무에 최적화된 고밀도 쿨그레이 그리드와 컴팩트 데이터 레이아웃',
    previewImg: techImg,

    // Tier 1: App Base Layer - Distinct Cool Slate background for clear visual separation
    appBg: 'bg-[#E2E8F0]', // Tailwind slate-200: solid contrast behind pure white cards
    appText: 'text-[#0F172A]',
    appMutedText: 'text-[#475569]',

    // Header & TopNav
    navBg: 'bg-[#F1F5F9]',
    navBorder: 'border-slate-300',
    navTabActive: 'bg-[#2563EB] text-white font-bold shadow-xs',
    navTabInactive: 'text-[#475569] hover:text-[#0F172A] hover:bg-slate-200/80',
    navPillBg: 'bg-[#E2E8F0]',
    navPillBorder: 'border-slate-300',

    // Tier 2: Card Containers - Low-glare soft slate container with distinct border
    cardBg: 'bg-[#F8FAFC]',
    cardBorder: 'border-slate-400',
    cardRadius: 'rounded-2xl',
    cardShadow: 'shadow-xs border border-slate-400',
    cardHeaderBg: 'bg-[#E2E8F0]',
    cardHeaderBorder: 'border-slate-300',
    cardTitleColor: 'text-[#0F172A]',
    cardSubtitleColor: 'text-[#475569]',

    // Tier 3: Data Tables - Crisp slate-400 cell boundaries, distinct headers, and visible zebra shading
    tableBorder: 'border-slate-400',
    tableHeaderBg: 'bg-[#0F172A]',
    tableHeaderTextColor: 'text-white',
    tableHeaderSubBg: 'bg-[#1E293B]',
    tableHeaderSubTextColor: 'text-slate-200',
    tableRowBg: 'bg-white',
    tableRowAltBg: 'bg-[#EDF2F7]',
    tableRowHover: 'hover:bg-blue-50/80',
    tableCellTextColor: 'text-[#0F172A]',
    tableCellBorder: 'border-slate-400',
    subRowBg: 'bg-[#E2E8F0]',
    subRowBorder: 'border-slate-400',
    subRowBadge: 'bg-slate-200 text-slate-800 border border-slate-400 font-mono font-medium',

    accentColor: '#2563EB',
    btnPrimary: 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-xs',
    btnSecondary: 'bg-white hover:bg-[#F1F5F9] text-[#1E293B] border border-slate-400',

    badgeOk: 'bg-[#D1FAE5] text-[#065F46] border border-[#34D399]',
    badgeWarn: 'bg-[#FEE2E2] text-[#991B1B] border border-[#F87171]',
    badgeInfo: 'bg-[#E0F2FE] text-[#075985] border border-[#38BDF8]',

    ganttContainerBg: 'bg-[#F8FAFC]',
    ganttHeaderBg: 'bg-[#E2E8F0]',
    ganttTrackBg: 'bg-[#DDE3EA]',
    ganttGridBorder: 'border-slate-400',
    ganttTextColor: 'text-[#1E293B]',
  },
};
