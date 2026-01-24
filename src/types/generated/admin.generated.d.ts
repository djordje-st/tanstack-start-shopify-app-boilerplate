/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */
import type * as AdminAPI from '@shopify/admin-api-client';

export type GetShopQueryVariables = AdminAPI.Exact<{ [key: string]: never; }>;


export type GetShopQuery = { shop: (
    Pick<AdminAPI.Shop, 'id' | 'name' | 'email' | 'ianaTimezone' | 'currencyCode' | 'myshopifyDomain'>
    & { plan: Pick<AdminAPI.ShopPlan, 'publicDisplayName'> }
  ) };

interface GeneratedQueryTypes {
  "#graphql\n  query GetShop {\n    shop {\n      id\n      name\n      email\n      ianaTimezone\n      currencyCode\n      myshopifyDomain\n      plan {\n        publicDisplayName\n      }\n    }\n  }\n": {return: GetShopQuery, variables: GetShopQueryVariables},
}

interface GeneratedMutationTypes {
}

                    declare module '@shopify/admin-api-client' {
                      type InputMaybe<T> = AdminAPI.InputMaybe<T>
                      interface AdminQueries extends GeneratedQueryTypes {}
                      interface AdminMutations extends GeneratedMutationTypes {}
                    }
                  
