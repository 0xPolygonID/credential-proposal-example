import { setupSdk } from "../setup/sdk";
import { Module } from "@nestjs/common";

import { AgentService } from "./agent.service";
import { AgentController } from "./agent.controller";
import { StorageService } from "../storage/storage.service";
import { IssuerNodeService } from "src/issuer/issuer.service";
import { SynapsService } from "src/synaps/synaps.service";

@Module({
  controllers: [AgentController],
  providers: [
    {
      provide: "SDK",
      useFactory: async () => {
        const sdk = await setupSdk({
          rpcUrl: process.env.RPC_URL.replace(/\/$/, ""),
          contractAddress: process.env.STATE_CONTRACT_ADDRESS,
          env: process.env.ENV,
        });
        return sdk;
      },
    },
    AgentService,
    StorageService,
    IssuerNodeService,
    SynapsService,
  ],
})
export class AgentModule {}
