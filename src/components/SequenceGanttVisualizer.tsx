import React, { useState, useRef, useMemo, useEffect } from 'react';
import { CopyImageButton } from './CopyImageButton';
import {
  Clock,
  Zap,
  GitCompare,
  Sliders,
  ChevronDown,
  ChevronUp,
  Sparkles,
  MoveVertical,
  Flame,
  Wind,
  Gauge,
  Layers,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  MoveHorizontal,
} from 'lucide-react';
import { AnalysisFileResult, AnalyzerSettings, ParsedLogFile, RawLogRow, StepSummary } from '../types/pecvd';
import { isTvPressureActive } from '../utils/analyzer';

interface SequenceGanttVisualizerProps {
  results: AnalysisFileResult[];
  settings?: AnalyzerSettings;
  files?: ParsedLogFile[];
  externalSelectedRunIdx?: number | null;
  onSelectRunIdx?: (idx: number | null) => void;
  /** 값이 바뀌면 타임라인을 펼치고 화면을 타임라인으로 이동 (표 번호 칸 클릭) */
  focusSignal?: number;
}

export const SequenceGanttVisualizer: React.FC<SequenceGanttVisualizerProps> = ({
  results,
  settings,
  files = [],
  externalSelectedRunIdx,
  onSelectRunIdx,
  focusSignal = 0,
}) => {
  const [selectedRunIdx, setSelectedRunIdx] = useState<number>(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (externalSelectedRunIdx !== undefined && externalSelectedRunIdx !== null && externalSelectedRunIdx >= 0 && externalSelectedRunIdx < results.length) {
      setSelectedRunIdx(externalSelectedRunIdx);
    }
  }, [externalSelectedRunIdx, results.length]);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(true);

  // 표 번호 칸 클릭 → 타임라인 펼치고 화면 이동
  useEffect(() => {
    if (!focusSignal) return;
    setIsCollapsed(false);
    requestAnimationFrame(() => rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [focusSignal]);

  // Control 시점 인터랙티브 하이라이트 (다중 선택/토글 누적 지원)
  const [selectedMilestoneKeys, setSelectedMilestoneKeys] = useState<string[]>([]);

  const toggleMilestone = (key: string) => {
    setSelectedMilestoneKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const clearAllMilestones = () => {
    setSelectedMilestoneKeys([]);
  };

  const trackContainerRef = useRef<HTMLDivElement>(null);

  if (results.length === 0) return null;

  const currentResult = results[selectedRunIdx] || results[0];
  const p = currentResult.processData;
  const s = currentResult.hwStart;
  const e = currentResult.hwEndRF;
  const endStep = currentResult.hwEndStep;

  // Raw file rows for accurate Warning threshold calculation
  const currentFile = files.find(f => f.id === currentResult.fileId) || files[selectedRunIdx];
  // 같은 Log의 Depo들 (Depo 선택 칩) · Log 번호
  const siblingResults = results.map((r, idx) => ({ r, idx })).filter(x => x.r.fileId === currentResult.fileId);
  const currentFileNo = Math.max(1, files.findIndex(f => f.id === currentResult.fileId) + 1);
  const rawRows = currentFile?.rows || [];

  // SiH4 가스 실제 공급 여부 판별 (0 sccm 또는 미공급 시에는 트랙에 Idle로 표시)
  const hasSiH4 = Boolean(
    (p.pyroSiH4Set !== null && p.pyroSiH4Set > 0) ||
    (rawRows.length > 0 && rawRows.some(r => r.step === currentResult.depoStep && (r.pyroSiH4 >= 10 || (r.pyroSiH4Set ?? 0) > 0)))
  );

  // Active reaction gases for current recipe (Ar 포함)
  const otherGases = [
    { name: 'Ar', start: s.depoStable_pyroAr ?? s.plStable_pyroAr, end: endStep.depo_pyroAr ?? e.pl_pyroAr, set: p.pyroArSet },
    { name: 'N2O', start: s.depoStable_pyroN2O, end: e.depo_pyroN2O, set: p.pyroN2OSet },
    { name: 'NH3', start: s.depoStable_pyroNH3, end: e.depo_pyroNH3, set: p.pyroNH3Set },
    { name: 'PN2', start: s.depoStable_pyroPN2, end: e.depo_pyroPN2, set: p.pyroPN2Set },
    { name: 'H2', start: s.depoStable_pyroH2, end: e.depo_pyroH2, set: p.pyroH2Set },
    { name: 'NF3', start: null, end: null, set: p.oxyNF3Set },
  ].filter(g => (g.set !== null && g.set > 0) || g.start !== null || g.end !== null);

  const activeGases = otherGases.filter(g => (g.set ?? 0) > 0);
  const activeGasLabel = activeGases.length > 0
    ? activeGases.map(g => `${g.name}${g.set ? ` ${g.set.toLocaleString()}` : ''}`).join(' / ') + ' sccm'
    : 'Reaction Gas';

  // -------------------------------------------------------------------------
  // [공정 스텝별 시간 기준]
  // -------------------------------------------------------------------------
  const stableDuration = endStep.totalStepTimeStable ?? 15.0; // STAB1
  const depoDuration = endStep.totalStepTimeDepo ?? 65.7;     // SIO/DEPO
  const plStableDuration = 5.0;                              // PL Stable
  const plDuration = endStep.totalStepTimePL ?? 5.0;         // Power Lift

  // -------------------------------------------------------------------------
  // [Step 1 ~ 9 세부 단계 목록 정밀 추출]
  // 원본 로그 파일의 stepsSummary 또는 rawRows에서 실제 Step 번호/명칭/구간 완벽 매핑
  // -------------------------------------------------------------------------
  const stepList: StepSummary[] = useMemo(() => {
    if (currentFile?.stepsSummary && currentFile.stepsSummary.length > 0) {
      return currentFile.stepsSummary;
    }
    if (rawRows.length > 0) {
      const stepMap = new Map<number, { step: number; name: string; minSec: number; maxSec: number; count: number }>();
      rawRows.forEach(r => {
        const stepNum = r.step;
        const cur = stepMap.get(stepNum);
        if (!cur) {
          stepMap.set(stepNum, {
            step: stepNum,
            name: r.stepName || `Step ${stepNum}`,
            minSec: r.elapsedSec,
            maxSec: r.elapsedSec,
            count: 1,
          });
        } else {
          cur.minSec = Math.min(cur.minSec, r.elapsedSec);
          cur.maxSec = Math.max(cur.maxSec, r.elapsedSec);
          cur.count++;
        }
      });
      return Array.from(stepMap.values())
        .sort((a, b) => a.step - b.step)
        .map(item => ({
          step: item.step,
          stepName: item.name,
          rowCount: item.count,
          durationSec: Math.round((item.maxSec - item.minSec) * 10) / 10,
          startElapsedSec: Math.round(item.minSec * 10) / 10,
          endElapsedSec: Math.round(item.maxSec * 10) / 10,
        }));
    }

    // 파일 로우 미존재 시 표준 PECVD 시퀀스 (Step 1~9) 세부 구성
    const defaultSteps = [
      { step: 1, stepName: 'Pump & Purge', dur: 10.0 },
      { step: 2, stepName: 'STAB1 (가스안정화)', dur: stableDuration },
      { step: 3, stepName: 'SIO / DEPO (메인증착)', dur: depoDuration },
      { step: 4, stepName: 'Pump Out', dur: 8.0 },
      { step: 5, stepName: 'PL STAB (가스인입)', dur: plStableDuration },
      { step: 6, stepName: 'Power Lift (Dechuck)', dur: plDuration },
      { step: 7, stepName: 'Lift 하강 완료', dur: 5.0 },
      { step: 8, stepName: 'Post Purge', dur: 15.0 },
      { step: 9, stepName: 'Vent / Standby', dur: 10.0 },
    ];
    let curTime = 0.0;
    return defaultSteps.map(sd => {
      const start = curTime;
      const end = Math.round((start + sd.dur) * 10) / 10;
      curTime = end;
      return {
        step: sd.step,
        stepName: sd.stepName,
        rowCount: Math.round(sd.dur * 10),
        durationSec: sd.dur,
        startElapsedSec: start,
        endElapsedSec: end,
      };
    });
  }, [currentFile, rawRows, stableDuration, depoDuration, plStableDuration, plDuration]);

  // 전체 공정 누적 총 소요 시간 (초)
  const totalCumulativeTime = useMemo(() => {
    if (stepList.length > 0) {
      const last = stepList[stepList.length - 1];
      return Math.max(1, Math.round(last.endElapsedSec * 10) / 10);
    }
    return Math.max(1, Math.round((stableDuration + depoDuration + plStableDuration + plDuration + 15.0) * 10) / 10);
  }, [stepList, stableDuration, depoDuration, plStableDuration, plDuration]);

  // STAB1 & DEPO 주요 단계 시간 기준점 매핑
  const stab1StepItem = stepList.find(s => s.step === (currentResult.stableStep ?? 2)) || stepList[1] || stepList[0];
  const depoStepItem = stepList.find(s => s.step === (currentResult.depoStep ?? 3)) || stepList[2] || stepList[1];

  const step2Start = stab1StepItem ? stab1StepItem.startElapsedSec : 0.0;
  const step2End = stab1StepItem ? stab1StepItem.endElapsedSec : stableDuration;

  const step3Start = depoStepItem ? depoStepItem.startElapsedSec : step2End;
  const step3End = depoStepItem ? depoStepItem.endElapsedSec : Math.round((step3Start + depoDuration) * 10) / 10;

  // Lift Spacing Process Value (mils) - 소수점 첫째자리 반올림 정수화
  const liftSpacingValue = Math.round(p.liftSpacingSet ?? 450);

  // 1. STAB1 마일스톤
  const sih4StartStep2 = Math.round((step2Start + (s.depoStable_pyroSiH4 ?? 0.5)) * 10) / 10;

  // 반응 가스들(N2O, NH3, PN2, H2 등) 중 가장 빠른 가스 시간과 가장 늦은 가스 시간의 중간값(Midpoint) 산출
  const validGasStarts = otherGases
    .map(g => g.start)
    .filter((v): v is number => v !== null && v !== undefined && !isNaN(v) && v < 900);

  let midOtherGasStartOffset = 0.5;
  if (validGasStarts.length > 0) {
    const minStart = Math.min(...validGasStarts);
    const maxStart = Math.max(...validGasStarts);
    midOtherGasStartOffset = (minStart + maxStart) / 2;
  }
  const midOtherGasStart = Math.round((step2Start + midOtherGasStartOffset) * 10) / 10;
  const tvModeStartStep2 = Math.round((step2Start + (s.depoStable_tvCtrlMode ?? 1.3)) * 10) / 10;

  // 2. Step 3 Main RF On & RSD Milestones
  const rfOnOffsetInStep3 = s.depo_rfForwardAct ?? 3.1;
  const rfOnCumTime = Math.round((step3Start + rfOnOffsetInStep3) * 10) / 10;

  // 3. Warning 기준 기반 실제 로그 데이터 'Ramp Up' (Set값 도달) 시간 산출
  const gasWarningPct = (settings?.ecGasWarningPct ?? 3) / 100;
  const pressWarningPct = (settings?.ecPressureWarningPct ?? 2) / 100;
  const rfWarningPct = (settings?.ecRfForwardWarningPct ?? 2) / 100;
  const liftWarningPct = (settings?.ecLiftSpacingWarningPct ?? 2) / 100;

  const calculatedTransitions = useMemo(() => {
    // 0. Lift Spacing: Set - (Set * warningPct) 도달 시간 산출
    let liftReachCum = Math.max(step2Start + 0.4, sih4StartStep2);
    if (liftSpacingValue > 0 && rawRows.length > 0) {
      const lowerBound = liftSpacingValue * (1 - liftWarningPct);
      const upperBound = liftSpacingValue * (1 + liftWarningPct);
      // 현재 분석 대상 스텝 또는 직전 안정화 스텝 구간 내에서 Lift가 목표 Set에 도달한 첫 행
      const relevantRows = rawRows.filter(r => r.elapsedSec >= step2Start && r.elapsedSec <= step3End);
      const reachedRow = relevantRows.find(r => {
        const val = r.liftSpacing ?? r.liftPos ?? 0;
        return val >= lowerBound && val <= upperBound;
      });
      if (reachedRow) {
        liftReachCum = Math.round(reachedRow.elapsedSec * 10) / 10;
      }
    }
    liftReachCum = Math.max(step2Start + 0.3, Math.min(step3Start + 0.8, liftReachCum));

    // A. SiH4: Set - (Set * warningPct)
    let sih4ReachCum = sih4StartStep2 + 1.2;
    const sih4SetVal = p.pyroSiH4Set;
    if (hasSiH4 && sih4SetVal && sih4SetVal > 0 && rawRows.length > 0) {
      const lowerBound = sih4SetVal * (1 - gasWarningPct);
      const step2Rows = rawRows.filter(r => r.step === (currentResult.stableStep ?? 2));
      const reachedRow = step2Rows.find(r => r.pyroSiH4 >= lowerBound);
      if (reachedRow) {
        sih4ReachCum = Math.round(reachedRow.elapsedSec * 10) / 10;
      }
    }
    sih4ReachCum = Math.max(sih4StartStep2 + 0.3, Math.min(step2End, sih4ReachCum));

    // B. Reaction Gas (또는 Ar/H2): Set - (Set * warningPct) 도달 완료 시점
    // 활성 반응 가스(N2O, NH3, PN2, H2 등)들의 Set 도달 시점 중 가장 빠른 가스와 가장 늦은 가스의 중간값(Midpoint) 산출
    let rxGasReachCum = midOtherGasStart + 1.0;
    const activeReactionGases = otherGases.filter(g => (g.set ?? 0) > 0);
    const gasReachTimes: number[] = [];

    if (activeReactionGases.length > 0 && rawRows.length > 0) {
      const step2Rows = rawRows.filter(r => r.step === (currentResult.stableStep ?? 2));
      for (const gas of activeReactionGases) {
        const lowerBound = (gas.set ?? 0) * (1 - gasWarningPct);
        const reachedRow = step2Rows.find(r => {
          if (gas.name === 'Ar') return (r.pyroAr ?? 0) >= lowerBound;
          if (gas.name === 'N2O') return (r.pyroN2O ?? 0) >= lowerBound;
          if (gas.name === 'NH3') return (r.pyroNH3 ?? 0) >= lowerBound;
          if (gas.name === 'PN2') return (r.pyroPN2 ?? 0) >= lowerBound;
          if (gas.name === 'H2') return (r.pyroH2 ?? 0) >= lowerBound;
          return false;
        });
        if (reachedRow) {
          gasReachTimes.push(reachedRow.elapsedSec);
        }
      }
    }

    if (gasReachTimes.length > 0) {
      const minReach = Math.min(...gasReachTimes);
      const maxReach = Math.max(...gasReachTimes);
      rxGasReachCum = Math.round(((minReach + maxReach) / 2) * 10) / 10;
    }
    rxGasReachCum = Math.max(midOtherGasStart + 0.3, Math.min(step2End, rxGasReachCum));

    // C. Pressure (T/V): Set - (Set * warningPct)
    let tvReachCum = tvModeStartStep2 + 1.8;
    const tvSet = p.tvPressureSet;
    if (tvSet && tvSet > 0 && rawRows.length > 0) {
      const lowerBound = tvSet * (1 - pressWarningPct);
      const upperBound = tvSet * (1 + pressWarningPct);
      const step2Rows = rawRows.filter(r => r.step === (currentResult.stableStep ?? 2));
      const reachedRow = step2Rows.find(r => r.tvPressure >= lowerBound && r.tvPressure <= upperBound && r.elapsedSec >= tvModeStartStep2);
      if (reachedRow) {
        tvReachCum = Math.round(reachedRow.elapsedSec * 10) / 10;
      }
    }
    tvReachCum = Math.max(tvModeStartStep2 + 0.4, Math.min(step2End, tvReachCum));

    // D. Downstream PL Step (실제 현재 분석 스텝 이후에 별도 PL 스텝이 존재하는 경우에만 활성화)
    const downstreamPlStep = (currentResult.plStepStart !== null)
      ? stepList.find(st => st.step === currentResult.plStepStart && st.startElapsedSec > step3End)
      : null;

    let plStepStart: number | null = null;
    let plGasStartCum: number | null = null;
    let plGasReachCum: number | null = null;
    let plTvStartCum: number | null = null;
    let plTvReachCum: number | null = null;

    if (downstreamPlStep) {
      plStepStart = downstreamPlStep.startElapsedSec;
      const plGasStartSec = Math.min(s.plStable_pyroAr ?? 0.5, s.plStable_pyroH2 ?? 0.5);
      plGasStartCum = Math.round((plStepStart + plGasStartSec) * 10) / 10;
      plGasReachCum = Math.round((plGasStartCum + 1.0) * 10) / 10;

      const plTvStartSec = s.plStable_tvCtrlMode ?? 1.0;
      plTvStartCum = Math.round((plStepStart + plTvStartSec) * 10) / 10;
      plTvReachCum = Math.round((plTvStartCum + 1.5) * 10) / 10;
    }

    // F. RF Generator Main Strike & Reach
    const rfSetVal = p.rfForwardSetValue;
    let rfReachStep3 = rfOnOffsetInStep3 + 0.8;
    if (rfSetVal && rfSetVal > 0 && rawRows.length > 0) {
      const lowerBound = rfSetVal * (1 - rfWarningPct);
      const depoStepRows = rawRows.filter(r => r.step === currentResult.depoStep);
      const reachedRow = depoStepRows.find(r => r.rfForwardPowerAct >= lowerBound && r.stepAllTime >= rfOnOffsetInStep3);
      if (reachedRow) {
        rfReachStep3 = Math.round(reachedRow.stepAllTime * 10) / 10;
      }
    }
    const rfReachCum = Math.round((step3Start + rfReachStep3) * 10) / 10;

    return {
      liftReachCum,
      sih4ReachCum,
      rxGasReachCum,
      tvReachCum,
      plGasStartCum,
      plGasReachCum,
      plTvStartCum,
      plTvReachCum,
      rfReachCum,
      plStepStart,
    };
  }, [
    rawRows,
    sih4StartStep2,
    midOtherGasStart,
    tvModeStartStep2,
    p,
    liftSpacingValue,
    liftWarningPct,
    gasWarningPct,
    pressWarningPct,
    rfWarningPct,
    step2Start,
    step2End,
    step3Start,
    step3End,
    stepList,
    rfOnOffsetInStep3,
    currentResult,
    s,
    hasSiH4,
    otherGases,
  ]);

  const sih4LeadCutSec = e.depo_pyroSiH4 !== null ? Math.abs(e.depo_pyroSiH4) : (p.rsdTime ?? 2.1);
  const rfOffOffsetInStep3 = endStep.depo_rfOffTime ?? 65.1;
  const sih4CutOffsetInStep3 = endStep.depo_pyroSiH4 !== null ? endStep.depo_pyroSiH4 : Math.round((rfOffOffsetInStep3 - sih4LeadCutSec) * 10) / 10;
  const sih4CutCumTime = hasSiH4 ? Math.round((step3Start + sih4CutOffsetInStep3) * 10) / 10 : Math.round((step3Start + rfOffOffsetInStep3) * 10) / 10;

  const mainRfOffCumTime = Math.round((step3Start + rfOffOffsetInStep3) * 10) / 10;
  const tvOpenOffsetInStep3 = rfOffOffsetInStep3 + (e.depo_tvCtrlMode ?? 1.0);
  const tvOpenCumTime = Math.round((step3Start + tvOpenOffsetInStep3) * 10) / 10;

  // Power Lift Milestones (실제 후속 PL 스텝이 존재하는 경우에만 유효)
  const hasDownstreamPL = calculatedTransitions.plStepStart !== null;
  const plStepStart = calculatedTransitions.plStepStart;
  const plGasStartCum = calculatedTransitions.plGasStartCum;
  const plTvModeCum = calculatedTransitions.plTvStartCum;

  let plRfOnCum: number | null = null;
  let plRfOffCum: number | null = null;
  if (hasDownstreamPL && plStepStart !== null) {
    const plRfOnOffset = s.pl_rfForwardAct ?? 0.8;
    plRfOnCum = Math.round((plStepStart + plRfOnOffset) * 10) / 10;
    const plRfOffOffset = endStep.pl_rfOffTime ?? 4.8;
    plRfOffCum = Math.round((plStepStart + plRfOffOffset) * 10) / 10;
  }

  // Lift Motion Timeline (현재 분석 스텝 및 후속 PL 스텝에 정확히 동기화)
  const liftMoveUpEnd = calculatedTransitions.liftReachCum;
  const liftDechuckStart = (hasDownstreamPL && plRfOffCum !== null) ? plRfOffCum : step3End;
  const liftDechuckEnd = Math.min(totalCumulativeTime, Math.round((liftDechuckStart + 2.0) * 10) / 10);

  // -------------------------------------------------------------------------
  // [반응 가스 차단 완료(Down 종료) & 압력 제어 해제(T/V Open) 시점 정밀 산출]
  // 사용자의 핵심 요구: 해당 Step에서 On되었던 가스가 Off 상태로 되었다면
  // 바로 Down은 그 지점에서 끝이나야 함 (Step 4 내부 또는 Step 5 이후까지 연장 추적)
  // -------------------------------------------------------------------------
  const { rxGasDownStart, rxGasOffCumTime, tvOpenEndCumTime, sih4ActualOffCumTime } = useMemo(() => {
    // 1. 현재 Depo Step에서 On(공급)되었던 반응 가스(NH3, PN2, N2O, H2, Ar, NF3 등) 식별
    const depoStepRows = rawRows.filter(r => r.step === currentResult.depoStep);
    const candidateGases = [
      { name: 'NH3', getter: (r: RawLogRow) => r.pyroNH3 ?? 0, set: p.pyroNH3Set ?? 0, hwEnd: endStep.depo_pyroNH3 },
      { name: 'PN2', getter: (r: RawLogRow) => r.pyroPN2 ?? 0, set: p.pyroPN2Set ?? 0, hwEnd: endStep.depo_pyroPN2 },
      { name: 'N2O', getter: (r: RawLogRow) => r.pyroN2O ?? 0, set: p.pyroN2OSet ?? 0, hwEnd: endStep.depo_pyroN2O },
      { name: 'H2', getter: (r: RawLogRow) => r.pyroH2 ?? 0, set: p.pyroH2Set ?? 0, hwEnd: endStep.depo_pyroH2 },
      { name: 'Ar', getter: (r: RawLogRow) => r.pyroAr ?? 0, set: p.pyroArSet ?? 0, hwEnd: null },
      { name: 'NF3', getter: (r: RawLogRow) => r.oxyNF3 ?? 0, set: p.oxyNF3Set ?? 0, hwEnd: null },
    ];

    const activeList = candidateGases.filter(cg => {
      const maxAct = depoStepRows.length > 0 ? Math.max(...depoStepRows.map(cg.getter)) : 0;
      return cg.set > 0 || maxAct >= 10;
    });

    const offTimes: number[] = [];
    const downStarts: number[] = [];

    if (activeList.length > 0 && rawRows.length > 0) {
      const depoStartRowIdx = rawRows.findIndex(r => r.step === currentResult.depoStep);
      const searchStartIdx = depoStartRowIdx !== -1 ? depoStartRowIdx : 0;

      for (const gas of activeList) {
        // Off 판정 기준: MFC 유량 <= 5 sccm 또는 Set의 2% 이하
        const offThreshold = Math.max(5, (gas.set || 100) * 0.02);
        // Down 시작 기준: 유량이 Set의 90% 미만으로 떨어지는 시점
        const dropThreshold = (gas.set || 100) * 0.90;

        let gasDownTime: number | null = null;
        let gasOffTime: number | null = null;
        let isPastPeak = false;

        for (let i = searchStartIdx; i < rawRows.length; i++) {
          const r = rawRows[i];
          const val = gas.getter(r);

          if (val >= dropThreshold) {
            isPastPeak = true;
          }

          if (isPastPeak && gasDownTime === null && val < dropThreshold) {
            gasDownTime = Math.round(r.elapsedSec * 10) / 10;
          }

          if (isPastPeak && val <= offThreshold) {
            gasOffTime = Math.round(r.elapsedSec * 10) / 10;
            break;
          }

          // 다른 Depo 스텝(예: Step 8)으로 넘어가면 추적 중단
          if (r.step > currentResult.depoStep + 2) break;
        }

        if (gasOffTime !== null) offTimes.push(gasOffTime);
        if (gasDownTime !== null) downStarts.push(gasDownTime);
      }
    }

    // A. Down 종료 시점 (가스가 실제로 Off된 시점)
    let gasOffCum = step3End;
    if (offTimes.length > 0) {
      gasOffCum = Math.max(...offTimes);
    } else {
      // hwEndStep fallback
      const validHwEnd = activeList
        .map(g => g.hwEnd)
        .filter((v): v is number => v !== null && v !== undefined && v > 0);
      if (validHwEnd.length > 0) {
        gasOffCum = Math.round((step3Start + Math.max(...validHwEnd)) * 10) / 10;
      } else {
        gasOffCum = step3End;
      }
    }

    // B. Down 시작 시점 (유량이 떨어지기 시작하거나 RF Off 시점)
    let gasDownStart = mainRfOffCumTime;
    if (downStarts.length > 0) {
      gasDownStart = Math.min(...downStarts);
    }
    gasDownStart = Math.min(gasDownStart, gasOffCum);
    // Down 붉은색 막대가 가시적으로 보일 수 있도록 최소 0.5s 이상의 폭 보장 (안정화 시작 이후 범위)
    if (gasOffCum - gasDownStart < 0.5) {
      gasDownStart = Math.max(calculatedTransitions.rxGasReachCum + 1.0, gasOffCum - 1.2);
    }

    // C. SiH4 Actual Off 시점
    let sih4ActualOff = mainRfOffCumTime;
    if (hasSiH4 && rawRows.length > 0) {
      const depoStartRowIdx = rawRows.findIndex(r => r.step === currentResult.depoStep);
      const searchStartIdx = depoStartRowIdx !== -1 ? depoStartRowIdx : 0;
      let isPastSih4Peak = false;
      for (let i = searchStartIdx; i < rawRows.length; i++) {
        const r = rawRows[i];
        if (r.pyroSiH4 >= 10) isPastSih4Peak = true;
        if (isPastSih4Peak && r.elapsedSec >= sih4CutCumTime && r.pyroSiH4 <= 5) {
          sih4ActualOff = Math.round(r.elapsedSec * 10) / 10;
          break;
        }
        if (r.step > currentResult.depoStep + 2) break;
      }
    }
    sih4ActualOff = Math.max(sih4ActualOff, mainRfOffCumTime);

    // D. Pressure Off / Throttle Valve Open 종료 시점
    let tvEnd = tvOpenCumTime;
    if (rawRows.length > 0) {
      const depoStartRowIdx = rawRows.findIndex(r => r.step === currentResult.depoStep);
      const searchStartIdx = depoStartRowIdx !== -1 ? depoStartRowIdx : 0;
      for (let i = searchStartIdx; i < rawRows.length; i++) {
        const r = rawRows[i];
        if (r.elapsedSec >= tvOpenCumTime) {
          const m = (r.tvCtrlModeSet || r.tvCtrlMode || '').toUpperCase();
          if (m.includes('OPEN') || m.includes('POS') || r.tvPosition >= 95 || r.tvPressure <= 50) {
            tvEnd = Math.round(r.elapsedSec * 10) / 10;
            break;
          }
        }
        if (r.step > currentResult.depoStep + 2) break;
      }
    }
    if (tvEnd - tvOpenCumTime < 0.5) {
      tvEnd = Math.min(totalCumulativeTime, Math.round((tvOpenCumTime + 1.2) * 10) / 10);
    }

    return {
      rxGasDownStart: Math.round(gasDownStart * 10) / 10,
      rxGasOffCumTime: Math.round(gasOffCum * 10) / 10,
      tvOpenEndCumTime: Math.round(tvEnd * 10) / 10,
      sih4ActualOffCumTime: Math.round(sih4ActualOff * 10) / 10,
    };
  }, [
    rawRows,
    currentResult.depoStep,
    p,
    endStep,
    step3Start,
    step3End,
    mainRfOffCumTime,
    tvOpenCumTime,
    sih4CutCumTime,
    hasSiH4,
    calculatedTransitions.rxGasReachCum,
    totalCumulativeTime,
  ]);

  // -------------------------------------------------------------------------
  // [분석 레시피 & Step 기준 비-SiH4 공정 가스 자동 감지 (방안 1)]
  // -------------------------------------------------------------------------
  const detectedProcessGases = useMemo(() => {
    const depoStepNum = currentResult.depoStep ?? 3;
    const stableStepNum = currentResult.stableStep ?? 2;
    const depoRows = rawRows.filter(r => r.step === depoStepNum);
    const stableRows = rawRows.filter(r => r.step === stableStepNum);

    const candidates = [
      {
        name: 'N2O',
        set: p.pyroN2OSet,
        hwStart: s.depoStable_pyroN2O,
        hwEnd: endStep.depo_pyroN2O,
        getAct: (r: RawLogRow) => r.pyroN2O ?? 0,
        getSet: (r: RawLogRow) => r.pyroN2OSet ?? 0,
      },
      {
        name: 'Ar',
        set: p.pyroArSet,
        hwStart: s.depoStable_pyroAr ?? null,
        hwEnd: endStep.depo_pyroAr ?? null,
        getAct: (r: RawLogRow) => r.pyroAr ?? 0,
        getSet: (r: RawLogRow) => r.pyroArSet ?? 0,
      },
      {
        name: 'NH3',
        set: p.pyroNH3Set,
        hwStart: s.depoStable_pyroNH3,
        hwEnd: endStep.depo_pyroNH3,
        getAct: (r: RawLogRow) => r.pyroNH3 ?? 0,
        getSet: (r: RawLogRow) => r.pyroNH3Set ?? 0,
      },
      {
        name: 'PN2',
        set: p.pyroPN2Set,
        hwStart: s.depoStable_pyroPN2,
        hwEnd: endStep.depo_pyroPN2,
        getAct: (r: RawLogRow) => r.pyroPN2 ?? 0,
        getSet: (r: RawLogRow) => r.pyroPN2Set ?? 0,
      },
      {
        name: 'H2',
        set: p.pyroH2Set,
        hwStart: s.depoStable_pyroH2,
        hwEnd: endStep.depo_pyroH2,
        getAct: (r: RawLogRow) => r.pyroH2 ?? 0,
        getSet: (r: RawLogRow) => r.pyroH2Set ?? 0,
      },
      {
        name: 'NF3',
        set: p.oxyNF3Set,
        hwStart: null,
        hwEnd: null,
        getAct: (r: RawLogRow) => r.oxyNF3 ?? 0,
        getSet: (r: RawLogRow) => r.oxyNF3Set ?? 0,
      },
    ];

    const detected: Array<{
      name: string;
      set: number;
      label: string;
      startTime: number;
      reachTime: number;
      downStartTime: number;
      offTime: number;
    }> = [];

    for (const cand of candidates) {
      const maxDepoAct = depoRows.length > 0 ? Math.max(...depoRows.map(cand.getAct)) : 0;
      const maxStableAct = stableRows.length > 0 ? Math.max(...stableRows.map(cand.getAct)) : 0;
      const maxAct = Math.max(maxDepoAct, maxStableAct);

      let effectiveSet = (cand.set !== null && cand.set !== undefined && cand.set > 0) ? cand.set : null;
      if (!effectiveSet && depoRows.length > 0) {
        const rowMaxSet = Math.max(...depoRows.map(cand.getSet));
        if (rowMaxSet > 0) effectiveSet = rowMaxSet;
      }
      if (!effectiveSet && stableRows.length > 0) {
        const rowMaxSet = Math.max(...stableRows.map(cand.getSet));
        if (rowMaxSet > 0) effectiveSet = rowMaxSet;
      }

      // 선택한 Step(분석 대상 Step)에서 실제로 흐른 가스만 표시
      //  - 유량(Act) 데이터가 있는 가스: 이 Step 안에서 Act ≥ 10 sccm인 행이 있어야 함
      //    (이전 Step의 Set 값이 남아 있거나, 안정화 Step에서만 흐른 가스가 이 Step에 Stable로 그려지는 오류 방지)
      //  - 유량 데이터가 아예 없는 가스: 이 Step 안의 Set > 0으로 판단
      const hasActData = rawRows.some(r => cand.getAct(r) > 0);
      const depoSetMax = depoRows.length > 0 ? Math.max(...depoRows.map(cand.getSet)) : 0;
      const isDetected = hasActData ? maxDepoAct >= 10 : depoSetMax > 0;
      if (!isDetected) continue;

      const setVal = effectiveSet ?? (maxAct > 0 ? Math.round(maxAct) : 0);

      // 1. Start Time (Ramp 시작)
      let startTime = step2Start + 0.5;
      if (cand.hwStart !== null && cand.hwStart !== undefined && !isNaN(cand.hwStart)) {
        startTime = Math.round((step2Start + cand.hwStart) * 10) / 10;
      } else if (rawRows.length > 0) {
        const activeRow = rawRows.find(
          r => r.elapsedSec >= step2Start && (cand.getAct(r) >= 10 || cand.getSet(r) > 0)
        );
        if (activeRow) {
          startTime = Math.round(activeRow.elapsedSec * 10) / 10;
        }
      }

      // 2. Reach Time (Ramp 완료 / Set 도달)
      let reachTime = Math.round((startTime + 1.0) * 10) / 10;
      const targetReachVal = setVal > 0 ? setVal * (1 - gasWarningPct) : 10;
      if (rawRows.length > 0) {
        const reachedRow = rawRows.find(
          r => r.elapsedSec >= startTime && cand.getAct(r) >= targetReachVal
        );
        if (reachedRow) {
          reachTime = Math.round(reachedRow.elapsedSec * 10) / 10;
        }
      }
      reachTime = Math.max(startTime + 0.3, Math.min(step2End, reachTime));

      // 3. Down Start & Flow Off Time
      const offThreshold = Math.max(5, setVal * 0.02);
      const dropThreshold = setVal > 0 ? setVal * 0.90 : 10;

      let downStartTime: number | null = null;
      let offTime: number | null = null;

      if (rawRows.length > 0) {
        const depoStartIdx = rawRows.findIndex(r => r.step === depoStepNum);
        const searchStartIdx = depoStartIdx !== -1 ? depoStartIdx : 0;
        let isPastPeak = false;

        for (let i = searchStartIdx; i < rawRows.length; i++) {
          const r = rawRows[i];
          const val = cand.getAct(r);

          if (val >= dropThreshold) {
            isPastPeak = true;
          }

          if (isPastPeak && downStartTime === null && val < dropThreshold) {
            downStartTime = Math.round(r.elapsedSec * 10) / 10;
          }

          if (isPastPeak && val <= offThreshold) {
            offTime = Math.round(r.elapsedSec * 10) / 10;
            break;
          }

          if (r.step > depoStepNum + 2) break;
        }
      }

      // Fallbacks
      let finalOffTime = offTime !== null ? offTime : step3End;
      if (cand.hwEnd !== null && cand.hwEnd !== undefined && cand.hwEnd > 0) {
        finalOffTime = Math.round((step3Start + cand.hwEnd) * 10) / 10;
      }

      let finalDownStart = downStartTime !== null ? downStartTime : mainRfOffCumTime;
      finalDownStart = Math.min(finalDownStart, finalOffTime);
      if (finalOffTime - finalDownStart < 0.5) {
        finalDownStart = Math.max(reachTime + 0.5, finalOffTime - 1.0);
      }

      detected.push({
        name: cand.name,
        set: setVal,
        label: `${cand.name} (${setVal ? setVal.toLocaleString() : 'Set'} sccm)`,
        startTime,
        reachTime,
        downStartTime: finalDownStart,
        offTime: finalOffTime,
      });
    }

    if (detected.length === 0) {
      detected.push({
        name: 'Process Gas',
        set: 0,
        label: '반응 가스 (Process Gas)',
        startTime: midOtherGasStart,
        reachTime: calculatedTransitions.rxGasReachCum,
        downStartTime: rxGasDownStart,
        offTime: rxGasOffCumTime,
      });
    }

    return detected;
  }, [
    currentResult.depoStep,
    currentResult.stableStep,
    rawRows,
    p,
    s,
    endStep,
    step2Start,
    step2End,
    step3Start,
    step3End,
    mainRfOffCumTime,
    midOtherGasStart,
    calculatedTransitions.rxGasReachCum,
    rxGasDownStart,
    rxGasOffCumTime,
    gasWarningPct,
  ]);

  const [zoomRange, setZoomRange] = useState<{ start: number; end: number }>({
    start: 0,
    end: totalCumulativeTime,
  });
  const zoomRangeRef = useRef(zoomRange);
  zoomRangeRef.current = zoomRange;

  // totalCumulativeTime 변경 시 zoomRange 재조정
  useEffect(() => {
    setZoomRange({ start: 0, end: totalCumulativeTime });
  }, [totalCumulativeTime]);

  const currentSpan = Math.max(1, zoomRange.end - zoomRange.start);
  const zoomLevel = Math.max(1.0, Math.round((totalCumulativeTime / currentSpan) * 10) / 10);

  // 시간 ➔ 픽셀 백분율 변환 (Linear, Zoom 적용)
  const toPct = (time: number) => {
    return ((time - zoomRange.start) / currentSpan) * 100;
  };

  const pctW = (start: number, end: number) => {
    return Math.max(0, ((end - start) / currentSpan) * 100);
  };

  // 백분율 ➔ 시간 역변환
  const pctToTime = (pct: number) => {
    return zoomRange.start + (pct / 100) * currentSpan;
  };

  // Non-passive 마우스 휠 이벤트 리스너 등록 (부드럽고 즉각적인 마우스 휠 줌 인/아웃)
  useEffect(() => {
    const el = trackContainerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mouseX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const mouseRatio = mouseX / rect.width;
      const span = zoomRangeRef.current.end - zoomRangeRef.current.start;
      const pivotTime = zoomRangeRef.current.start + mouseRatio * span;

      // 휠 위로 굴릴 때: 줌 인 (축소된 시간 윈도우) / 아래로 굴릴 때: 줌 아웃
      const factor = e.deltaY < 0 ? 0.75 : 1.333;
      let newSpan = span * factor;

      if (newSpan >= totalCumulativeTime) {
        setZoomRange({ start: 0, end: totalCumulativeTime });
        return;
      }
      if (newSpan < 2.0) newSpan = 2.0; // 최소 2초 단위까지 초정밀 확대

      let newStart = pivotTime - mouseRatio * newSpan;
      let newEnd = newStart + newSpan;

      if (newStart < 0) {
        newStart = 0;
        newEnd = newStart + newSpan;
      }
      if (newEnd > totalCumulativeTime) {
        newEnd = totalCumulativeTime;
        newStart = Math.max(0, newEnd - newSpan);
      }

      setZoomRange({
        start: Math.round(newStart * 10) / 10,
        end: Math.round(newEnd * 10) / 10,
      });
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
    };
  }, [totalCumulativeTime]);

  // 마우스 드래그 팬(Pan) 및 하단 줌 스크롤러 상태
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartXRef = useRef<number>(0);
  const dragStartRangeRef = useRef<{ start: number; end: number }>({ start: 0, end: totalCumulativeTime });

  // 하단 줌 스크롤러 (Mini-map Navigator) 드래그 및 클릭 상태
  const miniMapTrackRef = useRef<HTMLDivElement>(null);
  const [isMiniMapDragging, setIsMiniMapDragging] = useState<boolean>(false);
  const miniMapDragStartXRef = useRef<number>(0);
  const miniMapStartRangeRef = useRef<{ start: number; end: number }>({ start: 0, end: totalCumulativeTime });

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (zoomLevel <= 1.05) return;
    setIsDragging(true);
    dragStartXRef.current = e.clientX;
    dragStartRangeRef.current = { ...zoomRangeRef.current };
  };

  const handleMiniMapThumbMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsMiniMapDragging(true);
    miniMapDragStartXRef.current = e.clientX;
    miniMapStartRangeRef.current = { ...zoomRangeRef.current };
  };

  const handleMiniMapTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!miniMapTrackRef.current) return;
    const rect = miniMapTrackRef.current.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const clickRatio = clickX / rect.width;
    const targetCenterTime = clickRatio * totalCumulativeTime;
    const span = zoomRangeRef.current.end - zoomRangeRef.current.start;

    let newStart = targetCenterTime - span / 2;
    let newEnd = newStart + span;

    if (newStart < 0) {
      newStart = 0;
      newEnd = Math.min(totalCumulativeTime, span);
    }
    if (newEnd > totalCumulativeTime) {
      newEnd = totalCumulativeTime;
      newStart = Math.max(0, totalCumulativeTime - span);
    }

    setZoomRange({
      start: Math.round(newStart * 10) / 10,
      end: Math.round(newEnd * 10) / 10,
    });
  };

  // 윈도우 전역 마우스 이동/해제 리스너 (빠르게 드래그해도 중단 없이 부드럽게 시점 이동)
  useEffect(() => {
    if (!isDragging && !isMiniMapDragging) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (isMiniMapDragging && miniMapTrackRef.current) {
        const rect = miniMapTrackRef.current.getBoundingClientRect();
        const dx = e.clientX - miniMapDragStartXRef.current;
        const dt = (dx / rect.width) * totalCumulativeTime;
        const span = miniMapStartRangeRef.current.end - miniMapStartRangeRef.current.start;

        let newStart = miniMapStartRangeRef.current.start + dt;
        let newEnd = miniMapStartRangeRef.current.end + dt;

        if (newStart < 0) {
          newStart = 0;
          newEnd = span;
        }
        if (newEnd > totalCumulativeTime) {
          newEnd = totalCumulativeTime;
          newStart = Math.max(0, totalCumulativeTime - span);
        }

        setZoomRange({
          start: Math.round(newStart * 10) / 10,
          end: Math.round(newEnd * 10) / 10,
        });
      } else if (isDragging && trackContainerRef.current) {
        const rect = trackContainerRef.current.getBoundingClientRect();
        const dx = e.clientX - dragStartXRef.current;
        const span = dragStartRangeRef.current.end - dragStartRangeRef.current.start;
        const dt = -(dx / rect.width) * span;

        let newStart = dragStartRangeRef.current.start + dt;
        let newEnd = dragStartRangeRef.current.end + dt;

        if (newStart < 0) {
          newStart = 0;
          newEnd = span;
        }
        if (newEnd > totalCumulativeTime) {
          newEnd = totalCumulativeTime;
          newStart = Math.max(0, totalCumulativeTime - span);
        }

        setZoomRange({
          start: Math.round(newStart * 10) / 10,
          end: Math.round(newEnd * 10) / 10,
        });
      }
    };

    const handleWindowMouseUp = () => {
      setIsDragging(false);
      setIsMiniMapDragging(false);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isDragging, isMiniMapDragging, totalCumulativeTime]);

  const handleMouseUp = () => {
    setIsDragging(false);
  };



  // =========================================================================
  // [BB Mode / 연속 Depo 전환 반영]
  //  - Depo 1(다음 Step으로 이어짐): 이어지는 항목은 Step 경계에서 Down/Off로 그리지 않고
  //    'BB 유지 → Step N' 빗금 구간으로 실제로 꺼질 때까지 이어서 표시
  //  - Depo 2(이전 Step에서 이어짐): 이미 켜져 있던 항목은 Step 시작 전 구간을 Idle이 아닌
  //    'BB 유지 (Step N부터)' 빗금 구간으로 표시, Step 시작 후 새 Set ± 주의 %에 2행 연속 들어올 때까지 Ramp
  //  - 판단 근거는 H/W Control 표와 같은 분석 결과(cellStatus, bbEnd, bbStart)
  // =========================================================================
  const bbEnd = e.bbEnd ?? null;
  const bbStart = s.bbStart ?? null;
  const bbDepoFirstIdx = rawRows.findIndex(r => r.step === currentResult.depoStep);
  let bbDepoLastIdx = -1;
  for (let i = rawRows.length - 1; i >= 0; i--) {
    if (rawRows[i].step === currentResult.depoStep) { bbDepoLastIdx = i; break; }
  }
  const bbNextIdx = bbEnd && bbDepoLastIdx >= 0 && bbDepoLastIdx + 1 < rawRows.length ? bbDepoLastIdx + 1 : -1;
  const bbPrevIdx = bbStart && bbDepoFirstIdx > 0 ? bbDepoFirstIdx - 1 : -1;
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const tBbEnd = bbNextIdx >= 0 ? r1(rawRows[bbNextIdx].elapsedSec) : null;
  const tBbStart = bbPrevIdx >= 0 ? r1(rawRows[bbDepoFirstIdx].elapsedSec) : null;
  const endSt = (field: string) => (bbEnd && tBbEnd !== null ? e.cellStatus?.[field] : undefined);
  const startKeep = (field: string) => tBbStart !== null && s.cellStatus?.[field] === 'keep';
  const isRfBbEnd = e.endRef === 'stepChange' && tBbEnd !== null;
  const isRfBbStart = startKeep('depo_rfForwardAct');

  /** from 행부터 on이 이어지는 동안 진행, 처음 꺼진 행의 시간 (끝까지 켜져 있으면 마지막 행) */
  const runFwdEnd = (on: (r: RawLogRow) => boolean, from: number): number => {
    let k = from;
    while (k < rawRows.length && on(rawRows[k])) k++;
    return r1(rawRows[Math.min(k, rawRows.length - 1)].elapsedSec);
  };
  /** from 행부터 거꾸로 on이 이어지는 첫 행의 시간과 그 행의 Step */
  const runBackStart = (on: (r: RawLogRow) => boolean, from: number): { t: number; step: number } => {
    let k = from;
    while (k - 1 >= 0 && on(rawRows[k - 1])) k--;
    return { t: r1(rawRows[k].elapsedSec), step: rawRows[k].step };
  };
  /** Depo Step 안에서 값이 target ± tol(비율)에 2행 연속 들어온 시간 */
  const reachInDepo = (val: (r: RawLogRow) => number, target: number | null | undefined, tol: number): number | null => {
    if (!target || target <= 0 || bbDepoFirstIdx < 0) return null;
    const inB = (r?: RawLogRow) => !!r && r.step === currentResult.depoStep && Math.abs(val(r) - target) <= target * tol;
    for (let k = bbDepoFirstIdx; k <= bbDepoLastIdx; k++) {
      if (inB(rawRows[k]) && inB(rawRows[k + 1])) return r1(rawRows[k].elapsedSec);
    }
    return null;
  };
  const makeOn = (setG: (r: RawLogRow) => number, actG: (r: RawLogRow) => number) => {
    const hasSet = rawRows.some(r => setG(r) > 0);
    return (r: RawLogRow) => (hasSet ? setG(r) > 0.1 : actG(r) >= 5);
  };
  const rfThr = settings?.rfOnThresholdDepo ?? 300;
  const rfSetOfRow = (r: RawLogRow) => (r.rfForwardSetValue > 0 ? r.rfForwardSetValue : r.rfForwardSetValueAct);
  const rfOn = (r: RawLogRow) => rfSetOfRow(r) > 0 || r.rfForwardPowerAct >= rfThr;
  const nextStepNo = bbEnd?.otherStep;
  const prevStepNo = bbStart?.otherStep;
  const nextStepRowsBb = nextStepNo !== undefined ? rawRows.filter(r => r.step === nextStepNo) : [];
  const midNextRow = nextStepRowsBb.length > 0 ? nextStepRowsBb[Math.floor(nextStepRowsBb.length / 2)] : null;

  type GSeg = { s: number; e: number; kind: 'idle' | 'ramp' | 'stable' | 'down' | 'bb'; label?: string; color?: string; title?: string };
  const BB_STRIPE: React.CSSProperties = {
    backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.38) 0 5px, rgba(255,255,255,0) 5px 10px)',
  };
  const renderGSegs = (segs: GSeg[]) =>
    segs
      .filter(g => g.e - g.s > 0.001)
      .map((g, i) => {
        const base = 'absolute top-0 bottom-0 flex items-center justify-center truncate shadow-2xs';
        const cls =
          g.kind === 'idle'
            ? 'bg-[#CBD5E1] text-slate-700 font-bold text-[9px] border-r border-slate-300'
            : g.kind === 'ramp'
              ? 'bg-[#F59E0B] text-slate-950 font-extrabold border-r border-[#D97706] text-[9px] px-1'
              : g.kind === 'down'
                ? 'bg-[#EF4444] text-white font-extrabold border-r-2 border-[#DC2626] text-[9px] px-1'
                : g.kind === 'bb'
                  ? `${g.color ?? 'bg-slate-500'} text-white font-extrabold text-[9.5px] px-1 opacity-80`
                  : `${g.color ?? 'bg-slate-500'} text-white font-extrabold text-[10px] px-2 border-r-2 border-black/10`;
        const def = g.kind === 'idle' ? 'Idle' : g.kind === 'ramp' ? 'Ramp' : g.kind === 'down' ? 'Down' : '';
        return (
          <div
            key={`${g.kind}_${i}`}
            style={{ left: `${toPct(g.s)}%`, width: `${pctW(g.s, g.e)}%`, ...(g.kind === 'bb' ? BB_STRIPE : {}) }}
            className={`${base} ${cls}`}
            title={g.title ?? `${g.label ?? def} (${g.s.toFixed(1)}s ~ ${g.e.toFixed(1)}s)`}
          >
            {g.label ?? def}
          </div>
        );
      });

  /**
   * 한 트랙의 BB 구간 계산 (BB와 무관한 트랙이면 null → 기존 그림 그대로)
   * - startDef: BB 유지가 아닐 때의 Idle 끝(=Ramp 시작)과 Ramp 끝(=Stable 시작)
   * - endDef: BB 유지가 아닐 때 Stable 끝 이후 구간 (Down 등)
   */
  const buildBbTrack = (o: {
    startKeepOn: boolean;
    endKind: 'keep' | 'trans' | undefined;
    on: (r: RawLogRow) => boolean;
    reach: number | null;
    startDef: { rampStart: number; rampEnd: number };
    stableLabel: string;
    color: string;
    endDefSegs: (stableStart: number) => GSeg[];
    endBbLabel?: string;
    beforeBbSegs?: (stableStart: number) => GSeg[];
  }): GSeg[] | null => {
    const endBb = o.endKind !== undefined && tBbEnd !== null;
    if (!o.startKeepOn && !endBb) return null;
    const segs: GSeg[] = [];
    let stableStart: number;
    if (o.startKeepOn && tBbStart !== null && bbPrevIdx >= 0) {
      const back = runBackStart(o.on, bbPrevIdx);
      segs.push({ s: 0, e: back.t, kind: 'idle' });
      segs.push({ s: back.t, e: tBbStart, kind: 'bb', color: o.color, label: `BB 유지 (Step ${back.step}부터)` });
      const reach = o.reach !== null && o.reach > tBbStart ? o.reach : tBbStart;
      if (reach > tBbStart) segs.push({ s: tBbStart, e: reach, kind: 'ramp', title: `새 Set 도달 중 (${tBbStart.toFixed(1)}s ~ ${reach.toFixed(1)}s)` });
      stableStart = reach;
    } else {
      segs.push({ s: 0, e: o.startDef.rampStart, kind: 'idle' });
      segs.push({ s: o.startDef.rampStart, e: o.startDef.rampEnd, kind: 'ramp' });
      stableStart = o.startDef.rampEnd;
    }
    if (endBb && tBbEnd !== null && bbNextIdx >= 0) {
      const pre = o.beforeBbSegs ? o.beforeBbSegs(stableStart) : [{ s: stableStart, e: tBbEnd, kind: 'stable' as const, color: o.color, label: o.stableLabel }];
      segs.push(...pre);
      const fwd = runFwdEnd(o.on, bbNextIdx);
      segs.push({
        s: tBbEnd,
        e: Math.max(tBbEnd, fwd),
        kind: 'bb',
        color: o.color,
        label: o.endBbLabel ?? `BB ${o.endKind === 'trans' ? '전환' : '유지'} → Step ${nextStepNo}`,
      });
      segs.push({ s: Math.max(tBbEnd, fwd), e: totalCumulativeTime, kind: 'idle' });
    } else {
      segs.push(...o.endDefSegs(stableStart));
    }
    return segs;
  };

  const gasWarn = gasWarningPct;
  const sih4On = makeOn(r => r.pyroSiH4Set ?? 0, r => r.pyroSiH4 ?? 0);
  const bbSih4Segs = hasSiH4
    ? buildBbTrack({
        startKeepOn: startKeep('depoStable_pyroSiH4'),
        endKind: endSt('depo_pyroSiH4') as 'keep' | 'trans' | undefined,
        on: sih4On,
        reach: reachInDepo(r => r.pyroSiH4 ?? 0, p.pyroSiH4Set, gasWarn),
        startDef: { rampStart: sih4StartStep2, rampEnd: calculatedTransitions.sih4ReachCum },
        stableLabel: `Stable (${p.pyroSiH4Set?.toLocaleString() ?? '-'} sccm)`,
        color: 'bg-[#059669]',
        endDefSegs: st => [
          { s: st, e: sih4CutCumTime, kind: 'stable', color: 'bg-[#059669]', label: `Stable (${p.pyroSiH4Set?.toLocaleString() ?? '-'} sccm)` },
          { s: sih4CutCumTime, e: sih4ActualOffCumTime, kind: 'down' },
          { s: sih4ActualOffCumTime, e: totalCumulativeTime, kind: 'idle' },
        ],
      })
    : null;

  const GAS_BB_DEFS: Record<string, { set: (r: RawLogRow) => number; act: (r: RawLogRow) => number; endF: string; startF: string; pSet: number | null | undefined }> = {
    NH3: { set: r => r.pyroNH3Set ?? 0, act: r => r.pyroNH3 ?? 0, endF: 'depo_pyroNH3', startF: 'depoStable_pyroNH3', pSet: p.pyroNH3Set },
    PN2: { set: r => r.pyroPN2Set ?? 0, act: r => r.pyroPN2 ?? 0, endF: 'depo_pyroPN2', startF: 'depoStable_pyroPN2', pSet: p.pyroPN2Set },
    N2O: { set: r => r.pyroN2OSet ?? 0, act: r => r.pyroN2O ?? 0, endF: 'depo_pyroN2O', startF: 'depoStable_pyroN2O', pSet: p.pyroN2OSet },
    H2: { set: r => r.pyroH2Set ?? 0, act: r => r.pyroH2 ?? 0, endF: 'depo_pyroH2', startF: 'depoStable_pyroH2', pSet: p.pyroH2Set },
    Ar: {
      set: r => Math.max(r.pyroArSet ?? 0, r.oxyArSet ?? 0),
      act: r => Math.max(r.pyroAr ?? 0, r.oxyAr ?? 0),
      endF: 'depo_pyroAr',
      startF: 'depoStable_pyroAr',
      pSet: p.pyroArSet,
    },
  };
  const bbGasSegs: Record<string, GSeg[] | null> = {};
  detectedProcessGases.forEach(g => {
    const d = GAS_BB_DEFS[g.name];
    if (!d) { bbGasSegs[g.name] = null; return; }
    const label = `Stable (${g.name}${g.set ? ` ${g.set.toLocaleString()} sccm` : ''})`;
    bbGasSegs[g.name] = buildBbTrack({
      startKeepOn: startKeep(d.startF),
      endKind: endSt(d.endF) as 'keep' | 'trans' | undefined,
      on: makeOn(d.set, d.act),
      reach: reachInDepo(d.act, g.set || d.pSet, gasWarn),
      startDef: { rampStart: g.startTime, rampEnd: g.reachTime },
      stableLabel: label,
      color: 'bg-[#D97706]',
      endDefSegs: st => [
        { s: st, e: g.downStartTime, kind: 'stable', color: 'bg-[#D97706]', label },
        { s: g.downStartTime, e: g.offTime, kind: 'down' },
        { s: g.offTime, e: totalCumulativeTime, kind: 'idle' },
      ],
    });
  });

  const tvKind = endSt('depo_tvCtrlMode') as 'keep' | 'trans' | undefined;
  const bbTvSegs = buildBbTrack({
    startKeepOn: startKeep('depoStable_tvCtrlMode'),
    endKind: tvKind,
    on: r => isTvPressureActive(r),
    reach: reachInDepo(r => r.tvPressure ?? 0, p.tvPressureSet, pressWarningPct),
    startDef: { rampStart: tvModeStartStep2, rampEnd: calculatedTransitions.tvReachCum },
    stableLabel: `Stable (${p.tvPressureSet ?? '-'} mTorr)`,
    color: 'bg-[#0284C7]',
    endBbLabel:
      tvKind === 'trans' && midNextRow
        ? `BB 전환 → Step ${nextStepNo} (${Math.round(midNextRow.tvPressureSet ?? 0).toLocaleString()} mTorr)`
        : undefined,
    endDefSegs: st => [
      { s: st, e: tvOpenCumTime, kind: 'stable', color: 'bg-[#0284C7]', label: `Stable (${p.tvPressureSet ?? '-'} mTorr)` },
      { s: tvOpenCumTime, e: tvOpenEndCumTime, kind: 'down' },
      { s: tvOpenEndCumTime, e: totalCumulativeTime, kind: 'idle' },
    ],
  });

  // RF: BB 전환이면 Step 경계까지 Stable(또는 RSD), 이후 다음 Step Set으로 이어지는 빗금 구간
  const rfStableLabel = `Stable (${p.rfForwardSetValue} W)`;
  const sih4CutBeforeBb = hasSiH4 && endSt('depo_pyroSiH4') === undefined && tBbEnd !== null && sih4CutCumTime < tBbEnd;
  const bbRfSegs = buildBbTrack({
    startKeepOn: isRfBbStart,
    endKind: isRfBbEnd ? 'trans' : undefined,
    on: rfOn,
    reach: reachInDepo(r => r.rfForwardPowerAct, p.rfForwardSetValue, rfWarningPct),
    startDef: { rampStart: rfOnCumTime, rampEnd: calculatedTransitions.rfReachCum },
    stableLabel: rfStableLabel,
    color: 'bg-[#2563EB]',
    endBbLabel: midNextRow ? `BB 전환 → Step ${nextStepNo} (${Math.round(rfSetOfRow(midNextRow)).toLocaleString()} W)` : undefined,
    beforeBbSegs: st =>
      sih4CutBeforeBb && tBbEnd !== null
        ? [
            { s: st, e: sih4CutCumTime, kind: 'stable', color: 'bg-[#2563EB]', label: rfStableLabel },
            { s: sih4CutCumTime, e: tBbEnd, kind: 'down', label: 'RSD' },
          ]
        : [{ s: st, e: tBbEnd ?? st, kind: 'stable', color: 'bg-[#2563EB]', label: rfStableLabel }],
    endDefSegs: st =>
      hasSiH4
        ? [
            { s: st, e: sih4CutCumTime, kind: 'stable', color: 'bg-[#2563EB]', label: rfStableLabel },
            { s: sih4CutCumTime, e: mainRfOffCumTime, kind: 'down' },
            { s: mainRfOffCumTime, e: totalCumulativeTime, kind: 'idle' },
          ]
        : [
            { s: st, e: mainRfOffCumTime, kind: 'stable', color: 'bg-[#2563EB]', label: rfStableLabel },
            { s: mainRfOffCumTime, e: totalCumulativeTime, kind: 'idle' },
          ],
  });

  // Lift: 연속 Depo면 Step 경계에서 내려가지 않고 다음 Step Spacing으로 이어짐
  const liftLabel = `Stable (${liftSpacingValue.toLocaleString()} mils)`;
  const prevStepItemBb = prevStepNo !== undefined ? stepList.find(st => st.step === prevStepNo) : undefined;
  const nextStepItemBb = nextStepNo !== undefined ? stepList.find(st => st.step === nextStepNo) : undefined;
  const bbLiftSegs: GSeg[] | null = (() => {
    const endBb = tBbEnd !== null && !!nextStepItemBb;
    const startBb = tBbStart !== null && !!prevStepItemBb;
    if (!endBb && !startBb) return null;
    const segs: GSeg[] = [];
    if (startBb && prevStepItemBb && tBbStart !== null) {
      segs.push({ s: 0, e: prevStepItemBb.startElapsedSec, kind: 'idle' });
      segs.push({ s: prevStepItemBb.startElapsedSec, e: tBbStart, kind: 'bb', color: 'bg-[#0D9488]', label: `Step ${prevStepNo}부터 이어짐` });
      segs.push({ s: tBbStart, e: Math.max(tBbStart, liftMoveUpEnd), kind: 'ramp' });
    } else {
      if (step2Start > 0) segs.push({ s: 0, e: step2Start, kind: 'idle' });
      segs.push({ s: step2Start, e: liftMoveUpEnd, kind: 'ramp' });
    }
    const st = startBb && tBbStart !== null ? Math.max(tBbStart, liftMoveUpEnd) : liftMoveUpEnd;
    if (endBb && nextStepItemBb && tBbEnd !== null) {
      const nextSp = midNextRow ? Math.round(midNextRow.liftSpacingSet || midNextRow.liftSpacing || 0) : 0;
      const downS = nextStepItemBb.endElapsedSec;
      const downE = Math.min(totalCumulativeTime, r1(downS + 2.0));
      segs.push({ s: st, e: tBbEnd, kind: 'stable', color: 'bg-[#0D9488]', label: liftLabel });
      segs.push({ s: tBbEnd, e: downS, kind: 'bb', color: 'bg-[#0D9488]', label: `→ Step ${nextStepNo}${nextSp ? ` (${nextSp.toLocaleString()} mils)` : ''}` });
      segs.push({ s: downS, e: downE, kind: 'down' });
      segs.push({ s: downE, e: totalCumulativeTime, kind: 'idle' });
    } else {
      segs.push({ s: st, e: liftDechuckStart, kind: 'stable', color: 'bg-[#0D9488]', label: liftLabel });
      segs.push({ s: liftDechuckStart, e: liftDechuckEnd, kind: 'down' });
      segs.push({ s: liftDechuckEnd, e: totalCumulativeTime, kind: 'idle' });
    }
    return segs;
  })();
  const hasBbView = !!(bbSih4Segs || bbTvSegs || bbRfSegs || bbLiftSegs || Object.values(bbGasSegs).some(Boolean));
  /** Set 도달 시점: 이전 Step에서 이어진 항목은 새 Set ± 주의 % 도달 시점 */
  const bbReach = (keep: boolean, reach: number | null, fallback: number) => (keep && tBbStart !== null ? (reach !== null && reach > tBbStart ? reach : tBbStart) : fallback);

  // Control 시점 핵심 지표 리스트 (상태 기반 미니멀 단색화 - Set 도달 완료 파란색, Off 빨간색)
  const controlMilestones = [
    // Depo Step Set 도달 완료 시점 (파란색 계열)
    ...(hasSiH4 ? [{ key: 'sih4_reach', label: 'SiH4 Set 도달', time: bbReach(startKeep('depoStable_pyroSiH4'), reachInDepo(r => r.pyroSiH4 ?? 0, p.pyroSiH4Set, gasWarn), calculatedTransitions.sih4ReachCum), color: '#2563EB', actionType: 'on' as const, group: 'depo' as const }] : []),
    ...detectedProcessGases.map((g, idx) => ({
      key: `proc_gas_${g.name.toLowerCase()}_reach_${idx}`,
      label: `${g.name} Set 도달`,
      time: GAS_BB_DEFS[g.name]
        ? bbReach(startKeep(GAS_BB_DEFS[g.name].startF), reachInDepo(GAS_BB_DEFS[g.name].act, g.set || GAS_BB_DEFS[g.name].pSet, gasWarn), g.reachTime)
        : g.reachTime,
      color: '#2563EB',
      actionType: 'on' as const,
      group: 'depo' as const,
    })),
    { key: 'press_reach', label: 'Pressure Set 도달', time: bbReach(startKeep('depoStable_tvCtrlMode'), reachInDepo(r => r.tvPressure ?? 0, p.tvPressureSet, pressWarningPct), calculatedTransitions.tvReachCum), color: '#2563EB', actionType: 'on' as const, group: 'depo' as const },
    { key: 'rf_reach', label: 'RF Set 도달', time: bbReach(isRfBbStart, reachInDepo(r => r.rfForwardPowerAct, p.rfForwardSetValue, rfWarningPct), calculatedTransitions.rfReachCum), color: '#2563EB', actionType: 'on' as const, group: 'depo' as const },
    ...(liftSpacingValue > 0 ? [{ key: 'lift_reach', label: 'Lift Set 도달', time: calculatedTransitions.liftReachCum, color: '#2563EB', actionType: 'on' as const, group: 'depo' as const }] : []),
    // Depo Step 제어 종료 / 차단 완료 시점 (빨간색 계열)
    ...(hasSiH4
      ? [endSt('depo_pyroSiH4') && tBbEnd !== null
          ? { key: 'sih4_off', label: `SiH4 → Step ${nextStepNo} 유지`, time: tBbEnd, color: '#DC2626', actionType: 'off' as const, group: 'depo' as const }
          : { key: 'sih4_off', label: 'SiH4 Flow Off', time: sih4ActualOffCumTime, color: '#DC2626', actionType: 'off' as const, group: 'depo' as const }]
      : []),
    isRfBbEnd && tBbEnd !== null
      ? { key: 'rf_off', label: `RF BB 전환 → Step ${nextStepNo}`, time: tBbEnd, color: '#DC2626', actionType: 'off' as const, group: 'depo' as const }
      : { key: 'rf_off', label: 'RF Off', time: mainRfOffCumTime, color: '#DC2626', actionType: 'off' as const, group: 'depo' as const },
    ...detectedProcessGases.map((g, idx) => ({
      key: `proc_gas_${g.name.toLowerCase()}_off_${idx}`,
      label: GAS_BB_DEFS[g.name] && endSt(GAS_BB_DEFS[g.name].endF) ? `${g.name} → Step ${nextStepNo} 유지` : `${g.name} Flow Off`,
      time: GAS_BB_DEFS[g.name] && endSt(GAS_BB_DEFS[g.name].endF) && tBbEnd !== null ? tBbEnd : g.offTime,
      color: '#DC2626',
      actionType: 'off' as const,
      group: 'depo' as const,
    })),
    tvKind && tBbEnd !== null
      ? { key: 'press_off', label: `Pressure → Step ${nextStepNo} ${tvKind === 'trans' ? '전환' : '유지'}`, time: tBbEnd, color: '#DC2626', actionType: 'off' as const, group: 'depo' as const }
      : { key: 'press_off', label: 'Pressure Off', time: tvOpenEndCumTime, color: '#DC2626', actionType: 'off' as const, group: 'depo' as const },
  ];

  return (
    <div ref={rootRef} data-gantt className="bg-[#F8FAFC] border border-slate-400 rounded-xl overflow-hidden shadow-xs transition-all scroll-mt-[68px]">
      {/* Header Bar */}
      <div className="px-3 py-1.5 bg-[#E2E8F0] border-b border-slate-300 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-5 h-5 rounded-md bg-slate-200 border border-slate-400 flex items-center justify-center text-slate-800 shadow-2xs">
            <Clock className="w-3 h-3" />
          </div>
          <div>
            <h3 className="text-[13px] font-bold text-[#0F172A] tracking-tight">
              공정 Sequence 타임라인
            </h3>
          </div>
          {/* 지금 보는 Recipe (Run 선택은 공정 분석 매니저 · 표 번호 칸) */}
          <span
            data-gantt-recipe
            className="flex items-center gap-1 min-w-0 max-w-[420px] px-1.5 py-0.5 rounded-md bg-white border border-slate-300 text-[11px] font-bold text-[#0F172A]"
            title={`${currentResult.processData.rcpName} · Run 선택: 왼쪽 공정 분석 매니저 또는 아래 표의 번호 칸`}
          >
            <span className="shrink-0 px-1 rounded bg-[#2563EB] text-white text-[9.5px] leading-[15px] tabular-nums">#{currentFileNo}</span>
            <span className="truncate">{currentResult.processData.rcpName}</span>
          </span>
          {/* 한 Log에 Depo가 여러 개일 때만: Depo 선택 칩 */}
          {siblingResults.length > 1 && (
            <div data-depo-chips className="flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-300/70" role="radiogroup" aria-label="Depo 선택">
              {siblingResults.map(({ r, idx }) => {
                const on = idx === selectedRunIdx;
                return (
                  <button
                    key={r.resultId || `${r.fileId}_${r.depoStep}_${idx}`}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => {
                      setSelectedRunIdx(idx);
                      onSelectRunIdx?.(idx);
                    }}
                    className={`flex items-center gap-1 px-1.5 h-[20px] rounded-md text-[10.5px] font-bold whitespace-nowrap cursor-pointer transition-colors ${
                      on ? 'bg-white text-[#1D4ED8] shadow-2xs' : 'text-[#475569] hover:text-[#0F172A]'
                    }`}
                    title={`#${r.displayNo} · Depo ${r.subIndex ?? ''} (Step ${r.depoStep}${r.depoStepName ? ` ${r.depoStepName}` : ''})`}
                  >
                    <span>Depo {r.subIndex}</span>
                    <span className={`text-[9px] font-semibold ${on ? 'text-[#2563EB]' : 'text-[#64748B]'}`}>S{r.depoStep}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* View Controls & Feature Toggles */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <CopyImageButton compact target={() => rootRef.current} fileName="Sequence_타임라인.png" />
          {/* Zoom In/Out & Reset Buttons */}
          <div className="flex items-center bg-white p-0.5 rounded-lg border border-slate-300 text-[11px] shadow-2xs">
            <button
              type="button"
              onClick={() => {
                const center = (zoomRange.start + zoomRange.end) / 2;
                const newSpan = Math.max(2.0, currentSpan * 0.7);
                const s = Math.max(0, center - newSpan / 2);
                setZoomRange({ start: s, end: Math.min(totalCumulativeTime, s + newSpan) });
              }}
              className="p-1 text-[#475569] hover:text-[#0F172A] hover:bg-slate-100 rounded transition-colors cursor-pointer"
              title="시간 확대 (줌 인)"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => {
                const center = (zoomRange.start + zoomRange.end) / 2;
                const newSpan = Math.min(totalCumulativeTime, currentSpan * 1.4);
                let s = Math.max(0, center - newSpan / 2);
                if (s + newSpan > totalCumulativeTime) s = Math.max(0, totalCumulativeTime - newSpan);
                setZoomRange({ start: s, end: Math.min(totalCumulativeTime, s + newSpan) });
              }}
              className="p-1 text-[#475569] hover:text-[#0F172A] hover:bg-slate-100 rounded transition-colors cursor-pointer"
              title="시간 축소 (줌 아웃)"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setZoomRange({ start: 0, end: totalCumulativeTime })}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                zoomLevel <= 1.05
                  ? 'bg-slate-100 text-[#0F172A] border border-slate-300'
                  : 'text-[#475569] hover:text-[#0F172A] hover:bg-slate-100'
              }`}
              title="전체 0.0s ~ 끝까지 전체 보기 리셋"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>전체 (1x)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 bg-white hover:bg-slate-100 text-[#475569] hover:text-[#0F172A] rounded-lg border border-slate-300 transition-colors shadow-2xs cursor-pointer"
            title={isCollapsed ? '타임라인 펼치기' : '타임라인 접기'}
          >
            {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="p-3 bg-[#F1F5F9]">
          {(
            <div className="flex flex-col lg:flex-row gap-4 items-start">

              {/* 우측 메인: 6-Track 타임라인 영역 */}
              <div className="flex-1 min-w-0 w-full space-y-4">
              {/* Visual Multi-Track Gantt Bars Container */}
              <div className="bg-[#EAEFF5] border border-slate-400 rounded-xl p-4 space-y-3.5 shadow-2xs">
                {/* 4대 상태 머신 범례 (Idle - Ramp - Stable - Down) */}
                <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-300 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    {zoomLevel > 1.05 && (
                      <span className="text-[10px] text-[#1E40AF] bg-[#EFF6FF] px-2 py-0.5 rounded font-mono border border-[#BFDBFE] flex items-center gap-1 font-bold">
                        <span>🔍 {zoomLevel.toFixed(1)}x 확대 ({zoomRange.start.toFixed(1)}s ~ {zoomRange.end.toFixed(1)}s)</span>
                      </span>
                    )}
                  </div>

                  {/* 4대 상태 범례 (실무 엑셀 단색 체계: Ramp-노랑, Down-붉은색, Stable-계통별 고밀도 단색) */}
                  <div className="flex items-center gap-3.5 text-[10px] text-[#475569] flex-wrap font-medium">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 rounded bg-[#CBD5E1] border border-slate-400" />
                      <span className="font-semibold text-slate-700">Idle (대기)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 rounded bg-[#F59E0B] border border-[#D97706]" />
                      <span className="text-amber-900 font-bold">Ramp (도달 중 · 노랑 단색)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center -space-x-1">
                        <span className="w-2.5 h-3.5 rounded-l bg-[#2563EB] border border-[#1D4ED8]" title="RF" />
                        <span className="w-2.5 h-3.5 bg-[#0D9488] border-y border-[#0F766E]" title="Lift" />
                        <span className="w-2.5 h-3.5 bg-[#D97706] border-y border-[#B45309]" title="Gas" />
                        <span className="w-2.5 h-3.5 bg-[#0284C7] border-y border-[#0369A1]" title="Press" />
                        <span className="w-2.5 h-3.5 rounded-r bg-[#059669] border border-[#047857]" title="SiH4" />
                      </div>
                      <span className="text-[#0F172A] font-bold">Stable (계통별 정상 안정 구간)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 rounded bg-[#EF4444] border border-[#DC2626]" />
                      <span className="text-rose-900 font-bold">Down (하강/차단 · 붉은색 단색)</span>
                    </div>
                    {hasBbView && (
                      <div className="flex items-center gap-1.5" title="BB Mode 또는 연속 Depo로 Step 경계에서 끊기지 않고 이어지는 구간">
                        <span className="w-3.5 h-3.5 rounded bg-[#64748B] border border-slate-500" style={BB_STRIPE} />
                        <span className="text-slate-800 font-bold">BB 유지/전환 (Step 경계를 넘어 이어짐 · 빗금)</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Track Container */}
                <div className="overflow-x-visible overflow-y-visible pb-2">
                  <div
                    ref={trackContainerRef}
                    onMouseDown={handleMouseDown}
                    onMouseUp={handleMouseUp}
                    className={`space-y-3.5 relative select-none transition-all duration-75 w-full ${
                      isDragging ? 'cursor-grabbing' : zoomLevel > 1.05 ? 'cursor-grab' : ''
                    }`}
                  >

                    {/* Interactive Milestone Highlight Lines (다중 누적 점선 표시) */}
                    {controlMilestones
                      .filter((ms) => selectedMilestoneKeys.includes(ms.key))
                      .map((ms) => {
                        if (ms.time < zoomRange.start || ms.time > zoomRange.end) return null;
                        return (
                          <div
                            key={`ms-line-${ms.key}`}
                            style={{ left: `${toPct(ms.time)}%` }}
                            className="absolute top-0 bottom-0 w-[2px] z-25 pointer-events-none animate-pulse"
                          >
                            <div
                              style={{ borderColor: ms.color }}
                              className="w-full h-full border-r-2 border-dashed"
                            />
                            <div
                              style={{ backgroundColor: '#FFFFFF', borderColor: ms.color, color: ms.color }}
                              className="absolute -top-5 -left-10 px-2 py-0.5 border text-[9px] font-mono font-bold rounded shadow-md whitespace-nowrap"
                            >
                              {ms.label}: {ms.time}s
                            </div>
                          </div>
                        );
                      })}



                    {/* ========================================================================= */}
                    {/* Track 1: Step 1 ~ 9 세부 단계 레인 (Recipe Step Sequence) */}
                    {/* ========================================================================= */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-xs text-[#0F172A] font-bold">
                        <span className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-[#475569]" />
                          <span>1. 공정 스텝 (Recipe Sequence)</span>
                        </span>
                      </div>
                      <div className="h-7 w-full bg-[#CBD5E1]/50 rounded-lg border border-slate-400 relative overflow-hidden text-[10px] font-bold shadow-2xs">
                        {stepList.map((st) => {
                          const leftPct = toPct(st.startElapsedSec);
                          const widthPct = pctW(st.startElapsedSec, st.endElapsedSec);
                          const isCurrentDepo = st.step === (currentResult.depoStep ?? 3);
                          const isOtherDepo = !isCurrentDepo && (currentResult.allDepoStepsInFile?.includes(st.step) ?? false);

                          return (
                            <div
                              key={`step-box-${st.step}`}
                              style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                              onClick={() => {
                                setZoomRange({
                                  start: Math.max(0, st.startElapsedSec - 1),
                                  end: Math.min(totalCumulativeTime, st.endElapsedSec + 1),
                                });
                              }}
                              className={`absolute top-0 bottom-0 flex items-center justify-center px-1 truncate cursor-pointer transition-colors hover:brightness-95 ${
                                isCurrentDepo
                                  ? 'bg-[#1D4ED8] text-white font-extrabold shadow-xs ring-1 ring-blue-300'
                                  : isOtherDepo
                                  ? 'bg-[#2563EB] text-white font-bold'
                                  : 'bg-[#CBD5E1] text-slate-800 font-bold hover:bg-[#94A3B8]'
                              }`}
                              title={`Step ${st.step}: ${st.stepName} (${st.startElapsedSec}s ~ ${st.endElapsedSec}s, ${st.durationSec}s 소요)${isCurrentDepo ? ' [현재 선택된 Depo Step]' : isOtherDepo ? ' [동일 런 내 Depo Step]' : ''} - 클릭 시 확대`}
                            >
                              <span className="truncate flex items-center gap-1 text-[10px] font-bold">
                                {(isCurrentDepo || isOtherDepo) && <Zap className="w-3 h-3 text-yellow-300 fill-yellow-300 shrink-0" />}
                                <span>Step {st.step}</span>
                                <span className={`font-medium text-[10px] truncate ${isCurrentDepo || isOtherDepo ? 'text-blue-100' : 'text-slate-600'}`}>({st.stepName})</span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* ========================================================================= */}
                    {/* Track 2: Power Lift (서셉터 위치 & Spacing) - Solid Teal 단색 */}
                    {/* ========================================================================= */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-xs text-[#0F172A] font-bold">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#0D9488]" />
                          <span>2. Power Lift (서셉터 & Spacing)</span>
                        </span>
                      </div>
                      <div className="h-7 w-full bg-[#CBD5E1]/40 rounded-lg border border-slate-300 relative overflow-hidden shadow-2xs">
                        {bbLiftSegs ? (
                          renderGSegs(bbLiftSegs)
                        ) : (
                        <>
                        {/* 0. Idle before ramp (스텝 시작 전) */}
                        {step2Start > 0 && (
                          <div
                            style={{ left: `${toPct(0)}%`, width: `${pctW(0, step2Start)}%` }}
                            className="absolute top-0 bottom-0 bg-[#CBD5E1] border-r border-slate-300 flex items-center justify-center text-[9px] text-slate-700 font-bold"
                          >
                            Idle
                          </div>
                        )}
                        {/* 1. Ramp - Solid Yellow 단색 */}
                        <div
                          style={{
                            left: `${toPct(step2Start)}%`,
                            width: `${pctW(step2Start, liftMoveUpEnd)}%`,
                          }}
                          className="absolute top-0 bottom-0 bg-[#F59E0B] text-slate-950 font-extrabold border-r border-[#D97706] flex items-center justify-center text-[9px] px-1 shadow-2xs"
                        >
                          Ramp
                        </div>
                        {/* 2. Stable - Solid Rich Teal 단색 */}
                        <div
                          style={{ left: `${toPct(liftMoveUpEnd)}%`, width: `${pctW(liftMoveUpEnd, liftDechuckStart)}%` }}
                          className="absolute top-0 bottom-0 bg-[#0D9488] text-white flex items-center justify-center text-[10px] font-extrabold px-2 border-r-2 border-[#0F766E] shadow-2xs"
                        >
                          <span>Stable ({liftSpacingValue.toLocaleString()} mils)</span>
                        </div>
                        {/* 3. Down - Solid Red 단색 */}
                        <div
                          style={{
                            left: `${toPct(liftDechuckStart)}%`,
                            width: `${pctW(liftDechuckStart, liftDechuckEnd)}%`,
                          }}
                          className="absolute top-0 bottom-0 bg-[#EF4444] text-white font-extrabold border-r-2 border-[#DC2626] flex items-center justify-center text-[9px] px-1 truncate shadow-2xs"
                        >
                          Down
                        </div>
                        {/* 4. Idle */}
                        <div
                          style={{ left: `${toPct(liftDechuckEnd)}%`, width: `${pctW(liftDechuckEnd, totalCumulativeTime)}%` }}
                          className="absolute top-0 bottom-0 bg-[#CBD5E1] flex items-center justify-center text-[9px] text-slate-700 font-bold"
                        >
                          Idle
                        </div>
                        </>
                        )}
                      </div>
                    </div>

                    {/* ========================================================================= */}
                    {/* Track 3: SiH4 가스 공급 트랙 - Solid Emerald 단색 */}
                    {/* ========================================================================= */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-xs text-[#0F172A] font-bold">
                        <span className="flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${hasSiH4 ? 'bg-[#059669]' : 'bg-[#94A3B8]'}`} />
                          <span>3. SiH4 가스 (특화 반응 가스)</span>
                        </span>
                        {!hasSiH4 && (
                          <span className="text-[10px] text-[#64748B] font-medium">미사용 (0 sccm)</span>
                        )}
                      </div>
                      <div className="h-7 w-full bg-[#CBD5E1]/40 rounded-lg border border-slate-300 relative overflow-hidden shadow-2xs">
                        {bbSih4Segs ? (
                          renderGSegs(bbSih4Segs)
                        ) : (
                        <>
                        {hasSiH4 ? (
                          <>
                            {/* Idle */}
                            <div
                              style={{ left: `${toPct(0)}%`, width: `${pctW(0, sih4StartStep2)}%` }}
                              className="absolute top-0 bottom-0 bg-[#CBD5E1] border-r border-slate-300 flex items-center justify-center text-[9px] text-slate-700 font-bold"
                            >
                              Idle
                            </div>
                            {/* Ramp - Solid Yellow 단색 */}
                            <div
                              style={{
                                left: `${toPct(sih4StartStep2)}%`,
                                width: `${pctW(sih4StartStep2, calculatedTransitions.sih4ReachCum)}%`,
                              }}
                              className="absolute top-0 bottom-0 bg-[#F59E0B] text-slate-950 font-extrabold border-r border-[#D97706] flex items-center justify-center text-[9px] px-1 shadow-2xs"
                              title={`SiH4 인입 Ramp (${sih4StartStep2}s ~ ${calculatedTransitions.sih4ReachCum}s)`}
                            >
                              Ramp
                            </div>
                            {/* Stable - Solid Emerald 단색 */}
                            <div
                              style={{
                                left: `${toPct(calculatedTransitions.sih4ReachCum)}%`,
                                width: `${pctW(calculatedTransitions.sih4ReachCum, sih4CutCumTime)}%`,
                              }}
                              className="absolute top-0 bottom-0 bg-[#059669] text-white flex items-center justify-center text-[10px] font-extrabold px-2 border-r-2 border-[#047857] shadow-2xs"
                            >
                              <span>Stable ({p.pyroSiH4Set?.toLocaleString() ?? '-'} sccm)</span>
                            </div>
                            {/* Down - Solid Red 단색 */}
                            <div
                              style={{
                                left: `${toPct(sih4CutCumTime)}%`,
                                width: `${pctW(sih4CutCumTime, sih4ActualOffCumTime)}%`,
                              }}
                              className="absolute top-0 bottom-0 bg-[#EF4444] text-white font-extrabold border-r-2 border-[#DC2626] flex items-center justify-center text-[9px] px-1 truncate shadow-2xs"
                              title={`SiH4 차단 Down (${sih4CutCumTime.toFixed(1)}s ~ ${sih4ActualOffCumTime.toFixed(1)}s)`}
                            >
                              Down
                            </div>
                            {/* Idle */}
                            <div
                              style={{
                                left: `${toPct(sih4ActualOffCumTime)}%`,
                                width: `${pctW(sih4ActualOffCumTime, totalCumulativeTime)}%`,
                              }}
                              className="absolute top-0 bottom-0 bg-[#CBD5E1] flex items-center justify-center text-[9px] text-slate-700 font-bold"
                            >
                              Idle
                            </div>
                          </>
                        ) : (
                          /* SiH4 미사용 시 전체 구간 Idle 표시 */
                          <div
                            style={{ left: `${toPct(0)}%`, width: `${pctW(0, totalCumulativeTime)}%` }}
                            className="absolute top-0 bottom-0 bg-[#CBD5E1]/60 flex items-center justify-center text-[10px] text-slate-600 font-bold"
                          >
                            <span>Idle (공정 미공급 · 0 sccm)</span>
                          </div>
                        )}
                        </>
                        )}
                      </div>
                    </div>

                    {/* ========================================================================= */}
                    {/* Track 4: 분석 레시피 및 Step 기준 자동 감지된 공정 가스 개별 트랙 (방안 1) - Solid Amber 단색 */}
                    {/* ========================================================================= */}
                    {detectedProcessGases.map((gas, gIdx) => (
                      <div key={`proc_gas_${gas.name}_${gIdx}`} className="space-y-1">
                        <div className="flex justify-between items-center text-xs text-[#0F172A] font-bold">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#D97706]" />
                            <span>
                              {detectedProcessGases.length > 1
                                ? `4-${gIdx + 1}. 공정 가스 - ${gas.name} (${gas.set ? `${gas.set.toLocaleString()} sccm` : '공정 공급'})`
                                : `4. 공정 가스 - ${gas.name} (${gas.set ? `${gas.set.toLocaleString()} sccm` : '공정 공급'})`}
                            </span>
                          </span>
                        </div>
                        <div className="h-7 w-full bg-[#CBD5E1]/40 rounded-lg border border-slate-300 relative overflow-hidden shadow-2xs">
                          {bbGasSegs[gas.name] ? (
                            renderGSegs(bbGasSegs[gas.name] ?? [])
                          ) : (
                          <>
                          {/* 0. Idle before ramp */}
                          {gas.startTime > 0 && (
                            <div
                              style={{ left: `${toPct(0)}%`, width: `${pctW(0, gas.startTime)}%` }}
                              className="absolute top-0 bottom-0 bg-[#CBD5E1] border-r border-slate-300 flex items-center justify-center text-[9px] text-slate-700 font-bold"
                            >
                              Idle
                            </div>
                          )}
                          {/* 1. Ramp - Solid Yellow 단색 */}
                          <div
                            style={{
                              left: `${toPct(gas.startTime)}%`,
                              width: `${pctW(gas.startTime, gas.reachTime)}%`,
                            }}
                            className="absolute top-0 bottom-0 bg-[#F59E0B] text-slate-950 font-extrabold border-r border-[#D97706] flex items-center justify-center text-[8px] px-1 shadow-2xs"
                          >
                            Ramp
                          </div>
                          {/* 2. Stable - Solid Amber 주황색 단색 */}
                          <div
                            style={{
                              left: `${toPct(gas.reachTime)}%`,
                              width: `${pctW(gas.reachTime, gas.downStartTime)}%`,
                            }}
                            className="absolute top-0 bottom-0 bg-[#D97706] text-white flex items-center justify-center text-[10px] font-extrabold px-2 border-r-2 border-[#B45309] shadow-2xs"
                          >
                            <span>Stable ({gas.name}{gas.set ? ` ${gas.set.toLocaleString()} sccm` : ''})</span>
                          </div>
                          {/* 3. Down - Solid Red 단색 */}
                          <div
                            style={{
                              left: `${toPct(gas.downStartTime)}%`,
                              width: `${pctW(gas.downStartTime, gas.offTime)}%`,
                            }}
                            className="absolute top-0 bottom-0 bg-[#EF4444] text-white font-extrabold flex items-center justify-center text-[8px] border-r-2 border-[#DC2626] shadow-2xs"
                            title={`${gas.name} 가스 차단 Down (${gas.downStartTime.toFixed(1)}s ~ ${gas.offTime.toFixed(1)}s)`}
                          >
                            Down
                          </div>
                          {/* 4. Idle after Down */}
                          {totalCumulativeTime > gas.offTime && (
                            <div
                              style={{
                                left: `${toPct(gas.offTime)}%`,
                                width: `${pctW(gas.offTime, totalCumulativeTime)}%`,
                              }}
                              className="absolute top-0 bottom-0 bg-[#CBD5E1] flex items-center justify-center text-[9px] text-slate-700 font-bold"
                            >
                              Idle
                            </div>
                          )}
                          </>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* ========================================================================= */}
                    {/* Track 5: Throttle Valve 제어 트랙 - Solid Sky Blue 단색 */}
                    {/* ========================================================================= */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-xs text-[#0F172A] font-bold">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#0284C7]" />
                          <span>5. 압력 제어 (Throttle Valve)</span>
                        </span>
                      </div>
                      <div className="h-7 w-full bg-[#CBD5E1]/40 rounded-lg border border-slate-300 relative overflow-hidden shadow-2xs">
                        {bbTvSegs ? (
                          renderGSegs(bbTvSegs)
                        ) : (
                        <>
                        {/* Idle (Open) */}
                        {tvModeStartStep2 > 0 && (
                          <div
                            style={{ left: `${toPct(0)}%`, width: `${pctW(0, tvModeStartStep2)}%` }}
                            className="absolute top-0 bottom-0 bg-[#CBD5E1] border-r border-slate-300 flex items-center justify-center text-[9px] text-slate-700 font-bold"
                          >
                            Idle
                          </div>
                        )}
                        {/* Ramp - Solid Yellow 단색 */}
                        <div
                          style={{
                            left: `${toPct(tvModeStartStep2)}%`,
                            width: `${pctW(tvModeStartStep2, calculatedTransitions.tvReachCum)}%`,
                          }}
                          className="absolute top-0 bottom-0 bg-[#F59E0B] text-slate-950 font-extrabold border-r border-[#D97706] flex items-center justify-center text-[8px] px-1 shadow-2xs"
                        >
                          Ramp
                        </div>
                        {/* Stable (Throttle Valve Pressure) - Solid Sky Blue 단색 */}
                        <div
                          style={{
                            left: `${toPct(calculatedTransitions.tvReachCum)}%`,
                            width: `${pctW(calculatedTransitions.tvReachCum, tvOpenCumTime)}%`,
                          }}
                          className="absolute top-0 bottom-0 bg-[#0284C7] text-white border-r-2 border-[#0369A1] flex items-center justify-center font-extrabold text-[10px] px-2 shadow-2xs"
                        >
                          <span>Stable ({p.tvPressureSet ?? '-'} mTorr)</span>
                        </div>
                        {/* Down (Throttle Valve Open 전환) - Solid Red 단색 */}
                        <div
                          style={{
                            left: `${toPct(tvOpenCumTime)}%`,
                            width: `${pctW(tvOpenCumTime, tvOpenEndCumTime)}%`,
                          }}
                          className="absolute top-0 bottom-0 bg-[#EF4444] text-white font-extrabold flex items-center justify-center text-[8px] border-r-2 border-[#DC2626] shadow-2xs"
                          title={`압력 제어 해제 Down (${tvOpenCumTime.toFixed(1)}s ~ ${tvOpenEndCumTime.toFixed(1)}s)`}
                        >
                          Down
                        </div>
                        {/* Final Idle */}
                        {totalCumulativeTime > tvOpenEndCumTime && (
                          <div
                            style={{
                              left: `${toPct(tvOpenEndCumTime)}%`,
                              width: `${pctW(tvOpenEndCumTime, totalCumulativeTime)}%`,
                            }}
                            className="absolute top-0 bottom-0 bg-[#CBD5E1] flex items-center justify-center text-[9px] text-slate-700 font-bold"
                          >
                            Idle
                          </div>
                        )}
                        </>
                        )}
                      </div>
                    </div>

                    {/* ========================================================================= */}
                    {/* Track 6: RF Generator & 플라즈마 방전 트랙 - Solid Royal Blue 단색 */}
                    {/* ========================================================================= */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-xs text-[#0F172A] font-bold">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />
                          <span>6. RF Generator & 플라즈마 방전</span>
                        </span>
                      </div>
                      <div className="h-7 w-full bg-[#CBD5E1]/40 rounded-lg border border-slate-300 relative overflow-hidden shadow-2xs">
                        {bbRfSegs ? (
                          renderGSegs(bbRfSegs)
                        ) : (
                        <>
                        {/* Idle */}
                        <div
                          style={{ left: `${toPct(0)}%`, width: `${pctW(0, rfOnCumTime)}%` }}
                          className="absolute top-0 bottom-0 bg-[#CBD5E1] border-r border-slate-300 flex items-center justify-center text-[9px] text-slate-700 font-bold"
                        >
                          Idle
                        </div>
                        {/* Ramp (점화 피크 및 Ramp Up) - Solid Yellow 단색 */}
                        <div
                          style={{
                            left: `${toPct(rfOnCumTime)}%`,
                            width: `${pctW(rfOnCumTime, calculatedTransitions.rfReachCum)}%`,
                          }}
                          className="absolute top-0 bottom-0 bg-[#F59E0B] text-slate-950 font-extrabold border-r border-[#D97706] flex items-center justify-center text-[9px] px-1 shadow-2xs"
                        >
                          Ramp
                        </div>
                        {/* Stable (Main Steady Plasma) - Solid Royal Blue 단색 */}
                        <div
                          style={{
                            left: `${toPct(calculatedTransitions.rfReachCum)}%`,
                            width: `${pctW(calculatedTransitions.rfReachCum, hasSiH4 ? sih4CutCumTime : mainRfOffCumTime)}%`,
                          }}
                          className="absolute top-0 bottom-0 bg-[#2563EB] text-white flex items-center justify-center text-[10px] font-extrabold px-2 shadow-2xs border-r-2 border-[#1D4ED8]"
                        >
                          <div className="flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-yellow-300 fill-yellow-300 shrink-0" />
                            <span>Stable ({p.rfForwardSetValue} W)</span>
                          </div>
                        </div>
                        {/* Down (RSD 감쇄 - SiH4 사용 시에만) - Solid Red 단색 */}
                        {hasSiH4 && (
                          <div
                            style={{
                              left: `${toPct(sih4CutCumTime)}%`,
                              width: `${pctW(sih4CutCumTime, mainRfOffCumTime)}%`,
                            }}
                            className="absolute top-0 bottom-0 bg-[#EF4444] text-white font-extrabold border-r-2 border-[#DC2626] flex items-center justify-center text-[9px] px-1 shadow-2xs"
                          >
                            Down
                          </div>
                        )}
                        {/* Final Idle */}
                        {totalCumulativeTime > mainRfOffCumTime && (
                          <div
                            style={{
                              left: `${toPct(mainRfOffCumTime)}%`,
                              width: `${pctW(mainRfOffCumTime, totalCumulativeTime)}%`,
                            }}
                            className="absolute top-0 bottom-0 bg-[#CBD5E1] flex items-center justify-center text-[9px] text-slate-700 font-bold"
                          >
                            Idle
                          </div>
                        )}
                        </>
                        )}
                      </div>
                    </div>

                    {/* ========================================================================= */}
                    {/* Linear Time Axis Ruler (Zoom 반영 동적 눈금자) */}
                    {/* ========================================================================= */}
                    {/* ========================================================================= */}
                    {/* Linear Time Axis Ruler (Zoom 반영 동적 눈금자) */}
                    {/* ========================================================================= */}
                    <div className="pt-2 border-t border-slate-300 space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-mono text-[#475569]">
                        <span className="font-bold text-[#0F172A]">{zoomRange.start.toFixed(1)}s</span>
                        {step2End >= zoomRange.start && step2End <= zoomRange.end && (
                          <span className="text-[#1E3A8A] font-semibold">
                            | {step2End.toFixed(1)}s ({stab1StepItem?.stepName ? `${stab1StepItem.stepName} 끝` : `Step ${stab1StepItem?.step ?? 2} 끝`})
                          </span>
                        )}
                        {isRfBbStart && tBbStart !== null
                          ? tBbStart >= zoomRange.start && tBbStart <= zoomRange.end && (
                              <span className="text-[#1E3A8A] font-bold">▲ {tBbStart.toFixed(1)}s (Step {prevStepNo}에서 BB 이어짐)</span>
                            )
                          : rfOnCumTime >= zoomRange.start && rfOnCumTime <= zoomRange.end && (
                              <span className="text-[#1E3A8A] font-bold">▲ {rfOnCumTime}s (Main RF)</span>
                            )}
                        {hasSiH4 && !endSt('depo_pyroSiH4') && sih4CutCumTime >= zoomRange.start && sih4CutCumTime <= zoomRange.end && (
                          <span className="text-[#065F46] font-bold">▲ {sih4CutCumTime}s (SiH4 차단)</span>
                        )}
                        {isRfBbEnd && tBbEnd !== null
                          ? tBbEnd >= zoomRange.start && tBbEnd <= zoomRange.end && (
                              <span className="text-[#9F1239] font-bold">▲ {tBbEnd.toFixed(1)}s (BB 전환 → Step {nextStepNo})</span>
                            )
                          : mainRfOffCumTime >= zoomRange.start && mainRfOffCumTime <= zoomRange.end && (
                              <span className="text-[#9F1239] font-bold">▲ {mainRfOffCumTime}s (RF Off)</span>
                            )}
                        {detectedProcessGases.map((dg, idx) => (
                          !(GAS_BB_DEFS[dg.name] && endSt(GAS_BB_DEFS[dg.name].endF)) && dg.offTime >= zoomRange.start && dg.offTime <= zoomRange.end ? (
                            <span key={`ruler_gas_off_${idx}`} className="text-[#B45309] font-bold">
                              ▲ {dg.offTime.toFixed(1)}s ({dg.name} Off)
                            </span>
                          ) : null
                        ))}
                        <span className="font-bold text-[#0F172A]">{zoomRange.end.toFixed(1)}s</span>
                      </div>

                      {/* Overview Mini-map Bar / Draggable Zoom Navigator */}
                      {zoomLevel > 1.05 && (
                        <div className="pt-2">
                          <div className="flex items-center justify-between text-[11px] text-[#475569] mb-1 font-medium">
                            <span className="flex items-center gap-1.5 text-[#1E3A8A] font-bold">
                              <MoveHorizontal className="w-3.5 h-3.5" />
                              <span>확대 시점 이동 스크롤러</span>
                            </span>
                            <span className="text-[10px] text-[#64748B]">
                              슬레이트 핸들을 좌우로 드래그하거나 트랙을 클릭하여 시점을 이동하세요
                            </span>
                          </div>
                          <div
                            ref={miniMapTrackRef}
                            onClick={handleMiniMapTrackClick}
                            className="h-6 w-full bg-[#E2E8F0] hover:bg-slate-200 transition-colors rounded-lg border border-slate-300 relative select-none cursor-pointer p-0.5"
                            title="클릭하여 해당 시점으로 이동"
                          >
                            {/* Track Background Time Milestones */}
                            <div className="absolute inset-0 flex justify-between items-center px-2 pointer-events-none opacity-50">
                              <span className="text-[9px] font-mono text-[#475569] font-semibold">0.0s</span>
                              <span className="text-[9px] font-mono text-[#475569] font-semibold">{(totalCumulativeTime / 2).toFixed(0)}s</span>
                              <span className="text-[9px] font-mono text-[#475569] font-semibold">{totalCumulativeTime.toFixed(0)}s</span>
                            </div>

                            {/* Draggable Active Viewport Handle / Thumb */}
                            <div
                              onMouseDown={handleMiniMapThumbMouseDown}
                              style={{
                                left: `${(zoomRange.start / totalCumulativeTime) * 100}%`,
                                width: `${Math.max(4, ((zoomRange.end - zoomRange.start) / totalCumulativeTime) * 100)}%`,
                              }}
                              className={`absolute top-0.5 bottom-0.5 bg-[#1E293B] hover:bg-[#0F172A] border border-[#0F172A] rounded-md shadow-xs flex items-center justify-center gap-1 transition-colors select-none ${
                                isMiniMapDragging ? 'cursor-grabbing bg-[#0F172A] ring-2 ring-slate-400' : 'cursor-grab'
                              }`}
                              title="좌우로 드래그하여 시점 이동"
                            >
                              <div className="flex items-center gap-0.5 pointer-events-none">
                                <span className="w-0.5 h-2.5 bg-white/80 rounded-full" />
                                <span className="w-0.5 h-2.5 bg-white/80 rounded-full" />
                                <span className="w-0.5 h-2.5 bg-white/80 rounded-full" />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 미니 Control 시점 요약 바 (Samsung/SK hynix Subtle 3% Tint Matrix 스타일) */}
                <div className="pt-3 border-t border-slate-300 space-y-2.5">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-300">
                    <span className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-[#475569]" />
                      <span>H/W Control 시점 확인</span>
                    </span>
                    <div className="flex items-center gap-2.5">
                      {selectedMilestoneKeys.length > 0 && (
                        <button
                          type="button"
                          onClick={clearAllMilestones}
                          className="text-[10px] text-[#9F1239] hover:text-[#881337] bg-[#FFF1F2] hover:bg-[#FFE4E6] px-2.5 py-1 rounded-lg border border-[#FECDD3] font-semibold cursor-pointer transition-colors"
                        >
                          점선 전체 해제 ({selectedMilestoneKeys.length}개)
                        </button>
                      )}
                      <span className="text-[10px] text-[#475569] font-mono hidden sm:inline">0.0s = Recipe/Step 기준 누적 시간</span>
                    </div>
                  </div>

                  {/* Depo Step 제어 시점 (Subtle 3% Tint 칩 - 파란계열 / 붉은계열 2줄 분리) */}
                  <div className="bg-[#E2E8F0] p-2.5 rounded-lg border border-slate-300 space-y-2.5 shadow-2xs">
                    {/* 1행: 파란계열 (Set 도달 완료) */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10.5px] font-bold px-0.5">
                        <div className="flex items-center gap-1.5 text-[#1E3A8A]">
                          <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
                          <span>Set 도달 완료 (On / Ramping 완료)</span>
                        </div>
                        <span className="text-[9.5px] text-[#64748B] hidden md:inline">
                          파랑 틴트 · 클릭 시 간트 타임라인 점선 표시/해제
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1.5">
                        {controlMilestones
                          .filter((ms) => ms.group === 'depo' && ms.actionType === 'on')
                          .map((ms) => {
                            const isSelected = selectedMilestoneKeys.includes(ms.key);
                            return (
                              <button
                                key={ms.key}
                                type="button"
                                onClick={() => {
                                  toggleMilestone(ms.key);
                                  if (!isSelected && (ms.time < zoomRange.start || ms.time > zoomRange.end)) {
                                    const newSpan = currentSpan;
                                    const s = Math.max(0, ms.time - newSpan / 2);
                                    setZoomRange({ start: s, end: Math.min(totalCumulativeTime, s + newSpan) });
                                  }
                                }}
                                className={`px-2 py-1 rounded-md text-left transition-all cursor-pointer flex items-center justify-between gap-1 w-full ${
                                  isSelected
                                    ? 'border-2 border-[#2563EB] bg-[#DBEAFE] text-[#1E40AF] font-bold shadow-xs'
                                    : 'border border-[#BFDBFE] bg-[#EFF6FF] text-[#1E3A8A] hover:bg-[#DBEAFE]'
                                }`}
                                title={`${ms.label} (${ms.time.toFixed(1)}s) 클릭 시 간트 점선 표시/해제`}
                              >
                                <span className="text-[10px] font-semibold truncate leading-tight">
                                  {ms.label}
                                </span>
                                <span className="font-mono font-bold text-[10px] shrink-0 ml-1">
                                  {ms.time.toFixed(1)}s
                                </span>
                              </button>
                            );
                          })}
                      </div>
                    </div>

                    {/* 1행과 2행 간 구분선 */}
                    <div className="border-t border-slate-300 my-1" />

                    {/* 2행: 붉은계열 (Flow Off & 제어 종료) */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10.5px] font-bold px-0.5">
                        <div className="flex items-center gap-1.5 text-[#991B1B]">
                          <span className="w-2 h-2 rounded-full bg-[#DC2626]" />
                          <span>Flow Off & 제어 종료 (차단 완료)</span>
                        </div>
                        <span className="text-[9.5px] text-[#64748B] hidden md:inline">
                          로즈 틴트 · 클릭 시 간트 타임라인 점선 표시/해제
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1.5">
                        {controlMilestones
                          .filter((ms) => ms.group === 'depo' && ms.actionType === 'off')
                          .map((ms) => {
                            const isSelected = selectedMilestoneKeys.includes(ms.key);
                            return (
                              <button
                                key={ms.key}
                                type="button"
                                onClick={() => {
                                  toggleMilestone(ms.key);
                                  if (!isSelected && (ms.time < zoomRange.start || ms.time > zoomRange.end)) {
                                    const newSpan = currentSpan;
                                    const s = Math.max(0, ms.time - newSpan / 2);
                                    setZoomRange({ start: s, end: Math.min(totalCumulativeTime, s + newSpan) });
                                  }
                                }}
                                className={`px-2 py-1 rounded-md text-left transition-all cursor-pointer flex items-center justify-between gap-1 w-full ${
                                  isSelected
                                    ? 'border-2 border-[#DC2626] bg-[#FEE2E2] text-[#991B1B] font-bold shadow-xs'
                                    : 'border border-[#FECDD3] bg-[#FFF1F2] text-[#9F1239] hover:bg-[#FFE4E6]'
                                }`}
                                title={`${ms.label} (${ms.time.toFixed(1)}s) 클릭 시 간트 점선 표시/해제`}
                              >
                                <span className="text-[10px] font-semibold truncate leading-tight">
                                  {ms.label}
                                </span>
                                <span className="font-mono font-bold text-[10px] shrink-0 ml-1">
                                  {ms.time.toFixed(1)}s
                                </span>
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
