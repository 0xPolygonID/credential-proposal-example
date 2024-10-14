import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface ISessionInitResponse {
  session_id: string;
  sandbox: boolean;
}

interface ISessionDetailsResponse {
  session: {
    id: string;
    status: string;
  };
}

@Injectable()
export class SynapsService {
  private _apiUrl: string;
  private _apiKey: string;
  constructor(private configService: ConfigService) {
    this._apiUrl = this.configService
      .get<string>('SYNAPS_API_URL', {
        infer: true,
      })
      .replace(/\/$/, '');
    this._apiKey = this.configService.get<string>('SYNAPS_API_KEY', {
      infer: true,
    });
  }

  async createSession(did: string): Promise<ISessionInitResponse> {
    const response = await fetch(`${this._apiUrl}/v4/session/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': this._apiKey,
      },
      body: JSON.stringify({ Alias: did }),
    });

    const sessionInitResponse: ISessionInitResponse = await response.json();
    return sessionInitResponse;
  }

  async sessionDetails(sessionId: string): Promise<ISessionDetailsResponse> {
    const response = await fetch(
      `${this._apiUrl}/v4/individual/session/${sessionId}`,
      {
        method: 'GET',
        headers: {
          'Api-Key': this._apiKey,
        },
      },
    );

    const sessionDetailsResponse: ISessionDetailsResponse =
      await response.json();
    return sessionDetailsResponse;
  }
}
