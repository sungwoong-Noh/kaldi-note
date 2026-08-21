import { useQuery } from '@tanstack/react-query';
import { backendUrl } from '@/lib/api-client';
import { authedRequest } from '@/lib/authed-fetch';
import { brewFilterListSchema, brewerListSchema } from './schema';

/**
 * 브루어·필터는 마스터 데이터라 사실상 변하지 않는다. staleTime을 무한으로 두어 레시피를 몇 개 열든 세션당 한 번만 부른다.
 *
 * <p>레시피 응답은 `brewerId`·`filterId`만 주므로 이름을 보여주려면 이 목록이 필요하다.
 */
const MASTER_DATA_OPTIONS = { staleTime: Infinity, gcTime: Infinity } as const;

export function useBrewers(onSessionLost?: () => void) {
  return useQuery({
    queryKey: ['gear', 'brewers'],
    queryFn: () =>
      authedRequest(backendUrl('/api/v1/gear/brewers'), {
        schema: brewerListSchema,
        onSessionLost,
      }),
    ...MASTER_DATA_OPTIONS,
  });
}

export function useBrewFilters(onSessionLost?: () => void) {
  return useQuery({
    queryKey: ['gear', 'filters'],
    queryFn: () =>
      authedRequest(backendUrl('/api/v1/gear/filters'), {
        schema: brewFilterListSchema,
        onSessionLost,
      }),
    ...MASTER_DATA_OPTIONS,
  });
}
