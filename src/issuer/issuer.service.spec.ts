import { IssuerNodeService, SupportedCredential } from "./issuer.service";
import { Test } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";

describe("IssuerNodeService", () => {
  let issuerNodeService: IssuerNodeService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
        }),
      ],
      providers: [IssuerNodeService],
    }).compile();

    issuerNodeService = moduleRef.get<IssuerNodeService>(IssuerNodeService);
  });

  it("should create a credential", async () => {
    const credentialRequest = {
      credentialSchema: SupportedCredential.JsonSchema,
      type: SupportedCredential.Type,
      credentialSubject: {
        id: "did:iden3:privado:main:2Sfns6mQYkPS9gArHEZSXYbpxfWEjvfMsE1LUK4ZLA",
        human: true,
      },
      expiration: 1234567890,
    };

    const response =
      await issuerNodeService.createCredential(credentialRequest);
    expect(response).toBeDefined();
  });
});
