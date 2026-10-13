/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */
import type * as AdminTypes from './admin.types.js';

export type ShopDetailsQueryVariables = AdminTypes.Exact<{ [key: string]: never; }>;


export type ShopDetailsQuery = { shop: (
    Pick<AdminTypes.Shop, 'name' | 'email' | 'ianaTimezone' | 'currencyCode'>
    & { plan: Pick<AdminTypes.ShopPlan, 'publicDisplayName'> }
  ) };

interface GeneratedQueryTypes {
  "#graphql\n  query ShopDetails {\n    shop {\n      name\n      email\n      ianaTimezone\n      currencyCode\n      plan {\n        publicDisplayName\n      }\n    }\n  }\n": {return: ShopDetailsQuery, variables: ShopDetailsQueryVariables},
}

interface GeneratedMutationTypes {
}
declare module '@shopify/admin-api-client' {
  type InputMaybe<T> = AdminTypes.InputMaybe<T>;
  interface AdminQueries extends GeneratedQueryTypes {}
  interface AdminMutations extends GeneratedMutationTypes {}
}
