export const SHOP_DETAILS_QUERY = `#graphql
  query ShopDetails {
    shop {
      name
      email
      ianaTimezone
      currencyCode
      plan {
        publicDisplayName
      }
    }
  }
`
