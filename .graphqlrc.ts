import fs from 'node:fs'
import { ApiVersion } from '@shopify/shopify-api'
import { pluckConfig, preset } from '@shopify/graphql-codegen'
import type { IGraphQLConfig } from 'graphql-config'

const API_VERSION = ApiVersion.January26

function getConfig(): IGraphQLConfig {
  const config: IGraphQLConfig = {
    projects: {
      // Admin API - generates only operation types, imports schema types from npm
      default: {
        schema: `https://shopify.dev/admin-graphql-direct-proxy/${API_VERSION}`,
        documents: ['./src/graphql/admin/**/*.{ts,tsx}'],
        extensions: {
          codegen: {
            pluckConfig,
            generates: {
              './src/types/generated/admin.generated.d.ts': {
                preset,
                presetConfig: {
                  importTypes: {
                    namespace: 'AdminAPI',
                    from: '@shopify/admin-api-client',
                  },
                  interfaceExtension: ({
                    queryType,
                    mutationType,
                  }: {
                    queryType: string
                    mutationType: string
                  }) => `
                    declare module '@shopify/admin-api-client' {
                      type InputMaybe<T> = AdminAPI.InputMaybe<T>
                      interface AdminQueries extends ${queryType} {}
                      interface AdminMutations extends ${mutationType} {}
                    }
                  `,
                },
              },
            },
          },
        },
      },

      // Storefront API - same lightweight approach
      storefront: {
        schema: `https://shopify.dev/storefront-graphql-direct-proxy/${API_VERSION}`,
        documents: ['./src/graphql/storefront/**/*.{ts,tsx}'],
        extensions: {
          codegen: {
            pluckConfig,
            generates: {
              './src/types/generated/storefront.generated.d.ts': {
                preset,
                presetConfig: {
                  importTypes: {
                    namespace: 'StorefrontAPI',
                    from: '@shopify/storefront-api-client',
                  },
                  interfaceExtension: ({
                    queryType,
                    mutationType,
                  }: {
                    queryType: string
                    mutationType: string
                  }) => `
                    declare module '@shopify/storefront-api-client' {
                      type InputMaybe<T> = StorefrontAPI.InputMaybe<T>
                      interface StorefrontQueries extends ${queryType} {}
                      interface StorefrontMutations extends ${mutationType} {}
                    }
                  `,
                },
              },
            },
          },
        },
      },
    },
  }

  // Dynamic extension support for Shopify Functions
  let extensions: Array<string> = []
  try {
    extensions = fs.readdirSync('./extensions')
  } catch {
    // Ignore if no extensions directory
  }

  for (const entry of extensions) {
    const extensionPath = `./extensions/${entry}`
    const schema = `${extensionPath}/schema.graphql`

    if (!fs.existsSync(schema)) continue

    config.projects[entry] = {
      schema,
      documents: [`${extensionPath}/**/*.graphql`],
    }
  }

  return config
}

export default getConfig()
