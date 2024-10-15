import { Inject, Injectable } from '@nestjs/common';
import {
  ProposalRequestMessage,
  ProposalMessageBody,
  CredentialsOfferMessageBody,
  CredentialOfferStatus,
  ProtocolMessage,
  PROTOCOL_CONSTANTS,
  BasicMessage,
  DIDDocument,
} from '@0xpolygonid/js-sdk';
import {
  StorageService,
  Session,
  ClientType,
} from 'src/storage/storage.service';
import { Status } from 'src/storage/storage.service';
import { SynapsService } from 'src/synaps/synaps.service';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';

import {
  IssuerNodeService,
  SupportedCredential,
} from 'src/issuer/issuer.service';

@Injectable()
export class AgentService {
  private _agentUrl: string;
  constructor(
    @Inject(StorageService) private readonly _storageService: StorageService,
    @Inject(SynapsService) private readonly _synapsService: SynapsService,
    @Inject(IssuerNodeService)
    private readonly _issuerService: IssuerNodeService,
    private configService: ConfigService,
  ) {
    this._agentUrl = this.configService
      .get<string>('AGENT_URL', {
        infer: true,
      })
      .replace(/\/$/, '');
  }
  async handleCredentialProposalRequest(
    proposalRequest: ProposalRequestMessage,
  ): Promise<BasicMessage> {
    let session = this._storageService.getSession(proposalRequest.from);
    if (session === undefined) {
      const newSession = await this._synapsService.createSession(
        proposalRequest.from,
      );
      session = {
        id: proposalRequest.from,
        did: proposalRequest.from,
        externalSessionId: newSession.session_id,
        thid: proposalRequest.thid,
        status: Status.SUBMISSION_REQUIRED,
        credentialId: '',
        // we need to define client type
        // because frontend logic for mobile and web is different
        // we are working to unify it
        clientType: this._clientType(proposalRequest.body.did_doc),
      };
      this._storageService.createSession(session);
      const proposal: ProposalMessageBody = this._getProposalMessage(
        this._agentUrl,
        newSession.session_id,
        this._issuerService.issuerNodeDestination().did,
        session.clientType,
      );
      return this._getBasicMessage(
        PROTOCOL_CONSTANTS.PROTOCOL_MESSAGE_TYPE.PROPOSAL_MESSAGE_TYPE,
        session.thid,
        proposal,
        session.did,
      );
    }
    return this._processExistingSession(session);
  }

  async credentialOfferExchange(
    externalSessionId: string,
  ): Promise<BasicMessage> {
    const session =
      this._storageService.findByExternalSessionId(externalSessionId);
    if (session === undefined) {
      throw new Error(`Session '${externalSessionId}' not found`);
    }
    return this._processExistingSession(session);
  }

  private _clientType(didDoc: DIDDocument): ClientType {
    if (didDoc?.service === undefined) {
      return ClientType.Iden3WebRedirectV1;
    }
    for (const service of didDoc.service) {
      switch (service['type']) {
        case 'Iden3MobileServiceV1':
          return ClientType.Iden3MobileServiceV1;
        case 'Iden3WebRedirectV1':
          return ClientType.Iden3WebRedirectV1;
      }
    }
    return ClientType.Iden3WebRedirectV1;
  }

  private async _processExistingSession(
    session: Session,
  ): Promise<BasicMessage> {
    const sessionDetails = await this._synapsService.sessionDetails(
      session.externalSessionId,
    );

    session = {
      ...session,
      status: sessionDetails.session.status as Status,
    };
    this._storageService.updateSession(session.id, session);

    switch (sessionDetails.session.status) {
      case Status.PENDING_VERIFICATION:
        return this._getBasicMessage(
          PROTOCOL_CONSTANTS.PROTOCOL_MESSAGE_TYPE
            .CREDENTIAL_OFFER_MESSAGE_TYPE,
          session.thid,
          this._getCredentialOfferMessage(
            this._agentUrl,
            session.externalSessionId,
            CredentialOfferStatus.Pending,
          ),
          session.did,
        );
      case Status.REJECTED:
        return this._getBasicMessage(
          PROTOCOL_CONSTANTS.PROTOCOL_MESSAGE_TYPE
            .CREDENTIAL_OFFER_MESSAGE_TYPE,
          session.thid,
          this._getCredentialOfferMessage(
            this._agentUrl,
            session.externalSessionId,
            CredentialOfferStatus.Rejected,
          ),
          session.did,
        );
      case Status.APPROVED:
        if (session.credentialId !== '') {
          return this._getBasicMessage(
            PROTOCOL_CONSTANTS.PROTOCOL_MESSAGE_TYPE
              .CREDENTIAL_OFFER_MESSAGE_TYPE,
            session.thid,
            this._getCredentialOfferMessage(
              `${this._issuerService.issuerNodeDestination().url}/v1/agent`,
              session.credentialId,
              CredentialOfferStatus.Completed,
            ),
            session.did,
          );
        }
        const response = await this._issuerService.createCredential({
          credentialSchema: SupportedCredential.JsonSchema,
          type: SupportedCredential.Type,
          credentialSubject: {
            id: session.did,
            human: true,
          },
          expiration: (() => {
            const currentDate = new Date();
            const expirationDate = new Date(
              currentDate.getTime() + 30 * 24 * 60 * 60 * 1000,
            );
            return Math.floor(expirationDate.getTime() / 1000); // Convert to seconds
          })(),
        });
        if (response.id === undefined) {
          throw new Error(`Credential creation failed ${response}`);
        }
        session = {
          ...session,
          credentialId: response.id,
        };
        this._storageService.updateSession(session.id, session);

        return this._getBasicMessage(
          PROTOCOL_CONSTANTS.PROTOCOL_MESSAGE_TYPE
            .CREDENTIAL_OFFER_MESSAGE_TYPE,
          session.thid,
          this._getCredentialOfferMessage(
            `${this._issuerService.issuerNodeDestination().url}/v1/agent`,
            session.credentialId,
            CredentialOfferStatus.Completed,
          ),
          session.did,
        );
      case Status.SUBMISSION_REQUIRED:
        const proposal: ProposalMessageBody = this._getProposalMessage(
          this._agentUrl,
          session.externalSessionId,
          this._issuerService.issuerNodeDestination().did,
          session.clientType,
        );
        return this._getBasicMessage(
          PROTOCOL_CONSTANTS.PROTOCOL_MESSAGE_TYPE.PROPOSAL_MESSAGE_TYPE,
          session.thid,
          proposal,
          session.did,
        );
    }
  }

  private _getCredentialOfferMessage(
    url: string,
    id: string,
    status: CredentialOfferStatus,
  ): CredentialsOfferMessageBody {
    return {
      url: url,
      credentials: [
        {
          id: id,
          description: 'Proof of liveness',
          status: status,
        },
      ],
    };
  }

  private _getBasicMessage(
    type: ProtocolMessage,
    thid: string,
    body: any,
    to: string,
  ): BasicMessage {
    return {
      id: uuidv4(),
      typ: PROTOCOL_CONSTANTS.MediaType.PlainMessage,
      type: type,
      thid: thid,
      body: body,
      from: this._issuerService.issuerNodeDestination().did,
      to: to,
    };
  }

  private _getProposalMessage(
    url: string,
    sessionId: string,
    did: string,
    clientType: ClientType,
  ): ProposalMessageBody {
    return {
      proposals: [
        {
          credentials: [
            {
              type: SupportedCredential.Type,
              context: SupportedCredential.JsonLDSchema,
            },
          ],
          type: 'SynapsCredentialProposal',
          url: `${url}/index.html?session=${sessionId}&did=${did}&clientType=${clientType}`,
          description: 'Synaps credential proposal',
        },
      ],
    };
  }
}
