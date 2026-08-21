import { setupServer } from "msw/node";

/**
 * 테스트 전용 목 서버. 기본 핸들러는 두지 않는다 — 각 테스트가 자기가 기대하는 응답을
 * `server.use(...)`로 명시하게 해서, 어떤 응답을 전제하는지가 테스트 안에 드러나게 한다.
 */
export const server = setupServer();
