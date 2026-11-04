import React, { useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Zap,
  FileSpreadsheet,
  AlertTriangle,
  Sliders,
  Clock,
} from 'lucide-react';

interface SidebarGuidePanelProps {
  onOpenSettings?: () => void;
}

export const SidebarGuidePanel: React.FC<SidebarGuidePanelProps> = ({ onOpenSettings }) => {
  const [openSection, setOpenSection] = useState<string | null>(null);

  const toggleSection = (id: string) => {
    setOpenSection(prev => (prev === id ? null : id));
  };

  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin text-xs text-[#0F172A] bg-[#F1F5F9]">
      {/* Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-300">
        <div className="flex items-center gap-1.5 truncate">
          <BookOpen className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
          <span className="font-extrabold text-[#0F172A] text-xs truncate">공정 분석 가이드</span>
        </div>
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-[#2563EB] hover:bg-blue-100 bg-blue-50 rounded-lg border border-blue-200 font-bold cursor-pointer transition-colors shrink-0 shadow-2xs"
          >
            <Sliders className="w-3 h-3" />
            <span>설정 열기</span>
          </button>
        )}
      </div>

      {/* Guide Accordions */}
      <div className="space-y-2">
        {/* Section 1: EC 판정 기준 (주의 vs 경보) 해설 */}
        <div className="bg-white rounded-xl border border-slate-300 shadow-2xs overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('ec_criteria')}
            className={`w-full px-2.5 py-2 flex items-center justify-between text-left font-bold text-xs transition-colors cursor-pointer text-[#0F172A] ${
              openSection === 'ec_criteria' ? 'bg-slate-50 border-b border-slate-200' : 'hover:bg-slate-50'
            }`}
          >
            <span className="flex items-center gap-1.5 text-orange-700">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-600" />
              <span>1. 항목별 EC 판정 기준 (좌/우 입력값 안내)</span>
            </span>
            {openSection === 'ec_criteria' ? (
              <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-[#64748B]" />
            )}
          </button>

          {openSection === 'ec_criteria' && (
            <div className="p-2.5 space-y-2.5 bg-[#F8FAFC] text-[10.5px] leading-relaxed text-[#334155]">
              <div className="p-2 rounded-lg bg-blue-50/80 border border-blue-200 space-y-1">
                <span className="font-bold text-[#1E40AF] block text-[11px]">💡 좌측 입력창과 우측 입력창의 정체</span>
                <p className="text-[#334155] text-[10px]">
                  카드 내부의 두 입력창은 <strong>Min/Max가 아니며</strong>, 1단계 주의(Warning)와 2단계 심각 경보(Alarm)의 임계값입니다.
                </p>
                <div className="grid grid-cols-2 gap-1.5 pt-1 text-[10px]">
                  <div className="p-1.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 shadow-2xs">
                    <span className="font-bold block">⚠️ 좌측: Warning (주의)</span>
                    초과 시 노란색 뱃지 표시
                  </div>
                  <div className="p-1.5 rounded-lg bg-rose-50 border border-rose-300 text-rose-900 shadow-2xs">
                    <span className="font-bold block">🚨 우측: Alarm (경보)</span>
                    초과 시 빨간색 뱃지 표시
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 text-[10.5px]">
                <span className="font-bold text-[#0F172A] block text-[11px]">📊 판정 방식 2가지 (양방향 vs 상한)</span>
                <ul className="space-y-1 list-disc pl-4 text-[#475569]">
                  <li>
                    <strong className="text-[#0F172A]">양방향 판정 (±% 편차)</strong>:
                    목표 Set 대비 실제 측정값이 위로 튀거나 아래로 떨어지는 정도를 절대값(|값|)으로 검사합니다.
                    <br />
                    <span className="text-[10px] text-[#2563EB] font-mono font-semibold">편차% = ((실측값 - Set) / Set) × 100</span>
                    <br />
                    <span className="text-[9.5px] text-[#64748B]">적용 대상: RF Forward, T/V Pressure, Gas 유량, Heater 온도</span>
                  </li>
                  <li>
                    <strong className="text-[#0F172A]">상한 판정 (≥ 기준값)</strong>:
                    목표치가 없거나 작을수록 좋은 파라미터로, 기준치 이상 상승할 때만 감지합니다.
                    <br />
                    <span className="text-[9.5px] text-[#64748B]">적용 대상: RF Reflect Power(W), Matcher Uniformity(%), T/V Position(%)</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-1 text-[10.5px] pt-1.5 border-t border-slate-200">
                <span className="font-bold text-[#0F172A] block text-[11px]">📐 Uniformity(균일도) 산출 공식</span>
                <div className="p-1.5 rounded-lg bg-white border border-slate-300 font-mono text-[10px] text-[#0F172A] shadow-2xs">
                  Uniformity(%) = (Max - Min) / (2 × |평균|) × 100
                </div>
                <p className="text-[9.5px] text-[#64748B]">
                  Matcher Vpp, Irms, DC Bias 및 T/V 개도율의 흔들림 정도를 평가합니다.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: 공정 분석 기본 파라미터 (시작시점 & 종료시점) */}
        <div className="bg-white rounded-xl border border-slate-300 shadow-2xs overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('general_params')}
            className={`w-full px-2.5 py-2 flex items-center justify-between text-left font-bold text-xs transition-colors cursor-pointer text-[#0F172A] ${
              openSection === 'general_params' ? 'bg-slate-50 border-b border-slate-200' : 'hover:bg-slate-50'
            }`}
          >
            <span className="flex items-center gap-1.5 text-[#1E40AF]">
              <Zap className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>2. 분석 구간 설정 (시작시점 & 종료시점)</span>
            </span>
            {openSection === 'general_params' ? (
              <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-[#64748B]" />
            )}
          </button>

          {openSection === 'general_params' && (
            <div className="p-2.5 space-y-2.5 bg-[#F8FAFC] text-[10.5px] leading-relaxed text-[#334155]">
              <div className="space-y-1">
                <strong className="text-[#0F172A] block">① 분석 구간 설정 (시작시점 & 종료시점)</strong>
                <ul className="space-y-1 list-disc pl-4 text-[#475569]">
                  <li>
                    <strong className="text-[#2563EB]">Ramping Up 실제 도달 기준 + n초 버퍼</strong>:
                    RF 최초 방전 점화(≥1W) 후 목표 Set의 98%에 실제 도달한 시점 + 엔지니어 설정 n초(기본 3.0초) 이후부터 정상 방전 구간으로 수집
                  </li>
                  <li>
                    <strong className="text-[#2563EB]">종료 전 제외 버퍼</strong>:
                    일반 공정은 RF Off 직전 n초(기본 1.0초), RSD 공정은 잔여가스 배기 방전 진입 직전 n초(기본 1.0초)를 사전에 컷오프하여 정상 상태(Steady State) 데이터만 정밀 분석
                  </li>
                </ul>
              </div>

              <div className="space-y-1 pt-1.5 border-t border-slate-200">
                <strong className="text-[#0F172A] block">② Ramp 구간 인위적 제외 필터 배제 사유</strong>
                <p className="text-[#64748B]">
                  Set의 98% 미만으로 떨어지는 불안정한 행들도 <strong>실제 RF 제너레이터의 결함이나 이상 드롭 현상</strong>일 수 있으므로, 인위적인 필터링 없이 있는 그대로 온전히 포착하여 실제 Deviation 및 주의/경보에 반영합니다.
                </p>
              </div>

              <div className="space-y-1 pt-1.5 border-t border-slate-200">
                <strong className="text-[#0F172A] block">③ 간소화된 RF 파라미터 연계</strong>
                <p className="text-[#64748B]">
                  • <strong>On 문턱값</strong>: 항상 1W (최초 방전 점화)<br />
                  • <strong>Stable Time</strong>: 항상 3초 (고정 모드 시)<br />
                  • <strong>RF 도달 허용오차</strong>: 하단 2번의 RF Forward Power EC ⚠️ 주의(Warn)%와 자동 연동되어 목표 Set 도달 시점을 산출합니다.
                </p>
              </div>

              <div className="space-y-1 pt-1.5 border-t border-slate-200">
                <strong className="text-[#0F172A] block">④ 분석 구간 설정 (종료시점)</strong>
                <p className="text-[#64748B]">
                  Ramp Down 버퍼와 RSD 진입 전 버퍼를 통합한 <strong>공통 종료 버퍼</strong>(기본값 1.0초)로 제어합니다.<br />
                  • <strong>일반 레시피</strong>: RF Off - 종료 버퍼(초) 직전까지 데이터 수집<br />
                  • <strong>RSD 적용 레시피</strong>: RSD 진입(SiH4 차단 또는 RF 계단 하강) - 종료 버퍼(초) 직전까지 데이터 수집
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Section 3: H/W Control 시점 및 타임라인 해석법 */}
        <div className="bg-white rounded-xl border border-slate-300 shadow-2xs overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('timeline_guide')}
            className={`w-full px-2.5 py-2 flex items-center justify-between text-left font-bold text-xs transition-colors cursor-pointer text-[#0F172A] ${
              openSection === 'timeline_guide' ? 'bg-slate-50 border-b border-slate-200' : 'hover:bg-slate-50'
            }`}
          >
            <span className="flex items-center gap-1.5 text-emerald-700">
              <Clock className="w-3.5 h-3.5 text-emerald-600" />
              <span>3. H/W Control 시점 및 시퀀스 타임라인</span>
            </span>
            {openSection === 'timeline_guide' ? (
              <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-[#64748B]" />
            )}
          </button>

          {openSection === 'timeline_guide' && (
            <div className="p-2.5 space-y-2 bg-[#F8FAFC] text-[10.5px] leading-relaxed text-[#334155]">
              <div className="space-y-1">
                <strong className="text-[#0F172A] block">① [Set 도달 완료 시점] 칩</strong>
                <p className="text-[#64748B]">
                  간트 차트 하단의 파란색 칩들은 제어 Start(On) 시점이 아닌, 각 파츠가 실제 목표 Set값에 도달 완료한 <strong>최종 Set 도달 시간</strong>을 나타냅니다. (제어 시작 시점은 하단 Monitoring Data 표 참조)
                </p>
              </div>

              <div className="space-y-1 pt-1.5 border-t border-slate-200">
                <strong className="text-[#0F172A] block">② Process Gas 시간: 가장 빠른 가스와 늦은 가스의 중간값</strong>
                <p className="text-[#64748B]">
                  N2O, NH3, PN2, H2 등 반응 가스들의 개별 유입 시점 중 <strong>가장 빠른 가스(Min)와 가장 늦은 가스(Max)의 산술 중간값 ((Min + Max) / 2)</strong>으로 정확히 산출됩니다.
                </p>
              </div>

              <div className="space-y-1 pt-1.5 border-t border-slate-200">
                <strong className="text-[#0F172A] block">③ 타임라인 인터랙티브 가이드라인</strong>
                <p className="text-[#64748B]">
                  하단 제어 시점 칩을 클릭하면 상단 간트 타임라인 위에 해당 시간의 <strong>세로 점선 가이드라인</strong>이 다중으로 표시되어, 각 파츠의 Ramp와 Stable 경계를 한눈에 비교 분석할 수 있습니다.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Section 4: CTCL 매트릭스 & 엑셀 내보내기 */}
        <div className="bg-white rounded-xl border border-slate-300 shadow-2xs overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('ctcl_export')}
            className={`w-full px-2.5 py-2 flex items-center justify-between text-left font-bold text-xs transition-colors cursor-pointer text-[#0F172A] ${
              openSection === 'ctcl_export' ? 'bg-slate-50 border-b border-slate-200' : 'hover:bg-slate-50'
            }`}
          >
            <span className="flex items-center gap-1.5 text-purple-700">
              <FileSpreadsheet className="w-3.5 h-3.5 text-purple-600" />
              <span>4. CTCL 매트릭스 & 데이터 내보내기</span>
            </span>
            {openSection === 'ctcl_export' ? (
              <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-[#64748B]" />
            )}
          </button>

          {openSection === 'ctcl_export' && (
            <div className="p-2.5 space-y-2 bg-[#F8FAFC] text-[10.5px] leading-relaxed text-[#334155]">
              <div className="space-y-1">
                <strong className="text-[#0F172A] block">① CTCL 임피던스(R, X) 쌍선형 보간</strong>
                <p className="text-[#64748B]">
                  등록된 CTCL Matrix Excel 시트의 Load/Tune 격자 데이터를 기반으로, 측정된 평균 Load/Tune 좌표 사이의 실수부(R)와 허수부(X)를 쌍선형 보간법(Bilinear Interpolation)으로 정밀 계산합니다.
                </p>
              </div>

              <div className="space-y-1 pt-1.5 border-t border-slate-200">
                <strong className="text-[#0F172A] block">② 엑셀 내보내기 & TSV 복사</strong>
                <p className="text-[#64748B]">
                  • <strong>전체 Excel 다운로드</strong>: 상단 네비게이션 우측 버튼 클릭 시 요약, 시퀀스, 편차, 모니터링 데이터가 포맷된 다중 시트 엑셀로 저장됩니다.
                  <br />
                  • <strong>테이블 복사</strong>: 대시보드 내 각 테이블 헤더의 복사 아이콘을 누르면 엑셀에 바로 붙여넣을 수 있는 TSV 포맷으로 클립보드에 복사됩니다.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
