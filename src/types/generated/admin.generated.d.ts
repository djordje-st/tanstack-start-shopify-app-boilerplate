/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */
import type * as AdminTypes from './admin.types';

export type GetShopQueryVariables = AdminTypes.Exact<{ [key: string]: never; }>;


export type GetShopQuery = { shop: Pick<AdminTypes.Shop, 'id' | 'name' | 'email' | 'contactEmail' | 'currencyCode' | 'ianaTimezone' | 'url' | 'weightUnit'> };

export type GetProductsQueryVariables = AdminTypes.Exact<{
  first?: AdminTypes.InputMaybe<AdminTypes.Scalars['Int']['input']>;
  after?: AdminTypes.InputMaybe<AdminTypes.Scalars['String']['input']>;
  before?: AdminTypes.InputMaybe<AdminTypes.Scalars['String']['input']>;
}>;


export type GetProductsQuery = { products: { pageInfo: Pick<AdminTypes.PageInfo, 'hasNextPage' | 'endCursor'>, edges: Array<{ node: Pick<AdminTypes.Product, 'id' | 'handle' | 'title'> }> } };

interface GeneratedQueryTypes {
  "#graphql\n  query GetShop {\n    shop {\n      id\n      name\n      email\n      contactEmail\n      currencyCode\n      ianaTimezone\n      url\n      weightUnit\n    }\n  }\n": {return: GetShopQuery, variables: GetShopQueryVariables},
  "#graphql\n  query GetProducts($first: Int = 10, $after: String, $before: String) {\n    products(first: $first, after: $after, before: $before) {\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n      edges {\n        node {\n          id\n          handle\n          title\n        }\n      }\n    }\n  }\n": {return: GetProductsQuery, variables: GetProductsQueryVariables},
}

interface GeneratedMutationTypes {
}
declare module '@shopify/admin-api-client' {
  type InputMaybe<T> = AdminTypes.InputMaybe<T>;
  interface AdminQueries extends GeneratedQueryTypes {}
  interface AdminMutations extends GeneratedMutationTypes {}
}
