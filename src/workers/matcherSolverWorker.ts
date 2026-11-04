import { solveMatcherFromCTCL, SolverOptions } from '../utils/matcherSolver';
import { solveMatcherPrecision, PrecisionOptions } from '../utils/matcherPrecisionFit';
import { CTCLMatrixData } from '../types/pecvd';

self.onmessage = (
  e: MessageEvent<{ matrix: CTCLMatrixData; options?: SolverOptions; precision?: PrecisionOptions }>
) => {
  const { matrix, options, precision } = e.data;
  try {
    const spec = precision ? solveMatcherPrecision(matrix, precision) : solveMatcherFromCTCL(matrix, options);
    self.postMessage({ success: true, spec });
  } catch (err) {
    self.postMessage({ success: false, error: String(err) });
  }
};
