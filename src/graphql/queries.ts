export const SHOP_QUERY = `#graphql
  query GetShop {
    shop {
      id
      name
      email
      ianaTimezone
      currencyCode
      myshopifyDomain
      plan {
        publicDisplayName
      }
    }
  }
`
