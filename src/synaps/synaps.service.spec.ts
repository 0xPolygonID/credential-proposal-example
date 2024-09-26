import { SynapsService } from "./synaps.service";
import { Test } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";

describe("SynapsService", () => {
  const userDid =
    "did:iden3:privado:main:2Sfns6mQYkPS9gArHEZSXYbpxfWEjvfMsE1LUK4ZLA";

  let service: SynapsService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
        }),
      ],
      providers: [SynapsService],
    }).compile();
    service = moduleRef.get<SynapsService>(SynapsService);
  });

  describe("createSession", () => {
    it("basic flow", async () => {
      const sessionInfo = await service.createSession(userDid);
      expect(sessionInfo.session_id).toBeDefined();
      const sessionStatus = await service.sessionDetails(
        sessionInfo.session_id,
      );
      expect(sessionStatus.session.status).toBeDefined();
    });
  });
});
