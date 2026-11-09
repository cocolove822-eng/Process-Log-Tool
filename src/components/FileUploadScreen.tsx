import React, { useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { AnalyzerSettings, CTCLMatrixData } from '../types/pecvd';
import { HIRUJA_SYMBOL_PNG } from '../assets/hirujaLogo';

interface FileUploadScreenProps {
  ctclMatrix: CTCLMatrixData | null;
  settings: AnalyzerSettings;
  onUploadRawFiles: (files: FileList | File[]) => void;
  onUploadCtclFile: (file: File) => void;
  onUpdateSettings: (newSettings: AnalyzerSettings) => void;
}

export const FileUploadScreen: React.FC<FileUploadScreenProps> = ({
  ctclMatrix,
  settings,
  onUploadRawFiles,
  onUploadCtclFile,
  onUpdateSettings,
}) => {
  const rawInputRef = useRef<HTMLInputElement>(null);
  const ctclInputRef = useRef<HTMLInputElement>(null);

  const handleRawDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUploadRawFiles(e.dataTransfer.files);
    }
  };

  const handleCtclDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onUploadCtclFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 flex flex-col items-center">
      {/* Hidden file inputs */}
      <input
        ref={rawInputRef}
        type="file"
        multiple
        accept=".csv,.xlsx,.xls,.xlsm,.txt"
        className="hidden"
        onChange={e => {
          if (e.target.files && e.target.files.length > 0) {
            onUploadRawFiles(e.target.files);
            e.target.value = '';
          }
        }}
      />
      <input
        ref={ctclInputRef}
        type="file"
        accept=".xlsx,.xlsm"
        className="hidden"
        onChange={e => {
          if (e.target.files && e.target.files[0]) {
            onUploadCtclFile(e.target.files[0]);
            e.target.value = '';
          }
        }}
      />

      {/* Main Hero Header (Crisp Dark Slate on Light Body) */}
      <div className="text-center space-y-2.5 mb-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E2E8F0] border border-[#CBD5E1] text-[#2563EB] text-xs font-bold">
          <img src={HIRUJA_SYMBOL_PNG} alt="H&iruja" className="w-4 h-4 object-contain" draggable={false} />
          <span>PECVD Process Log 분석 Tool</span>
        </div>
        <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-[#0F172A]">
          공정 Log 파일 및 CTCL Matrix 등록
        </h1>
        <p className="text-sm text-[#475569] max-w-xl mx-auto leading-relaxed font-medium">
          분석할 설비 공정 Raw Log(CSV)와 Matcher CTCL Matrix(Excel)를 등록하면
          공정 조건, 시퀀스 타이밍, RF 특성 및 편차를 브라우저 내에서 즉시 자동 분석합니다.
        </p>
      </div>

      {/* Upload Dropzones Grid (Clean White Cards with Slate Borders) */}
      <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* 1. Raw Log CSV Upload Box */}
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleRawDrop}
          onClick={() => rawInputRef.current?.click()}
          className="group relative flex flex-col items-center justify-center p-8 bg-white hover:bg-[#F8FAFC] border-2 border-dashed border-[#CBD5E1] hover:border-[#2563EB] rounded-2xl cursor-pointer transition-all duration-200 text-center shadow-xs"
        >
          <div className="w-14 h-14 rounded-2xl bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[#2563EB] group-hover:scale-105 transition-transform mb-4">
            <Upload className="w-7 h-7 stroke-[2.2]" />
          </div>

          <h3 className="text-base font-extrabold text-[#0F172A] mb-1">
            공정 Raw Log (CSV) 등록
          </h3>
          <p className="text-xs text-[#64748B] mb-4 font-medium">
            클릭하여 파일 선택 또는 여기로 드래그 앤 드롭
          </p>

          <div className="w-full max-w-xs space-y-2 text-left bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0] text-[11px] text-[#475569] mb-4">
            <div className="flex items-center gap-2 text-[#0F172A] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
              <span>개별 .csv 파일 1개씩 순차 등록 가능</span>
            </div>
            <div className="flex items-center gap-2 text-[#0F172A] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
              <span>복수 파일 일괄 선택 및 무제한 N개 Run 누적</span>
            </div>
            <div className="flex items-center gap-2 text-[#64748B]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#94A3B8]" />
              <span>약 0.1초 간격 원본 시계열 데이터 자동 인식</span>
            </div>
          </div>

          <button
            type="button"
            className="px-5 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-[0.98]"
          >
            로그 파일 선택하기
          </button>
        </div>

        {/* 2. CTCL Matrix Excel Upload Box */}
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleCtclDrop}
          onClick={() => ctclInputRef.current?.click()}
          className={`group relative flex flex-col items-center justify-center p-8 rounded-2xl cursor-pointer transition-all duration-200 text-center border-2 border-dashed shadow-xs ${
            ctclMatrix
              ? 'bg-[#F0FDF4] hover:bg-[#DCFCE7] border-[#86EFAC]'
              : 'bg-white hover:bg-[#F8FAFC] border-[#CBD5E1] hover:border-[#2563EB]'
          }`}
        >
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform mb-4 border ${
              ctclMatrix
                ? 'bg-[#DCFCE7] border-[#86EFAC] text-[#16A34A]'
                : 'bg-[#EFF6FF] border-[#BFDBFE] text-[#2563EB]'
            }`}
          >
            {ctclMatrix ? (
              <CheckCircle2 className="w-7 h-7 stroke-[2.2]" />
            ) : (
              <FileSpreadsheet className="w-7 h-7 stroke-[2.2]" />
            )}
          </div>

          <h3 className="text-base font-extrabold text-[#0F172A] mb-1">
            Matcher CTCL Matrix (Excel)
          </h3>
          <p className="text-xs text-[#64748B] mb-4 font-medium">
            {ctclMatrix ? (
              <span className="text-[#16A34A] font-bold">
                ✓ 등록 완료: {ctclMatrix.fileName} ({ctclMatrix.sheetName})
              </span>
            ) : (
              '클릭하여 엑셀 선택 (.xlsx / .xlsm)'
            )}
          </p>

          <div className="w-full max-w-xs space-y-2 text-left bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0] text-[11px] text-[#475569] mb-4">
            <div className="flex items-center gap-2 text-[#0F172A] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
              <span>Load 0~100 (A열) × Tune 0~100 (1행)</span>
            </div>
            <div className="flex items-center gap-2 text-[#0F172A] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
              <span>복소 임피던스(R+Xi) 2차원 Bilinear 보간</span>
            </div>
            <div className="flex items-center gap-2 text-[#64748B]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#94A3B8]" />
              <span>미등록 시에도 공정 기본 데이터 분석 가능</span>
            </div>
          </div>

          <button
            type="button"
            className={`px-5 py-2.5 text-xs font-bold rounded-xl shadow-xs transition-all active:scale-[0.98] ${
              ctclMatrix
                ? 'bg-[#16A34A] text-white hover:bg-[#15803D]'
                : 'bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A] border border-[#CBD5E1]'
            }`}
          >
            {ctclMatrix ? '다른 CTCL 파일로 변경' : 'CTCL Matrix 파일 선택'}
          </button>
        </div>
      </div>
    </div>
  );
};
