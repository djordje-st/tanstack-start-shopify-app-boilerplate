import { ApiType, shopifyApiProject } from '@shopify/api-codegen-preset'

const adminApiVersion = '2026-07'
const adminDocuments = ['./src/**/*.{ts,tsx}']

export default {
  projects: {
    default: {
      ...shopifyApiProject({
        apiType: ApiType.Admin,
        apiVersion: adminApiVersion,
        documents: adminDocuments,
        enumsAsConst: true,
        outputDir: './src/types/generated',
      }),
      include: adminDocuments,
      exclude: ['./extensions/**'],
    },
  },
}
