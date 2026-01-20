import {
  Controller,
  Post,
  Get,
  Inject,
  Query,
  Header,
  HttpCode,
} from '@nestjs/common';
import { JsSdk } from '../setup/sdk';
import { AgentService } from './agent.service';
import {
  PROTOCOL_CONSTANTS,
  ProposalRequestMessage,
  CredentialFetchRequestMessage,
  BasicMessage,
} from '@0xpolygonid/js-sdk';
import {
  IssuerNodeService,
  SupportedCredential,
} from 'src/issuer/issuer.service';
import { RawPayload } from 'src/common/raw-payload.decorator';

@Controller()
export class AgentController {
  constructor(
    @Inject('SDK') private readonly _sdk: JsSdk,
    @Inject(AgentService) private readonly _agentService: AgentService,
    @Inject(IssuerNodeService)
    private readonly _issuerService: IssuerNodeService,
  ) {}

  private _validateBasicMessage(basicMessage: BasicMessage) {
    if (!basicMessage.from || !basicMessage.to) {
      throw new Error(
        "Invalid basic message: 'from' and 'to' fields cannot be empty",
      );
    }
    if (basicMessage.to !== this._issuerService.issuerNodeDestination().did) {
      throw new Error(
        `Invalid basic message: 'to' field must be equal to ${
          this._issuerService.issuerNodeDestination().did
        }`,
      );
    }
    if (!basicMessage.thid) {
      throw new Error("Invalid basic message: 'thid' field cannot be empty");
    }
  }

  private _validateProposalRequestMessage(
    proposalMessageBody: ProposalRequestMessage,
  ) {
    if (!proposalMessageBody.body) {
      throw new Error(
        "Invalid proposal message body: 'body' field cannot be empty",
      );
    }
    if (proposalMessageBody.body.credentials.length !== 1) {
      throw new Error(
        "Invalid proposal message body: 'credentials' field must contain exactly one credential",
      );
    }
    const credentialContext = proposalMessageBody.body.credentials[0].context;
    if (credentialContext !== SupportedCredential.JsonLDSchema) {
      throw new Error(
        `Invalid credential context: '${credentialContext}' is not supported`,
      );
    }
    const credentiaType = proposalMessageBody.body.credentials[0].type;
    if (credentiaType !== SupportedCredential.Type) {
      throw new Error(
        `Invalid credential type: '${credentiaType}' is not supported`,
      );
    }
  }

  @Post('agent')
  @Header('Content-Type', 'application/json')
  @HttpCode(200)
  async agent(@RawPayload() payload: Uint8Array): Promise<string> {
    const result = await this._sdk.packageMgr.unpack(payload);
    const { unpackedMessage, unpackedMediaType } = result;

    // support playin text packer only for disclosure protocol messages
    // other messages must use jwz packer
    if (
      unpackedMediaType == PROTOCOL_CONSTANTS.MediaType.PlainMessage &&
      unpackedMessage.type !==
        PROTOCOL_CONSTANTS.PROTOCOL_MESSAGE_TYPE
          .DISCOVERY_PROTOCOL_QUERIES_MESSAGE_TYPE
    ) {
      throw new Error(
        `Invalid media type: '${unpackedMediaType}' is not supported for message type '${unpackedMessage.type}'`,
      );
    }

    let basicMessage: BasicMessage;
    switch (unpackedMessage.type) {
      case PROTOCOL_CONSTANTS.PROTOCOL_MESSAGE_TYPE
        .DISCOVERY_PROTOCOL_QUERIES_MESSAGE_TYPE:
        basicMessage = await this._sdk.discoveryProtocolHandler.handle(
          unpackedMessage,
          {},
        );
        return JSON.stringify(basicMessage);

      case PROTOCOL_CONSTANTS.PROTOCOL_MESSAGE_TYPE
        .PROPOSAL_REQUEST_MESSAGE_TYPE:
        const proposalRequest = unpackedMessage as ProposalRequestMessage;
        this._validateProposalRequestMessage(proposalRequest);
        basicMessage = await this._agentService.handleCredentialProposalRequest(
          proposalRequest,
        );
        return JSON.stringify(basicMessage);

      case PROTOCOL_CONSTANTS.PROTOCOL_MESSAGE_TYPE
        .CREDENTIAL_FETCH_REQUEST_MESSAGE_TYPE:
        const credentialFetchRequest =
          unpackedMessage as CredentialFetchRequestMessage;
        basicMessage = await this._agentService.credentialOfferExchange(
          credentialFetchRequest.body.id,
        );
        return JSON.stringify(basicMessage);

      default:
        return `unknown message type ${unpackedMessage.type}`;
    }
  }

  @Get('offers')
  @Header('Content-Type', 'application/json')
  @HttpCode(200)
  async offers(@Query() query: { sessionID: string }): Promise<string> {
    const basicMessage = await this._agentService.credentialOfferExchange(
      query.sessionID,
    );
    return JSON.stringify(basicMessage);
  }
}
