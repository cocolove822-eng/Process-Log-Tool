import React from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * 세 탭의 왼쪽 매니저(공정 분석 / 그래프 분석 / Log 분석)를 같은 모양으로 맞추는 공통 틀.
 * - 화면 왼쪽 끝에 붙은 전체 높이 패널 (카드 테두리·둥근 모서리 없음)
 * - 펼친 너비 250px, 접은 너비 56px
 * - 머리줄: 아이콘 + 제목(12px 굵게) + 접기 버튼
 */
export const MANAGER_WIDTH = 'w-[250px] min-w-[250px] max-w-[250px]';
export const MANAGER_COLLAPSED_WIDTH = 'w-[56px] min-w-[56px] max-w-[56px]';
export const MANAGER_ASIDE_CLASS =
  'h-[calc(100vh-60px)] sticky top-[57px] flex flex-col bg-[#E6EBF1] border-r border-slate-400 transition-all duration-200 shrink-0 z-20 relative';

/** 매니저 머리줄 (공정 분석 매니저와 같은 모양) */
export const ManagerHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
  right?: React.ReactNode;
  collapsed: boolean;
  onToggleCollapse: () => void;
}> = ({ icon, title, badge, right, collapsed, onToggleCollapse }) => (
  <div className="h-[45px] px-2 border-b border-slate-300 bg-[#E2E8F0] flex items-center justify-between gap-1 shrink-0">
    {!collapsed && (
      <div className="flex items-center gap-1.5 min-w-0">
        <div className="w-6 h-6 rounded-lg bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center shrink-0">
          {icon}
        </div>
        <span className="text-xs font-bold text-[#0F172A] tracking-tight whitespace-nowrap truncate">{title}</span>
        {badge}
      </div>
    )}
    {!collapsed && right}
    <button
      type="button"
      onClick={onToggleCollapse}
      className={`p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100 transition-colors cursor-pointer shrink-0 ${collapsed ? 'mx-auto' : ''}`}
      title={collapsed ? '매니저 펼치기' : '매니저 접기'}
      aria-label={collapsed ? '매니저 펼치기' : '매니저 접기'}
    >
      {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
    </button>
  </div>
);

/** 섹션 제목 (세 매니저 공통: 10.5px 굵게) */
export const ManagerSectionTitle: React.FC<{ children: React.ReactNode; right?: React.ReactNode }> = ({ children, right }) => (
  <div className="flex items-center justify-between gap-1 min-h-[16px]">
    <span className="text-[10.5px] font-bold text-[#334155] whitespace-nowrap truncate">{children}</span>
    {right}
  </div>
);

/**
 * 그래프 분석 / Log 분석 매니저: App이 만든 왼쪽 자리(host)에 패널을 그림.
 * host가 아직 없으면(첫 렌더) 아무것도 그리지 않음.
 */
export const ManagerPortal: React.FC<{
  host: HTMLElement | null;
  collapsed: boolean;
  dataAttr: string;
  header: React.ReactNode;
  children: React.ReactNode;
  collapsedBody?: React.ReactNode;
}> = ({ host, collapsed, dataAttr, header, children, collapsedBody }) => {
  if (!host) return null;
  return createPortal(
    <aside
      {...{ [dataAttr]: '' }}
      className={`${MANAGER_ASIDE_CLASS} ${collapsed ? MANAGER_COLLAPSED_WIDTH : MANAGER_WIDTH}`}
    >
      {header}
      {collapsed ? collapsedBody ?? null : children}
    </aside>,
    host,
  );
};
