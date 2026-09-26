export type ApiErrorBody = {
  code: string;
  message: string;
  requestId: string;
  retryable: boolean;
  nextAction?: string;
};

export function apiError(
  code: string,
  message: string,
  requestId: string,
  opts?: { retryable?: boolean; nextAction?: string },
): ApiErrorBody {
  return {
    code,
    message,
    requestId,
    retryable: opts?.retryable ?? false,
    nextAction: opts?.nextAction,
  };
}
