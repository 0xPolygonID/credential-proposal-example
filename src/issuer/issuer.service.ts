import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export const SupportedCredential = {
  JsonLDSchema:
    "https://raw.githubusercontent.com/anima-protocol/claims-polygonid/main/schemas/json-ld/pol-v1.json-ld",
  JsonSchema:
    "https://raw.githubusercontent.com/anima-protocol/claims-polygonid/main/schemas/json/PoLAnima-v1.json",
  Type: "AnimaProofOfLife",
  Description: "Proof of liveness",
} as const;

export interface ICreateCredentialRequest {
  credentialSchema: string;
  type: string;
  credentialSubject: { [key: string]: any };
  expiration?: number;
}

export interface ICreateCredentialResponse {
  id: string;
}

export interface IIssuerNodeDestination {
  url: string;
  did: string;
}

@Injectable()
export class IssuerNodeService {
  private _url: string;
  private _issuerDid: string;
  private _username: string;
  private _password: string;

  constructor(private configService: ConfigService) {
    this._url = this.configService
      .get<string>("ISSUER_API_AGENT_URL", {
        infer: true,
      })
      .replace(/\/$/, "");
    this._issuerDid = this.configService.get<string>("ISSUER_DID", {
      infer: true,
    });
    this._username = this.configService.get<string>("ISSUER_API_USER_NAME", {
      infer: true,
    });
    this._password = this.configService.get<string>("ISSUER_API_PASSWORD", {
      infer: true,
    });
  }

  async createCredential(
    credentialRequest: ICreateCredentialRequest,
  ): Promise<ICreateCredentialResponse> {
    const credentials = `${this._username}:${this._password}`;
    const encodedCredentials = btoa(credentials);

    const response = await fetch(
      `${this._url}/v2/identities/${this._issuerDid}/credentials`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${encodedCredentials}`,
        },
        body: JSON.stringify(credentialRequest),
      },
    );

    const credentialResponse: ICreateCredentialResponse = await response.json();
    return credentialResponse;
  }

  issuerNodeDestination(): IIssuerNodeDestination {
    return {
      url: this._url,
      did: this._issuerDid,
    };
  }
}
