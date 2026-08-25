import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { Observability, MastraStorageExporter, MastraPlatformExporter, SensitiveDataFilter } from '@mastra/observability';
import { weatherWorkflow } from './workflows/weather-workflow';
import { weatherAgent } from './agents/weather-agent';
import { videoChatAgent } from './agents/video-chat-agent';
import { storyboardAgent } from './agents/storyboard-agent';
import { scriptEnhancerAgent } from './agents/script-enhancer-agent';
import { summarizationAgent } from './agents/summarization-agent';
import { videoGenerationWorkflow } from './workflows/video-generation-workflow';


export const mastra = new Mastra({
  workflows: { weatherWorkflow, videoGenerationWorkflow },
  agents: { weatherAgent, videoChatAgent, storyboardAgent, scriptEnhancerAgent, summarizationAgent },
  storage: new LibSQLStore({
    id: "mastra-storage",
    // Uses a hosted database when deployed (mastra env db create --kind turso),
    // and a local file during development.
    url: process.env.TURSO_DATABASE_URL ?? "file:./mastra.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mastra',
        exporters: [
          new MastraStorageExporter(), // Persists observability events to Mastra Storage
          new MastraPlatformExporter(), // Sends observability events to Mastra Platform (if MASTRA_PLATFORM_ACCESS_TOKEN is set)
        ],
        spanOutputProcessors: [
          new SensitiveDataFilter(), // Redacts sensitive data like passwords, tokens, keys
        ],
      },
    },
  }),
});
