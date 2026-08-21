import { z } from 'zod';

/** 백엔드 공통 에러 형식. message는 사용자에게 그대로 보여줄 수 있는 한국어다. */
const errorBodySchema = z.object({
  code: z.string(),
  message: z.string(),
  fieldErrors: z
    .array(z.object({ field: z.string(), message: z.string() }))
    .optional()
    .default([]),
});

export type FieldError = { field: string; message: string };

/**
 * 화면은 이 예외의 `code`로 분기한다. `message`로 분기하지 않는다 —
 * 문구가 바뀌면 조용히 깨지기 때문이다(docs/conventions/frontend.md「하지 말 것」).
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fieldErrors: FieldError[];

  constructor(params: {
    code: string;
    message: string;
    status: number;
    fieldErrors?: FieldError[];
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.code = params.code;
    this.status = params.status;
    this.fieldErrors = params.fieldErrors ?? [];
  }
}

/** 응답이 JSON이 아니거나 네트워크가 실패했을 때 쓰는 코드. 백엔드에는 없는 값이다. */
export const CLIENT_ERROR_CODE = 'CLIENT_ERROR';

const CLIENT_ERROR_MESSAGE = '일시적인 오류가 발생했습니다.';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
}

/** 백엔드 절대 URL을 만든다. `/api/...`로 시작하는 BFF 경로에는 쓰지 않는다. */
export function backendUrl(path: string): string {
  return `${apiBaseUrl()}${path}`;
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const parsed = errorBodySchema.parse(await response.json());
    return new ApiError({
      code: parsed.code,
      message: parsed.message,
      status: response.status,
      fieldErrors: parsed.fieldErrors,
    });
  } catch {
    // 백엔드가 아닌 곳(프록시·게이트웨이)이 HTML 오류 페이지를 돌려줄 수 있다.
    return new ApiError({
      code: CLIENT_ERROR_CODE,
      message: CLIENT_ERROR_MESSAGE,
      status: response.status,
    });
  }
}

/**
 * fetch 한 번. 401 재시도는 Task 4에서 이 함수를 감싸 붙인다.
 *
 * @throws {ApiError} 2xx가 아니거나 네트워크가 실패하면
 */
export async function request<T>(
  url: string,
  init: RequestInit & { schema: z.ZodType<T> },
): Promise<T> {
  const { schema, ...rest } = init;

  let response: Response;
  try {
    response = await fetch(url, rest);
  } catch {
    throw new ApiError({ code: CLIENT_ERROR_CODE, message: CLIENT_ERROR_MESSAGE, status: 0 });
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  if (response.status === 204) {
    return schema.parse(undefined);
  }

  return schema.parse(await response.json());
}
