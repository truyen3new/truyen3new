export {
  DEFAULT_ROUTE_ROLES,
  isAllowedRouteRole,
  requireRouteAuthorization as requireAdminAuthorization,
  resolveRouteRequester as resolveAdminRequester,
  type RequireRouteAuthorizationOptions as ResolveRequesterOptions,
  type RouteRequester as ResolvedRequester,
} from '@/lib/routeAuth';
