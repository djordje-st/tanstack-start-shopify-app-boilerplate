/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */
import type * as AdminTypes from './admin.types.js';

export type GetShopQueryVariables = AdminTypes.Exact<{ [key: string]: never; }>;


export type GetShopQuery = { shop: (
    Pick<AdminTypes.Shop, 'id' | 'name' | 'email' | 'ianaTimezone' | 'currencyCode' | 'myshopifyDomain'>
    & { plan: Pick<AdminTypes.ShopPlan, 'publicDisplayName'> }
  ) };

interface GeneratedQueryTypes {
  "#graphql\n  query GetShop {\n    shop {\n      id\n      name\n      email\n      ianaTimezone\n      currencyCode\n      myshopifyDomain\n      plan {\n        publicDisplayName\n      }\n    }\n  }\n": {return: GetShopQuery, variables: GetShopQueryVariables},
}

interface GeneratedMutationTypes {
}
declare module '@shopify/admin-api-client' {
  type InputMaybe<T> = AdminTypes.InputMaybe<T>;
  interface AdminQueries extends GeneratedQueryTypes {}
  interface AdminMutations extends GeneratedMutationTypes {}
}
