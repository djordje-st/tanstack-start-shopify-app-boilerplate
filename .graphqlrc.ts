import fs from 'node:fs'
import { ApiVersion } from '@shopify/shopify-api'
import { ApiType, shopifyApiProject } from '@shopify/api-codegen-preset'
import type { IGraphQLConfig } from 'graphql-config'

function getConfig() {
  const config: IGraphQLConfig = {
    projects: {
      default: shopifyApiProject({
        apiType: ApiType.Admin,
        apiVersion: ApiVersion.January26,
        documents: ['./**/*.{ts,tsx}'],
        outputDir: './src/types/generated',
      }),
    },
  }

  let extensions: Array<string> = []

  try {
    extensions = fs.readdirSync('./extensions')
  } catch {
    // ignore if no extensions
  }

  for (const entry of extensions) {
    const extensionPath = `./extensions/${entry}`
    const schema = `${extensionPath}/schema.graphql`

    if (!fs.existsSync(schema)) {
      continue
    }

    config.projects[entry] = {
      schema,
      documents: [`${extensionPath}/**/*.graphql`],
    }
  }

  return config
}

const config = getConfig()

export default config
