import React, { useState } from 'react';
import { BookOpen, ChevronRight, Sliders } from 'lucide-react';

interface SidebarGuidePanelProps {
  onOpenSettings?: () => void;
}

interface GuideSection {
  id: string;
  dot: string;
  title: string;
  summary: string;
  body: React.ReactNode;
}

/** 펼친 내용 안의 소제목 + 설명 한 덩어리 */
const Item: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-0.5">
    <div className="text-[10.5px] font-bold text-[#0F172A]">{title}</div>
    <div className="text-[10px] leading-relaxed text-[#475569]">{children}</div>
  </div>
);

const Formula: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mt-0.5 px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200 text-[9.5px] font-semibold text-[#1E3A8A] tabular-nums">
    {children}
  </div>
);

const SECTIONS: GuideSection[] = [
  {
    id: 'criteria',
    dot: 'bg-amber-500',
    title: '판정 기준',
    summary: '노랑 칸 = 주의, 빨강 칸 = 경보 기준값',
    body: (
      <>
        <Item title="주의 · 경보">
          분석 설정의 노란 칸을 넘으면 <b className="text-amber-700">주의</b>, 빨간 칸을 넘으면{' '}
          <b className="text-rose-700">경보</b> 배지가 표에 표시됩니다. 빈칸이면 판정하지 않습니다.
        </Item>
        <Item title="Set ± (양방향)">
          Set 대비 위아래로 벗어난 정도를 봅니다. RF Forward, T/V Pressure, Gas 유량, Heater에 적용됩니다.
          <Formula>편차% = (실측 − Set) ÷ Set × 100</Formula>
        </Item>
        <Item title="Max · Unif. (상한)">
          기준값 이상으로 올라갈 때만 표시합니다. RF Reflect(W), Matcher Vpp·Irms·Vdc, T/V Position에 적용됩니다.
          <Formula>Unif.% = (Max − Min) ÷ (2 × |평균|) × 100</Formula>
        </Item>
      </>
    ),
  },
  {
    id: 'window',
    dot: 'bg-[#2563EB]',
    title: '분석 구간 · RSD',
    summary: '98% 도달 + n초부터, RF Off·RSD 진입 n초 전까지',
    body: (
      <>
        <Item title="구간 시작">
          RF가 Set의 98%에 실제 도달한 시점 + <b>구간 시작</b> 값(기본 3초)부터 정상 방전으로 보고 수집합니다.
        </Item>
        <Item title="구간 종료">
          RF Off 또는 RSD 진입 시점에서 <b>구간 종료</b> 값(기본 1초)만큼 앞에서 멈춥니다.
        </Item>
        <Item title="RSD 판정">
          주방전 Set을 유지하다가 Fwd Set이 0이 아닌 낮은 값으로 내려가면 그 값이 <b>RSD Power</b>입니다. Fwd Act가
          RSD Power ± <b>RSD 판정</b> 값(기본 300W) 안에 들어온 시점부터 벗어난 시점까지가 RSD 시간입니다.
        </Item>
      </>
    ),
  },
  {
    id: 'timeline',
    dot: 'bg-[#059669]',
    title: 'H/W Control · 타임라인',
    summary: '각 부품의 제어 시작·종료 시점을 Step 기준으로 표시',
    body: (
      <>
        <Item title="Start 시점">0.0초 = 해당 Step 시작. 각 가스·T/V·RF가 제어를 시작한 시점입니다.</Item>
        <Item title="End 시점">0.0초 = RF Power Off. 각 부품이 차단된 시점입니다.</Item>
        <Item title="BB Mode (Depo 연속)">
          RF가 꺼지지 않고 다음 Depo Step으로 이어지면(로그의 <b>BB</b> 열 Enable) 행에 <b>BB</b> 배지가 붙고, End는{' '}
          <b>0.0초 = Step 전환 시점</b>으로 계산합니다. 다음 Step에서도 이어지는 가스·T/V는 <b>유지</b>, Power와 바뀐
          Pressure Set은 새 Set 도달까지 걸린 시간을 <b>전환 x.x</b>로 표시합니다. 다음 Depo의 Start도 이미 켜져 있던
          항목은 <b>유지</b>입니다. 유지·전환 칸은 주의·경보 판정에서 제외됩니다.
        </Item>
        <Item title="공정 Sequence 타임라인">
          Run 하나를 골라 Lift·SiH4·공정 가스·T/V·RF의 Ramp/Stable/Down 구간을 한 화면에서 비교합니다.
        </Item>
      </>
    ),
  },
  {
    id: 'ctcl',
    dot: 'bg-[#7C3AED]',
    title: 'CTCL · 내보내기',
    summary: 'Load/Tune으로 R·X 보간, 표는 엑셀로 복사·다운로드',
    body: (
      <>
        <Item title="CTCL 보간">
          CTCL Matrix 엑셀의 Load/Tune 격자에서 측정 평균 Load/Tune 위치의 R·X를 2차원 선형 보간으로 계산합니다.
        </Item>
        <Item title="데이터 복사">각 표 오른쪽 위 ‘데이터 복사’를 누르면 엑셀에 바로 붙여 넣을 수 있게 복사됩니다.</Item>
        <Item title="전체 Excel 다운로드">화면 오른쪽 위 버튼으로 모든 표를 시트별로 나눈 엑셀 파일을 받습니다.</Item>
      </>
    ),
  },
];

export const SidebarGuidePanel: React.FC<SidebarGuidePanelProps> = ({ onOpenSettings }) => {
  const [openSection, setOpenSection] = useState<string | null>(null);

  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin text-xs text-[#0F172A] bg-[#E6EBF1]">
      {/* 머리글 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#0F172A]">
          <BookOpen className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
          <span>공정 분석 가이드</span>
        </div>
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-center gap-1 px-1.5 py-[1px] text-[9.5px] text-[#2563EB] hover:bg-blue-100 bg-blue-50 rounded-md border border-blue-200 font-bold cursor-pointer transition-colors"
          >
            <Sliders className="w-3 h-3" />
            분석 설정
          </button>
        )}
      </div>

      {/* 접는 목록: 제목 + 한 줄 요약, 누르면 펼침 */}
      <div className="bg-white rounded-xl border border-slate-300 shadow-2xs divide-y divide-slate-200 overflow-hidden">
        {SECTIONS.map((sec, i) => {
          const open = openSection === sec.id;
          return (
            <div key={sec.id}>
              <button
                type="button"
                onClick={() => setOpenSection(open ? null : sec.id)}
                aria-expanded={open}
                className={`w-full flex items-center gap-1.5 px-2 py-1.5 text-left cursor-pointer transition-colors ${
                  open ? 'bg-slate-50' : 'hover:bg-slate-50'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sec.dot}`} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[10.5px] font-bold text-[#0F172A] whitespace-nowrap">
                    {i + 1}. {sec.title}
                  </span>
                  <span className="block text-[9px] text-[#64748B] truncate">{sec.summary}</span>
                </span>
                <ChevronRight
                  className={`w-3.5 h-3.5 shrink-0 text-[#94A3B8] transition-transform ${open ? 'rotate-90' : ''}`}
                />
              </button>
              {open && <div className="px-2.5 pb-2 pt-1 space-y-1.5 bg-slate-50/60">{sec.body}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
};
