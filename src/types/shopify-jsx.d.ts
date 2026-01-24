import type {
  SAppNavAttributes,
  SAppWindowAttributes,
} from '@shopify/app-bridge-types'

// React 19 moved JSX types inside the 'react' module instead of global.
// This augments React's JSX namespace with Shopify App Bridge elements.
// Note: Polaris components (s-page, s-button, etc.) are handled by @shopify/polaris-types.
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      's-app-window': SAppWindowAttributes
      's-app-nav': SAppNavAttributes
    }
  }
}
