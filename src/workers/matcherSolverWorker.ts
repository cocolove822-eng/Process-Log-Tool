import { solveMatcherFromCTCL, SolverOptions } from '../utils/matcherSolver';
import { CTCLMatrixData } from '../types/pecvd';

self.onmessage = (e: MessageEvent<{ matrix: CTCLMatrixData; options?: SolverOptions }>) => {
  const { matrix, options } = e.data;
  try {
    const spec = solveMatcherFromCTCL(matrix, options);
    self.postMessage({ success: true, spec });
  } catch (err) {
    self.postMessage({ success: false, error: String(err) });
  }
};
