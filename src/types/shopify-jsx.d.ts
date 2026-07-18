import type {
  SAppNavAttributes,
  SAppWindowAttributes,
} from '@shopify/app-bridge-types'

// App Bridge currently augments the global JSX namespace, but React 19 reads
// intrinsic element types from the JSX namespace exported by `react`.
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      's-app-nav': SAppNavAttributes
      's-app-window': SAppWindowAttributes
    }
  }
}
