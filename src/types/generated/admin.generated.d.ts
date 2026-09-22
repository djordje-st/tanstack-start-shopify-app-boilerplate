/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */
import type * as AdminTypes from './admin.types.js';

export type GetShopQueryVariables = AdminTypes.Exact<{ [key: string]: never; }>;


export type GetShopQuery = { shop: Pick<AdminTypes.Shop, 'name' | 'myshopifyDomain'> };

interface GeneratedQueryTypes {
  "#graphql\n  query GetShop {\n    shop {\n      name\n      myshopifyDomain\n    }\n  }\n": {return: GetShopQuery, variables: GetShopQueryVariables},
}

interface GeneratedMutationTypes {
}
declare module '@shopify/admin-api-client' {
  type InputMaybe<T> = AdminTypes.InputMaybe<T>;
  interface AdminQueries extends GeneratedQueryTypes {}
  interface AdminMutations extends GeneratedMutationTypes {}
}
